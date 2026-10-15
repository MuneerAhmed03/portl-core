import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

interface InMemoryDBResult {
  changes: number
  lastInsertRowid: number
}

class InMemorySqlJsDatabase {
  private rows: Array<{ id: number; name: string; age: number }> = []
  private lastInsertedId = 0
  private rowsModified = 0

  exec(sql: string, params?: unknown[]): Array<{ columns: string[]; values: unknown[][] }> {
    const normalized = sql.trim().toUpperCase()

    if (normalized.startsWith('SELECT LAST_INSERT_ROWID()')) {
      return [{ columns: ['last_insert_rowid()'], values: [[this.lastInsertedId]] }]
    }

    if (normalized.startsWith('SELECT')) {
      if (normalized.includes('WHERE NAME = ? AND AGE = ?')) {
        const name = String(params?.[0] ?? '')
        const age = Number(params?.[1] ?? NaN)
        const filtered = this.rows.filter((row) => row.name === name && row.age === age)
        return [{ columns: ['id', 'name', 'age'], values: filtered.map((row) => [row.id, row.name, row.age]) }]
      }
      return [{ columns: ['id', 'name', 'age'], values: this.rows.map((row) => [row.id, row.name, row.age]) }]
    }

    throw new Error('Unsupported exec query')
  }

  run(sql: string, params?: unknown[]): void {
    const normalized = sql.trim().toUpperCase()
    this.rowsModified = 0

    if (normalized.startsWith('CREATE TABLE')) {
      return
    }

    if (normalized.startsWith('INSERT')) {
      const name = String(params?.[0] ?? '')
      const age = Number(params?.[1] ?? NaN)
      this.lastInsertedId += 1
      this.rows.push({ id: this.lastInsertedId, name, age })
      this.rowsModified = 1
      return
    }

    if (normalized.startsWith('DELETE')) {
      const id = Number(params?.[0] ?? NaN)
      const before = this.rows.length
      this.rows = this.rows.filter((row) => row.id !== id)
      this.rowsModified = before - this.rows.length
      return
    }

    throw new Error('SQL error')
  }

  getRowsModified(): number {
    return this.rowsModified
  }
}

beforeEach(() => {
  vi.resetModules()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: { AndroidBridge: undefined } as Window
  })
  globalThis.__portlSqlJsInit = async () => ({
    Database: InMemorySqlJsDatabase
  })
})

async function getDBModule() {
  const module = await import('../db')
  return module.DB
}

describe('DB browser fallback (sql.js)', () => {
  it('CREATE TABLE executes without throwing', async () => {
    const DB = await getDBModule()
    await expect(DB.query('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)')).resolves.toEqual({
      changes: 0,
      lastInsertRowid: 0
    })
  })

  it('INSERT returns changes and lastInsertRowid', async () => {
    const DB = await getDBModule()
    await DB.query('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)')
    const result = await DB.query<InMemoryDBResult>('INSERT INTO users (name, age) VALUES (?, ?)', ['Alice', 30])
    expect(result).toEqual({ changes: 1, lastInsertRowid: 1 })
  })

  it('SELECT returns rows with column names', async () => {
    const DB = await getDBModule()
    await DB.query('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)')
    await DB.query('INSERT INTO users (name, age) VALUES (?, ?)', ['Alice', 30])
    const rows = await DB.query<Row[]>('SELECT id, name, age FROM users')
    expect(rows).toEqual([{ id: 1, name: 'Alice', age: 30 }])
  })

  it('DELETE returns changes', async () => {
    const DB = await getDBModule()
    await DB.query('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)')
    await DB.query('INSERT INTO users (name, age) VALUES (?, ?)', ['Alice', 30])
    const result = await DB.query<InMemoryDBResult>('DELETE FROM users WHERE id = ?', [1])
    expect(result.changes).toBe(1)
  })

  it('bad SQL throws an Error', async () => {
    const DB = await getDBModule()
    await expect(DB.query('BOOM SQL')).rejects.toThrow('SQL error')
  })

  it('binds string and number params correctly', async () => {
    const DB = await getDBModule()
    await DB.query('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)')
    await DB.query('INSERT INTO users (name, age) VALUES (?, ?)', ['Alice', 30])
    const rows = await DB.query<Row[]>('SELECT id, name, age FROM users WHERE name = ? AND age = ?', ['Alice', 30])
    expect(rows).toEqual([{ id: 1, name: 'Alice', age: 30 }])
  })

  it('drizzleQuery returns array rows for read methods', async () => {
    const DB = await getDBModule()
    await DB.query('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)')
    await DB.query('INSERT INTO users (name, age) VALUES (?, ?)', ['Alice', 30])
    const result = await DB.__drizzleQuery('SELECT id, name, age FROM users', [], 'all')
    expect(result).toEqual({ rows: [[1, 'Alice', 30]] })
  })

  it('drizzleQuery returns a single array row for get', async () => {
    const DB = await getDBModule()
    await DB.query('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)')
    await DB.query('INSERT INTO users (name, age) VALUES (?, ?)', ['Alice', 30])
    const result = await DB.__drizzleQuery('SELECT id, name, age FROM users', [], 'get')
    expect(result).toEqual({ rows: [1, 'Alice', 30] })
  })

  it('drizzleQuery executes run methods without changing raw query behavior', async () => {
    const DB = await getDBModule()
    await DB.query('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)')
    const result = await DB.__drizzleQuery('INSERT INTO users (name, age) VALUES (?, ?)', ['Alice', 30], 'run')
    const rows = await DB.query<Row[]>('SELECT id, name, age FROM users')
    expect(result).toEqual({ rows: [] })
    expect(rows).toEqual([{ id: 1, name: 'Alice', age: 30 }])
  })
})
