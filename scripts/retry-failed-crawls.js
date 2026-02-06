/**
 * Retry Failed Crawls
 *
 * Attempts to re-crawl districts that failed during the pilot with:
 *   - Exponential backoff retry logic
 *   - SSL certificate bypass option
 *   - Alternative URL detection
 *   - Detailed error logging
 *
 * Usage:
 *   node scripts/retry-failed-crawls.js
 *   node scripts/retry-failed-crawls.js --ssl-bypass    # Allow invalid SSL certs
 *   node scripts/retry-failed-crawls.js --test         # Test mode (don't save)
 */

const { Client } = require('pg');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');
const pdfParse = require('pdf-parse');

const DATABASE_URL = 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';

// Parse args
const args = process.argv.slice(2);
const SSL_BYPASS = args.includes('--ssl-bypass');
const TEST_MODE = args.includes('--test');

const CONFIG = {
  RATE_LIMIT_MS: 1000,
  TIMEOUT_MS: 30000,
  MAX_RETRIES: 3,
  RETRY_DELAYS: [1000, 3000, 5000], // Exponential backoff
  MAX_CONTENT_LENGTH: 10 * 1024 * 1024,
  USER_AGENTS: [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
  ]
};

// Keywords for detection
const DISCOVERY_KEYWORDS = [
  /portrait\s+of\s+(a\s+)?graduate/i,
  /graduate\s+profile/i,
  /strategic\s+plan/i,
  /capstone/i,
  /cornerstone/i
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function hashContent(text) {
  return crypto.createHash('sha256').update(text || '').digest('hex');
}

function getRandomUserAgent() {
  return CONFIG.USER_AGENTS[Math.floor(Math.random() * CONFIG.USER_AGENTS.length)];
}

// Fetch with retry logic and SSL bypass option
function fetchWithRetry(url, retryCount = 0) {
  return new Promise((resolve) => {
    const startTime = Date.now();

    try {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const protocol = isHttps ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'identity',
          'Connection': 'keep-alive'
        },
        timeout: CONFIG.TIMEOUT_MS
      };

      // SSL bypass if enabled
      if (isHttps && SSL_BYPASS) {
        options.rejectUnauthorized = false;
      }

      const request = protocol.request(options, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          let redirectUrl = response.headers.location;
          if (!redirectUrl.startsWith('http')) {
            redirectUrl = new URL(redirectUrl, url).href;
          }
          console.log(`    → Redirect to: ${redirectUrl}`);
          fetchWithRetry(redirectUrl, 0).then(resolve);
          return;
        }

        if (response.statusCode !== 200) {
          // Retry on server errors
          if (response.statusCode >= 500 && retryCount < CONFIG.MAX_RETRIES) {
            console.log(`    ⟳ Retry ${retryCount + 1}/${CONFIG.MAX_RETRIES} after HTTP ${response.statusCode}`);
            sleep(CONFIG.RETRY_DELAYS[retryCount]).then(() => {
              fetchWithRetry(url, retryCount + 1).then(resolve);
            });
            return;
          }

          resolve({
            success: false,
            status: response.statusCode,
            error: `HTTP ${response.statusCode}`,
            responseTime: Date.now() - startTime,
            retries: retryCount
          });
          return;
        }

        const contentType = response.headers['content-type'] || '';
        const chunks = [];
        let totalLength = 0;

        response.on('data', (chunk) => {
          totalLength += chunk.length;
          if (totalLength <= CONFIG.MAX_CONTENT_LENGTH) {
            chunks.push(chunk);
          }
        });

        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            success: true,
            status: 200,
            contentType,
            data: buffer.toString('utf-8'),
            responseTime: Date.now() - startTime,
            retries: retryCount
          });
        });

        response.on('error', (error) => {
          resolve({
            success: false,
            error: error.message,
            responseTime: Date.now() - startTime,
            retries: retryCount
          });
        });
      });

      request.on('error', (error) => {
        // Retry on connection errors
        if (retryCount < CONFIG.MAX_RETRIES &&
            (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED')) {
          console.log(`    ⟳ Retry ${retryCount + 1}/${CONFIG.MAX_RETRIES} after ${error.code}`);
          sleep(CONFIG.RETRY_DELAYS[retryCount]).then(() => {
            fetchWithRetry(url, retryCount + 1).then(resolve);
          });
          return;
        }

        resolve({
          success: false,
          error: error.message,
          errorCode: error.code,
          responseTime: Date.now() - startTime,
          retries: retryCount
        });
      });

      request.on('timeout', () => {
        request.destroy();

        // Retry on timeout
        if (retryCount < CONFIG.MAX_RETRIES) {
          console.log(`    ⟳ Retry ${retryCount + 1}/${CONFIG.MAX_RETRIES} after timeout`);
          sleep(CONFIG.RETRY_DELAYS[retryCount]).then(() => {
            fetchWithRetry(url, retryCount + 1).then(resolve);
          });
          return;
        }

        resolve({
          success: false,
          error: 'Timeout',
          responseTime: Date.now() - startTime,
          retries: retryCount
        });
      });

      request.end();
    } catch (error) {
      resolve({
        success: false,
        error: error.message,
        responseTime: Date.now() - startTime,
        retries: retryCount
      });
    }
  });
}

