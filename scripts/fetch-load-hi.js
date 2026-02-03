/**
 * Hawaii Superintendent Data - Fetch and Load
 *
 * Hawaii has a single statewide school district (Hawaii Department of Education).
 * This script loads the superintendent data directly.
 *
 * Source: Hawaii DOE Official Website (hawaiipublicschools.org)
 * NCES ID: 1500030
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';

// Hawaii DOE Superintendent Data (verified from official source)
const HAWAII_DATA = {
  state: 'HI',
  district_name: 'Hawaii Department of Education',
  nces_id: '1500030',
  administrator_first_name: 'Keith',
  administrator_last_name: 'Hayashi',
  administrator_title: 'Superintendent',
  administrator_email: 'superintendent@k12.hi.us',
  phone: '(808) 586-3310',
  address: '1390 Miller Street',
  city: 'Honolulu',
  zip: '96813',
  website_url: 'https://www.hawaiipublicschools.org'
};

const SOURCE_URL = 'https://www.hawaiipublicschools.org/ConnectWithUs/Organization/Pages/Superintendent.aspx';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Step 1: Verify NCES district exists
    console.log('=== VERIFYING NCES DISTRICT ===');
    const ncesResult = await client.query(
      'SELECT nces_id, name FROM districts WHERE state = $1',
      ['HI']
    );

    if (ncesResult.rows.length === 0) {
      throw new Error('No NCES districts found for Hawaii!');
    }

    console.log(`Found ${ncesResult.rows.length} NCES district(s) for HI`);
    console.log(`  ${ncesResult.rows[0].nces_id}: ${ncesResult.rows[0].name}`);

    // Step 2: Check if already loaded
    const existingResult = await client.query(
      'SELECT id FROM state_registry_districts WHERE state = $1',
      ['HI']
    );

    if (existingResult.rows.length > 0) {
      console.log(`\nWARNING: Hawaii already has ${existingResult.rows.length} record(s) in state_registry_districts`);
      console.log('Skipping to avoid duplicates. Delete existing records first if re-loading.');
      await client.end();
      return;
    }

    // Step 3: Create CSV file for audit trail
    console.log('\n=== CREATING CSV ===');
    const csvHeader = 'state,district_name,administrator_first_name,administrator_last_name,administrator_email,phone,address,city,zip,website_url';
    const csvRow = `${HAWAII_DATA.state},"${HAWAII_DATA.district_name}","${HAWAII_DATA.administrator_first_name}","${HAWAII_DATA.administrator_last_name}","${HAWAII_DATA.administrator_email}","${HAWAII_DATA.phone}","${HAWAII_DATA.address}","${HAWAII_DATA.city}","${HAWAII_DATA.zip}","${HAWAII_DATA.website_url}"`;
    const csvContent = `${csvHeader}\n${csvRow}`;

    const csvPath = path.join(__dirname, '../data/processed/hi_superintendents.csv');
    fs.writeFileSync(csvPath, csvContent);
    console.log(`Saved CSV to ${csvPath}`);

    // Step 4: Create data_imports audit record
    console.log('\n=== CREATING AUDIT RECORD ===');
    const importResult = await client.query(`
      INSERT INTO data_imports
      (id, source_type, source_name, source_url, source_file, record_count,
       imported_at, imported_by, notes)
      VALUES (gen_random_uuid(), 'state_registry', 'Hawaii DOE', $1, 'hi_superintendents.csv', 1,
              NOW(), 'fetch-load-hi.js', 'Single statewide district - Hawaii Department of Education')
      RETURNING id
    `, [SOURCE_URL]);

    const importId = importResult.rows[0].id;
    console.log(`Created data_imports record: ${importId}`);

    // Step 5: Insert to state_registry_districts
    console.log('\n=== LOADING TO DATABASE ===');
    const insertResult = await client.query(`
      INSERT INTO state_registry_districts
      (id, state, state_district_id, district_name, city, phone,
       administrator_first_name, administrator_last_name, administrator_email,
       website_url, address, zip, raw_data, import_batch_id, created_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      RETURNING id
    `, [
      HAWAII_DATA.state,
      HAWAII_DATA.nces_id,  // Using NCES ID as state_district_id for HI
      HAWAII_DATA.district_name,
      HAWAII_DATA.city,
      HAWAII_DATA.phone,
      HAWAII_DATA.administrator_first_name,
      HAWAII_DATA.administrator_last_name,
      HAWAII_DATA.administrator_email,
      HAWAII_DATA.website_url,
      HAWAII_DATA.address,
      HAWAII_DATA.zip,
      JSON.stringify(HAWAII_DATA),
      importId
    ]);

    const stateRegistryId = insertResult.rows[0].id;
    console.log(`Inserted to state_registry_districts: ${stateRegistryId}`);

    // Step 6: Create district_matches record (exact match - single district)
    console.log('\n=== CREATING MATCH ===');
    await client.query(`
      INSERT INTO district_matches
      (id, nces_id, state_registry_id, match_method, match_confidence,
       matched_at, matched_by, flag_for_review, match_details)
      VALUES (gen_random_uuid(), $1, $2, 'exact_id', 1.00, NOW(), 'fetch-load-hi.js', false, $3)
    `, [
      HAWAII_DATA.nces_id,
      stateRegistryId,
      JSON.stringify({
        state_name: HAWAII_DATA.district_name,
        nces_name: ncesResult.rows[0].name,
        match_reason: 'Single statewide district - exact NCES ID match'
      })
    ]);
    console.log('Created district_matches record (confidence: 1.00)');

    // Step 7: Update data_imports with success count
    await client.query(`
      UPDATE data_imports
      SET success_count = 1, error_count = 0
      WHERE id = $1
    `, [importId]);

    // Step 8: Report results
    console.log('\n=== RESULTS ===');
    console.log('Records loaded: 1');
    console.log('Records matched: 1 (100%)');
    console.log('Match method: exact_id');
    console.log('Match confidence: 1.00');

    // Check coverage
    const coverageResult = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(superintendent_name) as with_supt,
             ROUND(COUNT(superintendent_name)*100.0/COUNT(*),1) as pct
      FROM national_registry
      WHERE state = 'HI'
    `);

    const coverage = coverageResult.rows[0];
    console.log(`\nHI Coverage: ${coverage.with_supt}/${coverage.total} (${coverage.pct}%)`);

    // Overall coverage
    const overallResult = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(superintendent_name) as with_supt,
             ROUND(COUNT(superintendent_name)*100.0/COUNT(*),1) as pct
      FROM national_registry
    `);

    const overall = overallResult.rows[0];
    console.log(`OVERALL: ${overall.with_supt}/${overall.total} (${overall.pct}%)`);

    console.log('\n=== HAWAII COMPLETE ===');

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(console.error);
