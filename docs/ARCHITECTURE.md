# Data Architecture

## AASA District Intelligence Database
**Version:** 1.0  
**Last Updated:** February 1, 2026  
**Owner:** Sterling (AI) + Christian Jackson

---

## Purpose

Build a comprehensive, defensible database of every public school district and charter in the United States with superintendent contact information. This database must be:

1. **Complete** — All ~19,500 districts across 50 states + DC
2. **Accurate** — Superintendent names and contact info are current
3. **Defensible** — Every data point traces to a verifiable source
4. **Maintainable** — Can be refreshed quarterly without rebuilding

---

## Design Principles

### 1. Immutable Source Tables
Raw data from each source is stored in its own table, NEVER modified after import. This preserves the original record for audit purposes.

### 2. Unified View Layer
The `national_registry` view combines sources using documented COALESCE rules. The view can be regenerated; source tables cannot be altered.

### 3. Full Provenance
Every record includes:
- `source_url` — Where the data came from
- `source_file` — Specific file/page within source
- `captured_at` — When we retrieved it
- `import_batch_id` — Links to `data_imports` table

### 4. Confidence Scoring
Not all data is equal. Every match and every field has a confidence indicator so consumers know what to trust.

### 5. Separation of Concerns
- **Existence data** (is this a real district?) → NCES/CCD
- **Contact data** (who runs it?) → State registries
- **Current data** (is this still accurate?) → District websites

---

## Table Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SOURCE LAYER                             │
│                   (Immutable, append-only)                      │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  nces_districts │  ccd_staff_data │  state_registry_districts   │
│  (federal base) │  (federal enrich)│  (50 state DOE sources)    │
└────────┬────────┴────────┬────────┴──────────────┬──────────────┘
         │                 │                       │
         └────────────────┬┴───────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MATCHING LAYER                             │
