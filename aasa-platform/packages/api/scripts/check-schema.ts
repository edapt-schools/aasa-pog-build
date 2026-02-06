#!/usr/bin/env npx tsx
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
config({ path: resolve(__dirname, '../../../.env') })

import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!)

console.log('\nChecking actual districts table columns:\n')

const cols = await sql`
  SELECT column_name, data_type, character_maximum_length
  FROM information_schema.columns
  WHERE table_name = 'districts'
  ORDER BY ordinal_position
`

cols.forEach(c => {
  const len = c.character_maximum_length ? `(${c.character_maximum_length})` : ''
  console.log(`  ${c.column_name}: ${c.data_type}${len}`)
})

await sql.end()
