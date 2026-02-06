#!/usr/bin/env npx tsx
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
config({ path: resolve(__dirname, '../../../.env') })

import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!)

const tables = [
  'districts',
  'ccd_staff_data',
  'state_registry_districts',
  'district_matches',
  'district_documents',
  'document_crawl_log',
  'district_keyword_scores',
  'document_embeddings',
  'data_imports',
  'quality_flags'
]

console.log('\n=== ACTUAL DATABASE SCHEMA ===\n')

for (const tableName of tables) {
  console.log(`\n--- ${tableName} ---`)

  const cols = await sql`
    SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = ${tableName}
    ORDER BY ordinal_position
  `

  if (cols.length === 0) {
    console.log('  ❌ Table does not exist')
    continue
  }

  cols.forEach(c => {
    const len = c.character_maximum_length ? `(${c.character_maximum_length})` : ''
    const nullable = c.is_nullable === 'YES' ? ' NULL' : ' NOT NULL'
    const defaultVal = c.column_default ? ` DEFAULT ${c.column_default}` : ''
    console.log(`  ${c.column_name}: ${c.data_type}${len}${nullable}${defaultVal}`)
  })
}

await sql.end()
