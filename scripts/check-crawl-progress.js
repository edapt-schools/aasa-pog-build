#!/usr/bin/env node
/**
 * Check Document Crawl Progress
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL || 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres',
  max: 5
});

async function main() {
  try {
    // Check document crawl log
    const crawlStats = await pool.query(`
      SELECT
        COUNT(DISTINCT nces_id) as districts_crawled,
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_requests,
        COUNT(CASE WHEN status = 'failure' THEN 1 END) as failed_requests,
        ROUND(COUNT(CASE WHEN status = 'success' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as success_rate,
        MAX(crawled_at) as last_crawl_time,
        MIN(crawled_at) as first_crawl_time
      FROM document_crawl_log
    `);

    // Check district_documents
    const docStats = await pool.query(`
      SELECT
        COUNT(DISTINCT nces_id) as districts_with_docs,
        COUNT(*) as total_documents,
        COUNT(CASE WHEN document_type = 'pdf' THEN 1 END) as pdf_docs,
        COUNT(CASE WHEN document_type = 'html' THEN 1 END) as html_docs,
        ROUND(AVG(text_length)::numeric, 0) as avg_doc_length
      FROM district_documents
    `);

    // Check crawl progress over time (last hour)
    const recentProgress = await pool.query(`
      SELECT
        DATE_TRUNC('hour', crawled_at) as hour,
        COUNT(DISTINCT nces_id) as districts,
        COUNT(*) as requests,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successes
      FROM document_crawl_log
      WHERE crawled_at > NOW() - INTERVAL '2 hours'
      GROUP BY DATE_TRUNC('hour', crawled_at)
      ORDER BY hour DESC
    `);

    // Estimate completion time
    const rateQuery = await pool.query(`
      SELECT
        COUNT(DISTINCT nces_id) as recent_districts,
        EXTRACT(EPOCH FROM (MAX(crawled_at) - MIN(crawled_at))) / 60 as minutes_elapsed
      FROM document_crawl_log
      WHERE crawled_at > NOW() - INTERVAL '1 hour'
    `);

    console.log('\n📊 DOCUMENT CRAWL STATUS');
    console.log('='.repeat(70));

    const crawl = crawlStats.rows[0];
    console.log('\n🔍 Overall Progress:');
    console.log(`   Districts crawled: ${crawl.districts_crawled}`);
    console.log(`   Total requests: ${crawl.total_requests}`);
    console.log(`   Successful: ${crawl.successful_requests} (${crawl.success_rate}%)`);
    console.log(`   Failed: ${crawl.failed_requests}`);
    console.log(`   First crawl: ${crawl.first_crawl_time}`);
    console.log(`   Last crawl: ${crawl.last_crawl_time}`);

    const docs = docStats.rows[0];
    console.log('\n📄 Documents Collected:');
    console.log(`   Districts with docs: ${docs.districts_with_docs}`);
    console.log(`   Total documents: ${docs.total_documents}`);
    console.log(`   PDFs: ${docs.pdf_docs}`);
    console.log(`   HTML pages: ${docs.html_docs}`);
    console.log(`   Avg document length: ${docs.avg_doc_length} chars`);

    if (recentProgress.rows.length > 0) {
      console.log('\n⏱️  Recent Progress (last 2 hours):');
      recentProgress.rows.forEach(row => {
        console.log(`   ${new Date(row.hour).toLocaleString()}: ${row.districts} districts, ${row.successes}/${row.requests} successful`);
      });
    }

    // Calculate rate and ETA
    const rate = rateQuery.rows[0];
    if (rate.recent_districts > 0 && rate.minutes_elapsed > 0) {
      const districtsPerMinute = rate.recent_districts / rate.minutes_elapsed;
      const totalDistricts = 19595;
      const remaining = totalDistricts - parseInt(crawl.districts_crawled);
      const minutesRemaining = remaining / districtsPerMinute;
      const hoursRemaining = minutesRemaining / 60;

      const eta = new Date(Date.now() + minutesRemaining * 60 * 1000);

      console.log('\n🎯 Projection:');
      console.log(`   Current rate: ${districtsPerMinute.toFixed(2)} districts/minute`);
      console.log(`   Remaining: ${remaining} districts`);
      console.log(`   ETA: ${eta.toLocaleString()} (${hoursRemaining.toFixed(1)} hours)`);

      const eightAM = new Date();
      eightAM.setHours(8, 0, 0, 0);
      if (eightAM < new Date()) {
        eightAM.setDate(eightAM.getDate() + 1);
      }

      const minutesUntil8AM = (eightAM - Date.now()) / 1000 / 60;
      const districtsBy8AM = parseInt(crawl.districts_crawled) + (districtsPerMinute * minutesUntil8AM);

      console.log(`\n📅 By 8:00 AM:`);
      console.log(`   Expected districts: ${Math.floor(districtsBy8AM)} (${((districtsBy8AM / totalDistricts) * 100).toFixed(1)}% coverage)`);
      console.log(`   Time until 8 AM: ${(minutesUntil8AM / 60).toFixed(1)} hours`);
    }

    console.log('\n📍 Where to find this in Supabase:');
    console.log('   1. Go to: https://supabase.com/dashboard/project/wdvpjyymztrebwaiaidu');
    console.log('   2. Click "Table Editor" in left sidebar');
    console.log('   3. View tables:');
    console.log('      - document_crawl_log (all crawl attempts)');
    console.log('      - district_documents (collected documents)');
    console.log('   4. Or use SQL Editor with these queries:');
    console.log('');
    console.log('      SELECT COUNT(DISTINCT district_nces_id) FROM document_crawl_log;');
    console.log('      SELECT COUNT(*) FROM district_documents;');
    console.log('      SELECT status, COUNT(*) FROM document_crawl_log GROUP BY status;');
    console.log('');

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
