# AASA Platform UX Redesign Specification

## User Stories (From Stakeholder Transcript)

### Jeff (Sales Director) -- Lead Intelligence

**JS-1: Event Prep**
"I've got a list of all the people attending NCE. What I don't know is do they have a portrait of a graduate? I don't know what their interests are."
- Given I have a CSV of superintendent names attending an event
- When I upload it to the platform
- Then I see each matched district with tier, keyword scores, and strategic plan status
- So I can prioritize who to meet at the conference

**JS-2: Pipeline Building**
"Outside of an event, I need to build up a pipeline of opportunities and I want to make sure I'm talking to the right people."
- Given I want to identify the next best leads
- When I ask "next hottest uncontacted leads"
- Then I see a ranked table of districts sorted by score with superintendent contact info
- So I can begin outreach immediately with one click

**JS-3: 3-10-20 Execution**
"I tend to work a sales hot list as 3-10-20. What are the 3 you're working on that are most hot? What are the next 10? What are the next 20?"
- Given I have a ranked list of leads
- When I drag or assign districts to Hot/Warm/Cold buckets
- Then I can track my pipeline visually and export for follow-up

### Todd (Grants Director) -- Grant Pursuit

**TG-1: Grant Criteria Search**
"I would want to look for things like application demonstration, evidence of learning, rubrics, things like that to see which districts are doing portrait of a graduate."
- Given I have an RFP with specific qualification criteria
- When I type or upload those criteria
- Then I see matching districts with evidence excerpts proving qualification
- So I can build a defensible consortium

**TG-2: Demographic Filtering**
"Greater than 70% free and reduced lunch, greater than 60% minority, whatever their criteria may be."
- Given a grant requires specific demographic thresholds
- When I set FRPL >= 70% and Minority >= 60%
- Then only qualifying districts appear with their NCES-verified data
- So I can cite defensible sources in the application

**TG-3: Cohort Export**
"You usually have to have letters of support from those districts and you have to use those districts for the qualification for your case statement."
- Given I've selected qualifying districts
- When I export the cohort
- Then I get a CSV/PDF with district profiles, evidence citations, and demographic data
- So I can include it directly in the grant proposal

### Tammy (Leadership) -- Strategic Intelligence

**TL-1: Hands-Off Operations**
"In a dream scenario, I never touch it."
- Given the platform is operational
- When I open the dashboard on Monday morning
- Then I see what changed nationally without having to search or filter
- So I can forward actionable intelligence to the board

**TL-2: Regional Analysis**
"If that could be aggregated so you could do an analysis of a region or a state."
- Given I'm looking at the national map
- When I click a state
- Then I see its districts, trends, and top opportunities
- So I can brief Todd or Jeff on where to focus

---

## Current UX Problems (Audit Findings)

1. **Double layout**: Pages render their own headers inside AppLayout, producing two stacked headers
2. **Card grid where table needed**: Discovery shows 19,595 districts as cards -- impossible to scan
3. **Sidebar never collapses**: No mobile/responsive behavior on AppLayout sidebar
4. **No debounce**: Every keystroke fires API calls
5. **CommandCenter is a monolith**: 555 lines handling 12 responsibilities
6. **Hard-coded colors**: Many components bypass the design token system
7. **No toast system**: User feedback goes to console.log
8. **EmptyState icon bug**: Passing strings where ReactNode is expected
9. **Inconsistent typography**: Custom heading classes exist but rarely used
10. **Hardcoded stats**: Sidebar shows stale counts

---

## Design System Alignment

### Brand Colors (from Edapt design system)

| Role | Light | Dark | Token |
|------|-------|------|-------|
| Background | #FFFFFF | #0C0E26 | --background |
| Foreground | #0C0E26 | #FFFFFF | --foreground |
| Accent | #6571E5 | #6571E5 | --accent (Cornflower Blue) |
| Secondary accent | #39B9B7 | #39B9B7 | Turquoise |
| Success | #A9E5BB | #A9E5BB | Mint |
| Card | #FFFFFF | #131A36 | --card |
| Border | #EAEAEA | #222C52 | --border |
| Muted text | #1B2344 | #EAEAEA | --muted-foreground |

