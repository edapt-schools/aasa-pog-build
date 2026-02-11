/**
 * District Recovery Pipeline - Aggressive 6-Strategy URL Discovery
 *
 * For each failed/missing district, runs a deep waterfall:
 *   1. Fix obvious URL errors (typos, missing TLDs, mail. prefixes)
 *   2. Cross-reference ALL URL sources (NCES, CCD, supt directory) with variants
 *   3. Email domain extraction (strip subdomains like mail.)
 *   4. Pattern-based URL generation + DNS verification
 *   5. DuckDuckGo web search (nuclear option)
 *   6. Error-specific retry (longer timeout, different user-agent, HTTP fallback)
 *
 * Modes:
 *   --mode failed-retry      Districts that failed with a URL
 *   --mode discover-urls     Districts with no URL anywhere
 *   --mode empty-text        Districts with docs but no useful text
 *   --mode all               All modes in sequence
 *
 * Options:
 *   --limit N           Max districts per mode (default: all)
 *   --concurrency N     Parallel districts (default: 15)
 *   --state XX          Filter by state
 *   --dry-run           Show counts without crawling
 *   --no-search         Skip DuckDuckGo search strategy
 *
 * DB Writes:
 *   - district_documents (UPSERT)
 *   - document_crawl_log (INSERT)
 *   - url_corrections (INSERT on discovered/corrected URLs)
 *   - data_imports (INSERT at start for audit trail)
 *
 * Examples:
 *   node scripts/district-recovery.js --mode all --concurrency 15
 *   node scripts/district-recovery.js --mode failed-retry --limit 50
 */

const { Pool } = require('pg');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const dns = require('dns');
const { URL } = require('url');

let pdfParse;
try { pdfParse = require('pdf-parse'); } catch (e) {
  console.log('Warning: pdf-parse not installed. PDF extraction disabled.');
}

const DATABASE_URL = 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';

const CONFIG = {
  RATE_LIMIT_MS: 200,
  TIMEOUT_MS: 15000,
  LONG_TIMEOUT_MS: 45000,
  DNS_TIMEOUT_MS: 4000,
  HTTP_CHECK_TIMEOUT_MS: 10000,
  DDG_RATE_LIMIT_MS: 2500,
  MAX_PDFS_PER_DISTRICT: 10,
  MAX_PAGES_PER_DISTRICT: 10,
  MAX_CONTENT_LENGTH: 10 * 1024 * 1024,
  CONCURRENCY: 15,
  POOL_SIZE: 25,
  USER_AGENTS: [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
  ],
  BROWSER_HEADERS: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'identity',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0'
  }
};

const DISCOVERY_KEYWORDS = [
  /portrait\s+of\s+(a\s+)?graduate/i, /graduate\s+profile/i, /learner\s+profile/i,
  /strategic\s+plan/i, /strategic\s+priorities/i, /community\s+compass/i,
  /measure\s+what\s+matters/i, /capstone/i, /cornerstone/i
];

const URL_PRIORITY_KEYWORDS = [
  'portrait', 'graduate', 'strategic', 'plan', 'vision', 'mission',
  'about', 'district', 'superintendent', 'board', 'leadership'
];

// Generic email providers to skip in domain extraction
const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'live.com', 'msn.com', 'comcast.net', 'att.net',
  'charter.net', 'cox.net', 'earthlink.net', 'sbcglobal.net',
  'verizon.net', 'bellsouth.net', 'windstream.net', 'centurytel.net',
  'suddenlink.net', 'frontier.com', 'twc.com', 'cableone.net',
  'mac.com', 'me.com', 'protonmail.com', 'proton.me', 'zoho.com'
]);

// ============ ARGUMENT PARSING ============

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    mode: 'all', limit: null, state: null,
    concurrency: CONFIG.CONCURRENCY,
    dryRun: false, noSearch: false
  };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--mode': config.mode = (args[++i] || '').toLowerCase(); break;
      case '--limit': config.limit = parseInt(args[++i], 10); break;
      case '--state': config.state = (args[++i] || '').toUpperCase(); break;
      case '--concurrency': config.concurrency = parseInt(args[++i], 10); break;
      case '--dry-run': config.dryRun = true; break;
      case '--no-search': config.noSearch = true; break;
    }
  }
  return config;
}

// ============ UTILITIES ============

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function hashContent(text) { return crypto.createHash('sha256').update(text || '').digest('hex'); }
function getRandomUserAgent() { return CONFIG.USER_AGENTS[Math.floor(Math.random() * CONFIG.USER_AGENTS.length)]; }

function normalizeUrl(urlOrDomain) {
  if (!urlOrDomain) return null;
  let url = urlOrDomain.trim();
  if (url.length < 4) return null;
  if (['n/a', 'n', 'none', 'na', '-', ''].includes(url.toLowerCase())) return null;
  // Strip trailing slashes and whitespace junk
  url = url.replace(/[\s]+/g, '').replace(/\/+$/, '');
  if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
  try { new URL(url); return url; } catch (e) { return null; }
}

function extractDomain(urlStr) {
  if (!urlStr) return null;
  try {
    const n = normalizeUrl(urlStr);
    if (!n) return null;
    return new URL(n).hostname.replace(/^www\./, '').toLowerCase();
  } catch (e) { return null; }
}

// ============ STRATEGY 1: FIX OBVIOUS URL ERRORS ============

/**
 * Attempt to repair known URL problems before fetching.
 * Returns array of fixed URL candidates (may be empty if URL is fine).
 */