│              (Tracks how records link together)                 │
├─────────────────────────────────────────────────────────────────┤
│  district_matches                                               │
│  - nces_id (FK)                                                 │
│  - state_registry_id (FK)                                       │
│  - match_method (exact_id | exact_name | fuzzy | manual)        │
│  - match_confidence (0.0 - 1.0)                                 │
│  - matched_at, matched_by                                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       VIEW LAYER                                │
│               (Unified, regeneratable)                          │
├─────────────────────────────────────────────────────────────────┤
│  national_registry (VIEW)                                       │
│  - Combines all sources via COALESCE                            │
│  - Tracks field-level provenance                                │
│  - Includes confidence scores                                   │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AUDIT LAYER                                │
│                (Tracks all operations)                          │
├─────────────────────────────────────────────────────────────────┤
│  data_imports        │  match_audit         │  quality_flags    │
│  - import_id         │  - match_id          │  - district_id    │
│  - source_type       │  - decision          │  - flag_type      │
│  - source_url        │  - confidence_before │  - description    │
│  - file_name         │  - confidence_after  │  - resolved       │
│  - record_count      │  - changed_by        │  - resolved_at    │
│  - imported_at       │  - changed_at        │                   │
│  - imported_by       │  - reason            │                   │
└──────────────────────┴──────────────────────┴───────────────────┘
```

---

## Table Definitions

### nces_districts (Federal Baseline)
The authoritative list of districts. If NCES says it exists, it exists.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Internal primary key |
| nces_id | VARCHAR(20) | NCES LEA ID (unique) |
| name | VARCHAR(500) | Official district name |
| state | CHAR(2) | State abbreviation |
| city | VARCHAR(255) | City |
| county | VARCHAR(255) | County |
| address | TEXT | Physical address |
| phone | VARCHAR(50) | Main phone |
| website_domain | VARCHAR(500) | Website URL |
| enrollment | INTEGER | Student count |
| grades_served | VARCHAR(50) | e.g., "PK-12" |
| locale_code | VARCHAR(10) | Urban/suburban/rural |
| operational_schools | INTEGER | Number of schools |
| charter_status | VARCHAR(20) | Yes/No/N/A |
| import_batch_id | UUID | FK to data_imports |
| created_at | TIMESTAMP | Record creation |

### ccd_staff_data (Federal Enrichment)
Additional data from CCD that enriches the baseline.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Internal primary key |
| nces_id | VARCHAR(20) | Links to nces_districts |
| mailing_address | TEXT | If different from physical |
| phone | VARCHAR(50) | May differ from baseline |
| website_url | VARCHAR(500) | Full URL |
| lowest_grade | VARCHAR(10) | Lowest grade offered |
| highest_grade | VARCHAR(10) | Highest grade offered |
| total_staff | INTEGER | Staff count |
| import_batch_id | UUID | FK to data_imports |
| created_at | TIMESTAMP | Record creation |

### state_registry_districts (State DOE Data)
One row per district per state source. A district may have multiple rows if we have data from multiple state sources.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Internal primary key |
| state | CHAR(2) | State abbreviation |
| state_district_id | VARCHAR(50) | State's ID (e.g., CDS code) |
| district_name | VARCHAR(500) | Name per state records |
| county | VARCHAR(255) | County |
| city | VARCHAR(255) | City |
| address | TEXT | Physical address |
| mailing_address | TEXT | If different |
| phone | VARCHAR(50) | Phone |
| fax | VARCHAR(50) | Fax |
| website_url | VARCHAR(500) | Website |
| superintendent_first_name | VARCHAR(100) | First name |
| superintendent_last_name | VARCHAR(100) | Last name |
| superintendent_email | VARCHAR(255) | Email |
| superintendent_title | VARCHAR(100) | Title if provided |
| district_type | VARCHAR(100) | e.g., "Unified", "Elementary" |
| status | VARCHAR(50) | Active/Inactive |
| latitude | DECIMAL(10,6) | Coordinates |
| longitude | DECIMAL(10,6) | Coordinates |
| source_url | TEXT | Exact URL scraped |
| source_file | VARCHAR(255) | Filename if applicable |
| raw_data | JSONB | Original record preserved |
| import_batch_id | UUID | FK to data_imports |
| created_at | TIMESTAMP | Record creation |

### district_matches (Matching Layer)
Links state records to NCES baseline.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Internal primary key |
| nces_id | VARCHAR(20) | FK to nces_districts |
| state_registry_id | UUID | FK to state_registry_districts |
| match_method | ENUM | exact_id, exact_name, fuzzy, manual |
| match_confidence | DECIMAL(3,2) | 0.00 to 1.00 |
| match_details | JSONB | Algorithm output, scores |
| matched_at | TIMESTAMP | When matched |
| matched_by | VARCHAR(100) | Agent or human who matched |
| verified | BOOLEAN | Human-verified flag |
| verified_at | TIMESTAMP | When verified |
| verified_by | VARCHAR(100) | Who verified |

### data_imports (Audit Trail)
Every import operation is logged.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Import batch ID |
| source_type | VARCHAR(50) | nces, ccd, state_registry |
| source_name | VARCHAR(100) | e.g., "California CDE" |
| source_url | TEXT | Where data came from |
| source_file | VARCHAR(255) | Specific file |
| record_count | INTEGER | Records imported |
| success_count | INTEGER | Successfully loaded |
| error_count | INTEGER | Failed records |
| error_log | JSONB | Error details |
| imported_at | TIMESTAMP | When imported |
| imported_by | VARCHAR(100) | Agent that ran import |
| checksum | VARCHAR(64) | SHA-256 of source file |
| notes | TEXT | Any relevant notes |

### quality_flags (Data Quality Issues)
Track data quality issues for resolution.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| district_id | UUID | Which district |
| source_table | VARCHAR(50) | Where issue found |
| flag_type | VARCHAR(50) | missing_field, mismatch, stale, etc. |
| field_name | VARCHAR(100) | Which field |
| description | TEXT | Human-readable issue |
| severity | ENUM | low, medium, high, critical |
| created_at | TIMESTAMP | When flagged |
| resolved | BOOLEAN | Is it fixed? |
| resolved_at | TIMESTAMP | When fixed |
| resolved_by | VARCHAR(100) | Who fixed |
| resolution_notes | TEXT | How it was fixed |

---

## View Definitions

### national_registry
The unified view that combines all sources.

```sql
CREATE VIEW national_registry AS
SELECT 
  n.nces_id,
  n.name AS nces_name,
  COALESCE(s.district_name, n.name) AS district_name,
  n.state,
  COALESCE(s.city, n.city) AS city,
  COALESCE(s.county, n.county) AS county,
  
  -- Contact info: prefer state registry (more current)
  COALESCE(s.superintendent_first_name || ' ' || s.superintendent_last_name, NULL) AS superintendent_name,
  s.superintendent_email,
  COALESCE(s.phone, c.phone, n.phone) AS phone,
  COALESCE(s.website_url, c.website_url, n.website_domain) AS website,
  
  -- Demographics from NCES
  n.enrollment,
  n.grades_served,
  n.locale_code,
  
  -- Match quality
  m.match_confidence,
  m.match_method,
  m.verified AS match_verified,
  
  -- Provenance tracking
  CASE 
    WHEN s.id IS NOT NULL THEN 'state_registry'
    WHEN c.id IS NOT NULL THEN 'ccd'
    ELSE 'nces_only'
  END AS primary_source,
  
  s.source_url AS state_source_url,
  s.created_at AS state_data_captured_at

