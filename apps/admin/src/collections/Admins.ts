import type { CollectionConfig } from 'payload';

/**
 * CMS operators — the people who author content, and the machine accounts that write
 * drafts into it.
 *
 * Named `admins`, not `users`, on purpose. `User` in `packages/shared` means an app
 * *reader*, and those live in the backend's Drizzle-managed table with an entirely
 * different shape and lifecycle. Two things called `User` in one codebase would
 * collide the moment `payload generate:types` emits into `packages/shared`.
 *
 * Human role-based permissions are still deferred by decision — at a team of one there
 * is nobody to differentiate. `accountType` is not that decision reopened: it separates
 * people from programs, which is a distinction that exists at a team of one and stops
 * mattering only when there is no pipeline.
 */
export const Admins: CollectionConfig = {
  slug: 'admins',

  /**
   * `useAPIKey` gives every account a long-lived key it can present as
   * `Authorization: admins API-Key <key>`.
   *
   * The pipeline held a **login** before this — an operator's email and password in an
   * environment variable, carrying that human's full rights. A key is better on three
   * counts, and only the third is the point: it is not a password, it is revocable on
   * its own without disturbing the human whose account it borrowed, and it can belong
   * to an account that is not allowed to publish.
   */
  auth: {
    useAPIKey: true,
  },

  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'displayName', 'accountType'],
    description: 'People who can author and publish ZoomOut content, and the machine accounts that draft it.',
  },

  fields: [
    {
      name: 'displayName',
      type: 'text',
      required: true,
    },
    {
      name: 'accountType',
      type: 'select',
      required: true,
      defaultValue: 'human',
      options: [
        { label: 'Human — can publish', value: 'human' },
        { label: 'Machine — drafts only, cannot publish', value: 'machine' },
      ],
      admin: {
        position: 'sidebar',
        description:
          'A machine account writes drafts and cannot publish, unpublish, or edit anything already published — enforced by access control, not by the caller behaving. Defaults to human so an account is never silently created without publish rights.',
      },
    },
  ],
};
