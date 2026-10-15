import { DB } from '../db/index'
import { drizzle as drizzleSqliteProxy } from 'drizzle-orm/sqlite-proxy'
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy'
import { initDB } from './migrator'
import type { MigrationConfig } from './types'

type DrizzleMethod = 'run' | 'all' | 'values' | 'get'
type DrizzleResult = { rows: unknown[] }
type DrizzleQuery = (sql: string, params: unknown[], method: DrizzleMethod) => Promise<DrizzleResult>
type DrizzleBatchQuery = (queries: { sql: string; params: unknown[]; method: DrizzleMethod }[]) => Promise<DrizzleResult[]>

function createPortlDriver(ensureReady?: () => Promise<void>): DrizzleQuery {
  return async (sql: string, params: unknown[], method: DrizzleMethod): Promise<DrizzleResult> => {
    if (ensureReady) {
      await ensureReady()
    }
    return DB.__drizzleQuery(sql, params, method) as Promise<DrizzleResult>
  }
}

function createPortlBatchDriver(driver: DrizzleQuery): DrizzleBatchQuery {
  return async (queries) => {
    const results: DrizzleResult[] = []
    for (const query of queries) {
      results.push(await driver(query.sql, query.params, query.method))
    }
    return results
  }
}

function createReadyPortlDriver(config: MigrationConfig): DrizzleQuery {
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
  const driver = createPortlDriver()
  return drizzleSqliteProxy(driver, createPortlBatchDriver(driver), {
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
  const driver = createReadyPortlDriver(config)
  return drizzleSqliteProxy(driver, createPortlBatchDriver(driver), {
    schema: config.schema
  }) as SqliteRemoteDatabase | SqliteRemoteDatabase<TSchema>
}
