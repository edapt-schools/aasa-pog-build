# Document Crawling Workflow

This document describes the complete pipeline for crawling district websites, recovering failures, and generating embeddings for semantic search.

## Quick Start

```bash
# Full pipeline for new districts (with parallel crawling)
node scripts/pilot-document-crawler.js --limit 200 --concurrency 5
node scripts/retry-failed-crawls.js --ssl-bypass
node scripts/verify-urls.js --failed-only --fix
node scripts/reprocess-pdfs.js
node scripts/compute-keyword-scores.js
node scripts/generate-embeddings.js --batch-size 100

# Continue crawling (skip already-processed districts)
node scripts/pilot-document-crawler.js --limit 500 --concurrency 10 --skip-existing
```

## Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    DOCUMENT CRAWLING PIPELINE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. INITIAL CRAWL                                               │
│     pilot-document-crawler.js                                   │
│     └── Crawls homepages, follows links, extracts PDFs          │
│         Expected success: ~90%                                  │
│                                                                  │
│  2. RETRY TRANSIENT FAILURES                                    │
│     retry-failed-crawls.js --ssl-bypass                         │
│     └── Exponential backoff, alternative URLs, SSL bypass       │
│         Recovers: ~60-80% of failures                           │
│                                                                  │
│  3. FIX DATA QUALITY ISSUES                                     │
│     verify-urls.js --failed-only --fix                          │
│     └── DNS checks, suggests correct URLs, updates database     │
│         Recovers: ~100% of DNS failures with standard patterns  │
│                                                                  │
│  4. REPROCESS PDFs (if needed)                                  │
│     reprocess-pdfs.js                                           │
│     └── Re-extracts text from PDFs that failed extraction       │
│                                                                  │
│  5. COMPUTE KEYWORD SCORES                                      │
│     compute-keyword-scores.js                                   │
│     └── Applies taxonomy, assigns outreach tiers                │
│                                                                  │
│  6. GENERATE EMBEDDINGS                                         │
│     generate-embeddings.js                                      │
│     └── Creates vector embeddings for semantic search           │
│                                                                  │
│  7. ANALYZE RESULTS                                             │
│     analyze-crawl-results.js                                    │
│     └── Summary stats, failure patterns, keyword detection      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Scripts Reference

### 1. pilot-document-crawler.js
**Purpose:** Initial crawl of district websites (with parallel processing)

```bash
node scripts/pilot-document-crawler.js [options]

Options:
  --limit N         Number of districts to crawl (default: 200)
  --concurrency N   Districts to crawl in parallel (default: 5)
  --state XX        Filter by state
  --skip-existing   Skip districts already in district_documents
```

**What it does:**
- Crawls multiple districts **in parallel** (configurable concurrency)
- Fetches homepage for each district
- Extracts all links, prioritizes by keywords
- Downloads and extracts PDFs (up to 10 per district)
- Follows internal links (up to 10 pages, 1 level deep)
- Uses connection pooling for database writes
- Logs every request to `document_crawl_log`
- Stores documents in `district_documents`

**Performance:** 200 districts in ~20 min with `--concurrency 5`

### 2. retry-failed-crawls.js
**Purpose:** Recover from transient network failures

```bash
node scripts/retry-failed-crawls.js [options]

Options:
  --ssl-bypass     Allow invalid SSL certificates
  --test           Test mode (don't save to database)
```

**Recovery techniques:**
- Exponential backoff (3 retries: 1s, 3s, 5s delays)
- Alternative URL detection (www/non-www, http/https)
- SSL certificate bypass
- User agent rotation

### 3. verify-urls.js
**Purpose:** Find and fix bad URLs in superintendent_directory

```bash
node scripts/verify-urls.js [options]

Options:
  --failed-only    Only check URLs that failed in crawl
  --state XX       Filter by state
  --limit N        Limit number to check
  --fix            Apply suggested corrections to database
```

**What it does:**
- DNS resolution check
- HTTP connectivity check
- Generates alternative URL patterns (e.g., `{district}.k12.{state}.us`)
- Updates superintendent_directory with corrected URLs

### 4. reprocess-pdfs.js
**Purpose:** Re-extract text from PDFs that failed extraction

```bash
node scripts/reprocess-pdfs.js
```

**When to use:** After fixing pdf-parse library issues or when PDFs were fetched but not extracted.

### 5. compute-keyword-scores.js
**Purpose:** Apply keyword taxonomy and assign outreach tiers

```bash
node scripts/compute-keyword-scores.js
```

**Taxonomy categories:**
- Readiness (Portrait of Graduate, Strategic Plan)
- Alignment (Educator competencies, frameworks)
- Activation (Capstone, Cornerstone, Performance tasks)
- Branding (Storytelling, messaging)

