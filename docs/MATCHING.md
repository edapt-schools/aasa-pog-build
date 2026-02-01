# Matching Methodology

## AASA District Intelligence Database
**Version:** 1.0  
**Last Updated:** February 1, 2026

---

## Purpose

This document defines the exact rules for matching state registry records to the NCES baseline. Consistent matching is critical for data integrity and auditability.

---

## Matching Principles

1. **NCES is the authority for district existence** — If NCES says a district exists, it exists
2. **State data enriches, never overrides existence** — State data adds contact info, doesn't create new districts
3. **Conservative matching** — When uncertain, flag for review rather than guess
4. **Transparent confidence** — Every match has a documented confidence score
5. **Reversible decisions** — All matches are logged and can be undone

---

## Match Methods

### Method 1: Exact ID Match
**Confidence: 1.00 (100%)**

When a state provides the NCES ID in their data, use it for direct matching.

```
IF state_record.nces_id IS NOT NULL
AND state_record.nces_id EXISTS IN nces_districts
THEN match_method = 'exact_id', confidence = 1.00
```

**States known to include NCES IDs:**
- California (via CDS code mapping)
- Texas (TEA includes NCES ID)
- Some states in their data downloads

### Method 2: Exact Name + State Match
**Confidence: 0.95 (95%)**

When district name matches exactly (case-insensitive) within the same state.

```
IF LOWER(TRIM(state_record.name)) = LOWER(TRIM(nces_record.name))
AND state_record.state = nces_record.state
THEN match_method = 'exact_name', confidence = 0.95
```

**Normalization applied before comparison:**
- Trim whitespace
- Convert to lowercase
- Remove punctuation
- Normalize common variations (see below)

### Method 3: Normalized Name Match
**Confidence: 0.90 (90%)**

When names match after applying standard normalizations.

**Normalization rules:**
```
"School District" → "SD"
"Unified School District" → "USD"
"Independent School District" → "ISD"
"County School District" → "CSD"
"Public Schools" → "PS"
"City Schools" → "CS"
"Regional School District" → "RSD"
"Union Free School District" → "UFSD"
"#" → "" (remove number signs)
"No." → "" (remove "No.")
"Saint" ↔ "St."
"Mount" ↔ "Mt."
```

```
IF normalize(state_record.name) = normalize(nces_record.name)
AND state_record.state = nces_record.state
THEN match_method = 'normalized_name', confidence = 0.90
```

### Method 4: Fuzzy Name Match
**Confidence: 0.70 - 0.89**

When names are similar but not exact, use string similarity.

**Algorithm:** Jaro-Winkler distance (favors matching prefixes)

```
similarity = jaro_winkler(normalize(state_name), normalize(nces_name))

IF similarity >= 0.90 AND same_state
THEN match_method = 'fuzzy', confidence = similarity * 0.95

IF similarity >= 0.85 AND same_state AND same_city
THEN match_method = 'fuzzy', confidence = similarity * 0.95

IF similarity >= 0.80 AND same_state
THEN match_method = 'fuzzy', confidence = similarity * 0.90, flag_for_review = TRUE
```

### Method 5: City + Type Match
**Confidence: 0.75 (75%)**

When city name appears in district name and district types align.

```
IF state_record.city IN state_record.name
AND state_record.city IN nces_record.name
AND state_record.state = nces_record.state
AND compatible_district_type(state_record, nces_record)
THEN match_method = 'city_type', confidence = 0.75, flag_for_review = TRUE
```

### Method 6: Manual Match
**Confidence: 1.00 (100%)**

Human-verified match for edge cases.

```
match_method = 'manual'
confidence = 1.00
verified = TRUE
verified_by = '{human_name}'
verified_at = NOW()
```

---

## Confidence Score Thresholds

| Confidence | Action |
|------------|--------|
| 1.00 | Auto-accept (exact ID or manual) |
| 0.95 | Auto-accept (exact name) |
| 0.90 | Auto-accept (normalized name) |
| 0.85-0.89 | Auto-accept with logging |
| 0.80-0.84 | Accept but flag for review |
| 0.70-0.79 | Hold for manual review |
| < 0.70 | Reject, do not match |

---

## Conflict Resolution

### When State Name ≠ NCES Name
Keep both. The `national_registry` view shows:
- `nces_name` — Official federal name
- `district_name` — State's name (used for display)

### When Multiple State Records Match One NCES District
1. Prefer the record from the state's DOE (T2) over associations (T4)
2. If both are T2, prefer the more recent capture date
3. Log the conflict in `quality_flags`

