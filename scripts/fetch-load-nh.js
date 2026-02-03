/**
 * New Hampshire Superintendent Data - Load from CSV
 *
 * Source: NH Department of Education Superintendents List
 * URL: https://my.doe.nh.gov/Profiles/PublicReports/PublicReports.aspx?ReportName=SupList
 * NCES: ~210 districts
 * CSV: 109 SAUs (administrative units serving multiple districts)
 *
 * Note: NH uses SAUs (School Administrative Units) not traditional districts.
 * One SAU superintendent may serve multiple NCES districts.
 * Matching is done via email domain and known mappings.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';
const SOURCE_URL = 'https://my.doe.nh.gov/Profiles/PublicReports/PublicReports.aspx?ReportName=SupList';

// Known SAU to district mappings (from email domains and common knowledge)
const SAU_DISTRICT_MAP = {
  '11': ['Dover School District'],
  '12': ['Londonderry School District'],
  '27': ['Litchfield School District'],
  '28': ['Pelham School District'],
  '30': ['Laconia School District'],
  '37': ['Manchester School District'],
  '42': ['Nashua School District'],
  '52': ['Portsmouth School District'],
  '54': ['Rochester School District'],
  '56': ['Somersworth School District'],
  '57': ['Salem School District'],
  '64': ['Milton School District'],
  '81': ['Hudson School District'],
  '95': ['Windham School District'],
  '10': ['Derry School District', 'Derry Cooperative School District'],
  '16': ['Exeter Region Cooperative School District'],
  '21': ['Hampton School District'],
  '25': ['Bedford School District'],
  '26': ['Merrimack School District'],
  '67': ['Bow School District'],
  '74': ['Barrington School District'],
};

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
    .replace(/school district/gi, '')
    .replace(/cooperative school district/gi, '')
    .replace(/regional school district/gi, '')
    .replace(/sau \d+/gi, '')
    .replace(/[#.,()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

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

// Extract district hint from email domain
function getDistrictFromEmail(email) {
  if (!email) return null;
  const domain = email.split('@')[1];
  if (!domain) return null;

  // Common patterns: cityschools.org, city.k12.nh.us, sau#.org
  const subdomain = domain.split('.')[0]
    .replace(/schools?|sd|k12|sau\d*/gi, '')
    .replace(/[^a-z]/gi, '');

  if (subdomain.length >= 3) {
    return subdomain;
  }
  return null;
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Step 1: Check if already loaded
    const existingResult = await client.query(
      'SELECT COUNT(*) as count FROM state_registry_districts WHERE state = $1',
      ['NH']
    );

    if (parseInt(existingResult.rows[0].count) > 0) {
      console.log(`\nWARNING: NH already has ${existingResult.rows[0].count} records in state_registry_districts`);
      console.log('Skipping to avoid duplicates. Delete existing records first if re-loading.');
      await client.end();
      return;
    }

    // Step 2: Read CSV
    console.log('=== READING CSV ===');
    const csvPath = path.join(__dirname, '../data/processed/nh_superintendents.csv');
    const csv = fs.readFileSync(csvPath, 'utf8');
    const lines = csv.split('\n').slice(1).filter(l => l.trim());

    const records = [];
    const seenSAUs = new Set();

    for (const line of lines) {
      const parts = line.split(',');
      if (parts.length < 5) continue;

      const [state, district, superintendent, email, phone] = parts;
      const { first, last } = parseName(superintendent);

      // Extract SAU number
      const sauMatch = district.match(/SAU (\d+)/);
      const sauNum = sauMatch ? sauMatch[1] : district;

      // Skip duplicates (some SAUs have multiple entries for sub-districts)
      if (seenSAUs.has(sauNum)) continue;
      seenSAUs.add(sauNum);

      records.push({
        state: 'NH',
        district_name: district,
        state_district_id: sauNum,
        administrator_first_name: first,
        administrator_last_name: last,
        administrator_email: email || null,
        phone: phone || null,
        sau_number: sauNum
      });
    }

    console.log(`Parsed ${records.length} unique SAU records from CSV`);

    // Step 3: Get NCES districts for matching
    console.log('\n=== LOADING NCES DISTRICTS ===');
    const ncesResult = await client.query(
      'SELECT nces_id, name FROM districts WHERE state = $1',
      ['NH']
    );
    console.log(`Found ${ncesResult.rows.length} NCES districts for NH`);

    // Step 4: Create data_imports audit record
    console.log('\n=== CREATING AUDIT RECORD ===');
    const importResult = await client.query(`
      INSERT INTO data_imports
      (id, source_type, source_name, source_url, source_file, record_count,
       imported_at, imported_by, notes)
      VALUES (gen_random_uuid(), 'state_registry', 'NH DOE Superintendents List', $1, 'nh_superintendents.csv', $2,
              NOW(), 'fetch-load-nh.js', 'NH SAUs from DOE. One superintendent serves multiple districts.')
      RETURNING id
    `, [SOURCE_URL, records.length]);

    const importId = importResult.rows[0].id;
    console.log(`Created data_imports record: ${importId}`);

    // Step 5: Load and match
    console.log('\n=== LOADING AND MATCHING ===');
    let loaded = 0, matched = 0;
    const matchStats = { exact_name: 0, exact_id: 0, fuzzy: 0, normalized_name: 0, unmatched: 0, sau_map: 0 };
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

      // Strategy 1: Check SAU mapping table
      const mappedDistricts = SAU_DISTRICT_MAP[rec.sau_number];
      if (mappedDistricts) {
        for (const mappedName of mappedDistricts) {
          const normalizedMapped = normalizeDistrictName(mappedName);
          for (const nces of ncesResult.rows) {
            const normalizedNces = normalizeDistrictName(nces.name);
            if (normalizedMapped === normalizedNces || jaroWinkler(normalizedMapped, normalizedNces) >= 0.90) {
              await client.query(`
                INSERT INTO district_matches
                (id, nces_id, state_registry_id, match_method, match_confidence,
                 matched_at, matched_by, flag_for_review, match_details)
                VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), 'fetch-load-nh.js', $5, $6)
              `, [
                nces.nces_id,
                stateRegistryId,
                'exact_name',
                0.95,
                false,
                JSON.stringify({
                  state_name: rec.district_name,
                  nces_name: nces.name,
                  sau_number: rec.sau_number,
                  match_source: 'sau_map'
                })
              ]);
              matched++;
              matchStats.sau_map++;
              break;
            }
          }
        }
        continue;
      }

      // Strategy 2: Email domain matching
      const emailHint = getDistrictFromEmail(rec.administrator_email);
      let bestMatch = null;
      let bestScore = 0;
      let matchMethod = null;

      for (const nces of ncesResult.rows) {
        const normalizedNces = normalizeDistrictName(nces.name);

        // Check email hint match
        if (emailHint && nces.name.toLowerCase().includes(emailHint)) {
          bestMatch = nces;
          bestScore = 0.90;
          matchMethod = 'normalized_name';
          break;
        }

        // Fuzzy match on SAU name
        const score = jaroWinkler(rec.district_name.toLowerCase(), normalizedNces);
        if (score > bestScore && score >= 0.75) {
          bestMatch = nces;
          bestScore = score;
          matchMethod = score >= 0.85 ? 'normalized_name' : 'fuzzy';
        }
      }

      if (bestMatch) {
        await client.query(`
          INSERT INTO district_matches
          (id, nces_id, state_registry_id, match_method, match_confidence,
           matched_at, matched_by, flag_for_review, match_details)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), 'fetch-load-nh.js', $5, $6)
        `, [
          bestMatch.nces_id,
          stateRegistryId,
          matchMethod,
          bestScore,
          bestScore < 0.85,
          JSON.stringify({
            state_name: rec.district_name,
            nces_name: bestMatch.name,
            sau_number: rec.sau_number,
            email_hint: emailHint,
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
    console.log(`  sau_map: ${matchStats.sau_map}`);
    console.log(`  exact_name: ${matchStats.exact_name}`);
    console.log(`  normalized_name: ${matchStats.normalized_name || 0}`);
    console.log(`  fuzzy: ${matchStats.fuzzy || 0}`);
    console.log(`  unmatched: ${matchStats.unmatched}`);

    if (unmatched.length > 0 && unmatched.length <= 30) {
      console.log(`\nUnmatched SAUs:`);
      unmatched.forEach(d => console.log(`  - ${d}`));
    } else if (unmatched.length > 30) {
      console.log(`\nFirst 30 unmatched SAUs:`);
      unmatched.slice(0, 30).forEach(d => console.log(`  - ${d}`));
      console.log(`  ... and ${unmatched.length - 30} more`);
    }

    // Check coverage
    const coverageResult = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(superintendent_name) as with_supt,
             ROUND(COUNT(superintendent_name)*100.0/COUNT(*),1) as pct
      FROM national_registry
      WHERE state = 'NH'
    `);

    const coverage = coverageResult.rows[0];
    console.log(`\nNH Coverage: ${coverage.with_supt}/${coverage.total} (${coverage.pct}%)`);

    // Overall coverage
    const overallResult = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(superintendent_name) as with_supt,
             ROUND(COUNT(superintendent_name)*100.0/COUNT(*),1) as pct
      FROM national_registry
    `);

    const overall = overallResult.rows[0];
    console.log(`OVERALL: ${overall.with_supt}/${overall.total} (${overall.pct}%)`);

    console.log('\n=== NEW HAMPSHIRE COMPLETE ===');

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(console.error);
