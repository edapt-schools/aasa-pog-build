/**
 * Backfill website_url from administrator_email domains
 *
 * For states that have email addresses but no website_url,
 * extract the domain from the email and use it as the website.
 *
 * Target states: AK, AR, DE, IA, IN, LA, MS, ND, NH, NM, NV, OK, UT, VT, WV, WY
 */

const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';

// Personal email domains to exclude
const PERSONAL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'aol.com', 'icloud.com', 'me.com', 'msn.com', 'live.com',
  'comcast.net', 'att.net', 'verizon.net', 'sbcglobal.net'
];

// States with email but no website_url
const TARGET_STATES = ['AK', 'AR', 'DE', 'IA', 'IN', 'LA', 'MS', 'ND', 'NH', 'NM', 'NV', 'OK', 'UT', 'VT', 'WV', 'WY'];

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Preview: Count records that will be updated per state
    console.log('=== PREVIEW ===');
    console.log('Records to update per state:\n');

    const previewResult = await client.query(`
      SELECT
        state,
        COUNT(*) as will_update
      FROM state_registry_districts
      WHERE website_url IS NULL
        AND administrator_email IS NOT NULL
        AND administrator_email LIKE '%@%.%'
        AND SPLIT_PART(administrator_email, '@', 2) NOT IN (${PERSONAL_DOMAINS.map((_, i) => '$' + (i + 1)).join(', ')})
        AND state = ANY($${PERSONAL_DOMAINS.length + 1})
      GROUP BY state
      ORDER BY state
    `, [...PERSONAL_DOMAINS, TARGET_STATES]);

    let totalToUpdate = 0;
    for (const row of previewResult.rows) {
      console.log(`  ${row.state}: ${row.will_update} records`);
      totalToUpdate += parseInt(row.will_update);
    }
    console.log(`\n  TOTAL: ${totalToUpdate} records to update\n`);

    // Sample some emails to show what domains we'll extract
    console.log('=== SAMPLE DOMAINS ===');
    const sampleResult = await client.query(`
      SELECT DISTINCT
        SPLIT_PART(administrator_email, '@', 2) as domain,
        COUNT(*) as count
      FROM state_registry_districts
      WHERE website_url IS NULL
        AND administrator_email IS NOT NULL
        AND administrator_email LIKE '%@%.%'
        AND SPLIT_PART(administrator_email, '@', 2) NOT IN (${PERSONAL_DOMAINS.map((_, i) => '$' + (i + 1)).join(', ')})
        AND state = ANY($${PERSONAL_DOMAINS.length + 1})
      GROUP BY SPLIT_PART(administrator_email, '@', 2)
      ORDER BY count DESC
      LIMIT 15
    `, [...PERSONAL_DOMAINS, TARGET_STATES]);

    console.log('Top domains to be converted to website_url:\n');
    for (const row of sampleResult.rows) {
      console.log(`  ${row.domain} (${row.count} records)`);
    }

    // Run the update
    console.log('\n=== RUNNING UPDATE ===\n');

    const updateResult = await client.query(`
      UPDATE state_registry_districts
      SET website_url = 'https://' || SPLIT_PART(administrator_email, '@', 2),
          updated_at = NOW()
      WHERE website_url IS NULL
        AND administrator_email IS NOT NULL
        AND administrator_email LIKE '%@%.%'
        AND SPLIT_PART(administrator_email, '@', 2) NOT IN (${PERSONAL_DOMAINS.map((_, i) => '$' + (i + 1)).join(', ')})
        AND state = ANY($${PERSONAL_DOMAINS.length + 1})
    `, [...PERSONAL_DOMAINS, TARGET_STATES]);

    console.log(`Updated ${updateResult.rowCount} records\n`);

    // Verify: Show updated counts per state
    console.log('=== VERIFICATION ===');
    console.log('Website URL coverage after update:\n');

    const verifyResult = await client.query(`
      SELECT
        state,
        COUNT(*) as total,
        COUNT(website_url) as has_website,
        ROUND(COUNT(website_url) * 100.0 / COUNT(*), 1) as pct
      FROM state_registry_districts
      WHERE state = ANY($1)
      GROUP BY state
      ORDER BY state
    `, [TARGET_STATES]);

    console.log('State | Total | Has Website | %');
    console.log('------|-------|-------------|----');
    for (const row of verifyResult.rows) {
      console.log(`${row.state}    | ${row.total.toString().padStart(5)} | ${row.has_website.toString().padStart(11)} | ${row.pct}%`);
    }

    // Sample of updated records
    console.log('\n=== SAMPLE UPDATED RECORDS ===\n');
    const sampleUpdated = await client.query(`
      SELECT state, district_name, administrator_email, website_url
      FROM state_registry_districts
      WHERE website_url IS NOT NULL
        AND state = ANY($1)
      ORDER BY RANDOM()
      LIMIT 10
    `, [TARGET_STATES]);

    for (const row of sampleUpdated.rows) {
      console.log(`${row.state} | ${row.district_name.substring(0, 40).padEnd(40)} | ${row.website_url}`);
    }

    console.log('\n=== BACKFILL COMPLETE ===');

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(console.error);
