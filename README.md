# AASA District Intelligence Database

## READ THIS FIRST

This repository builds a comprehensive database of US public school districts with superintendent contact information for AASA (The School Superintendents Association).

**If you are Claude Code**: This repo has a `CLAUDE.md` file that will be auto-loaded at session start.

**If you are another AI agent**: Read `AGENT_INSTRUCTIONS.md` for prompts and rules.

---

## Project Overview

### The Mission

AASA needs to:
1. **Find districts** that are ready for their consulting services
2. **Contact superintendents** with personalized outreach
3. **Score districts** based on signals (Portrait of a Graduate, strategic planning, etc.)
4. **Support grant applications** by querying districts that meet criteria (e.g., >70% FRPL)

### Two Phases

| Phase | Goal | Status |
|-------|------|--------|
| **Phase 1** | Build complete district database with superintendent contacts | **IN PROGRESS** |
| **Phase 2** | Scrape/score districts on AASA keywords for sales prioritization | NOT STARTED |

**You are working on Phase 1.**

---

## Current State (as of Feb 1, 2026)

### Database
- **Location**: Supabase PostgreSQL
- **Total districts**: 19,640
- **Superintendent coverage**: 2,662 (13.6%)

### Coverage by State
| State | Districts | With Superintendent | Coverage |
|-------|-----------|---------------------|----------|
| TX | 1,260 | 1,216 | 96.5% |
| CA | 2,382 | 1,346 | 56.5% |
| FL | 84 | 66 | 78.6% |
| **47 other states** | **15,914** | **0** | **0%** |

### What's Loaded
- NCES baseline (19,640 districts)
- CCD enrichment data
- State registries: CA, TX, FL only

### What's NOT Loaded (but exists as CSV)
The following CSV files are in this repo but have NOT been imported to the database:
- `il_superintendents.csv` (851 records)
- `ny_superintendents.csv` (682 records)
- `oh_superintendents.csv` (607 records)
- `ga_superintendents.csv` (184 records)
- `nc_superintendents.csv` (100 records)

---

## Repository Structure

```
superintendent-data/
├── README.md                    # You are here
├── AGENT_INSTRUCTIONS.md        # Prompts for AI agents (START HERE)
├── .env.example                 # Database connection template
├── .gitignore
├── package.json                 # Node.js dependencies (pg installed)
│
├── planning-docs/               # AASA business context (from client)
│   ├── AASA Conversation Transcript.txt
│   ├── Keyword Taxonomy and Synonyms.pdf
│   └── Lead Scoring Approach.pdf
│
├── docs/                        # Technical documentation
│   ├── ARCHITECTURE.md          # Database schema & design
│   ├── SOURCES.md               # State-by-state data sources
│   ├── MATCHING.md              # District matching algorithm
│   ├── QUALITY.md               # Data quality tiers
│   └── archive/                 # Old docs (reference only)
│
├── scripts/                     # Runnable Node.js scripts
│   └── db-status.js             # Check database state
│
├── data/
│   ├── raw/                     # Original source files (immutable)
│   │   ├── nces/                # NCES/CCD federal data
│   │   └── states/              # State-specific downloads
│   └── processed/               # CSVs ready to load to database
│       ├── il_superintendents.csv  ← NOT YET IN DB
│       ├── ny_superintendents.csv  ← NOT YET IN DB
│       ├── oh_superintendents.csv  ← NOT YET IN DB
│       ├── ga_superintendents.csv  ← NOT YET IN DB
│       └── nc_superintendents.csv  ← NOT YET IN DB
│
└── notes/                       # Investigation notes
    └── state_doe_urls.txt       # Known state DoE data URLs
```

---

## Database Architecture

### Three-Layer Design

```
┌─────────────────────────────────────────────────────────────┐
│                     SOURCE LAYER                             │
│                  (Immutable, append-only)                    │
├───────────────────┬───────────────────┬─────────────────────┤
│    districts      │  ccd_staff_data   │ state_registry_     │
│  (NCES baseline)  │ (federal enrich)  │    districts        │
└─────────┬─────────┴─────────┬─────────┴──────────┬──────────┘
          │                   │                    │
          └───────────────────┼────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    MATCHING LAYER                            │
│            district_matches (links records)                  │
└─────────────────────────────┬───────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      VIEW LAYER                              │
│           national_registry (unified view)                   │
└─────────────────────────────────────────────────────────────┘
```

### Critical Rule

**NEVER modify source tables directly.**
- `districts` = NCES baseline (read-only after initial load)
- `state_registry_districts` = append-only (one insert per state import)
- All transformations happen through the `national_registry` view

---

## Quick Start

### 1. Set up environment
```bash
cp .env.example .env
# Edit .env with actual database password
npm install
```

### 2. Check database status
```bash
node scripts/db-status.js
```

### 3. Load a state's data
```bash
node scripts/load-state.js --state=IL --file=il_superintendents.csv
```

---

## For AI Agents

**Stop reading this file and go to `AGENT_INSTRUCTIONS.md`** for:
- Exact prompts to copy/paste
- Rules you must follow
- Task breakdowns
- Error handling

---

## Key Contacts

- **Christian Jackson** - Project owner
- **AASA Team** - Todd (grants/partnerships), Jeff (sales), Tammy (operations)

---

## Links

- **Database**: `postgresql://postgres:***@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres`
- **NCES Data**: https://nces.ed.gov/ccd/files.asp
