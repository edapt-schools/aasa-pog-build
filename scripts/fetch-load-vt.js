/**
 * Vermont Superintendent Data - Fetch and Load
 *
 * Source: Vermont Superintendents Association
 * URL: https://www.vtvsa.org/superintendents/
 * NCES Expected: 188 districts (but VT uses Supervisory Unions - 56 SUs/SDs)
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';
const SOURCE_URL = 'https://www.vtvsa.org/superintendents/';

// Vermont Superintendent Data (from VSA directory)
const VT_DATA = [
  { district_name: 'Addison Central School District', first: 'Wendy', last: 'Baker', email: 'wbaker@acsdvt.org', phone: '802-382-1274' },
  { district_name: 'Addison Northwest School District', first: 'Sheila', last: 'Soule', email: 'ssoule@anwsd.org', phone: '802-877-3332' },
  { district_name: 'Barre Unified Union School District', first: 'JoAn', last: 'Canning', email: 'jcannbsu@buusd.org', phone: '802-476-5011' },
  { district_name: 'Bennington-Rutland Supervisory Union', first: 'Randi', last: 'Lowe', email: 'rlowe@brsu.org', phone: '802-362-2452' },
  { district_name: 'Burlington School District', first: 'Thomas', last: 'Flanagan', email: 'tflanagan@bsdvt.org', phone: '802-865-5332' },
  { district_name: 'Caledonia Central Supervisory Union', first: 'Matt', last: 'Foster', email: 'matt.foster@ccsuvt.net', phone: '802-684-3801' },
  { district_name: 'Central Vermont Career Center School District', first: 'Jody', last: 'Emerson', email: 'jemerson@cvtcc.org', phone: '802-476-6237' },
  { district_name: 'Central Vermont Supervisory Union', first: 'Matthew', last: 'Fedders', email: 'mfedders@cvsu.org', phone: '802-433-5818' },
  { district_name: 'Champlain Valley School District', first: 'Adam', last: 'Bunting', email: 'abunting@cvsdvt.org', phone: '802-383-1234' },
  { district_name: 'Colchester School District', first: 'Amy', last: 'Minor', email: 'amy.minor@colchestersd.org', phone: '802-264-5986' },
  { district_name: 'Essex North Supervisory Union', first: 'Jennifer', last: 'Lawcewicz', email: 'jlawcewicz@ensuvt.org', phone: '802-266-3330' },
  { district_name: 'Essex Westford Educational Community UUSD', first: 'Mark', last: 'Holodick', email: 'mholodick@ewsd.org', phone: '802-878-8168' },
  { district_name: 'Franklin Northeast Supervisory Union', first: 'Lynn', last: 'Cota', email: 'lynn.cota@fnesu.org', phone: '802-848-7661' },
  { district_name: 'Franklin West Supervisory Union', first: 'John', last: 'Tague', email: 'jtague@fwsu.org', phone: '802-370-3113' },
  { district_name: 'Grand Isle Supervisory Union', first: 'Lisa', last: 'Ruud', email: 'lruud@gisu.org', phone: '802-372-6921' },
  { district_name: 'Greater Rutland County Supervisory Union', first: 'Christopher', last: 'Sell', email: 'christopher.sell@grcsu.org', phone: '802-775-4342' },
  { district_name: 'Hartford School District', first: 'Catherine', last: 'Sutton', email: 'suttonc@hartfordschools.net', phone: '802-295-8600' },
  { district_name: 'Harwood Unified Union School District', first: 'Michael G.', last: 'Leichliter', email: 'mleichliter@huusd.org', phone: '802-496-2272' },
  { district_name: 'Kingdom East School District', first: 'Sean', last: 'McMannon', email: 'smcmannon@kingdomeast.org', phone: '802-626-6100' },
  { district_name: 'Lamoille North Unified School District', first: 'Catherine', last: 'Gallagher', email: 'cgallagher@lnsd.org', phone: '802-888-3142' },
  { district_name: 'Lamoille South Supervisory Union', first: 'Ryan', last: 'Heraty', email: 'ryan.heraty@lamoillesouth.org', phone: '802-888-4541' },
  { district_name: 'Lincoln School District', first: 'Amy', last: 'Cole', email: 'acole@lincolnsd.org', phone: '802-453-2119' },
  { district_name: 'Maple Run Unified School District', first: 'Bill', last: 'Kimball', email: 'bkimball@maplerun.org', phone: '802-524-2600' },
  { district_name: 'Mill River Unified Union School District', first: 'Cheryl', last: 'Gonzalez', email: 'cgonzalez@millriverschools.org', phone: '802-775-3264' },
  { district_name: 'Milton Town School District', first: 'Amy', last: 'Rex', email: 'arex@mymtsd-vt.org', phone: '802-893-5400' },
  { district_name: 'Missisquoi Valley School District', first: 'Julie', last: 'Regimbal', email: 'julie.regimbal@mvsdschools.org', phone: '802-868-4967' },
  { district_name: 'Montpelier Roxbury School District', first: 'Libby', last: 'Bonesteel', email: 'libbyb@mpsvt.org', phone: '802-223-9796' },
  { district_name: 'Mount Abraham Unified School District', first: 'Patrick', last: 'Reen', email: 'patrick.reen@mausd.org', phone: '802-453-3657' },
  { district_name: 'Mount Mansfield Unified Union School District', first: 'John', last: 'Muldoon', email: 'john.muldoon@mmuusd.org', phone: '802-434-2128' },
  { district_name: 'Mountain Views Supervisory Union', first: 'Sherry', last: 'Sousa', email: 'ssousa@wcsu.net', phone: '802-457-1213' },
  { district_name: 'North Country Supervisory Union', first: 'Elaine', last: 'Collins', email: 'elaine.collins@ncsuvt.org', phone: '802-334-5847' },
  { district_name: 'Orange East Supervisory Union', first: 'Heather', last: 'Lawler', email: 'heather.lawler@oesu.org', phone: '802-222-5216' },
  { district_name: 'Orange Southwest Unified School District', first: 'Michael', last: 'Clark', email: 'mclark@orangesouthwest.org', phone: '802-728-5052' },
  { district_name: 'Orleans Central Supervisory Union', first: 'Jackie', last: 'Ramsay-Tolman', email: 'jramsaytolman@ocsu.org', phone: '802-525-1204' },
  { district_name: 'Orleans Southwest Supervisory Union', first: 'David', last: 'Baker', email: 'dbaker@ossu.org', phone: '802-472-6531' },
  { district_name: 'Patricia A. Hannaford Career Center School District', first: 'Nicole', last: 'MacTavish', email: 'nmactavish@pahcc.org', phone: '802-382-1012' },
  { district_name: 'Rivendell Interstate School District', first: 'Randall', last: 'Gawel', email: 'rgawel@rivendellschool.org', phone: '603-353-2170' },
  { district_name: 'River Valley Technical Center School District', first: 'Derek', last: 'Williams', email: 'dwilliams@rvtc.org', phone: '802-885-8300' },
  { district_name: 'Rutland City School District', first: 'Pamela', last: 'Reed', email: 'pam.reed@rcpsvt.org', phone: '802-773-1900' },
  { district_name: 'Rutland Northeast Supervisory Union', first: 'Rene', last: 'Sanchez', email: 'rsanchez@rnesu.org', phone: '802-247-5757' },
  { district_name: 'SAU #70', first: 'Robin', last: 'Steiner', email: 'robinsteiner@sau70.org', phone: '603-643-6050' },
  { district_name: 'Slate Valley Unified School District', first: 'Brooke', last: 'Olsen-Farrell', email: 'bfarrell@svuvt.org', phone: '802-265-4905' },
  { district_name: 'South Burlington School District', first: 'Joe', last: 'Clark', email: 'joclark@sbschools.net', phone: '802-652-7250' },
  { district_name: 'Southwest Tech', first: 'Meg', last: 'Honsinger', email: 'mhonsinger@svcdc.org', phone: '802-447-0220' },
  { district_name: 'Southwest Vermont Supervisory Union', first: 'Timothy', last: 'Payne', email: 'tpayne@svsu.org', phone: '802-447-7501' },
  { district_name: 'Springfield School District', first: 'Peter', last: 'Burrows', email: 'pburrows@ssdvt.org', phone: '802-885-5141' },
  { district_name: 'St. Johnsbury School District', first: 'Karen', last: 'Conroy', email: 'kconroy@stjsd.org', phone: '802-745-2789' },
  { district_name: 'Two Rivers Supervisory Union', first: 'Layne', last: 'Millington', email: 'layne.millington@trsu.org', phone: '802-875-3365' },
  { district_name: 'Washington Central Unified Union School District', first: 'Steven', last: 'Dellinger-Pate', email: 'sdpate@u32.org', phone: '802-229-0553' },
  { district_name: 'White River Valley Supervisory Union', first: 'Jamie', last: 'Kinnarney', email: 'jkinnarney@wrvsu.org', phone: '802-763-8840' },
  { district_name: 'Windham Central Supervisory Union', first: 'Bob', last: 'Thibault', email: 'bthibault@windhamcentral.org', phone: '802-365-9510' },
  { district_name: 'Windham Northeast Supervisory Union', first: 'Andrew', last: 'Haas', email: 'andrew.haas@wnesu.com', phone: '802-463-9958' },
  { district_name: 'Windham Southeast Supervisory Union', first: 'Mark', last: 'Speno', email: 'mspeno@wsesdvt.org', phone: '802-254-3731' },
  { district_name: 'Windham Southwest Supervisory Union', first: 'Bill', last: 'Bazyk', email: 'wbazyk@wswsu49.org', phone: '802-464-1300' },
  { district_name: 'Windsor Southeast Supervisory Union', first: 'Christine', last: 'Bourne', email: 'cbourne@wsesu.net', phone: '802-674-2144' },
  { district_name: 'Winooski School District', first: 'Wilmer', last: 'Chavarria', email: 'wchavarria@wsdvt.org', phone: '802-655-0485' }
];

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
    .replace(/supervisory union/gi, '')
    .replace(/supervisory district/gi, '')
    .replace(/unified union school district/gi, '')
    .replace(/unified school district/gi, '')
    .replace(/school district/gi, '')
    .replace(/uusd/gi, '')
    .replace(/[#.,()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Step 1: Check if already loaded
    const existingResult = await client.query(
      'SELECT COUNT(*) as count FROM state_registry_districts WHERE state = $1',
      ['VT']
    );

    if (parseInt(existingResult.rows[0].count) > 0) {
      console.log(`\nWARNING: VT already has ${existingResult.rows[0].count} records in state_registry_districts`);
      console.log('Skipping to avoid duplicates. Delete existing records first if re-loading.');
      await client.end();
      return;
    }

    // Step 2: Get NCES districts for matching
    console.log('=== LOADING NCES DISTRICTS ===');
    const ncesResult = await client.query(
      'SELECT nces_id, name FROM districts WHERE state = $1',
      ['VT']
    );
    console.log(`Found ${ncesResult.rows.length} NCES districts for VT`);
    console.log('Note: VT has many small member districts under Supervisory Unions');

    // Step 3: Save CSV
    console.log('\n=== CREATING CSV ===');
    const csvHeader = 'state,district_name,administrator_first_name,administrator_last_name,administrator_email,phone';
    const csvRows = [csvHeader];

    for (const rec of VT_DATA) {
      const row = `VT,"${rec.district_name}","${rec.first}","${rec.last}","${rec.email}","${rec.phone}"`;
      csvRows.push(row);
    }

    const csvPath = path.join(__dirname, '../data/processed/vt_superintendents.csv');
    fs.writeFileSync(csvPath, csvRows.join('\n'));
    console.log(`Saved ${VT_DATA.length} records to ${csvPath}`);

    // Step 4: Create data_imports audit record
    console.log('\n=== CREATING AUDIT RECORD ===');
    const importResult = await client.query(`
      INSERT INTO data_imports
      (id, source_type, source_name, source_url, source_file, record_count,
       imported_at, imported_by, notes)
      VALUES (gen_random_uuid(), 'state_registry', 'Vermont Superintendents Association', $1, 'vt_superintendents.csv', $2,
              NOW(), 'fetch-load-vt.js', 'Vermont superintendents from VSA directory - covers SUs/SDs which oversee member districts')
      RETURNING id
    `, [SOURCE_URL, VT_DATA.length]);

    const importId = importResult.rows[0].id;
    console.log(`Created data_imports record: ${importId}`);

    // Step 5: Load and match
    console.log('\n=== LOADING AND MATCHING ===');
    let loaded = 0, matched = 0;
    const matchStats = { exact_name: 0, fuzzy: 0, normalized_name: 0, unmatched: 0 };
    const unmatched = [];

    for (const rec of VT_DATA) {
      // Insert to state_registry_districts
      const insertResult = await client.query(`
        INSERT INTO state_registry_districts
        (id, state, state_district_id, district_name, phone,
         administrator_first_name, administrator_last_name, administrator_email,
         raw_data, import_batch_id, created_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING id
      `, [
        'VT',
        rec.district_name.substring(0, 50),  // Use truncated name as state_district_id
        rec.district_name,
        rec.phone,
        rec.first,
        rec.last,
        rec.email,
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
          VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), 'fetch-load-vt.js', $5, $6)
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
      WHERE state = 'VT'
    `);

    const coverage = coverageResult.rows[0];
    console.log(`\nVT Coverage: ${coverage.with_supt}/${coverage.total} (${coverage.pct}%)`);

    // Overall coverage
    const overallResult = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(superintendent_name) as with_supt,
             ROUND(COUNT(superintendent_name)*100.0/COUNT(*),1) as pct
      FROM national_registry
    `);

    const overall = overallResult.rows[0];
    console.log(`OVERALL: ${overall.with_supt}/${overall.total} (${overall.pct}%)`);

    console.log('\n=== VERMONT COMPLETE ===');

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(console.error);
