import { isAndroid } from '../bridge'
import { AndroidStorage } from './android'
import { BrowserStorage } from './browser'

type StorageImpl = {
  set(key: string, value: unknown): Promise<void>
  get<T = unknown>(key: string): Promise<T | null>
  delete(key: string): Promise<void>
  clear(): Promise<void>
  keys(): Promise<string[]>
}

const useAndroid = isAndroid()
const impl: StorageImpl = useAndroid ? new AndroidStorage() : new BrowserStorage()

export const Storage = {
  set(key: string, value: unknown): Promise<void> {
    return impl.set(key, value)
  },
  get<T = unknown>(key: string): Promise<T | null> {
    return impl.get<T>(key)
  },
  delete(key: string): Promise<void> {
    return impl.delete(key)
  },
  clear(): Promise<void> {
    return impl.clear()
  },
  keys(): Promise<string[]> {
    return impl.keys()
  }
}

