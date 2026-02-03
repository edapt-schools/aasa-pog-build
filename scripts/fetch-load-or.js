/**
 * Oregon Superintendent Data - Load from ODE Institution Extract
 *
 * Source: Oregon Department of Education Institution Database
 * URL: https://www.ode.state.or.us/instid/
 * NCES: ~222 districts
 * Extract: ~212 school districts with director names
 *
 * Note: Emails not available in source data. Director_Name is the superintendent.
 */

const { Client } = require('pg');
const XLSX = require('xlsx');
const path = require('path');

const DATABASE_URL = 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';
const SOURCE_URL = 'https://www.ode.state.or.us/instid/';

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
    .replace(/sd\s*\d+j?/gi, '') // Remove SD 5J, SD 16J patterns
    .replace(/school district/gi, '')
    .replace(/elementary/gi, '')
    .replace(/unified/gi, '')
    .replace(/union high/gi, '')
    .replace(/[#.,()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseName(fullName) {
  if (!fullName) return { first: '', last: '' };
  let cleaned = fullName
    .replace(/^(Dr\.|Mr\.|Mrs\.|Ms\.|Miss)\s*/gi, '')
    .replace(/,?\s*(Jr\.?|Sr\.?|III|II|IV|Ed\.?D\.?|Ph\.?D\.?)$/gi, '')
    .trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return { first: '', last: parts[0] };
  if (parts.length === 2) return { first: parts[0], last: parts[1] };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    console.log('Connected to database\n');

    const existingResult = await client.query(
      'SELECT COUNT(*) as count FROM state_registry_districts WHERE state = $1',
      ['OR']
    );
    if (parseInt(existingResult.rows[0].count) > 0) {
      console.log(`\nWARNING: OR already has ${existingResult.rows[0].count} records`);
      console.log('Skipping to avoid duplicates. Run delete-state.js OR first.');
      await client.end();
      return;
    }

    console.log('=== READING XLSX ===');
    const xlsxPath = path.join(__dirname, '../data/raw/Inst_Db_Extract_XL8.xlsx');
    const wb = XLSX.readFile(xlsxPath);
    const ws = wb.Sheets['Institutions'];
    const data = XLSX.utils.sheet_to_json(ws);

    // Filter for school districts only
    const districtRows = data.filter(r => r.Type === 'School District');

    // Dedupe by Iid
    const uniqueDistricts = new Map();
    for (const r of districtRows) {
      if (!uniqueDistricts.has(r.Iid)) {
        uniqueDistricts.set(r.Iid, r);
      }
    }

    const records = [];
    for (const row of uniqueDistricts.values()) {
      const { first, last } = parseName(row.Director_Name);
      records.push({
        state: 'OR',
        district_name: row.Name,
        state_district_id: row.Iid?.toString(),
        administrator_first_name: first,
        administrator_last_name: last,
        phone: row.Voice_Phone || null,
        address: row.Mail_StrAddr1 || null,
        city: row.Mail_City || null,
        county: row.County || null
      });
    }

    console.log(`Parsed ${records.length} unique school districts`);
    console.log(`With director name: ${records.filter(r => r.administrator_last_name).length}`);

    console.log('\n=== LOADING NCES DISTRICTS ===');
    const ncesResult = await client.query(
      'SELECT nces_id, name FROM districts WHERE state = $1',
      ['OR']
    );
    console.log(`Found ${ncesResult.rows.length} NCES districts for OR`);

    console.log('\n=== CREATING AUDIT RECORD ===');
    const importResult = await client.query(`
      INSERT INTO data_imports
      (id, source_type, source_name, source_url, source_file, record_count,
       imported_at, imported_by, notes)
      VALUES (gen_random_uuid(), 'state_registry', 'ODE Institution Database', $1, 'Inst_Db_Extract_XL8.xlsx', $2,
              NOW(), 'fetch-load-or.js', 'OR school districts from ODE daily extract. Director names and phones. No emails in source.')
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
         raw_data, import_batch_id, created_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        RETURNING id
      `, [rec.state, rec.state_district_id, rec.district_name, rec.city, rec.address, rec.phone,
          rec.administrator_first_name, rec.administrator_last_name,
          JSON.stringify(rec), importId]);
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
          VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), 'fetch-load-or.js', $5, $6)
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
    if (unmatched.length > 0 && unmatched.length <= 30) {
      console.log(`\nUnmatched:`);
      unmatched.forEach(d => console.log(`  - ${d}`));
    } else if (unmatched.length > 30) {
      console.log(`\nFirst 30 unmatched:`);
      unmatched.slice(0, 30).forEach(d => console.log(`  - ${d}`));
      console.log(`  ... and ${unmatched.length - 30} more`);
    }

    const coverageResult = await client.query(`
      SELECT COUNT(*) as total, COUNT(superintendent_name) as with_supt,
             ROUND(COUNT(superintendent_name)*100.0/COUNT(*),1) as pct
      FROM national_registry WHERE state = 'OR'
    `);
    const coverage = coverageResult.rows[0];
    console.log(`\nOR Coverage: ${coverage.with_supt}/${coverage.total} (${coverage.pct}%)`);

    const overallResult = await client.query(`
      SELECT COUNT(*) as total, COUNT(superintendent_name) as with_supt,
             ROUND(COUNT(superintendent_name)*100.0/COUNT(*),1) as pct
      FROM national_registry
    `);
    const overall = overallResult.rows[0];
    console.log(`OVERALL: ${overall.with_supt}/${overall.total} (${overall.pct}%)`);

    console.log('\n=== OREGON COMPLETE ===');
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(console.error);
