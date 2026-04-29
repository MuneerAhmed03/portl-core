import { createDB, initDB } from 'portl/drizzle'
import migrations from './migrations.json'
import { schema } from './schema'

export const db = createDB(schema)

export async function setupDB() {
  await initDB({ migrations })
}
