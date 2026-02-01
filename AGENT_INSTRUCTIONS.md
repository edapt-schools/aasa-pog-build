# Agent Instructions

## You Are Here To Help Build a District Database

AASA (The School Superintendents Association) needs a database of all ~19,500 US public school districts with superintendent contact information.

**Current state**: 13.6% coverage (2,662 of 19,640 districts have superintendent names)
**Goal**: 90%+ coverage

---

## CRITICAL RULES (Violating These Breaks Things)

### 1. NEVER Modify Source Tables
```
districts           → READ ONLY (NCES baseline)
ccd_staff_data      → READ ONLY (CCD enrichment)
state_registry_districts → APPEND ONLY (insert new, never update)
```

All transformations happen through the `national_registry` VIEW.

### 2. NEVER Merge Data Without Approval
If you need to combine data from different sources, ASK FIRST. The matching layer (`district_matches`) handles this systematically.

### 3. Search Google BEFORE Complex Scraping
Most superintendent data is available via:
- State DoE data downloads (Excel/CSV)
- State superintendent associations ([state]ssa.org)
- Simple `curl` + parse

**DO NOT** immediately build Playwright scrapers. Try simple approaches first.

### 4. Use Fuzzy Matching for District Names
District names vary between sources:
- "Los Angeles Unified School District" vs "Los Angeles USD" vs "LAUSD"

**DO NOT** use exact string matching. Use normalized matching with fallback to fuzzy.

### 5. Log Everything
Every data operation must create a `data_imports` record for audit trail.

---

## Database Connection

```
Host: db.wdvpjyymztrebwaiaidu.supabase.co
Port: 5432
Database: postgres
User: postgres
Password: UMK-egr6gan5vdb.nzx
```

Connection string:
```
postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres
```

---

## Current Database State

| Table | Records | Purpose |
|-------|---------|---------|
| `districts` | 19,595 | NCES baseline (all US districts) |
| `ccd_staff_data` | 19,281 | CCD enrichment data |
| `state_registry_districts` | 2,355 | State-level superintendent data |
| `district_matches` | 2,352 | Links state records to NCES |
| `national_registry` | 19,640 | Unified VIEW combining all |

### States Already Loaded
| State | Records | Coverage |
|-------|---------|----------|
| TX | 1,218 | 96.5% |
| CA | 1,070 | 56.5% |
| FL | 67 | 78.6% |

### CSV Files Ready to Load (in this repo)
| File | Records | State |
|------|---------|-------|
| `il_superintendents.csv` | 851 | Illinois |
| `ny_superintendents.csv` | 682 | New York |
| `oh_superintendents.csv` | 607 | Ohio |
| `ga_superintendents.csv` | 184 | Georgia |
| `nc_superintendents.csv` | 100 | North Carolina |

---

## TASK PROMPTS (Copy-Paste Ready)

### Task 1: Load Existing CSV Files to Database

```
Load the existing superintendent CSV files from this repository into the database.

Files to load:
- il_superintendents.csv (851 records)
- ny_superintendents.csv (682 records)
- oh_superintendents.csv (607 records)
- ga_superintendents.csv (184 records)
- nc_superintendents.csv (100 records)

For each file:
1. Read the CSV and understand its schema
2. Map columns to state_registry_districts table schema
3. Create a data_imports record for audit
4. Insert records to state_registry_districts
5. Run matching against districts table
6. Report: records loaded, match rate, superintendent coverage

CRITICAL:
- DO NOT modify the districts table
- DO NOT merge data manually - use district_matches table
- Create data_imports record BEFORE inserting
- Log any parsing errors

Database: postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres
```

### Task 2: Collect Superintendent Data for a Specific State

```
Collect superintendent data for [STATE_NAME] and load it to the database.

Steps:
1. Google "[STATE_NAME] superintendent directory" or "[STATE_NAME] school district directory"
2. Check the state's Department of Education website for data downloads
3. Check if [STATE_ABBREV]ssa.org exists (state superintendent association)
4. Find the most authoritative source with superintendent names

Data collection priority:
1. CSV/Excel download from state DoE (best)
2. HTML table that can be scraped with simple fetch (good)
3. PDF directory (acceptable, parse with pdf tools)
4. Browser automation (last resort)

Required fields (map to what's available):
- district_name
- administrator_first_name, administrator_last_name
- administrator_email (if available)
- phone
- city, address, zip
- state (the state abbreviation)

After collection:
1. Create data_imports record
2. Insert to state_registry_districts
3. Run matching against districts table
4. Report results

Database: postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres
```

### Task 3: Check Database Status

```
Check the current state of the AASA district database and report coverage.

Run these queries and report:

1. Total districts and superintendent coverage:
   SELECT COUNT(*), COUNT(superintendent_name) FROM national_registry;

2. Coverage by state (top 10 and states with 0%):
   SELECT state, COUNT(*), COUNT(superintendent_name),
          ROUND(COUNT(superintendent_name)*100.0/COUNT(*),1) as pct
   FROM national_registry GROUP BY state ORDER BY COUNT(superintendent_name) DESC;

3. State registries loaded:
   SELECT state, COUNT(*) FROM state_registry_districts GROUP BY state;

4. Recent imports:
   SELECT source_name, record_count, imported_at, imported_by
   FROM data_imports ORDER BY imported_at DESC LIMIT 10;

5. Quality flags:
   SELECT flag_type, COUNT(*) FROM quality_flags WHERE resolved=false GROUP BY flag_type;

Database: postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres
```

