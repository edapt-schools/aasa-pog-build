/**
 * Arizona District Domain Collection from GreatSchools
 *
 * "Plan Z" approach: Load AZ districts with website domains only (no superintendent info)
 *
 * Source: https://www.greatschools.org/arizona/districts/
 * Contains ~746 entries (traditional districts + charters)
 */

const { Client } = require('pg');
const https = require('https');

const DATABASE_URL = 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';
const SOURCE_URL = 'https://www.greatschools.org/arizona/districts/';

// Rate limiting: delay between requests (ms)
const REQUEST_DELAY = 500; // 2 requests per second

/**
 * Fetch a URL and return the HTML content
 */
function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        // Follow redirect
        fetchPage(response.headers.location).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => resolve(data));
    });

    request.on('error', reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
  });
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse the main districts listing page to extract district links
 */
function parseDistrictsList(html) {
  const districts = [];

  // Look for links that match /arizona/city/district-name/ pattern
  const linkRegex = /href="(\/arizona\/[^"]+\/[^"]+\/)"/g;
  const nameRegex = /<a[^>]*href="(\/arizona\/[^"]+\/[^"]+\/)"[^>]*>([^<]+)<\/a>/g;

  let match;
  const seen = new Set();

  while ((match = nameRegex.exec(html)) !== null) {
    const url = match[1];
    const name = match[2].trim();

    // Skip duplicates and non-district pages
    if (seen.has(url)) continue;
    if (url.includes('/schools/') || url.includes('/reviews/')) continue;
    if (!name || name.length < 3) continue;

    seen.add(url);

    // Extract city from URL: /arizona/city/district-name/
    const parts = url.split('/').filter(p => p);
    const city = parts.length >= 2 ? parts[1].replace(/-/g, ' ') : '';

    districts.push({
      name: name,
      city: city.charAt(0).toUpperCase() + city.slice(1),
      greatschools_url: 'https://www.greatschools.org' + url
    });
  }

  return districts;
}

/**
 * Parse a district detail page to extract website, phone, address
 */
function parseDistrictDetail(html) {
  const result = {
    website_url: null,
    phone: null,
    address: null
  };

  // Look for website URL - usually in an anchor with href to external site
  // Pattern: <a href="http://www.district.org" ...>
  const websiteMatch = html.match(/href="(https?:\/\/(?!www\.greatschools)[^"]+)"[^>]*>\s*(?:Website|Visit|Official)/i) ||
                       html.match(/Website[^<]*<[^>]*href="(https?:\/\/[^"]+)"/i) ||
                       html.match(/<a[^>]*href="(https?:\/\/(?!www\.greatschools|facebook|twitter|instagram)[^"]+\.(?:org|edu|k12|us|net|com)[^"]*)"[^>]*>/i);

  if (websiteMatch) {
    result.website_url = websiteMatch[1];
  }

  // Look for phone number
  const phoneMatch = html.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) {
    result.phone = phoneMatch[0];
  }

  // Look for address
  const addressMatch = html.match(/(\d+[^<]{10,60}(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Way|Lane|Ln)[^<]{0,30}\d{5})/i);
  if (addressMatch) {
    result.address = addressMatch[1].replace(/\s+/g, ' ').trim();
  }

  return result;
}

/**
 * Jaro-Winkler similarity for fuzzy matching
 */
