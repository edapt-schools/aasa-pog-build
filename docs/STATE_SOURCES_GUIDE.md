# State-by-State Superintendent Data Sources

**Created:** February 1, 2026
**Source:** Deep research analysis from RTF document
**Purpose:** Official reference for where to find superintendent data for all 50 states

---

## How to Use This Document

1. Find the state you need to collect
2. Check the source URL and format
3. Follow the recommended approach
4. Update the status after collection

---

## Collection Status Overview

| Status | Meaning | Count |
|--------|---------|-------|
| LOADED | In database with good coverage (>80%) | 5 |
| PARTIAL | In database but incomplete (<80%) | 7 |
| CSV_READY | CSV exists, not loaded | 5 |
| NOT_STARTED | No data collected | 33 |

---

## Alabama

- **Status:** NOT_STARTED
- **Source:** Alabama Department of Education - Directory of Alabama Public Schools
- **URL:** alabamaachieves.org (Alabama Achieves)
- **Format:** PDF download (updated annually)
- **Expected Districts:** ~140
- **Data Fields:** District name, superintendent name, address, phone, email
- **Notes:** 2025 directory includes city and county school districts

---

## Alaska

- **Status:** NOT_STARTED
- **Source:** Alaska Superintendents Association (via Alaska Council of School Administrators)
- **Format:** Contact sheet PDF/spreadsheet (2024-2025 edition)
- **Expected Districts:** 53
- **Data Fields:** District, superintendent name, email, phone, mailing address
- **Notes:** Includes borough, city, and REAA districts

---

## Arizona

- **Status:** NOT_STARTED
- **Source:** Arizona Department of Education - Education Directory
- **URL:** azed.gov "Contact Search"
- **Format:** Spreadsheet download available
- **Expected Districts:** ~240
- **Data Fields:** Organization, contact name (superintendent), phone, email, address
- **Notes:** Includes traditional districts AND charter networks

---

## Arkansas

- **Status:** NOT_STARTED
- **Source:** Arkansas Department of Education Data Center - Superintendent Contact List
- **URL:** ADE Data Center
- **Format:** **Multiple formats available:** Excel, PDF, CSV, XML
- **Expected Districts:** ~260
- **Data Fields:** District name, superintendent name, address, phone, email
- **Notes:** Excellent source - provides multiple download formats

---

## California

- **Status:** PARTIAL (51.2% coverage)
- **Loaded:** 1,070 records
- **NCES Expected:** 2,090 districts
- **Gap:** ~1,000 districts (likely charters)
- **Source:** California Department of Education School Directory
- **URL:** cde.ca.gov/schooldirectory/
- **Format:** Tab-delimited text file, "Public Districts (XLSX)"
- **Action Needed:** Re-collect to capture charter LEAs

---

## Colorado

- **Status:** NOT_STARTED
- **Source:** Colorado Department of Education - Education Directory
- **URL:** cde.state.co.us/schoolview
- **Format:** XLSX download
- **Expected Districts:** ~178
- **Data Fields:** District, superintendent, address, contact info
- **Notes:** Also includes BOCES. Check Colorado Association of School Executives.

---

## Connecticut

- **Status:** NOT_STARTED
- **Source:** CT Education Directory (Open Data Portal)
- **URL:** data.ct.gov
- **Format:** Dataset with superintendent name and email
- **Expected Districts:** ~175
- **Notes:** Also check CAPSS (CT Association of Public School Superintendents)

---

## Delaware

- **Status:** NOT_STARTED
- **Source:** University of Delaware Institute for Public Administration - Municipal Officials Directory
- **Format:** HTML page listing all districts
- **Expected Districts:** 19 (very small state)
- **Data Fields:** District, superintendent name, phone, email, website
- **Example:** "Delmar School District - Superintendent Charity Phillips - (302) 846-9544 - charity.phillips@delmar.k12.de.us"
- **Notes:** Quick win - only 19 districts!

