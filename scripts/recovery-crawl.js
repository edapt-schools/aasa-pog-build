/**
 * Recovery Crawler - Uses national_registry (golden view) for URLs
 *
 * Three recovery modes:
 *   --mode uncrawled    Crawl 1,500+ districts never attempted, using NCES/CCD URLs
 *   --mode alt-urls     Re-crawl failed districts where NCES has a DIFFERENT domain
 *   --mode retry        Retry transient failures (timeout, SSL, rate-limit, connection reset)
 *   --mode all          Run all three modes in sequence
 *
 * Options:
 *   --limit N           Max districts to process (default: all)
 *   --concurrency N     Parallel districts (default: 10)
 *   --state XX          Filter by state
 *   --ssl-bypass        Allow invalid SSL certificates (auto-enabled for retry mode)
 *   --dry-run           Show what would be crawled without crawling
 *
 * Examples:
 *   node scripts/recovery-crawl.js --mode uncrawled --limit 500 --concurrency 10
 *   node scripts/recovery-crawl.js --mode alt-urls --concurrency 10
 *   node scripts/recovery-crawl.js --mode retry --ssl-bypass --concurrency 10
 *   node scripts/recovery-crawl.js --mode all --concurrency 10
 */

const { Pool } = require('pg');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');

// pdf-parse import
let pdfParse;
try {
  pdfParse = require('pdf-parse');
} catch (e) {
  console.log('Warning: pdf-parse not installed. PDF extraction disabled.');
  pdfParse = null;
}

const DATABASE_URL = 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';

const CONFIG = {
  RATE_LIMIT_MS: 200,
  TIMEOUT_MS: 15000,
  RETRY_TIMEOUT_MS: 25000,       // Longer timeout for retry mode
  MAX_PDFS_PER_DISTRICT: 10,
  MAX_PAGES_PER_DISTRICT: 10,
  MAX_CONTENT_LENGTH: 10 * 1024 * 1024,
  CONCURRENCY: 30,
  POOL_SIZE: 40,
  USER_AGENTS: [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
  ]
};

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

const URL_PRIORITY_KEYWORDS = [
  'portrait', 'graduate', 'strategic', 'plan', 'vision', 'mission',
  'about', 'district', 'superintendent', 'board', 'leadership'
];

// ============ ARGUMENT PARSING ============

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    mode: 'all',
    limit: null,
    state: null,
    concurrency: CONFIG.CONCURRENCY,
    sslBypass: false,
    dryRun: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mode' && args[i + 1]) {
      config.mode = args[i + 1].toLowerCase();
      i++;
    } else if (args[i] === '--limit' && args[i + 1]) {
      config.limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--state' && args[i + 1]) {
      config.state = args[i + 1].toUpperCase();
      i++;
    } else if (args[i] === '--concurrency' && args[i + 1]) {
      config.concurrency = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--ssl-bypass') {
      config.sslBypass = true;
    } else if (args[i] === '--dry-run') {
      config.dryRun = true;
    }
  }

  // Auto-enable SSL bypass for retry mode
  if (config.mode === 'retry' || config.mode === 'all') {
    config.sslBypass = true;
  }

  return config;
}

// ============ UTILITIES ============

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function hashContent(text) {
  return crypto.createHash('sha256').update(text || '').digest('hex');
}

function getRandomUserAgent() {
  return CONFIG.USER_AGENTS[Math.floor(Math.random() * CONFIG.USER_AGENTS.length)];
}

/**
 * Normalize a domain/URL into a full crawlable URL.
 * NCES stores bare domains like "schooldistrict.org"
 * CCD stores full URLs like "http://www.schooldistrict.org"
 */
