/**
 * Phase 2C: Compute Keyword Taxonomy Scores
 *
 * Analyzes all discovered documents and computes keyword taxonomy scores
 * for each district based on the AASA Lead Scoring taxonomy:
 *   - Readiness (Category A): Portrait of a Graduate, Strategic Planning
 *   - Alignment (Category B): Portrait of Educators, Frameworks for Learning
 *   - Activation (Category C): Measure What Matters, Impact Showcases
 *   - Branding (Category D): Strategic Storytelling, Communications
 *
 * Scores are weighted and multiplied by recency/specificity factors.
 *
 * Usage:
 *   node scripts/compute-keyword-scores.js [--batch-id UUID]
 *
 * Output:
 *   - Updates district_keyword_scores table
 *   - Assigns outreach_tier (tier1, tier2, tier3)
 */

const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';

// =============================================================================
// KEYWORD TAXONOMY (from planning-docs/Keyword Taxonomy and Synonyms.pdf)
// =============================================================================

const TAXONOMY = {
  readiness: {
    name: 'Readiness',
    description: 'Portrait of a Graduate / Strategic Vision',
    keywords: [
      // A1: Portrait of a Graduate (PoG) - Weight 1.0
      { pattern: /portrait\s+of\s+(a\s+)?graduate/gi, weight: 1.0, name: 'portrait_of_graduate', exact: true },
      { pattern: /graduate\s+profile/gi, weight: 1.0, name: 'graduate_profile', exact: true },
      { pattern: /learner\s+profile/gi, weight: 0.9, name: 'learner_profile' },
      { pattern: /graduate\s+competenc(y|ies)/gi, weight: 0.9, name: 'graduate_competencies' },
      { pattern: /profile\s+of\s+(a\s+)?graduate/gi, weight: 1.0, name: 'profile_of_graduate', exact: true },
      { pattern: /student\s+success\s+vision/gi, weight: 0.8, name: 'student_success_vision' },
      { pattern: /future[- ]?ready\s+skills/gi, weight: 0.7, name: 'future_ready_skills' },
      { pattern: /habits\s+of\s+success/gi, weight: 0.7, name: 'habits_of_success' },

      // A2: Community Compass - Weight 0.9
      { pattern: /community\s+compass/gi, weight: 0.9, name: 'community_compass', exact: true },
      { pattern: /stakeholder\s+engagement\s+framework/gi, weight: 0.85, name: 'stakeholder_engagement' },
      { pattern: /community\s+commitments?/gi, weight: 0.8, name: 'community_commitments' },
      { pattern: /community\s+visioning/gi, weight: 0.8, name: 'community_visioning' },
      { pattern: /listening\s+sessions?/gi, weight: 0.6, name: 'listening_sessions' },
      { pattern: /listening\s+tour/gi, weight: 0.6, name: 'listening_tour' },

      // A3: Strategic Planning - Weight 0.8
      { pattern: /strategic\s+plan(?:ning)?/gi, weight: 0.8, name: 'strategic_plan' },
      { pattern: /strategic\s+priorit(y|ies)/gi, weight: 0.8, name: 'strategic_priorities' },
      { pattern: /district\s+vision\s+(&|and)\s+goals/gi, weight: 0.7, name: 'district_vision_goals' },
      { pattern: /strategic\s+framework/gi, weight: 0.7, name: 'strategic_framework' },
      { pattern: /strategic\s+roadmap/gi, weight: 0.7, name: 'strategic_roadmap' },
      { pattern: /mission[\/\s]vision\s+refresh/gi, weight: 0.6, name: 'mission_vision_refresh' },

      // A4: Roadmap (Implementation) - Weight 0.7
      { pattern: /implementation\s+roadmap/gi, weight: 0.7, name: 'implementation_roadmap' },
      { pattern: /portrait\s+roadmap/gi, weight: 0.7, name: 'portrait_roadmap' },
      { pattern: /action\s+roadmap/gi, weight: 0.7, name: 'action_roadmap' },
      { pattern: /operationalize\s+portrait/gi, weight: 0.7, name: 'operationalize_portrait' }
    ]
  },

  alignment: {
    name: 'Alignment',
    description: 'Portrait to Practice / System Implementation',
    keywords: [
      // B1: Portraits of Educators (PoE) - Weight 0.9
      { pattern: /portrait\s+of\s+educators?/gi, weight: 0.9, name: 'portrait_of_educators', exact: true },
      { pattern: /educator\s+competenc(y|ies)/gi, weight: 0.9, name: 'educator_competencies' },
      { pattern: /teacher\s+competenc(y|ies)/gi, weight: 0.9, name: 'teacher_competencies' },
      { pattern: /leadership\s+competenc(y|ies)/gi, weight: 0.85, name: 'leadership_competencies' },
      { pattern: /educator\s+profile/gi, weight: 0.85, name: 'educator_profile' },
      { pattern: /staff\s+competenc(y|ies)/gi, weight: 0.8, name: 'staff_competencies' },
      { pattern: /adult\s+competenc(y|ies)/gi, weight: 0.8, name: 'adult_competencies' },
      { pattern: /instructional\s+competenc(y|ies)/gi, weight: 0.8, name: 'instructional_competencies' },

      // B2: Frameworks for Learning - Weight 0.85
      { pattern: /framework(s)?\s+for\s+learning/gi, weight: 0.85, name: 'frameworks_for_learning', exact: true },
      { pattern: /learning\s+framework/gi, weight: 0.85, name: 'learning_framework' },
      { pattern: /instructional\s+framework/gi, weight: 0.85, name: 'instructional_framework' },
      { pattern: /graduate\s+profile[- ]aligned\s+curriculum/gi, weight: 0.85, name: 'profile_aligned_curriculum' },
      { pattern: /learning\s+design\s+framework/gi, weight: 0.8, name: 'learning_design_framework' },
      { pattern: /curricular\s+alignment/gi, weight: 0.75, name: 'curricular_alignment' },
      { pattern: /competency[- ]based\s+pathways?/gi, weight: 0.75, name: 'competency_based_pathways' },

      // B3: Learning Experience Accelerator - Weight 0.75
      { pattern: /learning\s+experience\s+accelerator/gi, weight: 0.75, name: 'learning_experience_accelerator', exact: true },
      { pattern: /teacher\s+capacity\s+building/gi, weight: 0.7, name: 'teacher_capacity_building' },
      { pattern: /deeper\s+learning\s+for\s+teachers/gi, weight: 0.7, name: 'deeper_learning_teachers' },
      { pattern: /collaborative\s+lesson\s+design/gi, weight: 0.65, name: 'collaborative_lesson_design' },
      { pattern: /personalized\s+p[ld]\s+for\s+teachers/gi, weight: 0.65, name: 'personalized_pl_teachers' },
      { pattern: /learning\s+labs?/gi, weight: 0.6, name: 'learning_labs' },
      { pattern: /design\s+studios?/gi, weight: 0.6, name: 'design_studios' }
    ]
  },

  activation: {
    name: 'Activation',
    description: 'Measure What Matters / Evidence & Impact',
    keywords: [
      // C1: Measure What Matters (MWM) - Weight 0.9
      { pattern: /measure\s+what\s+matters/gi, weight: 0.9, name: 'measure_what_matters', exact: true },
      { pattern: /performance\s+tasks?/gi, weight: 0.9, name: 'performance_tasks' },
      { pattern: /capstone/gi, weight: 0.9, name: 'capstone' },
      { pattern: /cornerstone/gi, weight: 0.9, name: 'cornerstone' },
      { pattern: /competency\s+rubrics?/gi, weight: 0.85, name: 'competency_rubrics' },
      { pattern: /beyond\s+test\s+scores/gi, weight: 0.8, name: 'beyond_test_scores' },
      { pattern: /authentic\s+assessment/gi, weight: 0.8, name: 'authentic_assessment' },
      { pattern: /portfolio\s+assessment/gi, weight: 0.8, name: 'portfolio_assessment' },
      { pattern: /graduate\s+outcomes?\s+evidence/gi, weight: 0.8, name: 'graduate_outcomes_evidence' },
      { pattern: /profile[- ]aligned\s+rubrics?/gi, weight: 0.8, name: 'profile_aligned_rubrics' },
      { pattern: /evidence\s+of\s+learning/gi, weight: 0.75, name: 'evidence_of_learning' },
      { pattern: /application\s+of\s+learning/gi, weight: 0.75, name: 'application_of_learning' },

      // C2: Impact Showcases - Weight 0.8
      { pattern: /impact\s+showcase/gi, weight: 0.8, name: 'impact_showcase', exact: true },
      { pattern: /student\s+showcase/gi, weight: 0.8, name: 'student_showcase' },
      { pattern: /discovery\s+fairs?/gi, weight: 0.75, name: 'discovery_fairs' },
      { pattern: /annual\s+celebrations?/gi, weight: 0.7, name: 'annual_celebrations' },
      { pattern: /exhibition\s+of\s+learning/gi, weight: 0.8, name: 'exhibition_of_learning' },
      { pattern: /portfolio\s+night/gi, weight: 0.75, name: 'portfolio_night' },
      { pattern: /public\s+product/gi, weight: 0.75, name: 'public_product' },
      { pattern: /community\s+celebration/gi, weight: 0.7, name: 'community_celebration' }
    ]
  },

  branding: {
    name: 'Branding & Communications',
    description: 'Strategic Storytelling / Cross-cutting Support',
    keywords: [
      // D: Strategic Storytelling & Brand Messaging - Weight 0.6
      { pattern: /strategic\s+storytelling/gi, weight: 0.6, name: 'strategic_storytelling', exact: true },
      { pattern: /brand\s+design/gi, weight: 0.6, name: 'brand_design' },
      { pattern: /messaging\s+framework/gi, weight: 0.6, name: 'messaging_framework' },
      { pattern: /portrait\s+launch\s+blueprint/gi, weight: 0.6, name: 'portrait_launch_blueprint', exact: true },
      { pattern: /message\s+alignment/gi, weight: 0.55, name: 'message_alignment' },
      { pattern: /communications?\s+roadmap/gi, weight: 0.55, name: 'communications_roadmap' },
      { pattern: /narrative\s+framework/gi, weight: 0.55, name: 'narrative_framework' },
      { pattern: /community\s+storytelling/gi, weight: 0.5, name: 'community_storytelling' },
      { pattern: /campaign\s+plan/gi, weight: 0.5, name: 'campaign_plan' }
    ]
  }
};

