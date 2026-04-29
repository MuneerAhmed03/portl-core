import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AndroidDB } from '../db/android'

describe('AndroidDB', () => {
  const bridge = {
    storageGet: vi.fn<[string], string>(),
    storageSet: vi.fn<[string, string], string>(),
    storageDelete: vi.fn<[string], string>(),
    storageClear: vi.fn<[], string>(),
    storageKeys: vi.fn<[], string>(),
    dbQuery: vi.fn<[string, string | null], string>()
  }

  const db = new AndroidDB()

  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: {} as Window
    })
    Object.defineProperty(window, 'AndroidBridge', {
      configurable: true,
      writable: true,
      value: bridge
    })
  })

  it('query passes SQL and JSON params to dbQuery', async () => {
    bridge.dbQuery.mockReturnValueOnce(JSON.stringify([{ id: 1 }]))
    await db.query('SELECT * FROM t WHERE id = ?', [1])
    expect(bridge.dbQuery).toHaveBeenCalledWith('SELECT * FROM t WHERE id = ?', '[1]')
  })

  it('query passes null when params are omitted', async () => {
    bridge.dbQuery.mockReturnValueOnce(JSON.stringify([]))
    await db.query('SELECT 1')
    expect(bridge.dbQuery).toHaveBeenCalledWith('SELECT 1', null)
  })

  it('throws when response contains error field', async () => {
    bridge.dbQuery.mockReturnValueOnce(JSON.stringify({ error: 'bad sql' }))
    await expect(db.query('BAD SQL')).rejects.toThrow('bad sql')
  })

  it('returns SELECT array result as-is', async () => {
    const rows = [{ id: 1, name: 'Alice' }]
    bridge.dbQuery.mockReturnValueOnce(JSON.stringify(rows))
    const result = await db.query<typeof rows>('SELECT id, name FROM users')
    expect(result).toEqual(rows)
  })

  it('returns non-SELECT object result as-is', async () => {
    const resultObj = { changes: 1, lastInsertRowid: 4 }
    bridge.dbQuery.mockReturnValueOnce(JSON.stringify(resultObj))
    const result = await db.query<typeof resultObj>('INSERT INTO users(name) VALUES(?)', ['Alice'])
    expect(result).toEqual(resultObj)
  })
})
