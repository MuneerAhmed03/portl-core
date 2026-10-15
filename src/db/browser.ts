const SQL_JS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js'
const SQL_JS_WASM_URL = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.wasm'

interface SqlJsExecResult {
  columns: string[]
  values: unknown[][]
}

interface SqlJsDatabase {
  exec(sql: string, params?: unknown[]): SqlJsExecResult[]
  run(sql: string, params?: unknown[]): void
  getRowsModified(): number
}

interface SqlJsStatic {
  Database: new () => SqlJsDatabase
}

type SqlJsInit = (config: { locateFile: (file: string) => string }) => Promise<SqlJsStatic>
type DrizzleMethod = 'run' | 'all' | 'values' | 'get'
type DrizzleResult = { rows: unknown[] }

declare global {
  var __portlSqlJsInit: SqlJsInit | undefined
}

function mapSelectRows(result: SqlJsExecResult): Record<string, unknown>[] {
  return result.values.map((row) => {
    const mapped: Record<string, unknown> = {}
    for (let idx = 0; idx < result.columns.length; idx += 1) {
      mapped[result.columns[idx]] = row[idx]
    }
    return mapped
  })
}

async function loadSqlJsInit(): Promise<SqlJsInit> {
  if (typeof globalThis.__portlSqlJsInit !== 'undefined') {
    return globalThis.__portlSqlJsInit
  }

  try {
    const module = (await import(/* @vite-ignore */ SQL_JS_URL)) as { default?: unknown }
    const init = module.default
    if (typeof init !== 'function') {
      throw new Error('sql.js initializer not found')
    }
    return init as SqlJsInit
  } catch {
    throw new Error('portl: failed to load sql.js from CDN. Check your internet connection.')
  }
}

export class BrowserDB {
  private dbPromise: Promise<SqlJsDatabase> | null = null

  private getDB(): Promise<SqlJsDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = (async () => {
        const initSqlJs = await loadSqlJsInit()
        const SQL = await initSqlJs({ locateFile: () => SQL_JS_WASM_URL })
        return new SQL.Database()
      })()
    }
    return this.dbPromise
  }

  async query<T = unknown>(sql: string, params?: unknown[]): Promise<T> {
    try {
      const db = await this.getDB()
      const statementType = sql.trim().split(/\s+/, 1)[0]?.toUpperCase() ?? ''

      if (statementType === 'SELECT') {
        const results = db.exec(sql, params)
        if (results.length === 0) {
          return [] as T
        }
        return mapSelectRows(results[0]) as T
      }

      db.run(sql, params)
      const changes = db.getRowsModified()
      const lastInsertRows = db.exec('SELECT last_insert_rowid()')
      const lastInsertRowid = Number(lastInsertRows[0]?.values[0]?.[0] ?? 0)
      return { changes, lastInsertRowid } as T
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(message)
    }
  }

  async drizzleQuery(sql: string, params: unknown[] = [], method: DrizzleMethod): Promise<DrizzleResult> {
    try {
      const db = await this.getDB()

      if (method === 'run') {
        db.run(sql, params)
        return { rows: [] }
      }

      const results = db.exec(sql, params)
      const rows = results[0]?.values ?? []
      return method === 'get' ? { rows: rows[0] ?? [] } : { rows }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(message)
    }
  }
}
