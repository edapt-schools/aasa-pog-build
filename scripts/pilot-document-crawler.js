/**
 * Phase 2B: Pilot Document Crawler
 *
 * Crawls district websites to discover Portrait of a Graduate
 * and Strategic Plan documents. Extracts text from HTML pages and PDFs.
 * Logs every success and failure for learning.
 *
 * Features:
 *   - PARALLEL CRAWLING: Process multiple districts simultaneously
 *   - 500ms rate limiting between requests to same domain
 *   - 15-second timeout per request
 *   - PDF extraction using pdf-parse
 *   - Keyword detection on every page
 *   - Comprehensive logging to document_crawl_log
 *   - Connection pooling for database writes
 *
 * Usage:
 *   node scripts/pilot-document-crawler.js [options]
 *
 * Options:
 *   --limit N          Number of districts to crawl (default: 200)
 *   --concurrency N    Number of districts to crawl in parallel (default: 5)
 *   --state XX         Filter by state (e.g., CA, TX)
 *   --skip-existing    Skip districts that already have documents
 *   --skip-attempted   Skip districts that have already been attempted (in crawl log)
 *
 * Examples:
 *   node scripts/pilot-document-crawler.js                          # Default: 200 districts, 5 concurrent
 *   node scripts/pilot-document-crawler.js --limit 50 --concurrency 10   # Fast test
 *   node scripts/pilot-document-crawler.js --state CA --skip-existing    # Continue California
 */

const { Pool } = require('pg');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');

// pdf-parse import - will fail gracefully if not installed
let pdfParse;
try {
  pdfParse = require('pdf-parse');
} catch (e) {
  console.log('Warning: pdf-parse not installed. PDF extraction disabled.');
  pdfParse = null;
}

const DATABASE_URL = 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';

// Configuration
const CONFIG = {
  PILOT_SIZE: 200,
  RATE_LIMIT_MS: 500,
  TIMEOUT_MS: 15000,            // Reduced from 30s to 15s
  MAX_PDFS_PER_DISTRICT: 10,
  MAX_PAGES_PER_DISTRICT: 10,   // Reduced from 20 to 10
  MAX_CONTENT_LENGTH: 10 * 1024 * 1024, // 10MB max download
  CONCURRENCY: 5,               // Number of districts to crawl in parallel
  POOL_SIZE: 10,                // Database connection pool size
  USER_AGENT: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AASA-Research/1.0'
};

// Keywords for document discovery (prioritization)
const DISCOVERY_KEYWORDS = [
  /portrait\s+of\s+(a\s+)?graduate/i,
  /graduate\s+profile/i,
  /learner\s+profile/i,
  /strategic\s+plan/i,
  /strategic\s+priorities/i,
  /community\s+compass/i,
  /measure\s+what\s+matters/i,
  /capstone/i,
  /cornerstone/i
];

// URL priority keywords (for link sorting)
const URL_PRIORITY_KEYWORDS = [
  'portrait', 'graduate', 'strategic', 'plan', 'vision', 'mission',
  'about', 'district', 'superintendent', 'board', 'leadership'
];

// Parse command line args
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    limit: CONFIG.PILOT_SIZE,
    state: null,
    concurrency: CONFIG.CONCURRENCY,
    skipExisting: false,
    skipAttempted: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      config.limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--state' && args[i + 1]) {
      config.state = args[i + 1].toUpperCase();
      i++;
    } else if (args[i] === '--concurrency' && args[i + 1]) {
      config.concurrency = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--skip-existing') {
      config.skipExisting = true;
    } else if (args[i] === '--skip-attempted') {
      config.skipAttempted = true;
    }
  }

  return config;
}

// Sleep utility
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Generate SHA256 hash
function hashContent(text) {
  return crypto.createHash('sha256').update(text || '').digest('hex');
}

