/**
 * Validate Benchmark Districts Against New Scoring Engine
 *
 * DRY RUN ONLY — does NOT write to the database.
 *
 * For each of the 52 benchmark districts:
 *   1. Fetches all documents from district_documents
 *   2. Runs the NEW scoring logic (all 9 bug fixes) against those documents
 *   3. Compares: old score vs new score, old tier vs new tier vs expected tier
 *   4. Outputs a detailed report
 *
 * Usage:
 *   node scripts/validate-benchmark.js
 *   node scripts/validate-benchmark.js --verbose   (show keyword match details)
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres';
const VERBOSE = process.argv.includes('--verbose');

// =============================================================================
// NEW SCORING ENGINE (replicated from compute-keyword-scores.js with all 9 fixes)
// =============================================================================

// FIX #1: Co-mention filtering
const GENERIC_KEYWORDS = new Set([
  'strategic_plan', 'strategic_priorities', 'strategic_framework',
  'strategic_roadmap', 'community_commitments', 'community_visioning',
  'listening_sessions', 'listening_tour', 'mission_vision_refresh',
  'district_vision_goals', 'learning_labs', 'design_studios',
  'annual_celebrations', 'community_celebration', 'campaign_plan',
  'community_storytelling'
]);

const QUALIFYING_PATTERNS = [
  /portrait/gi, /graduate/gi, /learner\s+profile/gi, /competency/gi,
  /\bai\b/gi, /future[- ]?ready/gi, /learner[- ]centered/gi,
  /student[- ]centered\s+outcomes?/gi
];

function passesCoMentionFilter(text, matchIndex, keywordName) {
  if (!GENERIC_KEYWORDS.has(keywordName)) return true;
  const windowStart = Math.max(0, matchIndex - 500);
  const windowEnd = Math.min(text.length, matchIndex + 500);
  const window = text.substring(windowStart, windowEnd).toLowerCase();
  for (const qp of QUALIFYING_PATTERNS) {
    qp.lastIndex = 0;
    if (qp.test(window)) return true;
  }
  return false;
}

// FIX #8: Negative dampeners
const NEGATIVE_DAMPENER_PATTERNS = [
  /\bban\b/gi, /\bprohibit/gi, /\bmoratorium\b/gi, /\bnot\s+ready\b/gi,
  /\bdelay\s+implementation\b/gi, /\bconcerns?\s+about\s+ai\b/gi,
  /\bsuspend\s+use\b/gi, /\brestrict\s+access\b/gi
];

function getDampenerMultiplier(text, matchIndex) {
  const windowStart = Math.max(0, matchIndex - 300);
  const windowEnd = Math.min(text.length, matchIndex + 300);
  const window = text.substring(windowStart, windowEnd);
  for (const dp of NEGATIVE_DAMPENER_PATTERNS) {
    dp.lastIndex = 0;
    if (dp.test(window)) return 0.5;
  }
  return 1.0;
}

// TAXONOMY with FIX #6 and #7 expansions
const TAXONOMY = {
  readiness: {
    name: 'Readiness',
    keywords: [
      { pattern: /portrait\s+of\s+(a\s+)?graduate/gi, weight: 1.0, name: 'portrait_of_graduate', exact: true },
      { pattern: /graduate\s+profile/gi, weight: 1.0, name: 'graduate_profile', exact: true },
      { pattern: /learner\s+profile/gi, weight: 0.9, name: 'learner_profile' },
      { pattern: /graduate\s+competenc(y|ies)/gi, weight: 0.9, name: 'graduate_competencies' },
      { pattern: /profile\s+of\s+(a\s+)?graduate/gi, weight: 1.0, name: 'profile_of_graduate', exact: true },
      { pattern: /student\s+success\s+vision/gi, weight: 0.8, name: 'student_success_vision' },
      { pattern: /future[- ]?ready\s+skills/gi, weight: 0.7, name: 'future_ready_skills' },
      { pattern: /habits\s+of\s+success/gi, weight: 0.7, name: 'habits_of_success' },
      { pattern: /portrait\s+of\s+(a\s+)?learner/gi, weight: 1.0, name: 'portrait_of_learner', exact: true },
      { pattern: /future[- ]?ready\s+graduate/gi, weight: 0.9, name: 'future_ready_graduate', exact: true },
      { pattern: /learner[- ]centered/gi, weight: 0.7, name: 'learner_centered' },
      { pattern: /student[- ]centered\s+outcomes?/gi, weight: 0.7, name: 'student_centered_outcomes' },
      { pattern: /competency[- ]based/gi, weight: 0.7, name: 'competency_based' },
      { pattern: /\bai\s+readiness\b/gi, weight: 0.8, name: 'ai_readiness' },
      { pattern: /technology\s+governance/gi, weight: 0.7, name: 'technology_governance' },
      { pattern: /data\s+privacy\s+framework/gi, weight: 0.7, name: 'data_privacy_framework' },
      { pattern: /digital\s+citizenship/gi, weight: 0.6, name: 'digital_citizenship' },
      { pattern: /personalized\s+learning/gi, weight: 0.7, name: 'personalized_learning' },
      { pattern: /community\s+compass/gi, weight: 0.9, name: 'community_compass', exact: true },
      { pattern: /stakeholder\s+engagement\s+framework/gi, weight: 0.85, name: 'stakeholder_engagement' },
      { pattern: /community\s+commitments?/gi, weight: 0.8, name: 'community_commitments' },
      { pattern: /community\s+visioning/gi, weight: 0.8, name: 'community_visioning' },
      { pattern: /listening\s+sessions?/gi, weight: 0.6, name: 'listening_sessions' },
      { pattern: /listening\s+tour/gi, weight: 0.6, name: 'listening_tour' },
      { pattern: /strategic\s+plan(?:ning)?/gi, weight: 0.8, name: 'strategic_plan' },
      { pattern: /strategic\s+priorit(y|ies)/gi, weight: 0.8, name: 'strategic_priorities' },
      { pattern: /district\s+vision\s+(&|and)\s+goals/gi, weight: 0.7, name: 'district_vision_goals' },
      { pattern: /strategic\s+framework/gi, weight: 0.7, name: 'strategic_framework' },
      { pattern: /strategic\s+roadmap/gi, weight: 0.7, name: 'strategic_roadmap' },
      { pattern: /mission[\/\s]vision\s+refresh/gi, weight: 0.6, name: 'mission_vision_refresh' },
      { pattern: /implementation\s+roadmap/gi, weight: 0.7, name: 'implementation_roadmap' },
      { pattern: /portrait\s+roadmap/gi, weight: 0.7, name: 'portrait_roadmap' },
      { pattern: /action\s+roadmap/gi, weight: 0.7, name: 'action_roadmap' },
      { pattern: /operationalize\s+portrait/gi, weight: 0.7, name: 'operationalize_portrait' }
    ]
  },
  alignment: {
    name: 'Alignment',
    keywords: [
      { pattern: /portrait\s+of\s+educators?/gi, weight: 0.9, name: 'portrait_of_educators', exact: true },
      { pattern: /educator\s+competenc(y|ies)/gi, weight: 0.9, name: 'educator_competencies' },
      { pattern: /teacher\s+competenc(y|ies)/gi, weight: 0.9, name: 'teacher_competencies' },
      { pattern: /leadership\s+competenc(y|ies)/gi, weight: 0.85, name: 'leadership_competencies' },
      { pattern: /educator\s+profile/gi, weight: 0.85, name: 'educator_profile' },
      { pattern: /staff\s+competenc(y|ies)/gi, weight: 0.8, name: 'staff_competencies' },
      { pattern: /adult\s+competenc(y|ies)/gi, weight: 0.8, name: 'adult_competencies' },
      { pattern: /instructional\s+competenc(y|ies)/gi, weight: 0.8, name: 'instructional_competencies' },
      { pattern: /framework(s)?\s+for\s+learning/gi, weight: 0.85, name: 'frameworks_for_learning', exact: true },
      { pattern: /learning\s+framework/gi, weight: 0.85, name: 'learning_framework' },
      { pattern: /instructional\s+framework/gi, weight: 0.85, name: 'instructional_framework' },
      { pattern: /graduate\s+profile[- ]aligned\s+curriculum/gi, weight: 0.85, name: 'profile_aligned_curriculum' },
      { pattern: /learning\s+design\s+framework/gi, weight: 0.8, name: 'learning_design_framework' },
      { pattern: /curricular\s+alignment/gi, weight: 0.75, name: 'curricular_alignment' },
      { pattern: /competency[- ]based\s+pathways?/gi, weight: 0.75, name: 'competency_based_pathways' },
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
    keywords: [
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
    keywords: [
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

// FIX #3: Recency with date extraction
function extractDateFromUrl(url) {
  if (!url) return null;
  const fullDate = url.match(/\/(\d{4})-(\d{2})(?:-(\d{2}))?(?:\/|$|\?)/);
  if (fullDate) {
    const year = parseInt(fullDate[1]);
    const month = parseInt(fullDate[2]) - 1;
    const day = fullDate[3] ? parseInt(fullDate[3]) : 1;
    if (year >= 2015 && year <= 2030) return new Date(year, month, day);
  }
  const yearOnly = url.match(/\/(\d{4})\//);
  if (yearOnly) {
    const year = parseInt(yearOnly[1]);
    if (year >= 2015 && year <= 2030) return new Date(year, 6, 1);
  }
  return null;
}

function extractDateFromContent(text) {
  if (!text) return null;
  const header = text.substring(0, 2000);
  const publishedMatch = header.match(/(?:published|updated|date|posted|revised)\s*:?\s*(\w+\s+\d{1,2},?\s+\d{4})/i);
  if (publishedMatch) {
    const d = new Date(publishedMatch[1]);
    if (!isNaN(d.getTime())) return d;
  }
  const monthYear = header.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
  if (monthYear) {
    const d = new Date(monthYear[0]);
    if (!isNaN(d.getTime()) && d.getFullYear() >= 2015) return d;
  }
  return null;
}

function getRecencyMultiplier(crawledAt, url, text) {
  const now = new Date();
  const urlDate = extractDateFromUrl(url);
  const contentDate = extractDateFromContent(text);
  const publishDate = urlDate || contentDate;

  let docDate;
  let usedCrawlDate = false;

  if (publishDate) {
    docDate = publishDate;
  } else if (crawledAt) {
    docDate = new Date(crawledAt);
    usedCrawlDate = true;
  } else {
    return 0.5;
  }

  const monthsAgo = (now - docDate) / (1000 * 60 * 60 * 24 * 30);

  let multiplier;
  if (monthsAgo <= 6) multiplier = 1.0;
  else if (monthsAgo <= 12) multiplier = 0.8;
  else if (monthsAgo <= 24) multiplier = 0.5;
  else if (monthsAgo <= 36) multiplier = 0.3;
  else multiplier = 0.1;

  if (usedCrawlDate && multiplier > 0.7) multiplier = 0.7;
  return multiplier;
}

// FIX #9: Tightened URL categorization
function getSpecificityMultiplier(url, documentCategory) {
  const urlLower = (url || '').toLowerCase();
  if (urlLower.includes('/strategic-plan') || urlLower.includes('/strategic_plan') ||
      urlLower.includes('/portrait-of') || urlLower.includes('/portrait_of') ||
      urlLower.includes('/graduate-profile') || urlLower.includes('/graduate_profile') ||
      urlLower.includes('/learner-profile') || urlLower.includes('/learner_profile') ||
      urlLower.includes('/framework-for-learning') || urlLower.includes('/vision-and-goals') ||
      urlLower.includes('/competency') || urlLower.includes('/future-ready')) {
    return 1.0;
  }
  if (documentCategory === 'portrait_of_graduate' || documentCategory === 'strategic_plan') return 1.0;
  if (urlLower.includes('news') || urlLower.includes('article') ||
      urlLower.includes('press') || urlLower.includes('blog')) return 0.5;
  return 0.8;
}

function analyzeText(text, crawledAt, url, documentCategory) {
  const matches = { readiness: [], alignment: [], activation: [], branding: [] };
  const textLower = (text || '').toLowerCase();
  const recencyMult = getRecencyMultiplier(crawledAt, url, text);
  const specificityMult = getSpecificityMultiplier(url, documentCategory);

  for (const [category, data] of Object.entries(TAXONOMY)) {
    for (const keyword of data.keywords) {
      const regex = new RegExp(keyword.pattern.source, keyword.pattern.flags);
      const matchResults = textLower.match(regex);
      if (matchResults) {
        const matchIndex = textLower.indexOf(matchResults[0].toLowerCase());
        if (!passesCoMentionFilter(textLower, matchIndex, keyword.name)) continue;
        const dampenerMult = getDampenerMultiplier(textLower, matchIndex);
        const baseWeight = keyword.weight;
        const adjustedWeight = baseWeight * recencyMult * specificityMult * dampenerMult;
        matches[category].push({
          keyword: keyword.name,
          baseWeight, adjustedWeight,
          count: matchResults.length,
          exact: keyword.exact || false,
          dampened: dampenerMult < 1.0
        });
      }
    }
  }
  return matches;
}

// FIX #2: Highest-weight dedup
// FIX #4: Diminishing returns scaling
function calculateCategoryScore(matches) {
  if (matches.length === 0) return 0;
  const bestByKeyword = new Map();
  for (const match of matches) {
    const existing = bestByKeyword.get(match.keyword);
    if (!existing || match.adjustedWeight > existing.adjustedWeight) {
      bestByKeyword.set(match.keyword, match);
    }
  }
  let score = 0;
  for (const match of bestByKeyword.values()) {
    score += match.adjustedWeight;
    if (match.exact) score += 0.2;
  }
  return 10 * (1 - Math.exp(-score / 3));
}

// FIX #5: Weighted average
function calculateTotalScore(cs) {
  return cs.readiness * 0.35 + cs.alignment * 0.25 + cs.activation * 0.25 + cs.branding * 0.15;
}

function determineOutreachTier(totalScore, cs) {
  if (totalScore >= 4 || cs.readiness >= 5 || cs.activation >= 4) return 'tier1';
  if (totalScore >= 1.5 || cs.readiness >= 2.5) return 'tier2';
  return 'tier3';
}

function tierToNum(t) {
  if (t === 'tier1' || t === 1) return 1;
  if (t === 'tier2' || t === 2) return 2;
  return 3;
}

// =============================================================================
// MAIN VALIDATION
// =============================================================================

async function main() {
  const benchmarkPath = path.join(__dirname, 'benchmark-districts.json');
  const benchmark = JSON.parse(fs.readFileSync(benchmarkPath, 'utf-8'));

  console.log('=== BENCHMARK VALIDATION (DRY RUN) ===');
  console.log(`Benchmark districts: ${benchmark.length}`);
  console.log(`Date: ${new Date().toISOString()}\n`);

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const results = [];
  let processed = 0;

  for (const district of benchmark) {
    processed++;
    process.stdout.write(`\rProcessing ${processed}/${benchmark.length}...`);

    // Fetch documents for this district
    const docsResult = await client.query(`
      SELECT id, document_url, document_category, extracted_text, discovered_at
      FROM district_documents
      WHERE nces_id = $1 AND extracted_text IS NOT NULL
    `, [district.nces_id]);

    // Aggregate matches across all documents
    const allMatches = { readiness: [], alignment: [], activation: [], branding: [] };
    const keywordsFound = new Set();

    for (const doc of docsResult.rows) {
      const docMatches = analyzeText(
        doc.extracted_text, doc.discovered_at,
        doc.document_url, doc.document_category
      );
      for (const category of Object.keys(allMatches)) {
        for (const match of docMatches[category]) {
          allMatches[category].push(match);
          keywordsFound.add(match.keyword);
        }
      }
    }

    // Calculate NEW scores
    const newCategoryScores = {
      readiness: calculateCategoryScore(allMatches.readiness),
      alignment: calculateCategoryScore(allMatches.alignment),
      activation: calculateCategoryScore(allMatches.activation),
      branding: calculateCategoryScore(allMatches.branding)
    };

    const newTotalScore = calculateTotalScore(newCategoryScores);
    const newTier = determineOutreachTier(newTotalScore, newCategoryScores);

    results.push({
      nces_id: district.nces_id,
      name: district.name,
      state: district.state,
      enrollment: district.enrollment,
      expected_tier: district.expected_tier,
      old_score: district.current_score,
      old_tier: district.current_tier,
      new_score: parseFloat(newTotalScore.toFixed(4)),
      new_tier: tierToNum(newTier),
      new_category_scores: {
        readiness: parseFloat(newCategoryScores.readiness.toFixed(2)),
        alignment: parseFloat(newCategoryScores.alignment.toFixed(2)),
        activation: parseFloat(newCategoryScores.activation.toFixed(2)),
        branding: parseFloat(newCategoryScores.branding.toFixed(2))
      },
      docs_fetched: docsResult.rows.length,
      keywords_found: [...keywordsFound].sort(),
      tier_match: tierToNum(newTier) === district.expected_tier,
      score_delta: parseFloat((newTotalScore - district.current_score).toFixed(4))
    });
  }

  console.log('\n');
  await client.end();

  // ==========================================================================
  // REPORT
  // ==========================================================================

  // Overall tier accuracy
  const totalMatch = results.filter(r => r.tier_match).length;
  const accuracy = (totalMatch / results.length * 100).toFixed(1);

  console.log('='.repeat(90));
  console.log('  BENCHMARK VALIDATION REPORT');
  console.log('='.repeat(90));
  console.log(`\n  Overall Tier Accuracy: ${totalMatch}/${results.length} (${accuracy}%)`);
  console.log(`  Target: >= 80%    Result: ${parseFloat(accuracy) >= 80 ? 'PASS' : 'FAIL'}\n`);

  // Per-tier breakdown
  for (const expectedTier of [1, 2, 3]) {
    const tierResults = results.filter(r => r.expected_tier === expectedTier);
    const tierMatch = tierResults.filter(r => r.tier_match).length;
    const tierAcc = (tierMatch / tierResults.length * 100).toFixed(1);
    const tierLabel = expectedTier === 1 ? 'High' : expectedTier === 2 ? 'Moderate' : 'Low/Zero';

    console.log('-'.repeat(90));
    console.log(`  TIER ${expectedTier} (Expected ${tierLabel}): ${tierMatch}/${tierResults.length} correct (${tierAcc}%)`);
    console.log('-'.repeat(90));

    for (const r of tierResults) {
      const matchIcon = r.tier_match ? 'OK' : 'MISS';
      const direction = r.score_delta > 0 ? '+' : r.score_delta < 0 ? '' : ' ';
      console.log(
        `  [${matchIcon}]  ${r.name.padEnd(50)} ${r.state}  ` +
        `old=${r.old_score.toFixed(2)}->new=${r.new_score.toFixed(2)} (${direction}${r.score_delta.toFixed(2)})  ` +
        `tier: ${r.old_tier}->${r.new_tier} (exp=${r.expected_tier})`
      );

      if (VERBOSE || !r.tier_match) {
        console.log(
          `         R=${r.new_category_scores.readiness.toFixed(1)} A=${r.new_category_scores.alignment.toFixed(1)} ` +
          `C=${r.new_category_scores.activation.toFixed(1)} B=${r.new_category_scores.branding.toFixed(1)}  ` +
          `docs=${r.docs_fetched}  keywords=[${r.keywords_found.slice(0, 6).join(', ')}${r.keywords_found.length > 6 ? '...' : ''}]`
        );
      }
    }
    console.log('');
  }

  // Confusion matrix
  console.log('='.repeat(90));
  console.log('  CONFUSION MATRIX (New Tier vs Expected Tier)');
  console.log('='.repeat(90));
  const matrix = {};
  for (const r of results) {
    const key = `new_${r.new_tier}_exp_${r.expected_tier}`;
    matrix[key] = (matrix[key] || 0) + 1;
  }
  console.log('                   Expected 1   Expected 2   Expected 3');
  for (const newTier of [1, 2, 3]) {
    const row = [1, 2, 3].map(expTier => {
      const cnt = matrix[`new_${newTier}_exp_${expTier}`] || 0;
      return cnt.toString().padStart(10);
    });
    console.log(`  New Tier ${newTier}:  ${row.join('    ')}`);
  }

  // Score distribution stats
  console.log('\n' + '='.repeat(90));
  console.log('  SCORE DISTRIBUTION STATS');
  console.log('='.repeat(90));
  for (const expectedTier of [1, 2, 3]) {
    const tierResults = results.filter(r => r.expected_tier === expectedTier);
    const newScores = tierResults.map(r => r.new_score);
    const oldScores = tierResults.map(r => r.old_score);
    const deltas = tierResults.map(r => r.score_delta);

    console.log(`\n  Tier ${expectedTier}:`);
    console.log(`    Old scores:   min=${Math.min(...oldScores).toFixed(2)}  max=${Math.max(...oldScores).toFixed(2)}  avg=${(oldScores.reduce((a, b) => a + b, 0) / oldScores.length).toFixed(2)}`);
    console.log(`    New scores:   min=${Math.min(...newScores).toFixed(2)}  max=${Math.max(...newScores).toFixed(2)}  avg=${(newScores.reduce((a, b) => a + b, 0) / newScores.length).toFixed(2)}`);
    console.log(`    Score delta:  min=${Math.min(...deltas).toFixed(2)}  max=${Math.max(...deltas).toFixed(2)}  avg=${(deltas.reduce((a, b) => a + b, 0) / deltas.length).toFixed(2)}`);
  }

  // Misclassified districts detail
  const misses = results.filter(r => !r.tier_match);
  if (misses.length > 0) {
    console.log('\n' + '='.repeat(90));
    console.log('  MISCLASSIFIED DISTRICTS (Detailed)');
    console.log('='.repeat(90));
    for (const r of misses) {
      console.log(`\n  ${r.name} (${r.state}, ${r.enrollment.toLocaleString()} enrollment)`);
      console.log(`    Expected Tier: ${r.expected_tier}  |  Got Tier: ${r.new_tier}`);
      console.log(`    Old Score: ${r.old_score.toFixed(2)}  |  New Score: ${r.new_score.toFixed(2)}  (delta: ${r.score_delta >= 0 ? '+' : ''}${r.score_delta.toFixed(2)})`);
      console.log(`    Readiness=${r.new_category_scores.readiness.toFixed(2)}  Alignment=${r.new_category_scores.alignment.toFixed(2)}  Activation=${r.new_category_scores.activation.toFixed(2)}  Branding=${r.new_category_scores.branding.toFixed(2)}`);
      console.log(`    Docs: ${r.docs_fetched}  Keywords: [${r.keywords_found.join(', ')}]`);

      // Diagnose why it missed
      if (r.expected_tier < r.new_tier) {
        console.log(`    DIAGNOSIS: Scored LOWER than expected. New scoring may be more conservative.`);
      } else {
        console.log(`    DIAGNOSIS: Scored HIGHER than expected. New keywords or scoring may be too generous.`);
      }
    }
  }

  // Write results to JSON for further analysis
  const outPath = path.join(__dirname, 'benchmark-validation-results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\n\nFull results written to: ${outPath}`);
  console.log(`\nValidation complete. ${parseFloat(accuracy) >= 80 ? 'PASS' : 'FAIL'} (${accuracy}% accuracy)\n`);
}

main().catch(console.error);
