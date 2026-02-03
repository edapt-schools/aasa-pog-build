/**
 * Kansas Superintendent Data - Load from CSV
 *
 * Source: KSDE Pictorial Directory of Kansas USD Superintendents
 * URL: https://www.ksde.gov/Portals/0/Communications/2024-2025-Pictorial-Directory-of-Kansas-USD-Superintendents.pdf
 * NCES: ~286 districts
 * CSV: 287 districts (286 USDs + 2 state schools)
 *
 * Note: Complete coverage of Kansas unified school districts.
 * Source PDF includes superintendent name and email.
 * 4 districts missing email ("Not in source").
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';
const SOURCE_URL = 'https://www.ksde.gov/Portals/0/Communications/2024-2025-Pictorial-Directory-of-Kansas-USD-Superintendents.pdf';

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
    .replace(/^usd\s*\d+\s*/gi, '')  // Remove USD number prefix
    .replace(/^ksd\s*/gi, '')         // Remove KSD prefix
    .replace(/^kssb\s*/gi, '')        // Remove KSSB prefix
    .replace(/unified school district/gi, '')
    .replace(/school district/gi, '')
    .replace(/public schools?/gi, '')
    .replace(/-/g, ' ')
    .replace(/[#.,()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseName(fullName) {
  if (!fullName) return { first: '', last: '' };
  let cleaned = fullName
    .replace(/^(Dr\.|Mr\.|Mrs\.|Ms\.|Miss)\s*/gi, '')
    .replace(/,?\s*(Jr\.?|Sr\.?|III|II|IV|Ed\.?S\.?|Ed\.?D\.?|Ph\.?D\.?)$/gi, '')
    .replace(/\s*\(Interim\)\s*/gi, '')
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
      ['KS']
    );
    if (parseInt(existingResult.rows[0].count) > 0) {
      console.log(`\nWARNING: KS already has ${existingResult.rows[0].count} records`);
      console.log('Skipping to avoid duplicates.');
      await client.end();
      return;
    }

    console.log('=== READING CSV ===');
    const csvPath = path.join(__dirname, '../data/processed/ks_superintendents.csv');
    const csv = fs.readFileSync(csvPath, 'utf8');
    const lines = csv.split('\n').slice(1).filter(l => l.trim());

    const records = [];
    for (const line of lines) {
      // Parse CSV - format: District,Superintendent,Email
      const parts = line.split(',');
      if (parts.length < 2) continue;

      const district = parts[0].trim();
      const superintendent = parts[1].trim();
      const email = parts[2] ? parts[2].trim() : '';

      // Extract USD number for state_district_id
      const usdMatch = district.match(/^(USD\s*\d+|KSD|KSSB)/i);
      const stateDistrictId = usdMatch ? usdMatch[1].replace(/\s+/g, ' ').toUpperCase() : district.substring(0, 20);

      const { first, last } = parseName(superintendent);

      // Skip if email is empty or invalid
      const validEmail = email && email.includes('@') ? email : null;

      // Extract website from email domain
      let websiteUrl = null;
      if (validEmail) {
        const domain = validEmail.split('@')[1];
        if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com'].includes(domain.toLowerCase())) {
          websiteUrl = 'https://' + domain;
        }
      }

      records.push({
        state: 'KS',
        district_name: district,
        state_district_id: stateDistrictId,
        administrator_first_name: first,
        administrator_last_name: last,
        administrator_email: validEmail,
        website_url: websiteUrl
      });
    }
    console.log(`Parsed ${records.length} records from CSV`);
    console.log(`Records with email: ${records.filter(r => r.administrator_email).length}`);
    console.log(`Records with website: ${records.filter(r => r.website_url).length}`);

    console.log('\n=== LOADING NCES DISTRICTS ===');
    const ncesResult = await client.query(
      'SELECT nces_id, name FROM districts WHERE state = $1',
      ['KS']
    );
    console.log(`Found ${ncesResult.rows.length} NCES districts for KS`);

    console.log('\n=== CREATING AUDIT RECORD ===');
    const importResult = await client.query(`
      INSERT INTO data_imports
      (id, source_type, source_name, source_url, source_file, record_count,
       imported_at, imported_by, notes)
      VALUES (gen_random_uuid(), 'state_registry', 'KSDE Pictorial Directory of Kansas USD Superintendents', $1, 'ks_superintendents.csv', $2,
              NOW(), 'fetch-load-ks.js', 'KS unified school districts from KSDE 2024-25 pictorial directory. Complete coverage, 4 districts missing email.')
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
        (id, state, state_district_id, district_name,
         administrator_first_name, administrator_last_name, administrator_email,
         website_url, raw_data, import_batch_id, created_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING id
      `, [rec.state, rec.state_district_id, rec.district_name,
          rec.administrator_first_name, rec.administrator_last_name, rec.administrator_email,
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
          VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), 'fetch-load-ks.js', $5, $6)
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
    if (unmatched.length > 0 && unmatched.length <= 20) {
      console.log(`\nUnmatched:`);
      unmatched.forEach(d => console.log(`  - ${d}`));
    } else if (unmatched.length > 20) {
      console.log(`\nFirst 20 unmatched:`);
      unmatched.slice(0, 20).forEach(d => console.log(`  - ${d}`));
      console.log(`  ... and ${unmatched.length - 20} more`);
    }

    const coverageResult = await client.query(`
      SELECT COUNT(*) as total, COUNT(superintendent_name) as with_supt,
             ROUND(COUNT(superintendent_name)*100.0/COUNT(*),1) as pct
      FROM national_registry WHERE state = 'KS'
    `);
    const coverage = coverageResult.rows[0];
    console.log(`\nKS Coverage: ${coverage.with_supt}/${coverage.total} (${coverage.pct}%)`);

    const overallResult = await client.query(`
      SELECT COUNT(*) as total, COUNT(superintendent_name) as with_supt,
             ROUND(COUNT(superintendent_name)*100.0/COUNT(*),1) as pct
      FROM national_registry
    `);
    const overall = overallResult.rows[0];
    console.log(`OVERALL: ${overall.with_supt}/${overall.total} (${overall.pct}%)`);

    console.log('\n=== KANSAS COMPLETE ===');
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(console.error);