function fixObviousUrlErrors(url) {
  if (!url) return [];
  const fixes = [];
  let u = url.trim();

  // Fix "ww." typo -> "www."
  if (u.match(/^https?:\/\/ww\./i) && !u.match(/^https?:\/\/www\./i)) {
    fixes.push(u.replace(/^(https?:\/\/)ww\./i, '$1www.'));
  }

  // Fix double www
  if (u.includes('www.www.')) {
    fixes.push(u.replace('www.www.', 'www.'));
  }

  // Fix "mail." or "email." prefix (someone stored email server as website)
  try {
    const parsed = new URL(u.startsWith('http') ? u : 'https://' + u);
    if (parsed.hostname.startsWith('mail.') || parsed.hostname.startsWith('email.')) {
      const stripped = parsed.hostname.replace(/^(mail|email)\./, '');
      fixes.push(`https://${stripped}`);
      fixes.push(`https://www.${stripped}`);
    }
  } catch (e) {}

  // Fix missing TLD (URL ends with just a name like "daytonpublic/")
  try {
    const parsed = new URL(u.startsWith('http') ? u : 'https://' + u);
    const hostname = parsed.hostname;
    // If hostname has no dot (or only one segment), it's missing TLD
    if (!hostname.includes('.') || hostname.match(/^[a-z0-9-]+$/)) {
      fixes.push(`https://${hostname}.org`);
      fixes.push(`https://${hostname}.com`);
      fixes.push(`https://www.${hostname}.org`);
      fixes.push(`https://www.${hostname}.com`);
    }
    // If hostname ends without a proper TLD
    if (hostname.match(/\.[a-z]{1}$/) || hostname.endsWith('.')) {
      const base = hostname.replace(/\.?$/, '');
      fixes.push(`https://${base}.org`);
      fixes.push(`https://${base}.com`);
    }
  } catch (e) {}

  // Fix state-level-only domains (e.g., "k12.wv.us" with no district prefix)
  try {
    const parsed = new URL(u.startsWith('http') ? u : 'https://' + u);
    const hostname = parsed.hostname.replace(/^www\./, '');
    if (hostname.match(/^k12\.[a-z]{2}\.us$/)) {
      // This is a bare state domain, not useful
      return []; // Skip it entirely, let other strategies find the real URL
    }
  } catch (e) {}

  // Fix double slash in path
  if (u.includes('//') && !u.match(/^https?:\/\//)) {
    fixes.push(u.replace(/([^:])\/\//g, '$1/'));
  }

  return [...new Set(fixes)].filter(f => f !== url);
}

// ============ STRATEGY 3: EMAIL DOMAIN EXTRACTION ============

/**
 * Extract website URL from email address, with smart subdomain stripping.
 * "ppotter@mail.kana.k12.wv.us" -> ["https://kana.k12.wv.us", "https://www.kana.k12.wv.us"]
 * "super@district.org" -> ["https://district.org", "https://www.district.org"]
 */
function extractUrlsFromEmail(email) {
  if (!email || !email.includes('@')) return [];
  const domain = email.split('@')[1].toLowerCase().trim();
  if (!domain || domain.length < 4) return [];
  if (GENERIC_EMAIL_DOMAINS.has(domain)) return [];

  const results = [];

  // Strip common email subdomains
  let baseDomain = domain;
  const emailPrefixes = ['mail.', 'email.', 'smtp.', 'mx.', 'exchange.', 'owa.', 'webmail.', 'outlook.'];
  for (const prefix of emailPrefixes) {
    if (baseDomain.startsWith(prefix)) {
      baseDomain = baseDomain.substring(prefix.length);
      break;
    }
  }

  results.push(`https://${baseDomain}`);
  results.push(`https://www.${baseDomain}`);

  // If original domain was different from base, also try it
  if (domain !== baseDomain) {
    results.push(`https://${domain}`);
    results.push(`https://www.${domain}`);
  }

  return results;
}

// ============ STRATEGY 4: PATTERN-BASED URL GENERATION ============

/**
 * Generate many candidate URLs from district name + state.
 * Covers k12, schools, sd, isd, state-specific patterns.
 */
function generateCandidateUrls(districtName, state) {
  const candidates = [];
  const stateLC = (state || '').toLowerCase();
  if (!districtName || !stateLC) return candidates;

  // Multiple name normalizations
  const nameBase = districtName.toLowerCase()
    .replace(/school district/gi, '').replace(/unified/gi, '').replace(/independent/gi, '')
    .replace(/public schools/gi, '').replace(/county/gi, '').replace(/city/gi, '')
    .replace(/regional/gi, '').replace(/consolidated/gi, '').replace(/area/gi, '')
    .replace(/parish/gi, '').replace(/township/gi, '').replace(/borough/gi, '')
    .replace(/community/gi, '').replace(/central/gi, '').replace(/joint/gi, '')
    .replace(/schools$/gi, '').replace(/[^a-z0-9\s]/g, '').trim();

  const nameNoSpaces = nameBase.replace(/\s+/g, '');
  const nameHyphen = nameBase.replace(/\s+/g, '-');

  // Also try just the first word (for "Santa Ana" -> "santaana" AND "santa")
  const firstName = nameBase.split(/\s+/)[0];

  // k12 patterns (most common for US school districts)
  candidates.push(`https://www.${nameNoSpaces}.k12.${stateLC}.us`);
  candidates.push(`https://${nameNoSpaces}.k12.${stateLC}.us`);
  if (nameHyphen !== nameNoSpaces) {
    candidates.push(`https://www.${nameHyphen}.k12.${stateLC}.us`);
  }

  // schools patterns
  candidates.push(`https://www.${nameNoSpaces}schools.org`);
  candidates.push(`https://www.${nameNoSpaces}schools.com`);
  candidates.push(`https://${nameNoSpaces}schools.org`);
  candidates.push(`https://www.${nameNoSpaces}schools.net`);

  // Direct domain
  candidates.push(`https://www.${nameNoSpaces}.org`);
  candidates.push(`https://www.${nameNoSpaces}.com`);
  candidates.push(`https://www.${nameNoSpaces}.net`);
  candidates.push(`https://www.${nameNoSpaces}.us`);

  // SD suffix
  candidates.push(`https://www.${nameNoSpaces}sd.org`);
  candidates.push(`https://${nameNoSpaces}sd.org`);

  // PS suffix (public schools)
  candidates.push(`https://www.${nameNoSpaces}ps.org`);

  // State-specific patterns
  if (state === 'TX') {
    candidates.push(`https://www.${nameNoSpaces}isd.org`);
    candidates.push(`https://www.${nameNoSpaces}isd.net`);
    candidates.push(`https://www.${nameNoSpaces}isd.com`);
  }
  if (state === 'GA') {
    candidates.push(`https://www.${nameNoSpaces}county.schoolinsites.com`);
    candidates.push(`https://www.${nameNoSpaces}.schoolinsites.com`);
  }
  if (['NY', 'NJ', 'CT', 'MA', 'PA'].includes(state)) {
    candidates.push(`https://www.${nameNoSpaces}boe.org`);
  }

  // Try "district" suffix
  candidates.push(`https://www.${nameNoSpaces}district.org`);

  // Try abbreviated forms (first word + "sd", "schools")
  if (firstName.length >= 4 && firstName !== nameNoSpaces) {
    candidates.push(`https://www.${firstName}schools.org`);
    candidates.push(`https://www.${firstName}.k12.${stateLC}.us`);
    candidates.push(`https://${firstName}.k12.${stateLC}.us`);
  }

  return [...new Set(candidates)];
}

// ============ STRATEGY 5: DUCKDUCKGO SEARCH ============

/**
 * Search DuckDuckGo for a district's website.
 * Returns the first school-district-looking URL from results, or null.
 */
async function searchDuckDuckGo(districtName, state) {
  const query = encodeURIComponent(`"${districtName}" ${state} school district official website`);
  const ddgUrl = `https://html.duckduckgo.com/html/?q=${query}`;

  try {
    const response = await fetchUrl(ddgUrl, false, true, CONFIG.HTTP_CHECK_TIMEOUT_MS, true);
    if (!response.success || !response.data) return null;

    const html = response.data;

    // Parse result URLs from DDG HTML results
    // DDG HTML results have <a class="result__a" href="...">
    const resultRegex = /class="result__a"[^>]*href="([^"]+)"/gi;
    const urls = [];
    let match;
    while ((match = resultRegex.exec(html)) !== null) {
      let href = match[1];
      // DDG sometimes wraps URLs in redirects
      if (href.includes('uddg=')) {
        const uddgMatch = href.match(/uddg=([^&]+)/);
        if (uddgMatch) href = decodeURIComponent(uddgMatch[1]);
      }
      if (href.startsWith('http')) urls.push(href);
    }

    // Also try extracting from result__url spans
    const urlSpanRegex = /class="result__url"[^>]*>([^<]+)</gi;
    while ((match = urlSpanRegex.exec(html)) !== null) {
      let displayUrl = match[1].trim();
      if (!displayUrl.startsWith('http')) displayUrl = 'https://' + displayUrl;
      urls.push(displayUrl);
    }

    // Score and filter results - prefer school district domains
    const schoolPatterns = ['.k12.', 'schools.', 'school.', '.edu', 'sd.org', 'isd.', 'usd.',
      'district', 'boe.', '.us/', 'ps.org', '.org', '.net', '.com'];
    const blacklist = ['facebook.com', 'twitter.com', 'linkedin.com', 'youtube.com',
      'yelp.com', 'niche.com', 'greatschools.org', 'usnews.com', 'wikipedia.org',
      'indeed.com', 'glassdoor.com', 'salary.com', 'ziprecruiter.com'];

    for (const url of urls) {
      const urlLower = url.toLowerCase();
      // Skip blacklisted domains
      if (blacklist.some(b => urlLower.includes(b))) continue;
      // Prefer school-district-looking URLs
      if (schoolPatterns.some(p => urlLower.includes(p))) {
        // Extract just the base URL (no path)
        try {
          const parsed = new URL(url);
          return `${parsed.protocol}//${parsed.hostname}`;
        } catch (e) { continue; }
      }
    }

    // If no school-pattern match, return the first non-blacklisted result
    for (const url of urls) {
      const urlLower = url.toLowerCase();
      if (blacklist.some(b => urlLower.includes(b))) continue;
      try {
        const parsed = new URL(url);
        return `${parsed.protocol}//${parsed.hostname}`;
      } catch (e) { continue; }
    }

    return null;
  } catch (error) {
    return null;
  }
}

// ============ DNS + HTTP CHECKS ============

function checkDns(hostname) {
  return new Promise(resolve => {
    const timeout = setTimeout(() => resolve({ exists: false }), CONFIG.DNS_TIMEOUT_MS);
    dns.lookup(hostname, err => {
      clearTimeout(timeout);
      resolve(err ? { exists: false } : { exists: true });
    });
  });
}

async function quickHttpCheck(url) {
  return new Promise(resolve => {
    try {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;
      const req = protocol.request({
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: '/',
        method: 'HEAD',
        timeout: CONFIG.HTTP_CHECK_TIMEOUT_MS,
        rejectUnauthorized: false,
        headers: { 'User-Agent': getRandomUserAgent() }
      }, res => {
        // Accept 200, 301, 302 as "working" (redirects are fine)
        resolve({ ok: res.statusCode < 400, status: res.statusCode, redirectsTo: res.headers.location });
      });
      req.on('error', () => resolve({ ok: false }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false }); });
      req.end();
    } catch (e) { resolve({ ok: false }); }
  });
}

