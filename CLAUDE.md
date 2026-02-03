# CLAUDE.md

This file is read by Claude Code at session start. It contains project rules, context, and learned patterns.

## Project Overview

Building a database of all ~19,500 US public school districts with superintendent contact information for AASA (The School Superintendents Association).

**Current state**: 33.5% superintendent coverage (6,619 / 19,740 districts)
**Goal**: 90%+ coverage

**Key Reference Docs:**
- `docs/STATE_SOURCES_GUIDE.md` - Where to find data for each state
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

## Current Database State (Updated Feb 1, 2026 - Phase 2 Complete)

**Overall: 33.5% coverage (6,619 / 19,740 districts)**

| Table | Records |
|-------|---------|
| districts | 19,740 |
| state_registry_districts | 6,384 |
| district_matches | 6,309 |

### States Loaded (18 states)

| State | Loaded | NCES Expected | Coverage | Notes |
|-------|--------|---------------|----------|-------|
| TX | 1,218 | 1,229 | 99.1% | Excellent |
| HI | 1 | 1 | 100% | Single statewide district |
| MD | 24 | 25 | 96.0% | Excellent |
| OK | 536 | 578 | 92.7% | Good |
| MS | 137 | 152 | 90.1% | Good |
| SD | 147 | 165 | 89.1% | Gap = cooperatives |
| WV | 65 | 67 | 88.1% | County school districts |
| NV | 17 | 20 | 85.0% | Gap = charters, corrections |
| IL | 850 | 1,028 | 82.7% | Good |
| WY | 48 | 86 | 55.8% | Gap = BOCES, institutions |
| NJ | 553 | 695 | 79.6% | Acceptable |
| FL | 64 | 82 | 78.0% | Acceptable |
| NY | 673 | 1,090 | 61.7% | NEEDS RE-COLLECTION |
| GA | 150 | 250 | 60.0% | NEEDS RE-COLLECTION |
| OH | 607 | 1,045 | 58.1% | NEEDS RE-COLLECTION |
| CA | 1,070 | 2,090 | 51.2% | NEEDS RE-COLLECTION |
| VT | 56 | 188 | 29.3% | SUs oversee member districts |
| NC | 100 | 352 | 28.4% | PRIORITY RE-COLLECTION |

### States Blocked (3 states)

| State | Issue | Available/Expected |
|-------|-------|-------------------|
| DE | Charter leader data not accessible | 19/45 |
| DC | Charter LEA leaders only in PDF | 1/71 |
| RI | Charter data fragmented | 36/67 |

### States at 0% (32 states)
AL, AK, AZ, AR, CO, CT, ID, IN, IA, KS, KY, LA, ME, MA, MI, MN, MO, MT, NE, NH, NM, ND, OR, PA, SC, TN, UT, VA, WA, WI, DE, DC, RI

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

## Learned Patterns (Update This Section)

### What Works
- Google "[State] superintendent directory" finds official sources fast
- State DoE data downloads are usually Excel/CSV
- State superintendent associations often at [state]ssa.org
- NCES as base is authoritative for district existence

### What Doesn't Work
- Exact string matching for district names (fails silently)
- Complex browser automation before trying simple fetch
- Spawning expensive agents for simple scraping tasks
- Modifying source tables to "fix" data

### Mistakes to Avoid
- Don't re-fetch NCES data - it's already loaded
- Don't merge tables without checking district_matches
- Don't assume state district names match NCES exactly
- Don't skip the data_imports audit record
- Don't assume CSVs are complete - always compare against NCES district count
- Don't forget charter school LEAs - they're in NCES but often missing from state directories

### Session Continuity
- If session crashes, check `logs/SESSION_LOG_*.md` for status
- Previous agent crashed on Kentucky (fetch-ky.js) - test carefully
- Many fetch scripts exist in `/scripts/fetch-*.js` - some untested

---

*Last updated: February 1, 2026*
*Update this file after every correction or learned pattern*
