#!/usr/bin/env npx tsx
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
config({ path: resolve(__dirname, '../../../.env') })

import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!)

console.log('\n=== Creating Database Indexes ===\n')

// 1. Create HNSW index on embeddings for vector similarity search
console.log('1. Creating HNSW index on document_embeddings.embedding...')
try {
  await sql`
    CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw
    ON document_embeddings
    USING hnsw (embedding vector_cosine_ops)
  `
  console.log('   ✅ HNSW index created')
} catch (error) {
  console.error('   ❌ Failed to create HNSW index:', error)
}

// 2. Create composite indexes for common queries
console.log('\n2. Creating composite indexes...')

const indexes = [
  {
    name: 'idx_districts_state',
    table: 'districts',
    columns: ['state'],
    sql: 'CREATE INDEX IF NOT EXISTS idx_districts_state ON districts(state)',
  },
  {
    name: 'idx_districts_nces_id',
    table: 'districts',
    columns: ['nces_id'],
    sql: 'CREATE INDEX IF NOT EXISTS idx_districts_nces_id ON districts(nces_id)',
  },
  {
    name: 'idx_district_documents_nces',
    table: 'district_documents',
    columns: ['nces_id'],
    sql: 'CREATE INDEX IF NOT EXISTS idx_district_documents_nces ON district_documents(nces_id)',
  },
  {
    name: 'idx_keyword_scores_nces',
    table: 'district_keyword_scores',
    columns: ['nces_id'],
    sql: 'CREATE INDEX IF NOT EXISTS idx_keyword_scores_nces ON district_keyword_scores(nces_id)',
  },
  {
    name: 'idx_embeddings_document',
    table: 'document_embeddings',
    columns: ['document_id'],
    sql: 'CREATE INDEX IF NOT EXISTS idx_embeddings_document ON document_embeddings(document_id)',
  },
]

for (const index of indexes) {
  try {
    await sql.unsafe(index.sql)
    console.log(`   ✅ ${index.name} created on ${index.table}`)
  } catch (error) {
    console.error(`   ❌ Failed to create ${index.name}:`, error)
  }
}

// 3. Verify all indexes were created
console.log('\n3. Verifying indexes...')

const embeddingIndexes = await sql`
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE tablename = 'document_embeddings'
  ORDER BY indexname
`

console.log('   Indexes on document_embeddings:')
embeddingIndexes.forEach((idx) => {
  const indexType = idx.indexdef.includes('hnsw')
    ? 'HNSW'
    : idx.indexdef.includes('ivfflat')
      ? 'IVFFlat'
      : 'Standard'
  console.log(`     - ${idx.indexname} (${indexType})`)
})

const districtIndexes = await sql`
  SELECT indexname
  FROM pg_indexes
  WHERE tablename = 'districts'
    AND indexname IN ('idx_districts_state', 'idx_districts_nces_id')
  ORDER BY indexname
`

console.log('   Indexes on districts:')
districtIndexes.forEach((idx) => {
  console.log(`     - ${idx.indexname}`)
})

// 4. Run performance test again
console.log('\n4. Testing performance after indexing...')
const testEmbedding = Array(1536).fill(0.1)
const embeddingString = JSON.stringify(testEmbedding)

const searchStart = Date.now()
const searchResults = await sql`
  SELECT
    e.id,
    e.chunk_text,
    e.embedding <=> ${embeddingString}::vector as distance
  FROM document_embeddings e
  WHERE e.embedding <=> ${embeddingString}::vector < 0.5
  ORDER BY distance
  LIMIT 20
`
const searchTime = Date.now() - searchStart

console.log(`   Query time: ${searchTime}ms`)
console.log(`   Results: ${searchResults.length}`)

if (searchTime < 500) {
  console.log('   ✅ Performance excellent (<500ms)')
} else if (searchTime < 2000) {
  console.log('   ✅ Performance good (<2s)')
} else {
  console.log('   ⚠️  Performance could be better')
}

// 5. Show query plan with index
console.log('\n5. Query plan after indexing:')
const explainResult = await sql`
  EXPLAIN ANALYZE
  SELECT
    e.id,
    e.chunk_text,
    e.embedding <=> ${embeddingString}::vector as distance
  FROM document_embeddings e
  WHERE e.embedding <=> ${embeddingString}::vector < 0.5
  ORDER BY distance
  LIMIT 20
`

explainResult.forEach((row) => {
  console.log(`   ${row['QUERY PLAN']}`)
})

console.log('\n=== Index Creation Complete ===\n')

await sql.end()