// Fetch URL with timeout and redirect following
function fetchUrl(url, isBinary = false) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    try {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': CONFIG.USER_AGENT,
          'Accept': isBinary
            ? 'application/pdf,*/*'
            : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: CONFIG.TIMEOUT_MS
      };

      const request = protocol.request(options, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          let redirectUrl = response.headers.location;
          if (!redirectUrl.startsWith('http')) {
            redirectUrl = new URL(redirectUrl, url).href;
          }
          fetchUrl(redirectUrl, isBinary).then(resolve).catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          resolve({
            success: false,
            status: response.statusCode,
            error: `HTTP ${response.statusCode}`,
            responseTime: Date.now() - startTime
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
            data: isBinary ? buffer : buffer.toString('utf-8'),
            responseTime: Date.now() - startTime
          });
        });

        response.on('error', (error) => {
          resolve({
            success: false,
            status: null,
            error: error.message,
            responseTime: Date.now() - startTime
          });
        });
      });

      request.on('error', (error) => {
        resolve({
          success: false,
          status: null,
          error: error.message,
          responseTime: Date.now() - startTime
        });
      });

      request.on('timeout', () => {
        request.destroy();
        resolve({
          success: false,
          status: null,
          error: 'Timeout',
          responseTime: Date.now() - startTime
        });
      });

      request.end();
    } catch (error) {
      resolve({
        success: false,
        status: null,
        error: error.message,
        responseTime: Date.now() - startTime
      });
    }
  });
}

// Extract text content from HTML (basic extraction)
function extractTextFromHtml(html) {
  if (!html) return '';

  // Remove scripts, styles, and comments
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}

// Extract title from HTML
function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : null;
}

// Extract all links from HTML
function extractLinks(html, baseUrl) {
  const links = {
    pdfs: [],
    internal: [],
    external: []
  };

  if (!html) return links;

  // Parse base URL
  let baseDomain;
  try {
    baseDomain = new URL(baseUrl).hostname;
  } catch (e) {
    return links;
  }

  // Find all href attributes
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match;
  const seen = new Set();

  while ((match = hrefRegex.exec(html)) !== null) {
    let href = match[1].trim();

    // Skip anchors, javascript, mailto, tel
    if (href.startsWith('#') || href.startsWith('javascript:') ||
        href.startsWith('mailto:') || href.startsWith('tel:')) {
      continue;
    }

    // Resolve relative URLs
    let absoluteUrl;
    try {
      absoluteUrl = new URL(href, baseUrl).href;
    } catch (e) {
      continue;
    }

    // Skip duplicates
    if (seen.has(absoluteUrl)) continue;
    seen.add(absoluteUrl);

    // Categorize
    const urlLower = absoluteUrl.toLowerCase();
    if (urlLower.endsWith('.pdf')) {
      links.pdfs.push(absoluteUrl);
    } else {
      try {
        const urlDomain = new URL(absoluteUrl).hostname;
        if (urlDomain === baseDomain || urlDomain.endsWith('.' + baseDomain)) {
          links.internal.push(absoluteUrl);
        } else {
          links.external.push(absoluteUrl);
        }
      } catch (e) {
        // Skip invalid URLs
      }
    }
  }

  return links;
}

