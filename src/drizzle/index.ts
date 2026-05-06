/*
 * portl/drizzle — optional Drizzle ORM support
 *
 * Setup:
 *   1. npm install drizzle-orm drizzle-kit
 *   2. Define your schema in schema.ts using drizzle-orm/sqlite-core
 *   3. Add drizzle.config.ts pointing to your schema
 *   4. Run: npx drizzle-kit generate
 *   5. Run: npx portl drizzle bundle
 *      This writes migrations.generated.ts for Portl's browser/Android runtime
 *   6. Import migrations.generated.ts and create the db with createPortlDrizzle({ schema, migrations })
 *      The first query waits for migrations before executing.
 *
 * Without drizzle (raw SQL):
 *   import { DB } from 'portl'
 *   await DB.query('SELECT * FROM notes')
 *
 * Both approaches use the same underlying SQLite database on device.
 */

export { createDB, createPortlDrizzle } from './adapter'
export { initDB } from './migrator'
export type { MigrationConfig, MigrationMeta } from './types'