---

## District of Columbia

- **Status:** CSV_READY (VERY INCOMPLETE)
- **CSV Records:** 1
- **NCES Expected:** 71 districts
- **Gap:** 70 missing (all charter LEAs!)
- **Source:** DC OSSE - School Report Card
- **URL:** schoolreportcard.dc.gov
- **Notes:** Current CSV only has DCPS. Need to re-collect including all charter school LEAs.
- **Action Needed:** API discovered - use it to get complete charter list

---

## Florida

- **Status:** PARTIAL (78.0% coverage)
- **Loaded:** 64 records
- **NCES Expected:** 82 districts
- **Source:** Florida DOE - Superintendents Directory
- **URL:** fldoe.org/accountability/data-sys/school-dis-data/superintendents.stml
- **Format:** HTML (static page)
- **Notes:** May be missing some charter LEAs

---

## Georgia

- **Status:** PARTIAL (60.0% coverage)
- **Loaded:** 150 records
- **NCES Expected:** 250 districts
- **Gap:** ~100 districts
- **Source:** Georgia School Superintendents Association (GSSA)
- **URL:** GSSA online directory
- **Format:** Web directory listing by name
- **Example:** "Alex Alvarez - Superintendent - Wheeler County - alex.alvarez@wheeler.k12.ga.us"
- **Action Needed:** Re-collect to capture missing districts

---

## Hawaii

- **Status:** NOT_STARTED
- **Source:** Hawaii Department of Education - Complex Area Directory
- **URL:** hawaiipublicschools.org
- **Expected Districts:** 1 (single statewide district)
- **Notes:** Hawaii has ONE district (the DOE itself). Complex Area Superintendents supervise clusters of schools.
- **Priority:** Quick win - just 1 district!

---

## Idaho

- **Status:** NOT_STARTED
- **Source:** Idaho State Department of Education - Education Directory
- **URL:** sde.idaho.gov
- **Format:** PDF or searchable "District and School Contacts" tool
- **Expected Districts:** ~115

---

## Illinois

- **Status:** LOADED (82.7% coverage)
- **Loaded:** 850 records
- **NCES Expected:** 1,028 districts
- **Source:** ISBE Directory of Educational Entities
- **Notes:** Good coverage. Also check Regional Offices of Education directories.

---

## Indiana

- **Status:** NOT_STARTED
- **Source:** Indiana Association of Public School Superintendents (IAPSS)
- **URL:** IAPSS Superintendent Directory (organized by regions)
- **Format:** Web directory
- **Expected Districts:** ~290
- **Notes:** May need IAPSS login for full details. Also try IDOE Compass portal.

---

## Iowa

- **Status:** NOT_STARTED
- **Source:** Iowa Department of Education - Educational Directory
- **URL:** Iowa Publications Online (State Library of Iowa)
- **Format:** PDF
- **Expected Districts:** ~330
- **Data Fields:** District, superintendent name, phone, address
- **Notes:** 2023-24 Iowa Educational Directory available

---

## Kansas

- **Status:** NOT_STARTED
- **Source:** Kansas State Department of Education (KSDE)
- **URL:** ksde.org
- **Format:** PDF - Kansas Educational Directory + Kansas Superintendent Pictorial Directory
- **Expected Districts:** ~286 USDs
- **Notes:** 2025-2026 Superintendent Directory available with photos

---

## Kentucky

- **Status:** NOT_STARTED
- **Source:** Kentucky Department of Education - Open House Portal
- **URL:** education.ky.gov (Open House → Superintendents Directory)
- **Format:** Web portal
- **Expected Districts:** ~171
- **Data Fields:** District, superintendent name, email, phone, address
- **Example:** "Jefferson County - Superintendent Marty Pollio"
- **WARNING:** Previous agent may have crashed on this state. Test carefully.

---

## Louisiana

