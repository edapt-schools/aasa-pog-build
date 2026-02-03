/**
 * Indiana Superintendent Data - Load from CSV
 *
 * Source: Indiana Department of Education School Directory
 * URL: https://www.in.gov/doe/it/data-center-and-reports/
 * NCES: ~290 districts
 * CSV: 290 school corporations with NCES IDs
 *
 * Note: Excellent source - includes NCES IDs for exact matching!
 * Data includes superintendent names, emails, and phone numbers.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';
const SOURCE_URL = 'https://www.in.gov/doe/it/data-center-and-reports/';

// Parse superintendent name
function parseName(fullName) {
  if (!fullName) return { first: '', last: '' };
  let cleaned = fullName
    .replace(/^(Dr\.|Mr\.|Mrs\.|Ms\.|Miss)\s*/gi, '')
    .replace(/,?\s*(Jr\.?|Sr\.?|III|II|IV)$/gi, '')
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

    // Step 1: Check if already loaded
    const existingResult = await client.query(
      'SELECT COUNT(*) as count FROM state_registry_districts WHERE state = $1',
      ['IN']
    );

    if (parseInt(existingResult.rows[0].count) > 0) {
      console.log(`\nWARNING: IN already has ${existingResult.rows[0].count} records in state_registry_districts`);
      console.log('Skipping to avoid duplicates. Delete existing records first if re-loading.');
      await client.end();
      return;
    }

    // Step 2: Read CSV
    console.log('=== READING CSV ===');
    const csvPath = path.join(__dirname, '../data/processed/in_superintendents.csv');
    const csv = fs.readFileSync(csvPath, 'utf8');
    const lines = csv.split('\n').slice(1).filter(l => l.trim());

    const records = [];
    for (const line of lines) {
      // Parse CSV: State,District,Superintendent,Email,Phone,Title,NCES_ID
      const parts = line.split(',');
      if (parts.length < 7) continue;

      const [state, district, superintendent, email, phone, title, ncesId] = parts;
      const { first, last } = parseName(superintendent);

      records.push({
        state: 'IN',
        district_name: district,
        state_district_id: ncesId,
        administrator_first_name: first,
        administrator_last_name: last,
        administrator_email: email || null,
        phone: phone || null,
        nces_id: ncesId
      });
    }

    console.log(`Parsed ${records.length} records from CSV`);

    // Step 3: Get NCES districts for matching
    console.log('\n=== LOADING NCES DISTRICTS ===');
    const ncesResult = await client.query(
      'SELECT nces_id, name FROM districts WHERE state = $1',
      ['IN']
    );
    const ncesMap = new Map(ncesResult.rows.map(r => [r.nces_id, r]));
    console.log(`Found ${ncesResult.rows.length} NCES districts for IN`);

    // Step 4: Create data_imports audit record
    console.log('\n=== CREATING AUDIT RECORD ===');
    const importResult = await client.query(`
      INSERT INTO data_imports
      (id, source_type, source_name, source_url, source_file, record_count,
       imported_at, imported_by, notes)
      VALUES (gen_random_uuid(), 'state_registry', 'Indiana DOE School Directory', $1, 'in_superintendents.csv', $2,
              NOW(), 'fetch-load-in.js', 'IN school corporations from DOE. Includes NCES IDs for exact matching.')
      RETURNING id
    `, [SOURCE_URL, records.length]);

    const importId = importResult.rows[0].id;
    console.log(`Created data_imports record: ${importId}`);

    // Step 5: Load and match
    console.log('\n=== LOADING AND MATCHING ===');
    let loaded = 0, matched = 0;
    const matchStats = { exact_id: 0, unmatched: 0 };
    const unmatched = [];

    for (const rec of records) {
      // Insert to state_registry_districts
      const insertResult = await client.query(`
        INSERT INTO state_registry_districts
        (id, state, state_district_id, district_name, phone,
         administrator_first_name, administrator_last_name, administrator_email,
         raw_data, import_batch_id, created_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING id
      `, [
        rec.state,
        rec.state_district_id,
        rec.district_name,
        rec.phone,
        rec.administrator_first_name,
        rec.administrator_last_name,
        rec.administrator_email,
        JSON.stringify(rec),
        importId
      ]);

      const stateRegistryId = insertResult.rows[0].id;
      loaded++;

      // Match by NCES ID (exact match)
      const ncesDistrict = ncesMap.get(rec.nces_id);

      if (ncesDistrict) {
        await client.query(`
          INSERT INTO district_matches
          (id, nces_id, state_registry_id, match_method, match_confidence,
           matched_at, matched_by, flag_for_review, match_details)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), 'fetch-load-in.js', $5, $6)
        `, [
          ncesDistrict.nces_id,
          stateRegistryId,
          'exact_id',
          1.00,  // Perfect confidence for NCES ID match
          false,
          JSON.stringify({
            state_name: rec.district_name,
            nces_name: ncesDistrict.name,
            nces_id: rec.nces_id,
            match_source: 'nces_id'
          })
        ]);
        matched++;
        matchStats.exact_id++;
      } else {
        matchStats.unmatched++;
        unmatched.push(`${rec.district_name} (NCES: ${rec.nces_id})`);
      }
    }

    // Step 6: Update import record
    await client.query(`
      UPDATE data_imports
      SET success_count = $1, error_count = $2
      WHERE id = $3
    `, [loaded, 0, importId]);

    // Step 7: Report results
    console.log('\n=== RESULTS ===');
    console.log(`Records loaded: ${loaded}`);
    console.log(`Records matched: ${matched} (${(matched/loaded*100).toFixed(1)}%)`);
    console.log(`\nMatch breakdown:`);
    console.log(`  exact_id: ${matchStats.exact_id}`);
    console.log(`  unmatched: ${matchStats.unmatched}`);

    if (unmatched.length > 0 && unmatched.length <= 20) {
      console.log(`\nUnmatched districts:`);
      unmatched.forEach(d => console.log(`  - ${d}`));
    } else if (unmatched.length > 20) {
      console.log(`\nFirst 20 unmatched districts:`);
      unmatched.slice(0, 20).forEach(d => console.log(`  - ${d}`));
      console.log(`  ... and ${unmatched.length - 20} more`);
    }

    // Check coverage
    const coverageResult = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(superintendent_name) as with_supt,
             ROUND(COUNT(superintendent_name)*100.0/COUNT(*),1) as pct
      FROM national_registry
      WHERE state = 'IN'
    `);

    const coverage = coverageResult.rows[0];
    console.log(`\nIN Coverage: ${coverage.with_supt}/${coverage.total} (${coverage.pct}%)`);

    // Overall coverage
    const overallResult = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(superintendent_name) as with_supt,
             ROUND(COUNT(superintendent_name)*100.0/COUNT(*),1) as pct
      FROM national_registry
    `);

    const overall = overallResult.rows[0];
    console.log(`OVERALL: ${overall.with_supt}/${overall.total} (${overall.pct}%)`);

    console.log('\n=== INDIANA COMPLETE ===');

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(console.error);