/**
 * Given a list of candidate URLs, find the first one that actually works.
 * Does DNS check first (fast), then HTTP check only on live domains.
 */
async function findFirstWorkingUrl(candidates) {
  // Deduplicate by domain to avoid checking the same domain multiple times
  const seenDomains = new Set();
  const dnsCache = new Map();

  for (const url of candidates) {
    let hostname;
    try { hostname = new URL(url).hostname; } catch (e) { continue; }

    const domainKey = hostname.toLowerCase();

    // DNS check (cached per hostname)
    if (!dnsCache.has(domainKey)) {
      const result = await checkDns(hostname);
      dnsCache.set(domainKey, result.exists);
    }
    if (!dnsCache.get(domainKey)) continue;

    // HTTP check
    const httpResult = await quickHttpCheck(url);
    if (httpResult.ok) {
      return { url, status: httpResult.status };
    }
    // If we get a redirect, that's also good - try following it
    if (httpResult.redirectsTo) {
      let redir = httpResult.redirectsTo;
      if (!redir.startsWith('http')) {
        try { redir = new URL(redir, url).href; } catch (e) { continue; }
      }
      const redirCheck = await quickHttpCheck(redir);
      if (redirCheck.ok) {
        return { url: redir, status: redirCheck.status };
      }
    }
  }
  return null;
}

// ============ STRATEGY 2: CROSS-REFERENCE + VARIANTS ============

/**
 * Generate all URL variations from all known sources for a district.
 * Each source URL gets www/non-www and http/https variants.
 */
function getAllUrlVariants(district) {
  const sourceUrls = new Set();

  // Collect all distinct URLs from all sources
  const rawUrls = [
    district.tried_url,
    district.supt_url,
    district.ccd_url,
    district.nces_domain,
    district.website_url
  ].filter(Boolean);

  for (const raw of rawUrls) {
    const normalized = normalizeUrl(raw);
    if (normalized) sourceUrls.add(normalized);
  }

  // For each source URL, generate 4 variants (www toggle + protocol toggle)
  const allVariants = [];
  for (const url of sourceUrls) {
    allVariants.push(url);
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname;
      const altHostname = hostname.startsWith('www.') ? hostname.replace('www.', '') : 'www.' + hostname;
      allVariants.push(`https://${hostname}`);
      allVariants.push(`https://${altHostname}`);
      allVariants.push(`http://${hostname}`);
      allVariants.push(`http://${altHostname}`);
    } catch (e) {}
  }

  return [...new Set(allVariants)];
}

