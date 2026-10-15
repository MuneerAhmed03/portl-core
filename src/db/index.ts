import { isAndroid } from '../bridge'
import { AndroidDB } from './android'
import { BrowserDB } from './browser'

type DBImpl = {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T>
  drizzleQuery(sql: string, params: unknown[], method: 'run' | 'all' | 'values' | 'get'): Promise<{ rows: unknown[] }>
}

const useAndroid = isAndroid()
const impl: DBImpl = useAndroid ? new AndroidDB() : new BrowserDB()

export const DB = {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T> {
    return impl.query<T>(sql, params)
  },

  /** @internal Used by portl/drizzle to satisfy drizzle-orm/sqlite-proxy row-shape requirements. */
  __drizzleQuery(
    sql: string,
    params: unknown[] = [],
    method: 'run' | 'all' | 'values' | 'get'
  ): Promise<{ rows: unknown[] }> {
    return impl.drizzleQuery(sql, params, method)
  }
}
