import { DB } from '../db/index'
import { drizzle } from 'drizzle-orm/sql-js'
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy'

try {
  if (typeof drizzle !== 'function') {
    throw new Error('drizzle export is unavailable')
  }
} catch {
  throw new Error('portl: drizzle-orm is not installed. Run: npm install drizzle-orm')
}

function createPortlDriver() {
  return {
    exec(sql: string, params?: unknown[]) {
      return DB.query(sql, params ?? [])
    }
  }
}

export function createDB(): ReturnType<typeof drizzle>
export function createDB<TSchema extends Record<string, unknown>>(
  schema: TSchema
): ReturnType<typeof drizzle<TSchema>> & SqliteRemoteDatabase<TSchema>
export function createDB<TSchema extends Record<string, unknown>>(
  schema?: TSchema
): ReturnType<typeof drizzle> | (ReturnType<typeof drizzle<TSchema>> & SqliteRemoteDatabase<TSchema>) {
  return drizzle({
    client: createPortlDriver(),
    schema
  }) as ReturnType<typeof drizzle> | (ReturnType<typeof drizzle<TSchema>> & SqliteRemoteDatabase<TSchema>)
}