- **Status:** NOT_STARTED
- **Source:** Louisiana Association of School Superintendents & Administrators (LASSA)
- **URL:** LASSA member districts directory
- **Format:** Website directory
- **Expected Districts:** ~70 (parishes + city districts)
- **Example:** "Assumption Parish - Dr. John Barthelemy - (985) 369-7251 - jbarthelemy@assumptionschools.com"
- **Notes:** Primary source since LA DOE doesn't publish single list

---

## Maine

- **Status:** NOT_STARTED
- **Source:** Maine DOE - NEO System
- **URL:** NEO portal (Superintendent Search by SAU)
- **Format:** Searchable by School Administrative Unit
- **Expected Districts:** ~230
- **Notes:** Also check Maine School Superintendents Association (MSSA)

---

## Maryland

- **Status:** LOADED (96.0% coverage)
- **Loaded:** 24 records
- **NCES Expected:** 25 districts
- **Source:** MSDE Local Superintendents List
- **Notes:** Excellent coverage. Only 24 county systems + Baltimore City.

---

## Massachusetts

- **Status:** NOT_STARTED
- **Source:** Massachusetts Association of School Superintendents (M.A.S.S.)
- **URL:** massupt.org - Superintendent Directory
- **Format:** Web directory
- **Expected Districts:** ~400
- **Example:** "Hanover Public Schools - Matthew A. Ferron"
- **Notes:** Also check MA DESE District Profiles

---

## Michigan

- **Status:** NOT_STARTED
- **Source:** Educational Entity Master (EEM) / MI School Data
- **URL:** michigan.gov/mde
- **Format:** Database query (no single download)
- **Expected Districts:** ~540
- **Notes:** Regional lists exist (e.g., TalentFirst West Michigan). MASA directory is members-only.

---

## Minnesota

- **Status:** NOT_STARTED
- **Source:** Minnesota Department of Education + MASA
- **URL:** education.mn.gov, Minnesota Association of School Administrators
- **Format:** Search tool / member directory
- **Expected Districts:** ~330

---

## Mississippi

- **Status:** LOADED (90.1% coverage)
- **Loaded:** 137 records
- **NCES Expected:** 152 districts
- **Source:** Mississippi DOE - District Directory
- **URL:** mdek12.org
- **Notes:** Good coverage. Directory is alphabetized and frequently updated.

---

## Missouri

- **Status:** NOT_STARTED
- **Source:** Missouri DESE - School Directory (MCDS Portal)
- **URL:** dese.mo.gov
- **Format:** Online searchable directory
- **Expected Districts:** ~520

---

## Montana

- **Status:** NOT_STARTED
- **Source:** Montana OPI - Schools Directory
- **URL:** opi.mt.gov
- **Format:** PDF directory
- **Expected Districts:** ~400+ (organized by county: elementary, high school, K-12)
- **Notes:** Also check School Administrators of Montana (SAM)

---

## Nebraska

- **Status:** NOT_STARTED
- **Source:** Nebraska Department of Education - Education Directory (NDE Portal)
- **URL:** education.ne.gov
- **Format:** Online directory
- **Expected Districts:** ~244
- **Notes:** Also check Nebraska Council of School Administrators (NCSA)

---

## Nevada

- **Status:** CSV_READY (INCOMPLETE)
- **CSV Records:** 17
- **NCES Expected:** 20 districts
- **Gap:** 3 districts
- **Source:** Nevada Association of School Superintendents (NASS) + NV DOE
- **Notes:** Only 17 county school districts + State Public Charter School Authority

---

## New Hampshire

- **Status:** NOT_STARTED
- **Source:** NH Department of Education - SAU Directory
- **URL:** education.nh.gov
- **Format:** Excel/searchable database
- **Expected Districts:** ~150 (organized by SAUs)
- **Notes:** Also check NHSAA

---

## New Jersey

- **Status:** PARTIAL (79.6% coverage)
- **Loaded:** 553 records
- **NCES Expected:** 695 districts
- **Gap:** ~140 districts
- **Source:** NJDOE District Search
- **Notes:** May need to re-collect charter LEAs