// =============================================================================
// MULTIPLIERS
// =============================================================================

// Recency multiplier based on document date or crawl time
function getRecencyMultiplier(crawledAt) {
  if (!crawledAt) return 0.8; // Unknown = assume moderately old

  const now = new Date();
  const crawlDate = new Date(crawledAt);
  const monthsAgo = (now - crawlDate) / (1000 * 60 * 60 * 24 * 30);

  // Since we just crawled, use high recency
  // In production, would use document publish date if available
  if (monthsAgo <= 6) return 1.0;
  if (monthsAgo <= 12) return 0.8;
  return 0.6;
}

// Specificity multiplier based on URL patterns
function getSpecificityMultiplier(url, documentCategory) {
  const urlLower = (url || '').toLowerCase();

  // District-authored implementation content (highest value)
  if (urlLower.includes('/plan') || urlLower.includes('/strategic') ||
      urlLower.includes('/framework') || urlLower.includes('/portrait') ||
      urlLower.includes('/vision') || urlLower.includes('/graduate')) {
    return 1.0;
  }

  // If categorized as PoG or strategic plan
  if (documentCategory === 'portrait_of_graduate' || documentCategory === 'strategic_plan') {
    return 1.0;
  }

  // News/external mentions (lower value)
  if (urlLower.includes('news') || urlLower.includes('article') ||
      urlLower.includes('press') || urlLower.includes('blog')) {
    return 0.5;
  }

  return 0.8; // Default
}

