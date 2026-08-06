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

export * from './primitives.js';
export * from './content.js';
export * from './user.js';
export * from './progress.js';
export * from './gamification.js';
export * from './moderation.js';