// Try alternative URL formats
function getAlternativeUrls(url) {
  const alternatives = [];

  try {
    const parsed = new URL(url);

    // Try with/without www
    if (parsed.hostname.startsWith('www.')) {
      alternatives.push(url.replace('www.', ''));
    } else {
      alternatives.push(url.replace(parsed.hostname, 'www.' + parsed.hostname));
    }

    // Try http vs https
    if (parsed.protocol === 'https:') {
      alternatives.push(url.replace('https:', 'http:'));
    } else {
      alternatives.push(url.replace('http:', 'https:'));
    }

  } catch (e) {
    // Invalid URL
  }

  return alternatives;
}

// Extract text from HTML
function extractTextFromHtml(html) {
  if (!html) return '';
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : null;
}

function detectKeywords(text) {
  const found = [];
  const textLower = (text || '').toLowerCase();
  for (const pattern of DISCOVERY_KEYWORDS) {
    if (pattern.test(textLower)) {
      const match = textLower.match(pattern);
      if (match) found.push(match[0]);
    }
  }
  return [...new Set(found)];
}

function categorizeDocument(url, keywords) {
  if (keywords.some(k => k.includes('portrait') || k.includes('graduate'))) {
    return 'portrait_of_graduate';
  }
  if (keywords.some(k => k.includes('strategic'))) {
    return 'strategic_plan';
  }
  return 'other';
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  console.log('=== Retry Failed Crawls ===\n');
  console.log(`SSL Bypass: ${SSL_BYPASS ? 'ENABLED' : 'disabled'}`);
  console.log(`Test Mode: ${TEST_MODE ? 'ENABLED (not saving)' : 'disabled'}`);
  console.log(`Max Retries: ${CONFIG.MAX_RETRIES}\n`);

  // Find failed homepage crawls
  const failedResult = await client.query(`
    SELECT DISTINCT ON (l.nces_id)
      l.nces_id, l.url, l.error_message, l.http_status, l.crawl_batch_id,
      s.district_name, s.state, s.website_url
    FROM document_crawl_log l
    JOIN superintendent_directory s ON l.nces_id = s.nces_id
    WHERE l.url_type = 'homepage' AND l.status = 'failure'
    ORDER BY l.nces_id, l.crawled_at DESC
  `);

  console.log(`Found ${failedResult.rows.length} failed districts\n`);

  if (failedResult.rows.length === 0) {
    console.log('No failed crawls to retry.');
    await client.end();
    return;
  }

  // Stats
  const stats = {
    total: failedResult.rows.length,
    recovered: 0,
    stillFailed: 0,
    alternativeWorked: 0
  };

  const results = [];

  // Process each failed district
  for (const district of failedResult.rows) {
    console.log(`\n[${district.district_name}] (${district.state})`);
    console.log(`  Original URL: ${district.website_url}`);
    console.log(`  Previous error: ${district.error_message || 'HTTP ' + district.http_status}`);

    // Try original URL first
    console.log('  Attempting original URL...');
    let response = await fetchWithRetry(district.website_url);

    // If failed, try alternatives
    if (!response.success) {
      console.log(`  ✗ Failed: ${response.error}`);

      const alternatives = getAlternativeUrls(district.website_url);
      for (const altUrl of alternatives) {
        console.log(`  Trying alternative: ${altUrl}`);
        response = await fetchWithRetry(altUrl);

        if (response.success) {
          console.log(`  ✓ Alternative worked!`);
          stats.alternativeWorked++;
          break;
        }
      }
    }

    if (response.success) {
      stats.recovered++;

      const text = extractTextFromHtml(response.data);
      const title = extractTitle(response.data);
      const keywords = detectKeywords(text);
      const category = categorizeDocument(response.data, keywords);

      console.log(`  ✓ SUCCESS (${response.retries} retries, ${response.responseTime}ms)`);
      console.log(`  Title: ${title || 'N/A'}`);
      console.log(`  Keywords: ${keywords.length > 0 ? keywords.join(', ') : 'None'}`);

      results.push({
        nces_id: district.nces_id,
        district_name: district.district_name,
        state: district.state,
        url: district.website_url,
        success: true,
        title,
        keywords,
        category,
        text_length: text.length,
        extracted_text: text.substring(0, 100000),
        content_hash: hashContent(text)
      });

      if (!TEST_MODE) {
        // Save to district_documents
        try {
          await client.query(`
            INSERT INTO district_documents
            (nces_id, document_url, document_type, document_title, document_category,
             extracted_text, text_length, extraction_method, page_depth, content_hash,
             discovered_at, last_crawled_at)
            VALUES ($1, $2, 'html', $3, $4, $5, $6, 'html_scrape', 0, $7, NOW(), NOW())
            ON CONFLICT (nces_id, document_url) DO UPDATE SET
              extracted_text = EXCLUDED.extracted_text,
              text_length = EXCLUDED.text_length,
              last_crawled_at = NOW()
          `, [
            district.nces_id,
            district.website_url,
            title,
            category,
            text.substring(0, 100000),
            text.length,
            hashContent(text)
          ]);
          console.log(`  ✓ Saved to database`);
        } catch (error) {
          console.log(`  ⚠ Save failed: ${error.message}`);
        }
      }

    } else {
      stats.stillFailed++;
      console.log(`  ✗ STILL FAILED: ${response.error}`);

      results.push({
        nces_id: district.nces_id,
        district_name: district.district_name,
        state: district.state,
        url: district.website_url,
        success: false,
        error: response.error,
        errorCode: response.errorCode,
        retries: response.retries
      });
    }

    await sleep(CONFIG.RATE_LIMIT_MS);
  }

  // Summary
  console.log('\n=== RETRY SUMMARY ===\n');
  console.log(`Total attempted: ${stats.total}`);
  console.log(`Recovered: ${stats.recovered} (${(stats.recovered/stats.total*100).toFixed(1)}%)`);
  console.log(`Still failed: ${stats.stillFailed}`);
  console.log(`Alternative URLs worked: ${stats.alternativeWorked}`);

  if (stats.stillFailed > 0) {
    console.log('\n=== STILL FAILING ===\n');
    for (const r of results.filter(r => !r.success)) {
      console.log(`${r.district_name} (${r.state})`);
      console.log(`  URL: ${r.url}`);
      console.log(`  Error: ${r.error}`);
    }
  }

  await client.end();
}

main().catch(console.error);
