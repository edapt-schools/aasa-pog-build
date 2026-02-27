/**
 * Migration: Create event_uploads and event_upload_results tables
 *
 * Run with: npx tsx scripts/create-event-tables.ts
 */

import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import postgres from 'postgres'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
config({ path: resolve(__dirname, '../../../.env') })

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set')
  }

  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' })

  console.log('Creating event upload tables...')

  await sql`
    CREATE TABLE IF NOT EXISTS event_uploads (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id TEXT NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      uploaded_at TIMESTAMP DEFAULT NOW() NOT NULL,
      row_count INTEGER NOT NULL,
      matched_count INTEGER DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'processing'
    )
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_event_uploads_user ON event_uploads (user_id)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_event_uploads_status ON event_uploads (status)
  `

  console.log('  event_uploads table created')

  await sql`
    CREATE TABLE IF NOT EXISTS event_upload_results (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      upload_id UUID NOT NULL REFERENCES event_uploads(id) ON DELETE CASCADE,
      row_index INTEGER NOT NULL,
      input_name VARCHAR(500) NOT NULL,
      input_state VARCHAR(2),
      matched_district_id VARCHAR(20),
      match_confidence DECIMAL,
      district_score DECIMAL,
      district_tier VARCHAR(10)
    )
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_event_upload_results_upload ON event_upload_results (upload_id)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_event_upload_results_district ON event_upload_results (matched_district_id)
  `

  console.log('  event_upload_results table created')
  console.log('Done!')

  await sql.end()
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
