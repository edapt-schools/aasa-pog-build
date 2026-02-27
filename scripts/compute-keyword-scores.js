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
// BUG FIX #1: Co-mention filtering
// Generic terms only score if they co-occur within 500 chars of a qualifying
// term. This prevents false positives from generic district content that
// mentions "strategic plan" or "professional development" without any
// Portrait-of-Graduate or future-ready context.
// =============================================================================

const GENERIC_KEYWORDS = new Set([
  'strategic_plan', 'strategic_priorities', 'strategic_framework',
  'strategic_roadmap', 'community_commitments', 'community_visioning',
  'listening_sessions', 'listening_tour', 'mission_vision_refresh',
  'district_vision_goals', 'learning_labs', 'design_studios',
  'annual_celebrations', 'community_celebration', 'campaign_plan',
  'community_storytelling'
]);

const QUALIFYING_PATTERNS = [
  /portrait/gi,
  /graduate/gi,
  /learner\s+profile/gi,
  /competency/gi,
  /\bai\b/gi,
  /future[- ]?ready/gi,
  /learner[- ]centered/gi,
  /student[- ]centered\s+outcomes?/gi
];

/**
 * Check if a generic keyword co-occurs within 500 chars of a qualifying term.
 * Returns true if the match is validated (either not generic, or has a nearby qualifier).
 */
function passesCoMentionFilter(text, matchIndex, keywordName) {
  if (!GENERIC_KEYWORDS.has(keywordName)) return true; // Not generic, always passes

  const windowStart = Math.max(0, matchIndex - 500);
  const windowEnd = Math.min(text.length, matchIndex + 500);
  const window = text.substring(windowStart, windowEnd).toLowerCase();

  for (const qp of QUALIFYING_PATTERNS) {
    // Reset regex state since we reuse them
    qp.lastIndex = 0;
    if (qp.test(window)) return true;
  }

  return false; // Generic term with no nearby qualifier = skip
}

// =============================================================================
// BUG FIX #8: Negative dampeners
// Keywords that signal resistance or opposition to a topic. When these
// co-occur with a topic keyword, they reduce that category's score by 50%.
// This prevents districts actively opposing AI or innovation from scoring
// as if they're embracing it.
// =============================================================================

const NEGATIVE_DAMPENER_PATTERNS = [
  /\bban\b/gi,
  /\bprohibit/gi,
  /\bmoratorium\b/gi,
  /\bnot\s+ready\b/gi,
  /\bdelay\s+implementation\b/gi,
  /\bconcerns?\s+about\s+ai\b/gi,
  /\bsuspend\s+use\b/gi,
  /\brestrict\s+access\b/gi
];

/**
 * Check if negative dampener keywords co-occur near a match position.
 * Returns a multiplier: 0.5 if dampener found, 1.0 otherwise.
 */
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

// =============================================================================
// KEYWORD TAXONOMY (from planning-docs/Keyword Taxonomy and Synonyms.pdf)
//
// BUG FIX #6: Expanded branding keywords with additional Portrait/PoG terms
// BUG FIX #7: Added missing taxonomy keywords for AI readiness, tech governance, etc.
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
      // FIX #6: Additional Portrait/PoG variant terms
      { pattern: /portrait\s+of\s+(a\s+)?learner/gi, weight: 1.0, name: 'portrait_of_learner', exact: true },
      { pattern: /future[- ]?ready\s+graduate/gi, weight: 0.9, name: 'future_ready_graduate', exact: true },
      { pattern: /learner[- ]centered/gi, weight: 0.7, name: 'learner_centered' },
      { pattern: /student[- ]centered\s+outcomes?/gi, weight: 0.7, name: 'student_centered_outcomes' },
      { pattern: /competency[- ]based/gi, weight: 0.7, name: 'competency_based' },
      // FIX #7: AI readiness and technology governance keywords
      { pattern: /\bai\s+readiness\b/gi, weight: 0.8, name: 'ai_readiness' },
      { pattern: /technology\s+governance/gi, weight: 0.7, name: 'technology_governance' },
      { pattern: /data\s+privacy\s+framework/gi, weight: 0.7, name: 'data_privacy_framework' },
      { pattern: /digital\s+citizenship/gi, weight: 0.6, name: 'digital_citizenship' },
      { pattern: /personalized\s+learning/gi, weight: 0.7, name: 'personalized_learning' },

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
// BUG FIX #3: Recency multiplier with URL date extraction
// Extract actual dates from URLs (e.g., /2024/, /2023-04/) and document content,
// not just crawl timestamps. Apply proper decay curve: recent docs matter most,
// old docs fade. No-date docs get crawl_date with 0.7 cap to avoid inflating
// stale content that just happened to be crawled recently.
// =============================================================================

