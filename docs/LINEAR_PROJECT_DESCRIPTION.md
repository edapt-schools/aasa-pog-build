# AASA District Intelligence Platform - Project Description

**Copy this content into your Linear project page**

---

# Strategic Context

This platform is being built to **secure a nationwide partnership with AASA** (The School Superintendents Association) for Edapt's expansion into the K-12 market. AASA represents 19,500+ US school districts and their superintendents, making this partnership critical for national market penetration.

## Why This Matters

AASA is the gateway to the entire US K-12 market. This platform demonstrates Edapt's technical capability and product-market fit by solving AASA's three biggest challenges:

1. **Event Preparation** - Jeff (Sales) needs to quickly identify and prioritize 1,600+ superintendents for conferences
2. **Grant Building** - Todd (Grants) needs to find districts that match complex grant qualifications
3. **Strategic Intelligence** - Tammy (Leadership) needs regional insights and trending topics for decision-making

## Business Opportunity

- **Market Size**: 19,500+ US public school districts
- **Current Coverage**: 33.5% superintendent contact coverage (6,619 districts)
- **Target Coverage**: 90%+ for partnership viability
- **Revenue Potential**: Nationwide AASA partnership unlocks access to entire K-12 market
- **Key Users**: AASA sales team (Jeff), grants team (Todd), and leadership (Tammy)

## Product Vision

A **three-mode intelligence platform** that transforms how AASA engages with districts:

### Mode 1: Discovery (Jeff - Sales) 🎯
**"I'm prepping for a conference with 1,600 superintendents - show me who to prioritize"**

- Smart filtering by state, enrollment, keyword scores, and outreach tier
- District lists ("Summer Conference 2026", "Texas Follow-ups")
- 3-10-20 pipeline status tracking (Initial Contact, Follow-up, Pre-Close)
- Bulk actions and CSV export
- Saved filter presets for repeated searches

**Use Case**: Jeff has 3 weeks to prep for AASA's National Conference. He filters for "Tier 1" districts in "Texas, California, Florida" with ">50K enrollment" and creates a list. He moves 23 districts to "Initial Contact (3 days)" and exports their info for outreach.

### Mode 2: Grant Builder (Todd - Grants) 💰
**"Find me districts with >70% FRL doing 'Measure What Matters' for an ESSA grant"**

- Semantic search with natural language queries
- Evidence viewer with highlighted document snippets
- Multi-criteria filtering with weighted scoring
- Consortium/cohort builder for grant proposals
- PDF export with evidence citations

**Use Case**: Todd searches "high poverty districts implementing competency-based education with strategic plans". The system returns 47 districts with evidence scores, showing document excerpts proving each qualification. He selects 12 districts, creates a cohort, and exports a grant proposal PDF with all evidence citations.

### Mode 3: Insights (Tammy - Leadership) 📊
**"What's trending in education right now? Which states are leading?"**

- Regional dashboard with state-level aggregation
- Interactive US map colored by metrics
- Trending topics detection ("Portrait of Graduate" +67% mentions)
- Automated state reports (weekly/monthly)
- Executive summary auto-generation with GPT-4

**Use Case**: Tammy opens the dashboard Monday morning. It shows "competency-based education" is trending +43% this month, with California and Colorado leading adoption. She clicks California and sees 89 districts with recent strategic plans. The system auto-generates a 2-page report she forwards to the board.

## Technical Foundation

### Data Layer
- **PostgreSQL** on Supabase with 19,595+ districts
- **1,500+ districts crawled** with 15,000+ documents indexed
- **Keyword taxonomy scoring** across 4 categories:
  - Readiness (Portrait of Graduate, Strategic Plan)
  - Alignment (Educator competencies, frameworks)
  - Activation (Capstone, Cornerstone, Performance tasks)
  - Branding (Storytelling, messaging)

### Search & Intelligence
- **Semantic search** with OpenAI `text-embedding-ada-002` + pgvector
- **RAG pipeline** for district-specific chat (retrieve docs → GPT-4 response)
- **Parallel web crawling** (10 concurrent districts, 90%+ success rate)
- **Batch embeddings** (100 chunks per API call for efficiency)

### Tech Stack
- **Frontend**: Next.js 14 (App Router), shadcn/ui, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth), API routes
- **AI**: OpenAI API (embeddings + GPT-4), Vercel AI SDK (streaming)
- **Design**: Light blue (#E6F3FF) to purple (#F0E6FF) gradient

## Timeline & Scope

**16 weeks (76 days) | 262 story points | 6 phases**

### Phase 1: Foundation (3 weeks, 36 points)
Core infrastructure, authentication, database setup, API routes

### Phase 2: Mode 1 - Discovery (3 weeks, 38 points)
Jeff's sales interface with filtering, lists, and pipeline tracking

### Phase 3: Mode 2 - Grant Builder (3 weeks, 45 points)
Todd's semantic search with evidence viewer and cohort builder

### Phase 4: Mode 3 - Insights (2 weeks, 40 points)
Tammy's dashboard with trending topics and automated reports

### Phase 5: AI Features (3 weeks, 48 points)
RAG-powered chat, proactive suggestions, natural language queries

### Phase 6: Polish & Launch (2 weeks, 55 points)
Performance optimization, testing, deployment, UAT

## Success Metrics

### Product Metrics
1. ✅ Platform completes UAT with Jeff, Todd, and Tammy
2. ✅ 90%+ district coverage achieved (currently 33.5%)
3. ✅ Semantic search returns relevant results with <2s latency
4. ✅ All 3 modes functional and battle-tested

### Business Metrics
1. 🎯 **AASA partnership secured** for nationwide rollout
2. 🎯 Platform adopted by AASA team (10+ active users)
3. 🎯 Demonstrates Edapt's K-12 product-market fit
4. 🎯 Unlocks access to 19,500+ district market

## Phase Status

- **Milestones**: 6 created (Phase 1-6)
- **Issues**: 54 created (BUS-9 through BUS-62)
- **Status**: All issues in Backlog, ready for development
- **Team**: Business Development (BUS)

## Key Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **District data coverage <90%** | AASA partnership blocked | Aggressive state-by-state collection, 10K overnight crawls |
| **Semantic search accuracy low** | Todd can't build grant cohorts | Keyword + semantic hybrid, human review loop |
| **Performance issues at scale** | Poor UX with 19K districts | Caching, pagination, pgvector HNSW indexes |
| **UAT reveals major gaps** | Launch delayed | Weekly check-ins with Jeff/Todd/Tammy during build |

## What's NOT Included (Future v2)

- ❌ **Auto-refresh from state registries** - Documented for Phase 2, not blocking launch
- ❌ **Mobile app** - Desktop web only for v1
- ❌ **Public API** - Internal use only initially
- ❌ **Multi-tenancy** - AASA-only for v1

## Next Steps

1. ✅ Linear project created (54 issues across 6 phases)
2. ✅ All issues moved from Triage to Backlog
3. 🔄 **Begin Phase 1** - Foundation work (Week 1-3)
4. 🔄 **Weekly sync with stakeholders** - Jeff, Todd, Tammy feedback loop
5. 🔄 **Track overnight crawl progress** - Currently 1,500/19,500 districts

---

**Project Lead**: [Your Name]
**Team**: Business Development
**Start Date**: [Your Start Date]
**Target Launch**: [Your Target Date]

🔗 **View in Linear**: https://linear.app/team/BUS/projects
