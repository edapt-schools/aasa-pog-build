/**
 * Phase 2D: Generate Document Embeddings
 *
 * Generates vector embeddings for document text using OpenAI's API.
 * Stores embeddings in document_embeddings table for semantic search.
 *
 * Features:
 *   - BATCH PROCESSING: Embeds up to 100 chunks per API call (vs 1 at a time)
 *   - Automatic text chunking for large documents
 *   - Progress tracking and error handling
 *
 * Prerequisites:
 *   npm install openai
 *   Set OPENAI_API_KEY environment variable (or use .env file)
 *
 * Usage:
 *   node scripts/generate-embeddings.js [options]
 *
 * Options:
 *   --limit N         Process only N documents (default: all)
 *   --category CAT    Only process documents of this category
 *   --batch-size N    Batch size for OpenAI API (default: 100)
 *
 * Example:
 *   node scripts/generate-embeddings.js --limit 100
 */

// Load .env file if present
require('dotenv').config();

const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';

// Configuration
const CONFIG = {
  EMBEDDING_MODEL: 'text-embedding-ada-002',
  EMBEDDING_DIMENSION: 1536,
  CHUNK_SIZE: 500, // Target tokens per chunk (roughly 4 chars per token)
  CHUNK_OVERLAP: 50, // Overlap tokens between chunks
  MAX_CHARS_PER_CHUNK: 1500, // Max characters per chunk (~375 tokens, well under 8192 limit)
  EMBED_BATCH_SIZE: 100, // Chunks per API call (OpenAI limit is 2048)
  RATE_LIMIT_MS: 200 // Delay between API batches
};

// Parse command line args
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    limit: null,
    category: null,
    batchSize: CONFIG.EMBED_BATCH_SIZE
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      config.limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--category' && args[i + 1]) {
      config.category = args[i + 1];
      i++;
    } else if (args[i] === '--batch-size' && args[i + 1]) {
      config.batchSize = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return config;
}

// Sleep utility
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Chunk text into smaller segments for embedding
// OpenAI ada-002 has 8192 token limit (~32K chars), but we use smaller chunks for better retrieval
function chunkText(text, maxChars = CONFIG.MAX_CHARS_PER_CHUNK) {
  if (!text) return [];

  // Clean the text first
  text = text.replace(/\s+/g, ' ').trim();

  if (text.length <= maxChars) {
    return [text];
  }

  const chunks = [];

  // First try splitting by sentences
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';

  for (const sentence of sentences) {
    // If a single sentence is too long, split it by words
    if (sentence.length > maxChars) {
      // Save current chunk first
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }

      // Split long sentence into word-based chunks
      const words = sentence.split(/\s+/);
      let wordChunk = '';
      for (const word of words) {
        if (wordChunk.length + word.length + 1 > maxChars) {
          if (wordChunk.length > 0) {
            chunks.push(wordChunk.trim());
          }
          wordChunk = word;
        } else {
          wordChunk += (wordChunk ? ' ' : '') + word;
        }
      }
      if (wordChunk.length > 0) {
        currentChunk = wordChunk;
      }
    } else if (currentChunk.length + sentence.length + 1 > maxChars) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }

  // Final safety check - ensure no chunk exceeds limit
  const safeChunks = [];
  for (const chunk of chunks) {
    if (chunk.length > maxChars) {
      // Force split by character position
      for (let i = 0; i < chunk.length; i += maxChars) {
        safeChunks.push(chunk.substring(i, i + maxChars).trim());
      }
    } else if (chunk.length >= 50) { // Skip tiny chunks
      safeChunks.push(chunk);
    }
  }

  return safeChunks;
}

// Initialize OpenAI client
function initOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('ERROR: OPENAI_API_KEY environment variable not set');
    console.error('Usage: OPENAI_API_KEY=sk-... node scripts/generate-embeddings.js');
    process.exit(1);
  }

  try {
    const { OpenAI } = require('openai');
    return new OpenAI({ apiKey });
  } catch (error) {
    console.error('ERROR: openai package not installed');
    console.error('Run: npm install openai');
    process.exit(1);
  }
}