function jaroWinkler(s1, s2) {
  if (s1 === s2) return 1.0;
  const len1 = s1.length, len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0.0;

  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0, transpositions = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Normalize district name for matching
 */
function normalizeDistrictName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/school district/gi, '')
    .replace(/unified school district/gi, '')
    .replace(/unified district/gi, '')
    .replace(/elementary district/gi, '')
    .replace(/union high school district/gi, '')
    .replace(/public schools?/gi, '')
    .replace(/charter school/gi, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[#.,()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Check for existing AZ records
    const existingResult = await client.query(
      'SELECT COUNT(*) as count FROM state_registry_districts WHERE state = $1',
      ['AZ']
    );

    if (parseInt(existingResult.rows[0].count) > 0) {
      console.log(`WARNING: AZ already has ${existingResult.rows[0].count} records`);
      console.log('Skipping to avoid duplicates. Delete existing records first if re-loading.');
      await client.end();
      return;
    }

    // Step 1: Fetch main listing page
    console.log('=== FETCHING DISTRICT LIST ===');
    console.log(`Fetching ${SOURCE_URL}...\n`);

    const listingHtml = await fetchPage(SOURCE_URL);
    const districts = parseDistrictsList(listingHtml);
    console.log(`Found ${districts.length} district links\n`);

    if (districts.length === 0) {
      console.log('ERROR: No districts found. Page structure may have changed.');
      console.log('First 500 chars of HTML:', listingHtml.substring(0, 500));
      return;
    }

    // Show first few districts
    console.log('First 10 districts:');
    districts.slice(0, 10).forEach(d => console.log(`  - ${d.name} (${d.city})`));
    console.log('');

    // Step 2: Fetch individual district pages
    console.log('=== FETCHING DISTRICT DETAILS ===');
    console.log(`Fetching ${districts.length} district pages (this will take ~${Math.ceil(districts.length * REQUEST_DELAY / 60000)} minutes)...\n`);

    const records = [];
    let fetched = 0;
    let failed = 0;

    for (const district of districts) {
      try {
        const detailHtml = await fetchPage(district.greatschools_url);
        const details = parseDistrictDetail(detailHtml);

        records.push({
          state: 'AZ',
          district_name: district.name,
          city: district.city,
          website_url: details.website_url,
          phone: details.phone,
          address: details.address,
          source_url: district.greatschools_url
        });

        fetched++;
        if (fetched % 50 === 0) {
          console.log(`  Fetched ${fetched}/${districts.length} (${Math.round(fetched / districts.length * 100)}%)`);
        }
      } catch (error) {
        failed++;
        console.log(`  FAILED: ${district.name} - ${error.message}`);
      }

      await sleep(REQUEST_DELAY);
    }

    console.log(`\nFetched ${fetched} district pages (${failed} failed)\n`);

    // Filter to only records with website_url
    const recordsWithWebsite = records.filter(r => r.website_url);
    console.log(`Records with website_url: ${recordsWithWebsite.length}/${records.length}\n`);

    // Step 3: Load NCES districts for matching
    console.log('=== LOADING NCES DISTRICTS ===');
    const ncesResult = await client.query(
      'SELECT nces_id, name, city FROM districts WHERE state = $1',
      ['AZ']
    );
    console.log(`Found ${ncesResult.rows.length} NCES districts for AZ\n`);

    // Step 4: Create audit record
    console.log('=== CREATING AUDIT RECORD ===');
    const importResult = await client.query(`
      INSERT INTO data_imports
      (id, source_type, source_name, source_url, source_file, record_count,
       imported_at, imported_by, notes)
      VALUES (gen_random_uuid(), 'state_registry', 'GreatSchools Arizona Districts', $1, 'N/A - web scrape', $2,
              NOW(), 'fetch-load-az-domains.js', 'Plan Z: Partial records with website domains only, no superintendent info. Includes traditional districts and charters.')
      RETURNING id
    `, [SOURCE_URL, records.length]);

    const importId = importResult.rows[0].id;
    console.log(`Created data_imports record: ${importId}\n`);

    // Step 5: Insert records and match
    console.log('=== LOADING AND MATCHING ===\n');

    let loaded = 0, matched = 0;
    const matchStats = { exact_name: 0, fuzzy: 0, normalized_name: 0, unmatched: 0 };
    const unmatched = [];

    for (const rec of records) {
      // Generate state_district_id from GreatSchools URL (last part of path)
      // Max length is 50, so truncate to 47 to allow for "GS-" prefix
      const urlParts = rec.source_url.split('/').filter(p => p);
      const stateDistrictId = 'GS-' + (urlParts[urlParts.length - 1] || rec.district_name.toLowerCase().replace(/\s+/g, '-')).substring(0, 47);

      // Insert to state_registry_districts
      const insertResult = await client.query(`
        INSERT INTO state_registry_districts
        (id, state, state_district_id, district_name, city, phone, website_url, address,
         source_url, raw_data, import_batch_id, created_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        RETURNING id
      `, [
        rec.state,
        stateDistrictId,
        rec.district_name,
        rec.city,
        rec.phone,
        rec.website_url,
        rec.address,
        rec.source_url,
        JSON.stringify(rec),
        importId
      ]);

      const stateRegistryId = insertResult.rows[0].id;
      loaded++;

      // Try to match to NCES
      const normalizedState = normalizeDistrictName(rec.district_name);
      let bestMatch = null;
      let bestScore = 0;
      let matchMethod = null;

      for (const nces of ncesResult.rows) {
        const normalizedNces = normalizeDistrictName(nces.name);

        // Exact match
        if (normalizedState === normalizedNces) {
          bestMatch = nces;
          bestScore = 0.95;
          matchMethod = 'exact_name';
          break;
        }

        // Fuzzy match
        const score = jaroWinkler(normalizedState, normalizedNces);
        if (score > bestScore && score >= 0.80) {
          bestMatch = nces;
          bestScore = score;
          matchMethod = score >= 0.90 ? 'normalized_name' : 'fuzzy';
        }
      }

      if (bestMatch) {
        await client.query(`
          INSERT INTO district_matches
          (id, nces_id, state_registry_id, match_method, match_confidence,
           matched_at, matched_by, flag_for_review, match_details)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), 'fetch-load-az-domains.js', $5, $6)
        `, [
          bestMatch.nces_id,
          stateRegistryId,
          matchMethod,
          bestScore,
          bestScore < 0.85,
          JSON.stringify({
            state_name: rec.district_name,
            nces_name: bestMatch.name,
            normalized_state: normalizedState,
            normalized_nces: normalizeDistrictName(bestMatch.name),
            score: bestScore
          })
        ]);
        matched++;
        matchStats[matchMethod] = (matchStats[matchMethod] || 0) + 1;
      } else {
        matchStats.unmatched++;
        unmatched.push(rec.district_name);
      }
    }

    // Update import record
    await client.query(`
      UPDATE data_imports
      SET success_count = $1, error_count = $2
      WHERE id = $3
    `, [loaded, failed, importId]);

    // Results
    console.log('=== RESULTS ===');
    console.log(`Records loaded: ${loaded}`);
    console.log(`Records with website: ${recordsWithWebsite.length}`);
    console.log(`Records matched to NCES: ${matched} (${(matched/loaded*100).toFixed(1)}%)`);
    console.log(`\nMatch breakdown:`);
    console.log(`  exact_name: ${matchStats.exact_name}`);
    console.log(`  normalized_name: ${matchStats.normalized_name || 0}`);
    console.log(`  fuzzy: ${matchStats.fuzzy || 0}`);
    console.log(`  unmatched: ${matchStats.unmatched}`);

    if (unmatched.length > 0 && unmatched.length <= 30) {
      console.log(`\nUnmatched districts (expected - many are charters):`);
      unmatched.forEach(d => console.log(`  - ${d}`));
    } else if (unmatched.length > 30) {
      console.log(`\nFirst 30 unmatched districts:`);
      unmatched.slice(0, 30).forEach(d => console.log(`  - ${d}`));
      console.log(`  ... and ${unmatched.length - 30} more`);
    }

    // Coverage stats
    const coverageResult = await client.query(`
      SELECT COUNT(*) as total FROM districts WHERE state = 'AZ'
    `);
    const ncesTotal = parseInt(coverageResult.rows[0].total);

    console.log(`\nAZ NCES Coverage: ${matched}/${ncesTotal} (${(matched/ncesTotal*100).toFixed(1)}%)`);

    const overallResult = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(superintendent_name) as with_supt,
             ROUND(COUNT(superintendent_name)*100.0/COUNT(*),1) as pct
      FROM national_registry
    `);
    const overall = overallResult.rows[0];
    console.log(`OVERALL: ${overall.with_supt}/${overall.total} (${overall.pct}%)`);

    console.log('\n=== ARIZONA COMPLETE ===');
    console.log('Note: These are partial records (website/phone only, no superintendent info)');

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(console.error);
