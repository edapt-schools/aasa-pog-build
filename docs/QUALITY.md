# Quality Tiers

## AASA District Intelligence Database
**Version:** 1.0  
**Last Updated:** February 1, 2026

---

## Purpose

This document defines quality tiers for district records. Quality tiers help consumers understand how much to trust each record and prioritize data improvement efforts.

---

## Record Quality Tiers

### Tier A: Complete & Verified
**Trust Level: Highest**

A record achieves Tier A when:
- ✅ Exists in NCES baseline
- ✅ Matched to state registry (confidence ≥ 0.95)
- ✅ Has superintendent name
- ✅ Has superintendent email OR phone
- ✅ Has website URL
- ✅ Match verified by human OR confidence = 1.00

**Use:** Safe for direct outreach, high-confidence analysis

### Tier B: Complete, Auto-Matched
**Trust Level: High**

A record achieves Tier B when:
- ✅ Exists in NCES baseline
- ✅ Matched to state registry (confidence ≥ 0.85)
- ✅ Has superintendent name
- ✅ Has phone OR website
- ❌ Not human-verified (but high-confidence auto-match)

**Use:** Suitable for outreach with minor verification, reliable for analysis

### Tier C: Partial Data
**Trust Level: Medium**

A record achieves Tier C when:
- ✅ Exists in NCES baseline
- ✅ Matched to state registry (any confidence)
- ⚠️ Missing superintendent name OR contact info
- ⚠️ May have lower match confidence (0.70-0.84)

**Use:** Needs enrichment before outreach, include in aggregate analysis with caveats

### Tier D: NCES Only
**Trust Level: Medium-Low**

A record achieves Tier D when:
- ✅ Exists in NCES baseline
- ❌ No state registry match
- ⚠️ Only federal data available (no superintendent name)

**Use:** District exists, but contact info needed. Use website scraping or manual lookup.

### Tier E: Unverified
**Trust Level: Low**

A record achieves Tier E when:
- ⚠️ State registry data with low-confidence match (< 0.70)
- ⚠️ OR state registry data with no NCES match
- ⚠️ OR data from Tier 4-5 sources only

**Use:** Requires manual verification before any use

---

## Quality Tier Distribution Targets

| Tier | Target % | Current % | Gap |
|------|----------|-----------|-----|
| A | 60% | TBD | TBD |
| B | 25% | TBD | TBD |
| C | 10% | TBD | TBD |
| D | 4% | TBD | TBD |
| E | 1% | TBD | TBD |

---

## Field-Level Quality Indicators

### Superintendent Name
| Status | Indicator | Meaning |
|--------|-----------|---------|
| ✅ | `supt_source = 'state_registry'` | From official state DOE |
| ⚠️ | `supt_source = 'association'` | From professional association |
| ⚠️ | `supt_source = 'website_scrape'` | Scraped from district website |
| ❌ | `supt_source = NULL` | Not available |

### Email
| Status | Indicator | Meaning |
|--------|-----------|---------|
| ✅ | `email_verified = TRUE` | Format valid, domain matches district |
| ⚠️ | `email_verified = FALSE` | Format valid, domain unverified |
| ❌ | `email = NULL` | Not available |

### Phone
| Status | Indicator | Meaning |
|--------|-----------|---------|
| ✅ | `phone_source = 'state_registry'` | From state DOE |
| ✅ | `phone_source = 'ccd'` | From federal CCD |
| ⚠️ | `phone_source = 'website'` | Scraped from website |

### Website
| Status | Indicator | Meaning |
|--------|-----------|---------|
| ✅ | `website_validated = TRUE` | URL returns 200, matches district |
| ⚠️ | `website_validated = FALSE` | URL not tested |
| ❌ | `website = NULL` | Not available |

---

## Quality Flag Types

