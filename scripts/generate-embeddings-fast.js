/**
 * Fast Embeddings Generator v2
 *
 * Generates high-quality embeddings for the full document corpus (~175K docs).
 * Key improvements over v1:
 *   - Model: text-embedding-3-small (better quality, 5x cheaper than ada-002)
 *   - Recursive paragraph-aware chunking (6000 char target, 800 char overlap)
 *   - Metadata prepending (district name + state + document category per chunk)
 *   - Content-hash deduplication (~45K redundant docs skipped)
 *   - Priority ordering (strategic_plan > portrait_of_graduate > other)
 *   - Concurrent API calls (3 in parallel)
 *   - Cursor-based DB streaming (never loads all docs into memory)
 *   - Multi-row INSERT for DB writes
 *   - Automatic retry with exponential backoff on rate limits
 *   - Progress tracking with ETA and cost
 *   - Graceful shutdown on Ctrl+C
 *
 * Prerequisites:
 *   npm install openai dotenv pg
 *   .env file with OPENAI_API_KEY
 *
 * Usage:
 *   node --max-old-space-size=4096 scripts/generate-embeddings-fast.js [options]
 *
 * Options:
 *   --limit N           Max documents to process (default: all)
 *   --batch-size N      Chunks per OpenAI API call (default: 2000, max 2048)
 *   --page-size N       Documents to fetch from DB at a time (default: 500)
 *   --category CAT      Only process specific category (strategic_plan, portrait_of_graduate, other)
 *   --rate-limit-ms N   Delay between API calls (default: 50)
 *   --dry-run           Count chunks without embedding (prints sample chunks)
 *   --no-dedup          Disable content_hash deduplication
 *
 * Cost estimate (text-embedding-3-small at $0.02/1M tokens):
 *   ~250K chunks × ~1080 tokens/chunk = ~270M tokens ≈ $5.40
 */

require('dotenv').config();

const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';

const CONFIG = {
  EMBEDDING_MODEL: 'text-embedding-3-small',
  EMBEDDING_DIMENSION: 1536,
  MAX_CHARS_PER_CHUNK: 6000,        // ~1500 tokens per chunk
  MIN_CHUNK_CHARS: 100,             // Skip tiny fragments
  CHUNK_OVERLAP_CHARS: 800,         // ~200 tokens overlap between chunks
  MAX_DOC_CHARS: 50000,             // Cap very long documents
  EMBED_BATCH_SIZE: 150,            // Chunks per API call (~225K tokens, under 300K limit)
  PAGE_SIZE: 500,                   // Documents per DB page
  RATE_LIMIT_MS: 50,                // Delay between API calls
  CONCURRENT_API_CALLS: 3,          // Parallel API requests
  MAX_RETRIES: 5,
  RETRY_BASE_MS: 1000,              // Exponential backoff base
  DB_WRITE_BATCH_SIZE: 50,          // Rows per multi-row INSERT
  POOL_SIZE: 5,
  COST_PER_MILLION_TOKENS: 0.02     // text-embedding-3-small pricing
};

// ============ ARGUMENT PARSING ============

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    limit: null,
    batchSize: CONFIG.EMBED_BATCH_SIZE,
    pageSize: CONFIG.PAGE_SIZE,
    category: null,
    rateLimitMs: CONFIG.RATE_LIMIT_MS,
    dryRun: false,
    dedup: true
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--limit': config.limit = parseInt(args[++i], 10); break;
      case '--batch-size': config.batchSize = Math.min(parseInt(args[++i], 10), 500); break;
      case '--page-size': config.pageSize = parseInt(args[++i], 10); break;
      case '--category': config.category = args[++i]; break;
      case '--rate-limit-ms': config.rateLimitMs = parseInt(args[++i], 10); break;
      case '--dry-run': config.dryRun = true; break;
      case '--no-dedup': config.dedup = false; break;
    }
  }

  return config;
}

// ============ UTILITIES ============

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

let shuttingDown = false;
process.on('SIGINT', () => {
  console.log('\n\nGraceful shutdown requested... finishing current batch.');
  shuttingDown = true;
});

// ============ RECURSIVE TEXT CHUNKING ============

/**
 * Split text into chunks using a recursive paragraph-aware strategy.
 *
 * Split hierarchy (tries largest boundaries first):
 *   1. Double newline (\n\n) - paragraph boundaries
 *   2. Single newline (\n) - line breaks
 *   3. Sentence endings ([.!?]\s) - sentence boundaries
 *   4. Word boundaries (\s+) - last resort
 *
 * For documents under MAX_CHARS_PER_CHUNK, returns a single chunk (63% of corpus).
 * For longer documents, produces overlapping chunks with CHUNK_OVERLAP_CHARS overlap.
 */
