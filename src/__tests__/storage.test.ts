import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

async function getStorageModule() {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: {} as Window
  })
  Object.defineProperty(window, 'AndroidBridge', {
    configurable: true,
    writable: true,
    value: undefined
  })
  const module = await import('../storage')
  return module.Storage
}

describe('Storage browser fallback (IndexedDB)', () => {
  beforeEach(async () => {
    vi.resetModules()
    const Storage = await getStorageModule()
    await Storage.clear()
  })

  it('set then get returns the same value', async () => {
    const Storage = await getStorageModule()
    await Storage.set('name', 'portl')
    const value = await Storage.get<string>('name')
    expect(value).toBe('portl')
  })

  it('get on missing key returns null', async () => {
    const Storage = await getStorageModule()
    const value = await Storage.get('missing-key')
    expect(value).toBeNull()
  })

  it('set overwrites existing key', async () => {
    const Storage = await getStorageModule()
    await Storage.set('count', 1)
    await Storage.set('count', 2)
    const value = await Storage.get<number>('count')
    expect(value).toBe(2)
  })

  it('delete removes a key', async () => {
    const Storage = await getStorageModule()
    await Storage.set('to-delete', true)
    await Storage.delete('to-delete')
    const value = await Storage.get<boolean>('to-delete')
    expect(value).toBeNull()
  })

  it('clear removes all keys', async () => {
    const Storage = await getStorageModule()
    await Storage.set('k1', 'a')
    await Storage.set('k2', 'b')
    await Storage.clear()
    const keys = await Storage.keys()
    expect(keys).toEqual([])
  })

  it('keys returns all stored keys', async () => {
    const Storage = await getStorageModule()
    await Storage.set('alpha', 1)
    await Storage.set('beta', 2)
    const keys = await Storage.keys()
    expect(keys.sort()).toEqual(['alpha', 'beta'])
  })

  it('round-trips JSON values correctly', async () => {
    const Storage = await getStorageModule()
    const values: Array<{ key: string; value: unknown }> = [
      { key: 'string', value: 'hello' },
      { key: 'number', value: 42 },
      { key: 'object', value: { a: 1, b: 'two' } },
      { key: 'array', value: [1, 'two', false] },
      { key: 'boolean', value: true }
    ]

    for (const item of values) {
      await Storage.set(item.key, item.value)
      const result = await Storage.get(item.key)
      expect(result).toEqual(item.value)
    }
  })
})