### Missing Data Flags
| Flag | Severity | Description |
|------|----------|-------------|
| `MISSING_SUPT_NAME` | High | No superintendent name |
| `MISSING_EMAIL` | Medium | No email address |
| `MISSING_PHONE` | Medium | No phone number |
| `MISSING_WEBSITE` | Low | No website URL |
| `MISSING_ADDRESS` | Low | No physical address |

### Data Conflict Flags
| Flag | Severity | Description |
|------|----------|-------------|
| `NAME_MISMATCH` | Medium | State name ≠ NCES name significantly |
| `ENROLLMENT_MISMATCH` | Low | Enrollment differs > 20% |
| `DUPLICATE_MATCH` | High | Multiple state records match one NCES |
| `ORPHAN_STATE_RECORD` | Medium | State record with no NCES match |

### Staleness Flags
| Flag | Severity | Description |
|------|----------|-------------|
| `STATE_DATA_STALE` | Medium | State data > 6 months old |
| `WEBSITE_UNREACHABLE` | Medium | Website returns error |
| `EMAIL_BOUNCED` | High | Email delivery failed |

---

## Quality Improvement Workflow

### Priority 1: Tier D → Tier C
Districts with NCES data but no state match.

**Actions:**
1. Check if state registry exists but wasn't matched
2. Try manual matching with looser criteria
3. Scrape district website for superintendent
4. Flag for next state registry refresh

### Priority 2: Tier C → Tier B
Districts with partial data.

**Actions:**
1. Scrape district website for missing fields
2. Check superintendent association directories
3. Cross-reference with LinkedIn (manual)

### Priority 3: Tier B → Tier A
Districts with unverified matches.

**Actions:**
1. Human review of auto-matches
2. Validate email deliverability
3. Confirm website accessibility

---

## Quality Score Calculation

Each record receives a quality score (0-100):

```
base_score = 40  # Having NCES record

+20 if matched_to_state_registry (confidence >= 0.90)
+15 if matched_to_state_registry (confidence 0.80-0.89)
+10 if matched_to_state_registry (confidence 0.70-0.79)

+15 if superintendent_name IS NOT NULL
+10 if superintendent_email IS NOT NULL
+5  if phone IS NOT NULL
+5  if website IS NOT NULL
+5  if address IS NOT NULL

+10 if match_verified = TRUE
-10 for each HIGH severity flag
-5  for each MEDIUM severity flag
```

**Score → Tier Mapping:**
- 90-100: Tier A
- 75-89: Tier B
- 60-74: Tier C
- 40-59: Tier D
- 0-39: Tier E

---

## Reporting

### Quality Dashboard Metrics

```sql
-- Tier distribution
SELECT quality_tier, COUNT(*), ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as pct
FROM national_registry
GROUP BY quality_tier;

-- Missing superintendent by state
SELECT state, COUNT(*) as missing_supt
FROM national_registry
WHERE superintendent_name IS NULL
GROUP BY state
ORDER BY missing_supt DESC;

-- Flagged records by type
SELECT flag_type, COUNT(*)
FROM quality_flags
WHERE resolved = FALSE
GROUP BY flag_type;
```

### Weekly Quality Report
Generated every Monday:
1. Tier distribution changes
2. New flags created
3. Flags resolved
4. States with degraded quality
5. Priority improvement actions

---

## Quality Commitments

### For Tier A Records
- Contact info validated within 6 months
- Superintendent name verified annually
- Website checked monthly for accessibility

### For Tier B Records
- Review for promotion to Tier A quarterly
- Auto-check website accessibility monthly

### For Tier C-E Records
- Prioritized for improvement based on state importance
- Flagged for next state registry refresh

---

## Acceptable Use by Tier

| Use Case | Min Tier | Notes |
|----------|----------|-------|
| Direct email outreach | A | Verified contacts only |
| Direct mail | B | Address from official source |
| Phone outreach | B | Phone from state/CCD |
| Aggregate reporting | C | Include data quality note |
| Research/analysis | D | Acknowledge limitations |
| Internal reference | E | Verify before external use |
