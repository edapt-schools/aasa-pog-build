# Source Registry

## AASA District Intelligence Database
**Version:** 1.0  
**Last Updated:** February 1, 2026

---

## Purpose

This document catalogs every data source used in the database. Each source is assigned a unique ID and categorized by authority tier. All imports must reference a source from this registry.

---

## Source Authority Tiers

| Tier | Description | Trust Level | Use For |
|------|-------------|-------------|---------|
| **T1** | Federal government (NCES/CCD) | Highest | District existence, federal IDs, enrollment |
| **T2** | State DOE official sites | High | Superintendent names, state IDs, contact info |
| **T3** | District official websites | Medium | Current contact info, verification |
| **T4** | Professional associations | Medium-Low | Gap-filling, validation |
| **T5** | Aggregated/crowdsourced | Low | District lists only, never contact info |

---

## Source Metadata Fields (New)

For each state source, we now track:

| Field | Values | Purpose |
|-------|--------|---------|
| **Approach That Worked** | `api` \| `fetch` \| `browser` | What method successfully extracted data |
| **Anti-Bot Measures** | `none` \| `cloudflare` \| `captcha` \| `javascript` | What protections the site uses |
| **Stable Selectors** | CSS/XPath selectors or `N/A` | Reliable selectors for browser automation |

**Why this matters:**
- **Approach learning**: Don't waste time on methods that don't work
- **Fast routing**: Try `fetch` first, fall back to `browser` if needed
- **Maintenance**: Know what to expect when sites change

---

## Federal Sources (Tier 1)

### NCES-CCD-LEA-2425
| Field | Value |
|-------|-------|
| **Source ID** | `NCES-CCD-LEA-2425` |
| **Name** | NCES Common Core of Data - LEA Universe Survey |
| **Tier** | T1 |
| **URL** | https://nces.ed.gov/ccd/files.asp |
| **File** | ccd_lea_029_2425_w_1a_073025.csv |
| **Format** | CSV (pipe-delimited) |
| **Records** | 19,281 |
| **Fields** | NCES ID, name, address, phone, website, enrollment, grades, locale |
| **Update Frequency** | Annual (July) |
| **Last Captured** | 2026-02-01 |
| **Captured By** | ccd-deep-pull agent |
| **Notes** | Authoritative for district existence. Does NOT contain superintendent names. |

### NCES-CCD-STAFF-2425
| Field | Value |
|-------|-------|
| **Source ID** | `NCES-CCD-STAFF-2425` |
| **Name** | NCES Common Core of Data - Staff Survey |
| **Tier** | T1 |
| **URL** | https://nces.ed.gov/ccd/files.asp |
| **File** | ccd_lea_052_2425_l_1a_073025.csv |
| **Format** | CSV |
| **Records** | 19,281 |
| **Fields** | Staff counts by category (aggregate only) |
| **Update Frequency** | Annual |
| **Last Captured** | 2026-02-01 |
| **Notes** | Does NOT contain individual names due to privacy. |

---

## State DOE Sources (Tier 2)

### CALIFORNIA
| Field | Value |
|-------|-------|
| **Source ID** | `CA-CDE-DIR-2026` |
| **Name** | California Department of Education - District Directory |
| **Tier** | T2 |
| **URL** | https://www.cde.ca.gov/schooldirectory/ |
| **Format** | Tab-delimited text |
| **Records** | 1,070 |
| **Fields** | CDS code, name, superintendent, address, phone, fax, website, lat/long |
| **Last Captured** | 2026-01-31 |
| **Captured By** | aasa-state-registries-architecture agent |
| **Status** | ✅ Loaded |
| **Approach That Worked** | fetch |
| **Anti-Bot Measures** | none |
| **Stable Selectors** | N/A (text file download) |