**Output:** Updates `district_keyword_scores` table with scores and tiers.

### 6. generate-embeddings.js
**Purpose:** Create vector embeddings for semantic search (with batch processing)

```bash
node scripts/generate-embeddings.js [options]

Options:
  --limit N         Process only N documents
  --category CAT    Only process specific category
  --batch-size N    Chunks per API call (default: 100)
```

**Features:**
- **Batch processing**: Embeds up to 100 chunks per API call (vs 1 at a time)
- Automatic fallback to individual calls on batch errors
- Progress tracking and error recovery

**Requirements:**
- `OPENAI_API_KEY` in `.env` file
- `npm install openai` if not already installed

### 7. search-documents.js
**Purpose:** Semantic search over document embeddings

```bash
node scripts/search-documents.js "query" [options]

Options:
  --limit N      Number of results (default: 10)
  --state XX     Filter by state
  --verbose      Show full context snippets
```

### 8. analyze-crawl-results.js
**Purpose:** Summarize crawl statistics and patterns

```bash
node scripts/analyze-crawl-results.js
```

**Output:** Success rates, error categories, keyword detection summary.

## Performance Tuning

### Concurrency Settings

The crawler now supports **parallel processing** for dramatically faster crawls:

| Flag | Default | Description |
|------|---------|-------------|
| `--concurrency N` | 5 | Number of districts to crawl in parallel |
| `--skip-existing` | false | Skip districts already in district_documents |

### Recommended Settings by Scale

| Districts | Concurrency | Estimated Time | Command |
|-----------|-------------|----------------|---------|
| 10 (test) | 5 | ~1 min | `--limit 10 --concurrency 5` |
| 50 (quick) | 5 | ~5 min | `--limit 50 --concurrency 5` |
| 200 (pilot) | 5 | ~20 min | `--limit 200 --concurrency 5` |
| 500+ | 10 | ~25 min | `--limit 500 --concurrency 10` |
| 1000+ | 10 | ~50 min | `--limit 1000 --concurrency 10` |

**Note:** Higher concurrency (>10) may trigger rate limiting on target sites.

### Embedding Batch Processing

The embedding script now uses **batch API calls** (100 chunks per call):

```bash
node scripts/generate-embeddings.js --batch-size 100  # Default
```

### Database Connection Limits
- Default Supabase: 60 connections
- Crawler pool size: 10 connections
- **Don't run crawler + embeddings simultaneously** - can cause connection exhaustion

### Recommended Workflow for Large Batches

1. **Start with pilot** (50-100 districts)
   - Identify common failure patterns
   - Tune retry parameters

2. **Run recovery scripts** before expanding
   - Ensure high success rate on pilot

3. **Scale incrementally**
   - 200 → 500 → 1000 → all

4. **Monitor database connections**
   - Don't run crawler + embeddings in parallel
   - Can cause connection exhaustion

### Error Categories and Solutions

| Error Type | Example | Solution |
|------------|---------|----------|
| DNS failure | `ENOTFOUND` | `verify-urls.js --fix` |
| SSL error | `unable to verify certificate` | `--ssl-bypass` flag |
| Connection reset | `ECONNRESET` | Retry script handles this |
| Timeout | Request timeout | Retry script handles this |
| 403 Forbidden | Access denied | May need Puppeteer (JS rendering) |
| 404 Not Found | Page missing | Data quality issue or site changed |

## Database Tables

| Table | Purpose |
|-------|---------|
| `superintendent_directory` | Source of district URLs |
| `district_documents` | Extracted document content |
| `document_crawl_log` | Every crawl attempt (success/failure) |
| `district_keyword_scores` | Taxonomy scores and tiers |
| `document_embeddings` | Vector embeddings for search |

## Environment Setup

```bash
# Install dependencies
npm install pg pdf-parse openai dotenv

# Create .env file
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

## Troubleshooting

### "OPENAI_API_KEY not set"
Create `.env` file in project root with:
```
OPENAI_API_KEY=sk-your-key-here
```

### "Connection terminated unexpectedly"
Don't run multiple scripts simultaneously. Run sequentially:
```bash
node scripts/pilot-document-crawler.js && node scripts/generate-embeddings.js
```

### "Token limit exceeded" during embedding
The chunking logic in `generate-embeddings.js` should handle this. If it persists, reduce `MAX_CHARS_PER_CHUNK` in the script config.

### PDF extraction returns empty text
1. Check pdf-parse version: `npm list pdf-parse` (should be 1.1.1)
2. Run `node scripts/reprocess-pdfs.js` to re-extract

---

*Last updated: February 2026*
