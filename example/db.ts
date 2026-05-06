import { createPortlDrizzle } from 'portl/drizzle'
import migrations from './migrations.generated'
import { schema } from './schema'

export const db = createPortlDrizzle({ schema, migrations })