### FLORIDA
| Field | Value |
|-------|-------|
| **Source ID** | `FL-DOE-SUPT-2026` |
| **Name** | Florida DOE - Superintendents Directory |
| **Tier** | T2 |
| **URL** | https://www.fldoe.org/accountability/data-sys/school-dis-data/superintendents.stml |
| **Format** | HTML (static) |
| **Records** | 67 |
| **Fields** | District, superintendent name/email, address, phone, fax, website |
| **Last Captured** | 2026-01-31 |
| **Status** | ✅ Loaded |
| **Approach That Worked** | fetch |
| **Anti-Bot Measures** | none |
| **Stable Selectors** | N/A (static HTML) |

### TEXAS
| Field | Value |
|-------|-------|
| **Source ID** | `TX-TEA-DIR-2026` |
| **Name** | Texas Education Agency - District Directory |
| **Tier** | T2 |
| **URL** | https://tea.texas.gov/texas-schools/general-information |
| **Format** | CSV |
| **Records** | 1,218 |
| **Fields** | District ID, name, superintendent, address, phone, website |
| **Last Captured** | 2026-02-01 |
| **Captured By** | wave1-direct-downloads agent |
| **Status** | ✅ Parsed, ready to load |
| **Approach That Worked** | fetch |
| **Anti-Bot Measures** | none |
| **Stable Selectors** | N/A (CSV download) |

### NEW YORK
| Field | Value |
|-------|-------|
| **Source ID** | `NY-NYSED-DIR-2026` |
| **Name** | NYSED Data Site - District List |
| **Tier** | T2 |
| **URL** | https://data.nysed.gov/lists.php?type=district |
| **Format** | JavaScript-rendered HTML |
| **Expected Records** | ~730 |
| **Scraper** | packages/api/src/scripts/scrapers/new-york.ts |
| **Status** | 🔧 Scraper built, needs execution |

### MASSACHUSETTS
| Field | Value |
|-------|-------|
| **Source ID** | `MA-DESE-DIR-2026` |
| **Name** | MA DESE School & District Profiles |
| **Tier** | T2 |
| **URL** | https://profiles.doe.mass.edu/search/search.aspx |
| **Format** | ASP.NET portal |
| **Expected Records** | ~400 |
| **Scraper** | packages/api/src/scripts/scrapers/massachusetts.ts |
| **Status** | 🔧 Scraper built, needs execution |

### NORTH CAROLINA
| Field | Value |
|-------|-------|
| **Source ID** | `NC-NCDPI-DIR-2026` |
| **Name** | NCDPI LEA Directory |
| **Tier** | T2 |
| **URL** | https://apps.schools.nc.gov/ords/f?p=145 |
| **Format** | Oracle APEX |
| **Expected Records** | ~115 |
| **Scraper** | packages/api/src/scripts/scrapers/north-carolina.ts |
| **Status** | 🔧 Scraper built, needs execution |

### GEORGIA
| Field | Value |
|-------|-------|
| **Source ID** | `GA-GOSA-DIR-2026` |
| **Name** | Governor's Office of Student Achievement |
| **Tier** | T2 |
| **URL** | https://gosa.georgia.gov/ |
| **Format** | CSV download |
| **Expected Records** | ~235 |
| **Scraper** | packages/api/src/scripts/scrapers/georgia.ts |
| **Status** | 🔧 Scraper built, needs execution |

### TENNESSEE
| Field | Value |
|-------|-------|
| **Source ID** | `TN-DOE-DIR-2026` |
| **Name** | Tennessee DOE LEA Directory |
| **Tier** | T2 |
| **URL** | https://www.tn.gov/education/districts/lea-directory.html |
| **Format** | HTML/Download |
| **Expected Records** | ~147 |
| **Status** | 📋 Data located, needs scraper |

### NEW JERSEY
| Field | Value |
|-------|-------|
| **Source ID** | `NJ-DOE-SPR-2026` |
| **Name** | NJ School Performance Reports |
| **Tier** | T2 |
| **URL** | https://www.nj.gov/education/spr/ |
| **Format** | Downloadable database |
| **Expected Records** | ~600 |
| **Status** | 📋 Data located, needs scraper |

