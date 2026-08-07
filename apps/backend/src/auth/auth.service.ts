import type { LocalDate } from '@zoomout/shared';

import type { AppConfig } from '../config/env.js';
import { toError } from '../errors.js';
import type { AppLogger } from '../logging/logger.js';
import { decideAccountLink } from './accountLinking.js';
import { localDateIn, meetsAgeThreshold } from './ageGate.js';
import {
  BelowMinimumAgeError,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  ProviderEmailMissingError,
  RefreshTokenReuseError,
  UnverifiedEmailCollisionError,
} from './auth.errors.js';
import type { AuthRepository } from './auth.repository.js';
import { hashPassword, simulatePasswordVerification, verifyPassword } from './password.js';
import type { ProviderTokenVerifier, SocialProvider } from './providers/providerVerifier.js';
import { hashRefreshToken, type TokenService } from './tokens.js';

export interface SignUpWithEmail {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly dateOfBirth: LocalDate;
  readonly timezone: string;
}

export interface SignInWithEmail {
  readonly email: string;
  readonly password: string;
}

export interface SignInWithProvider {
  readonly provider: SocialProvider;
  readonly idToken: string;
  /** Only consulted when the provider identity is new and an account must be created. */
  readonly displayName?: string | undefined;
  readonly dateOfBirth?: LocalDate | undefined;
  readonly timezone?: string | undefined;
}

export interface IssuedSession {
  readonly userId: string;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessTokenExpiresInSeconds: number;
}

/**
 * Authentication decisions.
 *
 * The age gate, credential checking, account linking and token rotation all live here;
 * the routes above only translate HTTP, and the repository below only reads and writes.
 */
