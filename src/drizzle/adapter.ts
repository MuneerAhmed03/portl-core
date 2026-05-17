import { DB } from '../db/index'
import { drizzle as drizzleSqliteProxy } from 'drizzle-orm/sqlite-proxy'
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy'
import { initDB } from './migrator'
import type { MigrationConfig } from './types'

type DrizzleMethod = 'run' | 'all' | 'values' | 'get'
type DrizzleResult = { rows: unknown[] }

function toDrizzleResult(result: unknown, method: DrizzleMethod): DrizzleResult {
  if (result && typeof result === 'object' && 'rows' in result) {
    const rows = (result as { rows?: unknown }).rows
    if (Array.isArray(rows)) {
      return { rows }
    }
  }

  if (Array.isArray(result)) {
    return method === 'get' ? { rows: result.length > 0 ? [result[0]] : [] } : { rows: result }
  }

  if (result === null || result === undefined) {
    return { rows: [] }
  }

  return { rows: [result] }
}

function createPortlDriver(ensureReady?: () => Promise<void>) {
  return async (sql: string, params: unknown[], method: DrizzleMethod): Promise<DrizzleResult> => {
    if (ensureReady) {
      await ensureReady()
    }
    const queryResult = await DB.query(sql, params)
    return toDrizzleResult(queryResult, method)
  }
}

function createReadyPortlDriver(config: MigrationConfig): (sql: string, params: unknown[], method: DrizzleMethod) => Promise<DrizzleResult> {
  let readyPromise: Promise<void> | null = null

  function ensureReady(): Promise<void> {
    if (!readyPromise) {
      readyPromise = initDB(config)
    }
    return readyPromise
  }

  return createPortlDriver(ensureReady)
}

export function createDB(): SqliteRemoteDatabase
export function createDB<TSchema extends Record<string, unknown>>(
  schema: TSchema
): SqliteRemoteDatabase<TSchema>
export function createDB<TSchema extends Record<string, unknown>>(
  schema?: TSchema
): SqliteRemoteDatabase | SqliteRemoteDatabase<TSchema> {
  return drizzleSqliteProxy(createPortlDriver(), {
    schema
  }) as SqliteRemoteDatabase | SqliteRemoteDatabase<TSchema>
}

export function createPortlDrizzle(config: MigrationConfig): SqliteRemoteDatabase
export function createPortlDrizzle<TSchema extends Record<string, unknown>>(
  config: MigrationConfig & { schema: TSchema }
): SqliteRemoteDatabase<TSchema>
export function createPortlDrizzle<TSchema extends Record<string, unknown>>(
  config: MigrationConfig & { schema?: TSchema }
): SqliteRemoteDatabase | SqliteRemoteDatabase<TSchema> {
  return drizzleSqliteProxy(createReadyPortlDriver(config), {
    schema: config.schema
  }) as SqliteRemoteDatabase | SqliteRemoteDatabase<TSchema>
}
