# CLAUDE.md

This file is read by Claude Code at session start. It contains project rules, context, and learned patterns.

## Project Overview

Building a database of all ~19,500 US public school districts with superintendent contact information for AASA (The School Superintendents Association).

**Current state**: 98.4% superintendent coverage (19,281 / 19,595 districts) -- GOAL MET
**Phase 2 state**: 88.5% document coverage (17,342 / 19,595 districts), 175,138 documents

**Key Reference Docs:**
- `docs/STATE_SOURCES_GUIDE.md` - Where to find data for each state
- `docs/CRAWL_WORKFLOW.md` - Document crawling pipeline (Phase 2)
- `docs/CRAWL_RECOVERY_GUIDE.md` - **NEW: Failed district recovery procedures**
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
├── districts (NCES baseline - 19,595 records)
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

## Current Database State (Updated Feb 9, 2026)

**Superintendent coverage: 98.4% (19,281 / 19,595 districts) -- GOAL EXCEEDED**

| Table | Records |
|-------|---------|
| districts | 19,595 |
| superintendent_directory | 19,281 |
| district_matches | 11,653 |
| district_documents | 175,138 |
| url_corrections | 387 (validated) |

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

---

## Phase 2: Document Crawling & Semantic Search

### Current Status (Updated Feb 9, 2026)

| Metric | Value |
|--------|-------|
| Districts with documents | **17,342** (88.5% of all districts) |
| Districts attempted | 19,280 |
| Districts not yet crawled | 0 (all attempted) |
| Total documents | 175,138 |
| Keyword scores computed | ✅ Complete (17,342 districts) |
| Embeddings generated | ✅ **Complete** (83,194 embeddings, 38,239 unique docs) |
| Embedding model | `text-embedding-3-small` (1536 dims) |
| Embedding cost | $1.40 total |
| URL corrections discovered | 387 (validated, in golden table) |

### Recovery Pipeline Results (Feb 9, 2026)

Ran 6-strategy waterfall recovery on all failed/missing districts:

| Mode | Succeeded | Failed | Rate | New Docs |
|------|-----------|--------|------|----------|
| failed-retry | 563 | 619 | 47.6% | 5,395 |
| discover-urls | 442 | 1,287 | 25.6% | 3,899 |
| empty-text | 246 | 24 | 91.1% | 1,239 |
| **TOTAL** | **1,251** | **1,930** | — | **10,533** |

Recovery strategies that worked:
- `cross_reference`: 319 districts (finding working URLs from other source tables)
- `pattern_match`: 531 districts (generating k12.state.us, schools.org, etc.)
- `email_domain`: 101 districts (extracting website from superintendent email)
- `web_search`: 8 districts (DuckDuckGo -- underperformed, see notes)
- `url_fix`: 4 districts (fixing typos in URLs)

### Remaining 1,906 Failed Districts

| Category | Count | Notes |
|----------|-------|-------|
| All 6 strategies failed | 1,530 | 1,281 had no URL data at all |
| 404 Not Found | 180 | URL exists but wrong path |
| 403 Forbidden | 80 | Blocking crawlers (incl. Baltimore County, Atlanta) |
| Timeout | 20 | May need headless browser |
| SSL/Other | 96 | Mixed issues |

Key observations:
- **32 NYC Geographic Districts** (admin subdivisions, all share schools.nyc.gov)
- **43 BIE schools** (Bureau of Indian Education, federal, many have no websites)
- **478 likely charter LEAs** (many lack independent websites)
- **285 districts >1,000 enrollment** still missing (these definitely have websites)
- **DuckDuckGo search was essentially broken** (4 results out of thousands of attempts)

### Outreach Tier Distribution (from keyword scores)

| Tier | Districts | Description |
|------|-----------|-------------|
| Tier 1 | 1,036 (6.4%) | Strong buying signals |
| Tier 2 | 4,081 (25.0%) | Moderate signals |
| Tier 3 | 11,182 (68.6%) | Limited signals |

---

### ⚡ RECOMMENDED: Recovery Pipeline (6-Strategy Waterfall)

**Use `district-recovery.js` for recovery -- it supersedes all older scripts:**
```bash
# Run all modes (failed-retry + discover-urls + empty-text)
node scripts/district-recovery.js --mode all --concurrency 15

# Just retry failed districts
node scripts/district-recovery.js --mode failed-retry --limit 100

# Just discover URLs for districts with none
node scripts/district-recovery.js --mode discover-urls --limit 500

# Disable DuckDuckGo search (faster, but misses some)
node scripts/district-recovery.js --mode all --no-search

# Dry run (show counts only)
node scripts/district-recovery.js --mode all --dry-run
```

