# Collect State Superintendent Data

Find and collect superintendent data for a state that's not yet in the database.

## Arguments
- `$ARGUMENTS` - State name or abbreviation (e.g., Michigan, MI)

## Process

### Step 1: Check existing sources
```bash
grep -i "{state}" docs/SOURCES.md
grep -i "{state}" notes/state_doe_urls.txt
```

### Step 2: Find official data source (in order)

1. **Google search** (try first - usually works in 20 seconds)
   - "{State} superintendent directory"
   - "{State} school district directory"
   - "{State} department of education data download"

2. **State DoE website**
   - Look for "Data", "Downloads", "Directory" sections
   - Check for Excel/CSV export options

3. **State superintendent association**
   - Try: {state}ssa.org, {state}asa.org
   - Example: txssa.org, cassa.org

### Step 3: Evaluate the source

**Best (CSV/Excel download)**
- Direct file download, parse locally

**Good (HTML table)**
- Simple fetch, parse HTML

**Acceptable (PDF)**
- Download, extract with pdf tools

**Last resort (JavaScript-heavy portal)**
- Only if other options fail
- Use browser automation

### Step 4: Extract data

Required fields:
- district_name
- state (abbreviation)

Important fields:
- administrator_first_name
- administrator_last_name
- administrator_email
- phone
- city, address, zip

### Step 5: Save to CSV
```
data/processed/{state}_superintendents.csv
```

### Step 6: Update docs/SOURCES.md
Add entry with:
- Source URL
- Format (CSV, HTML, PDF)
- Record count
- Date captured
- Any notes about the source

### Step 7: Load to database
Run `/load-state {STATE}` or follow load-state process.

## Critical Rules
- TRY SIMPLE APPROACHES FIRST (curl, fetch)
- Don't spend hours on complex scraping
- Update SOURCES.md after success
- If blocked after 30 minutes, document the blocker and move to next state

Database: `postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres`
