import { DB } from '../db/index'
import { drizzle } from 'drizzle-orm/sql-js'
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy'
import { initDB } from './migrator'
import type { MigrationConfig } from './types'

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

function createReadyPortlDriver(config: MigrationConfig) {
  let readyPromise: Promise<void> | null = null

  function ensureReady(): Promise<void> {
    if (!readyPromise) {
      readyPromise = initDB(config)
    }
    return readyPromise
  }

  return {
    async exec(sql: string, params?: unknown[]) {
      await ensureReady()
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

export function createPortlDrizzle(config: MigrationConfig): ReturnType<typeof drizzle>
export function createPortlDrizzle<TSchema extends Record<string, unknown>>(
  config: MigrationConfig & { schema: TSchema }
): ReturnType<typeof drizzle<TSchema>> & SqliteRemoteDatabase<TSchema>
export function createPortlDrizzle<TSchema extends Record<string, unknown>>(
  config: MigrationConfig & { schema?: TSchema }
): ReturnType<typeof drizzle> | (ReturnType<typeof drizzle<TSchema>> & SqliteRemoteDatabase<TSchema>) {
  return drizzle({
    client: createReadyPortlDriver(config),
    schema: config.schema
  }) as ReturnType<typeof drizzle> | (ReturnType<typeof drizzle<TSchema>> & SqliteRemoteDatabase<TSchema>)
}
