/**
 * Reprocess PDFs
 *
 * Retroactively extracts text from PDFs that were fetched but not extracted
 * due to the pdf-parse v2.x API incompatibility bug.
 *
 * Finds all PDF URLs in document_crawl_log where:
 *   - url_type = 'pdf_link'
 *   - status = 'success' (HTTP 200)
 *   - extraction_success = false
 *
 * Re-fetches each PDF, extracts text, and stores in district_documents.
 *
 * Usage:
 *   node scripts/reprocess-pdfs.js
 */

const { Client } = require('pg');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');
const pdfParse = require('pdf-parse');

const DATABASE_URL = 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';

const CONFIG = {
  RATE_LIMIT_MS: 500,
  TIMEOUT_MS: 30000,
  MAX_CONTENT_LENGTH: 20 * 1024 * 1024, // 20MB max
  USER_AGENT: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AASA-Research/1.0'
};

// Keywords for categorization
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function hashContent(text) {
  return crypto.createHash('sha256').update(text || '').digest('hex');
}

// Fetch PDF as buffer
function fetchPdf(url) {
  return new Promise((resolve) => {
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
          'Accept': 'application/pdf,*/*'
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
          fetchPdf(redirectUrl).then(resolve);
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

        const chunks = [];
        let totalLength = 0;

        response.on('data', (chunk) => {
          totalLength += chunk.length;
          if (totalLength <= CONFIG.MAX_CONTENT_LENGTH) {
            chunks.push(chunk);
          }
        });

        response.on('end', () => {
          resolve({
            success: true,
            status: 200,
            data: Buffer.concat(chunks),
            contentType: response.headers['content-type'],
            responseTime: Date.now() - startTime
          });
        });

        response.on('error', (error) => {
          resolve({
            success: false,
            error: error.message,
            responseTime: Date.now() - startTime
          });
        });
      });

      request.on('error', (error) => {
        resolve({
          success: false,
          error: error.message,
          responseTime: Date.now() - startTime
        });
      });

      request.on('timeout', () => {
        request.destroy();
        resolve({
          success: false,
          error: 'Timeout',
          responseTime: Date.now() - startTime
        });
      });

      request.end();
    } catch (error) {
      resolve({
        success: false,
        error: error.message,
        responseTime: Date.now() - startTime
      });
    }
  });
}

// Extract text from PDF buffer
async function extractPdfText(buffer) {
  try {
    const data = await pdfParse(buffer);
    return {
      success: true,
      text: data.text,
      pages: data.numpages
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Detect keywords in text
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

// Categorize document
function categorizeDocument(url, text, keywords) {
  const urlLower = url.toLowerCase();

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

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  console.log('=== PDF Reprocessor ===\n');
  console.log('Finding PDFs that need reprocessing...\n');

  // Find all failed PDF extractions
  const failedPdfs = await client.query(`
    SELECT DISTINCT ON (url)
      id, nces_id, url, crawl_batch_id
    FROM document_crawl_log
    WHERE url_type = 'pdf_link'
      AND status = 'success'
      AND (extraction_success = false OR extraction_success IS NULL)
    ORDER BY url, crawled_at DESC
  `);

  console.log(`Found ${failedPdfs.rows.length} PDFs to reprocess\n`);

  if (failedPdfs.rows.length === 0) {
    console.log('No PDFs need reprocessing.');
    await client.end();
    return;
  }

  // Stats
  const stats = {
    total: failedPdfs.rows.length,
    fetched: 0,
    extracted: 0,
    stored: 0,
    failed: 0,
    keywordsFound: 0
  };

  // Process each PDF
  for (let i = 0; i < failedPdfs.rows.length; i++) {
    const pdf = failedPdfs.rows[i];

    if ((i + 1) % 10 === 0) {
      console.log(`Progress: ${i + 1}/${stats.total}`);
    }

    // Fetch PDF
    const response = await fetchPdf(pdf.url);

    if (!response.success) {
      console.log(`  ✗ Fetch failed: ${pdf.url.substring(0, 60)}... - ${response.error}`);
      stats.failed++;
      await sleep(CONFIG.RATE_LIMIT_MS);
      continue;
    }

    stats.fetched++;

    // Check if it's actually a PDF
    if (!response.contentType || !response.contentType.includes('pdf')) {
      console.log(`  ✗ Not a PDF: ${pdf.url.substring(0, 60)}... - ${response.contentType}`);
      stats.failed++;
      await sleep(CONFIG.RATE_LIMIT_MS);
      continue;
    }

    // Extract text
    const extraction = await extractPdfText(response.data);

    if (!extraction.success) {
      console.log(`  ✗ Extract failed: ${pdf.url.substring(0, 60)}... - ${extraction.error}`);
      stats.failed++;
      await sleep(CONFIG.RATE_LIMIT_MS);
      continue;
    }

    stats.extracted++;

    // Detect keywords
    const keywords = detectKeywords(extraction.text);
    if (keywords.length > 0) {
      stats.keywordsFound++;
    }

    const category = categorizeDocument(pdf.url, extraction.text, keywords);
    const contentHash = hashContent(extraction.text);
    const title = pdf.url.split('/').pop().replace('.pdf', '').replace(/-/g, ' ').replace(/_/g, ' ');

    // Insert into district_documents
    try {
      await client.query(`
        INSERT INTO district_documents
        (nces_id, document_url, document_type, document_title, document_category,
         extracted_text, text_length, extraction_method, page_depth, content_hash,
         discovered_at, last_crawled_at)
        VALUES ($1, $2, 'pdf', $3, $4, $5, $6, 'pdf_parse', 1, $7, NOW(), NOW())
        ON CONFLICT (nces_id, document_url) DO UPDATE SET
          extracted_text = EXCLUDED.extracted_text,
          text_length = EXCLUDED.text_length,
          document_category = EXCLUDED.document_category,
          content_hash = EXCLUDED.content_hash,
          last_crawled_at = NOW()
      `, [
        pdf.nces_id,
        pdf.url,
        title,
        category,
        extraction.text.substring(0, 100000),
        extraction.text.length,
        contentHash
      ]);

      stats.stored++;

      // Update crawl log
      await client.query(`
        UPDATE document_crawl_log
        SET extraction_success = true, keywords_found = $1
        WHERE id = $2
      `, [keywords, pdf.id]);

      if (keywords.length > 0) {
        console.log(`  ✓ ${title.substring(0, 40)}... - Keywords: ${keywords.join(', ')}`);
      }

    } catch (error) {
      console.log(`  ✗ Store failed: ${pdf.url.substring(0, 60)}... - ${error.message}`);
      stats.failed++;
    }

    await sleep(CONFIG.RATE_LIMIT_MS);
  }

  // Summary
  console.log('\n=== REPROCESSING COMPLETE ===\n');
  console.log(`Total PDFs: ${stats.total}`);
  console.log(`Successfully fetched: ${stats.fetched}`);
  console.log(`Successfully extracted: ${stats.extracted}`);
  console.log(`Stored in database: ${stats.stored}`);
  console.log(`With keywords: ${stats.keywordsFound}`);
  console.log(`Failed: ${stats.failed}`);

  // Verify
  const pdfCount = await client.query(`
    SELECT COUNT(*) as count FROM district_documents WHERE document_type = 'pdf'
  `);
  console.log(`\nTotal PDFs now in district_documents: ${pdfCount.rows[0].count}`);

  await client.end();
}

main().catch(console.error);