// Calculate URL priority score based on keywords
function scoreUrl(url) {
  const urlLower = url.toLowerCase();
  let score = 0;

  for (const keyword of URL_PRIORITY_KEYWORDS) {
    if (urlLower.includes(keyword)) {
      score += 1;
    }
  }

  // Bonus for short paths (likely main sections)
  const pathDepth = (url.match(/\//g) || []).length - 2; // Subtract protocol slashes
  if (pathDepth <= 2) score += 1;

  return score;
}

// Detect keywords in text
function detectKeywords(text) {
  const found = [];
  const textLower = (text || '').toLowerCase();

  for (const pattern of DISCOVERY_KEYWORDS) {
    if (pattern.test(textLower)) {
      const match = textLower.match(pattern);
      if (match) {
        found.push(match[0]);
      }
    }
  }

  return [...new Set(found)]; // Dedupe
}

// Categorize document based on keywords and URL
function categorizeDocument(url, text, keywords) {
  const urlLower = url.toLowerCase();
  const textLower = (text || '').toLowerCase();

  if (keywords.some(k => k.includes('portrait') || k.includes('graduate profile') || k.includes('learner profile'))) {
    return 'portrait_of_graduate';
  }
  if (keywords.some(k => k.includes('strategic'))) {
    return 'strategic_plan';
  }
  if (urlLower.includes('portrait') || urlLower.includes('graduate')) {
    return 'portrait_of_graduate';
  }
  if (urlLower.includes('strategic') || urlLower.includes('plan')) {
    return 'strategic_plan';
  }

  return 'other';
}

// Extract text from PDF
async function extractPdfText(buffer) {
  if (!pdfParse) {
    return { success: false, error: 'pdf-parse not installed' };
  }

  try {
    const data = await pdfParse(buffer);
    return {
      success: true,
      text: data.text,
      pages: data.numpages
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Main crawler function for a single district
async function crawlDistrict(client, district, batchId) {
  const logs = [];
  const documents = [];
  const baseUrl = district.website_url;

  console.log(`\n  Crawling: ${district.district_name} (${district.state})`);
  console.log(`  URL: ${baseUrl}`);

  // Helper to log a crawl attempt
  const logCrawl = async (url, urlType, status, httpStatus, errorMessage, contentType, documentId, extractionSuccess, keywords, responseTime) => {
    logs.push({
      nces_id: district.nces_id,
      crawl_batch_id: batchId,
      url,
      url_type: urlType,
      status,
      http_status: httpStatus,
      error_message: errorMessage,
      content_type: contentType,
      document_id: documentId,
      extraction_success: extractionSuccess,
      keywords_found: keywords,
      response_time_ms: responseTime
    });
  };

  // 1. Fetch homepage
  const homepage = await fetchUrl(baseUrl);

  if (!homepage.success) {
    await logCrawl(baseUrl, 'homepage', 'failure', homepage.status, homepage.error, null, null, false, [], homepage.responseTime);
    console.log(`    ✗ Homepage failed: ${homepage.error}`);
    return { logs, documents };
  }

  // 2. Process homepage
  const homepageText = extractTextFromHtml(homepage.data);
  const homepageTitle = extractTitle(homepage.data);
  const homepageKeywords = detectKeywords(homepageText);
  const homepageHash = hashContent(homepageText);

  // Store homepage document
  const homepageDoc = {
    nces_id: district.nces_id,
    document_url: baseUrl,
    document_type: 'html',
    document_title: homepageTitle,
    document_category: categorizeDocument(baseUrl, homepageText, homepageKeywords),
    extracted_text: homepageText.substring(0, 100000), // Limit text size
    text_length: homepageText.length,
    extraction_method: 'html_scrape',
    page_depth: 0,
    content_hash: homepageHash
  };
  documents.push(homepageDoc);

  await logCrawl(baseUrl, 'homepage', 'success', 200, null, homepage.contentType, null, true, homepageKeywords, homepage.responseTime);
  console.log(`    ✓ Homepage: ${homepageKeywords.length > 0 ? 'Keywords: ' + homepageKeywords.join(', ') : 'No keywords'}`);

  // 3. Extract links
  const links = extractLinks(homepage.data, baseUrl);
  console.log(`    Found: ${links.pdfs.length} PDFs, ${links.internal.length} internal pages`);

  // 4. Crawl PDFs (prioritize by URL keywords)
  const sortedPdfs = links.pdfs
    .map(url => ({ url, score: scoreUrl(url) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, CONFIG.MAX_PDFS_PER_DISTRICT);

  for (const { url: pdfUrl } of sortedPdfs) {
    await sleep(CONFIG.RATE_LIMIT_MS);

    const pdfResponse = await fetchUrl(pdfUrl, true);

    if (!pdfResponse.success) {
      await logCrawl(pdfUrl, 'pdf_link', 'failure', pdfResponse.status, pdfResponse.error, null, null, false, [], pdfResponse.responseTime);
      continue;
    }

    const pdfResult = await extractPdfText(pdfResponse.data);

    if (!pdfResult.success) {
      await logCrawl(pdfUrl, 'pdf_link', 'success', 200, null, pdfResponse.contentType, null, false, [], pdfResponse.responseTime);
      continue;
    }

    const pdfKeywords = detectKeywords(pdfResult.text);
    const pdfHash = hashContent(pdfResult.text);

    const pdfDoc = {
      nces_id: district.nces_id,
      document_url: pdfUrl,
      document_type: 'pdf',
      document_title: pdfUrl.split('/').pop().replace('.pdf', ''),
      document_category: categorizeDocument(pdfUrl, pdfResult.text, pdfKeywords),
      extracted_text: pdfResult.text.substring(0, 100000),
      text_length: pdfResult.text.length,
      extraction_method: 'pdf_parse',
      page_depth: 1,
      content_hash: pdfHash
    };
    documents.push(pdfDoc);

    await logCrawl(pdfUrl, 'pdf_link', 'success', 200, null, pdfResponse.contentType, null, true, pdfKeywords, pdfResponse.responseTime);

    if (pdfKeywords.length > 0) {
      console.log(`    ✓ PDF: ${pdfUrl.split('/').pop()} - Keywords: ${pdfKeywords.join(', ')}`);
    }
  }

  // 5. Crawl internal pages (prioritize by URL keywords)
  const sortedPages = links.internal
    .map(url => ({ url, score: scoreUrl(url) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, CONFIG.MAX_PAGES_PER_DISTRICT);

  for (const { url: pageUrl } of sortedPages) {
    await sleep(CONFIG.RATE_LIMIT_MS);

    const pageResponse = await fetchUrl(pageUrl);

    if (!pageResponse.success) {
      await logCrawl(pageUrl, 'internal_link', 'failure', pageResponse.status, pageResponse.error, null, null, false, [], pageResponse.responseTime);
      continue;
    }

    const pageText = extractTextFromHtml(pageResponse.data);
    const pageTitle = extractTitle(pageResponse.data);
    const pageKeywords = detectKeywords(pageText);
    const pageHash = hashContent(pageText);

    const pageDoc = {
      nces_id: district.nces_id,
      document_url: pageUrl,
      document_type: 'html',
      document_title: pageTitle,
      document_category: categorizeDocument(pageUrl, pageText, pageKeywords),
      extracted_text: pageText.substring(0, 100000),
      text_length: pageText.length,
      extraction_method: 'html_scrape',
      page_depth: 1,
      content_hash: pageHash
    };
    documents.push(pageDoc);

    await logCrawl(pageUrl, 'internal_link', 'success', 200, null, pageResponse.contentType, null, true, pageKeywords, pageResponse.responseTime);

    if (pageKeywords.length > 0) {
      console.log(`    ✓ Page: ${pageTitle || pageUrl.split('/').pop()} - Keywords: ${pageKeywords.join(', ')}`);
    }
  }

  return { logs, documents };
}

// Save documents and logs to database
async function saveResults(client, logs, documents) {
  // Insert documents
  for (const doc of documents) {
    try {
      await client.query(`
        INSERT INTO district_documents
        (nces_id, document_url, document_type, document_title, document_category,
         extracted_text, text_length, extraction_method, page_depth, content_hash,
         discovered_at, last_crawled_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        ON CONFLICT (nces_id, document_url) DO UPDATE SET
          extracted_text = EXCLUDED.extracted_text,
          text_length = EXCLUDED.text_length,
          document_category = EXCLUDED.document_category,
          content_hash = EXCLUDED.content_hash,
          last_crawled_at = NOW()
      `, [
        doc.nces_id, doc.document_url, doc.document_type, doc.document_title,
        doc.document_category, doc.extracted_text, doc.text_length,
        doc.extraction_method, doc.page_depth, doc.content_hash
      ]);
    } catch (error) {
      console.error(`    Error saving document ${doc.document_url}: ${error.message}`);
    }
  }

  // Insert logs
  for (const log of logs) {
    try {
      await client.query(`
        INSERT INTO document_crawl_log
        (nces_id, crawl_batch_id, url, url_type, status, http_status,
         error_message, content_type, extraction_success, keywords_found,
         response_time_ms, crawled_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      `, [
        log.nces_id, log.crawl_batch_id, log.url, log.url_type, log.status,
        log.http_status, log.error_message, log.content_type,
        log.extraction_success, log.keywords_found, log.response_time_ms
      ]);
    } catch (error) {
      console.error(`    Error saving log for ${log.url}: ${error.message}`);
    }
  }
}

// Main function
async function main() {
  const config = parseArgs();
  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: CONFIG.POOL_SIZE
  });

  console.log('=== Phase 2B: Pilot Document Crawler ===\n');
  console.log(`Configuration:`);
  console.log(`  Districts to crawl: ${config.limit}`);
  console.log(`  Concurrency: ${config.concurrency} districts in parallel`);
  console.log(`  State filter: ${config.state || 'All'}`);
  console.log(`  Skip existing: ${config.skipExisting}`);
  console.log(`  Skip attempted: ${config.skipAttempted}`);
  console.log(`  Timeout: ${CONFIG.TIMEOUT_MS}ms`);
  console.log(`  Rate limit: ${CONFIG.RATE_LIMIT_MS}ms between requests`);
  console.log(`  PDF extraction: ${pdfParse ? 'Enabled' : 'Disabled'}`);

  // Generate batch ID
  const batchIdResult = await pool.query(`SELECT gen_random_uuid() as id`);
  const batchId = batchIdResult.rows[0].id;
  console.log(`  Batch ID: ${batchId}\n`);

  // Select pilot districts
  let query = `
    SELECT s.nces_id, s.state, s.district_name, s.website_url, s.data_quality_tier, s.enrollment
    FROM superintendent_directory s
    WHERE s.data_quality_tier IN ('A', 'B', 'C')
      AND s.website_url IS NOT NULL
      AND s.website_url != ''
      AND s.website_url NOT LIKE '%facebook%'
      AND s.website_url NOT LIKE '%twitter%'
  `;
  const params = [];

  if (config.skipExisting) {
    query += `
      AND NOT EXISTS (
        SELECT 1 FROM district_documents d WHERE d.nces_id = s.nces_id
      )
    `;
  }

  if (config.skipAttempted) {
    query += `
      AND NOT EXISTS (
        SELECT 1 FROM document_crawl_log cl WHERE cl.nces_id = s.nces_id
      )
    `;
  }

  if (config.state) {
    params.push(config.state);
    query += ` AND s.state = $${params.length}`;
  }

  query += `
    ORDER BY
      s.data_quality_tier ASC,
      s.enrollment DESC NULLS LAST
    LIMIT ${config.limit}
  `;

  console.log('Selecting pilot districts...');
  const districtsResult = await pool.query(query, params);
  const districts = districtsResult.rows;
  console.log(`Selected ${districts.length} districts\n`);

  if (districts.length === 0) {
    console.log('No districts found matching criteria.');
    await pool.end();
    return;
  }

  // Stats tracking
  const stats = {
    totalDistricts: districts.length,
    successfulHomepages: 0,
    failedHomepages: 0,
    totalDocuments: 0,
    totalLogs: 0,
    documentsWithKeywords: 0,
    keywordCounts: {}
  };

  // Crawl districts in parallel batches
  console.log(`Starting parallel crawl (${config.concurrency} at a time)...`);

  const totalBatches = Math.ceil(districts.length / config.concurrency);

  for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
    const batchStart = batchNum * config.concurrency;
    const batchEnd = Math.min(batchStart + config.concurrency, districts.length);
    const batch = districts.slice(batchStart, batchEnd);

    console.log(`\n=== Batch ${batchNum + 1}/${totalBatches} (districts ${batchStart + 1}-${batchEnd}) ===`);

    // Process batch in parallel
    const batchResults = await Promise.allSettled(
      batch.map(district => crawlDistrict(pool, district, batchId))
    );

    // Process results and save to database
    for (let i = 0; i < batchResults.length; i++) {
      const result = batchResults[i];
      const district = batch[i];

      if (result.status === 'fulfilled') {
        const { logs, documents } = result.value;

        // Save to database
        await saveResults(pool, logs, documents);

        // Update stats
        stats.totalLogs += logs.length;
        stats.totalDocuments += documents.length;

        const homepageLog = logs.find(l => l.url_type === 'homepage');
        if (homepageLog && homepageLog.status === 'success') {
          stats.successfulHomepages++;
        } else {
          stats.failedHomepages++;
        }

        for (const log of logs) {
          if (log.keywords_found && log.keywords_found.length > 0) {
            stats.documentsWithKeywords++;
            for (const keyword of log.keywords_found) {
              stats.keywordCounts[keyword] = (stats.keywordCounts[keyword] || 0) + 1;
            }
          }
        }
      } else {
        console.error(`  ERROR ${district.district_name}: ${result.reason?.message || result.reason}`);
        stats.failedHomepages++;
      }
    }

    // Progress update after each batch
    const processed = batchEnd;
    const successRate = (stats.successfulHomepages / processed * 100).toFixed(1);
    console.log(`--- Progress: ${processed}/${districts.length} (${successRate}% homepage success) ---`);

    // Small delay between batches to avoid overwhelming the DB
    if (batchNum < totalBatches - 1) {
      await sleep(CONFIG.RATE_LIMIT_MS);
    }
  }

  // Final summary
  console.log('\n=== CRAWL COMPLETE ===\n');
  console.log(`Districts crawled: ${stats.totalDistricts}`);
  console.log(`Homepage success rate: ${stats.successfulHomepages}/${stats.totalDistricts} (${(stats.successfulHomepages/stats.totalDistricts*100).toFixed(1)}%)`);
  console.log(`Total documents discovered: ${stats.totalDocuments}`);
  console.log(`Documents with keywords: ${stats.documentsWithKeywords}`);
  console.log(`Total crawl log entries: ${stats.totalLogs}`);

  console.log('\nKeyword Detection Summary:');
  const sortedKeywords = Object.entries(stats.keywordCounts)
    .sort((a, b) => b[1] - a[1]);
  for (const [keyword, count] of sortedKeywords) {
    console.log(`  "${keyword}": ${count} occurrences`);
  }

  console.log(`\nBatch ID: ${batchId}`);
  console.log('Use this ID to analyze results in document_crawl_log');

  await pool.end();
}

main().catch(console.error);
