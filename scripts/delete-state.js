/**
 * Delete State Records Utility
 *
 * Safely removes all records for a state from:
 * - district_matches (linked to state_registry_districts)
 * - state_registry_districts
 * - data_imports (optional)
 *
 * Usage: node scripts/delete-state.js XX [--keep-imports]
 * Example: node scripts/delete-state.js MD
 */

const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log('Usage: node scripts/delete-state.js XX [--keep-imports]');
    console.log('Example: node scripts/delete-state.js MD');
    process.exit(1);
  }

  const state = args[0].toUpperCase();
  const keepImports = args.includes('--keep-imports');

  if (!/^[A-Z]{2}$/.test(state)) {
    console.error('Error: State must be a 2-letter code (e.g., MD, CA)');
    process.exit(1);
  }

  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    console.log(`\n=== DELETE STATE: ${state} ===\n`);

    // Step 1: Show current counts
    const countResult = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM state_registry_districts WHERE state = $1) as registry_count,
        (SELECT COUNT(*) FROM district_matches WHERE state_registry_id IN
          (SELECT id FROM state_registry_districts WHERE state = $1)) as matches_count
    `, [state]);

    const { registry_count, matches_count } = countResult.rows[0];
    console.log(`Current records for ${state}:`);
    console.log(`  state_registry_districts: ${registry_count}`);
    console.log(`  district_matches: ${matches_count}`);

    if (parseInt(registry_count) === 0) {
      console.log(`\nNo records found for ${state}. Nothing to delete.`);
      await client.end();
      return;
    }

    // Step 2: Delete district_matches first (foreign key constraint)
    console.log(`\nDeleting district_matches...`);
    const matchesResult = await client.query(`
      DELETE FROM district_matches
      WHERE state_registry_id IN (SELECT id FROM state_registry_districts WHERE state = $1)
      RETURNING id
    `, [state]);
    console.log(`  Deleted: ${matchesResult.rowCount} matches`);

    // Step 3: Delete state_registry_districts
    console.log(`\nDeleting state_registry_districts...`);
    const registryResult = await client.query(`
      DELETE FROM state_registry_districts WHERE state = $1
      RETURNING id
    `, [state]);
    console.log(`  Deleted: ${registryResult.rowCount} registry records`);

    // Step 4: Optionally delete data_imports
    if (!keepImports) {
      console.log(`\nDeleting data_imports...`);
      const importsResult = await client.query(`
        DELETE FROM data_imports
        WHERE source_type = 'state_registry'
          AND (source_name ILIKE $1 OR notes ILIKE $2)
        RETURNING id, source_name
      `, [`%${state}%`, `%${state}%`]);
      if (importsResult.rowCount > 0) {
        console.log(`  Deleted: ${importsResult.rowCount} import records`);
        importsResult.rows.forEach(r => console.log(`    - ${r.source_name}`));
      } else {
        console.log(`  No matching import records found`);
      }
    } else {
      console.log(`\nSkipping data_imports deletion (--keep-imports flag)`);
    }

    // Step 5: Verify deletion
    console.log(`\n=== VERIFICATION ===`);
    const verifyResult = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM state_registry_districts WHERE state = $1) as registry_count,
        (SELECT COUNT(*) FROM district_matches WHERE state_registry_id IN
          (SELECT id FROM state_registry_districts WHERE state = $1)) as matches_count
    `, [state]);
    console.log(`Remaining records for ${state}:`);
    console.log(`  state_registry_districts: ${verifyResult.rows[0].registry_count}`);
    console.log(`  district_matches: ${verifyResult.rows[0].matches_count}`);

    // Step 6: Show overall coverage impact
    const coverageResult = await client.query(`
      SELECT COUNT(*) as total, COUNT(superintendent_name) as with_supt,
             ROUND(COUNT(superintendent_name)*100.0/COUNT(*),1) as pct
      FROM national_registry
    `);
    const coverage = coverageResult.rows[0];
    console.log(`\nOverall coverage: ${coverage.with_supt}/${coverage.total} (${coverage.pct}%)`);

    console.log(`\n=== ${state} DELETION COMPLETE ===\n`);
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(console.error);