// =============================================================================
// SCORING FUNCTIONS
// =============================================================================

function analyzeText(text, crawledAt, url, documentCategory) {
  const matches = {
    readiness: [],
    alignment: [],
    activation: [],
    branding: []
  };

  const textLower = (text || '').toLowerCase();
  const recencyMult = getRecencyMultiplier(crawledAt);
  const specificityMult = getSpecificityMultiplier(url, documentCategory);

  // Check each category
  for (const [category, data] of Object.entries(TAXONOMY)) {
    for (const keyword of data.keywords) {
      const regex = keyword.pattern;
      const matchResults = textLower.match(regex);

      if (matchResults) {
        // Calculate weighted score with multipliers
        const baseWeight = keyword.weight;
        const adjustedWeight = baseWeight * recencyMult * specificityMult;

        matches[category].push({
          keyword: keyword.name,
          baseWeight: baseWeight,
          adjustedWeight: adjustedWeight,
          count: matchResults.length,
          exact: keyword.exact || false,
          context: extractContext(text, matchResults[0])
        });
      }
    }
  }

  return matches;
}

// Extract surrounding context for a match
function extractContext(text, match) {
  if (!text || !match) return null;

  const index = text.toLowerCase().indexOf(match.toLowerCase());
  if (index === -1) return null;

  const start = Math.max(0, index - 50);
  const end = Math.min(text.length, index + match.length + 50);

  let context = text.substring(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) context = '...' + context;
  if (end < text.length) context = context + '...';

  return context;
}

