/**
 * URL Verification Script
 *
 * Validates website URLs in superintendent_directory and suggests corrections
 * for invalid URLs. Useful as a pre-flight check before crawling.
 *
 * Checks:
 *   1. DNS resolution (does domain exist?)
 *   2. HTTP connectivity (does site respond?)
 *   3. Common URL patterns as alternatives
 *
 * Usage:
 *   node scripts/verify-urls.js                    # Check all URLs
 *   node scripts/verify-urls.js --failed-only      # Only check URLs that failed in crawl
 *   node scripts/verify-urls.js --state UT         # Check specific state
 *   node scripts/verify-urls.js --limit 50         # Limit number to check
 *   node scripts/verify-urls.js --fix              # Apply suggested fixes to database
 */

const { Client } = require('pg');
const dns = require('dns');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const DATABASE_URL = 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';

// Parse args
const args = process.argv.slice(2);
const FAILED_ONLY = args.includes('--failed-only');
const FIX_MODE = args.includes('--fix');
const STATE_FILTER = args.includes('--state') ? args[args.indexOf('--state') + 1]?.toUpperCase() : null;
const LIMIT = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1], 10) : null;

const CONFIG = {
  DNS_TIMEOUT_MS: 5000,
  HTTP_TIMEOUT_MS: 10000,
  RATE_LIMIT_MS: 200
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Check if domain exists via DNS
function checkDns(hostname) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ exists: false, error: 'DNS timeout' });
    }, CONFIG.DNS_TIMEOUT_MS);

    dns.lookup(hostname, (err) => {
      clearTimeout(timeout);
      if (err) {
        resolve({ exists: false, error: err.code || err.message });
      } else {
        resolve({ exists: true });
      }
    });
  });
}

// Check if URL responds with HTTP request
function checkHttp(url) {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname || '/',
        method: 'HEAD',
        timeout: CONFIG.HTTP_TIMEOUT_MS,
        rejectUnauthorized: false, // Allow invalid SSL
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) URL-Verifier/1.0'
        }
      };

      const req = protocol.request(options, (res) => {
        // Follow redirects to get final URL
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let redirectUrl = res.headers.location;
          if (!redirectUrl.startsWith('http')) {
            redirectUrl = new URL(redirectUrl, url).href;
          }
          resolve({
            responds: true,
            status: res.statusCode,
            redirectsTo: redirectUrl
          });
        } else {
          resolve({
            responds: true,
            status: res.statusCode
          });
        }
      });

      req.on('error', (err) => {
        resolve({ responds: false, error: err.code || err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ responds: false, error: 'Timeout' });
      });

      req.end();
    } catch (err) {
      resolve({ responds: false, error: err.message });
    }
  });
}

