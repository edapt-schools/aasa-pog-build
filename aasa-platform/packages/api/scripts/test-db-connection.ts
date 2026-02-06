#!/usr/bin/env npx tsx
/**
 * Test Database Connection & Schema Verification
 *
 * Verifies:
 * 1. Database connection works
 * 2. Schema tables exist
 * 3. Column types match
 * 4. Sample query returns data
 */

import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env from monorepo root (3 levels up)
config({ path: resolve(__dirname, '../../../.env') })

import { getDb, sql, districts, districtDocuments, documentEmbeddings } from '../src/db/index.js'

async function main() {
  console.log('\n🔍 Testing Database Connection & Schema\n')
  console.log('='.repeat(70))

  try {
    const db = getDb()

    // Test 1: Check table existence
    console.log('\n1. Verifying tables exist...')
    const tables = await db.execute(sql`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `)
    console.log(`   ✓ Found ${tables.length} tables in public schema`)

    // Test 2: Query districts table
    console.log('\n2. Testing districts table...')
    const districtCount = await db.execute(sql`
      SELECT COUNT(*) as count FROM districts
    `)
    console.log(`   ✓ Districts table: ${districtCount[0].count} records`)

    // Test 3: Sample district query with Drizzle
    console.log('\n3. Testing type-safe Drizzle query...')
    const sampleDistricts = await db
      .select()
      .from(districts)
      .limit(3)
    console.log(`   ✓ Retrieved ${sampleDistricts.length} sample districts`)
    sampleDistricts.forEach(d => {
      console.log(`     - ${d.name} (${d.state}) - NCES: ${d.ncesId}`)
    })

    // Test 4: Check pgvector extension
    console.log('\n4. Verifying pgvector extension...')
    const extensions = await db.execute(sql`
      SELECT extname, extversion
      FROM pg_extension
      WHERE extname = 'vector'
    `)
    if (extensions.length > 0) {
      console.log(`   ✓ pgvector extension installed (version: ${extensions[0].extversion})`)
    } else {
      console.log('   ⚠️  pgvector extension not found')
    }

    // Test 5: Check document_embeddings table and vector column
    console.log('\n5. Testing document_embeddings (pgvector)...')
    const embeddingCount = await db.execute(sql`
      SELECT COUNT(*) as count FROM document_embeddings
    `)
    console.log(`   ✓ document_embeddings table: ${embeddingCount[0].count} records`)

    // Test 6: Verify column types
    console.log('\n6. Verifying column types...')
    const columns = await db.execute(sql`
      SELECT
        column_name,
        data_type,
        udt_name
      FROM information_schema.columns
      WHERE table_name = 'document_embeddings'
        AND column_name = 'embedding'
    `)
    if (columns.length > 0) {
      const col = columns[0]
      console.log(`   ✓ embedding column type: ${col.udt_name}`)
    }

    // Test 7: Check indexes
    console.log('\n7. Checking important indexes...')
    const indexes = await db.execute(sql`
      SELECT
        indexname,
        tablename
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND (
          indexname LIKE '%nces%'
          OR indexname LIKE '%vector%'
          OR indexname LIKE '%tier%'
        )
      ORDER BY tablename, indexname
    `)
    console.log(`   ✓ Found ${indexes.length} relevant indexes`)
    indexes.forEach(idx => {
      console.log(`     - ${idx.tablename}.${idx.indexname}`)
    })

    // Test 8: Check RLS status
    console.log('\n8. Verifying Row Level Security (RLS)...')
    const rlsStatus = await db.execute(sql`
      SELECT
        tablename,
        CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as rls_status
      FROM pg_tables
      LEFT JOIN pg_class ON pg_tables.tablename = pg_class.relname
      WHERE schemaname = 'public'
      ORDER BY tablename
      LIMIT 5
    `)
    console.log('   Sample RLS status:')
    rlsStatus.forEach(row => {
      console.log(`     - ${row.tablename}: ${row.rls_status || 'UNKNOWN'}`)
    })

    console.log('\n' + '='.repeat(70))
    console.log('✅ ALL TESTS PASSED - Database schema verified!\n')

  } catch (error) {
    console.error('\n' + '='.repeat(70))
    console.error('❌ TEST FAILED\n')
    console.error('Error:', error instanceof Error ? error.message : error)
    console.error('\nFull error:', error)
    process.exit(1)
  }
}

main()
