import { beforeEach, describe, expect, it, vi } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

const { queryMock, drizzleQueryMock } = vi.hoisted(() => ({
  queryMock: vi.fn<[string, unknown[]?], Promise<unknown>>(),
  drizzleQueryMock: vi.fn<
    [string, unknown[], 'run' | 'all' | 'values' | 'get'],
    Promise<{ rows: unknown[] }>
  >()
}))

vi.mock('../../db/index', () => ({
  DB: {
    query: queryMock,
    __drizzleQuery: drizzleQueryMock
  }
}))

const notes = sqliteTable('notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  body: text('body').notNull(),
  createdAt: integer('created_at').notNull()
})

const schema = { notes }

async function getAdapterModule() {
  return import('../../drizzle/adapter')
}

describe('drizzle adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryMock.mockResolvedValue([])
    drizzleQueryMock.mockResolvedValue({ rows: [] })
  })

  it('createDB() without schema exposes base query builder methods', async () => {
    const { createDB } = await getAdapterModule()
    const db = createDB()

    expect(typeof db.select).toBe('function')
    expect(typeof db.insert).toBe('function')
    expect(typeof db.update).toBe('function')
    expect(typeof db.delete).toBe('function')
  })

  it('createDB(schema) exposes relational query namespace', async () => {
    const { createDB } = await getAdapterModule()
    const db = createDB(schema)

    expect(db.query).toBeDefined()
    expect(db.query.notes).toBeDefined()
  })

  it('maps full select rows from Drizzle array rows', async () => {
    drizzleQueryMock.mockResolvedValueOnce({ rows: [[1, 'hello', 'body', 100]] })
    const { createDB } = await getAdapterModule()
    const db = createDB(schema)

    const rows = await db.select().from(notes)

    expect(rows).toEqual([{ id: 1, title: 'hello', body: 'body', createdAt: 100 }])
    expect(drizzleQueryMock.mock.calls[0]?.[2]).toBe('all')
  })

  it('maps partial selected columns from Drizzle array rows', async () => {
    drizzleQueryMock.mockResolvedValueOnce({ rows: [[1, 'hello']] })
    const { createDB } = await getAdapterModule()
    const db = createDB(schema)

    const rows = await db.select({ id: notes.id, title: notes.title }).from(notes)

    expect(rows).toEqual([{ id: 1, title: 'hello' }])
  })

  it('normalizes get-style select results to one mapped row', async () => {
    drizzleQueryMock.mockResolvedValueOnce({ rows: [1, 'hello'] })
    const { createDB } = await getAdapterModule()
    const db = createDB(schema)

    const row = await db.select({ id: notes.id, title: notes.title }).from(notes).get()

    expect(row).toEqual({ id: 1, title: 'hello' })
    expect(drizzleQueryMock.mock.calls[0]?.[2]).toBe('get')
  })

  it('executes insert/update/delete without returning through run', async () => {
    const { createDB } = await getAdapterModule()
    const db = createDB(schema)

    await db.insert(notes).values({ title: 'new', body: 'body', createdAt: 200 })
    await db.update(notes).set({ title: 'updated' }).where(eq(notes.id, 1))
    await db.delete(notes).where(eq(notes.id, 1))

    expect(drizzleQueryMock.mock.calls.map((call) => call[2])).toEqual(['run', 'run', 'run'])
  })

  it('maps returning rows for insert/update/delete', async () => {
    drizzleQueryMock
      .mockResolvedValueOnce({ rows: [[2, 'new']] })
      .mockResolvedValueOnce({ rows: [[2, 'updated']] })
      .mockResolvedValueOnce({ rows: [[2, 'updated']] })
    const { createDB } = await getAdapterModule()
    const db = createDB(schema)

    const inserted = await db.insert(notes).values({ title: 'new', body: 'body', createdAt: 200 }).returning({
      id: notes.id,
      title: notes.title
    })
    const updated = await db.update(notes).set({ title: 'updated' }).where(eq(notes.id, 2)).returning({
      id: notes.id,
      title: notes.title
    })
    const deleted = await db.delete(notes).where(eq(notes.id, 2)).returning({
      id: notes.id,
      title: notes.title
    })

    expect(inserted).toEqual([{ id: 2, title: 'new' }])
    expect(updated).toEqual([{ id: 2, title: 'updated' }])
    expect(deleted).toEqual([{ id: 2, title: 'updated' }])
    expect(drizzleQueryMock.mock.calls.map((call) => call[2])).toEqual(['all', 'all', 'all'])
  })

  it('passes CTE queries through the read path', async () => {
    drizzleQueryMock.mockResolvedValueOnce({ rows: [[1]] })
    const { createDB } = await getAdapterModule()
    const db = createDB(schema)
    const recent = db.$with('recent').as(db.select({ id: notes.id }).from(notes))

    const rows = await db.with(recent).select({ id: recent.id }).from(recent)

    expect(rows).toEqual([{ id: 1 }])
    expect(drizzleQueryMock.mock.calls[0]?.[0]).toMatch(/with/i)
    expect(drizzleQueryMock.mock.calls[0]?.[2]).toBe('all')
  })

  it('supports sequential Drizzle batch execution', async () => {
    drizzleQueryMock.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [[1, 'batched']] })
    const { createDB } = await getAdapterModule()
    const db = createDB(schema)

    const result = await db.batch([
      db.insert(notes).values({ title: 'batched', body: 'body', createdAt: 300 }),
      db.select({ id: notes.id, title: notes.title }).from(notes)
    ])

    expect(result).toEqual([{ rows: [] }, [{ id: 1, title: 'batched' }]])
    expect(drizzleQueryMock.mock.calls.map((call) => call[2])).toEqual(['run', 'all'])
  })

  it('createPortlDrizzle runs migrations before the first query', async () => {
    drizzleQueryMock.mockResolvedValueOnce({ rows: [[1]] })
    const { createPortlDrizzle } = await getAdapterModule()
    const db = createPortlDrizzle({
      schema,
      migrations: [{ hash: 'h1', folderMillis: 1, sql: ['CREATE TABLE notes (id INTEGER)'], bps: false }]
    })

    await db.select({ id: notes.id }).from(notes)

    expect(queryMock.mock.calls[0]?.[0]).toContain('CREATE TABLE IF NOT EXISTS __portl_migrations')
    expect(queryMock).toHaveBeenCalledWith('CREATE TABLE notes (id INTEGER)')
    expect(drizzleQueryMock).toHaveBeenCalledTimes(1)
  })

  it('createPortlDrizzle reuses the same bootstrap promise for later queries', async () => {
    const { createPortlDrizzle } = await getAdapterModule()
    const db = createPortlDrizzle({
      schema,
      migrations: [{ hash: 'h1', folderMillis: 1, sql: ['CREATE TABLE notes (id INTEGER)'], bps: false }]
    })

    await db.select().from(notes)
    await db.insert(notes).values({ title: 'hello', body: 'body', createdAt: 100 })

    const migrationTableCreates = queryMock.mock.calls.filter(([statement]) =>
      statement.includes('CREATE TABLE IF NOT EXISTS __portl_migrations')
    )
    expect(migrationTableCreates).toHaveLength(1)
  })

  it('passes raw SQL values queries through values mode', async () => {
    drizzleQueryMock.mockResolvedValueOnce({ rows: [[1]] })
    const { createDB } = await getAdapterModule()
    const db = createDB(schema)

    const result = await db.values(sql`select 1`)

    expect(result).toEqual([[1]])
    expect(drizzleQueryMock.mock.calls[0]?.[2]).toBe('values')
  })
})
