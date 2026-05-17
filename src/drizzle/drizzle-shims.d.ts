declare module 'drizzle-orm' {
  export function desc<T>(column: T): unknown
}

declare module 'drizzle-orm/sqlite-proxy' {
  export interface SqliteRemoteResult<T = unknown> {
    rows?: T[]
  }

  export type RemoteMethod = 'run' | 'all' | 'values' | 'get'
  export type RemoteCallback = (
    sql: string,
    params: unknown[],
    method: RemoteMethod
  ) => Promise<SqliteRemoteResult>

  export interface SqliteRemoteDatabase<TSchema extends Record<string, unknown> = Record<string, unknown>> {
    select: () => {
      from: (table: { _: { name?: string }; name?: string }) => Promise<unknown>
    }
    insert: (table: { _: { name?: string }; name?: string }) => {
      values: (data: Record<string, unknown>) => Promise<unknown>
    }
    update: () => object
    delete: () => object
    query: TSchema
  }

  export function drizzle<TSchema extends Record<string, unknown> = Record<string, unknown>>(
    callback: RemoteCallback,
    config?: { schema?: TSchema }
  ): SqliteRemoteDatabase<TSchema>
}

declare module 'drizzle-orm/sql-js' {
  export interface DrizzleSqlJsDatabase<TSchema extends Record<string, unknown> | undefined> {
    select: () => {
      from: (table: { _: { name?: string }; name?: string }) => Promise<unknown>
    }
    insert: (table: { _: { name?: string }; name?: string }) => {
      values: (data: Record<string, unknown>) => Promise<unknown>
    }
    update: () => object
    delete: () => object
    query: TSchema extends Record<string, unknown> ? TSchema : never
  }

  export function drizzle<TSchema extends Record<string, unknown> | undefined = undefined>(config: {
    client: { exec(sql: string, params?: unknown[]): Promise<unknown> }
    schema?: TSchema
  }): DrizzleSqlJsDatabase<TSchema>
}

declare module 'drizzle-orm/sqlite-core' {
  export type ColumnBuilder = {
    primaryKey(config?: { autoIncrement?: boolean }): ColumnBuilder
    notNull(): ColumnBuilder
  }

  export function integer(name: string): ColumnBuilder
  export function text(name: string): ColumnBuilder
  export function sqliteTable<TColumns extends Record<string, unknown>>(
    name: string,
    columns: TColumns
  ): TColumns & { _: { name: string }; $inferSelect: Record<string, unknown> }
}
