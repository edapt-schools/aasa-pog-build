# CLAUDE.md

This file is read by Claude Code at session start. It contains project rules, context, and learned patterns.

## Project Overview

Building a database of all ~19,500 US public school districts with superintendent contact information for AASA (The School Superintendents Association).

**Current state**: 61.4% superintendent coverage (12,026 / 19,595 districts)
**Goal**: 90%+ coverage

**Key Reference Docs:**
- `docs/STATE_SOURCES_GUIDE.md` - Where to find data for each state
- `docs/CRAWL_WORKFLOW.md` - Document crawling pipeline (Phase 2)
- `logs/SESSION_LOG_2026-02-01.md` - Current session status and handoff notes

## Database Connection

```
postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres
```

## Critical Rules

### NEVER Do These Things

1. **NEVER modify source tables directly**
   - `districts` → READ ONLY
   - `ccd_staff_data` → READ ONLY
   - `state_registry_districts` → APPEND ONLY (insert, never update/delete)

2. **NEVER merge data between tables without explicit approval**
   - All joins happen through `district_matches` table
   - All output comes from `national_registry` VIEW

3. **NEVER use exact string matching for district names**
   - Names vary: "Los Angeles Unified School District" vs "Los Angeles USD" vs "LAUSD"
   - Always use normalized matching with fuzzy fallback

4. **NEVER skip the audit trail**
   - Every import MUST create a `data_imports` record first
   - Include: source_url, source_file, record_count, imported_by

5. **NEVER build complex scrapers before trying simple approaches**
   - Priority: CSV/Excel download → simple fetch → PDF parse → browser automation
   - Google search finds official directories in 20 seconds

### ALWAYS Do These Things

1. **ALWAYS create data_imports record before inserting data**
2. **ALWAYS use fuzzy matching (Jaro-Winkler) for district name matching**
3. **ALWAYS flag uncertain matches (confidence < 0.85) for review**
4. **ALWAYS check `docs/SOURCES.md` before scraping a state**
5. **ALWAYS update `docs/SOURCES.md` after successfully scraping a state**

## Architecture (Three Layers)

```
SOURCE LAYER (immutable)
├── districts (NCES baseline - 19,640 records)
├── ccd_staff_data (CCD enrichment)
└── state_registry_districts (state DoE data)
           │
           ▼
MATCHING LAYER
└── district_matches (links state records to NCES)
           │
           ▼
VIEW LAYER
└── national_registry (unified output)
```

## Matching Algorithm

Try in order:
1. **Exact NCES ID** (confidence 1.00) - if state provides it
2. **Exact name + state** (confidence 0.95)
3. **Normalized name** (confidence 0.90) - lowercase, remove "School District", etc.
4. **Fuzzy match** (confidence 0.70-0.89) - Jaro-Winkler >= 0.80

## Name Normalization Rules

```javascript
name.toLowerCase()
  .trim()
  .replace(/school district/gi, 'sd')
  .replace(/unified school district/gi, 'usd')
  .replace(/independent school district/gi, 'isd')
  .replace(/public schools/gi, 'ps')
  .replace(/saint/gi, 'st')
  .replace(/mount/gi, 'mt')
  .replace(/[#.,]/g, '')
  .replace(/\s+/g, ' ')
```

## Current Database State (Updated Feb 5, 2026)

**Overall: 61.4% coverage (12,026 / 19,595 districts)**

| Table | Records |
|-------|---------|
| districts | 19,595 |
| superintendent_directory | 12,026 |
| district_matches | 11,653 |

### States by Coverage (45 states with data)

