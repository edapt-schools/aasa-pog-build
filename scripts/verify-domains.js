/**
 * Domain Verification Script
 *
 * Verifies website URLs from national_registry using HTTP HEAD requests.
 * Tracks verification status, HTTP codes, and canonical URLs after redirects.
 *
 * Usage:
 *   node scripts/verify-domains.js [--sample N] [--state XX]
 *
 * Options:
 *   --sample N    Only verify first N domains (default: all)
 *   --state XX    Only verify domains for state XX
 */

const { Client } = require('pg');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';

// Parse command line args
const args = process.argv.slice(2);
let sampleSize = null;
let stateFilter = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--sample' && args[i + 1]) {
    sampleSize = parseInt(args[i + 1]);
    i++;
  } else if (args[i] === '--state' && args[i + 1]) {
    stateFilter = args[i + 1].toUpperCase();
    i++;
  }
}

/**
 * Verify a single URL with HEAD request
 */
function verifyUrl(url, timeout = 5000) {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'HEAD',
        timeout: timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AASA-Directory-Bot/1.0)'
        }
      };

      const req = protocol.request(options, (res) => {
        resolve({
          verified: res.statusCode >= 200 && res.statusCode < 400,
          status_code: res.statusCode,
          canonical_url: res.headers.location || url,
          error: null
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          verified: false,
          status_code: 0,
          canonical_url: url,
          error: 'timeout'
        });
      });

      req.on('error', (e) => {
        resolve({
          verified: false,
          status_code: 0,
          canonical_url: url,
          error: e.code || e.message
        });
      });

      req.end();
    } catch (e) {
      resolve({
        verified: false,
        status_code: 0,
        canonical_url: url,
        error: 'invalid_url: ' + e.message
      });
    }
  });
}

/**
 * Sleep helper for rate limiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  console.log('=== Domain Verification Script ===\n');

  // Build query
  let query = `
    SELECT nces_id, state, district_name, website
    FROM national_registry
    WHERE website IS NOT NULL AND website != ''
  `;
  const params = [];

  if (stateFilter) {
    query += ` AND state = $1`;
    params.push(stateFilter);
    console.log(`Filtering by state: ${stateFilter}`);
  }

  query += ` ORDER BY state, district_name`;

  if (sampleSize) {
    query += ` LIMIT $${params.length + 1}`;
    params.push(sampleSize);
    console.log(`Sample size: ${sampleSize}`);
  }

  console.log('\nFetching domains from database...');
  const result = await client.query(query, params);
  console.log(`Found ${result.rows.length} domains to verify\n`);

  // Prepare output file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputPath = path.join(__dirname, `../data/exports/domain_verification_${timestamp}.csv`);

  // Ensure exports directory exists
  const exportsDir = path.dirname(outputPath);
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  // Write CSV header
  const header = 'nces_id,state,district_name,website,verified,status_code,canonical_url,error\n';
  fs.writeFileSync(outputPath, header);

  // Verify each domain
  const stats = {
    total: result.rows.length,
    verified: 0,
    failed: 0,
    timeout: 0,
    byStatus: {}
  };

  console.log('Starting verification (rate limit: 200ms between requests)...\n');

  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows[i];

    // Progress update every 50 records
    if ((i + 1) % 50 === 0 || i === 0) {
      const pct = ((i + 1) / result.rows.length * 100).toFixed(1);
      console.log(`  Progress: ${i + 1}/${result.rows.length} (${pct}%) - ${stats.verified} verified, ${stats.failed} failed`);
    }

    const verification = await verifyUrl(row.website);

    // Update stats
    if (verification.verified) {
      stats.verified++;
    } else {
      stats.failed++;
      if (verification.error === 'timeout') {
        stats.timeout++;
      }
    }

    const statusKey = String(verification.status_code);
    stats.byStatus[statusKey] = (stats.byStatus[statusKey] || 0) + 1;

    // Write to CSV (escape commas and quotes)
    const escapeCsv = (str) => {
      if (!str) return '';
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const csvLine = [
      row.nces_id,
      row.state,
      escapeCsv(row.district_name),
      escapeCsv(row.website),
      verification.verified,
      verification.status_code,
      escapeCsv(verification.canonical_url),
      escapeCsv(verification.error || '')
    ].join(',') + '\n';

    fs.appendFileSync(outputPath, csvLine);

    // Rate limit
    await sleep(200);
  }

  // Final stats
  console.log('\n=== VERIFICATION COMPLETE ===\n');
  console.log(`Total domains checked: ${stats.total}`);
  console.log(`Verified (2xx/3xx): ${stats.verified} (${(stats.verified/stats.total*100).toFixed(1)}%)`);
  console.log(`Failed: ${stats.failed} (${(stats.failed/stats.total*100).toFixed(1)}%)`);
  console.log(`  - Timeouts: ${stats.timeout}`);
  console.log(`\nStatus code breakdown:`);

  const sortedStatuses = Object.entries(stats.byStatus).sort((a, b) => b[1] - a[1]);
  for (const [status, count] of sortedStatuses) {
    console.log(`  ${status}: ${count}`);
  }

  console.log(`\nResults written to: ${outputPath}`);

  await client.end();
}

main().catch(console.error);
