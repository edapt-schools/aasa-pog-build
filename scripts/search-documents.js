/**
 * Semantic Search for District Documents
 *
 * Searches the document_embeddings table using vector similarity
 * to find documents matching a natural language query.
 *
 * Prerequisites:
 *   - Document embeddings generated (run generate-embeddings.js first)
 *   - OPENAI_API_KEY for generating query embedding
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node scripts/search-documents.js "portrait of a graduate"
 *   OPENAI_API_KEY=sk-... node scripts/search-documents.js "strategic planning framework" --limit 20
 *
 * Options:
 *   --limit N     Number of results (default: 10)
 *   --state XX    Filter by state
 *   --verbose     Show full context snippets
 */

// Load .env file if present
require('dotenv').config();

const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';

// Parse command line args
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    query: '',
    limit: 10,
    state: null,
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      config.limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--state' && args[i + 1]) {
      config.state = args[i + 1].toUpperCase();
      i++;
    } else if (args[i] === '--verbose') {
      config.verbose = true;
    } else if (!args[i].startsWith('--')) {
      config.query = args[i];
    }
  }

  return config;
}

// Initialize OpenAI client
function initOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('ERROR: OPENAI_API_KEY environment variable not set');
    console.error('Usage: OPENAI_API_KEY=sk-... node scripts/search-documents.js "query"');
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

// Generate query embedding
async function generateQueryEmbedding(openai, query) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: query
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating query embedding:', error.message);
    process.exit(1);
  }
}

// Format embedding for PostgreSQL
function formatEmbeddingForPg(embedding) {
  return '[' + embedding.join(',') + ']';
}

async function main() {
  const config = parseArgs();

  if (!config.query) {
    console.log('Usage: OPENAI_API_KEY=sk-... node scripts/search-documents.js "query" [options]');
    console.log('\nOptions:');
    console.log('  --limit N     Number of results (default: 10)');
    console.log('  --state XX    Filter by state');
    console.log('  --verbose     Show full context snippets');
    console.log('\nExamples:');
    console.log('  node scripts/search-documents.js "portrait of a graduate"');
    console.log('  node scripts/search-documents.js "strategic planning" --state CA --limit 20');
    process.exit(0);
  }

  console.log('=== Semantic Document Search ===\n');
  console.log(`Query: "${config.query}"`);
  if (config.state) console.log(`State filter: ${config.state}`);
  console.log(`Results limit: ${config.limit}\n`);

  // Initialize OpenAI and generate query embedding
  const openai = initOpenAI();
  console.log('Generating query embedding...');
  const queryEmbedding = await generateQueryEmbedding(openai, config.query);
  console.log('Query embedded successfully\n');

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  // Check if we have embeddings
  const countResult = await client.query(`SELECT COUNT(*) as count FROM document_embeddings`);
  const embeddingCount = parseInt(countResult.rows[0].count, 10);

  if (embeddingCount === 0) {
    console.log('No document embeddings found.');
    console.log('Run: node scripts/generate-embeddings.js first');
    await client.end();
    return;
  }

  console.log(`Searching ${embeddingCount} document embeddings...\n`);

  // Build search query
  let searchQuery = `
    SELECT
      d.nces_id,
      s.district_name,
      s.state,
      d.document_title,
      d.document_url,
      d.document_category,
      e.chunk_text,
      1 - (e.embedding <=> $1::vector) as similarity
    FROM document_embeddings e
    JOIN district_documents d ON e.document_id = d.id
    JOIN superintendent_directory s ON d.nces_id = s.nces_id
  `;
  const params = [formatEmbeddingForPg(queryEmbedding)];

  if (config.state) {
    searchQuery += ` WHERE s.state = $2`;
    params.push(config.state);
  }

  searchQuery += `
    ORDER BY e.embedding <=> $1::vector
    LIMIT $${params.length + 1}
  `;
  params.push(config.limit);

  const results = await client.query(searchQuery, params);

  if (results.rows.length === 0) {
    console.log('No matching documents found.');
    await client.end();
    return;
  }

  // Display results
  console.log('=== SEARCH RESULTS ===\n');
  console.log('-'.repeat(80));

  for (let i = 0; i < results.rows.length; i++) {
    const row = results.rows[i];
    const similarity = (parseFloat(row.similarity) * 100).toFixed(1);

    console.log(`\n${i + 1}. ${row.district_name} (${row.state})`);
    console.log(`   Similarity: ${similarity}%`);
    console.log(`   Category: ${row.document_category}`);
    console.log(`   Title: ${row.document_title || 'N/A'}`);
    console.log(`   URL: ${row.document_url}`);

    if (config.verbose && row.chunk_text) {
      const snippet = row.chunk_text.substring(0, 500).replace(/\s+/g, ' ').trim();
      console.log(`   Snippet: ${snippet}...`);
    }
  }

  console.log('\n' + '-'.repeat(80));
  console.log(`\nFound ${results.rows.length} results`);

  // Group results by district for summary
  const districtCounts = {};
  for (const row of results.rows) {
    const key = `${row.district_name} (${row.state})`;
    districtCounts[key] = (districtCounts[key] || 0) + 1;
  }

  console.log('\nResults by district:');
  for (const [district, count] of Object.entries(districtCounts)) {
    console.log(`  ${district}: ${count} matches`);
  }

  await client.end();
}

main().catch(console.error);