| State | Coverage | Loaded/Expected | Notes |
|-------|----------|-----------------|-------|
| AK | 100% | 53/53 | Complete |
| HI | 100% | 1/1 | Single statewide district |
| KY | 98.9% | 175/177 | Excellent |
| TX | 96.4% | 1185/1229 | Excellent |
| MO | 95.8% | 541/565 | Excellent |
| IA | 95.0% | 325/342 | Excellent |
| MN | 92.9% | 525/565 | Excellent |
| OK | 92.0% | 532/578 | Excellent |
| MD | 92.0% | 23/25 | Excellent |
| TN | 91.9% | 136/148 | Excellent |
| WI | 90.3% | 420/465 | Excellent |
| SD | 89.1% | 147/165 | Gap = cooperatives |
| WA | 88.6% | 302/341 | Good |
| WV | 87.7% | 57/65 | County school districts |
| NE | 86.3% | 240/278 | Good |
| OR | 86.5% | 192/222 | Good |
| PA | 85.3% | 669/784 | Good |
| NV | 85.0% | 17/20 | Gap = charters |
| MS | 84.9% | 129/152 | Good |
| KS | 83.1% | 280/337 | Good |
| AR | 82.8% | 251/303 | Good |
| IL | 82.7% | 850/1028 | Good |
| SC | 80.6% | 75/93 | Good |
| FL | 78.6% | 66/84 | Acceptable |
| ND | 74.9% | 164/219 | Acceptable |
| NJ | 70.5% | 490/695 | Acceptable |
| IN | 65.6% | 290/442 | Needs improvement |
| MA | 63.2% | 266/421 | Needs improvement |
| NY | 61.2% | 667/1090 | Needs improvement |
| GA | 58.0% | 145/250 | Needs improvement |
| VA | 58.7% | 122/208 | Needs improvement |
| MT | 57.6% | 273/474 | Gap = small rurals |
| NM | 56.2% | 86/153 | Needs improvement |
| CA | 55.8% | 1322/2368 | Large gap |
| OH | 55.4% | 579/1045 | Needs improvement |
| RI | 53.7% | 36/67 | Charter data fragmented |
| DE | 42.2% | 19/45 | Charter leader data issue |
| WY | 37.7% | 23/61 | Gap = BOCES |
| LA | 37.3% | 69/185 | Needs re-collection |
| VT | 29.3% | 55/188 | SUs oversee member districts |
| NC | 27.8% | 98/352 | PRIORITY RE-COLLECTION |
| UT | 26.8% | 41/153 | Needs re-collection |
| NH | 16.7% | 35/210 | Needs re-collection |
| AL | 12.8% | 20/156 | Needs re-collection |
| DC | 1.4% | 1/71 | Charter LEA leaders only in PDF |

### States at 0% (7 states + 5 territories)
MI, ID, ME, CO, AZ, CT + territories (GU, PR, AS, VI, MP)

## Workflow Guidance

### Use Plan Mode For
- Multi-state collection campaigns
- Schema changes
- Any task touching > 1000 records
- When something goes sideways, stop and re-plan

### Use Subagents For
- Parallel state collection (up to 5 states at once)
- Keeping main context clean during large operations
- Append "use subagents" to prompts for compute-heavy tasks

### Check Database Status
```bash
node scripts/db-status.js
```

## Phase 2: Document Crawling & Semantic Search

**Status:** 275 districts crawled, 3,597 documents, 62MB text extracted

### ⚡ RECOMMENDED: Automated Pipeline (Hands-Free)

**Use this for large batches (200+ districts):**
```bash
node scripts/automated-crawl-pipeline.js --limit 500 --concurrency 10 --skip-existing
```

**What it does:**
1. Crawls districts with parallel execution
2. Fixes obvious URL issues (redirects)
3. Skips aggressive retry (too slow - flags failures for manual research)
4. Computes keyword scores
5. Generates embeddings (optional with --no-embeddings)
6. Analyzes results

**This is the workflow that should run continuously for the remaining 17,000 districts.**

---

### Manual Document Crawling Pipeline (Advanced)