// ============ THE 6-STRATEGY WATERFALL ============

/**
 * Aggressively discover a working URL for a district.
 * Tries 6 strategies in order, returns the first working URL.
 * Returns { url, strategy, details } or null.
 */
async function discoverWorkingUrl(district, noSearch = false) {
  // Strategy 1: Fix obvious URL errors
  const primaryUrl = normalizeUrl(district.website_url || district.tried_url);
  if (primaryUrl) {
    const fixed = fixObviousUrlErrors(primaryUrl);
    if (fixed.length > 0) {
      const result = await findFirstWorkingUrl(fixed);
      if (result) return { url: result.url, strategy: 'url_fix', details: `Fixed from ${primaryUrl}` };
    }
  }

  // Strategy 2: Cross-reference all URL sources + variants
  const allVariants = getAllUrlVariants(district);
  if (allVariants.length > 0) {
    const result = await findFirstWorkingUrl(allVariants);
    if (result) return { url: result.url, strategy: 'cross_reference', details: `From ${allVariants.length} variants` };
  }

  // Strategy 3: Email domain extraction
  const emails = [district.superintendent_email, district.administrator_email].filter(Boolean);
  const emailUrls = [];
  for (const email of emails) {
    emailUrls.push(...extractUrlsFromEmail(email));
  }
  if (emailUrls.length > 0) {
    const result = await findFirstWorkingUrl(emailUrls);
    if (result) return { url: result.url, strategy: 'email_domain', details: `From email: ${emails[0]}` };
  }

  // Strategy 4: Pattern-based URL generation
  const patternUrls = generateCandidateUrls(district.district_name, district.state);
  if (patternUrls.length > 0) {
    const result = await findFirstWorkingUrl(patternUrls);
    if (result) return { url: result.url, strategy: 'pattern_match', details: `From ${patternUrls.length} patterns` };
  }

  // Strategy 5: DuckDuckGo search
  if (!noSearch) {
    await sleep(CONFIG.DDG_RATE_LIMIT_MS); // Rate limit DDG
    const ddgUrl = await searchDuckDuckGo(district.district_name, district.state);
    if (ddgUrl) {
      const result = await findFirstWorkingUrl([ddgUrl, ddgUrl.replace('https://', 'https://www.')]);
      if (result) return { url: result.url, strategy: 'web_search', details: `DuckDuckGo result` };
    }
  }

  // Strategy 6: Error-specific last resort
  if (primaryUrl) {
    const errorMsg = (district.error_message || '').toLowerCase();

    // For timeouts: try with much longer timeout
    if (errorMsg.includes('timeout') || errorMsg.includes('etimedout')) {
      const longResult = await fetchUrl(primaryUrl, false, true, CONFIG.LONG_TIMEOUT_MS);
      if (longResult.success) return { url: primaryUrl, strategy: 'long_timeout', details: '45s timeout' };
    }

    // For SSL errors: force HTTP
    if (errorMsg.includes('ssl') || errorMsg.includes('cert') || errorMsg.includes('tls')) {
      const httpUrl = primaryUrl.replace('https://', 'http://');
      const httpResult = await fetchUrl(httpUrl, false, false, CONFIG.TIMEOUT_MS);
      if (httpResult.success) return { url: httpUrl, strategy: 'http_fallback', details: 'SSL bypass via HTTP' };
    }

    // For 403: try with full browser headers
    if (errorMsg.includes('403') || errorMsg.includes('forbidden')) {
      const browserResult = await fetchUrlBrowser(primaryUrl);
      if (browserResult.success) return { url: primaryUrl, strategy: 'browser_headers', details: 'Full browser headers' };
    }
  }

  return null;
}

// ============ HTTP FETCHING ============

function fetchUrl(url, isBinary = false, sslBypass = true, timeoutMs = CONFIG.TIMEOUT_MS, ddgMode = false) {
  return new Promise(resolve => {
    const startTime = Date.now();
    try {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const protocol = isHttps ? https : http;
      const headers = ddgMode
        ? { ...CONFIG.BROWSER_HEADERS, 'User-Agent': getRandomUserAgent() }
        : {
            'User-Agent': getRandomUserAgent(),
            'Accept': isBinary ? 'application/pdf,*/*' : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
          };
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET', headers, timeout: timeoutMs
      };
      if (sslBypass && isHttps) options.rejectUnauthorized = false;

      const request = protocol.request(options, response => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          let redirectUrl = response.headers.location;
          if (!redirectUrl.startsWith('http')) redirectUrl = new URL(redirectUrl, url).href;
          fetchUrl(redirectUrl, isBinary, sslBypass, timeoutMs, ddgMode).then(resolve);
          return;
        }
        if (response.statusCode !== 200) {
          resolve({ success: false, status: response.statusCode, error: `HTTP ${response.statusCode}`, responseTime: Date.now() - startTime });
          return;
        }
        const contentType = response.headers['content-type'] || '';
        const chunks = []; let totalLength = 0;
        response.on('data', chunk => { totalLength += chunk.length; if (totalLength <= CONFIG.MAX_CONTENT_LENGTH) chunks.push(chunk); });
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({ success: true, status: 200, contentType, data: isBinary ? buffer : buffer.toString('utf-8'), responseTime: Date.now() - startTime });
        });
        response.on('error', error => resolve({ success: false, error: error.message, responseTime: Date.now() - startTime }));
      });
      request.on('error', error => resolve({ success: false, error: error.message, responseTime: Date.now() - startTime }));
      request.on('timeout', () => { request.destroy(); resolve({ success: false, error: 'Timeout', responseTime: Date.now() - startTime }); });
      request.end();
    } catch (error) {
      resolve({ success: false, error: error.message, responseTime: Date.now() - startTime });
    }
  });
}

/**
 * Fetch with full browser-like headers (for 403 bypass)
 */
