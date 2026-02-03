/**
 * West Virginia Superintendent Data - Fetch and Load
 *
 * Source: WVDE Official County Superintendent List (Excel)
 * URL: https://static.k12.wv.us/school-directory/County-Superintendent-List.xlsx
 * NCES Expected: 65 districts (55 counties + cooperatives/virtual schools)
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const DATABASE_URL = 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';
const SOURCE_URL = 'https://static.k12.wv.us/school-directory/County-Superintendent-List.xlsx';

// Jaro-Winkler similarity for fuzzy matching
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

// Normalize district name for matching
function normalizeDistrictName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/county schools/gi, '')
    .replace(/county school district/gi, '')
    .replace(/school district/gi, '')
    .replace(/schools/gi, '')
    .replace(/county/gi, '')
    .replace(/[#.,()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Parse superintendent name
function parseName(fullName, title) {
  if (!fullName) return { first: '', last: '' };
  let cleaned = fullName
    .replace(/^(Dr\.|Mr\.|Mrs\.|Ms\.|Miss)\s*/gi, '')
    .replace(/,?\s*(Interim|Acting)$/gi, '')
    .replace(/,?\s*Jr\.?$/gi, ' Jr.')
    .trim();

  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return { first: '', last: parts[0] };
  if (parts.length === 2) return { first: parts[0], last: parts[1] };

  // Handle "Jr." at the end
  if (parts[parts.length - 1].toLowerCase() === 'jr.' || parts[parts.length - 1].toLowerCase() === 'jr') {
    return { first: parts[0], last: parts.slice(1).join(' ') };
  }

  return { first: parts[0], last: parts.slice(1).join(' ') };
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Step 1: Parse Excel file
    console.log('=== PARSING EXCEL FILE ===');
    const xlsxPath = path.join(__dirname, '../data/raw/wv_superintendents.xlsx');
    const workbook = XLSX.readFile(xlsxPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet);

    // Map Excel columns to readable names
    // __EMPTY: County, __EMPTY_2: Phone, __EMPTY_4: Email, __EMPTY_5: Title,
    // __EMPTY_6: Superintendent, __EMPTY_7: Address, __EMPTY_8: City, __EMPTY_9: Zip

    const records = [];
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      const county = row['__EMPTY'];
      const superintendent = row['__EMPTY_6'];

      // Skip invalid rows
      if (!county || !superintendent ||
          county.includes('State Board') ||
          county.includes('Director') ||
          county === 'MCC:') continue;

      // Clean phone number (add area code 304)
      let phone = row['__EMPTY_2'] || '';
      phone = phone.toString().replace(/[^\d-]/g, '');
      if (phone && !phone.startsWith('304')) {
        phone = '(304) ' + phone;
      }

      // Clean email (trim whitespace)
      const email = (row['__EMPTY_4'] || '').trim();

      const { first, last } = parseName(superintendent, row['__EMPTY_5']);

      // Build district name based on type
      let districtName;
      if (['WVSDT', 'WVSDB'].includes(county)) {
        districtName = county === 'WVSDB' ? 'WV School For The Deaf & Blind' : 'WV Schools of Diversion & Transition';
      } else if (county.includes('-') || ['Fred Eberle', 'James Rumsey', 'Mid Ohio Valley', 'South Branch', 'United'].includes(county)) {
        // Multi-county career centers
        districtName = county;
      } else {
        districtName = county + ' County Schools';
      }

      records.push({
        state: 'WV',
        district_name: districtName,
        original_county: county,
        administrator_first_name: first,
        administrator_last_name: last,
        administrator_email: email,
        phone: phone,
        address: row['__EMPTY_7'] || '',
        city: row['__EMPTY_8'] || '',
        zip: row['__EMPTY_9'] || ''
      });
    }

    console.log(`Parsed ${records.length} records from Excel`);

    // Step 2: Check if already loaded
    const existingResult = await client.query(
      'SELECT COUNT(*) as count FROM state_registry_districts WHERE state = $1',
      ['WV']
    );

    if (parseInt(existingResult.rows[0].count) > 0) {
      console.log(`\nWARNING: WV already has ${existingResult.rows[0].count} records in state_registry_districts`);
      console.log('Skipping to avoid duplicates. Delete existing records first if re-loading.');
      await client.end();
      return;
    }

    // Step 3: Get NCES districts for matching
    console.log('\n=== LOADING NCES DISTRICTS ===');
    const ncesResult = await client.query(
      'SELECT nces_id, name FROM districts WHERE state = $1',
      ['WV']
    );
    console.log(`Found ${ncesResult.rows.length} NCES districts for WV`);

    // Step 4: Save CSV
    console.log('\n=== CREATING CSV ===');
    const csvHeader = 'state,district_name,administrator_first_name,administrator_last_name,administrator_email,phone,address,city,zip';
    const csvRows = [csvHeader];

    for (const rec of records) {
      const row = `${rec.state},"${rec.district_name}","${rec.administrator_first_name}","${rec.administrator_last_name}","${rec.administrator_email}","${rec.phone}","${rec.address}","${rec.city}","${rec.zip}"`;
      csvRows.push(row);
    }

    const csvPath = path.join(__dirname, '../data/processed/wv_superintendents.csv');
    fs.writeFileSync(csvPath, csvRows.join('\n'));
    console.log(`Saved ${records.length} records to ${csvPath}`);

    // Step 5: Create data_imports audit record
    console.log('\n=== CREATING AUDIT RECORD ===');
    const importResult = await client.query(`
      INSERT INTO data_imports
      (id, source_type, source_name, source_url, source_file, record_count,
       imported_at, imported_by, notes)
      VALUES (gen_random_uuid(), 'state_registry', 'WVDE County Superintendent List', $1, 'wv_superintendents.csv', $2,
              NOW(), 'fetch-load-wv.js', 'West Virginia county superintendents from official WVDE Excel file')
      RETURNING id
    `, [SOURCE_URL, records.length]);

    const importId = importResult.rows[0].id;
    console.log(`Created data_imports record: ${importId}`);

    // Step 6: Load and match
    console.log('\n=== LOADING AND MATCHING ===');
    let loaded = 0, matched = 0;
    const matchStats = { exact_name: 0, fuzzy: 0, unmatched: 0 };
    const unmatched = [];

    for (const rec of records) {
      // Insert to state_registry_districts
      const insertResult = await client.query(`
        INSERT INTO state_registry_districts
        (id, state, state_district_id, district_name, city, phone,
         administrator_first_name, administrator_last_name, administrator_email,
         address, zip, raw_data, import_batch_id, created_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        RETURNING id
      `, [
        rec.state,
        rec.original_county,  // Use county name as state district ID
        rec.district_name,
        rec.city,
        rec.phone,
        rec.administrator_first_name,
        rec.administrator_last_name,
        rec.administrator_email,
        rec.address,
        rec.zip,
        JSON.stringify(rec),
        importId
      ]);

      const stateRegistryId = insertResult.rows[0].id;
      loaded++;

      // Find best NCES match
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
          VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), 'fetch-load-wv.js', $5, $6)
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

    // Step 7: Update import record
    await client.query(`
      UPDATE data_imports
      SET success_count = $1, error_count = $2
      WHERE id = $3
    `, [loaded, 0, importId]);

    // Step 8: Report results
    console.log('\n=== RESULTS ===');
    console.log(`Records loaded: ${loaded}`);
    console.log(`Records matched: ${matched} (${(matched/loaded*100).toFixed(1)}%)`);
    console.log(`\nMatch breakdown:`);
    console.log(`  exact_name: ${matchStats.exact_name}`);
    console.log(`  fuzzy: ${matchStats.fuzzy || 0}`);
    console.log(`  normalized_name: ${matchStats.normalized_name || 0}`);
    console.log(`  unmatched: ${matchStats.unmatched}`);

    if (unmatched.length > 0) {
      console.log(`\nUnmatched districts:`);
      unmatched.forEach(d => console.log(`  - ${d}`));
    }

    // Check coverage
    const coverageResult = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(superintendent_name) as with_supt,
             ROUND(COUNT(superintendent_name)*100.0/COUNT(*),1) as pct
      FROM national_registry
      WHERE state = 'WV'
    `);

    const coverage = coverageResult.rows[0];
    console.log(`\nWV Coverage: ${coverage.with_supt}/${coverage.total} (${coverage.pct}%)`);

    // Overall coverage
    const overallResult = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(superintendent_name) as with_supt,
             ROUND(COUNT(superintendent_name)*100.0/COUNT(*),1) as pct
      FROM national_registry
    `);

    const overall = overallResult.rows[0];
    console.log(`OVERALL: ${overall.with_supt}/${overall.total} (${overall.pct}%)`);

    console.log('\n=== WEST VIRGINIA COMPLETE ===');

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(console.error);