// Generate alternative URL patterns to try
function generateAlternatives(districtName, state, currentUrl) {
  const alternatives = [];
  const stateLC = state.toLowerCase();

  // Normalize district name for URL generation
  const nameNormalized = districtName
    .toLowerCase()
    .replace(/school district/gi, '')
    .replace(/unified/gi, '')
    .replace(/independent/gi, '')
    .replace(/public schools/gi, '')
    .replace(/county/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '');

  // Common K12 patterns
  alternatives.push(`https://www.${nameNormalized}.k12.${stateLC}.us`);
  alternatives.push(`https://${nameNormalized}.k12.${stateLC}.us`);

  // With "schools" suffix
  alternatives.push(`https://www.${nameNormalized}schools.org`);
  alternatives.push(`https://www.${nameNormalized}schools.com`);

  // State-specific patterns
  if (state === 'TX') {
    alternatives.push(`https://www.${nameNormalized}isd.org`);
    alternatives.push(`https://www.${nameNormalized}isd.net`);
  }

  // Try with www if original doesn't have it
  try {
    const parsed = new URL(currentUrl);
    if (!parsed.hostname.startsWith('www.')) {
      alternatives.push(currentUrl.replace(parsed.hostname, 'www.' + parsed.hostname));
    } else {
      alternatives.push(currentUrl.replace('www.', ''));
    }
    // Try http vs https
    if (parsed.protocol === 'https:') {
      alternatives.push(currentUrl.replace('https:', 'http:'));
    } else {
      alternatives.push(currentUrl.replace('http:', 'https:'));
    }
  } catch (e) {
    // Invalid URL
  }

  // Deduplicate and filter out current URL
  return [...new Set(alternatives)].filter(u => u !== currentUrl);
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  console.log('=== URL Verification Script ===\n');
  console.log(`Failed only: ${FAILED_ONLY}`);
  console.log(`Fix mode: ${FIX_MODE}`);
  if (STATE_FILTER) console.log(`State filter: ${STATE_FILTER}`);
  if (LIMIT) console.log(`Limit: ${LIMIT}`);
  console.log('');

  // Build query
  let query;
  const params = [];

  if (FAILED_ONLY) {
    // Get URLs that failed in document_crawl_log
    query = `
      SELECT DISTINCT s.nces_id, s.district_name, s.state, s.website_url
      FROM superintendent_directory s
      JOIN document_crawl_log l ON s.nces_id = l.nces_id
      WHERE l.status = 'failure'
        AND l.url_type = 'homepage'
        AND s.website_url IS NOT NULL
    `;
    if (STATE_FILTER) {
      params.push(STATE_FILTER);
      query += ` AND s.state = $${params.length}`;
    }
    query += ` ORDER BY s.state, s.district_name`;
  } else {
    // Get all URLs
    query = `
      SELECT nces_id, district_name, state, website_url
      FROM superintendent_directory
      WHERE website_url IS NOT NULL AND website_url != ''
    `;
    if (STATE_FILTER) {
      params.push(STATE_FILTER);
      query += ` AND state = $${params.length}`;
    }
    query += ` ORDER BY state, district_name`;
  }

  if (LIMIT) {
    query += ` LIMIT ${LIMIT}`;
  }

  const result = await client.query(query, params);
  console.log(`Found ${result.rows.length} URLs to verify\n`);

  if (result.rows.length === 0) {
    console.log('No URLs to verify.');
    await client.end();
    return;
  }

  // Stats
  const stats = {
    total: result.rows.length,
    valid: 0,
    dnsFailure: 0,
    httpFailure: 0,
    suggestionsFound: 0
  };

  const issues = [];
  const fixes = [];

  // Verify each URL
  for (let i = 0; i < result.rows.length; i++) {
    const district = result.rows[i];

    if ((i + 1) % 20 === 0) {
      console.log(`Progress: ${i + 1}/${stats.total}`);
    }

    let hostname;
    try {
      hostname = new URL(district.website_url).hostname;
    } catch (e) {
      console.log(`  ✗ Invalid URL format: ${district.district_name} (${district.state})`);
      console.log(`    URL: ${district.website_url}`);
      issues.push({
        ...district,
        issue: 'invalid_url_format',
        error: 'Cannot parse URL'
      });
      continue;
    }

    // Step 1: Check DNS
    const dnsResult = await checkDns(hostname);

    if (!dnsResult.exists) {
      stats.dnsFailure++;
      console.log(`  ✗ DNS failed: ${district.district_name} (${district.state})`);
      console.log(`    URL: ${district.website_url}`);
      console.log(`    Error: ${dnsResult.error}`);

      // Try alternatives
      const alternatives = generateAlternatives(district.district_name, district.state, district.website_url);
      let foundWorking = null;

      for (const altUrl of alternatives.slice(0, 5)) {
        try {
          const altHostname = new URL(altUrl).hostname;
          const altDns = await checkDns(altHostname);

          if (altDns.exists) {
            const altHttp = await checkHttp(altUrl);
            if (altHttp.responds && altHttp.status < 400) {
              foundWorking = altHttp.redirectsTo || altUrl;
              console.log(`    ✓ Alternative found: ${foundWorking}`);
              stats.suggestionsFound++;
              fixes.push({
                nces_id: district.nces_id,
                old_url: district.website_url,
                new_url: foundWorking,
                district_name: district.district_name,
                state: district.state
              });
              break;
            }
          }
        } catch (e) {
          // Skip invalid alternatives
        }
        await sleep(CONFIG.RATE_LIMIT_MS);
      }

      if (!foundWorking) {
        issues.push({
          ...district,
          issue: 'dns_failure',
          error: dnsResult.error
        });
      }

      await sleep(CONFIG.RATE_LIMIT_MS);
      continue;
    }

    // Step 2: Check HTTP
    const httpResult = await checkHttp(district.website_url);

    if (!httpResult.responds || httpResult.status >= 400) {
      stats.httpFailure++;

      // Only log if not a simple redirect
      if (!httpResult.redirectsTo) {
        console.log(`  ⚠ HTTP issue: ${district.district_name} (${district.state})`);
        console.log(`    URL: ${district.website_url}`);
        console.log(`    Error: ${httpResult.error || 'HTTP ' + httpResult.status}`);

        issues.push({
          ...district,
          issue: 'http_failure',
          error: httpResult.error || 'HTTP ' + httpResult.status
        });
      }
    } else {
      stats.valid++;

      // Track redirects as potential URL updates
      if (httpResult.redirectsTo) {
        const finalUrl = httpResult.redirectsTo;
        if (finalUrl !== district.website_url) {
          fixes.push({
            nces_id: district.nces_id,
            old_url: district.website_url,
            new_url: finalUrl,
            district_name: district.district_name,
            state: district.state,
            type: 'redirect'
          });
        }
      }
    }

    await sleep(CONFIG.RATE_LIMIT_MS);
  }

  // Summary
  console.log('\n=== VERIFICATION SUMMARY ===\n');
  console.log(`Total checked: ${stats.total}`);
  console.log(`Valid URLs: ${stats.valid} (${(stats.valid/stats.total*100).toFixed(1)}%)`);
  console.log(`DNS failures: ${stats.dnsFailure}`);
  console.log(`HTTP failures: ${stats.httpFailure}`);
  console.log(`Suggestions found: ${stats.suggestionsFound}`);

  if (issues.length > 0) {
    console.log('\n=== UNRESOLVED ISSUES ===\n');
    for (const issue of issues.slice(0, 20)) {
      console.log(`${issue.district_name} (${issue.state})`);
      console.log(`  URL: ${issue.website_url}`);
      console.log(`  Issue: ${issue.issue} - ${issue.error}`);
    }
    if (issues.length > 20) {
      console.log(`\n... and ${issues.length - 20} more issues`);
    }
  }

  if (fixes.length > 0) {
    console.log('\n=== SUGGESTED FIXES ===\n');
    for (const fix of fixes.slice(0, 20)) {
      console.log(`${fix.district_name} (${fix.state})`);
      console.log(`  Old: ${fix.old_url}`);
      console.log(`  New: ${fix.new_url}`);
      if (fix.type === 'redirect') console.log(`  (via redirect)`);
    }
    if (fixes.length > 20) {
      console.log(`\n... and ${fixes.length - 20} more fixes`);
    }

    // Apply fixes if --fix flag is set
    if (FIX_MODE && fixes.filter(f => f.type !== 'redirect').length > 0) {
      console.log('\n=== APPLYING FIXES ===\n');

      for (const fix of fixes.filter(f => f.type !== 'redirect')) {
        try {
          await client.query(`
            UPDATE superintendent_directory
            SET website_url = $1
            WHERE nces_id = $2
          `, [fix.new_url, fix.nces_id]);
          console.log(`  ✓ Updated ${fix.district_name}: ${fix.new_url}`);
        } catch (err) {
          console.log(`  ✗ Failed to update ${fix.district_name}: ${err.message}`);
        }
      }
    } else if (FIX_MODE) {
      console.log('\nNo DNS-failure fixes to apply (redirects are informational only).');
    } else if (fixes.filter(f => f.type !== 'redirect').length > 0) {
      console.log('\nRun with --fix to apply suggested URL corrections to the database.');
    }
  }

  await client.end();
}

main().catch(console.error);
