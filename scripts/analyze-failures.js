const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Get failure breakdown
    const result = await pool.query(`
      SELECT
        CASE
          WHEN error_message LIKE '%Invalid URL%' THEN 'bad_url'
          WHEN error_message LIKE '%ENOTFOUND%' THEN 'dns_dead'
          WHEN error_message LIKE '%Timeout%' THEN 'timeout'
          WHEN error_message LIKE '%ECONNRESET%' OR error_message LIKE '%ECONNREFUSED%' THEN 'connection'
          WHEN error_message LIKE '%certificate%' OR error_message LIKE '%EPROTO%' OR error_message LIKE '%SSL%' THEN 'ssl_error'
          WHEN error_message LIKE '%429%' THEN 'rate_limited'
          WHEN error_message LIKE '%404%' THEN 'page_404'
          WHEN error_message LIKE '%403%' THEN 'blocked'
          ELSE 'other'
        END as category,
        COUNT(DISTINCT nces_id) as count
      FROM document_crawl_log
      WHERE status = 'failure'
      AND nces_id NOT IN (SELECT DISTINCT nces_id FROM district_documents)
      GROUP BY 1
      ORDER BY 2 DESC
    `);

    console.log('=== FAILED DISTRICTS BY ERROR CATEGORY ===\n');
    let total = 0;
    result.rows.forEach(r => {
      console.log(`  ${r.category}: ${r.count}`);
      total += parseInt(r.count);
    });
    console.log(`\n  TOTAL: ${total} districts with failures and no documents`);

    // Summary stats
    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(DISTINCT nces_id) FROM district_documents) as with_docs,
        (SELECT COUNT(DISTINCT nces_id) FROM document_crawl_log) as attempted,
        (SELECT COUNT(*) FROM districts) as total_districts
    `);

    const s = stats.rows[0];
    console.log('\n=== OVERALL STATUS ===');
    console.log(`  Districts with documents: ${s.with_docs}`);
    console.log(`  Districts attempted: ${s.attempted}`);
    console.log(`  Total in database: ${s.total_districts}`);
    console.log(`  Not yet crawled: ${s.total_districts - s.attempted}`);
    console.log(`  Success rate: ${((s.with_docs / s.attempted) * 100).toFixed(1)}%`);

  } finally {
    await pool.end();
  }
}

main().catch(console.error);
