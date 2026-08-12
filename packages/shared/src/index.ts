/**
 * ZoomOut shared domain model.
 *
 * The single definition of every domain shape crossing a workspace boundary. Neither
 * `apps/backend` nor `apps/mobile` may redefine anything exported here (CLAUDE.md).
 *
 * Each module exports a Zod schema and the TypeScript type inferred from it. Import
 * the type for compile-time work and the schema wherever data enters the system from
 * outside — an API request body, a CMS response, a database row.
 */

/**
 * Note: the CMS-generated types are deliberately NOT re-exported here. They describe
 * Payload's view of the content and diverge from the domain model in known ways (see
 * the header of `cms-generated.ts`). WP3 imports them explicitly via the `./cms`
 * subpath when mapping API responses, so nothing can pick them up by accident.
 */

export * from './primitives.js';
export * from './content.js';
export * from './delivery.js';
export * from './user.js';
export * from './progress.js';
export * from './gamification.js';
export * from './moderation.js';
