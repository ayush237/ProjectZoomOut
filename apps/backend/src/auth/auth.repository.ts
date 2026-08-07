import type { AuthProvider } from '@zoomout/shared';
import { and, eq, isNull } from 'drizzle-orm';

import type { DatabaseClient } from '../db/client.js';
import {
  refreshTokens,
  userAuthProviders,
  users,
  type RefreshTokenRow,
  type UserRow,
} from '../db/schema.js';

/**
 * Persistence for identities and sessions.
 *
 * The service depends on this interface rather than on Drizzle, so the decision logic
 * above it is testable without a database and the storage below it can change without
 * touching it.
 */

export interface CreateUserWithIdentity {
  readonly email: string;
  readonly displayName: string;
  readonly dateOfBirth: string;
  readonly timezone: string;
  readonly provider: AuthProvider;
  readonly providerSubject: string;
  readonly passwordHash: string | null;
  readonly emailVerified: boolean;
}

export interface StoreRefreshToken {
  readonly userId: string;
  readonly familyId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<UserRow | null>;
  findUserById(userId: string): Promise<UserRow | null>;
  findUserIdByProviderIdentity(provider: AuthProvider, subject: string): Promise<string | null>;
  findPasswordHashByEmail(email: string): Promise<{ userId: string; passwordHash: string } | null>;
  listProvidersForUser(userId: string): Promise<AuthProvider[]>;
  createUserWithIdentity(input: CreateUserWithIdentity): Promise<UserRow>;
  linkIdentityToUser(
    userId: string,
    provider: AuthProvider,
    subject: string,
  ): Promise<void>;

  storeRefreshToken(input: StoreRefreshToken): Promise<RefreshTokenRow>;
  findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRow | null>;
  markRefreshTokenRotated(tokenId: string, replacedByTokenId: string): Promise<void>;
  revokeRefreshTokenFamily(familyId: string): Promise<void>;
}

export class PostgresAuthRepository implements AuthRepository {
  constructor(private readonly client: DatabaseClient) {}

  public async findUserByEmail(email: string): Promise<UserRow | null> {
    const [row] = await this.client.db.select().from(users).where(eq(users.email, email)).limit(1);
    return row ?? null;
  }

  public async findUserById(userId: string): Promise<UserRow | null> {
    const [row] = await this.client.db.select().from(users).where(eq(users.id, userId)).limit(1);
    return row ?? null;
  }

  public async findUserIdByProviderIdentity(
    provider: AuthProvider,
    subject: string,
  ): Promise<string | null> {
    const [row] = await this.client.db
      .select({ userId: userAuthProviders.userId })
      .from(userAuthProviders)
      .where(
        and(
          eq(userAuthProviders.provider, provider),
          eq(userAuthProviders.providerSubject, subject),
        ),
      )
      .limit(1);

    return row?.userId ?? null;
  }

  public async findPasswordHashByEmail(
    email: string,
  ): Promise<{ userId: string; passwordHash: string } | null> {
    const [row] = await this.client.db
      .select({ userId: users.id, passwordHash: userAuthProviders.passwordHash })
      .from(users)
      .innerJoin(userAuthProviders, eq(userAuthProviders.userId, users.id))
      .where(and(eq(users.email, email), eq(userAuthProviders.provider, 'email')))
      .limit(1);

    // A social-only reader has an identity row but no hash, which is a legitimate
    // state, not an error — they simply cannot sign in with a password.
    if (row === undefined || row.passwordHash === null) {
      return null;
    }

    return { userId: row.userId, passwordHash: row.passwordHash };
  }

  public async listProvidersForUser(userId: string): Promise<AuthProvider[]> {
    const rows = await this.client.db
      .select({ provider: userAuthProviders.provider })
      .from(userAuthProviders)
      .where(eq(userAuthProviders.userId, userId));

    return rows.map((row) => row.provider);
  }

  /**
   * Creates the reader and their first identity in one transaction.
   *
   * Atomic on purpose: a user row with no identity is an account nobody can ever sign
   * in to, and it would still occupy the email address — permanently locking out the
   * person who tried to sign up.
   */
  public async createUserWithIdentity(input: CreateUserWithIdentity): Promise<UserRow> {
    return this.client.db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: input.email,
          displayName: input.displayName,
          dateOfBirth: input.dateOfBirth,
          timezone: input.timezone,
          emailVerifiedAt: input.emailVerified ? new Date() : null,
        })
        .returning();

      if (user === undefined) {
        throw new Error('User insert returned no row');
      }

      await tx.insert(userAuthProviders).values({
        userId: user.id,
        provider: input.provider,
        providerSubject: input.providerSubject,
        passwordHash: input.passwordHash,
      });

      return user;
    });
  }

  public async linkIdentityToUser(
    userId: string,
    provider: AuthProvider,
    subject: string,
  ): Promise<void> {
    await this.client.db.insert(userAuthProviders).values({
      userId,
      provider,
      providerSubject: subject,
      passwordHash: null,
    });
  }

  public async storeRefreshToken(input: StoreRefreshToken): Promise<RefreshTokenRow> {
    const [row] = await this.client.db.insert(refreshTokens).values(input).returning();

    if (row === undefined) {
      throw new Error('Refresh token insert returned no row');
    }

    return row;
  }

  public async findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRow | null> {
    const [row] = await this.client.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);

    return row ?? null;
  }

  public async markRefreshTokenRotated(
    tokenId: string,
    replacedByTokenId: string,
  ): Promise<void> {
    await this.client.db
      .update(refreshTokens)
      .set({ revokedAt: new Date(), replacedByTokenId })
      .where(eq(refreshTokens.id, tokenId));
  }

  /**
   * Revokes every live token descended from one login.
   *
   * Called when an already-rotated token is replayed. Only live rows are touched, so
   * the `revoked_at` timestamps of previously rotated tokens stay as an audit trail
   * of when the chain actually broke.
   */
  public async revokeRefreshTokenFamily(familyId: string): Promise<void> {
    await this.client.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
  }
}