export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly tokens: TokenService,
    private readonly providerVerifier: ProviderTokenVerifier,
    private readonly config: AppConfig,
    private readonly logger: AppLogger,
  ) {}

  public async signUpWithEmail(input: SignUpWithEmail): Promise<IssuedSession> {
    const email = normaliseEmail(input.email);

    this.assertOldEnough(input.dateOfBirth, input.timezone);

    // Checked before the write as well as relied on afterwards: the unique index is
    // the real guarantee, but this turns the common case into a clear 409 instead of
    // a constraint violation surfacing as a 500.
    if (await this.repository.findUserByEmail(email)) {
      throw new EmailAlreadyRegisteredError();
    }

    const passwordHash = await hashPassword(input.password);

    const user = await this.repository.createUserWithIdentity({
      email,
      displayName: input.displayName,
      dateOfBirth: input.dateOfBirth,
      timezone: input.timezone,
      provider: 'email',
      providerSubject: email,
      passwordHash,
      // Password signup proves nothing about the address. Verification is out of
      // scope for WP2; the column stays null until that flow exists.
      emailVerified: false,
    });

    this.logger.info({ userId: user.id, provider: 'email' }, 'Account created');

    return this.issueSession(user.id);
  }

  public async signInWithEmail(input: SignInWithEmail): Promise<IssuedSession> {
    const email = normaliseEmail(input.email);
    const credentials = await this.repository.findPasswordHashByEmail(email);

    if (credentials === null) {
      // Burn comparable time before failing. Returning immediately here would make a
      // registered address measurably slower than an unregistered one, which leaks
      // exactly what the identical error message is there to hide.
      await simulatePasswordVerification();
      throw new InvalidCredentialsError();
    }

    if (!(await verifyPassword(input.password, credentials.passwordHash))) {
      throw new InvalidCredentialsError();
    }

    return this.issueSession(credentials.userId);
  }

  /**
   * Signs in — or links, or creates — from a verified Apple or Google identity.
   */
  public async signInWithProvider(input: SignInWithProvider): Promise<IssuedSession> {
    const identity = await this.providerVerifier.verify(input.provider, input.idToken);

    const decision = decideAccountLink({
      userIdForProviderSubject: await this.repository.findUserIdByProviderIdentity(
        input.provider,
        identity.subject,
      ),
      userIdForEmail:
        identity.email === null
          ? null
          : ((await this.repository.findUserByEmail(identity.email))?.id ?? null),
      emailVerifiedByProvider: identity.emailVerified,
    });

    switch (decision.kind) {
      case 'sign-in':
        return this.issueSession(decision.userId);

      case 'link':
        await this.repository.linkIdentityToUser(
          decision.userId,
          input.provider,
          identity.subject,
        );
        this.logger.info(
          { userId: decision.userId, provider: input.provider },
          'Linked provider to existing account',
        );
        return this.issueSession(decision.userId);

      case 'reject':
        throw new UnverifiedEmailCollisionError();

      case 'create':
        return this.createFromProvider(input, identity.subject, identity.email, identity.emailVerified);
    }
  }

  /**
   * Exchanges a refresh token for a new session, rotating it in the process.
   *
   * @throws {RefreshTokenReuseError} if an already-rotated token is presented, in
   * which case the entire family is revoked first.
   */
  public async refreshSession(refreshToken: string): Promise<IssuedSession> {
    const stored = await this.repository.findRefreshTokenByHash(hashRefreshToken(refreshToken));

    if (stored === null) {
      throw new InvalidRefreshTokenError();
    }

    if (stored.revokedAt !== null) {
      // A token that was already rotated is being presented again. Either it was
      // stolen and is being replayed, or the legitimate client raced itself. There is
      // no way to tell, so the safe response is to end every session in the family —
      // if it was theft, the attacker's freshly minted token dies with it.
      await this.repository.revokeRefreshTokenFamily(stored.familyId);
      this.logger.warn(
        { userId: stored.userId, familyId: stored.familyId },
        'Refresh token reuse detected; revoked the token family',
      );
      throw new RefreshTokenReuseError();
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new InvalidRefreshTokenError();
    }

    const session = await this.issueSession(stored.userId, stored.familyId);
    const replacement = await this.repository.findRefreshTokenByHash(
      hashRefreshToken(session.refreshToken),
    );

    if (replacement !== null) {
      await this.repository.markRefreshTokenRotated(stored.id, replacement.id);
    }

    return session;
  }

  private async createFromProvider(
    input: SignInWithProvider,
    subject: string,
    email: string | null,
    emailVerified: boolean,
  ): Promise<IssuedSession> {
    if (email === null) {
      throw new ProviderEmailMissingError();
    }

    // Signup details the provider cannot supply. Apple in particular returns a name
    // only on the very first authorisation, so the client must send these alongside
    // the token for a first-time sign-in.
    const dateOfBirth = input.dateOfBirth;
    const timezone = input.timezone;

    if (dateOfBirth === undefined || timezone === undefined) {
      throw new ProviderEmailMissingError();
    }

    this.assertOldEnough(dateOfBirth, timezone);

    const user = await this.repository.createUserWithIdentity({
      email,
      displayName: input.displayName ?? email.split('@')[0] ?? 'Reader',
      dateOfBirth,
      timezone,
      provider: input.provider,
      providerSubject: subject,
      passwordHash: null,
      emailVerified,
    });

    this.logger.info({ userId: user.id, provider: input.provider }, 'Account created');

    return this.issueSession(user.id);
  }

  /**
   * Refuses signup below the configured threshold, before anything is written.
   *
   * Nothing about a refused attempt is persisted — no user row, no partial record. A
   * rejected under-age signup should leave no trace of a minor's data.
   */
  private assertOldEnough(dateOfBirth: LocalDate, timezone: string): void {
    const today = resolveToday(timezone, this.logger);

    if (!meetsAgeThreshold(dateOfBirth, this.config.AUTH_MINIMUM_AGE_YEARS, today)) {
      throw new BelowMinimumAgeError(this.config.AUTH_MINIMUM_AGE_YEARS);
    }
  }

  private async issueSession(userId: string, familyId?: string): Promise<IssuedSession> {
    const accessToken = await this.tokens.issueAccessToken({ userId });
    const refresh = this.tokens.issueRefreshToken();

    await this.repository.storeRefreshToken({
      userId,
      familyId: familyId ?? this.tokens.newTokenFamilyId(),
      tokenHash: refresh.tokenHash,
      expiresAt: refresh.expiresAt,
    });

    return {
      userId,
      accessToken,
      refreshToken: refresh.token,
      accessTokenExpiresInSeconds: this.config.AUTH_ACCESS_TOKEN_TTL_SECONDS,
    };
  }
}

/** Lowercased and trimmed, so one address cannot become two accounts by casing. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * "Today" in the user's own timezone.
 *
 * Age is a calendar question, so it has to be asked in the calendar the person
 * actually lives in — evaluating in UTC would refuse someone for a day, or admit them
 * a day early, depending on which side of the line they are.
 */
function resolveToday(timezone: string, logger: AppLogger): LocalDate {
  try {
    return localDateIn(timezone);
  } catch (error) {
    // An unknown timezone should not become a 500 on the signup path. UTC is the
    // conservative fallback and the anomaly is recorded rather than swallowed.
    logger.warn({ err: toError(error), timezone }, 'Unknown timezone at signup; falling back to UTC');
    return localDateIn('UTC');
  }
}
