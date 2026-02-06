/**
 * Analyze Crawl Results
 *
 * Summarizes the results of a document crawl batch, showing:
 *   - Success/failure rates
 *   - Common errors
 *   - Keyword detection statistics
 *   - Document category distribution
 *
 * Usage:
 *   node scripts/analyze-crawl-results.js [--batch-id UUID]
 *
 * If no batch ID specified, analyzes all crawl data.
 */

const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';

async function main() {
  // Parse args
  const args = process.argv.slice(2);
  let batchId = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--batch-id' && args[i + 1]) {
      batchId = args[i + 1];
      i++;
    }
  }

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  console.log('=== Document Crawl Analysis ===\n');

  if (batchId) {
    console.log(`Analyzing batch: ${batchId}\n`);
  } else {
    console.log('Analyzing all crawl data\n');
  }

  // Build WHERE clause
  const whereClause = batchId ? 'WHERE crawl_batch_id = $1' : '';
  const params = batchId ? [batchId] : [];

  // 1. Overall crawl stats
  console.log('=== CRAWL STATISTICS ===\n');

  const totalResult = await client.query(`
    SELECT
      COUNT(*) as total_requests,
      COUNT(DISTINCT nces_id) as districts_crawled,
      COUNT(CASE WHEN status = 'success' THEN 1 END) as successful,
      COUNT(CASE WHEN status = 'failure' THEN 1 END) as failed,
      COUNT(CASE WHEN status = 'timeout' THEN 1 END) as timeout,
      COUNT(CASE WHEN extraction_success = true THEN 1 END) as extracted,
      AVG(response_time_ms) as avg_response_time
    FROM document_crawl_log
    ${whereClause}
  `, params);

  const stats = totalResult.rows[0];
  console.log(`Total requests: ${stats.total_requests}`);
  console.log(`Districts crawled: ${stats.districts_crawled}`);
  console.log(`Successful requests: ${stats.successful} (${(stats.successful/stats.total_requests*100).toFixed(1)}%)`);
  console.log(`Failed requests: ${stats.failed} (${(stats.failed/stats.total_requests*100).toFixed(1)}%)`);
  console.log(`Timeouts: ${stats.timeout}`);
  console.log(`Successful extractions: ${stats.extracted}`);
  console.log(`Avg response time: ${Math.round(stats.avg_response_time)}ms\n`);

  // 2. By URL type
  console.log('=== BY URL TYPE ===\n');

  const typeResult = await client.query(`
    SELECT
      url_type,
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'success' THEN 1 END) as successful,
      ROUND(COUNT(CASE WHEN status = 'success' THEN 1 END)::numeric / COUNT(*)::numeric * 100, 1) as success_rate
    FROM document_crawl_log
    ${whereClause}
    GROUP BY url_type
    ORDER BY total DESC
  `, params);

  for (const row of typeResult.rows) {
    console.log(`${row.url_type}: ${row.total} total, ${row.successful} success (${row.success_rate}%)`);
  }

  // 3. Error analysis
  console.log('\n=== TOP ERRORS ===\n');

  const errorResult = await client.query(`
    SELECT
      error_message,
      COUNT(*) as count
    FROM document_crawl_log
    ${whereClause ? whereClause + ' AND' : 'WHERE'} status = 'failure'
    GROUP BY error_message
    ORDER BY count DESC
    LIMIT 10
  `, params);

  if (errorResult.rows.length === 0) {
    console.log('No errors recorded');
  } else {
    for (const row of errorResult.rows) {
      console.log(`${row.count}x: ${row.error_message || 'Unknown error'}`);
    }
  }

  // 4. HTTP status codes
  console.log('\n=== HTTP STATUS CODES ===\n');

  const httpResult = await client.query(`
    SELECT
      http_status,
      COUNT(*) as count
    FROM document_crawl_log
    ${whereClause ? whereClause + ' AND' : 'WHERE'} http_status IS NOT NULL
    GROUP BY http_status
    ORDER BY count DESC
    LIMIT 10
  `, params);

  for (const row of httpResult.rows) {
    console.log(`HTTP ${row.http_status}: ${row.count}`);
  }

  // 5. Keyword detection
  console.log('\n=== KEYWORD DETECTION ===\n');

  const keywordResult = await client.query(`
    SELECT
      unnest(keywords_found) as keyword,
      COUNT(*) as count
    FROM document_crawl_log
    ${whereClause ? whereClause + ' AND' : 'WHERE'} array_length(keywords_found, 1) > 0
    GROUP BY keyword
    ORDER BY count DESC
  `, params);

  if (keywordResult.rows.length === 0) {
    console.log('No keywords detected');
  } else {
    for (const row of keywordResult.rows) {
      console.log(`"${row.keyword}": ${row.count} occurrences`);
    }
  }

  // 6. Document storage stats
  console.log('\n=== DOCUMENT STORAGE ===\n');

  const docsWhereClause = batchId
    ? `WHERE nces_id IN (SELECT DISTINCT nces_id FROM document_crawl_log WHERE crawl_batch_id = $1)`
    : '';

  const docsResult = await client.query(`
    SELECT
      COUNT(*) as total_documents,
      COUNT(CASE WHEN document_type = 'html' THEN 1 END) as html_docs,
      COUNT(CASE WHEN document_type = 'pdf' THEN 1 END) as pdf_docs,
      COUNT(CASE WHEN document_category = 'portrait_of_graduate' THEN 1 END) as pog_docs,
      COUNT(CASE WHEN document_category = 'strategic_plan' THEN 1 END) as strategic_docs,
      SUM(text_length) as total_text_chars,
      AVG(text_length) as avg_text_length
    FROM district_documents
    ${docsWhereClause}
  `, params);

  const docs = docsResult.rows[0];
  console.log(`Total documents stored: ${docs.total_documents}`);
  console.log(`HTML pages: ${docs.html_docs}`);
  console.log(`PDF documents: ${docs.pdf_docs}`);
  console.log(`Portrait of Graduate docs: ${docs.pog_docs}`);
  console.log(`Strategic Plan docs: ${docs.strategic_docs}`);
  console.log(`Total text extracted: ${Math.round(docs.total_text_chars / 1000)}K characters`);
  console.log(`Avg document length: ${Math.round(docs.avg_text_length)} characters`);

  // 7. Document category distribution
  console.log('\n=== DOCUMENT CATEGORIES ===\n');

  const catResult = await client.query(`
    SELECT
      document_category,
      COUNT(*) as count,
      ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM district_documents ${docsWhereClause})::numeric * 100, 1) as pct
    FROM district_documents
    ${docsWhereClause}
    GROUP BY document_category
    ORDER BY count DESC
  `, params);

  for (const row of catResult.rows) {
    console.log(`${row.document_category}: ${row.count} (${row.pct}%)`);
  }

  // 8. Districts with PoG content
  console.log('\n=== DISTRICTS WITH PORTRAIT OF GRADUATE ===\n');

  const pogResult = await client.query(`
    SELECT DISTINCT
      d.nces_id,
      s.district_name,
      s.state,
      d.document_url,
      d.document_title
    FROM district_documents d
    JOIN superintendent_directory s ON d.nces_id = s.nces_id
    WHERE d.document_category = 'portrait_of_graduate'
    ${batchId ? `AND d.nces_id IN (SELECT DISTINCT nces_id FROM document_crawl_log WHERE crawl_batch_id = $1)` : ''}
    ORDER BY s.state, s.district_name
    LIMIT 20
  `, params);

  if (pogResult.rows.length === 0) {
    console.log('No Portrait of Graduate documents found');
  } else {
    for (const row of pogResult.rows) {
      console.log(`${row.district_name} (${row.state})`);
      console.log(`  ${row.document_title || row.document_url}`);
    }
    if (pogResult.rows.length === 20) {
      console.log('... (showing first 20)');
    }
  }

  // 9. Recent batches
  if (!batchId) {
    console.log('\n=== RECENT CRAWL BATCHES ===\n');

    const batchResult = await client.query(`
      SELECT
        crawl_batch_id,
        MIN(crawled_at) as started,
        MAX(crawled_at) as ended,
        COUNT(DISTINCT nces_id) as districts,
        COUNT(*) as requests
      FROM document_crawl_log
      GROUP BY crawl_batch_id
      ORDER BY MIN(crawled_at) DESC
      LIMIT 5
    `);

    for (const row of batchResult.rows) {
      console.log(`Batch: ${row.crawl_batch_id}`);
      console.log(`  Started: ${row.started}`);
      console.log(`  Districts: ${row.districts}, Requests: ${row.requests}`);
    }
  }

  console.log('\n=== ANALYSIS COMPLETE ===');

  await client.end();
}

main().catch(console.error);