function chunkText(text, maxChars = CONFIG.MAX_CHARS_PER_CHUNK) {
  if (!text) return [];

  // Cap extremely long documents
  if (text.length > CONFIG.MAX_DOC_CHARS) {
    text = text.substring(0, CONFIG.MAX_DOC_CHARS);
  }

  // Normalize excessive whitespace but preserve paragraph structure
  text = text.replace(/[ \t]+/g, ' ')          // collapse horizontal space
             .replace(/\n{3,}/g, '\n\n')        // collapse 3+ newlines to 2
             .trim();

  // Single-chunk shortcut (63% of docs)
  if (text.length <= maxChars) {
    return text.length >= CONFIG.MIN_CHUNK_CHARS ? [text] : [];
  }

  // Recursive splitting
  const segments = recursiveSplit(text, maxChars);

  // Apply overlap: carry the last CHUNK_OVERLAP_CHARS of previous chunk into next
  const overlap = CONFIG.CHUNK_OVERLAP_CHARS;
  const chunks = [];

  for (let i = 0; i < segments.length; i++) {
    if (i === 0) {
      chunks.push(segments[i]);
    } else {
      // Get overlap from end of previous segment
      const prevText = segments[i - 1];
      const overlapText = prevText.length > overlap
        ? prevText.substring(prevText.length - overlap)
        : prevText;
      chunks.push(overlapText + ' ' + segments[i]);
    }
  }

  return chunks.filter(c => c.length >= CONFIG.MIN_CHUNK_CHARS);
}

/**
 * Recursively split text into segments that fit within maxChars.
 * Tries the largest natural boundary first, falling back to smaller ones.
 */
function recursiveSplit(text, maxChars) {
  if (text.length <= maxChars) {
    return [text.trim()].filter(t => t.length > 0);
  }

  // Try split boundaries in order of preference
  const separators = [
    '\n\n',                    // paragraph breaks
    '\n',                      // line breaks
    /(?<=[.!?])\s+/,          // sentence endings
    /\s+/                      // word boundaries
  ];

  for (const sep of separators) {
    const parts = typeof sep === 'string'
      ? text.split(sep)
      : text.split(sep);

    if (parts.length <= 1) continue; // separator not found, try next

    // Merge parts into segments that fit within maxChars
    const segments = [];
    let current = '';

    for (const part of parts) {
      const joiner = typeof sep === 'string' ? sep : ' ';

      if (current.length === 0) {
        current = part;
      } else if (current.length + joiner.length + part.length <= maxChars) {
        current += joiner + part;
      } else {
        if (current.trim().length > 0) segments.push(current.trim());
        current = part;
      }
    }
    if (current.trim().length > 0) segments.push(current.trim());

    // If we got multiple segments, recursively split any that are still too long
    if (segments.length > 1) {
      const result = [];
      for (const seg of segments) {
        if (seg.length <= maxChars) {
          result.push(seg);
        } else {
          result.push(...recursiveSplit(seg, maxChars));
        }
      }
      return result;
    }
  }

  // Ultimate fallback: hard split by character count (should be very rare)
  const result = [];
  for (let i = 0; i < text.length; i += maxChars) {
    const segment = text.substring(i, i + maxChars).trim();
    if (segment.length > 0) result.push(segment);
  }
  return result;
}

/**
 * Prepend metadata header to document text for richer embeddings.
 * The metadata gets embedded alongside the content, improving retrieval
 * for location-specific and category-specific queries.
 */
function prependMetadata(text, districtName, state, category) {
  const categoryLabel = category === 'strategic_plan' ? 'Strategic Plan'
    : category === 'portrait_of_graduate' ? 'Portrait of a Graduate'
    : 'General';
  return `District: ${districtName || 'Unknown'} | State: ${state || 'Unknown'} | Type: ${categoryLabel}\n\n${text}`;
}

// ============ OPENAI ============

function initOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('ERROR: OPENAI_API_KEY not set in environment or .env file');
    process.exit(1);
  }
  try {
    const { OpenAI } = require('openai');
    return new OpenAI({ apiKey });
  } catch (error) {
    console.error('ERROR: openai package not installed. Run: npm install openai');
    process.exit(1);
  }
}