Run in this order (with parallel crawling):
```bash
# 1. Initial crawl (PARALLEL - 5 districts at a time)
node scripts/pilot-document-crawler.js --limit 200 --concurrency 5

# 2. Retry transient failures
node scripts/retry-failed-crawls.js --ssl-bypass

# 3. Fix bad URLs in database
node scripts/verify-urls.js --failed-only --fix

# 4. Reprocess PDFs if needed
node scripts/reprocess-pdfs.js

# 5. Compute keyword scores
node scripts/compute-keyword-scores.js

# 6. Generate embeddings (BATCH - 100 chunks per API call)
node scripts/generate-embeddings.js --batch-size 100

# 7. Analyze results
node scripts/analyze-crawl-results.js

# To continue where you left off:
node scripts/pilot-document-crawler.js --limit 500 --concurrency 10 --skip-existing
```

### Semantic Search
```bash
node scripts/search-documents.js "portrait of a graduate" --limit 20
node scripts/search-documents.js "strategic plan" --state CA --verbose
```

### Phase 2 Database Tables
| Table | Purpose |
|-------|---------|
| `district_documents` | Extracted document content |
| `document_crawl_log` | Every crawl attempt |
| `district_keyword_scores` | Taxonomy scores and tiers |
| `document_embeddings` | Vector embeddings (pgvector) |

See `docs/CRAWL_WORKFLOW.md` for full documentation.

## Learned Patterns (Update This Section)

### What Works
- Google "[State] superintendent directory" finds official sources fast
- State DoE data downloads are usually Excel/CSV
- State superintendent associations often at [state]ssa.org
- NCES as base is authoritative for district existence
- **Crawling:** ~90% homepage success rate on first run
- **Parallel crawling:** `--concurrency 10` optimal for M2 Pro+ machines (200 districts in ~10 min)
- **Batch embeddings:** `--batch-size 100` sends 100 chunks per API call (100x faster)
- **PDF extraction:** Use pdf-parse v1.1.1 (not v2.x - different API)
- **Alternative URLs:** verify-urls.js finds redirects and www/non-www variants
- **Automated pipeline:** Use `automated-crawl-pipeline.js` for hands-free operation

### What Doesn't Work
- Exact string matching for district names (fails silently)
- Complex browser automation before trying simple fetch
- Spawning expensive agents for simple scraping tasks
- Modifying source tables to "fix" data
- **Crawling:** Running crawler + embeddings in parallel (connection exhaustion) - **WILL CRASH**
- **Crawling:** pdf-parse v2.x has incompatible API (silent extraction failures)
- **Crawling:** Aggressive retry script (3 retries × 3 URL variants = 2-3 min per district)
- **Crawling:** Retrying obviously wrong URLs (e.g., hse.k12.in.us when real URL is hseschools.org)

### Mistakes to Avoid
- Don't re-fetch NCES data - it's already loaded
- Don't merge tables without checking district_matches
- Don't assume state district names match NCES exactly
- Don't skip the data_imports audit record
- Don't assume CSVs are complete - always compare against NCES district count
- Don't forget charter school LEAs - they're in NCES but often missing from state directories
- **Crawling:** Don't skip SSL bypass for sites with invalid certs (use `--ssl-bypass`)
- **Crawling:** Don't assume superintendent_directory URLs are correct (many are outdated)
- **CRITICAL:** Don't report a crawl as "complete" until retry/recovery scripts have run
- **CRITICAL:** Never run aggressive retry (>1 retry per variant) - wastes hours on dead URLs
- **CRITICAL:** If retry recovery rate < 20% after 10 districts, abort and flag for manual research

### Session Continuity
- If session crashes, check `logs/SESSION_LOG_*.md` for status
- Previous agent crashed on Kentucky (fetch-ky.js) - test carefully
- Many fetch scripts exist in `/scripts/fetch-*.js` - some untested
- **Phase 2 status:** Check `district_documents` count and `document_crawl_log` for progress

---

*Last updated: February 5, 2026*
*Update this file after every correction or learned pattern*
