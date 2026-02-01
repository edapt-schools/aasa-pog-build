/**
 * db-status.js - Check the current state of the AASA district database
 *
 * Usage: node scripts/db-status.js
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // 1. Overall coverage
    console.log('=== SUPERINTENDENT COVERAGE ===');
    const coverage = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(superintendent_name) as with_supt,
        ROUND(COUNT(superintendent_name) * 100.0 / COUNT(*), 1) as pct
      FROM national_registry
    `);
    console.log(`Total districts: ${coverage.rows[0].total}`);
    console.log(`With superintendent: ${coverage.rows[0].with_supt}`);
    console.log(`Coverage: ${coverage.rows[0].pct}%`);

    // 2. State registries loaded
    console.log('\n=== STATE REGISTRIES LOADED ===');
    const states = await client.query(`
      SELECT state, COUNT(*) as count
      FROM state_registry_districts
      GROUP BY state
      ORDER BY count DESC
    `);
    if (states.rows.length === 0) {
      console.log('(none)');
    } else {
      states.rows.forEach(r => console.log(`${r.state}: ${r.count} records`));
    }

    // 3. Coverage by state (top 10 with data + sample without)
    console.log('\n=== COVERAGE BY STATE ===');
    const byState = await client.query(`
      SELECT
        state,
        COUNT(*) as total,
        COUNT(superintendent_name) as with_supt,
        ROUND(COUNT(superintendent_name) * 100.0 / NULLIF(COUNT(*), 0), 1) as pct
      FROM national_registry
      GROUP BY state
      ORDER BY with_supt DESC
    `);

    console.log('\nStates with superintendent data:');
    byState.rows.filter(r => parseInt(r.with_supt) > 0).forEach(r =>
      console.log(`  ${r.state}: ${r.with_supt}/${r.total} (${r.pct}%)`)
    );

    const withoutData = byState.rows.filter(r => parseInt(r.with_supt) === 0);
    console.log(`\nStates with 0% coverage: ${withoutData.length}`);
    console.log(`  ${withoutData.map(r => r.state).join(', ')}`);

    // 4. Recent imports
    console.log('\n=== RECENT IMPORTS ===');
    const imports = await client.query(`
      SELECT source_name, record_count, imported_at, imported_by
      FROM data_imports
      ORDER BY imported_at DESC
      LIMIT 5
    `);
    if (imports.rows.length === 0) {
      console.log('(none)');
    } else {
      imports.rows.forEach(r => {
        const date = new Date(r.imported_at).toLocaleDateString();
        console.log(`  ${r.source_name}: ${r.record_count} records (${date}) by ${r.imported_by}`);
      });
    }

    // 5. Match statistics
    console.log('\n=== MATCH STATISTICS ===');
    const matches = await client.query(`
      SELECT
        match_method,
        COUNT(*) as count,
        ROUND(AVG(match_confidence), 2) as avg_confidence
      FROM district_matches
      GROUP BY match_method
      ORDER BY count DESC
    `);
    if (matches.rows.length === 0) {
      console.log('(no matches yet)');
    } else {
      matches.rows.forEach(r =>
        console.log(`  ${r.match_method}: ${r.count} (avg confidence: ${r.avg_confidence})`)
      );
    }

    // 6. Quality flags
    console.log('\n=== UNRESOLVED QUALITY FLAGS ===');
    const flags = await client.query(`
      SELECT flag_type, COUNT(*) as count
      FROM quality_flags
      WHERE resolved = false
      GROUP BY flag_type
      ORDER BY count DESC
    `);
    if (flags.rows.length === 0) {
      console.log('(none)');
    } else {
      flags.rows.forEach(r => console.log(`  ${r.flag_type}: ${r.count}`));
    }

    console.log('\n=== DONE ===');

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