### When State Record Matches Multiple NCES Districts
1. Do not auto-match
2. Flag for manual review
3. Look for distinguishing factors (city, enrollment, type)

### When State Record Matches No NCES District
1. Do not create a new NCES record
2. Store in `state_registry_districts` as unmatched
3. Flag for review — may indicate:
   - New district (created after NCES snapshot)
   - Closed district still in state records
   - Data quality issue in state data

---

## Matching Process

### Step 1: Pre-processing
```
FOR each state_record:
  1. Clean and normalize district name
  2. Extract city, state, type if not explicit
  3. Check for NCES ID in raw_data
```

### Step 2: Exact Matching Pass
```
FOR each state_record:
  1. Try exact_id match (if NCES ID available)
  2. If no match, try exact_name match
  3. If no match, try normalized_name match
  4. Record match or mark as unmatched
```

### Step 3: Fuzzy Matching Pass
```
FOR each unmatched state_record:
  1. Calculate similarity to all NCES records in same state
  2. If best_match >= 0.80, create match with appropriate confidence
  3. If best_match >= 0.70 < 0.80, flag for review
  4. If best_match < 0.70, leave unmatched
```

### Step 4: Review Queue
```
SELECT * FROM district_matches 
WHERE match_confidence < 0.85 
   OR flag_for_review = TRUE
ORDER BY match_confidence ASC;
```

### Step 5: Manual Resolution
For each flagged match:
1. Human reviews state record and potential NCES matches
2. Confirms, corrects, or rejects match
3. Updates `verified`, `verified_by`, `verified_at`

---

## Implementation

### Matching Script Location
`packages/api/src/scripts/match-state-registries.ts`

### Input
- `state_registry_districts` records with `import_batch_id = {current batch}`
- `nces_districts` (full table)

### Output
- `district_matches` records
- `quality_flags` for conflicts and review items

### Logging
Every matching run creates:
```json
{
  "run_id": "uuid",
  "started_at": "timestamp",
  "completed_at": "timestamp",
  "state": "CA",
  "input_records": 1070,
  "exact_id_matches": 0,
  "exact_name_matches": 892,
  "normalized_matches": 134,
  "fuzzy_matches": 38,
  "flagged_for_review": 12,
  "unmatched": 6
}
```

---

## Quality Metrics

### Match Rate Target
- **Tier 1 states (clean data):** 98%+ match rate
- **Tier 2 states (minor issues):** 95%+ match rate
- **Tier 3 states (significant issues):** 90%+ match rate
- **Below 90%:** Investigate data quality issues

### False Positive Rate
- **Target:** < 1% false positives
- **Measure:** Random sample review of auto-accepted matches
- **Action:** If > 1%, tighten confidence thresholds

### Manual Review Volume
- **Target:** < 5% of records require manual review
- **Action:** If > 5%, improve normalization rules

---

## Edge Cases

### Renamed Districts
Some districts change names between NCES snapshots and state data.
- Match on enrollment + city + type if name doesn't match
- Flag for review with note "possible rename"

### Merged Districts
When two districts merge, state may have one record, NCES may have two.
- Flag for review
- May need to match state record to both NCES records

### Split Districts
When one district splits, state may have two records, NCES may have one.
- Flag for review
- Newer NCES data may resolve

### Charter Schools
Charters may report through authorizer or independently.
- Use `charter_status` field in NCES for context
- Some states list charters separately

---

## Validation Rules

Before accepting any match:

1. **State must match** — state_record.state = nces_record.state
2. **Not already matched** — No existing match for either record
3. **Confidence meets threshold** — Based on match method
4. **Plausibility check** — If enrollment available, must be within 10x

---

## Audit Trail

Every match is logged in `district_matches` with:
- `match_method` — How the match was made
- `match_confidence` — Numeric confidence score
- `match_details` — JSON with algorithm output
- `matched_at` — Timestamp
- `matched_by` — Agent or human identifier
- `verified` — Whether human-reviewed
- `verified_at` — When verified
- `verified_by` — Who verified

---

## Rollback Procedure

To undo a matching batch:

```sql
-- Remove matches from specific import
DELETE FROM district_matches 
WHERE state_registry_id IN (
  SELECT id FROM state_registry_districts 
  WHERE import_batch_id = '{batch_id}'
);

-- Regenerate national_registry view
REFRESH MATERIALIZED VIEW national_registry;
```