**6 strategies tried per district (in order):**
1. Fix obvious URL errors (typos, missing TLDs, mail. prefixes)
2. Cross-reference all URL sources with www/http variants
3. Email domain extraction from superintendent/admin email
4. Pattern-based URL generation + DNS check
5. DuckDuckGo web search (rate-limited)
6. Error-specific retry (45s timeout, HTTP fallback, browser headers)

**After recovery, recompute keyword scores:**
```bash
node scripts/compute-keyword-scores.js
```

### Embedding Generation Pipeline
```bash
# Generate embeddings for all documents (resumes from where it left off)
node --max-old-space-size=4096 scripts/generate-embeddings-fast.js

# Process specific category first
node --max-old-space-size=4096 scripts/generate-embeddings-fast.js --category strategic_plan

# Dry run (count chunks, no API calls)
node scripts/generate-embeddings-fast.js --dry-run --limit 100
```

**Key details:**
- Model: `text-embedding-3-small` (1536 dims, $0.02/1M tokens)
- Chunks: 6000 chars max, 800 char overlap, paragraph-aware recursive splitting
- Metadata prepended: "District: {name} | State: {ST} | Type: {category}"
- Deduplication by content_hash (saves ~91% of "other" category)
- Concurrent API calls: 3 parallel
- Batch size: 150 chunks per API call (300K token limit)
- Uses `LEFT JOIN ... WHERE e.id IS NULL` to skip already-embedded docs

### Legacy Pipeline (for reference)
```bash
node scripts/pilot-document-crawler.js --limit 500 --concurrency 10 --skip-existing
node scripts/analyze-failures.js
node scripts/compute-keyword-scores.js
```

### Semantic Search
```bash
node scripts/search-documents.js "portrait of a graduate" --limit 20
node scripts/search-documents.js "strategic plan" --state CA --verbose
```

### Phase 2 Database Tables
| Table | Purpose | Records |
|-------|---------|---------|
| `district_documents` | Extracted document content | 175,589 |
| `document_crawl_log` | Every crawl attempt | — |
| `district_keyword_scores` | Taxonomy scores and tiers | 17,342 |
| `document_embeddings` | Vector embeddings (text-embedding-3-small, 1536d) | 83,194 |
| `url_corrections` | Discovered/fixed URLs | 387 |

See `docs/CRAWL_WORKFLOW.md` for full documentation.

---

## Learned Patterns (Update This Section)

### What Works
- Google "[State] superintendent directory" finds official sources fast
- State DoE data downloads are usually Excel/CSV
- State superintendent associations often at [state]ssa.org
- NCES as base is authoritative for district existence
- **Recovery:** 6-strategy waterfall in `district-recovery.js` -- 47.6% recovery on previously-failed districts (up from 20% with simple retry)
- **Recovery:** Cross-referencing URL sources is the #1 strategy (319 districts recovered)
- **Recovery:** Pattern-based URL generation (k12.state.us, schools.org, etc.) is #2 (531 districts)
- **Recovery:** Email domain extraction catches districts where email != website domain (101 districts)
- **Recovery:** `url_corrections` table + modified `national_registry` view ensures corrections flow to golden table
- **Parallel crawling:** `--concurrency 15` optimal for M2 Pro+ machines
- **PDF extraction:** Use pdf-parse v1.1.1 (not v2.x - different API). Suppress warnings with console.warn override.
- **Embeddings:** `text-embedding-3-small` outperforms ada-002 at 5x lower cost ($0.02/1M vs $0.10/1M tokens)
- **Embeddings:** Metadata prepending (district + state + category) dramatically improves retrieval for location-specific queries
- **Embeddings:** Recursive paragraph-aware chunking (6000 chars, 800 overlap) produces better chunks than naive sentence splitting
- **Embeddings:** Content-hash deduplication saves 91% of "other" docs (most are boilerplate/template content)
- **Embeddings:** OpenAI 300K tokens/request limit means batch size must be ~150 chunks (not 2000) with 6000-char chunks
- **Embeddings:** Full 83K embeddings generated in ~80 minutes total for $1.40 (not the feared 12 hours)
- **Embeddings:** IVFFlat index creation needs `SET maintenance_work_mem = '256MB'` for 83K+ vectors

