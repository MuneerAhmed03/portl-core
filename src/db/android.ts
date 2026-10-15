import { getBridge } from '../bridge'

type ErrorResponse = { error: string }
type DrizzleMethod = 'run' | 'all' | 'values' | 'get'
type DrizzleResult = { rows: unknown[] }

function hasErrorField(value: unknown): value is ErrorResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as { error: unknown }).error === 'string'
  )
}

export class AndroidDB {
  async query<T = unknown>(sql: string, params?: unknown[]): Promise<T> {
    return Promise.resolve().then(() => {
      const result = getBridge().dbQuery(sql, params ? JSON.stringify(params) : null)
      const parsed = JSON.parse(result) as unknown
      if (hasErrorField(parsed)) {
        throw new Error(parsed.error)
      }
      return parsed as T
    })
  }

  async drizzleQuery(sql: string, params: unknown[] = [], method: DrizzleMethod): Promise<DrizzleResult> {
    return Promise.resolve().then(() => {
      const result = getBridge().dbQueryRaw(sql, params.length > 0 ? JSON.stringify(params) : null, method)
      const parsed = JSON.parse(result) as unknown
      if (hasErrorField(parsed)) {
        throw new Error(parsed.error)
      }
      return parsed as DrizzleResult
    })
  }
}