async function embedBatchWithRetry(openai, texts, retryCount = 0) {
  try {
    const response = await openai.embeddings.create({
      model: CONFIG.EMBEDDING_MODEL,
      input: texts
    });
    return { success: true, embeddings: response.data.map(d => d.embedding), tokens: response.usage?.total_tokens || 0 };
  } catch (error) {
    // Rate limit - exponential backoff
    if ((error.status === 429 || error.code === 'rate_limit_exceeded') && retryCount < CONFIG.MAX_RETRIES) {
      const waitMs = CONFIG.RETRY_BASE_MS * Math.pow(2, retryCount);
      console.log(`  Rate limited. Waiting ${(waitMs / 1000).toFixed(1)}s before retry ${retryCount + 1}/${CONFIG.MAX_RETRIES}...`);
      await sleep(waitMs);
      return embedBatchWithRetry(openai, texts, retryCount + 1);
    }

    // Server error - retry
    if (error.status >= 500 && retryCount < CONFIG.MAX_RETRIES) {
      const waitMs = CONFIG.RETRY_BASE_MS * Math.pow(2, retryCount);
      console.log(`  Server error ${error.status}. Retrying in ${(waitMs / 1000).toFixed(1)}s...`);
      await sleep(waitMs);
      return embedBatchWithRetry(openai, texts, retryCount + 1);
    }

    // Token limit / context length error - split batch in half and try again
    if ((error.message?.includes('maximum context length') || error.message?.includes('max') && error.message?.includes('tokens per request')) && texts.length > 1) {
      console.log(`  Context length exceeded with ${texts.length} texts. Splitting batch...`);
      const mid = Math.floor(texts.length / 2);
      const left = await embedBatchWithRetry(openai, texts.slice(0, mid), 0);
      const right = await embedBatchWithRetry(openai, texts.slice(mid), 0);
      if (left.success && right.success) {
        return {
          success: true,
          embeddings: [...left.embeddings, ...right.embeddings],
          tokens: (left.tokens || 0) + (right.tokens || 0)
        };
      }
      return { success: false, error: 'Split batch failed' };
    }

    return { success: false, error: error.message || String(error) };
  }
}

// ============ DATABASE ============

function formatEmbeddingForPg(embedding) {
  return '[' + embedding.join(',') + ']';
}

/**
 * Write embeddings to DB in batches using multi-row INSERT.
 */