function normalizeUrl(urlOrDomain) {
  if (!urlOrDomain) return null;

  let url = urlOrDomain.trim();

  // Skip junk: addresses stored as URLs, "N/A", too short
  if (url.includes(' ') && !url.includes('://')) return null;
  if (url.length < 4) return null;
  if (/^[\d]/.test(url) && !url.includes('.com') && !url.includes('.org') && !url.includes('.net') && !url.includes('.edu') && !url.includes('.us')) return null;
  if (url.toLowerCase() === 'n/a' || url.toLowerCase() === 'n') return null;

  // Add protocol if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  // Validate
  try {
    new URL(url);
    return url;
  } catch (e) {
    return null;
  }
}

/**
 * Extract domain from a URL for comparison purposes
 */
function extractDomain(urlStr) {
  if (!urlStr) return null;
  try {
    const normalized = normalizeUrl(urlStr);
    if (!normalized) return null;
    const u = new URL(normalized);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch (e) {
    return null;
  }
}

// ============ DISTRICT SELECTION QUERIES ============

/**
 * Mode 1: Districts never crawled that have URLs in NCES/CCD
 */
async function getUncrawledDistricts(pool, config) {
  let query = `
    SELECT 
      d.nces_id,
      d.name as district_name,
      d.state,
      COALESCE(c.website_url, d.website_domain::text) as website_url,
      d.enrollment,
      'uncrawled' as recovery_mode
    FROM districts d
    LEFT JOIN ccd_staff_data c ON d.nces_id = c.nces_id
    WHERE NOT EXISTS (SELECT 1 FROM document_crawl_log cl WHERE cl.nces_id = d.nces_id)
      AND NOT EXISTS (SELECT 1 FROM district_documents dd WHERE dd.nces_id = d.nces_id)
      AND (
        (d.website_domain IS NOT NULL AND d.website_domain != '' AND d.website_domain NOT LIKE '% %' AND LENGTH(d.website_domain) > 4)
        OR (c.website_url IS NOT NULL AND c.website_url != '' AND c.website_url NOT LIKE '% %')
      )
  `;
  const params = [];

  if (config.state) {
    params.push(config.state);
    query += ` AND d.state = $${params.length}`;
  }

  query += ` ORDER BY d.enrollment DESC NULLS LAST`;

  if (config.limit) {
    query += ` LIMIT ${config.limit}`;
  }

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Mode 2: Failed districts where NCES/CCD has a DIFFERENT domain than what was tried
 */
async function getAltUrlDistricts(pool, config) {
  let query = `
    WITH failed AS (
      SELECT DISTINCT ON (cl.nces_id) cl.nces_id, cl.url as tried_url
      FROM document_crawl_log cl
      WHERE cl.status = 'failure'
        AND cl.nces_id NOT IN (SELECT DISTINCT nces_id FROM district_documents)
      ORDER BY cl.nces_id, cl.crawled_at DESC
    )
    SELECT 
      f.nces_id,
      d.name as district_name,
      d.state,
      f.tried_url,
      d.website_domain as nces_domain,
      c.website_url as ccd_url,
      d.enrollment,
      'alt_url' as recovery_mode
    FROM failed f
    JOIN districts d ON f.nces_id = d.nces_id
    LEFT JOIN ccd_staff_data c ON f.nces_id = c.nces_id
    WHERE d.website_domain IS NOT NULL 
      AND d.website_domain != ''
      AND d.website_domain NOT LIKE '% %'
      AND LENGTH(d.website_domain) > 4
  `;
  const params = [];

  if (config.state) {
    params.push(config.state);
    query += ` AND d.state = $${params.length}`;
  }

  query += ` ORDER BY d.enrollment DESC NULLS LAST`;

  if (config.limit) {
    query += ` LIMIT ${config.limit}`;
  }

  const result = await pool.query(query, params);

  // Filter to only districts where NCES domain differs from tried URL
  return result.rows.filter(r => {
    const triedDomain = extractDomain(r.tried_url);
    const ncesDomain = extractDomain(r.nces_domain);
    return triedDomain && ncesDomain && triedDomain !== ncesDomain;
  }).map(r => ({
    nces_id: r.nces_id,
    district_name: r.district_name,
    state: r.state,
    website_url: r.ccd_url || r.nces_domain, // prefer CCD full URL, fall back to NCES domain
    tried_url: r.tried_url,
    enrollment: r.enrollment,
    recovery_mode: 'alt_url'
  }));
}

/**
 * Mode 3: Retry transient failures (timeout, SSL, rate-limit, connection reset, blocked)
 */
async function getRetryableDistricts(pool, config) {
  let query = `
    WITH failed AS (
      SELECT DISTINCT ON (cl.nces_id) cl.nces_id, cl.url as tried_url, cl.error_message
      FROM document_crawl_log cl
      WHERE cl.status = 'failure'
        AND cl.nces_id NOT IN (SELECT DISTINCT nces_id FROM district_documents)
        AND (
          cl.error_message ILIKE '%timeout%' OR cl.error_message ILIKE '%ETIMEDOUT%' OR cl.error_message ILIKE '%ESOCKETTIMEDOUT%'
          OR cl.error_message ILIKE '%ssl%' OR cl.error_message ILIKE '%certificate%' OR cl.error_message ILIKE '%CERT%' OR cl.error_message ILIKE '%ERR_TLS%'
          OR cl.error_message ILIKE '%429%' OR cl.error_message ILIKE '%rate%'
          OR cl.error_message ILIKE '%ECONNRESET%'
          OR cl.error_message ILIKE '%403%' OR cl.error_message ILIKE '%forbidden%'
        )
      ORDER BY cl.nces_id, cl.crawled_at DESC
    )
    SELECT 
      f.nces_id,
      d.name as district_name,
      d.state,
      COALESCE(
        NULLIF(sd.website_url, ''),
        NULLIF(c.website_url, ''),
        d.website_domain::text
      ) as website_url,
      f.tried_url,
      f.error_message,
      d.enrollment,
      'retry' as recovery_mode
    FROM failed f
    JOIN districts d ON f.nces_id = d.nces_id
    LEFT JOIN superintendent_directory sd ON f.nces_id = sd.nces_id
    LEFT JOIN ccd_staff_data c ON f.nces_id = c.nces_id
  `;
  const params = [];

  if (config.state) {
    params.push(config.state);
    query += ` WHERE d.state = $${params.length}`;
  }

  query += ` ORDER BY d.enrollment DESC NULLS LAST`;

  if (config.limit) {
    query += ` LIMIT ${config.limit}`;
  }

  const result = await pool.query(query, params);
  return result.rows;
}

// ============ HTTP FETCHING ============

function fetchUrl(url, isBinary = false, sslBypass = false, timeoutMs = CONFIG.TIMEOUT_MS) {
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
          'Accept': isBinary
            ? 'application/pdf,*/*'
            : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: timeoutMs
      };

      if (sslBypass && isHttps) {
        options.rejectUnauthorized = false;
      }

      const request = protocol.request(options, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          let redirectUrl = response.headers.location;
          if (!redirectUrl.startsWith('http')) {
            redirectUrl = new URL(redirectUrl, url).href;
          }
          fetchUrl(redirectUrl, isBinary, sslBypass, timeoutMs).then(resolve);
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

// ============ TEXT EXTRACTION ============

function extractTextFromHtml(html) {
  if (!html) return '';
  return html
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
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : null;
}

function extractLinks(html, baseUrl) {
  const links = { pdfs: [], internal: [], external: [] };
  if (!html) return links;

  let baseDomain;
  try { baseDomain = new URL(baseUrl).hostname; } catch (e) { return links; }

  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match;
  const seen = new Set();

  while ((match = hrefRegex.exec(html)) !== null) {
    let href = match[1].trim();
    if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;

    let absoluteUrl;
    try { absoluteUrl = new URL(href, baseUrl).href; } catch (e) { continue; }
    if (seen.has(absoluteUrl)) continue;
    seen.add(absoluteUrl);

    const urlLower = absoluteUrl.toLowerCase();
    if (urlLower.endsWith('.pdf')) {
      links.pdfs.push(absoluteUrl);
    } else {
      try {
        const urlDomain = new URL(absoluteUrl).hostname;
        if (urlDomain === baseDomain || urlDomain.endsWith('.' + baseDomain)) {
          links.internal.push(absoluteUrl);
        }
      } catch (e) {}
    }
  }
  return links;
}

function scoreUrl(url) {
  const urlLower = url.toLowerCase();
  let score = 0;
  for (const keyword of URL_PRIORITY_KEYWORDS) {
    if (urlLower.includes(keyword)) score += 1;
  }
  const pathDepth = (url.match(/\//g) || []).length - 2;
  if (pathDepth <= 2) score += 1;
  return score;
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

function categorizeDocument(url, text, keywords) {
  if (keywords.some(k => k.includes('portrait') || k.includes('graduate profile') || k.includes('learner profile'))) return 'portrait_of_graduate';
  if (keywords.some(k => k.includes('strategic'))) return 'strategic_plan';
  const urlLower = url.toLowerCase();
  if (urlLower.includes('portrait') || urlLower.includes('graduate')) return 'portrait_of_graduate';
  if (urlLower.includes('strategic') || urlLower.includes('plan')) return 'strategic_plan';
  return 'other';
}

async function extractPdfText(buffer) {
  if (!pdfParse) return { success: false, error: 'pdf-parse not installed' };
  try {
    const data = await pdfParse(buffer);
    return { success: true, text: data.text, pages: data.numpages };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============ CORE CRAWL LOGIC ============

async function crawlDistrict(pool, district, batchId, sslBypass) {
  const logs = [];
  const documents = [];

  // Normalize the URL
  const baseUrl = normalizeUrl(district.website_url);
  if (!baseUrl) {
    console.log(`  ✗ ${district.district_name} (${district.state}) - Invalid URL: ${district.website_url}`);
    return { logs, documents, skipped: true };
  }

  const timeoutMs = district.recovery_mode === 'retry' ? CONFIG.RETRY_TIMEOUT_MS : CONFIG.TIMEOUT_MS;

  console.log(`  Crawling: ${district.district_name} (${district.state}) [${district.recovery_mode}]`);
  console.log(`    URL: ${baseUrl}${district.tried_url ? ' (prev: ' + district.tried_url + ')' : ''}`);

  const logCrawl = (url, urlType, status, httpStatus, errorMessage, contentType, documentId, extractionSuccess, keywords, responseTime) => {
    logs.push({
      nces_id: district.nces_id,
      crawl_batch_id: batchId,
      url, url_type: urlType, status, http_status: httpStatus,
      error_message: errorMessage, content_type: contentType,
      document_id: documentId, extraction_success: extractionSuccess,
      keywords_found: keywords, response_time_ms: responseTime
    });
  };

  // 1. Fetch homepage
  const homepage = await fetchUrl(baseUrl, false, sslBypass, timeoutMs);

  if (!homepage.success) {
    // For retry mode, try www/non-www and http/https variants
    if (district.recovery_mode === 'retry' || district.recovery_mode === 'alt_url') {
      const variants = generateUrlVariants(baseUrl);
      let recovered = false;
      for (const variant of variants) {
        const variantResult = await fetchUrl(variant, false, sslBypass, timeoutMs);
        if (variantResult.success) {
          // Use this variant as the working URL
          Object.assign(homepage, variantResult);
          homepage.success = true;
          console.log(`    ↳ Variant worked: ${variant}`);
          recovered = true;
          break;
        }
        await sleep(300);
      }
      if (!recovered) {
        logCrawl(baseUrl, 'homepage', 'failure', homepage.status, homepage.error, null, null, false, [], homepage.responseTime);
        console.log(`    ✗ Failed: ${homepage.error}`);
        return { logs, documents, skipped: false };
      }
    } else {
      logCrawl(baseUrl, 'homepage', 'failure', homepage.status, homepage.error, null, null, false, [], homepage.responseTime);
      console.log(`    ✗ Failed: ${homepage.error}`);
      return { logs, documents, skipped: false };
    }
  }

  // 2. Process homepage
  const homepageText = extractTextFromHtml(homepage.data);
  const homepageTitle = extractTitle(homepage.data);
  const homepageKeywords = detectKeywords(homepageText);
  const homepageHash = hashContent(homepageText);

  documents.push({
    nces_id: district.nces_id,
    document_url: baseUrl,
    document_type: 'html',
    document_title: homepageTitle,
    document_category: categorizeDocument(baseUrl, homepageText, homepageKeywords),
    extracted_text: homepageText.substring(0, 100000),
    text_length: homepageText.length,
    extraction_method: 'html_scrape',
    page_depth: 0,
    content_hash: homepageHash
  });

  logCrawl(baseUrl, 'homepage', 'success', 200, null, homepage.contentType, null, true, homepageKeywords, homepage.responseTime);
  console.log(`    ✓ Homepage: ${homepageKeywords.length > 0 ? 'Keywords: ' + homepageKeywords.join(', ') : 'OK'} (${homepageText.length} chars)`);

  // 3. Extract and follow links
  const links = extractLinks(homepage.data, baseUrl);

  // 4. Crawl PDFs
  const sortedPdfs = links.pdfs
    .map(url => ({ url, score: scoreUrl(url) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, CONFIG.MAX_PDFS_PER_DISTRICT);

  for (const { url: pdfUrl } of sortedPdfs) {
    await sleep(CONFIG.RATE_LIMIT_MS);
    const pdfResponse = await fetchUrl(pdfUrl, true, sslBypass, timeoutMs);
    if (!pdfResponse.success) {
      logCrawl(pdfUrl, 'pdf_link', 'failure', pdfResponse.status, pdfResponse.error, null, null, false, [], pdfResponse.responseTime);
      continue;
    }
    const pdfResult = await extractPdfText(pdfResponse.data);
    if (!pdfResult.success) {
      logCrawl(pdfUrl, 'pdf_link', 'success', 200, null, pdfResponse.contentType, null, false, [], pdfResponse.responseTime);
      continue;
    }
    const pdfKeywords = detectKeywords(pdfResult.text);
    documents.push({
      nces_id: district.nces_id,
      document_url: pdfUrl,
      document_type: 'pdf',
      document_title: pdfUrl.split('/').pop().replace('.pdf', ''),
      document_category: categorizeDocument(pdfUrl, pdfResult.text, pdfKeywords),
      extracted_text: pdfResult.text.substring(0, 100000),
      text_length: pdfResult.text.length,
      extraction_method: 'pdf_parse',
      page_depth: 1,
      content_hash: hashContent(pdfResult.text)
    });
    logCrawl(pdfUrl, 'pdf_link', 'success', 200, null, pdfResponse.contentType, null, true, pdfKeywords, pdfResponse.responseTime);
    if (pdfKeywords.length > 0) {
      console.log(`    ✓ PDF: ${pdfUrl.split('/').pop()} - Keywords: ${pdfKeywords.join(', ')}`);
    }
  }

  // 5. Crawl internal pages
  const sortedPages = links.internal
    .map(url => ({ url, score: scoreUrl(url) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, CONFIG.MAX_PAGES_PER_DISTRICT);

  for (const { url: pageUrl } of sortedPages) {
    await sleep(CONFIG.RATE_LIMIT_MS);
    const pageResponse = await fetchUrl(pageUrl, false, sslBypass, timeoutMs);
    if (!pageResponse.success) {
      logCrawl(pageUrl, 'internal_link', 'failure', pageResponse.status, pageResponse.error, null, null, false, [], pageResponse.responseTime);
      continue;
    }
    const pageText = extractTextFromHtml(pageResponse.data);
    const pageTitle = extractTitle(pageResponse.data);
    const pageKeywords = detectKeywords(pageText);
    documents.push({
      nces_id: district.nces_id,
      document_url: pageUrl,
      document_type: 'html',
      document_title: pageTitle,
      document_category: categorizeDocument(pageUrl, pageText, pageKeywords),
      extracted_text: pageText.substring(0, 100000),
      text_length: pageText.length,
      extraction_method: 'html_scrape',
      page_depth: 1,
      content_hash: hashContent(pageText)
    });
    logCrawl(pageUrl, 'internal_link', 'success', 200, null, pageResponse.contentType, null, true, pageKeywords, pageResponse.responseTime);
    if (pageKeywords.length > 0) {
      console.log(`    ✓ Page: ${pageTitle || pageUrl.split('/').pop()} - Keywords: ${pageKeywords.join(', ')}`);
    }
  }

  return { logs, documents, skipped: false };
}

/**
 * Generate URL variants (www/non-www, http/https)
 */
function generateUrlVariants(url) {
  const variants = [];
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    const path = parsed.pathname + parsed.search;

    // Toggle www
    const altHostname = hostname.startsWith('www.')
      ? hostname.replace('www.', '')
      : 'www.' + hostname;

    // Generate all combos
    variants.push(`https://${altHostname}${path}`);
    variants.push(`http://${hostname}${path}`);
    variants.push(`http://${altHostname}${path}`);

    // If original was http, try https
    if (parsed.protocol === 'http:') {
      variants.unshift(`https://${hostname}${path}`);
    }
  } catch (e) {}
  return variants;
}

// ============ DATABASE OPS ============

async function saveResults(pool, logs, documents) {
  for (const doc of documents) {
    try {
      await pool.query(`
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
      console.error(`    Error saving doc ${doc.document_url}: ${error.message}`);
    }
  }

  for (const log of logs) {
    try {
      await pool.query(`
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
      console.error(`    Error saving log: ${error.message}`);
    }
  }
}

// ============ MAIN RUNNER ============

async function runMode(pool, modeName, districts, batchId, config) {
  if (districts.length === 0) {
    console.log(`\n  No districts found for mode: ${modeName}`);
    return { success: 0, failed: 0, skipped: 0, docs: 0 };
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`MODE: ${modeName.toUpperCase()} - ${districts.length} districts`);
  console.log(`${'='.repeat(60)}`);

  if (config.dryRun) {
    console.log('\n[DRY RUN] Would crawl:');
    const byState = {};
    for (const d of districts) {
      byState[d.state] = (byState[d.state] || 0) + 1;
    }
    Object.entries(byState).sort((a, b) => b[1] - a[1]).forEach(([state, count]) => {
      console.log(`  ${state}: ${count}`);
    });
    console.log(`  Total: ${districts.length}`);
    return { success: 0, failed: 0, skipped: 0, docs: 0 };
  }

  const stats = { success: 0, failed: 0, skipped: 0, docs: 0 };
  const totalBatches = Math.ceil(districts.length / config.concurrency);

  for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
    const batchStart = batchNum * config.concurrency;
    const batchEnd = Math.min(batchStart + config.concurrency, districts.length);
    const batch = districts.slice(batchStart, batchEnd);

    console.log(`\n--- Batch ${batchNum + 1}/${totalBatches} (${batchStart + 1}-${batchEnd} of ${districts.length}) ---`);

    const batchResults = await Promise.allSettled(
      batch.map(d => crawlDistrict(pool, d, batchId, config.sslBypass))
    );

    for (let i = 0; i < batchResults.length; i++) {
      const result = batchResults[i];
      if (result.status === 'fulfilled') {
        const { logs, documents, skipped } = result.value;
        if (skipped) {
          stats.skipped++;
        } else {
          await saveResults(pool, logs, documents);
          stats.docs += documents.length;
          const homepageLog = logs.find(l => l.url_type === 'homepage');
          if (homepageLog && homepageLog.status === 'success') {
            stats.success++;
          } else {
            stats.failed++;
          }
        }
      } else {
        console.error(`  ERROR: ${batch[i].district_name}: ${result.reason?.message || result.reason}`);
        stats.failed++;
      }
    }

    const processed = batchEnd;
    const rate = ((stats.success / Math.max(1, stats.success + stats.failed)) * 100).toFixed(1);
    console.log(`  Progress: ${processed}/${districts.length} | Success: ${stats.success} (${rate}%) | Failed: ${stats.failed} | Docs: ${stats.docs}`);

    if (batchNum < totalBatches - 1) {
      await sleep(CONFIG.RATE_LIMIT_MS);
    }
  }

  return stats;
}

async function main() {
  const config = parseArgs();

  const validModes = ['uncrawled', 'alt-urls', 'retry', 'all'];
  if (!validModes.includes(config.mode)) {
    console.error(`Invalid mode: ${config.mode}. Use one of: ${validModes.join(', ')}`);
    process.exit(1);
  }

  const pool = new Pool({ connectionString: DATABASE_URL, max: CONFIG.POOL_SIZE });

  console.log('=== Recovery Crawler (national_registry powered) ===\n');
  console.log('Configuration:');
  console.log(`  Mode: ${config.mode}`);
  console.log(`  Concurrency: ${config.concurrency}`);
  console.log(`  SSL bypass: ${config.sslBypass}`);
  console.log(`  State filter: ${config.state || 'All'}`);
  console.log(`  Limit: ${config.limit || 'None'}`);
  console.log(`  Dry run: ${config.dryRun}`);
  console.log(`  PDF extraction: ${pdfParse ? 'Enabled' : 'Disabled'}`);

  const batchIdResult = await pool.query('SELECT gen_random_uuid() as id');
  const batchId = batchIdResult.rows[0].id;
  console.log(`  Batch ID: ${batchId}`);

  const allStats = { success: 0, failed: 0, skipped: 0, docs: 0 };

  const modes = config.mode === 'all'
    ? ['uncrawled', 'alt-urls', 'retry']
    : [config.mode];

  for (const mode of modes) {
    let districts;
    console.log(`\nFetching districts for mode: ${mode}...`);

    if (mode === 'uncrawled') {
      districts = await getUncrawledDistricts(pool, config);
    } else if (mode === 'alt-urls') {
      districts = await getAltUrlDistricts(pool, config);
    } else if (mode === 'retry') {
      districts = await getRetryableDistricts(pool, config);
    }

    console.log(`Found ${districts.length} districts`);

    const modeStats = await runMode(pool, mode, districts, batchId, config);
    allStats.success += modeStats.success;
    allStats.failed += modeStats.failed;
    allStats.skipped += modeStats.skipped;
    allStats.docs += modeStats.docs;
  }

  // Final summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('RECOVERY CRAWL COMPLETE');
  console.log(`${'='.repeat(60)}`);
  console.log(`  Modes run: ${modes.join(', ')}`);
  console.log(`  Districts succeeded: ${allStats.success}`);
  console.log(`  Districts failed: ${allStats.failed}`);
  console.log(`  Districts skipped: ${allStats.skipped}`);
  console.log(`  Total documents: ${allStats.docs}`);
  console.log(`  Success rate: ${((allStats.success / Math.max(1, allStats.success + allStats.failed)) * 100).toFixed(1)}%`);
  console.log(`  Batch ID: ${batchId}`);

  // Get updated totals from DB
  try {
    const totals = await pool.query(`
      SELECT 
        COUNT(DISTINCT nces_id) as districts_with_docs,
        COUNT(*) as total_docs
      FROM district_documents
    `);
    console.log(`\n  Database totals after recovery:`);
    console.log(`    Districts with documents: ${totals.rows[0].districts_with_docs}`);
    console.log(`    Total documents: ${totals.rows[0].total_docs}`);
  } catch (e) {}

  await pool.end();
}

main().catch(console.error);
