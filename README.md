# US School District Superintendent Data Collection

## Project Overview
Building a comprehensive database of US public school district superintendents by combining NCES national district data with state-level superintendent directories.

## Status: Incomplete (~20% Coverage)
- **Total US Districts**: 19,281 (from NCES 2024-2025)
- **Districts with Superintendent Names**: ~3,800
- **States with Complete Superintendent Data**: 7
- **States Remaining**: 43

## Data Architecture

### Base Layer: NCES Data
The National Center for Education Statistics (NCES) provides authoritative district data for all 50 states:
- District name, NCES ID
- Phone, website, full address
- Grade levels served, district type
- **Does NOT include superintendent names**

File: `us_districts_base_nces.csv` (19,281 districts)

### Enrichment Layer: State Superintendent Data
State-level sources provide superintendent names that must be matched to NCES districts:

| State | File | Districts | Source |
|-------|------|-----------|--------|
| CA | ca_superintendents.csv | 1,070 | CDE direct download |
| TX | tx_superintendents.csv | 1,218 | TEA |
| IL | il_superintendents.csv | 851 | ISBE Excel |
| NY | ny_superintendents.csv | 682 | tax.ny.gov PDF |
| OH | oh_superintendents.csv | 607 | ODE |
| GA | ga_superintendents.csv | 184 | GSSA website |
| NC | nc_superintendents.csv | 100 | NCSSA |

### Merged Output
File: `us_districts_with_supes.csv` - All NCES districts with superintendent names where available

## Files in This Repo

### Primary Data Files
- `us_districts_base_nces.csv` - All 19,281 US districts (no superintendent names)
- `us_districts_with_supes.csv` - Merged data with partial superintendent coverage
- `*_superintendents.csv` - State-specific files with superintendent names

### Raw Source Files
- `ccd_lea_029_2425_w_1a_073025.csv` - Original NCES CCD data file
- `ca_districts_raw.txt` - Raw California download
- `il_educational_entities.xls` - Illinois ISBE source
- `oh_districts_raw.csv` - Ohio source data
- `nces_all_districts_2425.zip` - NCES ZIP archive

### Documentation
- `state_doe_urls.txt` - Working state DoE data download URLs
- `il_findings.txt` - Notes on Illinois extraction
- `oh_superintendents_STATUS.txt` - Ohio progress notes

## Known Issues

### Blocking Problems for Remaining States
1. **Broken URLs**: PA, AZ, MI, FL superintendent association pages return 404
2. **Bot protection**: Arizona DoE blocks automated access (403)
3. **Name matching**: District names differ between NCES and state data (exact match fails)
4. **Site restructuring**: Florida DoE reorganized, many pages return empty content

### Data Quality Notes
- District name matching is imperfect - some state names don't match NCES exactly
- Superintendent data freshness varies by state source
- Some states have partial data (not all districts covered)

## Lessons Learned

### What Works
1. **Google search first** - Official directories found in 20 seconds
2. **State DoE data downloads** - Most states have Excel/CSV exports
3. **State superintendent associations** - Often at `[state]ssa.org`
4. **NCES as base** - Authoritative for district contact info

### What Doesn't Work
1. **Complex browser automation** - Overkill for public directories
2. **Spawning expensive agents** - Simple curl + grep faster
3. **Exact name matching** - District names vary between sources

## Working Data Source URLs

### State DoE Data Downloads (Confirmed)
- CA: `cde.ca.gov/ds/si/ds/pubschls.asp`
- IL: `isbe.net/Pages/Data-Analysis-Directories.aspx`
- TX: TEA direct download
- NY: `tax.ny.gov` PDF directory

### National
- NCES: `nces.ed.gov/ccd/files.asp`

## Next Steps (If Continuing)

1. Prioritize large states: MI (886), PA (790), AZ (726), NJ (700)
2. Check state DoE data download pages: `[state].gov/[doe]/data`
3. Try state superintendent associations: `[state]ssa.org`
4. Implement fuzzy matching for district names
5. Accept partial coverage - names can be enriched later

## CRITICAL RULES (From Project History)

⚠️ **DO NOT merge data between tables without explicit approval**
⚠️ **NCES data exists as authoritative base - don't re-fetch**
⚠️ **Check memory files before starting work to avoid duplication**

---

*Project started: February 1, 2026*
*Last updated: February 1, 2026*
*Status: Paused - needs manual intervention for remaining states*
