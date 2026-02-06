/**
 * Phase 2A: Create Document Discovery Tables
 *
 * Creates the schema for document crawling, storage, keyword scoring,
 * and semantic search with pgvector.
 *
 * Tables created:
 *   - district_documents: Stores URLs + extracted text
 *   - document_crawl_log: Logs every crawl success/failure
 *   - district_keyword_scores: Taxonomy scores per district
 *   - document_embeddings: pgvector for semantic search
 *
 * Usage:
 *   node scripts/create-document-tables.js
 */

const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  console.log('=== Phase 2A: Create Document Discovery Schema ===\n');

  try {
    // Step 1: Enable pgvector extension
    console.log('1. Enabling pgvector extension...');
    await client.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    console.log('   pgvector extension enabled\n');

    // Step 2: Create district_documents table
    console.log('2. Creating district_documents table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS district_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nces_id VARCHAR(20) NOT NULL,

        -- Document info
        document_url TEXT NOT NULL,
        document_type VARCHAR(20) NOT NULL, -- 'pdf', 'html', 'embedded_pdf'
        document_title TEXT,
        document_category VARCHAR(50), -- 'portrait_of_graduate', 'strategic_plan', 'other'

        -- Extracted content
        extracted_text TEXT,
        text_length INTEGER,
        extraction_method VARCHAR(30), -- 'pdf_parse', 'html_scrape', 'ocr'

        -- Metadata
        page_depth INTEGER DEFAULT 0, -- 0=homepage, 1=linked page, 2=deep link
        discovered_at TIMESTAMP DEFAULT NOW(),
        last_crawled_at TIMESTAMP,

        -- Deduplication
        content_hash VARCHAR(64), -- SHA256 of extracted_text

        UNIQUE(nces_id, document_url)
      )
    `);
    console.log('   district_documents table created\n');

    // Step 3: Create document_crawl_log table
    console.log('3. Creating document_crawl_log table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_crawl_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nces_id VARCHAR(20) NOT NULL,
        crawl_batch_id UUID NOT NULL,

        -- Request info
        url TEXT NOT NULL,
        url_type VARCHAR(20), -- 'homepage', 'internal_link', 'pdf_link'

        -- Result
        status VARCHAR(20) NOT NULL, -- 'success', 'failure', 'skipped', 'timeout'
        http_status INTEGER,
        error_message TEXT,

        -- Success details
        content_type VARCHAR(100),
        document_id UUID REFERENCES district_documents(id),
        extraction_success BOOLEAN,
        keywords_found TEXT[], -- array of matched keywords

        -- Timing
        response_time_ms INTEGER,
        crawled_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   document_crawl_log table created\n');

    // Step 4: Create district_keyword_scores table
    console.log('4. Creating district_keyword_scores table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS district_keyword_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nces_id VARCHAR(20) UNIQUE NOT NULL,

        -- Category scores (0-10 scale)
        readiness_score NUMERIC(4,2),      -- Category A
        alignment_score NUMERIC(4,2),      -- Category B
        activation_score NUMERIC(4,2),     -- Category C
        branding_score NUMERIC(4,2),       -- Category D

        -- Composite
        total_score NUMERIC(4,2),          -- Average of 4 categories
        outreach_tier VARCHAR(10),         -- 'tier1', 'tier2', 'tier3'

        -- Evidence
        keyword_matches JSONB,             -- {category: [{keyword, weight, source_doc, context}]}
        documents_analyzed INTEGER,

        -- Timestamps
        scored_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   district_keyword_scores table created\n');

    // Step 5: Create document_embeddings table
    console.log('5. Creating document_embeddings table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_embeddings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES district_documents(id),

        -- Chunk info (for large documents)
        chunk_index INTEGER DEFAULT 0,
        chunk_text TEXT NOT NULL,

        -- Embedding (OpenAI ada-002 = 1536 dimensions)
        embedding vector(1536),

        -- Metadata
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('   document_embeddings table created\n');

    // Step 6: Create indexes
    console.log('6. Creating indexes...');

    await client.query(`CREATE INDEX IF NOT EXISTS idx_documents_nces ON district_documents(nces_id)`);
    console.log('   - idx_documents_nces');

    await client.query(`CREATE INDEX IF NOT EXISTS idx_documents_category ON district_documents(document_category)`);
    console.log('   - idx_documents_category');

    await client.query(`CREATE INDEX IF NOT EXISTS idx_crawl_log_batch ON document_crawl_log(crawl_batch_id)`);
    console.log('   - idx_crawl_log_batch');

    await client.query(`CREATE INDEX IF NOT EXISTS idx_crawl_log_status ON document_crawl_log(status)`);
    console.log('   - idx_crawl_log_status');

    await client.query(`CREATE INDEX IF NOT EXISTS idx_scores_tier ON district_keyword_scores(outreach_tier)`);
    console.log('   - idx_scores_tier');

    // Note: ivfflat index requires data to be populated first
    // We'll create this after embeddings are generated
    console.log('   - (vector index will be created after embeddings are populated)\n');

    // Step 7: Create semantic search function
    console.log('7. Creating semantic search function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION search_documents(
        query_embedding vector(1536),
        limit_n INTEGER DEFAULT 10
      )
      RETURNS TABLE (
        document_id UUID,
        nces_id VARCHAR(20),
        document_title TEXT,
        chunk_text TEXT,
        similarity FLOAT
      ) AS $$
        SELECT
          d.id as document_id,
          d.nces_id,
          d.document_title,
          e.chunk_text,
          1 - (e.embedding <=> query_embedding) as similarity
        FROM document_embeddings e
        JOIN district_documents d ON e.document_id = d.id
        ORDER BY e.embedding <=> query_embedding
        LIMIT limit_n;
      $$ LANGUAGE sql;
    `);
    console.log('   search_documents function created\n');

    // Verify tables
    console.log('=== VERIFICATION ===\n');

    const tables = ['district_documents', 'document_crawl_log', 'district_keyword_scores', 'document_embeddings'];
    for (const table of tables) {
      const result = await client.query(`
        SELECT COUNT(*) as count FROM information_schema.tables
        WHERE table_name = $1 AND table_schema = 'public'
      `, [table]);
      const exists = result.rows[0].count > 0;
      console.log(`${exists ? '✓' : '✗'} ${table}`);
    }

    // Check pgvector
    const vectorCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      ) as exists
    `);
    console.log(`${vectorCheck.rows[0].exists ? '✓' : '✗'} pgvector extension`);

    console.log('\n=== SCHEMA CREATION COMPLETE ===');

  } catch (error) {
    console.error('Error creating schema:', error);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(console.error);
