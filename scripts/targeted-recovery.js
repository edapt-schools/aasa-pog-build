/**
 * Targeted Recovery - Move 2 (Puppeteer 403s) & Move 3 (NYC Geographic Districts)
 *
 * Usage:
 *   node scripts/targeted-recovery.js --mode nyc         # Move 3: NYC districts
 *   node scripts/targeted-recovery.js --mode puppeteer   # Move 2: 403-blocked districts
 *   node scripts/targeted-recovery.js --mode all         # Both
 */

const { Pool } = require('pg');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');

let pdfParse;
try { pdfParse = require('pdf-parse'); } catch (e) {}

let puppeteer;
try { puppeteer = require('puppeteer'); } catch (e) {
  console.log('Warning: puppeteer not installed. 403 recovery disabled.');
}

const DATABASE_URL = 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';

const DISCOVERY_KEYWORDS = [
  /portrait\s+of\s+(a\s+)?graduate/i, /graduate\s+profile/i, /learner\s+profile/i,
  /strategic\s+plan/i, /strategic\s+priorities/i, /community\s+compass/i,
  /measure\s+what\s+matters/i, /capstone/i, /cornerstone/i
];

const URL_PRIORITY_KEYWORDS = [
  'portrait', 'graduate', 'strategic', 'plan', 'vision', 'mission',
  'about', 'district', 'superintendent', 'board', 'leadership'
];

// ============ UTILITIES ============

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function hashContent(t) { return crypto.createHash('sha256').update(t || '').digest('hex'); }

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
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : null;
}

function extractLinks(html, baseUrl) {
  const links = { pdfs: [], internal: [] };
  if (!html) return links;
  let baseDomain;
  try { baseDomain = new URL(baseUrl).hostname; } catch (e) { return links; }
  const re = /href=["']([^"']+)["']/gi;
  let m; const seen = new Set();
  while ((m = re.exec(html)) !== null) {
    let href = m[1].trim();
    if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;
    let abs;
    try { abs = new URL(href, baseUrl).href; } catch (e) { continue; }
    if (seen.has(abs)) continue;
    seen.add(abs);
    if (abs.toLowerCase().endsWith('.pdf')) links.pdfs.push(abs);
    else {
      try {
        const d = new URL(abs).hostname;
        if (d === baseDomain || d.endsWith('.' + baseDomain)) links.internal.push(abs);
      } catch (e) {}
    }
  }
  return links;
}

