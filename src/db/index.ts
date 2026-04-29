import { isAndroid } from '../bridge'
import { AndroidDB } from './android'
import { BrowserDB } from './browser'

type DBImpl = {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T>
}

const useAndroid = isAndroid()
const impl: DBImpl = useAndroid ? new AndroidDB() : new BrowserDB()

export const DB = {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T> {
    return impl.query<T>(sql, params)
  }
}