/**
 * Attempt to extract a publication date from the URL.
 * Common patterns: /2024/, /2023-04/, /2024-01-15/, /2024_report, etc.
 */
function extractDateFromUrl(url) {
  if (!url) return null;

  // Match /YYYY-MM-DD/ or /YYYY-MM/ or /YYYY/
  const fullDate = url.match(/\/(\d{4})-(\d{2})(?:-(\d{2}))?(?:\/|$|\?)/);
  if (fullDate) {
    const year = parseInt(fullDate[1]);
    const month = parseInt(fullDate[2]) - 1;
    const day = fullDate[3] ? parseInt(fullDate[3]) : 1;
    if (year >= 2015 && year <= 2030) return new Date(year, month, day);
  }

  // Match /YYYY/ standalone in path
  const yearOnly = url.match(/\/(\d{4})\//);
  if (yearOnly) {
    const year = parseInt(yearOnly[1]);
    if (year >= 2015 && year <= 2030) return new Date(year, 6, 1); // Mid-year estimate
  }

  return null;
}

/**
 * Attempt to extract a publication date from document text.
 * Looks for common date patterns near the beginning of the document.
 */
function extractDateFromContent(text) {
  if (!text) return null;

  // Only search first 2000 chars (dates are usually near the top)
  const header = text.substring(0, 2000);

  // "Published: January 2024", "Updated: March 15, 2023", etc.
  const publishedMatch = header.match(/(?:published|updated|date|posted|revised)\s*:?\s*(\w+\s+\d{1,2},?\s+\d{4})/i);
  if (publishedMatch) {
    const d = new Date(publishedMatch[1]);
    if (!isNaN(d.getTime())) return d;
  }

  // "January 2024", "March 2023" near top of doc
  const monthYear = header.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
  if (monthYear) {
    const d = new Date(monthYear[0]);
    if (!isNaN(d.getTime()) && d.getFullYear() >= 2015) return d;
  }

  return null;
}

function getRecencyMultiplier(crawledAt, url, text) {
  const now = new Date();

  // Try to extract actual publication date (URL first, then content)
  const urlDate = extractDateFromUrl(url);
  const contentDate = extractDateFromContent(text);
  const publishDate = urlDate || contentDate;

  let docDate;
  let usedCrawlDate = false;

  if (publishDate) {
    docDate = publishDate;
  } else if (crawledAt) {
    // FIX #3: No-date docs use crawl_date but cap multiplier at 0.7
    // because "recently crawled" != "recently published"
    docDate = new Date(crawledAt);
    usedCrawlDate = true;
  } else {
    return 0.5; // No date at all = assume old
  }

  const monthsAgo = (now - docDate) / (1000 * 60 * 60 * 24 * 30);

  let multiplier;
  if (monthsAgo <= 6) multiplier = 1.0;
  else if (monthsAgo <= 12) multiplier = 0.8;
  else if (monthsAgo <= 24) multiplier = 0.5;
  else if (monthsAgo <= 36) multiplier = 0.3;
  else multiplier = 0.1;

  // Cap at 0.7 if we're using crawl date as a proxy
  if (usedCrawlDate && multiplier > 0.7) {
    multiplier = 0.7;
  }

  return multiplier;
}

// =============================================================================
// BUG FIX #9: URL categorization
// Tightened URL matching to prevent false positives. "/plan" was matching
// "/floor-plan", "/meal-plan", "/emergency-plan" etc. Now uses specific
// substrings like "/strategic-plan", "/portrait-of", "/graduate-profile".
// =============================================================================

function getSpecificityMultiplier(url, documentCategory) {
  const urlLower = (url || '').toLowerCase();

  // District-authored implementation content (highest value)
  // FIX #9: Specific URL patterns instead of loose "/plan" matching
  if (urlLower.includes('/strategic-plan') ||
      urlLower.includes('/strategic_plan') ||
      urlLower.includes('/portrait-of') ||
      urlLower.includes('/portrait_of') ||
      urlLower.includes('/graduate-profile') ||
      urlLower.includes('/graduate_profile') ||
      urlLower.includes('/learner-profile') ||
      urlLower.includes('/learner_profile') ||
      urlLower.includes('/framework-for-learning') ||
      urlLower.includes('/vision-and-goals') ||
      urlLower.includes('/competency') ||
      urlLower.includes('/future-ready')) {
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
  // FIX #3: Pass url and text to recency multiplier for date extraction
  const recencyMult = getRecencyMultiplier(crawledAt, url, text);
  const specificityMult = getSpecificityMultiplier(url, documentCategory);

  // Check each category
  for (const [category, data] of Object.entries(TAXONOMY)) {
    for (const keyword of data.keywords) {
      // Use a fresh regex each time to avoid lastIndex state issues
      const regex = new RegExp(keyword.pattern.source, keyword.pattern.flags);
      const matchResults = textLower.match(regex);

      if (matchResults) {
        // Find the position of the first match for co-mention and dampener checks
        const matchIndex = textLower.indexOf(matchResults[0].toLowerCase());

        // FIX #1: Co-mention filter for generic terms
        if (!passesCoMentionFilter(textLower, matchIndex, keyword.name)) {
          continue; // Generic term without qualifying context, skip
        }

        // FIX #8: Check for negative dampeners near this match
        const dampenerMult = getDampenerMultiplier(textLower, matchIndex);

        // Calculate weighted score with multipliers
        const baseWeight = keyword.weight;
        const adjustedWeight = baseWeight * recencyMult * specificityMult * dampenerMult;

        matches[category].push({
          keyword: keyword.name,
          baseWeight: baseWeight,
          adjustedWeight: adjustedWeight,
          count: matchResults.length,
          exact: keyword.exact || false,
          dampened: dampenerMult < 1.0, // Track if dampener was applied
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

// =============================================================================
// BUG FIX #2: Highest-weight dedup (not first-match-wins)
// BUG FIX #4: Diminishing returns scaling instead of linear x2 cap
// =============================================================================

function calculateCategoryScore(matches) {
  if (matches.length === 0) return 0;

  // FIX #2: Keep the HIGHEST weight match per keyword, not the first one.
  // When the same keyword appears in multiple documents with different
  // recency/specificity multipliers, we want the best signal, not an
  // arbitrary first occurrence.
  const bestByKeyword = new Map();

  for (const match of matches) {
    const existing = bestByKeyword.get(match.keyword);
    if (!existing || match.adjustedWeight > existing.adjustedWeight) {
      bestByKeyword.set(match.keyword, match);
    }
  }

  // Sum the best adjusted weights
  let score = 0;
  for (const match of bestByKeyword.values()) {
    score += match.adjustedWeight;

    // Bonus for exact branded terms
    if (match.exact) {
      score += 0.2;
    }
  }

  // FIX #4: Diminishing returns scaling instead of Math.min(10, sum * 2)
  // Formula: 10 * (1 - e^(-sum/3))
  // - First matches contribute the most signal
  // - Additional matches have diminishing marginal value
  // - Score asymptotically approaches 10 but never exceeds it
  // - At sum=3 (~2 strong keywords): score ~6.3
  // - At sum=6 (~4 strong keywords): score ~8.6
  // - At sum=9 (~6 strong keywords): score ~9.5
  return 10 * (1 - Math.exp(-score / 3));
}

// =============================================================================
// BUG FIX #5: Weighted average (replaces equal 1/4 weights)
// Readiness is the strongest buy signal (0.35), Alignment and Activation
// are equal secondary signals (0.25 each), Branding is supporting (0.15).
// =============================================================================

function calculateTotalScore(categoryScores) {
  return (
    categoryScores.readiness  * 0.35 +
    categoryScores.alignment  * 0.25 +
    categoryScores.activation * 0.25 +
    categoryScores.branding   * 0.15
  );
}

// Determine outreach tier based on total score
// Updated thresholds to reflect new scoring distribution:
// - Diminishing returns scoring produces smoother 0-10 scale
// - Weighted average means total score is also 0-10
// - Tier 1: totalScore >= 4 (strong multi-category signal or very strong readiness)
// - Tier 2: totalScore >= 1.5 (moderate signal in at least one area)
// - Tier 3: below 1.5
function determineOutreachTier(totalScore, categoryScores) {
  // Tier 1: Strong signals - high total OR specific high-value category scores
  if (totalScore >= 4 ||
      categoryScores.readiness >= 5 ||
      categoryScores.activation >= 4) {
    return 'tier1';
  }

  // Tier 2: Moderate signals
  if (totalScore >= 1.5 ||
      categoryScores.readiness >= 2.5) {
    return 'tier2';
  }

  // Tier 3: Limited signals
  return 'tier3';
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

// =============================================================================
// Connection management — reconnect per batch to survive Supabase timeouts
// =============================================================================

async function createClient() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 30000,
    query_timeout: 30000,
  });
  // Prevent unhandled 'error' events from crashing the process.
  // Connection errors are caught by our try/catch in the processing loop.
  client.on('error', (err) => {
    console.error(`  [pg] Background connection error: ${err.message}`);
  });
  await client.connect();
  return client;
}

async function safeEnd(client) {
  try { await client.end(); } catch (_) { /* already closed */ }
}

// Process a single district, returning its stats contribution
async function processDistrict(client, ncesId) {
  const docsResult = await client.query(`
    SELECT id, document_url, document_category, extracted_text, discovered_at
    FROM district_documents
    WHERE nces_id = $1 AND extracted_text IS NOT NULL
  `, [ncesId]);

  if (docsResult.rows.length === 0) return null;

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

    for (const category of Object.keys(allMatches)) {
      for (const match of docMatches[category]) {
        allMatches[category].push({
          ...match,
          source_doc: doc.document_url
        });
      }
    }
  }

  const categoryScores = {
    readiness: calculateCategoryScore(allMatches.readiness),
    alignment: calculateCategoryScore(allMatches.alignment),
    activation: calculateCategoryScore(allMatches.activation),
    branding: calculateCategoryScore(allMatches.branding)
  };

  const totalScore = calculateTotalScore(categoryScores);
  const outreachTier = determineOutreachTier(totalScore, categoryScores);

  const keywordMatchesJson = {};
  for (const [category, matches] of Object.entries(allMatches)) {
    if (matches.length > 0) {
      keywordMatchesJson[category] = matches.map(m => ({
        keyword: m.keyword,
        weight: m.adjustedWeight,
        source_doc: m.source_doc,
        context: m.context,
        ...(m.dampened ? { dampened: true } : {})
      }));
    }
  }

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

  return {
    docs: docsResult.rows.length,
    hasKeywords: totalScore > 0,
    tier: outreachTier
  };
}

// =============================================================================
// MAIN FUNCTION — batch processing with reconnection
// =============================================================================

const BATCH_SIZE = 100;

async function main() {
  const args = process.argv.slice(2);
  let batchId = null;
  let resume = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--batch-id' && args[i + 1]) {
      batchId = args[i + 1];
      i++;
    }
    if (args[i] === '--resume') {
      resume = true;
    }
  }

  console.log('=== Phase 2C: Compute Keyword Taxonomy Scores ===\n');

  // Get district list with a short-lived connection
  let ncesIds;
  {
    const listClient = await createClient();
    let query, params = [];

    if (batchId) {
      query = `SELECT DISTINCT nces_id FROM document_crawl_log WHERE crawl_batch_id = $1`;
      params.push(batchId);
      console.log(`Filtering by batch ID: ${batchId}`);
    } else if (resume) {
      // Only score districts not yet scored with the new engine (scored_at still old)
      query = `
        SELECT DISTINCT dd.nces_id
        FROM district_documents dd
        LEFT JOIN district_keyword_scores s ON dd.nces_id = s.nces_id
        WHERE s.nces_id IS NULL
           OR s.scored_at < NOW() - INTERVAL '6 hours'
        ORDER BY dd.nces_id
      `;
      console.log('Resume mode: only scoring districts not yet updated in the last 6 hours');
    } else {
      query = `SELECT DISTINCT nces_id FROM district_documents ORDER BY nces_id`;
    }

    const districtsResult = await listClient.query(query, params);
    ncesIds = districtsResult.rows.map(r => r.nces_id);
    await safeEnd(listClient);
  }

  console.log(`Found ${ncesIds.length} districts to process\n`);

  if (ncesIds.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  const stats = {
    processed: 0,
    skipped: 0,
    withKeywords: 0,
    tier1: 0,
    tier2: 0,
    tier3: 0,
    totalDocuments: 0,
    errors: 0
  };

  // Process in batches with fresh connections
  const totalBatches = Math.ceil(ncesIds.length / BATCH_SIZE);

  for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
    const batchStart = batchNum * BATCH_SIZE;
    const batchEnd = Math.min(batchStart + BATCH_SIZE, ncesIds.length);
    const batchIds = ncesIds.slice(batchStart, batchEnd);

    let client;
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        client = await createClient();
        break;
      } catch (err) {
        retries++;
        console.error(`Connection attempt ${retries}/${maxRetries} failed: ${err.message}`);
        if (retries >= maxRetries) {
          throw new Error(`Failed to connect after ${maxRetries} attempts`);
        }
        await new Promise(r => setTimeout(r, 2000 * retries));
      }
    }

    console.log(`\nBatch ${batchNum + 1}/${totalBatches} (districts ${batchStart + 1}-${batchEnd})`);

    for (const ncesId of batchIds) {
      try {
        const result = await processDistrict(client, ncesId);

        if (result === null) {
          stats.skipped++;
          continue;
        }

        stats.processed++;
        stats.totalDocuments += result.docs;
        if (result.hasKeywords) stats.withKeywords++;
        stats[result.tier]++;

        if (stats.processed % 100 === 0) {
          console.log(`  Processed ${stats.processed}/${ncesIds.length} districts (${stats.errors} errors)...`);
        }
      } catch (err) {
        stats.errors++;
        console.error(`  Error processing ${ncesId}: ${err.message}`);

        // If it's a connection error, reconnect and retry this district
        const isConnError = err.message.includes('Connection terminated')
          || err.message.includes('ECONNRESET')
          || err.message.includes('ETIMEDOUT')
          || err.message.includes('read timeout')
          || err.message.includes('Query read timeout')
          || err.code === 'ETIMEDOUT'
          || err.code === 'ECONNRESET';

        if (isConnError) {
          console.log('  Connection lost. Reconnecting after 2s pause...');
          await safeEnd(client);
          await new Promise(r => setTimeout(r, 2000));
          try {
            client = await createClient();
            // Retry the failed district
            const retryResult = await processDistrict(client, ncesId);
            if (retryResult) {
              stats.processed++;
              stats.errors--; // Undo the error count
              stats.totalDocuments += retryResult.docs;
              if (retryResult.hasKeywords) stats.withKeywords++;
              stats[retryResult.tier]++;
            }
          } catch (retryErr) {
            console.error(`  Retry also failed for ${ncesId}: ${retryErr.message}`);
            // Try one more fresh connection for the rest of the batch
            await safeEnd(client);
            await new Promise(r => setTimeout(r, 3000));
            try { client = await createClient(); } catch (_) {}
          }
        }
      }
    }

    await safeEnd(client);

    // Brief pause between batches to be kind to the connection pool
    if (batchNum < totalBatches - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Summary
  console.log('\n=== SCORING COMPLETE ===\n');
  console.log(`Districts processed: ${stats.processed}`);
  console.log(`Districts skipped (no docs): ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);
  console.log(`Districts with keyword matches: ${stats.withKeywords} (${(stats.withKeywords/Math.max(stats.processed,1)*100).toFixed(1)}%)`);
  console.log(`Total documents analyzed: ${stats.totalDocuments}`);
  console.log('\nOutreach Tier Distribution:');
  console.log(`  Tier 1 (Strong signals):  ${stats.tier1} (${(stats.tier1/Math.max(stats.processed,1)*100).toFixed(1)}%)`);
  console.log(`  Tier 2 (Moderate):        ${stats.tier2} (${(stats.tier2/Math.max(stats.processed,1)*100).toFixed(1)}%)`);
  console.log(`  Tier 3 (Limited):         ${stats.tier3} (${(stats.tier3/Math.max(stats.processed,1)*100).toFixed(1)}%)`);

  // Show top scoring districts
  const finalClient = await createClient();
  const topResult = await finalClient.query(`
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

  await safeEnd(finalClient);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
