import { DB } from '../db/index'
import type { MigrationConfig } from './types'

const DEFAULT_MIGRATIONS_TABLE = '__portl_migrations'
const VALID_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/

function getMigrationsTable(config: MigrationConfig): string {
  const table = config.migrationsTable ?? DEFAULT_MIGRATIONS_TABLE
  if (!VALID_IDENTIFIER.test(table)) {
    throw new Error(`portl migration table name is invalid: ${table}`)
  }
  return table
}

export async function initDB(config: MigrationConfig): Promise<void> {
  const migrationsTable = getMigrationsTable(config)

  await DB.query(
    `CREATE TABLE IF NOT EXISTS ${migrationsTable} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL
    )`
  )

  const existingRows = await DB.query<Array<{ hash: string }>>(`SELECT hash FROM ${migrationsTable}`)
  const appliedHashes = new Set(existingRows.map((row) => row.hash))
  const orderedMigrations = [...config.migrations].sort((a, b) => a.folderMillis - b.folderMillis)

  for (const migration of orderedMigrations) {
    if (appliedHashes.has(migration.hash)) {
      continue
    }

    for (const sql of migration.sql) {
      try {
        await DB.query(sql)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const label = migration.tag ? `${migration.tag} (${migration.hash})` : migration.hash
        throw new Error(`portl migration failed at ${label}: ${message}`)
      }
    }

    await DB.query(`INSERT INTO ${migrationsTable} (hash, applied_at) VALUES (?, ?)`, [
      migration.hash,
      Date.now()
    ])
    appliedHashes.add(migration.hash)
  }
}
