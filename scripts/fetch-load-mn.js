/**
 * Minnesota Superintendent Data - Fetch and Load from MDE
 *
 * Source: https://pub.education.mn.gov/MdeOrgView/districts/superintendentsDistricts
 * NCES: ~565 districts
 * MDE: ~548 superintendents with emails
 */

const { Client } = require('pg');
const https = require('https');

const DATABASE_URL = 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';
const SOURCE_URL = 'https://pub.education.mn.gov/MdeOrgView/districts/superintendentsDistricts';

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

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

function normalizeDistrictName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/public school district/gi, 'psd')
    .replace(/school district/gi, 'sd')
    .replace(/public schools?/gi, 'ps')
    .replace(/independent school district/gi, 'isd')
    .replace(/[#.,()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseName(fullName) {
  if (!fullName) return { first: '', last: '' };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first: '', last: parts[0] };
  if (parts.length === 2) return { first: parts[0], last: parts[1] };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function extractWebsite(email) {
  if (!email) return null;
  const match = email.match(/@(.+)$/);
  if (match) {
    const domain = match[1];
    if (domain.includes('gmail') || domain.includes('yahoo') || domain.includes('hotmail')) {
      return null;
    }
    return 'https://' + domain;
  }
  return null;
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    console.log('Connected to database\n');

    const existingResult = await client.query(
      'SELECT COUNT(*) as count FROM state_registry_districts WHERE state = $1',
      ['MN']
    );
    if (parseInt(existingResult.rows[0].count) > 0) {
      console.log(`\nWARNING: MN already has ${existingResult.rows[0].count} records`);
      console.log('Skipping to avoid duplicates. Run delete-state.js MN first.');
      await client.end();
      return;
    }

    console.log('=== FETCHING MDE PAGE ===');
    const html = await fetchPage(SOURCE_URL);
    console.log(`Downloaded ${html.length} bytes`);

    // Extract table rows
    const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
    if (!tbodyMatch) {
      throw new Error('Could not find table body');
    }

    const tbody = tbodyMatch[1];
    const rows = tbody.split(/<\/tr>/).filter(r => r.includes('<td'));

    console.log(`Found ${rows.length} table rows`);

    const records = [];
    const seen = new Set(); // Dedupe by district number

    for (let i = 0; i < rows.length; i++) {
      const cells = rows[i].match(/<td[^>]*>([\s\S]*?)<\/td>/g);
      if (!cells || cells.length < 5) continue;

      const values = cells.map(c => c.replace(/<[^>]+>/g, '').trim());
      const [superintendent, distNum, distName, email, phone] = values;

      if (!distName || seen.has(distNum)) continue;
      seen.add(distNum);

      const { first, last } = parseName(superintendent);

      records.push({
        state: 'MN',
        district_name: distName,
        state_district_id: distNum,
        administrator_first_name: first,
        administrator_last_name: last,
        administrator_email: email?.toLowerCase() || null,
        phone: phone || null,
        website_url: extractWebsite(email)
      });
    }

    console.log(`Parsed ${records.length} unique districts`);
    console.log(`With email: ${records.filter(r => r.administrator_email).length}`);

    console.log('\n=== LOADING NCES DISTRICTS ===');
    const ncesResult = await client.query(
      'SELECT nces_id, name FROM districts WHERE state = $1',
      ['MN']
    );
    console.log(`Found ${ncesResult.rows.length} NCES districts for MN`);

    console.log('\n=== CREATING AUDIT RECORD ===');
    const importResult = await client.query(`
      INSERT INTO data_imports
      (id, source_type, source_name, source_url, source_file, record_count,
       imported_at, imported_by, notes)
      VALUES (gen_random_uuid(), 'state_registry', 'Minnesota MDE OrgView', $1, NULL, $2,
              NOW(), 'fetch-load-mn.js', 'MN superintendents from MDE public directory. Includes names, emails, phones.')
      RETURNING id
    `, [SOURCE_URL, records.length]);
    const importId = importResult.rows[0].id;
    console.log(`Created data_imports record: ${importId}`);

    console.log('\n=== LOADING AND MATCHING ===');
    let loaded = 0, matched = 0;
    const matchStats = { exact_name: 0, fuzzy: 0, normalized_name: 0, unmatched: 0 };
    const unmatched = [];

    for (const rec of records) {
      const insertResult = await client.query(`
        INSERT INTO state_registry_districts
        (id, state, state_district_id, district_name, phone,
         administrator_first_name, administrator_last_name, administrator_email,
         website_url, raw_data, import_batch_id, created_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        RETURNING id
      `, [rec.state, rec.state_district_id, rec.district_name, rec.phone,
          rec.administrator_first_name, rec.administrator_last_name, rec.administrator_email,
          rec.website_url, JSON.stringify(rec), importId]);
      const stateRegistryId = insertResult.rows[0].id;
      loaded++;

      const normalizedState = normalizeDistrictName(rec.district_name);
      let bestMatch = null;
      let bestScore = 0;
      let matchMethod = null;

      for (const nces of ncesResult.rows) {
        if (!nces.nces_id) continue;
        const normalizedNces = normalizeDistrictName(nces.name);
        if (normalizedState === normalizedNces) {
          bestMatch = nces;
          bestScore = 0.95;
          matchMethod = 'exact_name';
          break;
        }
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
          VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), 'fetch-load-mn.js', $5, $6)
        `, [bestMatch.nces_id, stateRegistryId, matchMethod, bestScore,
            bestScore < 0.85,
            JSON.stringify({ state_name: rec.district_name, nces_name: bestMatch.name, score: bestScore })]);
        matched++;
        matchStats[matchMethod] = (matchStats[matchMethod] || 0) + 1;
      } else {
        matchStats.unmatched++;
        if (unmatched.length < 20) unmatched.push(rec.district_name);
      }
    }

    await client.query(`UPDATE data_imports SET success_count = $1, error_count = $2 WHERE id = $3`,
      [loaded, 0, importId]);

    console.log('\n=== RESULTS ===');
    console.log(`Records loaded: ${loaded}`);
    console.log(`Records matched: ${matched} (${(matched/loaded*100).toFixed(1)}%)`);
    console.log(`\nMatch breakdown:`);
    Object.entries(matchStats).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
    if (unmatched.length > 0) {
      console.log(`\nSample unmatched (first 20):`);
      unmatched.forEach(d => console.log(`  - ${d}`));
    }

    const coverageResult = await client.query(`
      SELECT COUNT(*) as total, COUNT(superintendent_name) as with_supt,
             ROUND(COUNT(superintendent_name)*100.0/COUNT(*),1) as pct
      FROM national_registry WHERE state = 'MN'
    `);
    const coverage = coverageResult.rows[0];
    console.log(`\nMN Coverage: ${coverage.with_supt}/${coverage.total} (${coverage.pct}%)`);

    const overallResult = await client.query(`
      SELECT COUNT(*) as total, COUNT(superintendent_name) as with_supt,
             ROUND(COUNT(superintendent_name)*100.0/COUNT(*),1) as pct
      FROM national_registry
    `);
    const overall = overallResult.rows[0];
    console.log(`OVERALL: ${overall.with_supt}/${overall.total} (${overall.pct}%)`);

    console.log('\n=== MINNESOTA COMPLETE ===');
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(console.error);