FROM nces_districts n
LEFT JOIN district_matches m ON m.nces_id = n.nces_id
LEFT JOIN state_registry_districts s ON s.id = m.state_registry_id
LEFT JOIN ccd_staff_data c ON c.nces_id = n.nces_id;
```

---

## Data Flow

```
1. NCES/CCD Import (Annual)
   └── Downloads federal files
   └── Loads to nces_districts + ccd_staff_data
   └── Creates data_imports record
   └── Baseline: ~19,500 districts

2. State Registry Scraping (Per State)
   └── Scrapes state DOE site
   └── Loads to state_registry_districts
   └── Creates data_imports record
   └── Captures superintendent info

3. Matching Process (After Each State Load)
   └── Attempts exact ID match (if state provides NCES ID)
   └── Falls back to exact name + state match
   └── Falls back to fuzzy name match
   └── Flags uncertain matches for review
   └── Creates district_matches records

4. Quality Check (Continuous)
   └── Identifies missing fields
   └── Identifies conflicts between sources
   └── Creates quality_flags records

5. View Refresh (On Demand)
   └── national_registry regenerated
   └── Incorporates all matched data
```

---

## Refresh Strategy

| Source | Frequency | Method |
|--------|-----------|--------|
| NCES/CCD | Annually | Full replace |
| State DOE | Quarterly | Full replace per state |
| District websites | As needed | Targeted scrape |

---

## Access Patterns

1. **Find all districts in a state with superintendent info**
   ```sql
   SELECT * FROM national_registry 
   WHERE state = 'CA' AND superintendent_name IS NOT NULL;
   ```

2. **Find districts missing superintendent data**
   ```sql
   SELECT * FROM national_registry 
   WHERE superintendent_name IS NULL;
   ```

3. **Audit a specific district's data sources**
   ```sql
   SELECT n.*, s.*, m.* 
   FROM nces_districts n
   LEFT JOIN district_matches m ON m.nces_id = n.nces_id
   LEFT JOIN state_registry_districts s ON s.id = m.state_registry_id
   WHERE n.nces_id = '0123456';
   ```

4. **Review unverified fuzzy matches**
   ```sql
   SELECT * FROM district_matches 
   WHERE match_method = 'fuzzy' AND verified = false
   ORDER BY match_confidence ASC;
   ```

---

## Security & Privacy

- **No student PII** — Only district-level data
- **Public officials only** — Superintendent names are public record
- **Source attribution** — All data traceable to public sources
- **No scraping of private sites** — Only official .gov/.edu sources

---

## Change Log

| Date | Version | Change | Author |
|------|---------|--------|--------|
| 2026-02-01 | 1.0 | Initial architecture | Sterling |
