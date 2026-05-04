import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MigrationMeta } from '../../drizzle/types'

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn<[string, unknown[]?], Promise<unknown>>()
}))

vi.mock('../../db/index', () => ({
  DB: {
    query: queryMock
  }
}))

async function getMigratorModule() {
  return import('../../drizzle/migrator')
}

function makeMigrations(): MigrationMeta[] {
  return [
    { hash: 'b', folderMillis: 200, sql: ['CREATE TABLE b (id INTEGER)'], bps: false },
    { hash: 'a', folderMillis: 100, sql: ['CREATE TABLE a (id INTEGER)'], bps: false }
  ]
}

describe('initDB', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryMock.mockResolvedValue([])
  })

  it('creates migrations table on first call', async () => {
    const { initDB } = await getMigratorModule()
    await initDB({ migrations: [] })

    expect(queryMock.mock.calls[0]?.[0]).toContain('CREATE TABLE IF NOT EXISTS __portl_migrations')
  })

  it('applies pending migrations in folderMillis order', async () => {
    const { initDB } = await getMigratorModule()
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(111)

    await initDB({ migrations: makeMigrations() })

    expect(queryMock.mock.calls[2]?.[0]).toBe('CREATE TABLE a (id INTEGER)')
    expect(queryMock.mock.calls[4]?.[0]).toBe('CREATE TABLE b (id INTEGER)')
    nowSpy.mockRestore()
  })

  it('skips already-applied migrations', async () => {
    const { initDB } = await getMigratorModule()
    queryMock
      .mockResolvedValueOnce({ changes: 0, lastInsertRowid: 0 })
      .mockResolvedValueOnce([{ hash: 'a' }])
      .mockResolvedValue({ changes: 1, lastInsertRowid: 1 })

    await initDB({ migrations: makeMigrations() })

    expect(queryMock).not.toHaveBeenCalledWith('CREATE TABLE a (id INTEGER)')
    expect(queryMock).toHaveBeenCalledWith('CREATE TABLE b (id INTEGER)')
  })

  it('records each applied migration with hash and numeric timestamp', async () => {
    const { initDB } = await getMigratorModule()
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(123456)

    await initDB({
      migrations: [{ hash: 'h1', folderMillis: 100, sql: ['CREATE TABLE t (id INTEGER)'], bps: false }]
    })

    expect(queryMock).toHaveBeenCalledWith(
      'INSERT INTO __portl_migrations (hash, applied_at) VALUES (?, ?)',
      ['h1', 123456]
    )
    nowSpy.mockRestore()
  })

  it('throws with clear message when a migration statement fails', async () => {
    const { initDB } = await getMigratorModule()
    queryMock
      .mockResolvedValueOnce({ changes: 0, lastInsertRowid: 0 })
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('near "FAIL": syntax error'))

    await expect(
      initDB({
        migrations: [{ hash: 'boom', folderMillis: 1, sql: ['FAIL SQL'], bps: false }]
      })
    ).rejects.toThrow('portl migration failed at boom: near "FAIL": syntax error')
  })

  it('includes migration tag when a tagged migration statement fails', async () => {
    const { initDB } = await getMigratorModule()
    queryMock
      .mockResolvedValueOnce({ changes: 0, lastInsertRowid: 0 })
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('near "FAIL": syntax error'))

    await expect(
      initDB({
        migrations: [
          { hash: 'boom', tag: '0001_tagged', folderMillis: 1, sql: ['FAIL SQL'], bps: false }
        ]
      })
    ).rejects.toThrow('portl migration failed at 0001_tagged (boom): near "FAIL": syntax error')
  })

  it('is idempotent when called twice with same migrations', async () => {
    const { initDB } = await getMigratorModule()
    const appliedHashes = new Set<string>()

    queryMock.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.startsWith('CREATE TABLE IF NOT EXISTS')) {
        return { changes: 0, lastInsertRowid: 0 }
      }
      if (sql.startsWith('SELECT hash FROM')) {
        return [...appliedHashes].map((hash) => ({ hash }))
      }
      if (sql.startsWith('INSERT INTO __portl_migrations')) {
        const hash = String(params?.[0] ?? '')
        appliedHashes.add(hash)
        return { changes: 1, lastInsertRowid: 1 }
      }
      return { changes: 0, lastInsertRowid: 0 }
    })

    const config = {
      migrations: [{ hash: 'once', folderMillis: 1, sql: ['CREATE TABLE once (id INTEGER)'], bps: false }]
    }

    await initDB(config)
    await initDB(config)

    const migrationSqlCalls = queryMock.mock.calls.filter(([sql]) => sql === 'CREATE TABLE once (id INTEGER)')
    expect(migrationSqlCalls).toHaveLength(1)
  })

  it('respects custom migrationsTable name in all SQL statements', async () => {
    const { initDB } = await getMigratorModule()

    await initDB({
      migrationsTable: 'custom_migrations',
      migrations: [{ hash: 'c1', folderMillis: 1, sql: ['CREATE TABLE x (id INTEGER)'], bps: false }]
    })

    expect(queryMock.mock.calls[0]?.[0]).toContain('CREATE TABLE IF NOT EXISTS custom_migrations')
    expect(queryMock.mock.calls[1]?.[0]).toBe('SELECT hash FROM custom_migrations')
    expect(queryMock.mock.calls[3]?.[0]).toBe('INSERT INTO custom_migrations (hash, applied_at) VALUES (?, ?)')
  })

  it('rejects invalid custom migrationsTable names', async () => {
    const { initDB } = await getMigratorModule()

    await expect(initDB({ migrationsTable: 'bad; DROP TABLE notes', migrations: [] })).rejects.toThrow(
      'portl migration table name is invalid: bad; DROP TABLE notes'
    )
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('applies multiple SQL statements in a migration sequentially', async () => {
    const { initDB } = await getMigratorModule()

    await initDB({
      migrations: [
        {
          hash: 'multi',
          folderMillis: 10,
          sql: ['CREATE TABLE one (id INTEGER)', 'ALTER TABLE one ADD COLUMN name TEXT'],
          bps: false
        }
      ]
    })

    expect(queryMock.mock.calls[2]?.[0]).toBe('CREATE TABLE one (id INTEGER)')
    expect(queryMock.mock.calls[3]?.[0]).toBe('ALTER TABLE one ADD COLUMN name TEXT')
    expect(queryMock.mock.calls[4]?.[0]).toBe('INSERT INTO __portl_migrations (hash, applied_at) VALUES (?, ?)')
  })
})