### What Doesn't Work
- Exact string matching for district names (fails silently)
- Complex browser automation before trying simple fetch
- Spawning expensive agents for simple scraping tasks
- Modifying source tables to "fix" data
- **Crawling:** Running crawler + embeddings in parallel (connection exhaustion) - **WILL CRASH**
- **Crawling:** pdf-parse v2.x has incompatible API (silent extraction failures)
- **Embeddings:** OFFSET/LIMIT pagination with `LEFT JOIN ... WHERE e.id IS NULL` -- result set shrinks as you embed, causing OFFSET to skip rows. Use OFFSET 0 + NOT IN exclusion instead.
- **Embeddings:** ada-002 -- deprecated, inferior, 5x more expensive than text-embedding-3-small
- **Embeddings:** 2000-chunk batch size with 6000-char chunks -- exceeds OpenAI's 300K tokens/request limit
- **Crawling:** Simple retry (toggle www/http) -- only 20% recovery, need full 6-strategy waterfall
- **Crawling:** DuckDuckGo HTML scraping -- gets rate-limited/blocked quickly (only 4 results out of thousands)
- **Crawling:** verify-urls.js on DNS failures - recovery rate <5%
- **Recovery:** ~80% of remaining 1,906 failures are "all 6 strategies failed" -- need proper search API (SerpAPI/Google) or headless browser

### URL Patterns Found During Manual Research
Many districts have URLs that don't match expected patterns:
- `craigschools.org` → actual: `ccsd.k12.ak.us`
- `kakaeschools.com` → actual: `kakeschools.com` (typo)
- `pelicanschools.org` → actual: `pelicanschool.org` (singular)
- `colbert.k12.al.us` → actual: `colbertk12.org`
- `crenshawcounty.schoolinsites.com` → actual: `crenshaw-schools.org`
- `hps.k12.ar.us` → actual: `harrisongoblins.org`
- `cps.k12.ar.us` → actual: `cabotschools.org`
- `conwayschools.info` → actual: `conwayschools.org`
- `gobsd1.org` → actual: `batesvilleschools.com`

### Mistakes to Avoid
- Don't re-fetch NCES data - it's already loaded
- Don't merge tables without checking district_matches
- Don't assume state district names match NCES exactly
- Don't skip the data_imports audit record
- Don't assume CSVs are complete - always compare against NCES district count
- Don't forget charter school LEAs - they're in NCES but often missing from state directories
- **Crawling:** Don't skip SSL bypass for sites with invalid certs
- **Crawling:** Don't assume superintendent_directory URLs are correct (many are outdated)
- **Crawling:** Don't use DuckDuckGo HTML scraping for batch URL discovery -- gets blocked fast
- **CRITICAL:** Always use `district-recovery.js` for recovery, not the old retry scripts
- **CRITICAL:** 314 districts in `districts` table have NULL `nces_id` -- always filter with `d.nces_id IS NOT NULL`
- **CRITICAL:** Run `compute-keyword-scores.js` AFTER any recovery crawl to update tiers

### Session Continuity
- If session crashes, check `logs/SESSION_LOG_*.md` for status
- Many fetch scripts exist in `/scripts/fetch-*.js` - some untested
- **Phase 2 status:** Run `node scripts/district-recovery.js --mode all --dry-run` to check recoverable counts
- **Quick DB check:** `node scripts/db-status.js` or run the SQL queries in this file

---

## AASA Platform Deployment (Railway)

The AASA Platform is deployed on Railway with two services:

### Services
| Service | URL | Purpose |
|---------|-----|---------|
| aasa-api | https://aasa-api-production.up.railway.app | Backend API |
| web | https://web-production-75c17.up.railway.app | Frontend (React) |

### Authentication
- Uses **Bearer token auth** (Supabase JWT) - more reliable than cookies
- Frontend sends `Authorization: Bearer <token>` header with each request
- API validates tokens via `getSupabase().auth.getUser(token)`
- Cookie sessions are kept as fallback but modern browsers block cross-origin cookies

### Key Environment Variables (API)
```
RAILWAY_DOCKERFILE_PATH=aasa-platform/Dockerfile.api
DATABASE_URL=<supabase postgres url>
SUPABASE_URL=<supabase project url>
SUPABASE_ANON_KEY=<supabase anon key>
SUPABASE_SERVICE_ROLE_KEY=<supabase service role key>
APP_URL=https://web-production-75c17.up.railway.app
SESSION_SECRET=<random string>
NODE_ENV=production
```

### Deployment Issues & Fixes
- **Stale git context:** Railway caches aggressively. Delete and recreate service if cache clear doesn't work.
- **Auth loops:** Caused by third-party cookie blocking. Fixed with Bearer token auth.
- **Dockerfile issues:** Shared package exports TypeScript source, not dist. See `Dockerfile.api` line 35.

---

*Last updated: February 10, 2026*
*Update this file after every correction or learned pattern*
