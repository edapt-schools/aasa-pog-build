/**
 * Build Benchmark Dataset for AASA Platform Scoring Validation
 *
 * Creates a 50-district benchmark with 3 tiers:
 *   Tier 1 (Expected High): 15-20 districts with highest keyword scores, large enrollment
 *   Tier 2 (Expected Moderate): 15-20 districts with moderate keyword scores, mixed sizes
 *   Tier 3 (Expected Low/Zero): 15-20 large districts with zero/very low scores but have documents
 *
 * Ensures geographic diversity: at least 5 different states per tier.
 *
 * Output: benchmark-districts.json
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  console.log('=== Building Benchmark Dataset ===\n');

  // -------------------------------------------------------------------------
  // TIER 1: Expected High Score (15-20 districts)
  // Highest current keyword scores, large enrollment, many documents
  // -------------------------------------------------------------------------
  const tier1Result = await client.query(`
    SELECT d.nces_id, d.name, d.state, d.enrollment,
           s.total_score, s.readiness_score, s.alignment_score,
           s.activation_score, s.branding_score,
           s.outreach_tier AS current_tier, s.documents_analyzed,
           (SELECT COUNT(*) FROM district_documents dd WHERE dd.nces_id = d.nces_id) AS doc_count
    FROM districts d
    JOIN district_keyword_scores s ON d.nces_id = s.nces_id
    WHERE d.nces_id IS NOT NULL
      AND d.enrollment > 5000
      AND s.total_score >= 1.5
      AND s.documents_analyzed >= 3
    ORDER BY s.total_score DESC
    LIMIT 80
  `);

  // Select 18 with geographic diversity (at least 5 states)
  const tier1 = selectWithDiversity(tier1Result.rows, 18, 5);

  // -------------------------------------------------------------------------
  // TIER 2: Expected Moderate Score (15-20 districts)
  // Moderate keyword scores (middle of distribution), mixed sizes and states
  // -------------------------------------------------------------------------
  // Use NTILE to sample across the moderate score range evenly
  const tier2Result = await client.query(`
    WITH moderate AS (
      SELECT d.nces_id, d.name, d.state, d.enrollment,
             s.total_score, s.readiness_score, s.alignment_score,
             s.activation_score, s.branding_score,
             s.outreach_tier AS current_tier, s.documents_analyzed,
             (SELECT COUNT(*) FROM district_documents dd WHERE dd.nces_id = d.nces_id) AS doc_count,
             NTILE(5) OVER (ORDER BY s.total_score DESC) AS score_bucket
      FROM districts d
      JOIN district_keyword_scores s ON d.nces_id = s.nces_id
      WHERE d.nces_id IS NOT NULL
        AND d.enrollment > 3000
        AND s.total_score BETWEEN 0.15 AND 1.2
        AND s.documents_analyzed >= 3
    )
    SELECT * FROM (
      (SELECT * FROM moderate WHERE score_bucket = 1 AND enrollment BETWEEN 5000 AND 30000 ORDER BY RANDOM() LIMIT 4)
      UNION ALL
      (SELECT * FROM moderate WHERE score_bucket = 1 AND enrollment > 30000 ORDER BY RANDOM() LIMIT 4)
      UNION ALL
      (SELECT * FROM moderate WHERE score_bucket = 2 AND enrollment BETWEEN 5000 AND 30000 ORDER BY RANDOM() LIMIT 4)
      UNION ALL
      (SELECT * FROM moderate WHERE score_bucket = 2 AND enrollment > 30000 ORDER BY RANDOM() LIMIT 4)
      UNION ALL
      (SELECT * FROM moderate WHERE score_bucket = 3 ORDER BY RANDOM() LIMIT 5)
      UNION ALL
      (SELECT * FROM moderate WHERE score_bucket = 4 ORDER BY RANDOM() LIMIT 5)
      UNION ALL
      (SELECT * FROM moderate WHERE score_bucket = 5 ORDER BY RANDOM() LIMIT 5)
    ) combined
    ORDER BY total_score DESC
  `);

  const tier2 = selectWithDiversity(tier2Result.rows, 17, 5);

  // -------------------------------------------------------------------------
  // TIER 3: Expected Low/Zero Score (15-20 districts)
  // Large districts with zero/very low scores BUT have documents in our system
  // -------------------------------------------------------------------------
  const tier3Result = await client.query(`
    (SELECT d.nces_id, d.name, d.state, d.enrollment,
           s.total_score, s.readiness_score, s.alignment_score,
           s.activation_score, s.branding_score,
           s.outreach_tier AS current_tier, s.documents_analyzed,
           (SELECT COUNT(*) FROM district_documents dd WHERE dd.nces_id = d.nces_id) AS doc_count
    FROM districts d
    JOIN district_keyword_scores s ON d.nces_id = s.nces_id
    WHERE d.nces_id IS NOT NULL
      AND d.enrollment > 20000
      AND s.total_score = 0
      AND s.documents_analyzed >= 3
    ORDER BY d.enrollment DESC
    LIMIT 40)
    UNION ALL
    (SELECT d.nces_id, d.name, d.state, d.enrollment,
           s.total_score, s.readiness_score, s.alignment_score,
           s.activation_score, s.branding_score,
           s.outreach_tier AS current_tier, s.documents_analyzed,
           (SELECT COUNT(*) FROM district_documents dd WHERE dd.nces_id = d.nces_id) AS doc_count
    FROM districts d
    JOIN district_keyword_scores s ON d.nces_id = s.nces_id
    WHERE d.nces_id IS NOT NULL
      AND d.enrollment BETWEEN 5000 AND 20000
      AND s.total_score = 0
      AND s.documents_analyzed >= 5
    ORDER BY RANDOM()
    LIMIT 30)
  `);

  // Exclude PR (not a standard target market)
  const tier3Filtered = tier3Result.rows.filter(r => r.state !== 'PR');
  const tier3 = selectWithDiversity(tier3Filtered, 17, 5);

  // -------------------------------------------------------------------------
  // Build the benchmark output
  // -------------------------------------------------------------------------
  const benchmark = [];

  for (const row of tier1) {
    benchmark.push(formatRow(row, 1, generateTier1Rationale(row)));
  }

  for (const row of tier2) {
    benchmark.push(formatRow(row, 2, generateTier2Rationale(row)));
  }

  for (const row of tier3) {
    benchmark.push(formatRow(row, 3, generateTier3Rationale(row)));
  }

  // -------------------------------------------------------------------------
  // Write output
  // -------------------------------------------------------------------------
  const outPath = path.join(__dirname, 'benchmark-districts.json');
  fs.writeFileSync(outPath, JSON.stringify(benchmark, null, 2));
  console.log(`\nWrote ${benchmark.length} districts to ${outPath}`);

  // Summary
  console.log('\n=== Benchmark Summary ===');
  console.log(`Tier 1 (Expected High):     ${tier1.length} districts`);
  console.log(`Tier 2 (Expected Moderate):  ${tier2.length} districts`);
  console.log(`Tier 3 (Expected Low/Zero):  ${tier3.length} districts`);
  console.log(`Total:                       ${benchmark.length} districts`);

  // State diversity check
  for (const [tierName, tierData] of [['Tier 1', tier1], ['Tier 2', tier2], ['Tier 3', tier3]]) {
    const states = [...new Set(tierData.map(r => r.state))];
    console.log(`\n${tierName} states (${states.length}): ${states.sort().join(', ')}`);
  }

  // Score ranges
  console.log('\nScore ranges:');
  console.log(`  Tier 1: ${Math.min(...tier1.map(r => parseFloat(r.total_score))).toFixed(2)} - ${Math.max(...tier1.map(r => parseFloat(r.total_score))).toFixed(2)}`);
  console.log(`  Tier 2: ${Math.min(...tier2.map(r => parseFloat(r.total_score))).toFixed(2)} - ${Math.max(...tier2.map(r => parseFloat(r.total_score))).toFixed(2)}`);
  console.log(`  Tier 3: ${Math.min(...tier3.map(r => parseFloat(r.total_score))).toFixed(2)} - ${Math.max(...tier3.map(r => parseFloat(r.total_score))).toFixed(2)}`);

  // Enrollment ranges
  console.log('\nEnrollment ranges:');
  console.log(`  Tier 1: ${Math.min(...tier1.map(r => r.enrollment)).toLocaleString()} - ${Math.max(...tier1.map(r => r.enrollment)).toLocaleString()}`);
  console.log(`  Tier 2: ${Math.min(...tier2.map(r => r.enrollment)).toLocaleString()} - ${Math.max(...tier2.map(r => r.enrollment)).toLocaleString()}`);
  console.log(`  Tier 3: ${Math.min(...tier3.map(r => r.enrollment)).toLocaleString()} - ${Math.max(...tier3.map(r => r.enrollment)).toLocaleString()}`);

  await client.end();
}

/**
 * Select N districts from candidates ensuring at least minStates different states.
 * Greedy approach: pick top-scoring, but cycle through underrepresented states.
 */