function scoreUrl(url) {
  const u = url.toLowerCase();
  let s = 0;
  for (const kw of URL_PRIORITY_KEYWORDS) { if (u.includes(kw)) s++; }
  if ((url.match(/\//g) || []).length - 2 <= 2) s++;
  return s;
}

function detectKeywords(text) {
  const found = [];
  const t = (text || '').toLowerCase();
  for (const p of DISCOVERY_KEYWORDS) { if (p.test(t)) { const m = t.match(p); if (m) found.push(m[0]); } }
  return [...new Set(found)];
}

function categorizeDocument(url, text, keywords) {
  if (keywords.some(k => k.includes('portrait') || k.includes('graduate') || k.includes('learner'))) return 'portrait_of_graduate';
  if (keywords.some(k => k.includes('strategic'))) return 'strategic_plan';
  const u = url.toLowerCase();
  if (u.includes('portrait') || u.includes('graduate')) return 'portrait_of_graduate';
  if (u.includes('strategic') || u.includes('plan')) return 'strategic_plan';
  return 'other';
}

async function extractPdfText(buffer) {
  if (!pdfParse) return { success: false };
  const origWarn = console.warn;
  console.warn = () => {};
  try { const d = await pdfParse(buffer); console.warn = origWarn; return { success: true, text: d.text, pages: d.numpages }; }
  catch (e) { console.warn = origWarn; return { success: false }; }
}

function fetchUrl(url, isBinary = false) {
  return new Promise(resolve => {
    const start = Date.now();
    try {
      const p = new URL(url);
      const proto = p.protocol === 'https:' ? https : http;
      const req = proto.request({
        hostname: p.hostname, port: p.port || (p.protocol === 'https:' ? 443 : 80),
        path: p.pathname + p.search, method: 'GET', timeout: 20000,
        rejectUnauthorized: false,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': isBinary ? 'application/pdf,*/*' : 'text/html,application/xhtml+xml,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let redir = res.headers.location;
          if (!redir.startsWith('http')) redir = new URL(redir, url).href;
          fetchUrl(redir, isBinary).then(resolve);
          return;
        }
        if (res.statusCode !== 200) {
          resolve({ success: false, status: res.statusCode, error: `HTTP ${res.statusCode}`, time: Date.now() - start });
          return;
        }
        const chunks = []; let len = 0;
        res.on('data', c => { len += c.length; if (len <= 10*1024*1024) chunks.push(c); });
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          resolve({ success: true, status: 200, contentType: res.headers['content-type']||'', data: isBinary ? buf : buf.toString('utf-8'), time: Date.now() - start });
        });
        res.on('error', e => resolve({ success: false, error: e.message, time: Date.now() - start }));
      });
      req.on('error', e => resolve({ success: false, error: e.message, time: Date.now() - start }));
      req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'Timeout', time: Date.now() - start }); });
      req.end();
    } catch (e) { resolve({ success: false, error: e.message, time: Date.now() - start }); }
  });
}

// ============ DB OPERATIONS ============

async function saveDoc(pool, doc) {
  try {
    const cleanText = (doc.extracted_text || '').replace(/\0/g, '');
    await pool.query(`
      INSERT INTO district_documents (nces_id, document_url, document_type, document_title, document_category, extracted_text, text_length, extraction_method, page_depth, content_hash, discovered_at, last_crawled_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
      ON CONFLICT (nces_id, document_url) DO UPDATE SET extracted_text=EXCLUDED.extracted_text, text_length=EXCLUDED.text_length, content_hash=EXCLUDED.content_hash, last_crawled_at=NOW()
    `, [doc.nces_id, doc.document_url, doc.document_type, doc.document_title, doc.document_category, cleanText, doc.text_length, doc.extraction_method, doc.page_depth, doc.content_hash]);
    return true;
  } catch (e) { return false; }
}

async function logCrawl(pool, nces_id, batchId, url, urlType, status, httpStatus, error, contentType, extractionSuccess, keywords, responseTime) {
  try {
    await pool.query(`
      INSERT INTO document_crawl_log (nces_id, crawl_batch_id, url, url_type, status, http_status, error_message, content_type, extraction_success, keywords_found, response_time_ms, crawled_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
    `, [nces_id, batchId, url, urlType, status, httpStatus, error, contentType, extractionSuccess, keywords, responseTime]);
  } catch (e) {}
}

async function saveUrlCorrection(pool, ncesId, oldUrl, newUrl, method, details) {
  try {
    await pool.query(`
      INSERT INTO url_corrections (nces_id, old_url, new_url, discovery_method, discovery_details, confidence, validated, corrected_at)
      VALUES ($1,$2,$3,$4,$5,0.95,true,NOW())
    `, [ncesId, oldUrl, newUrl, method, JSON.stringify(details)]);
  } catch (e) {}
}

// ============ MOVE 3: NYC GEOGRAPHIC DISTRICTS ============

async function runNycRecovery(pool, batchId) {
  console.log('\n=== MOVE 3: NYC Geographic Districts ===\n');

  // Get all NYC Geographic Districts without docs
  const nycDistricts = await pool.query(`
    SELECT d.nces_id, d.name, d.enrollment
    FROM districts d
    WHERE d.name LIKE 'NEW YORK CITY GEOGRAPHIC%'
      AND d.nces_id IS NOT NULL
      AND d.nces_id NOT IN (SELECT DISTINCT nces_id FROM district_documents)
    ORDER BY d.enrollment DESC
  `);

  console.log(`Found ${nycDistricts.rows.length} NYC Geographic Districts without docs`);
  if (nycDistricts.rows.length === 0) return { success: 0, docs: 0 };

  // Crawl schools.nyc.gov once
  const nycUrl = 'https://www.schools.nyc.gov';
  console.log(`Crawling ${nycUrl}...`);
  const homepage = await fetchUrl(nycUrl);

  if (!homepage.success) {
    console.log(`  Failed to fetch schools.nyc.gov: ${homepage.error}`);
    return { success: 0, docs: 0 };
  }

  const homepageText = extractTextFromHtml(homepage.data);
  const homepageTitle = extractTitle(homepage.data);
  const homepageKeywords = detectKeywords(homepageText);
  console.log(`  Homepage: ${homepageText.length} chars, title: "${homepageTitle}"`);

  // Extract and crawl key internal pages
  const links = extractLinks(homepage.data, nycUrl);
  const sortedPages = links.internal
    .map(u => ({ url: u, score: scoreUrl(u) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const allDocs = [{
    url: nycUrl,
    type: 'html',
    title: homepageTitle,
    text: homepageText,
    keywords: homepageKeywords,
    depth: 0
  }];

  for (const { url: pageUrl } of sortedPages) {
    await sleep(300);
    const resp = await fetchUrl(pageUrl);
    if (!resp.success) continue;
    const text = extractTextFromHtml(resp.data);
    if (text.length < 50) continue;
    allDocs.push({
      url: pageUrl, type: 'html', title: extractTitle(resp.data),
      text, keywords: detectKeywords(text), depth: 1
    });
  }

  // Crawl PDFs
  const pdfs = links.pdfs.map(u => ({ url: u, score: scoreUrl(u) }))
    .sort((a, b) => b.score - a.score).slice(0, 10);

  for (const { url: pdfUrl } of pdfs) {
    await sleep(300);
    const resp = await fetchUrl(pdfUrl, true);
    if (!resp.success) continue;
    const result = await extractPdfText(resp.data);
    if (!result.success) continue;
    allDocs.push({
      url: pdfUrl, type: 'pdf', title: pdfUrl.split('/').pop().replace('.pdf', ''),
      text: result.text, keywords: detectKeywords(result.text), depth: 1
    });
  }

  console.log(`  Collected ${allDocs.length} documents from schools.nyc.gov`);

  // Attribute all docs to each NYC Geographic District
  let totalSaved = 0;
  for (const district of nycDistricts.rows) {
    let saved = 0;
    for (const doc of allDocs) {
      const ok = await saveDoc(pool, {
        nces_id: district.nces_id,
        document_url: doc.url,
        document_type: doc.type,
        document_title: doc.title,
        document_category: categorizeDocument(doc.url, doc.text, doc.keywords),
        extracted_text: doc.text.substring(0, 100000),
        text_length: doc.text.length,
        extraction_method: doc.type === 'pdf' ? 'pdf_parse' : 'html_scrape',
        page_depth: doc.depth,
        content_hash: hashContent(doc.text)
      });
      if (ok) saved++;
    }

    await logCrawl(pool, district.nces_id, batchId, nycUrl, 'homepage', 'success', 200, null, 'text/html', true, homepageKeywords, homepage.time);
    await saveUrlCorrection(pool, district.nces_id, null, nycUrl, 'nyc_geographic', { reason: 'NYC DOE administrative subdivision, shares schools.nyc.gov' });
    totalSaved += saved;
    console.log(`  ${district.name} (${district.enrollment} students): ${saved} docs attributed`);
  }

  console.log(`\n  NYC recovery complete: ${nycDistricts.rows.length} districts, ${totalSaved} total doc records`);
  return { success: nycDistricts.rows.length, docs: totalSaved };
}

// ============ MOVE 2: PUPPETEER 403 RECOVERY ============

async function runPuppeteerRecovery(pool, batchId) {
  console.log('\n=== MOVE 2: Puppeteer 403 Recovery ===\n');

  if (!puppeteer) {
    console.log('  Puppeteer not installed. Run: npm install puppeteer');
    return { success: 0, failed: 0, docs: 0 };
  }

  // Get 403-blocked districts
  const blocked = await pool.query(`
    WITH latest_fail AS (
      SELECT DISTINCT ON (cl.nces_id) cl.nces_id, cl.url, cl.error_message
      FROM document_crawl_log cl
      WHERE cl.status = 'failure'
        AND (cl.error_message LIKE '%403%' OR cl.error_message LIKE '%forbidden%' OR cl.error_message LIKE '%Forbidden%')
        AND cl.nces_id NOT IN (SELECT DISTINCT nces_id FROM district_documents)
      ORDER BY cl.nces_id, cl.crawled_at DESC
    )
    SELECT f.nces_id, f.url as tried_url, d.name, d.state, d.enrollment,
      d.website_domain, sd.website_url as supt_url, c.website_url as ccd_url
    FROM latest_fail f
    JOIN districts d ON f.nces_id = d.nces_id
    LEFT JOIN superintendent_directory sd ON f.nces_id = sd.nces_id
    LEFT JOIN ccd_staff_data c ON f.nces_id = c.nces_id
    ORDER BY d.enrollment DESC NULLS LAST
  `);

  console.log(`Found ${blocked.rows.length} 403-blocked districts`);
  if (blocked.rows.length === 0) return { success: 0, failed: 0, docs: 0 };

  // Launch browser
  console.log('Launching headless Chrome...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    timeout: 30000
  });

  const stats = { success: 0, failed: 0, docs: 0 };

  for (let i = 0; i < blocked.rows.length; i++) {
    const district = blocked.rows[i];
    // Determine best URL to try
    const urls = [district.tried_url, district.supt_url, district.ccd_url, district.website_domain]
      .filter(Boolean)
      .map(u => u.startsWith('http') ? u : 'https://' + u);
    const uniqueUrls = [...new Set(urls)];

    console.log(`\n  [${i+1}/${blocked.rows.length}] ${district.state} | ${district.name} (${district.enrollment || '?'} students)`);

    let succeeded = false;

    for (const baseUrl of uniqueUrls) {
      if (succeeded) break;

      let page;
      try {
        page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        });

        // Navigate with timeout
        const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
        const status = response ? response.status() : 0;

        if (status >= 400) {
          console.log(`    ${baseUrl} -> HTTP ${status} (still blocked)`);
          await page.close();
          continue;
        }

        // Wait a moment for JS to render
        await sleep(2000);

        // Get the rendered HTML
        const html = await page.content();
        const finalUrl = page.url();
        const homepageText = extractTextFromHtml(html);
        const homepageTitle = extractTitle(html);
        const homepageKeywords = detectKeywords(homepageText);

        if (homepageText.length < 50) {
          console.log(`    ${baseUrl} -> too little text (${homepageText.length} chars)`);
          await page.close();
          continue;
        }

        // Save homepage
        await saveDoc(pool, {
          nces_id: district.nces_id, document_url: finalUrl, document_type: 'html',
          document_title: homepageTitle,
          document_category: categorizeDocument(finalUrl, homepageText, homepageKeywords),
          extracted_text: homepageText.substring(0, 100000), text_length: homepageText.length,
          extraction_method: 'puppeteer_scrape', page_depth: 0, content_hash: hashContent(homepageText)
        });

        await logCrawl(pool, district.nces_id, batchId, finalUrl, 'homepage', 'success', status, null, 'text/html', true, homepageKeywords, 0);

        // Save URL correction if different from tried
        if (finalUrl !== district.tried_url) {
          await saveUrlCorrection(pool, district.nces_id, district.tried_url, finalUrl, 'puppeteer_403', { original_error: '403 Forbidden' });
        }

        let docCount = 1;

        // Extract links and crawl internal pages (using Puppeteer for same-domain)
        const links = extractLinks(html, finalUrl);
        const topPages = links.internal
          .map(u => ({ url: u, score: scoreUrl(u) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 8);

        for (const { url: pageUrl } of topPages) {
          try {
            await sleep(500);
            const pageResp = await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            if (!pageResp || pageResp.status() >= 400) continue;
            await sleep(1000);
            const pageHtml = await page.content();
            const pageText = extractTextFromHtml(pageHtml);
            if (pageText.length < 50) continue;
            const pageTitle = extractTitle(pageHtml);
            const pageKw = detectKeywords(pageText);
            await saveDoc(pool, {
              nces_id: district.nces_id, document_url: pageUrl, document_type: 'html',
              document_title: pageTitle,
              document_category: categorizeDocument(pageUrl, pageText, pageKw),
              extracted_text: pageText.substring(0, 100000), text_length: pageText.length,
              extraction_method: 'puppeteer_scrape', page_depth: 1, content_hash: hashContent(pageText)
            });
            await logCrawl(pool, district.nces_id, batchId, pageUrl, 'internal_link', 'success', 200, null, 'text/html', true, pageKw, 0);
            docCount++;
          } catch (e) {
            // Page navigation failed, skip
          }
        }

        // Try PDFs with regular fetch (PDFs usually aren't 403-blocked)
        for (const pdfUrl of links.pdfs.slice(0, 5)) {
          const pdfResp = await fetchUrl(pdfUrl, true);
          if (!pdfResp.success) continue;
          const pdfResult = await extractPdfText(pdfResp.data);
          if (!pdfResult.success) continue;
          const pdfKw = detectKeywords(pdfResult.text);
          await saveDoc(pool, {
            nces_id: district.nces_id, document_url: pdfUrl, document_type: 'pdf',
            document_title: pdfUrl.split('/').pop().replace('.pdf', ''),
            document_category: categorizeDocument(pdfUrl, pdfResult.text, pdfKw),
            extracted_text: pdfResult.text.substring(0, 100000), text_length: pdfResult.text.length,
            extraction_method: 'pdf_parse', page_depth: 1, content_hash: hashContent(pdfResult.text)
          });
          docCount++;
        }

        console.log(`    SUCCESS: ${finalUrl} -> ${docCount} docs, ${homepageText.length} chars`);
        stats.success++;
        stats.docs += docCount;
        succeeded = true;

        await page.close();
      } catch (error) {
        console.log(`    ${baseUrl} -> Error: ${error.message.substring(0, 60)}`);
        try { if (page) await page.close(); } catch (e) {}
      }
    }

    if (!succeeded) {
      console.log(`    FAILED: all URLs returned errors`);
      stats.failed++;
      await logCrawl(pool, district.nces_id, batchId, uniqueUrls[0] || 'unknown', 'homepage', 'failure', 403, 'Puppeteer also blocked', null, false, [], 0);
    }
  }

  await browser.close();
  console.log(`\n  Puppeteer recovery complete: ${stats.success} succeeded, ${stats.failed} failed, ${stats.docs} docs`);
  return stats;
}

// ============ MAIN ============

async function main() {
  const mode = (process.argv.find(a => a === '--mode') ? process.argv[process.argv.indexOf('--mode') + 1] : 'all').toLowerCase();
  const pool = new Pool({ connectionString: DATABASE_URL, max: 10 });

  console.log('=== Targeted Recovery Pipeline ===');
  console.log(`Mode: ${mode}\n`);

  const batchIdResult = await pool.query('SELECT gen_random_uuid() as id');
  const batchId = batchIdResult.rows[0].id;

  // Audit record
  try {
    await pool.query(`
      INSERT INTO data_imports (source_type, source_name, source_url, source_file, record_count, imported_by, notes, created_at)
      VALUES ('website_enrichment', 'targeted-recovery', $1, 'targeted-recovery.js', 0, 'targeted-recovery.js', $2, NOW())
    `, [`batch://${batchId}`, `Targeted recovery mode: ${mode}`]);
  } catch (e) {}

  const results = { nyc: null, puppeteer: null };

  if (mode === 'nyc' || mode === 'all') {
    results.nyc = await runNycRecovery(pool, batchId);
  }

  if (mode === 'puppeteer' || mode === 'all') {
    results.puppeteer = await runPuppeteerRecovery(pool, batchId);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TARGETED RECOVERY COMPLETE');
  console.log('='.repeat(60));
  if (results.nyc) console.log(`  NYC districts: ${results.nyc.success} recovered, ${results.nyc.docs} docs`);
  if (results.puppeteer) console.log(`  Puppeteer 403: ${results.puppeteer.success} recovered, ${results.puppeteer.failed} failed, ${results.puppeteer.docs} docs`);

  // Updated totals
  try {
    const totals = await pool.query('SELECT COUNT(DISTINCT nces_id) as d, COUNT(*) as t FROM district_documents');
    console.log(`\n  Database totals:`);
    console.log(`    Districts with documents: ${totals.rows[0].d}`);
    console.log(`    Total documents: ${totals.rows[0].t}`);
  } catch (e) {}

  await pool.end();
}

main().catch(console.error);
