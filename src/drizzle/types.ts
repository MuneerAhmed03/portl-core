export interface PortlDriver {
  exec(sql: string, params?: unknown[]): Promise<unknown>
}

export interface MigrationMeta {
  sql: string[]
  folderMillis: number
  hash: string
  bps: boolean
}

export interface MigrationConfig {
  migrations: MigrationMeta[]
  migrationsTable?: string
}
