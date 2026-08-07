import type { User } from '@zoomout/shared';
import { eq } from 'drizzle-orm';

import type { AuthRepository } from '../auth/auth.repository.js';
import { ForbiddenError, NotFoundError } from '../auth/auth.errors.js';
import type { DatabaseClient } from '../db/client.js';
import { users } from '../db/schema.js';
import { toDomainUser } from './user.mapper.js';

export interface ProfileUpdate {
  readonly displayName?: string | undefined;
  readonly timezone?: string | undefined;
}

/**
 * Reading and updating a reader's own profile.
 *
 * Every method takes both the *authenticated* user and the *requested* user, and
 * compares them. Passing only one and trusting the caller to have checked is how
 * horizontal privilege escalation gets shipped — the check belongs where the data is
 * fetched, not in whichever handler happens to call it.
 */
export class ProfileService {
  constructor(
    private readonly client: DatabaseClient,
    private readonly authRepository: AuthRepository,
  ) {}

  public async getProfile(authenticatedUserId: string, requestedUserId: string): Promise<User> {
    this.assertSelf(authenticatedUserId, requestedUserId);
    return this.loadUser(requestedUserId);
  }

  public async updateProfile(
    authenticatedUserId: string,
    requestedUserId: string,
    update: ProfileUpdate,
  ): Promise<User> {
    this.assertSelf(authenticatedUserId, requestedUserId);

    const changes: Record<string, unknown> = { updatedAt: new Date() };
    if (update.displayName !== undefined) {
      changes['displayName'] = update.displayName;
    }
    if (update.timezone !== undefined) {
      changes['timezone'] = update.timezone;
    }

    await this.client.db.update(users).set(changes).where(eq(users.id, requestedUserId));

    return this.loadUser(requestedUserId);
  }

  /**
   * Returns 403, not 404, when the ids differ.
   *
   * Both leak something. A 404 would hide whether the other account exists, but it
   * would also be a lie to a caller asking about a real record, and it makes a
   * genuine bug look like a missing row. Since ids are unguessable UUIDs, the
   * enumeration risk a 404 protects against is not the live threat here.
   */
  private assertSelf(authenticatedUserId: string, requestedUserId: string): void {
    if (authenticatedUserId !== requestedUserId) {
      throw new ForbiddenError();
    }
  }

  private async loadUser(userId: string): Promise<User> {
    const row = await this.authRepository.findUserById(userId);

    if (row === null) {
      throw new NotFoundError('User not found');
    }

    const providers = await this.authRepository.listProvidersForUser(userId);

    return toDomainUser(row, providers);
  }
}