async function writeEmbeddingsBatch(pool, rows) {
  if (rows.length === 0) return 0;

  const batchSize = CONFIG.DB_WRITE_BATCH_SIZE;
  let written = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values = [];
    const params = [];

    for (let j = 0; j < batch.length; j++) {
      const r = batch[j];
      const offset = j * 4;
      values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, NOW())`);
      params.push(r.documentId, r.chunkIndex, r.chunkText.substring(0, 5000), formatEmbeddingForPg(r.embedding));
    }

    try {
      await pool.query(`
        INSERT INTO document_embeddings (document_id, chunk_index, chunk_text, embedding, created_at)
        VALUES ${values.join(', ')}
      `, params);
      written += batch.length;
    } catch (error) {
      // If multi-row fails, fall back to one-by-one
      for (const r of batch) {
        try {
          await pool.query(`
            INSERT INTO document_embeddings (document_id, chunk_index, chunk_text, embedding, created_at)
            VALUES ($1, $2, $3, $4, NOW())
          `, [r.documentId, r.chunkIndex, r.chunkText.substring(0, 5000), formatEmbeddingForPg(r.embedding)]);
          written++;
        } catch (e) {
          // Skip individual failures silently
        }
      }
    }
  }

  return written;
}

// ============ CONCURRENT API DISPATCHER ============

/**
 * Process multiple API batches concurrently (up to CONCURRENT_API_CALLS).
 * Returns combined results with stats.
 */
async function processConcurrentBatches(openai, allChunks, batchSize, rateLimitMs) {
  const maxConcurrent = CONFIG.CONCURRENT_API_CALLS;
  let totalTokens = 0;
  let totalEmbedded = 0;
  let apiCalls = 0;
  let apiErrors = 0;
  const results = []; // { chunks, embeddings } pairs

  // Split allChunks into batches
  const batches = [];
  for (let i = 0; i < allChunks.length; i += batchSize) {
    batches.push(allChunks.slice(i, i + batchSize));
  }

  // Process batches with concurrency limit
  for (let i = 0; i < batches.length; i += maxConcurrent) {
    if (shuttingDown) break;

    const concurrentBatches = batches.slice(i, i + maxConcurrent);
    const promises = concurrentBatches.map(async (batch) => {
      const texts = batch.map(c => c.chunkText);
      const result = await embedBatchWithRetry(openai, texts);
      return { batch, result };
    });

    const settled = await Promise.allSettled(promises);

    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        const { batch, result } = outcome.value;
        apiCalls++;
        if (result.success) {
          results.push({
            chunks: batch,
            embeddings: result.embeddings
          });
          totalTokens += result.tokens || 0;
          totalEmbedded += batch.length;
        } else {
          console.error(`  API batch failed: ${result.error}`);
          apiErrors++;
        }
      } else {
        console.error(`  API call rejected: ${outcome.reason}`);
        apiErrors++;
      }
    }

    // Rate limit delay between concurrent groups
    if (i + maxConcurrent < batches.length && !shuttingDown) {
      await sleep(rateLimitMs);
    }
  }

  return { results, totalTokens, totalEmbedded, apiCalls, apiErrors };
}

// ============ MAIN PROCESSING LOOP ============

async function main() {
  const config = parseArgs();

  console.log('=== Fast Embeddings Generator v2 ===\n');
  console.log('Configuration:');
  console.log(`  Model: ${CONFIG.EMBEDDING_MODEL}`);
  console.log(`  Chunk size: ${CONFIG.MAX_CHARS_PER_CHUNK} chars (~${Math.round(CONFIG.MAX_CHARS_PER_CHUNK / 4)} tokens)`);
  console.log(`  Chunk overlap: ${CONFIG.CHUNK_OVERLAP_CHARS} chars (~${Math.round(CONFIG.CHUNK_OVERLAP_CHARS / 4)} tokens)`);
  console.log(`  Max doc length: ${CONFIG.MAX_DOC_CHARS} chars`);
  console.log(`  API batch size: ${config.batchSize} chunks/call`);
  console.log(`  Concurrent API calls: ${CONFIG.CONCURRENT_API_CALLS}`);
  console.log(`  DB page size: ${config.pageSize} docs/page`);
  console.log(`  Rate limit: ${config.rateLimitMs}ms between API call groups`);
  console.log(`  Deduplication: ${config.dedup ? 'ON' : 'OFF'}`);
  console.log(`  Limit: ${config.limit || 'All'}`);
  console.log(`  Category: ${config.category || 'All (priority ordered)'}`);
  console.log(`  Dry run: ${config.dryRun}`);
  console.log(`  Cost rate: $${CONFIG.COST_PER_MILLION_TOKENS}/1M tokens`);

  const openai = config.dryRun ? null : initOpenAI();
  const pool = new Pool({ connectionString: DATABASE_URL, max: CONFIG.POOL_SIZE });

  // Count total work
  let countQuery = `
    SELECT COUNT(*) as cnt FROM district_documents d
    LEFT JOIN document_embeddings e ON d.id = e.document_id
    JOIN districts dist ON dist.nces_id = d.nces_id
    WHERE d.extracted_text IS NOT NULL AND d.text_length > 100 AND e.id IS NULL
  `;
  const countParams = [];
  if (config.category) {
    countParams.push(config.category);
    countQuery += ` AND d.document_category = $${countParams.length}`;
  }

  const countResult = await pool.query(countQuery, countParams);
  let totalDocs = parseInt(countResult.rows[0].cnt, 10);
  if (config.limit) totalDocs = Math.min(totalDocs, config.limit);

  console.log(`\nDocuments to process: ${totalDocs}`);

  const existingCount = await pool.query('SELECT COUNT(*) as cnt FROM document_embeddings');
  console.log(`Existing embeddings: ${existingCount.rows[0].cnt}`);

  const stats = {
    docsProcessed: 0,
    docsDeduped: 0,
    chunksEmbedded: 0,
    chunksSkipped: 0,
    totalChunks: 0,
    apiCalls: 0,
    apiErrors: 0,
    totalTokens: 0,
    startTime: Date.now()
  };

  // Dedup tracking
  const seenHashes = new Set();

  if (config.dryRun) {
    console.log('\n[DRY RUN] Counting chunks and printing samples...\n');
  }

  // Process documents in pages.
  // IMPORTANT: We use OFFSET 0 on every query. As docs get embedded, they
  // disappear from the result set (e.id IS NULL filter). Deduped docs that
  // we skip (not embedded) stay in the result set, so we track their IDs
  // and exclude them with NOT IN to avoid re-fetching them.
  let pendingChunks = []; // Buffer for chunks waiting to be embedded
  const skippedDocIds = []; // Doc IDs that were deduped (still in result set)
  let pagesProcessed = 0;

  while (stats.docsProcessed < totalDocs && !shuttingDown) {
    // Fetch next page of unembedded documents
    let pageQuery = `
      SELECT d.id, d.nces_id, d.document_url, d.document_title,
             d.document_category, d.extracted_text, d.text_length,
             d.content_hash,
             dist.name AS district_name, dist.state
      FROM district_documents d
      LEFT JOIN document_embeddings e ON d.id = e.document_id
      JOIN districts dist ON dist.nces_id = d.nces_id
      WHERE d.extracted_text IS NOT NULL
        AND d.text_length > 100
        AND e.id IS NULL
    `;
    const pageParams = [];
    if (config.category) {
      pageParams.push(config.category);
      pageQuery += ` AND d.document_category = $${pageParams.length}`;
    }
    // Exclude docs we've already seen and decided to skip (deduped).
    // Cap at 5000 IDs to keep query performant; beyond that, rely on
    // in-memory seenHashes to filter re-fetched dedup docs.
    const excludeIds = skippedDocIds.slice(-5000);
    if (excludeIds.length > 0) {
      pageQuery += ` AND d.id NOT IN (${excludeIds.map((_, i) => `$${pageParams.length + i + 1}`).join(',')})`;
      pageParams.push(...excludeIds);
    }
    pageQuery += `
      ORDER BY
        CASE d.document_category
          WHEN 'strategic_plan' THEN 1
          WHEN 'portrait_of_graduate' THEN 2
          ELSE 3
        END,
        d.text_length ASC
      LIMIT ${config.pageSize}
    `;

    const pageResult = await pool.query(pageQuery, pageParams);
    if (pageResult.rows.length === 0) break;
    pagesProcessed++;

    // Chunk all documents in this page
    for (const doc of pageResult.rows) {
      // Deduplication: skip if we've already embedded identical content
      if (config.dedup && doc.content_hash && seenHashes.has(doc.content_hash)) {
        stats.docsDeduped++;
        stats.docsProcessed++;
        skippedDocIds.push(doc.id);
        continue;
      }
      if (config.dedup && doc.content_hash) {
        seenHashes.add(doc.content_hash);
      }

      // Prepend metadata to the document text
      const enrichedText = prependMetadata(
        doc.extracted_text,
        doc.district_name,
        doc.state,
        doc.document_category
      );

      const chunks = chunkText(enrichedText);
      stats.totalChunks += chunks.length;

      // Print sample in dry run mode
      if (config.dryRun && stats.docsProcessed < 5) {
        console.log(`--- Doc ${stats.docsProcessed + 1}: ${doc.district_name} (${doc.state}) | ${doc.document_category} | ${doc.text_length} chars ---`);
        console.log(`  Chunks: ${chunks.length}`);
        if (chunks.length > 0) {
          console.log(`  First chunk (${chunks[0].length} chars):`);
          console.log(`    "${chunks[0].substring(0, 200)}..."`);
        }
        console.log('');
      }

      for (let i = 0; i < chunks.length; i++) {
        pendingChunks.push({
          documentId: doc.id,
          chunkIndex: i,
          chunkText: chunks[i]
        });
      }
      stats.docsProcessed++;
    }

    // Process pendingChunks via concurrent API batches
    if (!config.dryRun) {
      while (pendingChunks.length >= config.batchSize * CONFIG.CONCURRENT_API_CALLS && !shuttingDown) {
        const toProcess = pendingChunks.splice(0, config.batchSize * CONFIG.CONCURRENT_API_CALLS);

        const { results, totalTokens, totalEmbedded, apiCalls, apiErrors } =
          await processConcurrentBatches(openai, toProcess, config.batchSize, config.rateLimitMs);

        stats.totalTokens += totalTokens;
        stats.apiCalls += apiCalls;
        stats.apiErrors += apiErrors;

        // Write all successful results to DB
        for (const { chunks, embeddings } of results) {
          const rows = chunks.map((c, i) => ({
            ...c,
            embedding: embeddings[i]
          }));
          const written = await writeEmbeddingsBatch(pool, rows);
          stats.chunksEmbedded += written;
        }

        // If there were errors, count skipped chunks
        const failedCount = toProcess.length - totalEmbedded;
        if (failedCount > 0) {
          stats.chunksSkipped += failedCount;
        }

        // Progress report
        printProgress(stats, totalDocs);
      }
    }

  }

  // Process remaining chunks
  if (pendingChunks.length > 0 && !shuttingDown) {
    if (config.dryRun) {
      stats.chunksEmbedded += pendingChunks.length;
    } else {
      const { results, totalTokens, totalEmbedded, apiCalls, apiErrors } =
        await processConcurrentBatches(openai, pendingChunks, config.batchSize, config.rateLimitMs);

      stats.totalTokens += totalTokens;
      stats.apiCalls += apiCalls;
      stats.apiErrors += apiErrors;

      for (const { chunks, embeddings } of results) {
        const rows = chunks.map((c, i) => ({
          ...c,
          embedding: embeddings[i]
        }));
        const written = await writeEmbeddingsBatch(pool, rows);
        stats.chunksEmbedded += written;
      }

      const failedCount = pendingChunks.length - totalEmbedded;
      if (failedCount > 0) stats.chunksSkipped += failedCount;
    }
  }

  // Create or update vector index if we have enough embeddings
  if (!config.dryRun && stats.chunksEmbedded > 0) {
    const finalCount = await pool.query('SELECT COUNT(*) as cnt FROM document_embeddings');
    const totalEmbeddings = parseInt(finalCount.rows[0].cnt, 10);

    if (totalEmbeddings >= 1000) {
      console.log('\nUpdating vector index...');
      try {
        await pool.query('DROP INDEX IF EXISTS idx_embeddings_vector');
        const lists = Math.min(Math.max(Math.floor(Math.sqrt(totalEmbeddings)), 100), 1000);
        await pool.query(`
          CREATE INDEX idx_embeddings_vector
          ON document_embeddings
          USING ivfflat (embedding vector_cosine_ops)
          WITH (lists = ${lists})
        `);
        console.log(`Vector index created with ${lists} lists for ${totalEmbeddings} embeddings`);
      } catch (error) {
        console.error(`Error creating index: ${error.message}`);
      }
    }
  }

  // Final summary
  const elapsed = (Date.now() - stats.startTime) / 1000;
  const costTotal = (stats.totalTokens / 1000000 * CONFIG.COST_PER_MILLION_TOKENS).toFixed(2);

  console.log(`\n${'='.repeat(60)}`);
  console.log('EMBEDDING GENERATION COMPLETE');
  console.log(`${'='.repeat(60)}`);
  console.log(`  Documents processed: ${stats.docsProcessed}`);
  console.log(`  Documents deduped:   ${stats.docsDeduped}`);
  console.log(`  Total chunks:        ${stats.totalChunks || stats.chunksEmbedded}`);
  console.log(`  Chunks embedded:     ${stats.chunksEmbedded}`);
  console.log(`  Chunks skipped:      ${stats.chunksSkipped}`);
  console.log(`  API calls:           ${stats.apiCalls}`);
  console.log(`  API errors:          ${stats.apiErrors}`);
  console.log(`  Total tokens:        ${stats.totalTokens.toLocaleString()}`);
  console.log(`  Estimated cost:      $${costTotal}`);
  console.log(`  Total time:          ${formatTime(elapsed)}`);
  console.log(`  Throughput:          ${elapsed > 0 ? (stats.chunksEmbedded / elapsed).toFixed(0) : 0} chunks/sec`);

  if (shuttingDown) {
    console.log('\n  Note: Shutdown requested. Run again to continue from where it left off.');
  }

  await pool.end();
}

function printProgress(stats, totalDocs) {
  const elapsed = (Date.now() - stats.startTime) / 1000;
  if (elapsed < 5) return; // Don't print for the first 5 seconds

  const chunksPerSec = stats.chunksEmbedded / elapsed;
  const docsPerSec = stats.docsProcessed / elapsed;
  const estRemainingDocs = totalDocs - stats.docsProcessed;
  const estRemainingSec = estRemainingDocs / Math.max(0.1, docsPerSec);
  const costSoFar = (stats.totalTokens / 1000000 * CONFIG.COST_PER_MILLION_TOKENS).toFixed(2);

  console.log(
    `  Progress: ${stats.docsProcessed}/${totalDocs} docs (${stats.docsDeduped} deduped) | ` +
    `${stats.chunksEmbedded} chunks | ` +
    `${stats.apiCalls} API calls | ` +
    `${chunksPerSec.toFixed(0)} chunks/s | ` +
    `~$${costSoFar} cost | ` +
    `ETA: ${formatTime(estRemainingSec)}`
  );
}

function formatTime(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

main().catch(console.error);