### VERMONT
| Field | Value |
|-------|-------|
| **Source ID** | `VT-AOE-DIR-2026` |
| **Name** | Vermont AOE Staff Directory |
| **Tier** | T2 |
| **URL** | https://education.vermont.gov/ |
| **Format** | HTML |
| **Expected Records** | ~60 |
| **Status** | 📋 Data located, needs scraper |

### COLORADO
| Field | Value |
|-------|-------|
| **Source ID** | `CO-CDE-DIR-2026` |
| **Name** | Colorado CDE SchoolView |
| **Tier** | T2 |
| **URL** | https://www.cde.state.co.us/schoolview |
| **Format** | XLSX download |
| **Expected Records** | ~180 |
| **Status** | 📥 File downloaded, needs parsing |

### MONTANA
| Field | Value |
|-------|-------|
| **Source ID** | `MT-OPI-DIR-2026` |
| **Name** | Montana OPI Schools Directory |
| **Tier** | T2 |
| **URL** | https://opi.mt.gov/Leadership/Management-Operations/Montana-Schools-Directory |
| **Format** | HTML + Excel exports |
| **Expected Records** | ~400+ |
| **Status** | 📋 Portal found, needs scraper |

---

## States Requiring Browser Automation (Tier 2)

**Note:** Following unified scraping strategy, all states should try `web_fetch` first before falling back to browser automation.

| State | Source ID | URL | Expected | Status | Anti-Bot | Approach |
|-------|-----------|-----|----------|--------|----------|----------|
| Pennsylvania | `PA-PDE-DIR-2026` | futurereadypa.org | ~500 | Strategy documented | javascript | browser (try fetch first) |
| Rhode Island | `RI-RIDE-DIR-2026` | reportcard.ride.ri.gov | ~45 | Strategy documented | javascript | browser (try fetch first) |
| Connecticut | `CT-SDE-DIR-2026` | public-edsight.ct.gov | ~175 | Strategy documented | javascript | browser (try fetch first) |
| Delaware | `DE-DOE-DIR-2026` | reportcard.doe.k12.de.us | ~19 | Strategy documented | javascript | browser (try fetch first) |
| Maryland | `MD-MSDE-DIR-2026` | reportcard.msde.maryland.gov | ~24 | Strategy documented | javascript | browser (try fetch first) |
| DC | `DC-OSSE-DIR-2026` | schoolreportcard.dc.gov | ~65 | API discovered | none | api (discovered) |
| Utah | `UT-USBE-DIR-2026` | datagateway.schools.utah.gov | ~150 | Portal found | javascript | browser (try fetch first) |
| Washington | `WA-OSPI-DIR-2026` | reportcard.ospi.k12.wa.us | ~295 | Portal found | javascript | browser (try fetch first) |
| Oregon | `OR-ODE-DIR-2026` | oregon.gov/ode/reports-and-data | ~200 | Portal found | javascript | browser (try fetch first) |
| Oklahoma | `OK-SDE-DIR-2026` | oklaschools.com | ~540 | Portal found | javascript | browser (try fetch first) |
| Arkansas | `AR-ADE-DIR-2026` | myschoolinfo.arkansas.gov | ~260 | Portal found | javascript | browser (try fetch first) |
| Iowa | `IA-DOE-DIR-2026` | educate.iowa.gov | ~330 | GIS + directory | javascript | browser (try fetch first) |
| Michigan | `MI-MDE-DIR-2026` | michigan.gov/mde | ~540 | EEM portal found | javascript | browser (try fetch first) |
| Minnesota | `MN-MDE-DIR-2026` | education.mn.gov | ~330 | MDE-ORG found | javascript | browser (try fetch first) |
| Wisconsin | `WI-DPI-DIR-2026` | dpi.wi.gov | ~420 | WISEdash found | javascript | browser (try fetch first) |
| Indiana | `IN-DOE-DIR-2026` | in.gov/doe | ~290 | GPS portal found | javascript | browser (try fetch first) |
| Illinois | `IL-ISBE-DIR-2026` | isbe.net | ~850 | JS tool, needs API | javascript | browser (try fetch first) |
| Missouri | `MO-DESE-DIR-2026` | dese.mo.gov | ~520 | Login wall | javascript | browser (try fetch first) |
| Kentucky | `KY-KDE-DIR-2026` | education.ky.gov | ~170 | Timeout issues | javascript | browser (try fetch first) |
| Alabama | `AL-ALSDE-DIR-2026` | alsde.edu | ~140 | SSL errors | none | browser (SSL workaround) |
| Maine | `ME-DOE-DIR-2026` | maine.gov/doe | ~230 | Auth required | javascript | browser (try fetch first) |
| West Virginia | `WV-DOE-DIR-2026` | zoomwv.k12.wv.us | ~55 | JS dashboard | javascript | browser (try fetch first) |

