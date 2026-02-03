/**
 * Maryland Superintendent Data - Load from CSV
 *
 * Source: MSDE Local School Systems
 * URL: https://marylandpublicschools.org/about/Pages/School-Systems/index.aspx
 * NCES: ~25 districts
 * CSV: 24 county school systems (all public LEAs)
 *
 * Note: Maryland has 24 school systems - one per county plus Baltimore City.
 * Email addresses not publicly available on district websites.
 * Phone, address, and superintendent names included.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';
const SOURCE_URL = 'https://marylandpublicschools.org/about/Pages/School-Systems/index.aspx';

// Maryland district website mapping
const DISTRICT_WEBSITES = {
  'MD-ALLE': 'https://www.acpsmd.org',
  'MD-ANNE': 'https://www.aacps.org',
  'MD-BACI': 'https://www.baltimorecityschools.org',
  'MD-BACO': 'https://www.bcps.org',
  'MD-CALV': 'https://www.calvertnet.k12.md.us',
  'MD-CARO': 'https://www.carolineschools.org',
  'MD-CARR': 'https://www.carrollk12.org',
  'MD-CECI': 'https://www.ccps.org',
  'MD-CHAR': 'https://www.ccboe.com',
  'MD-DORC': 'https://www.dcps.k12.md.us',
  'MD-FRED': 'https://www.fcps.org',
  'MD-GARR': 'https://www.garrettcountyschools.org',
  'MD-HARF': 'https://www.hcps.org',
  'MD-HOWA': 'https://www.hcpss.org',
  'MD-KENT': 'https://www.kent.k12.md.us',
  'MD-MONT': 'https://www.montgomeryschoolsmd.org',
  'MD-PRIN': 'https://www.pgcps.org',
  'MD-QUEE': 'https://www.qacps.org',
  'MD-STMA': 'https://www.smcps.org',
  'MD-SOME': 'https://www.somerset.k12.md.us',
  'MD-TALB': 'https://www.tcps.k12.md.us',
  'MD-WASH': 'https://www.wcpsmd.com',
  'MD-WICO': 'https://www.wicomicoschools.org',
  'MD-WORC': 'https://www.worcesterk12.org'
};

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
    .replace(/public school system/gi, '')
    .replace(/public schools?/gi, '')
    .replace(/county/gi, '')
    .replace(/city/gi, '')
    .replace(/[#.,()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    console.log('Connected to database\n');

    const existingResult = await client.query(
      'SELECT COUNT(*) as count FROM state_registry_districts WHERE state = $1',
      ['MD']
    );
    if (parseInt(existingResult.rows[0].count) > 0) {
      console.log(`\nWARNING: MD already has ${existingResult.rows[0].count} records`);
      console.log('Skipping to avoid duplicates. Run delete-state.js MD first.');
      await client.end();
      return;
    }

    console.log('=== READING CSV ===');
    const csvPath = path.join(__dirname, '../data/processed/md_superintendents.csv');
    const csv = fs.readFileSync(csvPath, 'utf8');
    const lines = csv.split('\n').slice(1).filter(l => l.trim());

    const records = [];
    for (const line of lines) {
      // Parse CSV - format: state,state_district_id,district_name,administrator_first_name,administrator_last_name,phone,address,city,zip
      const parts = line.split(',').map(p => p.replace(/^"|"$/g, '').trim());
      if (parts.length < 5) continue;

      const [state, stateDistrictId, districtName, firstName, lastName, phone, address, city, zip] = parts;

      records.push({
        state: 'MD',
        district_name: districtName,
        state_district_id: stateDistrictId,
        city: city || null,
        address: address || null,
        administrator_first_name: firstName,
        administrator_last_name: lastName,
        phone: phone || null,
        website_url: DISTRICT_WEBSITES[stateDistrictId] || null
      });
    }
    console.log(`Parsed ${records.length} records from CSV`);
    console.log(`Records with website: ${records.filter(r => r.website_url).length}`);

    console.log('\n=== LOADING NCES DISTRICTS ===');
    const ncesResult = await client.query(
      'SELECT nces_id, name FROM districts WHERE state = $1',
      ['MD']
    );
    console.log(`Found ${ncesResult.rows.length} NCES districts for MD`);

    console.log('\n=== CREATING AUDIT RECORD ===');
    const importResult = await client.query(`
      INSERT INTO data_imports
      (id, source_type, source_name, source_url, source_file, record_count,
       imported_at, imported_by, notes)
      VALUES (gen_random_uuid(), 'state_registry', 'MSDE Local School Systems', $1, 'md_superintendents.csv', $2,
              NOW(), 'fetch-load-md.js', 'MD county school systems. 24 districts, emails not publicly available.')
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
        (id, state, state_district_id, district_name, city, address, phone,
         administrator_first_name, administrator_last_name,
         website_url, raw_data, import_batch_id, created_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        RETURNING id
      `, [rec.state, rec.state_district_id, rec.district_name, rec.city, rec.address, rec.phone,
          rec.administrator_first_name, rec.administrator_last_name,
          rec.website_url, JSON.stringify(rec), importId]);
      const stateRegistryId = insertResult.rows[0].id;
      loaded++;

      const normalizedState = normalizeDistrictName(rec.district_name);
      let bestMatch = null;
      let bestScore = 0;
      let matchMethod = null;

      for (const nces of ncesResult.rows) {
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
          VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), 'fetch-load-md.js', $5, $6)
        `, [bestMatch.nces_id, stateRegistryId, matchMethod, bestScore,
            bestScore < 0.85,
            JSON.stringify({ state_name: rec.district_name, nces_name: bestMatch.name, score: bestScore })]);
        matched++;
        matchStats[matchMethod] = (matchStats[matchMethod] || 0) + 1;
      } else {
        matchStats.unmatched++;
        unmatched.push(rec.district_name);
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
      console.log(`\nUnmatched:`);
      unmatched.forEach(d => console.log(`  - ${d}`));
    }

    const coverageResult = await client.query(`
      SELECT COUNT(*) as total, COUNT(superintendent_name) as with_supt,
             ROUND(COUNT(superintendent_name)*100.0/COUNT(*),1) as pct
      FROM national_registry WHERE state = 'MD'
    `);
    const coverage = coverageResult.rows[0];
    console.log(`\nMD Coverage: ${coverage.with_supt}/${coverage.total} (${coverage.pct}%)`);

    const overallResult = await client.query(`
      SELECT COUNT(*) as total, COUNT(superintendent_name) as with_supt,
             ROUND(COUNT(superintendent_name)*100.0/COUNT(*),1) as pct
      FROM national_registry
    `);
    const overall = overallResult.rows[0];
    console.log(`OVERALL: ${overall.with_supt}/${overall.total} (${overall.pct}%)`);

    console.log('\n=== MARYLAND COMPLETE ===');
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(console.error);