### Font
- Target: TT Hoves Pro (self-hosted, already in edaptation-home)
- Fallback: system-ui sans-serif stack

### Spacing and Radius
- Page padding: 24px (p-6)
- Card padding: 16px (p-4)
- Border radius: 10px (--radius)
- Section gaps: 24px (gap-6)

---

## Screen Redesign Plan

### Screen 1: AI Command Center (Default Home)

**Layout: Full-width, no sidebar distraction**

```
+------------------------------------------------------------------+
| [Edapt Logo]  AASA District Intelligence    [christian@] [SignOut]|
+------------------------------------------------------------------+
|                                                                    |
|  [Nav pills: Command Center | Pipeline | Grants | Insights]       |
|                                                                    |
|  +--------------------------------------------------------------+ |
|  |                                                                | |
|  |     What would you like to know?                               | |
|  |                                                                | |
|  |  +----------------------------------------------------------+ | |
|  |  | Ask for leads, upload a grant RFP, or speak...            | | |
|  |  |                                                          | | |
|  |  |                                    [Attach] [Mic] [Send] | | |
|  |  +----------------------------------------------------------+ | |
|  |                                                                | |
|  |  Suggested:                                                    | |
|  |  [Next hottest uncontacted in TX]                              | |
|  |  [Find FRPL >70% districts with PoG evidence]                 | |
|  |  [Weekly strategic briefing]                                   | |
|  |  [Upload event attendee list]                                  | |
|  |                                                                | |
|  +--------------------------------------------------------------+ |
|                                                                    |
|  +--- Recent Activity -------------------------------------------+ |
|  | You searched "portrait of a graduate" - 47 results   2h ago   | |
|  | Exported TX Tier 1 cohort (23 districts)             yesterday| |
|  +--------------------------------------------------------------+ |
|                                                                    |
+------------------------------------------------------------------+
```

**After a query executes:**

```
+------------------------------------------------------------------+
| [Nav pills]                                                       |
+------------------------------------------------------------------+
| AI Summary:                                                        |
| Found 23 uncontacted Tier 1 districts in TX. Top signals:         |
| Portrait of Graduate (12), Strategic Plan (19), Measure What      |
| Matters (8). Strongest: Houston ISD (score 8.7).                  |
+------------------------------------------------------------------+
| [Table View] [Card View]                    [Add to Cohort] [CSV] |
+------------------------------------------------------------------+
| # | District        | State | Supt         | Score | Tier | Why  |
|---|-----------------|-------|-------------- |-------|------|------|
| 1 | Houston ISD     | TX    | M. Millard   | 8.7   | T1   | [>]  |
| 2 | Dallas ISD      | TX    | S. Hinojosa  | 8.2   | T1   | [>]  |
| 3 | Fort Worth ISD  | TX    | A. Thomas    | 7.9   | T1   | [>]  |
|...|                 |       |              |       |      |      |
+------------------------------------------------------------------+
| Clicking [>] expands "Why this district" inline:                  |
|   Confidence: 87% (High)                                          |
|   Signals: readiness 8.4, activation 7.2, strategic_plan matched  |
|   Evidence: "...adopted portrait of a graduate framework in 2024" |
|   [Open site] [Email superintendent] [Mark contacted] [Add cohort]|
+------------------------------------------------------------------+
```

### Screen 2: Pipeline (Replaces Discovery)

**Layout: Full-width data table with filter bar**

```
+------------------------------------------------------------------+
| [Nav pills: Command Center | *Pipeline* | Grants | Insights]     |
+------------------------------------------------------------------+
| Filters: [State v] [Tier v] [Enrollment v] [Has Supt v] [Clear] |
| Saved views: [All Districts] [TX Tier 1] [NCE 2026 Targets] [+] |
+------------------------------------------------------------------+
| Showing 847 of 19,595 districts           [Columns v] [Export v] |
+------------------------------------------------------------------+
| [] | District         | ST | City       | Enroll | Supt        | |
|    |                  |    |            |        | Email       |T|
|----|------------------|----|------------|--------|-------------|--|
| [] | Houston ISD      | TX | Houston    | 196K   | M. Millard  |1|
|    |                  |    |            |        | m@hisd.org  | |
| [] | Dallas ISD       | TX | Dallas     | 145K   | S. Hinojosa |1|
|    |                  |    |            |        | s@disd.org  | |
|...|                   |    |            |        |             | |
+------------------------------------------------------------------+
| Selected: 3    [Add to List v] [Change Stage v] [Export v]       |
+------------------------------------------------------------------+
```