function fetchUrlBrowser(url) {
  return new Promise(resolve => {
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
        timeout: CONFIG.TIMEOUT_MS,
        rejectUnauthorized: false,
        headers: {
          ...CONFIG.BROWSER_HEADERS,
          'User-Agent': CONFIG.USER_AGENTS[0],
          'Referer': `https://www.google.com/search?q=${encodeURIComponent(parsedUrl.hostname)}`,
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'cross-site'
        }
      };
      const request = protocol.request(options, response => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          let redir = response.headers.location;
          if (!redir.startsWith('http')) redir = new URL(redir, url).href;
          fetchUrl(redir, false, true, CONFIG.TIMEOUT_MS).then(resolve);
          return;
        }
        if (response.statusCode !== 200) {
          resolve({ success: false, status: response.statusCode, error: `HTTP ${response.statusCode}`, responseTime: Date.now() - startTime });
          return;
        }
        const chunks = []; let totalLength = 0;
        response.on('data', chunk => { totalLength += chunk.length; if (totalLength <= CONFIG.MAX_CONTENT_LENGTH) chunks.push(chunk); });
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({ success: true, status: 200, contentType: response.headers['content-type'] || '', data: buffer.toString('utf-8'), responseTime: Date.now() - startTime });
        });
        response.on('error', error => resolve({ success: false, error: error.message, responseTime: Date.now() - startTime }));
      });
      request.on('error', error => resolve({ success: false, error: error.message, responseTime: Date.now() - startTime }));
      request.on('timeout', () => { request.destroy(); resolve({ success: false, error: 'Timeout', responseTime: Date.now() - startTime }); });
      request.end();
    } catch (error) {
      resolve({ success: false, error: error.message, responseTime: Date.now() - startTime });
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
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : null;
}

function extractLinks(html, baseUrl) {
  const links = { pdfs: [], internal: [] };
  if (!html) return links;
  let baseDomain;
  try { baseDomain = new URL(baseUrl).hostname; } catch (e) { return links; }
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match; const seen = new Set();
  while ((match = hrefRegex.exec(html)) !== null) {
    let href = match[1].trim();
    if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    let absoluteUrl;
    try { absoluteUrl = new URL(href, baseUrl).href; } catch (e) { continue; }
    if (seen.has(absoluteUrl)) continue;
    seen.add(absoluteUrl);
    const urlLower = absoluteUrl.toLowerCase();
    if (urlLower.endsWith('.pdf')) { links.pdfs.push(absoluteUrl); }
    else {
      try {
        const urlDomain = new URL(absoluteUrl).hostname;
        if (urlDomain === baseDomain || urlDomain.endsWith('.' + baseDomain)) links.internal.push(absoluteUrl);
      } catch (e) {}
    }
  }
  return links;
}

