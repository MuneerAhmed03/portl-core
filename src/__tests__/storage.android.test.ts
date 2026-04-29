import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AndroidStorage } from '../storage/android'

describe('AndroidStorage', () => {
  const bridge = {
    storageGet: vi.fn<[string], string>(),
    storageSet: vi.fn<[string, string], string>(),
    storageDelete: vi.fn<[string], string>(),
    storageClear: vi.fn<[], string>(),
    storageKeys: vi.fn<[], string>(),
    dbQuery: vi.fn<[string, string | null], string>()
  }

  const storage = new AndroidStorage()

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

  it('set calls storageSet with JSON-stringified value', async () => {
    bridge.storageSet.mockReturnValueOnce('ok')
    await storage.set('answer', 42)
    expect(bridge.storageSet).toHaveBeenCalledWith('answer', '42')
  })

  it('get returns null on sentinel value', async () => {
    bridge.storageGet.mockReturnValueOnce('__portl_null__')
    const value = await storage.get('missing')
    expect(value).toBeNull()
  })

  it('get parses JSON values', async () => {
    bridge.storageGet.mockReturnValueOnce(JSON.stringify({ id: 1 }))
    const value = await storage.get<{ id: number }>('user')
    expect(value).toEqual({ id: 1 })
  })

  it('delete calls storageDelete', async () => {
    bridge.storageDelete.mockReturnValueOnce('ok')
    await storage.delete('k1')
    expect(bridge.storageDelete).toHaveBeenCalledWith('k1')
  })

  it('clear calls storageClear', async () => {
    bridge.storageClear.mockReturnValueOnce('ok')
    await storage.clear()
    expect(bridge.storageClear).toHaveBeenCalledOnce()
  })

  it('keys parses key list', async () => {
    bridge.storageKeys.mockReturnValueOnce(JSON.stringify(['a', 'b']))
    const keys = await storage.keys()
    expect(keys).toEqual(['a', 'b'])
  })

  it('set throws on error prefix', async () => {
    bridge.storageSet.mockReturnValueOnce('error:something went wrong')
    await expect(storage.set('x', 1)).rejects.toThrow('something went wrong')
  })

  it('delete throws on error prefix', async () => {
    bridge.storageDelete.mockReturnValueOnce('error:something went wrong')
    await expect(storage.delete('x')).rejects.toThrow('something went wrong')
  })

  it('clear throws on error prefix', async () => {
    bridge.storageClear.mockReturnValueOnce('error:something went wrong')
    await expect(storage.clear()).rejects.toThrow('something went wrong')
  })
})
