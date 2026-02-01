# Sub-Agent Quick Reference

## AASA District Intelligence Database
**Read this before doing ANY work**

---

## Model Routing Guide (NEW)

**Use the right model for the job:**

| Task | Model | Why |
|------|-------|-----|
| **Simple scraping** | **Haiku** | Following templates, clear instructions, fast execution |
| **File parsing** | **Haiku** | Structured data extraction, minimal judgment |
| **Data transformation** | **Sonnet** | Parsing complex formats, quality decisions |
| **Browser automation** | **Haiku** | Using template-unified.ts, established Playwright patterns |
| **URL discovery** | **Opus** | Site exploration, unclear structure, judgment needed |
| **Debugging failures** | **Opus** | Complex problem-solving, anti-bot workarounds |
| **Architecture changes** | **Opus** | Schema decisions, algorithm design |
| **Quality analysis** | **Sonnet** | Pattern recognition, recommendations |
| **Documentation** | **Sonnet** | Writing, synthesis, organization |

**Default assumption:** Start with Haiku unless the task requires reasoning or exploration.

---

## Unified Scraping Approach (NEW)

**Every scraper must follow this pattern:**

1. **Try `web_fetch` first** (always)
   - Fast, cheap, works ~40% of the time
   - Timeout: 10 seconds
   - Check response: >1000 chars, has expected content

2. **Fall back to browser if fetch fails**
   - Most state DOE sites are JavaScript-heavy
   - This is **normal**, not exceptional
   - Browser-first is faster than debugging fetch

3. **Log which approach worked**
   - Update `SOURCE_REGISTRY.md` immediately
   - Add: `approach_that_worked = "fetch"` or `"browser"`
   - Add: `anti_bot_measures = "none"` or `"javascript"` or `"cloudflare"`

4. **Use the unified template**
   - Copy: `packages/api/src/scripts/scrapers/template-unified.ts`
   - Customize the parsing logic
   - Template handles fetch → browser fallback automatically

**Don't waste time trying to make fetch work on JS-heavy sites. Browser automation is the default.**

---

## The Golden Rules

### 1. NCES is Truth
The NCES/CCD baseline defines which districts exist. Never create a district that isn't in NCES. If state data doesn't match NCES, flag it — don't force it.

### 2. Never Modify Source Data
Source tables are APPEND-ONLY. Raw data goes in, never comes out or gets modified. All transformations happen in views.

### 3. Log Everything
Every import creates a `data_imports` record. Every match creates a `district_matches` record. If it's not logged, it didn't happen.

### 4. Confidence Matters
Not all matches are equal. Use the right confidence score:
- 1.00 = Exact ID match
- 0.95 = Exact name match
- 0.90 = Normalized name match
- 0.70-0.89 = Fuzzy match (flag if < 0.85)
- < 0.70 = Don't match

### 5. Flag, Don't Guess
When uncertain, create a `quality_flags` record instead of making a wrong decision. Humans can review later.

---

## Before You Start

1. Read your assigned milestone in `IMPLEMENTATION_MILESTONES.md`
2. Check `SOURCE_REGISTRY.md` for source details
3. Understand the acceptance criteria
4. Know your escalation path

---

## Database Tables

| Table | Purpose | You Can |
|-------|---------|---------|
| `nces_districts` | Federal baseline | READ only |
| `ccd_staff_data` | Federal enrichment | READ only |
| `state_registry_districts` | State DOE data | INSERT |
| `district_matches` | Match records | INSERT |
| `data_imports` | Audit trail | INSERT |
| `quality_flags` | Quality issues | INSERT |

---

## Creating a data_imports Record

Every import MUST create this record:

```typescript
const importRecord = {
  id: crypto.randomUUID(),
  source_type: 'state_registry', // or 'nces', 'ccd'
  source_name: 'California CDE',
  source_url: 'https://www.cde.ca.gov/schooldirectory/',
  source_file: 'california-districts.txt',
  record_count: 1070,
  success_count: 1068,
  error_count: 2,
  error_log: { errors: [...] },
  imported_at: new Date(),
  imported_by: 'your-agent-label',
  checksum: 'sha256-of-source-file',
  notes: 'Any relevant notes'
};
```

---

## Matching a State Record