// Generate embedding for a single text
async function generateEmbedding(openai, text) {
  try {
    const response = await openai.embeddings.create({
      model: CONFIG.EMBEDDING_MODEL,
      input: text
    });

    return {
      success: true,
      embedding: response.data[0].embedding
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Generate embeddings for multiple texts (batch)
async function generateEmbeddingsBatch(openai, texts) {
  try {
    const response = await openai.embeddings.create({
      model: CONFIG.EMBEDDING_MODEL,
      input: texts
    });

    return {
      success: true,
      embeddings: response.data.map(d => d.embedding)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Format embedding array for PostgreSQL pgvector
function formatEmbeddingForPg(embedding) {
  return '[' + embedding.join(',') + ']';
}

async function main() {
  const config = parseArgs();

  console.log('=== Phase 2D: Generate Document Embeddings ===\n');

  // Initialize OpenAI
  const openai = initOpenAI();
  console.log('OpenAI client initialized\n');

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  // Build query for documents to process
  let query = `
    SELECT d.id, d.nces_id, d.document_url, d.document_title,
           d.document_category, d.extracted_text, d.text_length
    FROM district_documents d
    LEFT JOIN document_embeddings e ON d.id = e.document_id
    WHERE d.extracted_text IS NOT NULL
      AND d.text_length > 100
      AND e.id IS NULL
  `;
  const params = [];

  if (config.category) {
    query += ` AND d.document_category = $1`;
    params.push(config.category);
  }

  query += ` ORDER BY d.text_length DESC`;

  if (config.limit) {
    query += ` LIMIT ${config.limit}`;
  }

  console.log('Fetching documents to embed...');
  const docsResult = await client.query(query, params);
  console.log(`Found ${docsResult.rows.length} documents without embeddings\n`);

  if (docsResult.rows.length === 0) {
    console.log('No documents to process.');
    await client.end();
    return;
  }

  // Stats
  const stats = {
    docsProcessed: 0,
    chunksEmbedded: 0,
    errors: 0,
    skipped: 0
  };

  // Collect all chunks first for batch processing
  console.log('Preparing chunks for batch embedding...');
  const allChunks = [];

  for (const doc of docsResult.rows) {
    const chunks = chunkText(doc.extracted_text);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk.length >= 50) {
        allChunks.push({
          docId: doc.id,
          chunkIndex: i,
          text: chunk
        });
      } else {
        stats.skipped++;
      }
    }
    stats.docsProcessed++;
  }

  console.log(`Prepared ${allChunks.length} chunks from ${stats.docsProcessed} documents`);
  console.log(`Batch size: ${config.batchSize} chunks per API call\n`);

  // Process chunks in batches
  const totalBatches = Math.ceil(allChunks.length / config.batchSize);

  for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
    const batchStart = batchNum * config.batchSize;
    const batchEnd = Math.min(batchStart + config.batchSize, allChunks.length);
    const batch = allChunks.slice(batchStart, batchEnd);
    const texts = batch.map(c => c.text);

    console.log(`Batch ${batchNum + 1}/${totalBatches}: embedding ${batch.length} chunks...`);

    // Generate embeddings for the batch
    const result = await generateEmbeddingsBatch(openai, texts);

    if (!result.success) {
      console.error(`  Batch error: ${result.error}`);
      stats.errors += batch.length;

      // Fallback to individual processing if batch fails
      console.log('  Falling back to individual embedding...');
      for (let i = 0; i < batch.length; i++) {
        const chunk = batch[i];
        const singleResult = await generateEmbedding(openai, chunk.text);

        if (singleResult.success) {
          try {
            await client.query(`
              INSERT INTO document_embeddings
              (document_id, chunk_index, chunk_text, embedding, created_at)
              VALUES ($1, $2, $3, $4, NOW())
            `, [
              chunk.docId,
              chunk.chunkIndex,
              chunk.text.substring(0, 5000),
              formatEmbeddingForPg(singleResult.embedding)
            ]);
            stats.chunksEmbedded++;
            stats.errors--; // Recovered one error
          } catch (err) {
            console.error(`    Error saving: ${err.message}`);
          }
        }
        await sleep(50); // Small delay for fallback
      }
      continue;
    }

    // Save all embeddings from the batch
    for (let i = 0; i < batch.length; i++) {
      const chunk = batch[i];
      const embedding = result.embeddings[i];

      try {
        await client.query(`
          INSERT INTO document_embeddings
          (document_id, chunk_index, chunk_text, embedding, created_at)
          VALUES ($1, $2, $3, $4, NOW())
        `, [
          chunk.docId,
          chunk.chunkIndex,
          chunk.text.substring(0, 5000),
          formatEmbeddingForPg(embedding)
        ]);
        stats.chunksEmbedded++;
      } catch (error) {
        console.error(`  Error saving embedding: ${error.message}`);
        stats.errors++;
      }
    }

    // Rate limiting between batches
    if (batchNum < totalBatches - 1) {
      await sleep(CONFIG.RATE_LIMIT_MS);
    }
  }

  // Create vector index if we have enough embeddings
  const countResult = await client.query(`SELECT COUNT(*) as count FROM document_embeddings`);
  const embeddingCount = parseInt(countResult.rows[0].count, 10);

  if (embeddingCount >= 100) {
    console.log('\nCreating vector index...');
    try {
      // Drop existing index if any
      await client.query(`DROP INDEX IF EXISTS idx_embeddings_vector`);

      // Create IVFFlat index (good for ~1K-1M vectors)
      await client.query(`
        CREATE INDEX idx_embeddings_vector
        ON document_embeddings
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
      `);
      console.log('Vector index created');
    } catch (error) {
      console.error(`Error creating index: ${error.message}`);
    }
  }

  // Summary
  console.log('\n=== EMBEDDING COMPLETE ===\n');
  console.log(`Documents processed: ${stats.docsProcessed}`);
  console.log(`Chunks embedded: ${stats.chunksEmbedded}`);
  console.log(`Errors: ${stats.errors}`);
  console.log(`Skipped (too short): ${stats.skipped}`);
  console.log(`Total embeddings in database: ${embeddingCount + stats.chunksEmbedded}`);

  await client.end();
}

main().catch(console.error);
