import { getBridge } from '../bridge'

const ERROR_PREFIX = 'error:'
const NULL_SENTINEL = '__portl_null__'

function throwIfBridgeError(result: string): void {
  if (result.startsWith(ERROR_PREFIX)) {
    throw new Error(result.slice(ERROR_PREFIX.length))
  }
}

export class AndroidStorage {
  async set(key: string, value: unknown): Promise<void> {
    return Promise.resolve().then(() => {
      const result = getBridge().storageSet(key, JSON.stringify(value))
      throwIfBridgeError(result)
    })
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    return Promise.resolve().then(() => {
      const result = getBridge().storageGet(key)
      if (result === NULL_SENTINEL) {
        return null
      }
      return JSON.parse(result) as T
    })
  }

  async delete(key: string): Promise<void> {
    return Promise.resolve().then(() => {
      const result = getBridge().storageDelete(key)
      throwIfBridgeError(result)
    })
  }

  async clear(): Promise<void> {
    return Promise.resolve().then(() => {
      const result = getBridge().storageClear()
      throwIfBridgeError(result)
    })
  }

  async keys(): Promise<string[]> {
    return Promise.resolve().then(() => {
      const result = getBridge().storageKeys()
      return JSON.parse(result) as string[]
    })
  }
}

