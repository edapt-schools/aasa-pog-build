# AASA District Intelligence Platform — Implementation Plan

**Version:** 1.0
**Date:** 2026-02-26
**Author:** Edapt Engineering
**Stakeholders:** Todd (AASA), Jeff (AASA Sales), Christian (Edapt)
**Status:** DRAFT — Pending Stakeholder Approval

---

## Executive Summary

The AASA District Intelligence Platform indexes 19,595 US public school districts and surfaces buying signals to help AASA's sales team prioritize outreach. The platform is functional but the scoring engine produces flat, undifferentiated scores (~0.3 for nearly every district), rendering the core value proposition useless.

This plan addresses 6 workstreams across 4 phases, moving from "demo-grade" to "production-grade" with acceptance criteria, testing plans, and validation benchmarks for every deliverable. Total estimated scope: ~4-6 weeks of focused engineering.

### Current State (What's Broken)

| Area | Status | Impact |
|------|--------|--------|
| **Scoring Engine** | 9 bugs identified, scores flat at ~0.3 | Blocks all downstream features |
| **Frontend Display** | Score bars render nearly empty, tier legend stale | Users see wrong data |
| **Navigation** | Labels don't match destinations, Grants missing from nav | Users get lost |
| **Data Quality** | 11.5% of districts have zero documents, quality tiers never computed | Gaps in coverage |
| **Event Upload** | Does not exist | Jeff's highest-priority feature |
| **Source Freshness** | No staleness indicators | Todd flagged broken/outdated URLs |

### Success Criteria (What "Accepted" Looks Like)

1. Todd can sort districts by score and immediately see meaningful differentiation
2. Jeff can upload a CSV of event attendees and get a ranked report in under 30 seconds
3. Known-interested districts (benchmark set) consistently score in Tier 1
4. Known-inactive districts consistently score in Tier 3
5. Navigation is self-explanatory — no training needed
6. Zero console errors on any page load
7. All scores reproducible and explainable (audit trail per district)

---

## Phase 1: Scoring Engine Rebuild

**Timeline:** Week 1-2
**Blocker Status:** This phase blocks Phases 2, 3, and 4. Nothing downstream works without meaningful scores.
**Owner:** Backend Engineer

### 1.1 Establish Benchmark Dataset

Before touching any code, define ground truth.

**Task:** Create a validated benchmark set of 50 districts with known buying signals.

| Tier | Count | Source | Example Districts |
|------|-------|--------|-------------------|
| Tier 1 (warm leads) | 15-20 | Todd + Jeff identify districts actively in conversation | Districts with active PoG/PtP work |
| Tier 2 (moderate signal) | 15-20 | Districts that attended events or downloaded resources | Summit attendees, webinar registrants |
| Tier 3 (de novo) | 15-20 | Districts with zero known engagement | Random large districts with no AASA contact |

**Acceptance Criteria:**
- [ ] Benchmark file exists at `scripts/benchmark-districts.json` with NCES IDs, names, expected tier, and rationale
- [ ] Todd and Jeff have reviewed and approved the list
- [ ] At least 5 districts per tier are from different states (geographic diversity)