---

## New Mexico

- **Status:** NOT_STARTED
- **Source:** NM Public Education Department
- **URL:** webnew.ped.state.nm.us
- **Format:** Directory/handbook PDF
- **Expected Districts:** ~89
- **Notes:** Site has had issues. Also try NM School Superintendents Association.

---

## New York

- **Status:** PARTIAL (61.7% coverage)
- **Loaded:** 673 records
- **NCES Expected:** 1,090 districts
- **Gap:** ~400 districts
- **Source:** NYSED SEDREF database / NYSCOSS
- **Notes:** Missing ~400 districts. Re-collection needed.

---

## North Carolina

- **Status:** PARTIAL (28.4% coverage) - VERY INCOMPLETE
- **Loaded:** 100 records
- **NCES Expected:** 352 districts
- **Gap:** ~250 districts!
- **Source:** NCDPI Education Directory
- **URL:** NCDPI Agency/District lookup
- **Notes:** Severely incomplete. Only got 100 of 352 districts. Priority for re-collection.

---

## North Dakota

- **Status:** NOT_STARTED
- **Source:** ND Department of Public Instruction - School District Directory
- **URL:** nd.gov/dpi
- **Format:** Education Directory PDF/web
- **Expected Districts:** ~175
- **Notes:** Also check ND Council of Educational Leaders (NDCEL)

---

## Ohio

- **Status:** PARTIAL (58.1% coverage)
- **Loaded:** 607 records
- **NCES Expected:** 1,045 districts
- **Gap:** ~440 districts
- **Source:** Ohio Educational Directory System (OEDS)
- **Notes:** OEDS requires login for updates. Re-collection needed.

---

## Oklahoma

- **Status:** LOADED (92.7% coverage)
- **Loaded:** 536 records
- **NCES Expected:** 578 districts
- **Source:** Oklahoma SDE - Education Directory (EDDirectory)
- **Notes:** Good coverage.

---

## Oregon

- **Status:** NOT_STARTED
- **Source:** Oregon Department of Education - District/Schools Directory
- **URL:** oregon.gov/ode
- **Format:** Directory/PDF
- **Expected Districts:** ~197 + ESDs
- **Notes:** Also check OSBA, COSA

---

## Pennsylvania

- **Status:** NOT_STARTED
- **Source:** Pennsylvania DOE - EdNA (Education Names & Addresses)
- **URL:** EdNA database
- **Format:** Searchable database
- **Expected Districts:** ~500
- **Notes:** Also publishes PDF directory. PASA tracks changes.

---

## Rhode Island

- **Status:** CSV_READY (INCOMPLETE)
- **CSV Records:** 36
- **NCES Expected:** 67 districts
- **Gap:** 31 districts (likely charters)
- **Source:** Rhode Island DOE - LEA List
- **URL:** ride.ri.gov
- **Notes:** Also check RISSA

---

## South Carolina

- **Status:** NOT_STARTED
- **Source:** SC Department of Education - School Directory
- **URL:** ed.sc.gov
- **Format:** PDF (annual)
- **Expected Districts:** ~79
- **Notes:** Also check online District Contacts page

---

## South Dakota

- **Status:** CSV_READY (INCOMPLETE)
- **CSV Records:** 147
- **NCES Expected:** 165 districts
- **Gap:** 18 districts
- **Source:** SD Department of Education
- **URL:** doe.sd.gov
- **Notes:** Also check ASBSD, SASD

---

## Tennessee

- **Status:** NOT_STARTED
- **Source:** Tennessee DOE - District Directory
- **URL:** tn.gov/education/districts
- **Format:** HTML/download
- **Expected Districts:** ~147
- **Notes:** Also check TOSS (Tennessee Organization of School Superintendents)

---

## Texas

