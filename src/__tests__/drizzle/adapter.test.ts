import { beforeEach, describe, expect, it, vi } from 'vitest'

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn<[string, unknown[]?], Promise<unknown>>()
}))

vi.mock('../../db/index', () => ({
  DB: {
    query: queryMock
  }
}))

vi.mock('drizzle-orm', () => ({}))

vi.mock('drizzle-orm/sql-js', () => {
  return {
    drizzle(config: { client: { exec: (sql: string, params?: unknown[]) => Promise<unknown> }; schema?: unknown }) {
      const db = {
        select() {
          return {
            from(table: { name?: string; _: { name?: string } }) {
              const tableName = table._?.name ?? table.name ?? 'unknown_table'
              return config.client.exec(`SELECT * FROM "${tableName}"`, [])
            }
          }
        },
        insert(table: { name?: string; _: { name?: string } }) {
          return {
            values(data: Record<string, unknown>) {
              const tableName = table._?.name ?? table.name ?? 'unknown_table'
              const keys = Object.keys(data)
              const placeholders = keys.map(() => '?').join(', ')
              const columns = keys.map((key) => `"${key}"`).join(', ')
              const params = keys.map((key) => data[key])
              return config.client.exec(
                `INSERT INTO "${tableName}" (${columns}) VALUES (${placeholders})`,
                params
              )
            }
          }
        },
        update() {
          return {}
        },
        delete() {
          return {}
        }
      } as {
        select: () => { from: (table: { name?: string; _: { name?: string } }) => Promise<unknown> }
        insert: (
          table: { name?: string; _: { name?: string } }
        ) => { values: (data: Record<string, unknown>) => Promise<unknown> }
        update: () => object
        delete: () => object
        query?: Record<string, unknown>
      }

      if (config.schema) {
        db.query = { ...config.schema }
      }

      return db
    }
  }
})

async function getAdapterModule() {
  return import('../../drizzle/adapter')
}

describe('drizzle adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryMock.mockResolvedValue([])
  })

  it('createDB() without schema exposes base query builder methods', async () => {
    const { createDB } = await getAdapterModule()
    const db = createDB()

    expect(typeof db.select).toBe('function')
    expect(typeof db.insert).toBe('function')
    expect(typeof db.update).toBe('function')
    expect(typeof db.delete).toBe('function')
    expect('query' in db).toBe(false)
  })

  it('createDB(schema) exposes relational query namespace', async () => {
    const { createDB } = await getAdapterModule()
    const schema = { notes: { name: 'notes' } }
    const db = createDB(schema)

    expect(db.query).toBeDefined()
    expect(db.query.notes).toBeDefined()
  })

  it('select().from(...) calls DB.query with a SELECT statement', async () => {
    const { createDB } = await getAdapterModule()
    const db = createDB()
    const table = { _: { name: 'notes' } }

    await db.select().from(table)

    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(queryMock.mock.calls[0]?.[0]).toMatch(/^\s*SELECT\s+/i)
    expect(Array.isArray(queryMock.mock.calls[0]?.[1])).toBe(true)
  })

  it('insert(...).values(...) calls DB.query with INSERT and bound params array', async () => {
    const { createDB } = await getAdapterModule()
    const db = createDB()
    const table = { _: { name: 'notes' } }

    await db.insert(table).values({ title: 'hello', body: 'world' })

    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(queryMock.mock.calls[0]?.[0]).toMatch(/^\s*INSERT\s+/i)
    expect(queryMock.mock.calls[0]?.[1]).toEqual(['hello', 'world'])
    expect(typeof queryMock.mock.calls[0]?.[1]).not.toBe('string')
  })

  it('createPortlDrizzle runs migrations before the first query', async () => {
    const { createPortlDrizzle } = await getAdapterModule()
    const db = createPortlDrizzle({
      migrations: [{ hash: 'h1', folderMillis: 1, sql: ['CREATE TABLE notes (id INTEGER)'], bps: false }]
    })
    const table = { _: { name: 'notes' } }

    await db.select().from(table)

    expect(queryMock.mock.calls[0]?.[0]).toContain('CREATE TABLE IF NOT EXISTS __portl_migrations')
    expect(queryMock).toHaveBeenCalledWith('CREATE TABLE notes (id INTEGER)')
    expect(queryMock.mock.calls.at(-1)?.[0]).toMatch(/^\s*SELECT\s+/i)
  })

  it('createPortlDrizzle reuses the same bootstrap promise for later queries', async () => {
    const { createPortlDrizzle } = await getAdapterModule()
    const db = createPortlDrizzle({
      migrations: [{ hash: 'h1', folderMillis: 1, sql: ['CREATE TABLE notes (id INTEGER)'], bps: false }]
    })
    const table = { _: { name: 'notes' } }

    await db.select().from(table)
    await db.insert(table).values({ title: 'hello' })

    const migrationTableCreates = queryMock.mock.calls.filter(([sql]) =>
      sql.includes('CREATE TABLE IF NOT EXISTS __portl_migrations')
    )
    expect(migrationTableCreates).toHaveLength(1)
  })
})