### Task 4: Run Matching for Unmatched State Records

```
Run the matching algorithm for state_registry_districts records that don't have matches.

Matching algorithm (in order of preference):
1. Exact NCES ID match (if state provides it) → confidence 1.00
2. Exact name + state match → confidence 0.95
3. Normalized name match (remove "School District", etc.) → confidence 0.90
4. Fuzzy match (Jaro-Winkler similarity >= 0.80) → confidence varies

For each match:
1. Insert to district_matches with match_method and match_confidence
2. Flag for review if confidence < 0.85
3. Create quality_flag if no match found

Normalization rules:
- lowercase, trim whitespace
- "School District" → "SD"
- "Unified School District" → "USD"
- "Independent School District" → "ISD"
- Remove "#", "No.", punctuation
- "Saint" ↔ "St.", "Mount" ↔ "Mt."

Report:
- Records processed
- Match rate by method (exact_id, exact_name, normalized, fuzzy)
- Unmatched records
- Low-confidence matches flagged

Database: postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres
```

---

## Table Schemas

### state_registry_districts (where you INSERT state data)
```sql
id                      UUID PRIMARY KEY
state                   VARCHAR(2)      -- e.g., "CA"
state_district_id       VARCHAR(50)     -- state's ID for the district
district_name           VARCHAR(500)
county                  VARCHAR(255)
city                    VARCHAR(255)
address                 TEXT
street                  VARCHAR(255)
zip                     VARCHAR(20)
phone                   VARCHAR(50)
fax                     VARCHAR(50)
administrator_first_name VARCHAR(100)
administrator_last_name  VARCHAR(100)
administrator_email     VARCHAR(255)
website_url             TEXT
district_type           VARCHAR(100)
status                  VARCHAR(50)
source_url              TEXT            -- WHERE you got this data
raw_data                JSONB           -- original record for audit
import_batch_id         UUID            -- FK to data_imports
created_at              TIMESTAMP
```

### district_matches (where you INSERT match results)
```sql
id                  UUID PRIMARY KEY
nces_id             VARCHAR(20)     -- FK to districts
state_registry_id   UUID            -- FK to state_registry_districts
match_method        VARCHAR(50)     -- exact_id, exact_name, normalized, fuzzy, manual
match_confidence    DECIMAL(3,2)    -- 0.00 to 1.00
match_details       JSONB           -- algorithm output
matched_at          TIMESTAMP
matched_by          VARCHAR(100)    -- your agent identifier
verified            BOOLEAN
flag_for_review     BOOLEAN
```

### data_imports (CREATE this for every import)
```sql
id              UUID PRIMARY KEY
source_type     VARCHAR(50)     -- 'state_registry'
source_name     VARCHAR(100)    -- e.g., 'Illinois ISBE'
source_url      TEXT            -- where data came from
source_file     VARCHAR(255)    -- filename
record_count    INTEGER         -- total records
success_count   INTEGER         -- successfully loaded
error_count     INTEGER         -- failed records
error_log       JSONB           -- error details
imported_at     TIMESTAMP
imported_by     VARCHAR(100)    -- your agent identifier
checksum        VARCHAR(64)     -- SHA-256 of source file
notes           TEXT
```

---

## Common Mistakes to Avoid

### DON'T: Use exact string matching for district names
```javascript
// BAD
if (stateRecord.name === ncesRecord.name) { match(); }

// GOOD
if (normalize(stateRecord.name) === normalize(ncesRecord.name)) { match(); }
// Or use fuzzy matching for remaining
```

### DON'T: Skip the data_imports audit record
```javascript
// BAD
await insertStateRecords(records);

// GOOD
const importId = await createDataImport({ source_name: 'Illinois ISBE', ... });
await insertStateRecords(records, importId);
```

### DON'T: Spend hours on complex scraping before trying simple approaches
```javascript
// BAD - immediately building Playwright scraper

// GOOD - try in order:
// 1. Look for CSV/Excel download link
// 2. Try simple fetch() on the page
// 3. Check if there's an API
// 4. THEN consider browser automation
```

### DON'T: Update existing records in source tables
```javascript
// BAD
await db.query('UPDATE state_registry_districts SET ...');

// GOOD - insert new records, let the view handle it
await db.query('INSERT INTO state_registry_districts ...');
```

---

## Reporting Template

After completing any task, report:

```markdown
## Task: [Task Name]

### Summary
- Records processed: X
- Successfully loaded: X
- Errors: X

### Coverage Impact
- Before: X% (X/Y districts)
- After: X% (X/Y districts)
- Improvement: +X%

### Match Results (if applicable)
- Exact ID: X (X%)
- Exact Name: X (X%)
- Normalized: X (X%)
- Fuzzy: X (X%)
- Unmatched: X (X%)

### Issues Found
- [Issue 1]
- [Issue 2]

### Next Steps
- [Recommendation 1]
- [Recommendation 2]
```

---

## Questions? Escalate When:

1. Match rate < 85% for a state
2. Data source requires login/authentication
3. Uncertain about data quality
4. Need to modify schema
5. Source data format is unexpected

Don't guess. Ask.
