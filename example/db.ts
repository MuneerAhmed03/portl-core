import { createDB, initDB } from 'portl/drizzle'
import migrations from './migrations.generated'
import { schema } from './schema'

export const db = createDB(schema)

export async function setupDB() {
  await initDB({ migrations })
}