### Screen 3: Grants Search

**Layout: Search bar + split results/evidence**

```
+------------------------------------------------------------------+
| [Nav pills: Command Center | Pipeline | *Grants* | Insights]     |
+------------------------------------------------------------------+
| [Search: districts with competency-based education evidence]      |
| Filters: [State v] [FRPL v] [Minority v] [Doc Type v]    [Search]|
+------------------------------------------------------------------+
| Results (47)              |  Evidence Panel                       |
|---------------------------|---------------------------------------|
| Centreville PS (MI)       | Centreville Public Schools            |
|   Score: 94% | FRL: 78%  | Qualification: 94% (High)             |
|   "...competency-based.." |                                       |
|   [+ Cohort]              | DOCUMENT EVIDENCE                     |
|                           | Strategic Plan 2025-2028              |
| Springfield USD (IL)      | "Our district has adopted a           |
|   Score: 89% | FRL: 82%  |  **competency-based** approach..."     |
|   "...performance task.." |                                       |
|   [+ Cohort]              | KEYWORD SCORES                        |
|                           | Readiness  8.4 | Activation 7.9       |
|                           |                                       |
|                           | [Add to Cohort] [View in Pipeline]    |
+------------------------------------------------------------------+
| COHORT: "ESSA Spring 2026" (12 districts)     [Export PDF] [CSV] |
+------------------------------------------------------------------+
```

### Screen 4: Insights Dashboard

**Layout: KPI cards + map + trends + state table**

```
+------------------------------------------------------------------+
| [Nav pills: Command Center | Pipeline | Grants | *Insights*]     |
+------------------------------------------------------------------+
| +----------+ +----------+ +----------+ +----------+               |
| | 19,595   | | 88.5%    | | 1,036    | | 175,138  |              |
| | Districts| | Doc Cov  | | Tier 1   | | Documents|              |
| | tracked  | | +3.2%    | | hot leads| | indexed  |              |
| +----------+ +----------+ +----------+ +----------+               |
+------------------------------------------------------------------+
| State Map (choropleth)         | Tier Distribution (donut)        |
| [Coverage %] [Avg Score]      | T1: 1,036 (6%)                   |
| [Tier 1 Ct] [Districts]       | T2: 4,375 (25%)                  |
|                                | T3: 11,931 (69%)                 |
|   [Click state to drill down] |                                   |
+------------------------------------------------------------------+
| State Comparison (all 51, sortable)                               |
| State | Districts | Coverage | Avg Score | Tier 1 | [Handoff]    |
| TX    | 1,229     | 96.4%    | 7.2       | 89     | [Go]         |
| CA    | 2,368     | 55.8%    | 5.1       | 156    | [Go]         |
| ...   |           |          |           |        |              |
+------------------------------------------------------------------+
```

---

## Implementation Priorities (Without Breaking Wiring)

### Priority 1: Fix Layout Architecture
- Remove per-page headers (Discovery, Grants, Insights already have TopBar)
- Replace Sidebar with horizontal nav pills inside AppLayout
- Make layout responsive with mobile hamburger menu
- Single consistent page shell

### Priority 2: Replace Card Grid with Data Table (Pipeline)
- Use TanStack Table for sortable, selectable, virtual-scroll district table
- Add inline row expansion for "Why this district"
- Add bulk action bar
- Keep existing filter logic, just move to horizontal filter bar

### Priority 3: Redesign Command Center
- Decompose 555-line monolith into: PromptInput, ResultsTable, WhyPanel, CohortTray, EngagementTimeline
- Center the prompt on first load (Perplexity-style)
- Show results as a table, not chat bubbles
- Add AI summary card above results

### Priority 4: Grants Split-Pane
- Left: ranked results list
- Right: evidence viewer for selected district
- Bottom: cohort builder tray

### Priority 5: Visual Polish
- Load TT Hoves Pro font
- Replace hard-coded colors with design tokens
- Consistent border-radius and spacing
- Proper loading skeletons
- Toast notification system
