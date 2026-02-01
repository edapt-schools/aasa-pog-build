# CLAUDE.md

This file is read by Claude Code at session start. It contains project rules, context, and learned patterns.

## Project Overview

Building a database of all ~19,500 US public school districts with superintendent contact information for AASA (The School Superintendents Association).

**Current state**: 13.6% superintendent coverage (2,662 / 19,640 districts)
**Goal**: 90%+ coverage

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

## Current Database State

| Table | Records |
|-------|---------|
| districts | 19,595 |
| state_registry_districts | 2,355 |
| district_matches | 2,352 |

| State | Records | Coverage |
|-------|---------|----------|
| TX | 1,218 | 96.5% |
| CA | 1,070 | 56.5% |
| FL | 67 | 78.6% |
| 47 others | 0 | 0% |

## Files Ready to Load

These CSVs exist but are NOT in the database yet:
- `data/processed/il_superintendents.csv` (851)
- `data/processed/ny_superintendents.csv` (682)
- `data/processed/oh_superintendents.csv` (607)
- `data/processed/ga_superintendents.csv` (184)
- `data/processed/nc_superintendents.csv` (100)

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

---

*Last updated: February 1, 2026*
*Update this file after every correction or learned pattern*