- **Status:** LOADED (99.1% coverage)
- **Loaded:** 1,218 records
- **NCES Expected:** 1,229 districts
- **Source:** AskTED (Texas Education Agency)
- **Notes:** Excellent coverage. AskTED is primary source.

---

## Utah

- **Status:** NOT_STARTED
- **Source:** Utah State Board of Education - Directory
- **URL:** schools.utah.gov
- **Format:** Web directory
- **Expected Districts:** ~41 districts + 100+ charters
- **Notes:** Also check Utah School Superintendents Association

---

## Vermont

- **Status:** NOT_STARTED
- **Source:** Vermont Agency of Education - Supervisory Union/District Directory
- **URL:** education.vermont.gov
- **Format:** PDF/webpage
- **Expected Districts:** ~50 (organized by SU/SD)
- **Notes:** Also check Vermont Superintendents Association (VSA). Quick win - small state.

---

## Virginia

- **Status:** NOT_STARTED
- **Source:** Virginia DOE - Division Superintendents
- **URL:** doe.virginia.gov
- **Format:** Website list
- **Expected Districts:** ~132
- **Notes:** Also check VASS (Virginia Association of School Superintendents)

---

## Washington

- **Status:** NOT_STARTED
- **Source:** OSPI - Washington School Directory
- **URL:** ospi.k12.wa.us (EDS system)
- **Format:** Directory/downloadable
- **Expected Districts:** ~295
- **Notes:** WASA publishes annual directory book

---

## West Virginia

- **Status:** NOT_STARTED
- **Source:** WV Department of Education - County Superintendents
- **URL:** wvde.us
- **Format:** Single webpage listing all 55 counties
- **Expected Districts:** 55
- **Notes:** Quick win - all 55 on one page!

---

## Wisconsin

- **Status:** NOT_STARTED
- **Source:** Wisconsin DPI - School Directory (WISEdash)
- **URL:** dpi.wi.gov
- **Format:** Searchable directory
- **Expected Districts:** ~421
- **Notes:** Title is "District Administrator" not Superintendent. Also check WASDA.

---

## Wyoming

- **Status:** CSV_READY (INCOMPLETE)
- **CSV Records:** 48
- **NCES Expected:** 61 districts
- **Gap:** 13 districts
- **Source:** Wyoming Department of Education
- **URL:** edu.wyoming.gov
- **Format:** Education Directory

---

## Priority Collection Order

### Tier 1: Quick Wins (Very Small States)
1. **HI** - 1 district
2. **DE** - 19 districts
3. **WV** - 55 districts (single page)
4. **VT** - ~50 SUs

### Tier 2: Re-collect Incomplete States
5. **NC** - Only 28% coverage, need ~250 more
6. **CA** - Only 51% coverage, need ~1,000 more
7. **NY** - Only 62% coverage, need ~400 more
8. **OH** - Only 58% coverage, need ~440 more
9. **DC** - Only 1 of 71 districts!

### Tier 3: States with Good Sources
10. **AR** - Multiple download formats available
11. **LA** - LASSA directory (~70)
12. **SC** - SCDE PDF (~79)
13. **NM** - PED directory (~89)
14. **AL** - Alabama Achieves PDF (~140)

### Tier 4: Medium States
15. **TN** - ~147
16. **NH** - ~150
17. **KY** - ~171 (test carefully!)
18. **CO** - ~178 XLSX
19. **CT** - ~175 open data
20. **ND** - ~175

### Tier 5: Large States
21. **OR** - ~197
22. **AZ** - ~240
23. **NE** - ~244
24. **AR** - ~260
25. **IN** - ~290
26. **WA** - ~295
27. **MN** - ~330
28. **IA** - ~330
29. **MA** - ~400
30. **MT** - ~400
31. **WI** - ~421
32. **PA** - ~500
33. **MO** - ~520
34. **MI** - ~540

---

*Last Updated: February 1, 2026*
*Update this document after each successful collection*