function selectWithDiversity(candidates, targetCount, minStates) {
  const selected = [];
  const stateCount = {};
  const usedNces = new Set();

  // First pass: take the top candidates, tracking states
  for (const row of candidates) {
    if (selected.length >= targetCount) break;
    if (usedNces.has(row.nces_id)) continue;

    selected.push(row);
    usedNces.add(row.nces_id);
    stateCount[row.state] = (stateCount[row.state] || 0) + 1;
  }

  // Check diversity
  const uniqueStates = Object.keys(stateCount).length;
  if (uniqueStates < minStates) {
    // Need more state diversity. Remove duplicates from overrepresented states
    // and replace with candidates from underrepresented states.
    const overrepStates = Object.entries(stateCount)
      .filter(([, cnt]) => cnt > 2)
      .sort((a, b) => b[1] - a[1]);

    for (const [overState] of overrepStates) {
      if (Object.keys(stateCount).length >= minStates) break;

      // Find candidates from new states
      const newStateCandidates = candidates.filter(
        r => !usedNces.has(r.nces_id) && !stateCount[r.state]
      );

      if (newStateCandidates.length === 0) break;

      // Remove a district from overrepresented state
      const removeIdx = selected.findIndex(r => r.state === overState);
      if (removeIdx === -1) continue;

      const removed = selected.splice(removeIdx, 1)[0];
      usedNces.delete(removed.nces_id);
      stateCount[removed.state]--;
      if (stateCount[removed.state] === 0) delete stateCount[removed.state];

      // Add from new state
      const newDistrict = newStateCandidates[0];
      selected.push(newDistrict);
      usedNces.add(newDistrict.nces_id);
      stateCount[newDistrict.state] = (stateCount[newDistrict.state] || 0) + 1;
    }
  }

  return selected;
}

