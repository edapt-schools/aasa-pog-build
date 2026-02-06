#!/usr/bin/env npx tsx
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
config({ path: resolve(__dirname, '../../../.env') })

import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!)

console.log('\n=== pgvector Extension & Index Verification ===\n')

// 1. Check pgvector extension
console.log('1. Checking pgvector extension...')
const extensions = await sql`
  SELECT extname, extversion
  FROM pg_extension
  WHERE extname = 'vector'
`

if (extensions.length > 0) {
  console.log(`   ✅ pgvector installed: v${extensions[0].extversion}`)
} else {
  console.log('   ❌ pgvector NOT installed')
  process.exit(1)
}

// 2. Check embedding count
console.log('\n2. Checking document embeddings...')
const embeddingCount = await sql`
  SELECT COUNT(*) as count FROM document_embeddings
`
console.log(`   ✅ ${embeddingCount[0].count} embeddings available`)

// 3. Check indexes on document_embeddings
console.log('\n3. Checking indexes on document_embeddings...')
const embeddingIndexes = await sql`
  SELECT
    indexname,
    indexdef
  FROM pg_indexes
  WHERE tablename = 'document_embeddings'
`

if (embeddingIndexes.length === 0) {
  console.log('   ⚠️  No indexes found on document_embeddings')
} else {
  embeddingIndexes.forEach(idx => {
    const indexType = idx.indexdef.includes('hnsw') ? 'HNSW' :
                     idx.indexdef.includes('ivfflat') ? 'IVFFlat' : 'Standard'
    console.log(`   ✅ ${idx.indexname} (${indexType})`)
  })
}

// 4. Check recommended indexes for common queries
console.log('\n4. Checking recommended composite indexes...')

const recommendedIndexes = [
  { table: 'districts', columns: ['state'], name: 'idx_districts_state' },
  { table: 'districts', columns: ['nces_id'], name: 'idx_districts_nces_id' },
  { table: 'district_documents', columns: ['nces_id'], name: 'idx_district_documents_nces' },
  { table: 'district_keyword_scores', columns: ['nces_id'], name: 'idx_keyword_scores_nces' },
  { table: 'document_embeddings', columns: ['document_id'], name: 'idx_embeddings_document' },
]

for (const rec of recommendedIndexes) {
  const exists = await sql`
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = ${rec.table}
      AND indexname = ${rec.name}
  `

  if (exists.length > 0) {
    console.log(`   ✅ ${rec.table}.${rec.name}`)
  } else {
    console.log(`   ⚠️  Missing: ${rec.table}.${rec.name} on (${rec.columns.join(', ')})`)
  }
}

// 5. Performance test: semantic search
console.log('\n5. Performance test: Semantic search...')
const testEmbedding = Array(1536).fill(0.1) // Dummy embedding
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

if (searchTime < 2000) {
  console.log('   ✅ Performance good (<2s)')
} else if (searchTime < 5000) {
  console.log('   ⚠️  Performance acceptable (2-5s)')
} else {
  console.log('   ❌ Performance poor (>5s) - consider adding vector index')
}

// 6. Performance test: district list with filters
console.log('\n6. Performance test: District list query...')

const listStart = Date.now()
const districtResults = await sql`
  SELECT *
  FROM districts
  WHERE state = 'CA'
  ORDER BY name
  LIMIT 50
`
const listTime = Date.now() - listStart

console.log(`   Query time: ${listTime}ms`)
console.log(`   Results: ${districtResults.length}`)

if (listTime < 500) {
  console.log('   ✅ Performance excellent (<500ms)')
} else if (listTime < 1000) {
  console.log('   ⚠️  Performance acceptable (500ms-1s)')
} else {
  console.log('   ❌ Performance poor (>1s)')
}

// 7. EXPLAIN ANALYZE for semantic search
console.log('\n7. Query plan for semantic search:')
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

explainResult.forEach(row => {
  console.log(`   ${row['QUERY PLAN']}`)
})

console.log('\n=== Verification Complete ===\n')

await sql.end()