// Calculate category score from matches
function calculateCategoryScore(matches) {
  if (matches.length === 0) return 0;

  // Sum all adjusted weights, but cap per-keyword contribution
  let score = 0;
  const seenKeywords = new Set();

  for (const match of matches) {
    // Only count each keyword once (dedupe)
    if (seenKeywords.has(match.keyword)) continue;
    seenKeywords.add(match.keyword);

    // Add adjusted weight
    score += match.adjustedWeight;

    // Bonus for exact branded terms
    if (match.exact) {
      score += 0.2;
    }
  }

  // Scale to 0-10
  return Math.min(10, score * 2);
}

// Determine outreach tier based on total score
function determineOutreachTier(totalScore, categoryScores) {
  // Tier 1: Strong signals - high total OR specific high-value keywords
  if (totalScore >= 5 ||
      categoryScores.readiness >= 3 ||
      categoryScores.activation >= 2) {
    return 'tier1';
  }

  // Tier 2: Moderate signals
  if (totalScore >= 2 ||
      categoryScores.readiness >= 1.5) {
    return 'tier2';
  }

  // Tier 3: Limited signals
  return 'tier3';
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

async function main() {
  // Parse args
  const args = process.argv.slice(2);
  let batchId = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--batch-id' && args[i + 1]) {
      batchId = args[i + 1];
      i++;
    }
  }

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  console.log('=== Phase 2C: Compute Keyword Taxonomy Scores ===\n');

  // Get all districts with documents
  let query = `
    SELECT DISTINCT nces_id
    FROM district_documents
  `;
  const params = [];

  if (batchId) {
    // If batch ID specified, only score districts from that batch
    query = `
      SELECT DISTINCT nces_id
      FROM document_crawl_log
      WHERE crawl_batch_id = $1
    `;
    params.push(batchId);
    console.log(`Filtering by batch ID: ${batchId}`);
  }

  const districtsResult = await client.query(query, params);
  const ncesIds = districtsResult.rows.map(r => r.nces_id);

  console.log(`Found ${ncesIds.length} districts with documents\n`);

  // Stats
  const stats = {
    processed: 0,
    withKeywords: 0,
    tier1: 0,
    tier2: 0,
    tier3: 0,
    totalDocuments: 0
  };

  // Process each district
  for (const ncesId of ncesIds) {
    // Get all documents for this district
    const docsResult = await client.query(`
      SELECT id, document_url, document_category, extracted_text, discovered_at
      FROM district_documents
      WHERE nces_id = $1 AND extracted_text IS NOT NULL
    `, [ncesId]);

    if (docsResult.rows.length === 0) continue;

    // Aggregate matches across all documents
    const allMatches = {
      readiness: [],
      alignment: [],
      activation: [],
      branding: []
    };

    for (const doc of docsResult.rows) {
      const docMatches = analyzeText(
        doc.extracted_text,
        doc.discovered_at,
        doc.document_url,
        doc.document_category
      );

      // Merge matches
      for (const category of Object.keys(allMatches)) {
        for (const match of docMatches[category]) {
          allMatches[category].push({
            ...match,
            source_doc: doc.document_url
          });
        }
      }
    }

    // Calculate scores
    const categoryScores = {
      readiness: calculateCategoryScore(allMatches.readiness),
      alignment: calculateCategoryScore(allMatches.alignment),
      activation: calculateCategoryScore(allMatches.activation),
      branding: calculateCategoryScore(allMatches.branding)
    };

    const totalScore = (
      categoryScores.readiness +
      categoryScores.alignment +
      categoryScores.activation +
      categoryScores.branding
    ) / 4;

    const outreachTier = determineOutreachTier(totalScore, categoryScores);

    // Prepare keyword matches JSON
    const keywordMatchesJson = {};
    for (const [category, matches] of Object.entries(allMatches)) {
      if (matches.length > 0) {
        keywordMatchesJson[category] = matches.map(m => ({
          keyword: m.keyword,
          weight: m.adjustedWeight,
          source_doc: m.source_doc,
          context: m.context
        }));
      }
    }

    // Upsert into district_keyword_scores
    await client.query(`
      INSERT INTO district_keyword_scores
      (nces_id, readiness_score, alignment_score, activation_score, branding_score,
       total_score, outreach_tier, keyword_matches, documents_analyzed, scored_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      ON CONFLICT (nces_id) DO UPDATE SET
        readiness_score = EXCLUDED.readiness_score,
        alignment_score = EXCLUDED.alignment_score,
        activation_score = EXCLUDED.activation_score,
        branding_score = EXCLUDED.branding_score,
        total_score = EXCLUDED.total_score,
        outreach_tier = EXCLUDED.outreach_tier,
        keyword_matches = EXCLUDED.keyword_matches,
        documents_analyzed = EXCLUDED.documents_analyzed,
        updated_at = NOW()
    `, [
      ncesId,
      categoryScores.readiness,
      categoryScores.alignment,
      categoryScores.activation,
      categoryScores.branding,
      totalScore,
      outreachTier,
      JSON.stringify(keywordMatchesJson),
      docsResult.rows.length
    ]);

    // Update stats
    stats.processed++;
    stats.totalDocuments += docsResult.rows.length;
    if (totalScore > 0) stats.withKeywords++;
    stats[outreachTier]++;

    // Progress
    if (stats.processed % 50 === 0) {
      console.log(`Processed ${stats.processed}/${ncesIds.length} districts...`);
    }
  }

  // Summary
  console.log('\n=== SCORING COMPLETE ===\n');
  console.log(`Districts processed: ${stats.processed}`);
  console.log(`Districts with keyword matches: ${stats.withKeywords} (${(stats.withKeywords/stats.processed*100).toFixed(1)}%)`);
  console.log(`Total documents analyzed: ${stats.totalDocuments}`);
  console.log('\nOutreach Tier Distribution:');
  console.log(`  Tier 1 (Strong signals):  ${stats.tier1} (${(stats.tier1/stats.processed*100).toFixed(1)}%)`);
  console.log(`  Tier 2 (Moderate):        ${stats.tier2} (${(stats.tier2/stats.processed*100).toFixed(1)}%)`);
  console.log(`  Tier 3 (Limited):         ${stats.tier3} (${(stats.tier3/stats.processed*100).toFixed(1)}%)`);

  // Show top scoring districts
  const topResult = await client.query(`
    SELECT s.nces_id, d.district_name, d.state,
           s.readiness_score, s.alignment_score, s.activation_score,
           s.total_score, s.outreach_tier
    FROM district_keyword_scores s
    JOIN superintendent_directory d ON s.nces_id = d.nces_id
    ORDER BY s.total_score DESC
    LIMIT 10
  `);

  console.log('\nTop 10 Scoring Districts:');
  console.log('-'.repeat(80));
  for (const row of topResult.rows) {
    console.log(`${row.district_name} (${row.state})`);
    console.log(`  Total: ${parseFloat(row.total_score).toFixed(2)} | Readiness: ${parseFloat(row.readiness_score).toFixed(2)} | Alignment: ${parseFloat(row.alignment_score).toFixed(2)} | Activation: ${parseFloat(row.activation_score).toFixed(2)} | Tier: ${row.outreach_tier}`);
  }

  await client.end();
}

main().catch(console.error);