```typescript
// Try methods in order
let match = null;

// Method 1: Exact ID (if state provides NCES ID)
if (stateRecord.nces_id) {
  match = findByNcesId(stateRecord.nces_id);
  if (match) return { method: 'exact_id', confidence: 1.00 };
}

// Method 2: Exact name
match = findByExactName(stateRecord.name, stateRecord.state);
if (match) return { method: 'exact_name', confidence: 0.95 };

// Method 3: Normalized name
match = findByNormalizedName(normalize(stateRecord.name), stateRecord.state);
if (match) return { method: 'normalized_name', confidence: 0.90 };

// Method 4: Fuzzy match
const fuzzyMatch = findBestFuzzyMatch(stateRecord.name, stateRecord.state);
if (fuzzyMatch.similarity >= 0.70) {
  return { 
    method: 'fuzzy', 
    confidence: fuzzyMatch.similarity * 0.95,
    flag_for_review: fuzzyMatch.similarity < 0.85
  };
}

// No match found
return { method: 'none', confidence: 0, unmatched: true };
```

---

## Name Normalization

Apply these transformations before matching:

```typescript
function normalize(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/school district/gi, 'sd')
    .replace(/unified school district/gi, 'usd')
    .replace(/independent school district/gi, 'isd')
    .replace(/public schools/gi, 'ps')
    .replace(/saint/gi, 'st')
    .replace(/mount/gi, 'mt')
    .replace(/[#.,]/g, '')
    .replace(/\s+/g, ' ');
}
```

---

## Quality Flags

When you find an issue:

```typescript
const flag = {
  id: crypto.randomUUID(),
  district_id: districtId,
  source_table: 'state_registry_districts',
  flag_type: 'MISSING_SUPT_NAME', // or other type
  field_name: 'superintendent_name',
  description: 'State record has no superintendent name',
  severity: 'high', // low, medium, high, critical
  created_at: new Date(),
  resolved: false
};
```

---

## Reporting Results

Every milestone must report:

```markdown
## Results: [Milestone Name]

**State:** [State]
**Records Processed:** [N]
**Successfully Loaded:** [N]
**Errors:** [N]

**Scraping Approach:** [fetch | browser | api]  ← **REQUIRED**
**Anti-Bot Measures:** [none | javascript | cloudflare | captcha]  ← **REQUIRED**

**Match Results:**
- Exact ID: [N] ([%])
- Exact Name: [N] ([%])
- Normalized: [N] ([%])
- Fuzzy: [N] ([%])
- Unmatched: [N] ([%])

**Superintendent Coverage:** [N] / [Total] ([%])

**Issues Found:**
- [Issue 1]
- [Issue 2]

**Flags Created:** [N]

**Files Created:**
- [file1.ts]
- [file2.json]

**SOURCE_REGISTRY.md Updated:** [yes/no]  ← **REQUIRED**
```

**Mandatory:** Update `SOURCE_REGISTRY.md` with approach_that_worked and anti_bot_measures after every successful scrape.

---

## When Things Go Wrong

### Scraper Blocked?
1. Try different User-Agent
2. Add delays between requests
3. Try alternative URL from SOURCE_REGISTRY.md
4. Document blocker, move to next state

### Match Rate Too Low?
1. Check name normalization
2. Look for systematic differences (e.g., state uses "County" but NCES doesn't)
3. Add state-specific normalization rules
4. Escalate if < 85%

### Data Looks Wrong?
1. Verify source URL
2. Check if site structure changed
3. Compare sample records manually
4. Create quality flags for suspicious records

### Not Sure What To Do?
1. Re-read the methodology docs
2. Check if similar situation documented
3. Escalate to main agent
4. Don't guess on important decisions

---

## File Locations

```
projects/aasa-district-intel/
├── docs/
│   ├── DATA_ARCHITECTURE.md      ← Read this
│   ├── SOURCE_REGISTRY.md        ← Update this
│   ├── MATCHING_METHODOLOGY.md   ← Follow this
│   ├── QUALITY_TIERS.md          ← Understand this
│   └── IMPLEMENTATION_MILESTONES.md ← Track this
├── packages/api/src/
│   ├── db/
│   │   └── schema.ts             ← Table definitions
│   └── scripts/
│       ├── scrapers/             ← Scraper scripts
│       ├── parsers/              ← Parser scripts
│       ├── load-state-registries.ts
│       └── match-state-registries.ts
├── data/
│   ├── state-registries/         ← JSON output
│   └── ccd_raw/                  ← Federal data
└── [STATE]_REPORT.md             ← Your reports
```

---

## Checklist Before Completing

- [ ] data_imports record created
- [ ] Data loaded to correct table
- [ ] Matching run (if applicable)
- [ ] Results reported in markdown
- [ ] SOURCE_REGISTRY.md updated
- [ ] Errors logged
- [ ] Quality flags created for issues
- [ ] Files saved to correct locations