---

## States Requiring URL Discovery (Tier 2)

| State | DOE Site | Expected | Status |
|-------|----------|----------|--------|
| Georgia | gadoe.org | ~235 | URL found via GOSA |
| Louisiana | louisianabelieves.com | ~70 | URL changed |
| Mississippi | mdek12.org | ~150 | Directory not found |
| Nevada | doe.nv.gov | ~17 | Fragmented |
| Idaho | sde.idaho.gov | ~115 | Decentralized |
| Wyoming | edu.wyoming.gov | ~48 | Location unclear |
| New Mexico | webnew.ped.state.nm.us | ~90 | Site down |
| Nebraska | education.ne.gov | ~245 | Directory not found |
| North Dakota | nd.gov/dpi | ~180 | Directory not found |
| South Dakota | doe.sd.gov | ~150 | Directory not found |
| Kansas | ksde.org | ~290 | Timeout errors |
| Ohio | education.ohio.gov | ~610 | OREDS behind SSO |

---

## Alternative Sources (Tier 4)

### State Superintendent Associations
These are AASA affiliates and may have member directories.

| State | Association | URL | Status |
|-------|-------------|-----|--------|
| South Carolina | SCASA | scasa.org | Needs investigation |
| Arizona | AASA-AZ | azed.gov blocked | Needs investigation |
| New Hampshire | NHSAA | nhsaa.org | Needs investigation |
| Virginia | VASS | vassonline.org | Needs investigation |
| Alaska | AASA-AK | Unknown | Needs investigation |

---

## Fallback Sources (Tier 5)

### Wikipedia State Lists
Used ONLY for district existence, NEVER for contact info.

| State | Article | Records | Status |
|-------|---------|---------|--------|
| South Carolina | List of school districts in SC | ~81 | Captured |
| Arizona | List of school districts in AZ | ~240 | Captured |
| New Hampshire | List of school districts in NH | ~160 | Captured |
| Virginia | List of school divisions in VA | ~133 | Captured |
| Alaska | List of school districts in AK | ~54 | Captured |
| Hawaii | Hawaii DOE | 1 | Captured |

**Note:** Wikipedia data must be cross-referenced with NCES and enriched with T2 sources for contact info.

---

## Source Status Legend

| Icon | Meaning |
|------|---------|
| ✅ | Loaded to database |
| 📥 | File downloaded, needs parsing |
| 🔧 | Scraper built, needs execution |
| 📋 | Data located, needs scraper |
| 🔍 | Needs URL discovery |
| ⚠️ | Access issues (blocked/timeout) |
| ❌ | Not accessible |

---

## Adding New Sources

When adding a new source:

1. Assign a Source ID: `{STATE}-{AGENCY}-{TYPE}-{YEAR}`
2. Determine the Tier (T1-T5)
3. Document the URL, format, and expected record count
4. Create a data_imports record when loading
5. Update this registry

---

## Audit Requirements

Every import must:
1. Reference a Source ID from this registry
2. Create a `data_imports` record with:
   - source_url
   - file_name (if applicable)
   - record_count
   - checksum (SHA-256 of source file)
   - imported_at timestamp
   - imported_by (agent name)
