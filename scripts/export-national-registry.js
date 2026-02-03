/**
 * National Registry Export Script
 *
 * Exports the unified national_registry view to CSV with quality tier classification.
 *
 * Quality Tiers:
 *   A - Has website + superintendent name + email
 *   B - Has website + superintendent name (no email)
 *   C - Has website only (no superintendent)
 *   D - Has superintendent but no website
 *   E - No website, no superintendent
 *
 * Usage:
 *   node scripts/export-national-registry.js [--state XX]
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';

// Parse command line args
const args = process.argv.slice(2);
let stateFilter = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--state' && args[i + 1]) {
    stateFilter = args[i + 1].toUpperCase();
    i++;
  }
}

/**
 * Compute quality tier based on data completeness
 */
function computeQualityTier(row) {
  const hasWebsite = row.website && row.website.trim() !== '';
  const hasSupt = row.superintendent_name && row.superintendent_name.trim() !== '';
  const hasEmail = row.superintendent_email && row.superintendent_email.trim() !== '';

  if (hasWebsite && hasSupt && hasEmail) return 'A';
  if (hasWebsite && hasSupt) return 'B';
  if (hasWebsite) return 'C';
  if (hasSupt) return 'D';
  return 'E';
}

/**
 * Parse superintendent name into first/last
 */
function parseSuptName(fullName) {
  if (!fullName || fullName.trim() === '') {
    return { first: '', last: '' };
  }

  const name = fullName.trim();

  // Handle "Last, First" format
  if (name.includes(',')) {
    const [last, first] = name.split(',').map(s => s.trim());
    return { first: first || '', last: last || '' };
  }

  // Handle "First Last" format
  const parts = name.split(/\s+/);
  if (parts.length === 1) {
    return { first: '', last: parts[0] };
  }
  if (parts.length === 2) {
    return { first: parts[0], last: parts[1] };
  }

  // Multiple parts - first word is first name, rest is last
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

/**
 * Escape a value for CSV
 */
function escapeCsv(str) {
  if (str === null || str === undefined) return '';
  const s = String(str);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  console.log('=== National Registry Export ===\n');

  // Build query
  let query = `
    SELECT
      nces_id,
      state,
      district_name,
      superintendent_name,
      superintendent_email,
      website,
      phone,
      city,
      county,
      enrollment,
      grades_served
    FROM national_registry
  `;
  const params = [];

  if (stateFilter) {
    query += ` WHERE state = $1`;
    params.push(stateFilter);
    console.log(`Filtering by state: ${stateFilter}`);
  }

  query += ` ORDER BY state, district_name`;

  console.log('Fetching records from national_registry...');
  const result = await client.query(query, params);
  console.log(`Found ${result.rows.length} records\n`);

  // Prepare output file
  const date = new Date().toISOString().slice(0, 10);
  const suffix = stateFilter ? `_${stateFilter}` : '';
  const outputPath = path.join(__dirname, `../data/exports/national_registry${suffix}_${date}.csv`);

  // Ensure exports directory exists
  const exportsDir = path.dirname(outputPath);
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  // Write CSV header
  const header = [
    'nces_id',
    'state',
    'district_name',
    'superintendent_first_name',
    'superintendent_last_name',
    'superintendent_email',
    'website_url',
    'phone',
    'city',
    'county',
    'enrollment',
    'grades_served',
    'data_quality_tier'
  ].join(',') + '\n';

  fs.writeFileSync(outputPath, header);

  // Track tier stats
  const tierStats = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  // Process and write each record
  for (const row of result.rows) {
    const tier = computeQualityTier(row);
    tierStats[tier]++;

    const { first, last } = parseSuptName(row.superintendent_name);

    const csvLine = [
      escapeCsv(row.nces_id),
      escapeCsv(row.state),
      escapeCsv(row.district_name),
      escapeCsv(first),
      escapeCsv(last),
      escapeCsv(row.superintendent_email),
      escapeCsv(row.website),
      escapeCsv(row.phone),
      escapeCsv(row.city),
      escapeCsv(row.county),
      escapeCsv(row.enrollment),
      escapeCsv(row.grades_served),
      tier
    ].join(',') + '\n';

    fs.appendFileSync(outputPath, csvLine);
  }

  // Summary
  console.log('=== EXPORT COMPLETE ===\n');
  console.log(`Total records: ${result.rows.length}`);
  console.log(`\nQuality Tier Distribution:`);
  console.log(`  Tier A (website + supt + email): ${tierStats.A} (${(tierStats.A/result.rows.length*100).toFixed(1)}%)`);
  console.log(`  Tier B (website + supt):         ${tierStats.B} (${(tierStats.B/result.rows.length*100).toFixed(1)}%)`);
  console.log(`  Tier C (website only):           ${tierStats.C} (${(tierStats.C/result.rows.length*100).toFixed(1)}%)`);
  console.log(`  Tier D (supt, no website):       ${tierStats.D} (${(tierStats.D/result.rows.length*100).toFixed(1)}%)`);
  console.log(`  Tier E (minimal data):           ${tierStats.E} (${(tierStats.E/result.rows.length*100).toFixed(1)}%)`);

  const goodTiers = tierStats.A + tierStats.B + tierStats.C;
  console.log(`\nRecords with website (Tiers A-C): ${goodTiers} (${(goodTiers/result.rows.length*100).toFixed(1)}%)`);

  console.log(`\nExported to: ${outputPath}`);

  await client.end();
}

main().catch(console.error);