function formatRow(row, expectedTier, rationale) {
  return {
    nces_id: row.nces_id,
    name: row.name,
    state: row.state,
    enrollment: row.enrollment,
    current_score: parseFloat(parseFloat(row.total_score).toFixed(2)),
    current_tier: tierStringToNumber(row.current_tier),
    expected_tier: expectedTier,
    document_count: parseInt(row.doc_count, 10),
    documents_analyzed: row.documents_analyzed,
    category_scores: {
      readiness: parseFloat(parseFloat(row.readiness_score).toFixed(2)),
      alignment: parseFloat(parseFloat(row.alignment_score).toFixed(2)),
      activation: parseFloat(parseFloat(row.activation_score).toFixed(2)),
      branding: parseFloat(parseFloat(row.branding_score).toFixed(2))
    },
    rationale: rationale
  };
}

function tierStringToNumber(tier) {
  if (tier === 'tier1') return 1;
  if (tier === 'tier2') return 2;
  return 3;
}

function generateTier1Rationale(row) {
  const parts = [];
  const enrollment = row.enrollment;
  const score = parseFloat(row.total_score);

  if (enrollment > 50000) parts.push('Very large district');
  else if (enrollment > 20000) parts.push('Large district');
  else if (enrollment > 10000) parts.push('Mid-size district');
  else parts.push('District');

  parts.push(`with strong keyword signals (score ${score.toFixed(2)})`);

  const readiness = parseFloat(row.readiness_score);
  const alignment = parseFloat(row.alignment_score);
  const activation = parseFloat(row.activation_score);

  const signals = [];
  if (readiness >= 4) signals.push('Portrait of Graduate / strategic planning');
  if (alignment >= 1.5) signals.push('educator competencies / instructional frameworks');
  if (activation >= 1.5) signals.push('performance assessment / evidence of learning');

  if (signals.length > 0) {
    parts.push(`across ${row.documents_analyzed} documents showing ${signals.join(', ')}`);
  }

  return parts.join(' ');
}

function generateTier2Rationale(row) {
  const score = parseFloat(row.total_score);
  const enrollment = row.enrollment;

  let sizeLabel;
  if (enrollment > 50000) sizeLabel = 'Very large district';
  else if (enrollment > 20000) sizeLabel = 'Large district';
  else if (enrollment > 10000) sizeLabel = 'Mid-size district';
  else sizeLabel = 'District';

  return `${sizeLabel} with moderate keyword signals (score ${score.toFixed(2)}) across ${row.documents_analyzed} documents. Some relevant terminology present but not extensively.`;
}

function generateTier3Rationale(row) {
  const enrollment = row.enrollment;

  let sizeLabel;
  if (enrollment > 100000) sizeLabel = 'Very large district';
  else if (enrollment > 50000) sizeLabel = 'Large district';
  else if (enrollment > 20000) sizeLabel = 'Sizable district';
  else sizeLabel = 'District';

  return `${sizeLabel} (${enrollment.toLocaleString()} enrollment) with ${row.documents_analyzed} documents analyzed but zero keyword matches. Absence of PoG/PtP terminology suggests they have not started portrait-based strategic planning.`;
}

main().catch(console.error);