**Testing Plan:**
- Manual review: Todd/Jeff confirm each district's expected tier from direct knowledge
- Cross-reference: Check that Tier 1 districts have documents in our corpus (if not, scoring can't work regardless)

### 1.2 Fix 9 Identified Scoring Bugs

Each bug fix is an independent, testable unit.

#### Bug 1: No Co-Mention Context for Generic Terms

**Problem:** "strategic plan" matches 90%+ of districts. A district mentioning "strategic plan" once in a facilities doc scores the same as one with a dedicated "Portrait of a Graduate Strategic Plan" page.

**Fix:** Implement co-mention filtering. Generic terms only score if they appear within N sentences of a qualifying co-mention term.

```
Generic terms requiring co-mention:
  "strategic plan" → must co-occur with "portrait", "graduate", "learner profile", "competency"
  "professional development" → must co-occur with "AI", "technology", "portrait", "future-ready"
  "community engagement" → must co-occur with "portrait", "graduate", "vision"
```

**Acceptance Criteria:**
- [ ] Generic terms without qualifying co-mentions score 0
- [ ] Generic terms WITH qualifying co-mentions score at full weight
- [ ] Co-mention window is configurable (default: same document section or within 500 characters)
- [ ] Unit test: "Facilities Strategic Plan 2024" scores 0 for readiness; "Portrait of a Graduate Strategic Plan" scores full weight

#### Bug 2: First-Match-Wins Dedup Uses Wrong Weights

**Problem:** When multiple keywords in the same category match the same document, only the first match's weight is kept. If a low-weight keyword matches first, the high-weight match is discarded.

**Fix:** Keep the highest-weight match per category per document, not the first match.

**Acceptance Criteria:**
- [ ] Per-document, per-category scoring keeps the max weight, not first weight
- [ ] Unit test: Document containing both "professional development" (weight 0.6) and "portrait of a graduate" (weight 1.0) scores 1.0 for that category, not 0.6

#### Bug 3: Recency Multiplier Uses Crawl Date, Not Publish Date

**Problem:** `recencyMultiplier` is computed from `crawled_at`, which is when our spider found the document, not when the district published it. A 2019 document crawled yesterday gets full recency boost.

**Fix:** Extract document dates from content/URLs where possible. Fall back to crawl date only when no publish date is extractable. Apply a steeper decay curve.

**Acceptance Criteria:**
- [ ] Documents with extractable dates (URL patterns like `/2024/`, page metadata) use those dates
- [ ] Recency decay: <6 months = 1.0x, 6-12 months = 0.8x, 1-2 years = 0.5x, 2-3 years = 0.3x, >3 years = 0.1x
- [ ] Documents with no extractable date use crawl date with a 0.7x penalty cap
- [ ] Unit test: Same keyword in a 2025 doc scores higher than in a 2021 doc

#### Bug 4: x2 Scaling + Cap at 10 Compresses Top Scores

**Problem:** `categoryScore = Math.min(10, sumOfAdjustedWeights * 2)`. The x2 multiplier means any district with adjusted weights summing to 5+ hits the cap. This compresses differentiation at the top.

**Fix:** Remove the x2 multiplier. Use a logarithmic or diminishing-returns curve that rewards breadth without hard-capping.

**Acceptance Criteria:**
- [ ] No hard cap — scores can theoretically reach 10 but require significant evidence
- [ ] Diminishing returns: first few matches contribute more than additional matches
- [ ] Score distribution across benchmark set shows clear separation between tiers
- [ ] Formula documented in code comments with rationale

#### Bug 5: Simple Average Penalizes Breadth

**Problem:** `totalScore = (readiness + alignment + activation + branding) / 4`. A district scoring 8 in readiness and 0 in branding gets a 2.0 total — same as a district scoring 2 across all four.

**Fix:** Use weighted average with configurable category weights. Readiness and Activation (the categories Todd cares about most) should carry more weight.

**Acceptance Criteria:**
- [ ] Category weights are configurable: `{ readiness: 0.35, alignment: 0.25, activation: 0.25, branding: 0.15 }`
- [ ] Weights stored in a config file, not hardcoded
- [ ] A district strong in readiness alone can still reach Tier 1
- [ ] Unit test: District with readiness=8, others=0 scores higher than district with all categories at 1.5

#### Bug 6: Branding Category Near-Zero for Everyone

**Problem:** Category D (Branding) keywords like "portrait of a graduate" and "learner profile" are too specific. Almost no district uses these exact terms on their public websites.

**Fix:** Expand branding keywords to include adjacent signals. Add partial-match scoring for close variants.

**Acceptance Criteria:**
- [ ] Branding category includes expanded keywords: "graduate profile", "learner-centered", "student-centered outcomes", "competency-based", "future-ready graduate"
- [ ] At least 20% of Tier 1 benchmark districts score >0 in branding
- [ ] Keywords reviewed and approved by Todd

#### Bug 7: Missing Keywords from Taxonomy PDF

**Problem:** The taxonomy spec document contains keywords not implemented in code: "AI readiness", "technology governance", "data privacy framework", several Category C and D terms.

**Fix:** Audit taxonomy PDF against code. Add all missing keywords with appropriate weights.

**Acceptance Criteria:**
- [ ] Every keyword in the taxonomy PDF exists in code
- [ ] Diff document produced showing what was added
- [ ] No keyword in code that isn't in the taxonomy PDF (or explicitly approved by Todd)

#### Bug 8: No Negative Dampeners

**Problem:** The taxonomy spec calls for dampeners (negative signals that reduce scores), but none are implemented. A district that only mentions AI in the context of "AI policy concerns" or "AI ban" scores the same as one with "AI implementation roadmap."

**Fix:** Implement dampener keywords that reduce category scores when detected.

**Acceptance Criteria:**
- [ ] Dampener keywords implemented: "ban", "prohibit", "policy concerns", "not ready", "delay", "postpone" in context of AI/technology
- [ ] Dampeners reduce the relevant category score by a configurable percentage (default: -50%)
- [ ] Dampeners require co-mention with the topic keyword (not standalone)
- [ ] Unit test: "AI implementation roadmap" scores positive; "AI ban policy" scores negative or zero

#### Bug 9: URL-Based Categorization Too Loose

**Problem:** URL path matching for document categorization is too broad. "plan" in a URL matches strategic plans, floor plans, meal plans, and evacuation plans equally.

**Fix:** Tighten URL pattern matching. Require more specific path segments.

**Acceptance Criteria:**
- [ ] URL categorization uses multi-segment patterns: `/strategic-plan`, `/portrait`, `/graduate-profile` instead of just `/plan`
- [ ] False positive rate on URL categorization drops below 10% (sample 100 categorized docs, manually verify)
- [ ] Unit test: `/facilities-floor-plan.pdf` does NOT match readiness category

### 1.3 Recompute All Scores

**Task:** After all bug fixes, rerun scoring across all 19,595 districts.

**Acceptance Criteria:**
- [ ] Score recomputation completes without errors
- [ ] New tier distribution shows meaningful separation (not 68% Tier 3)
- [ ] Benchmark districts land in their expected tiers (>80% accuracy)
- [ ] Score distribution histogram saved to `docs/score-distribution-post-fix.png`

**Testing Plan:**
- **Benchmark validation:** Run scoring on 50 benchmark districts. Calculate accuracy per tier.
- **Distribution analysis:** Generate histogram of total scores. Should show bimodal or spread distribution, NOT single peak at 0.3.
- **Regression check:** No district should score NaN, negative, or >10.
- **Outlier review:** Manually inspect top 10 and bottom 10 scoring districts. Do they make sense?

### 1.4 Score Audit Trail

**Task:** Make every score explainable. When viewing a district, users should be able to see WHY it scored what it did.

**Acceptance Criteria:**
- [ ] `district_keyword_scores` table stores per-document match details (which keywords matched, in which documents, with what weights)
- [ ] API endpoint returns score breakdown: `GET /api/districts/:id/score-breakdown`
- [ ] Response includes: per-category score, top contributing documents per category, matched keywords with weights, dampeners applied
- [ ] Frontend displays score breakdown on district detail view (expandable section)

**Testing Plan:**
- Pick 5 districts across tiers. Verify score breakdown sums to the displayed total.
- Verify each listed keyword actually appears in the linked document (spot check 3 documents per district).

---

## Phase 2: Frontend Fixes & Navigation

**Timeline:** Week 2-3 (overlaps with Phase 1 scoring recomputation)
**Dependencies:** Phase 1.2 (bug fixes) must be complete for score display to be meaningful
**Owner:** Frontend Engineer

### 2.1 Fix Score Bar Rendering

**Problem:** `KeywordScoreCard` divides by 100 or 400 when the actual max score is 10 per category. Bars render as tiny slivers.

**File:** `packages/web/src/components/KeywordScoreCard.tsx`

**Acceptance Criteria:**
- [ ] Category score bars use max of 10 (not 100/400)
- [ ] Total score bar uses max of 10 (not 400)
- [ ] Bars visually fill proportionally (score 5 = 50% filled, score 10 = 100% filled)
- [ ] Score number displayed next to each bar matches API value

**Testing Plan:**
- Load Command Center with a known Tier 1 district. Verify bars are visually proportional.
- Load a Tier 3 district. Verify bars are small but not invisible (unless score is truly 0).
- Screenshot comparison: before vs. after for 3 districts across tiers.

### 2.2 Fix Tier Legend and Badges

**Problem:** Tier legend text says ">250" when the actual threshold is `totalScore >= 5`. Tier badges don't appear on district cards in the grid view.

**Acceptance Criteria:**
- [ ] Tier legend matches actual thresholds: Tier 1 = "Score >= 5 or high readiness/activation", Tier 2 = "Score >= 2", Tier 3 = "Below 2"
- [ ] Tier badge (colored indicator with tier number) appears on every district card in Discovery grid
- [ ] Badge colors: Tier 1 = green, Tier 2 = amber, Tier 3 = gray

**Testing Plan:**
- Load Discovery page. Verify every visible card has a tier badge.
- Filter by each tier. Verify all displayed cards show the correct badge.
- Cross-reference 5 random districts: card badge matches detail view tier.

### 2.3 Fix Navigation Labels and Structure

**Problem:** Jeff was confused — "Home" goes to Command Center, "Pipeline" goes to Discovery, "Command Center" goes to Insights. Grants page isn't in the nav at all.

**Current Mapping (Broken):**
| Nav Label | Route | Actual Content |
|-----------|-------|----------------|
| Home | /command | AI-powered search hub |
| Pipeline | /discovery | Filterable district grid |
| Command Center | /insights | Analytics dashboard |
| _(missing)_ | /grants | Semantic grant search |

**Proposed Mapping (Fixed):**
| Nav Label | Route | Actual Content |
|-----------|-------|----------------|
| Search | /command | AI-powered search hub |
| Districts | /discovery | Filterable district grid |
| Insights | /insights | Analytics dashboard |
| Grants | /grants | Semantic grant search |

**Acceptance Criteria:**
- [ ] Nav labels match the proposed mapping (or Todd-approved alternative)
- [ ] All 4 sections visible in navigation
- [ ] Active nav item highlighted correctly on each page
- [ ] Default landing page is Search (/command) — confirmed with Todd
- [ ] No page is unreachable from the navigation

**Testing Plan:**
- Click each nav item. Verify correct page loads with correct highlight.
- Refresh on each page. Verify nav state persists.
- Navigate using browser back/forward. Verify nav stays in sync.
- Mobile viewport: verify nav is accessible (hamburger menu or similar).

### 2.4 Fix 404 Page

**Problem:** 404 page has no branding, unstyled "Go home" link.

**Acceptance Criteria:**
- [ ] 404 page uses the platform's design system (dark background, proper typography)
- [ ] Shows AASA branding/logo
- [ ] "Return to Search" button styled as primary CTA
- [ ] Page title updates to "Page Not Found — AASA District Intelligence"

**Testing Plan:**
- Navigate to `/nonexistent-page`. Verify styled 404 with branding.
- Verify "Return to Search" navigates to /command.

### 2.5 Fix Console Errors

**Problem:** Multiple GoTrueClient instances warning on every page load. Login buttons have `type="submit"` without a form. SVG icons missing `aria-hidden`.

**Acceptance Criteria:**
- [ ] Zero console warnings on any page load (fresh session)
- [ ] Supabase client instantiated once (singleton pattern)
- [ ] Login buttons use `type="button"` (they trigger OAuth, not form submission)
- [ ] All decorative SVGs have `aria-hidden="true"`

**Testing Plan:**
- Open each page with console open. Verify zero warnings/errors.
- Run Lighthouse accessibility audit on login page. Score >= 90.

### 2.6 Login Page Branding

**Problem:** Login page has no logo, no brand colors. H1 doesn't match page title.

**Acceptance Criteria:**
- [ ] AASA logo displayed on login page
- [ ] H1 and page title match: "AASA District Intelligence Platform"
- [ ] Meta description added
- [ ] Visual design consistent with the rest of the platform

**Testing Plan:**
- Visual inspection: login page looks professional and branded.
- Screen reader test: page title announced correctly, headings logical.

---

## Phase 3: Two-Sort Model & Event Upload

**Timeline:** Week 3-4
**Dependencies:** Phase 1 (scoring) must be complete. Phase 2 nav fixes should be done.
**Owner:** Full-Stack Engineer

### 3.1 Ascending/Descending Sort Views

**Context:** Todd's two-sort model. Same data, opposite sorts.

- **High score (descending)** = "Portrait-to-Practice Leads" — districts actively working on PoG/PtP
- **Low/zero score (ascending)** = "De Novo Prospects" — districts that haven't started, candidates for initial PoG engagement

**Acceptance Criteria:**
- [ ] Discovery page has a sort toggle: "Warm Leads" (descending) and "New Prospects" (ascending)
- [ ] Default sort is "Warm Leads" (descending by total score)
- [ ] "New Prospects" sort shows lowest-scoring districts first, excluding districts with zero documents (no data ≠ no activity)
- [ ] Sort persists across pagination
- [ ] Each sort view has a short explanation tooltip: "Districts actively discussing Portrait-to-Practice" / "Districts not yet talking about Portrait of a Graduate — outreach opportunities"
- [ ] State filter works in conjunction with sort (e.g., "New Prospects in California")

**Testing Plan:**
- Switch between sorts. Verify order reverses.
- Apply state filter + sort. Verify both constraints hold.
- Paginate through results. Verify sort order is consistent.
- Check that zero-document districts are excluded from "New Prospects" (they have no data, not low scores).

### 3.2 Event List Upload

**Context:** Jeff's most actionable use case. Upload a CSV of event registrants, get a ranked report.

**Workflow:**
1. Jeff uploads a CSV with at minimum a "District" column (and optionally State, Superintendent Name)
2. System fuzzy-matches district names to our database (using existing matching infrastructure)
3. System returns a ranked report: matched districts with scores, tiers, key signals
4. Jeff can filter/sort the results and export

**Acceptance Criteria:**
- [ ] New page accessible from nav: "Events" or "Lists" (confirm with Todd)
- [ ] CSV upload accepts files up to 5MB
- [ ] Accepts common CSV formats (comma-separated, with/without headers)
- [ ] Minimum required column: district name. Optional: state, superintendent name, email
- [ ] Column mapping UI if headers don't match expected names
- [ ] Fuzzy matching with confidence scores (using existing `district_matches` infrastructure)
- [ ] Match threshold: >= 85% confidence auto-matched, 70-84% flagged for review, <70% unmatched
- [ ] Results view shows: matched district, confidence score, tier, total score, top signals
- [ ] Sort results by: score (default), tier, confidence, alphabetical
- [ ] Export results as CSV
- [ ] Unmatched districts listed separately with suggested matches
- [ ] Processing time: < 30 seconds for 500-row CSV, < 2 minutes for 2,000-row CSV
- [ ] Upload history saved — Jeff can revisit previous uploads

**API Design:**
```
POST /api/events/upload        — Upload CSV, returns job ID
GET  /api/events/:jobId        — Get job status and results
GET  /api/events/:jobId/export — Download results as CSV
GET  /api/events                — List previous uploads
```

**Testing Plan:**
- Upload a 10-row CSV with known districts. Verify all 10 match correctly.
- Upload a CSV with misspellings ("Fontana Unifed" instead of "Fontana Unified"). Verify fuzzy match catches it.
- Upload a CSV with districts not in database. Verify they appear as unmatched.
- Upload a 1,000-row CSV. Verify processing completes under 2 minutes.
- Upload a malformed CSV (wrong encoding, no headers). Verify graceful error message.
- Upload a file that's not a CSV. Verify rejection with helpful message.
- Export results. Verify CSV is well-formed and matches UI data.
- Revisit a previous upload. Verify data persists.

### 3.3 State-Level Views

**Context:** Jeff works state by state. "Surface top 10-20 per state for cold outreach."

**Acceptance Criteria:**
- [ ] State filter on Discovery page (already exists, verify it works with new scoring)
- [ ] State summary view: top 10 by score, bottom 10 by score, total districts, average score
- [ ] Quick toggle between states without losing sort preference

**Testing Plan:**
- Select California. Verify top 10 districts make sense (large, active districts at top).
- Select a small state (Wyoming). Verify results are present and meaningful.
- Switch states rapidly. Verify no stale data displayed.

---

## Phase 4: Data Quality & Polish

**Timeline:** Week 4-5
**Dependencies:** Phases 1-3 substantially complete
**Owner:** Backend Engineer + Frontend Engineer

### 4.1 Source Freshness Indicators

**Context:** Todd flagged that source URLs may be broken or outdated.

**Acceptance Criteria:**
- [ ] Each source link on district detail shows when it was last crawled
- [ ] Links crawled > 6 months ago show amber "may be outdated" indicator
- [ ] Links crawled > 12 months ago show red "likely outdated" indicator
- [ ] Broken links (HTTP 404/500 on last crawl) show "broken link" indicator
- [ ] Users can report broken links (single click, logged for batch recrawl)

**Testing Plan:**
- View a district with old documents. Verify staleness indicators appear.
- Click a source link. Verify it opens the correct URL.
- Click "report broken" on a link. Verify it's logged in the database.

### 4.2 Compute Quality Tiers

**Problem:** Quality tier system (A-E) is documented but never computed against live data.

**Acceptance Criteria:**
- [ ] Quality tiers computed for all districts based on: document count, document freshness, embedding coverage, superintendent match confidence
- [ ] Tiers visible in admin/internal view (not necessarily user-facing)
- [ ] Districts with quality tier D/E flagged for recrawl priority

**Testing Plan:**
- Run quality tier computation. Verify distribution is reasonable.
- Spot-check 10 districts: does their quality tier match intuition?
- Verify no districts with 50+ fresh documents get tier D/E.

### 4.3 Fill Data Gaps

**Problem:** 285 large districts (>1K enrollment) still missing documents. 3,296 districts have zero keyword intelligence.

**Acceptance Criteria:**
- [ ] Crawl pipeline re-run targeting the 285 missing large districts
- [ ] Post-crawl: >=95% of districts with >1K enrollment have at least 1 document
- [ ] Districts with zero documents are clearly marked in the UI (not scored as "low signal")

**Testing Plan:**
- After recrawl: query districts with >1K enrollment and zero documents. Count should be < 50.
- Verify UI clearly distinguishes "low score with data" from "no data available."

### 4.4 Trending Keywords Fix

**Problem:** Period selector on Insights page is cosmetic — always returns the same data regardless of time range.

**Acceptance Criteria:**
- [ ] Period selector (7d, 30d, 90d, 1y) filters keyword data by document date
- [ ] Selecting "7 days" shows only keywords from documents crawled/published in last 7 days
- [ ] Default period is 30 days

**Testing Plan:**
- Select each time period. Verify keyword counts change.
- Select "7 days." Verify results are a subset of "30 days."
- Verify no future-dated results appear.

### 4.5 Drizzle Schema Consistency

**Problem:** `national_registry` table referenced in 8+ raw SQL queries but not in Drizzle schema. This is a ticking time bomb.

**Acceptance Criteria:**
- [ ] All tables used in the codebase exist in the Drizzle schema
- [ ] No raw SQL queries that bypass Drizzle (or explicitly documented exceptions)
- [ ] `npm run typecheck` passes with zero errors

**Testing Plan:**
- Run `grep -r "national_registry"` across codebase. Every reference should be a Drizzle query or have a documented exception.
- Run typecheck. Zero errors.

---

## Phase 5: User Acceptance Testing

**Timeline:** Week 5-6
**Dependencies:** All development phases complete
**Owner:** Christian (coordination), Todd + Jeff (testing)

### 5.1 Automated Dogfood Run

**Task:** Run the dogfood skill (agent-browser) against the platform with authenticated session. Target: 0 critical, 0 high, <= 2 medium issues.

**Pre-conditions:**
- Auth state restored from `dogfood-output/auth-state.json` (or re-authenticated)
- All Phase 1-4 changes deployed to `aasa.edapt.one`

**Acceptance Criteria:**
- [ ] Dogfood run 2 completes with 0 critical and 0 high issues
- [ ] All Phase 1 dogfood issues (7 issues) are resolved
- [ ] New issues (if any) are medium or low severity
- [ ] Report saved to `dogfood-output/report-run2.md`

### 5.2 Todd UAT: Scoring Validation

**Scenario:** Todd reviews scoring for districts he knows well.

**Script:**
1. Search for 10 districts Todd has direct knowledge of
2. For each: review total score, category breakdown, tier assignment
3. Todd rates each as "correct", "close", or "wrong"
4. Target: >= 8/10 rated "correct" or "close"

**Acceptance Criteria:**
- [ ] Todd confirms >= 80% scoring accuracy on his known districts
- [ ] Todd confirms two-sort views surface the right districts at the top of each sort
- [ ] Todd approves the category weights and keyword taxonomy

### 5.3 Jeff UAT: Workflow Validation

**Scenario:** Jeff runs his real-world workflow.

**Script:**
1. Jeff uploads a real event registrant CSV (e.g., from a recent summit)
2. Reviews matched districts, scores, and tiers
3. Identifies his top 10 outreach targets from the results
4. Navigates to each district's detail page for pre-call prep
5. Uses the two-sort model to find de novo prospects in a target state

**Acceptance Criteria:**
- [ ] Jeff can complete the full workflow without asking for help
- [ ] CSV upload processes correctly with >= 90% match rate on real data
- [ ] Jeff identifies the workflow as "useful for daily work" (not just "interesting demo")
- [ ] Navigation is intuitive — Jeff doesn't get lost

### 5.4 Performance Benchmarks

**Acceptance Criteria:**
- [ ] Page load time (any page): < 2 seconds on broadband
- [ ] District search (Command Center): < 3 seconds for results
- [ ] Discovery page with filters: < 2 seconds to render
- [ ] CSV upload (500 rows): < 30 seconds end-to-end
- [ ] Score recomputation (full 19,595 districts): < 10 minutes
- [ ] No memory leaks over 30 minutes of active use

**Testing Plan:**
- Lighthouse performance audit on each page. Score >= 80.
- Time each operation with stopwatch during UAT.
- Monitor browser memory during 30-minute session.

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Scoring rework takes longer than 2 weeks | Medium | High — blocks everything | Timebox each bug fix to 1 day. Ship incremental improvements, don't wait for perfect. |
| Todd's benchmark districts don't have documents in our corpus | Medium | High — can't validate scoring | Check document coverage for benchmark set before starting scoring work. Fill gaps with targeted crawl. |
| Fuzzy matching on event CSVs has low accuracy | Low | Medium — Jeff's top feature underdelivers | Use existing matching infrastructure (already 98.4% coverage). Add manual review flow for low-confidence matches. |
| Auth state expires before dogfood run 2 | Low | Low — just re-authenticate | Auth state saved. If expired, re-auth with hello@edapt.com (Google OAuth, 2FA via Gmail app on iPhone). |
| Recrawl for missing districts takes too long | Medium | Low — data quality improvement is Phase 4 | Run recrawl in background. Platform works without it, just with gaps. |

---

## Rollback Procedures

### Scoring Engine Rollback
- Current keyword scores preserved in `district_keyword_scores` table with timestamp
- Rollback: restore previous scores from backup, revert `compute-keyword-scores.js` to previous commit
- **Before** running new scoring: `pg_dump` the `district_keyword_scores` table

### Frontend Rollback
- All changes are in `packages/web/` — standard git revert
- No database migrations in Phase 2

### Event Upload Rollback
- New feature, not modifying existing functionality
- Rollback = hide the nav link, feature is inert
- Database tables for upload history can remain (no data loss)

---

## Definition of Done

A phase is "done" when:

1. All acceptance criteria for every task in the phase are met (checked off)
2. Relevant tests pass (unit tests, integration tests, manual test scripts)
3. No regressions: all previously-passing tests still pass
4. `npm run typecheck` passes with zero errors
5. No console errors on any page (verified by dogfood or manual check)
6. Changes deployed to `aasa.edapt.one` and verified in production
7. Stakeholder sign-off obtained (Todd for scoring, Jeff for workflow, Christian for overall)

The platform is "accepted" when:

1. All 5 phases are done
2. Todd's scoring validation passes (>= 80% accuracy)
3. Jeff's workflow validation passes (end-to-end without help)
4. Dogfood run 2 produces 0 critical/high issues
5. Performance benchmarks met
6. Todd confirms: "The sorting works. I can see differentiation."
7. Jeff confirms: "I would use this every day."

---

## Appendix A: Score Distribution Targets

### Current Distribution (Broken)
```
Score 0.0-0.5:  ████████████████████████████████  ~85%
Score 0.5-1.0:  █████                             ~10%
Score 1.0-2.0:  ██                                ~4%
Score 2.0-5.0:  ▏                                 ~1%
Score 5.0-10:   ▏                                 <0.1%
```

### Target Distribution (After Fix)
```
Score 0.0-1.0:  ████████████                      ~30% (no data or truly inactive)
Score 1.0-3.0:  ██████████████                    ~35% (minimal signals)
Score 3.0-5.0:  ████████                          ~20% (moderate signals)
Score 5.0-7.0:  ████                              ~10% (strong signals)
Score 7.0-10:   ██                                ~5%  (very active — PoG/PtP leaders)
```

## Appendix B: Benchmark Validation Template

For each benchmark district, record:

| Field | Value |
|-------|-------|
| NCES ID | |
| District Name | |
| State | |
| Expected Tier | 1 / 2 / 3 |
| Rationale | Why Todd/Jeff expect this tier |
| Actual Score (pre-fix) | |
| Actual Tier (pre-fix) | |
| Actual Score (post-fix) | |
| Actual Tier (post-fix) | |
| Verdict | Correct / Close / Wrong |
| Notes | |

## Appendix C: Keyword Taxonomy Audit Checklist

| Keyword | Category | Weight | In Code? | In Spec? | Co-mention Required? | Notes |
|---------|----------|--------|----------|----------|---------------------|-------|
| _To be filled during Phase 1.2 Bug 7_ | | | | | | |

---

*This plan will be updated as phases complete and stakeholder feedback is incorporated.*