function scoreUrl(url) {
  const urlLower = url.toLowerCase();
  let score = 0;
  for (const kw of URL_PRIORITY_KEYWORDS) { if (urlLower.includes(kw)) score++; }
  if ((url.match(/\//g) || []).length - 2 <= 2) score++;
  return score;
}

function detectKeywords(text) {
  const found = [];
  const tl = (text || '').toLowerCase();
  for (const p of DISCOVERY_KEYWORDS) { if (p.test(tl)) { const m = tl.match(p); if (m) found.push(m[0]); } }
  return [...new Set(found)];
}

function categorizeDocument(url, text, keywords) {
  if (keywords.some(k => k.includes('portrait') || k.includes('graduate profile') || k.includes('learner profile'))) return 'portrait_of_graduate';
  if (keywords.some(k => k.includes('strategic'))) return 'strategic_plan';
  const u = url.toLowerCase();
  if (u.includes('portrait') || u.includes('graduate')) return 'portrait_of_graduate';
  if (u.includes('strategic') || u.includes('plan')) return 'strategic_plan';
  return 'other';
}

async function extractPdfText(buffer) {
  if (!pdfParse) return { success: false, error: 'pdf-parse not installed' };
  // Suppress pdf-parse warnings (they flood thousands of lines for some PDFs)
  const origWarn = console.warn;
  console.warn = () => {};
  try { const d = await pdfParse(buffer); console.warn = origWarn; return { success: true, text: d.text, pages: d.numpages }; }
  catch (e) { console.warn = origWarn; return { success: false, error: e.message }; }
}

// ============ CORE CRAWL LOGIC (with 6-strategy waterfall) ============

async function crawlDistrict(pool, district, batchId, config) {
  const logs = [];
  const documents = [];
  let discoveryResult = null;

  // Phase 1: Discover a working URL using the 6-strategy waterfall
  discoveryResult = await discoverWorkingUrl(district, config.noSearch);

  if (!discoveryResult) {
    // All 6 strategies failed
    const triedUrl = normalizeUrl(district.website_url || district.tried_url) || district.tried_url || 'unknown';
    logs.push({
      nces_id: district.nces_id, crawl_batch_id: batchId,
      url: triedUrl, url_type: 'homepage', status: 'failure',
      http_status: null, error_message: 'All 6 recovery strategies failed',
      content_type: null, extraction_success: false,
      keywords_found: [], response_time_ms: 0
    });
    return { logs, documents, skipped: false, strategy: null };
  }

  const baseUrl = discoveryResult.url;
  const strategy = discoveryResult.strategy;

  // Save URL correction if we discovered a different URL
  const originalUrl = normalizeUrl(district.tried_url || district.website_url);
  if (originalUrl && extractDomain(baseUrl) !== extractDomain(originalUrl)) {
    await saveUrlCorrection(pool, district.nces_id, originalUrl, baseUrl, strategy,
      { details: discoveryResult.details, district_name: district.district_name },
      strategy === 'web_search' ? 0.80 : strategy === 'email_domain' ? 0.90 : 0.85,
      null, true);
  }

  // Phase 2: Full crawl of the discovered URL
  const homepage = await fetchUrl(baseUrl, false, true, CONFIG.TIMEOUT_MS);

  if (!homepage.success) {
    logs.push({
      nces_id: district.nces_id, crawl_batch_id: batchId,
      url: baseUrl, url_type: 'homepage', status: 'failure',
      http_status: homepage.status, error_message: homepage.error,
      content_type: null, extraction_success: false,
      keywords_found: [], response_time_ms: homepage.responseTime
    });
    return { logs, documents, skipped: false, strategy };
  }

  // Process homepage
  const homepageText = extractTextFromHtml(homepage.data);
  const homepageTitle = extractTitle(homepage.data);
  const homepageKeywords = detectKeywords(homepageText);

  documents.push({
    nces_id: district.nces_id, document_url: baseUrl, document_type: 'html',
    document_title: homepageTitle,
    document_category: categorizeDocument(baseUrl, homepageText, homepageKeywords),
    extracted_text: homepageText.substring(0, 100000), text_length: homepageText.length,
    extraction_method: 'html_scrape', page_depth: 0, content_hash: hashContent(homepageText)
  });

  logs.push({
    nces_id: district.nces_id, crawl_batch_id: batchId,
    url: baseUrl, url_type: 'homepage', status: 'success',
    http_status: 200, error_message: null, content_type: homepage.contentType,
    extraction_success: true, keywords_found: homepageKeywords,
    response_time_ms: homepage.responseTime
  });

  // Extract and follow links
  const links = extractLinks(homepage.data, baseUrl);

  // Crawl PDFs
  const sortedPdfs = links.pdfs.map(u => ({ url: u, score: scoreUrl(u) })).sort((a, b) => b.score - a.score).slice(0, CONFIG.MAX_PDFS_PER_DISTRICT);
  for (const { url: pdfUrl } of sortedPdfs) {
    await sleep(CONFIG.RATE_LIMIT_MS);
    const resp = await fetchUrl(pdfUrl, true, true, CONFIG.TIMEOUT_MS);
    if (!resp.success) { logs.push({ nces_id: district.nces_id, crawl_batch_id: batchId, url: pdfUrl, url_type: 'pdf_link', status: 'failure', http_status: resp.status, error_message: resp.error, content_type: null, extraction_success: false, keywords_found: [], response_time_ms: resp.responseTime }); continue; }
    const pdfResult = await extractPdfText(resp.data);
    if (!pdfResult.success) { logs.push({ nces_id: district.nces_id, crawl_batch_id: batchId, url: pdfUrl, url_type: 'pdf_link', status: 'success', http_status: 200, error_message: null, content_type: resp.contentType, extraction_success: false, keywords_found: [], response_time_ms: resp.responseTime }); continue; }
    const pdfKw = detectKeywords(pdfResult.text);
    documents.push({ nces_id: district.nces_id, document_url: pdfUrl, document_type: 'pdf', document_title: pdfUrl.split('/').pop().replace('.pdf', ''), document_category: categorizeDocument(pdfUrl, pdfResult.text, pdfKw), extracted_text: pdfResult.text.substring(0, 100000), text_length: pdfResult.text.length, extraction_method: 'pdf_parse', page_depth: 1, content_hash: hashContent(pdfResult.text) });
    logs.push({ nces_id: district.nces_id, crawl_batch_id: batchId, url: pdfUrl, url_type: 'pdf_link', status: 'success', http_status: 200, error_message: null, content_type: resp.contentType, extraction_success: true, keywords_found: pdfKw, response_time_ms: resp.responseTime });
  }

  // Crawl internal pages
  const sortedPages = links.internal.map(u => ({ url: u, score: scoreUrl(u) })).sort((a, b) => b.score - a.score).slice(0, CONFIG.MAX_PAGES_PER_DISTRICT);
  for (const { url: pageUrl } of sortedPages) {
    await sleep(CONFIG.RATE_LIMIT_MS);
    const resp = await fetchUrl(pageUrl, false, true, CONFIG.TIMEOUT_MS);
    if (!resp.success) { logs.push({ nces_id: district.nces_id, crawl_batch_id: batchId, url: pageUrl, url_type: 'internal_link', status: 'failure', http_status: resp.status, error_message: resp.error, content_type: null, extraction_success: false, keywords_found: [], response_time_ms: resp.responseTime }); continue; }
    const pageText = extractTextFromHtml(resp.data);
    const pageTitle = extractTitle(resp.data);
    const pageKw = detectKeywords(pageText);
    documents.push({ nces_id: district.nces_id, document_url: pageUrl, document_type: 'html', document_title: pageTitle, document_category: categorizeDocument(pageUrl, pageText, pageKw), extracted_text: pageText.substring(0, 100000), text_length: pageText.length, extraction_method: 'html_scrape', page_depth: 1, content_hash: hashContent(pageText) });
    logs.push({ nces_id: district.nces_id, crawl_batch_id: batchId, url: pageUrl, url_type: 'internal_link', status: 'success', http_status: 200, error_message: null, content_type: resp.contentType, extraction_success: true, keywords_found: pageKw, response_time_ms: resp.responseTime });
  }

  return { logs, documents, skipped: false, strategy };
}

// ============ DATABASE OPS ============

async function saveResults(pool, logs, documents) {
  for (const doc of documents) {
    try {
      const cleanText = (doc.extracted_text || '').replace(/\0/g, '');
      await pool.query(`
        INSERT INTO district_documents (nces_id, document_url, document_type, document_title, document_category, extracted_text, text_length, extraction_method, page_depth, content_hash, discovered_at, last_crawled_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        ON CONFLICT (nces_id, document_url) DO UPDATE SET extracted_text = EXCLUDED.extracted_text, text_length = EXCLUDED.text_length, document_category = EXCLUDED.document_category, content_hash = EXCLUDED.content_hash, last_crawled_at = NOW()
      `, [doc.nces_id, doc.document_url, doc.document_type, doc.document_title, doc.document_category, cleanText, doc.text_length, doc.extraction_method, doc.page_depth, doc.content_hash]);
    } catch (error) {
      if (!error.message.includes('invalid byte sequence')) console.error(`    Error saving doc: ${error.message}`);
    }
  }
  for (const log of logs) {
    try {
      await pool.query(`
        INSERT INTO document_crawl_log (nces_id, crawl_batch_id, url, url_type, status, http_status, error_message, content_type, extraction_success, keywords_found, response_time_ms, crawled_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      `, [log.nces_id, log.crawl_batch_id, log.url, log.url_type, log.status, log.http_status, log.error_message, log.content_type, log.extraction_success, log.keywords_found, log.response_time_ms]);
    } catch (error) { /* skip */ }
  }
}

async function saveUrlCorrection(pool, ncesId, oldUrl, newUrl, method, details, confidence, httpStatus, validated) {
  try {
    await pool.query(`
      INSERT INTO url_corrections (nces_id, old_url, new_url, discovery_method, discovery_details, confidence, http_status, validated, corrected_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [ncesId, oldUrl, newUrl, method, JSON.stringify(details), confidence, httpStatus, validated]);
  } catch (error) { /* skip */ }
}

async function createAuditRecord(pool, mode, batchId) {
  try {
    await pool.query(`
      INSERT INTO data_imports (source_type, source_name, source_url, source_file, record_count, imported_by, notes, created_at)
      VALUES ($1, $2, $3, $4, 0, $5, $6, NOW())
    `, ['website_enrichment', 'district-recovery-pipeline', `batch://${batchId}`, 'district-recovery.js', 'district-recovery.js', `Recovery crawl mode: ${mode}`]);
  } catch (error) { console.log(`  Note: audit record issue: ${error.message}`); }
}

// ============ DISTRICT SELECTION QUERIES ============

async function getFailedWithUrl(pool, config) {
  let query = `
    WITH failed AS (
      SELECT DISTINCT ON (cl.nces_id) cl.nces_id, cl.url as tried_url, cl.error_message
      FROM document_crawl_log cl
      WHERE cl.status = 'failure'
        AND cl.nces_id IS NOT NULL
        AND cl.nces_id NOT IN (SELECT DISTINCT nces_id FROM district_documents)
      ORDER BY cl.nces_id, cl.crawled_at DESC
    )
    SELECT
      f.nces_id, d.name as district_name, d.state, f.tried_url, f.error_message,
      d.website_domain as nces_domain, c.website_url as ccd_url, sd.website_url as supt_url,
      sd.superintendent_email, s.administrator_email,
      d.enrollment, 'failed-retry' as recovery_mode
    FROM failed f
    JOIN districts d ON f.nces_id = d.nces_id
    LEFT JOIN superintendent_directory sd ON f.nces_id = sd.nces_id
    LEFT JOIN ccd_staff_data c ON f.nces_id = c.nces_id
    LEFT JOIN district_matches m ON f.nces_id = m.nces_id
    LEFT JOIN state_registry_districts s ON m.state_registry_id = s.id
  `;
  const params = [];
  if (config.state) { params.push(config.state); query += ` WHERE d.state = $${params.length}`; }
  query += ` ORDER BY d.enrollment DESC NULLS LAST`;
  if (config.limit) query += ` LIMIT ${config.limit}`;
  const result = await pool.query(query, params);

  return result.rows.map(r => {
    // Pick the best primary URL to try first
    const urls = [r.supt_url, r.ccd_url, r.nces_domain, r.tried_url].filter(Boolean);
    const bestUrl = urls.find(u => normalizeUrl(u)) || r.tried_url;
    return { ...r, website_url: normalizeUrl(bestUrl) || bestUrl };
  });
}

async function getNoUrlDistricts(pool, config) {
  let query = `
    SELECT d.nces_id, d.name as district_name, d.state, d.enrollment,
      s.administrator_email, sd.superintendent_email,
      'discover-urls' as recovery_mode
    FROM districts d
    LEFT JOIN ccd_staff_data c ON d.nces_id = c.nces_id
    LEFT JOIN superintendent_directory sd ON d.nces_id = sd.nces_id
    LEFT JOIN district_matches m ON d.nces_id = m.nces_id
    LEFT JOIN state_registry_districts s ON m.state_registry_id = s.id
    WHERE d.nces_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM document_crawl_log cl WHERE cl.nces_id = d.nces_id)
      AND NOT EXISTS (SELECT 1 FROM district_documents dd WHERE dd.nces_id = d.nces_id)
      AND (d.website_domain IS NULL OR d.website_domain = '' OR LENGTH(d.website_domain) <= 4 OR d.website_domain LIKE '%% %%')
      AND (c.website_url IS NULL OR c.website_url = '')
      AND (sd.website_url IS NULL OR sd.website_url = '')
  `;
  const params = [];
  if (config.state) { params.push(config.state); query += ` AND d.state = $${params.length}`; }
  query += ` ORDER BY d.enrollment DESC NULLS LAST`;
  if (config.limit) query += ` LIMIT ${config.limit}`;
  return (await pool.query(query, params)).rows;
}

async function getEmptyTextDistricts(pool, config) {
  let query = `
    SELECT DISTINCT ON (d.nces_id) d.nces_id, d2.name as district_name, d2.state,
      d.document_url as website_url, d.document_url as tried_url,
      d2.enrollment, sd.superintendent_email, s.administrator_email,
      d2.website_domain as nces_domain, c.website_url as ccd_url, sd.website_url as supt_url,
      'empty-text' as recovery_mode
    FROM district_documents d
    JOIN districts d2 ON d.nces_id = d2.nces_id
    LEFT JOIN superintendent_directory sd ON d.nces_id = sd.nces_id
    LEFT JOIN ccd_staff_data c ON d.nces_id = c.nces_id
    LEFT JOIN district_matches m ON d.nces_id = m.nces_id
    LEFT JOIN state_registry_districts s ON m.state_registry_id = s.id
    WHERE d.nces_id IS NOT NULL
      AND d.nces_id NOT IN (SELECT DISTINCT nces_id FROM district_documents WHERE text_length >= 100)
  `;
  const params = [];
  if (config.state) { params.push(config.state); query += ` AND d2.state = $${params.length}`; }
  query += ` ORDER BY d.nces_id, d.page_depth ASC`;
  if (config.limit) query += ` LIMIT ${config.limit}`;
  return (await pool.query(query, params)).rows;
}

// ============ MODE RUNNER ============

async function runMode(pool, modeName, districts, batchId, config) {
  if (districts.length === 0) {
    console.log(`\n  No districts found for mode: ${modeName}`);
    return { success: 0, failed: 0, skipped: 0, docs: 0, urlsDiscovered: 0, strategies: {} };
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`MODE: ${modeName.toUpperCase()} - ${districts.length} districts`);
  console.log(`${'='.repeat(60)}`);

  if (config.dryRun) {
    const byState = {};
    for (const d of districts) { byState[d.state] = (byState[d.state] || 0) + 1; }
    console.log('\n[DRY RUN] Would process:');
    Object.entries(byState).sort((a, b) => b[1] - a[1]).forEach(([state, count]) => console.log(`  ${state}: ${count}`));
    return { success: 0, failed: 0, skipped: 0, docs: 0, urlsDiscovered: 0, strategies: {} };
  }

  const stats = { success: 0, failed: 0, skipped: 0, docs: 0, urlsDiscovered: 0, strategies: {} };
  const totalBatches = Math.ceil(districts.length / config.concurrency);
  const startTime = Date.now();

  for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
    const batchStart = batchNum * config.concurrency;
    const batchEnd = Math.min(batchStart + config.concurrency, districts.length);
    const batch = districts.slice(batchStart, batchEnd);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const rate = (stats.success / Math.max(1, stats.success + stats.failed) * 100).toFixed(1);
    const docsPerDistrict = (stats.docs / Math.max(1, stats.success)).toFixed(1);
    console.log(`\n--- Batch ${batchNum + 1}/${totalBatches} | ${batchEnd}/${districts.length} | ${rate}% success (${stats.success}/${stats.success + stats.failed}) | ${stats.docs} docs | ${elapsed}s ---`);

    // Show strategy breakdown so far
    if (Object.keys(stats.strategies).length > 0 && batchNum % 3 === 0) {
      const strats = Object.entries(stats.strategies).sort((a, b) => b[1] - a[1]);
      console.log(`    Strategies: ${strats.map(([k, v]) => `${k}=${v}`).join(', ')}`);
    }

    const batchResults = await Promise.allSettled(
      batch.map(d => crawlDistrict(pool, d, batchId, config))
    );

    for (let i = 0; i < batchResults.length; i++) {
      const result = batchResults[i];
      if (result.status === 'fulfilled') {
        const { logs, documents, skipped, strategy } = result.value;
        if (skipped) { stats.skipped++; continue; }
        await saveResults(pool, logs, documents);
        stats.docs += documents.length;
        const success = logs.find(l => l.url_type === 'homepage' && l.status === 'success');
        if (success) {
          stats.success++;
          if (strategy) stats.strategies[strategy] = (stats.strategies[strategy] || 0) + 1;
        } else {
          stats.failed++;
        }
      } else {
        stats.failed++;
      }
    }

    if (batchNum < totalBatches - 1) await sleep(CONFIG.RATE_LIMIT_MS);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  const rate = (stats.success / Math.max(1, stats.success + stats.failed) * 100).toFixed(1);
  console.log(`\n  ${modeName} complete: ${stats.success} succeeded (${rate}%), ${stats.failed} failed, ${stats.docs} docs in ${elapsed}s`);
  if (Object.keys(stats.strategies).length > 0) {
    console.log('  Recovery strategy breakdown:');
    Object.entries(stats.strategies).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
      console.log(`    ${k}: ${v} districts`);
    });
  }

  return stats;
}

// ============ MAIN ============

async function main() {
  const config = parseArgs();
  const validModes = ['failed-retry', 'discover-urls', 'empty-text', 'all'];
  if (!validModes.includes(config.mode)) {
    console.error(`Invalid mode: ${config.mode}. Use: ${validModes.join(', ')}`);
    process.exit(1);
  }

  const pool = new Pool({ connectionString: DATABASE_URL, max: CONFIG.POOL_SIZE });

  console.log('=== District Recovery Pipeline (6-Strategy Waterfall) ===\n');
  console.log('Configuration:');
  console.log(`  Mode: ${config.mode}`);
  console.log(`  Concurrency: ${config.concurrency}`);
  console.log(`  State filter: ${config.state || 'All'}`);
  console.log(`  Limit: ${config.limit || 'None'}`);
  console.log(`  DuckDuckGo search: ${config.noSearch ? 'DISABLED' : 'Enabled'}`);
  console.log(`  PDF extraction: ${pdfParse ? 'Enabled' : 'Disabled'}`);

  const batchIdResult = await pool.query('SELECT gen_random_uuid() as id');
  const batchId = batchIdResult.rows[0].id;
  console.log(`  Batch ID: ${batchId}\n`);

  await createAuditRecord(pool, config.mode, batchId);

  console.log('Recovery strategies (in order):');
  console.log('  1. Fix obvious URL errors (typos, missing TLDs, mail prefixes)');
  console.log('  2. Cross-reference all URL sources with variants');
  console.log('  3. Email domain extraction');
  console.log('  4. Pattern-based URL generation + DNS check');
  console.log(`  5. DuckDuckGo web search${config.noSearch ? ' [DISABLED]' : ''}`);
  console.log('  6. Error-specific retry (long timeout, HTTP fallback, browser headers)');

  const allStats = { success: 0, failed: 0, skipped: 0, docs: 0, urlsDiscovered: 0, strategies: {} };

  const modes = config.mode === 'all'
    ? ['failed-retry', 'discover-urls', 'empty-text']
    : [config.mode];

  for (const mode of modes) {
    let districts;
    console.log(`\nFetching districts for mode: ${mode}...`);

    switch (mode) {
      case 'failed-retry': districts = await getFailedWithUrl(pool, config); break;
      case 'discover-urls': districts = await getNoUrlDistricts(pool, config); break;
      case 'empty-text': districts = await getEmptyTextDistricts(pool, config); break;
    }

    console.log(`Found ${districts.length} districts`);
    const modeStats = await runMode(pool, mode, districts, batchId, config);

    allStats.success += modeStats.success;
    allStats.failed += modeStats.failed;
    allStats.skipped += modeStats.skipped;
    allStats.docs += modeStats.docs;
    for (const [k, v] of Object.entries(modeStats.strategies || {})) {
      allStats.strategies[k] = (allStats.strategies[k] || 0) + v;
    }
  }

  // Final summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('RECOVERY PIPELINE COMPLETE');
  console.log(`${'='.repeat(60)}`);
  console.log(`  Modes run: ${modes.join(', ')}`);
  console.log(`  Districts succeeded: ${allStats.success}`);
  console.log(`  Districts failed: ${allStats.failed}`);
  console.log(`  Districts skipped: ${allStats.skipped}`);
  console.log(`  Total documents: ${allStats.docs}`);
  console.log(`  Success rate: ${((allStats.success / Math.max(1, allStats.success + allStats.failed)) * 100).toFixed(1)}%`);

  if (Object.keys(allStats.strategies).length > 0) {
    console.log('\n  Recovery strategy breakdown (what worked):');
    Object.entries(allStats.strategies).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
      console.log(`    ${k}: ${v} districts`);
    });
  }

  try {
    const totals = await pool.query(`SELECT COUNT(DISTINCT nces_id) as d, COUNT(*) as t FROM district_documents`);
    const corrections = await pool.query('SELECT COUNT(*) as cnt FROM url_corrections WHERE validated = true');
    console.log(`\n  Database totals after recovery:`);
    console.log(`    Districts with documents: ${totals.rows[0].d}`);
    console.log(`    Total documents: ${totals.rows[0].t}`);
    console.log(`    URL corrections (validated): ${corrections.rows[0].cnt}`);
  } catch (e) {}

  console.log(`\n  Batch ID: ${batchId}`);
  await pool.end();
}

main().catch(console.error);
