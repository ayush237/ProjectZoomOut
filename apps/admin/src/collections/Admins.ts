import type { CollectionConfig } from 'payload';

/**
 * CMS operators — the people who author content.
 *
 * Named `admins`, not `users`, on purpose. `User` in `packages/shared` means an app
 * *reader*, and those live in the backend's Drizzle-managed table with an entirely
 * different shape and lifecycle. Two things called `User` in one codebase would
 * collide the moment `payload generate:types` emits into `packages/shared`.
 *
 * Role-based permissions and an approval workflow are deferred by decision. Nothing
 * here forecloses them: Payload ships RBAC in core, so adding roles later is a field
 * plus access functions, not a migration off the platform.
 */
export const Admins: CollectionConfig = {
  slug: 'admins',

  auth: true,

  admin: {
    useAsTitle: 'email',
    description: 'People who can author and publish ZoomOut content.',
  },

  fields: [
    {
      name: 'displayName',
      type: 'text',
      required: true,
    },
  ],
};
