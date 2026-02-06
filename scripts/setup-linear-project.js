#!/usr/bin/env node
/**
 * Linear Project Setup Script
 *
 * Creates the AASA District Intelligence Platform project in Linear with:
 * - 6 milestones (one per phase)
 * - Detailed issues for each milestone with day-based scope and point estimates
 *
 * Usage: node scripts/setup-linear-project.js
 */

const https = require('https');

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const LINEAR_API_URL = 'https://api.linear.app/graphql';

if (!LINEAR_API_KEY) {
  console.error('Error: LINEAR_API_KEY environment variable is required');
  process.exit(1);
}
const TEAM_KEY = 'BUS'; // Business Development team

// Helper function to make GraphQL requests to Linear API
async function linearQuery(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, variables });

    const options = {
      hostname: 'api.linear.app',
      port: 443,
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': LINEAR_API_KEY,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (response.errors) {
            reject(new Error(JSON.stringify(response.errors, null, 2)));
          } else {
            resolve(response.data);
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Get team ID by key
async function getTeamId() {
  const query = `
    query {
      teams {
        nodes {
          id
          key
          name
        }
      }
    }
  `;

  const data = await linearQuery(query);
  const team = data.teams.nodes.find(t => t.key === TEAM_KEY);

  if (!team) {
    throw new Error(`Team with key "${TEAM_KEY}" not found`);
  }

  console.log(`✓ Found team: ${team.name} (${team.key})`);
  return team.id;
}

// Create project
async function createProject(teamId) {
  const query = `
    mutation($input: ProjectCreateInput!) {
      projectCreate(input: $input) {
        success
        project {
          id
          name
        }
      }
    }
  `;

  const variables = {
    input: {
      name: 'AASA District Intelligence Platform',
      description: 'Full-stack platform for district discovery, grant builder, and insights dashboard with semantic search and AI-powered features.',
      teamIds: [teamId],
      state: 'planned'
    }
  };

  const data = await linearQuery(query, variables);
  console.log(`✓ Created project: ${data.projectCreate.project.name}`);
  return data.projectCreate.project.id;
}

// Create milestone
async function createMilestone(projectId, name, description, targetDate) {
  const query = `
    mutation($input: ProjectMilestoneCreateInput!) {
      projectMilestoneCreate(input: $input) {
        success
        projectMilestone {
          id
          name
        }
      }
    }
  `;

  const variables = {
    input: {
      projectId,
      name,
      description,
      targetDate
    }
  };

  const data = await linearQuery(query, variables);
  console.log(`  ✓ Created milestone: ${name}`);
  return data.projectMilestoneCreate.projectMilestone.id;
}

// Create issue
async function createIssue(teamId, projectId, milestoneId, issue) {
  const query = `
    mutation($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          title
        }
      }
    }
  `;

  const variables = {
    input: {
      teamId,
      projectId,
      projectMilestoneId: milestoneId,
      title: issue.title,
      description: issue.description,
      estimate: issue.points,
      priority: issue.priority || 2
    }
  };

  try {
    const data = await linearQuery(query, variables);
    if (!data || !data.issueCreate || !data.issueCreate.issue) {
      console.error('     ⚠️  Unexpected response structure:', JSON.stringify(data, null, 2));
      throw new Error('Invalid API response');
    }
    return data.issueCreate.issue;
  } catch (error) {
    console.error(`     ❌ Failed to create issue: ${issue.title}`);
    console.error(`        Error: ${error.message}`);
    // Add a small delay before retrying
    await new Promise(resolve => setTimeout(resolve, 1000));
    throw error;
  }
}

// Calculate target date (days from now)
function getTargetDate(daysFromNow) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
}

// Project structure with milestones and issues
const PROJECT_STRUCTURE = {
  milestones: [
    {
      name: 'Phase 1: Foundation',
      description: 'Core infrastructure, authentication, database setup, and API foundation',
      daysFromNow: 21,
      issues: [
        {
          title: 'Set up Next.js 14 project with App Router and TypeScript',
          description: `**Day 1, 3 points**

- Initialize Next.js 14 project with App Router
- Configure TypeScript with strict mode
- Set up ESLint and Prettier
- Configure environment variables structure
- Create basic folder structure (app/, components/, lib/, types/)

**Acceptance Criteria:**
- Project builds without errors
- TypeScript strict mode enabled
- Linting and formatting configured`,
          points: 3,
          priority: 1
        },
        {
          title: 'Configure Tailwind CSS and shadcn/ui component library',
          description: `**Day 1-2, 2 points**

- Install and configure Tailwind CSS
- Set up custom color scheme (light blue #E6F3FF to purple #F0E6FF gradient)
- Install shadcn/ui CLI
- Add initial components: Button, Input, Card, Table, Dialog
- Create custom theme configuration

**Acceptance Criteria:**
- Tailwind working with custom colors
- shadcn/ui components rendering correctly
- Gradient background working`,
          points: 2,
          priority: 1
        },
        {
          title: 'Set up Supabase client and connection pooling',
          description: `**Day 2, 2 points**

- Create Supabase client utilities (lib/supabase/)
- Configure connection pooling (max 10 connections)
- Set up environment variables for database URL
- Create database types from existing schema
- Test connection with simple query

**Acceptance Criteria:**
- Connection pool working correctly
- TypeScript types generated from database
- Can query superintendent_directory table`,
          points: 2,
          priority: 1
        },
        {
          title: 'Create authentication system with role-based access',
          description: `**Day 3-4, 5 points**

- Set up Supabase Auth
- Create login/logout flows
- Implement role-based access control (admin, sales, grants)
- Create auth middleware for protected routes
- Build login UI with shadcn/ui

**Acceptance Criteria:**
- Users can log in/out
- Roles enforced on routes
- Session persists across page reloads
- Protected API routes working`,
          points: 5,
          priority: 1
        },
        {
          title: 'Create API routes for district data fetching',
          description: `**Day 4-5, 3 points**

- Create /api/districts route for listing districts
- Create /api/districts/[id] route for single district
- Implement pagination (50 districts per page)
- Add filtering by state, enrollment, keyword scores
- Return data from national_registry view

**Acceptance Criteria:**
- API returns paginated district data
- Filtering works correctly
- Response time < 500ms for 50 districts`,
          points: 3,
          priority: 1
        },
        {
          title: 'Create API routes for document search',
          description: `**Day 5-6, 5 points**

- Create /api/search/semantic route for vector similarity
- Create /api/search/keyword route for text search
- Implement query embedding with OpenAI
- Use pgvector for similarity search
- Combine semantic + keyword results with ranking

**Acceptance Criteria:**
- Semantic search returns relevant documents
- Keyword search works with filters
- Results sorted by relevance score
- Response time < 2s for complex queries`,
          points: 5,
          priority: 1
        },
        {
          title: 'Enable pgvector extension and optimize indexes',
          description: `**Day 6, 3 points**

- Enable pgvector extension in Supabase
- Create HNSW index on document_embeddings.embedding
- Create composite indexes for common queries
- Add indexes on district_keyword_scores columns
- Run EXPLAIN ANALYZE on key queries

**Acceptance Criteria:**
- pgvector extension enabled
- HNSW index created
- Query performance improved by >50%
- All indexes documented`,
          points: 3,
          priority: 1
        },
        {
          title: 'Create stored procedures for common queries',
          description: `**Day 7, 3 points**

- Create search_districts_by_keywords() function
- Create get_district_documents() function
- Create get_similar_districts() function
- Add RLS policies for data access
- Document all procedures

**Acceptance Criteria:**
- 3 stored procedures created and tested
- RLS policies enforce access control
- Procedures return correct data types`,
          points: 3,
          priority: 2
        },
        {
          title: 'Build reusable UI components library',
          description: `**Day 8-9, 5 points**

- Create DistrictCard component
- Create SearchBar component with filters
- Create ResultsList component with pagination
- Create LoadingSpinner and ErrorState components
- Create TagBadge for keyword scores

**Acceptance Criteria:**
- All components TypeScript typed
- Components are reusable and composable
- Loading and error states handled
- Components documented with Storybook or examples`,
          points: 5,
          priority: 2
        },
        {
          title: 'Create layout system with mode switcher',
          description: `**Day 10, 3 points**

- Create app layout with header, sidebar, main content
- Build mode switcher (Discovery, Grant Builder, Insights)
- Implement navigation between modes
- Add user profile dropdown
- Style with gradient background

**Acceptance Criteria:**
- Mode switching works smoothly
- Layout responsive on desktop
- User profile shows current role
- Navigation persists selected mode`,
          points: 3,
          priority: 2
        },
        {
          title: 'Implement error handling and logging system',
          description: `**Day 11, 2 points**

- Create error boundary components
- Set up error logging (console for now, Sentry later)
- Create user-friendly error messages
- Add toast notifications for actions
- Handle API errors gracefully

**Acceptance Criteria:**
- Error boundaries catch React errors
- API errors show user-friendly messages
- Toast notifications working
- Errors logged with context`,
          points: 2,
          priority: 2
        }
      ]
    },
    {
      name: 'Phase 2: Mode 1 - Discovery (Jeff)',
      description: 'Event preparation interface with district filtering, lists, and 3-10-20 pipeline management',
      daysFromNow: 42,
      issues: [
        {
          title: 'Build district filter panel with multi-select',
          description: `**Day 12-13, 5 points**

- Create FilterPanel component with collapsible sections
- Add state multi-select (50 states + DC)
- Add enrollment range slider
- Add keyword score filters (4 categories: Readiness, Alignment, Activation, Branding)
- Add outreach tier filter (Tier 1, 2, 3)

**Acceptance Criteria:**
- All filters work independently and combined
- UI shows count of matching districts
- Filters persist in URL query params
- Clear all filters button works`,
          points: 5,
          priority: 1
        },
        {
          title: 'Create district results table with sorting',
          description: `**Day 13-14, 5 points**

- Build table with shadcn/ui Table component
- Columns: District name, State, Enrollment, Superintendent, Keyword scores, Tier
- Implement column sorting (client-side for current page)
- Add row selection checkboxes
- Add "Select all" functionality

**Acceptance Criteria:**
- Table displays district data correctly
- Sorting works on all columns
- Row selection works with keyboard shortcuts
- Table responsive on desktop`,
          points: 5,
          priority: 1
        },
        {
          title: 'Implement pagination and infinite scroll',
          description: `**Day 14, 3 points**

- Add pagination controls (50 districts per page)
- Show current page and total pages
- Add "Load more" button option
- Prefetch next page for smooth UX
- Handle loading states

**Acceptance Criteria:**
- Pagination works correctly
- Page changes update URL
- Loading state shows during fetch
- Prefetching improves perceived performance`,
          points: 3,
          priority: 2
        },
        {
          title: 'Build "My Lists" management system',
          description: `**Day 15-16, 8 points**

- Create lists table in database (user_district_lists)
- Build UI to create/rename/delete lists
- Add districts to lists (multi-select)
- Show list membership on district rows
- Implement list filtering

**Database Schema:**
\`\`\`sql
CREATE TABLE user_district_lists (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE list_districts (
  list_id UUID REFERENCES user_district_lists,
  district_nces_id TEXT REFERENCES districts(nces_id),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (list_id, district_nces_id)
);
\`\`\`

**Acceptance Criteria:**
- Users can create/edit/delete lists
- Districts can be added to multiple lists
- Lists show district count
- Can filter table to show only districts in a list`,
          points: 8,
          priority: 1
        },
        {
          title: 'Implement 3-10-20 pipeline status tracking',
          description: `**Day 17-18, 8 points**

- Add pipeline_status column to districts table
- Create status dropdown: Not Started, Initial Contact (3), Follow-up (10), Pre-Close (20), Won, Lost
- Build pipeline view (kanban or table with status columns)
- Add status change history tracking
- Create pipeline statistics dashboard

**Database Schema:**
\`\`\`sql
ALTER TABLE superintendent_directory ADD COLUMN pipeline_status TEXT DEFAULT 'not_started';

CREATE TABLE pipeline_history (
  id UUID PRIMARY KEY,
  district_nces_id TEXT REFERENCES districts(nces_id),
  user_id UUID REFERENCES auth.users,
  old_status TEXT,
  new_status TEXT,
  notes TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

**Acceptance Criteria:**
- Status changes save to database
- History tracked with timestamps
- Pipeline view shows districts by status
- Statistics show conversion rates`,
          points: 8,
          priority: 1
        },
        {
          title: 'Build quick export functionality (CSV/Excel)',
          description: `**Day 19, 3 points**

- Create /api/export route
- Generate CSV with selected districts
- Include: Name, State, Enrollment, Superintendent, Email, Phone, Website, Keyword Scores
- Add "Export selected" button
- Add "Export current view" button

**Acceptance Criteria:**
- CSV downloads correctly
- All data fields included
- File named with timestamp
- Works with large selections (1000+ districts)`,
          points: 3,
          priority: 2
        },
        {
          title: 'Create bulk actions for selected districts',
          description: `**Day 20, 3 points**

- Add to list (bulk)
- Change pipeline status (bulk)
- Export (bulk)
- Show bulk action bar when districts selected
- Confirm dialog for destructive actions

**Acceptance Criteria:**
- Bulk actions work on all selected districts
- Progress indicator for large batches
- Actions complete successfully
- Error handling for partial failures`,
          points: 3,
          priority: 2
        },
        {
          title: 'Implement saved filter presets',
          description: `**Day 21, 3 points**

- Create filter_presets table
- Build UI to save current filters as preset
- Quick-load presets from dropdown
- Edit/delete presets
- Share presets with team (optional)

**Acceptance Criteria:**
- Presets save all filter combinations
- Can load preset with one click
- Presets persist across sessions
- Can manage presets (edit, delete)`,
          points: 3,
          priority: 3
        }
      ]
    },
    {
      name: 'Phase 3: Mode 2 - Grant Builder (Todd)',
      description: 'Semantic search interface with evidence viewer, query builder, and consortium builder',
      daysFromNow: 63,
      issues: [
        {
          title: 'Build semantic search interface with query builder',
          description: `**Day 22-23, 8 points**

- Create SearchQueryBuilder component
- Natural language query input
- Add structured filters (e.g., ">70% FRL", "doing Measure What Matters")
- Combine semantic + syntactic search
- Show query interpretation/expansion

**Features:**
- Natural language: "Districts with portrait of a graduate and high poverty"
- Structured: FRL > 70% AND keyword_scores.readiness > 5
- Boolean operators: AND, OR, NOT
- Proximity search: "strategic plan" NEAR "community engagement"

**Acceptance Criteria:**
- Query builder has both natural and structured modes
- Backend interprets queries correctly
- Shows search interpretation to user
- Results update in real-time`,
          points: 8,
          priority: 1
        },
        {
          title: 'Create evidence viewer with highlighted snippets',
          description: `**Day 24-25, 8 points**

- Build EvidencePanel component
- Show matching document snippets
- Highlight query terms in context
- Sort by relevance score
- Link to original source document
- Show document metadata (type, date, page)

**Acceptance Criteria:**
- Snippets show relevant context (200 chars before/after match)
- Query terms highlighted visually
- Relevance scores displayed
- Can view full document in modal or new tab`,
          points: 8,
          priority: 1
        },
        {
          title: 'Implement multi-criteria filtering with scoring',
          description: `**Day 26, 5 points**

- Add weight sliders for each search criterion
- Calculate composite match scores
- Show why each district matched (criteria breakdown)
- Filter by minimum match threshold
- Sort by composite score

**Example:**
- "Portrait of Graduate" (weight: 0.4) → District X score: 0.85
- "Strategic Plan" (weight: 0.3) → District X score: 0.60
- ">70% FRL" (weight: 0.3) → District X score: 1.0
- Composite: 0.805 (passes 0.75 threshold)

**Acceptance Criteria:**
- Weight sliders work correctly
- Composite scores calculated accurately
- Match breakdown visible for each district
- Threshold filtering works`,
          points: 5,
          priority: 1
        },
        {
          title: 'Build consortium/cohort builder',
          description: `**Day 27-28, 8 points**

- Create cohort management system
- Save search results as cohort
- Name and describe cohorts
- Export cohort as proposal document
- Track cohort status (draft, submitted, funded)

**Database Schema:**
\`\`\`sql
CREATE TABLE grant_cohorts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  name TEXT NOT NULL,
  description TEXT,
  search_criteria JSONB,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cohort_districts (
  cohort_id UUID REFERENCES grant_cohorts,
  district_nces_id TEXT REFERENCES districts(nces_id),
  match_score DECIMAL,
  evidence JSONB,
  PRIMARY KEY (cohort_id, district_nces_id)
);
\`\`\`

**Acceptance Criteria:**
- Can create cohort from search results
- Cohorts save search criteria
- Can view/edit cohorts
- Export includes all evidence`,
          points: 8,
          priority: 1
        },
        {
          title: 'Create grant proposal export with evidence',
          description: `**Day 29, 5 points**

- Generate formatted grant proposal document
- Include executive summary
- List all qualifying districts with evidence
- Add aggregate statistics
- Export as PDF or Word document

**Sections:**
1. Grant Overview (user-provided)
2. Cohort Summary (auto-generated)
3. District Qualifications (evidence per district)
4. Aggregate Statistics
5. Appendix (full document excerpts)

**Acceptance Criteria:**
- PDF export works correctly
- All evidence included
- Formatting professional
- Can customize sections`,
          points: 5,
          priority: 2
        },
        {
          title: 'Implement document source viewer with PDF preview',
          description: `**Day 30, 5 points**

- Create DocumentViewer modal
- Show full document text
- Highlight search matches
- PDF preview for PDF sources
- Link to original URL
- Download document option

**Acceptance Criteria:**
- Modal opens smoothly
- PDFs render correctly
- Highlights work in viewer
- Download preserves original format`,
          points: 5,
          priority: 2
        },
        {
          title: 'Build saved searches and query templates',
          description: `**Day 31, 3 points**

- Save complex queries as templates
- Quick-load templates
- Share templates with team
- Template library with common grant queries

**Common Templates:**
- "High-poverty districts with PoG"
- "Districts implementing competency-based education"
- "Rural districts with strategic plans"

**Acceptance Criteria:**
- Templates save all query components
- Can load template with one click
- Template library organized by category
- Can share templates with team`,
          points: 3,
          priority: 3
        },
        {
          title: 'Add comparison view for districts',
          description: `**Day 32, 3 points**

- Select multiple districts to compare
- Side-by-side view of key metrics
- Compare keyword scores
- Compare evidence strength
- Highlight differences

**Acceptance Criteria:**
- Can compare up to 5 districts
- Comparison table clear and readable
- Highlights show strongest matches
- Can export comparison`,
          points: 3,
          priority: 3
        }
      ]
    },
    {
      name: 'Phase 4: Mode 3 - Insights (Tammy)',
      description: 'Regional dashboard with trending topics, state reports, and automated intelligence',
      daysFromNow: 77,
      issues: [
        {
          title: 'Build regional dashboard with state aggregation',
          description: `**Day 33-34, 8 points**

- Create DashboardView with state-level aggregation
- Show state-level statistics (avg enrollment, keyword scores)
- Interactive US map with state coloring by metrics
- Drill-down from state to district list
- Top states by each keyword category

**Metrics per State:**
- Total districts
- Total enrollment
- Avg keyword scores (4 categories)
- Coverage (% with data)
- Top tier districts count

**Acceptance Criteria:**
- Map renders correctly with tooltips
- State colors reflect selected metric
- Can click state to see district list
- Statistics update when filters change`,
          points: 8,
          priority: 1
        },
        {
          title: 'Implement trending topics detection',
          description: `**Day 35-36, 8 points**

- Create trending_topics table
- Run topic modeling on document collection
- Track topic frequency over time
- Build UI to show trending topics
- Link topics to matching districts

**Algorithm:**
- Extract key phrases from documents
- Track mention frequency by month
- Calculate growth rate
- Surface rising topics (>50% growth)

**Acceptance Criteria:**
- Topics detected accurately
- Growth rates calculated correctly
- UI shows top 10 trending topics
- Can click topic to see matching districts`,
          points: 8,
          priority: 1
        },
        {
          title: 'Create automated state reports generation',
          description: `**Day 37-38, 8 points**

- Build report generation pipeline
- Template-based report builder
- Schedule automatic generation (weekly/monthly)
- Email delivery of reports
- Store historical reports

**Report Sections:**
1. Executive Summary
2. State Statistics
3. Trending Topics
4. High-Priority Districts
5. Recent Changes
6. Recommendations

**Acceptance Criteria:**
- Reports generate automatically on schedule
- Email delivery works
- Reports stored in database
- Can download past reports`,
          points: 8,
          priority: 1
        },
        {
          title: 'Build keyword trend analysis charts',
          description: `**Day 39-40, 5 points**

- Create time-series charts for keyword mentions
- Show adoption rate by state
- Compare categories (Readiness vs Activation)
- Identify early adopters vs laggards
- Forecast future trends

**Charts:**
- Line chart: Keyword mentions over time
- Bar chart: Top states by category
- Heatmap: State × Category matrix
- Scatter: Enrollment vs keyword score

**Acceptance Criteria:**
- Charts render correctly with Chart.js or Recharts
- Data updates when filters change
- Can download charts as images
- Tooltips show detailed data`,
          points: 5,
          priority: 2
        },
        {
          title: 'Create custom report builder with widgets',
          description: `**Day 41-42, 5 points**

- Drag-and-drop report builder
- Widget library (stats, charts, tables, maps)
- Save custom report layouts
- Export as PDF or PowerPoint
- Share reports with team

**Widgets:**
- StatCard (single metric)
- BarChart, LineChart, PieChart
- DistrictTable
- StateMap
- TextBlock (for notes)

**Acceptance Criteria:**
- Drag-and-drop works smoothly
- Layouts save correctly
- PDF export preserves layout
- Widgets configurable`,
          points: 5,
          priority: 2
        },
        {
          title: 'Implement alert system for priority districts',
          description: `**Day 43, 3 points**

- Create alert rules engine
- Trigger alerts on conditions (e.g., Tier 1 + FRL > 80%)
- Email/in-app notifications
- Alert management UI
- Snooze/dismiss alerts

**Alert Types:**
- New high-priority district detected
- District moved up in tier
- Trending topic match
- Pipeline status change

**Acceptance Criteria:**
- Alerts trigger correctly
- Notifications delivered
- Can manage alert rules
- Alert history tracked`,
          points: 3,
          priority: 3
        },
        {
          title: 'Build executive summary auto-generation',
          description: `**Day 44, 3 points**

- Generate narrative summaries from data
- Use GPT-4 to write executive summaries
- Summarize key findings
- Highlight important changes
- Include in state reports

**Example:**
"California leads in Portrait of Graduate adoption with 245 districts (23% of state). Trending topics include 'competency-based education' (+67% mentions) and 'community schools' (+43%). Top priority: Los Angeles USD (Tier 1, 694K students)."

**Acceptance Criteria:**
- Summaries generated accurately
- Narrative is clear and professional
- Key statistics included
- Can regenerate on demand`,
          points: 3,
          priority: 3
        }
      ]
    },
    {
      name: 'Phase 5: AI Features',
      description: 'District chat (RAG), proactive suggestions, contextual intelligence',
      daysFromNow: 98,
      issues: [
        {
          title: 'Implement RAG pipeline for district chat',
          description: `**Day 45-47, 13 points**

- Create chat interface with district context
- Implement RAG: retrieve relevant documents → generate response
- Use Vercel AI SDK for streaming responses
- Show source citations for each claim
- Handle follow-up questions with context

**Architecture:**
1. User asks question about district
2. Embed question with OpenAI
3. Search document_embeddings for top 10 matches
4. Pass documents to GPT-4 as context
5. Stream response with citations

**Acceptance Criteria:**
- Chat responds accurately based on documents
- Citations link to source documents
- Follow-up questions maintain context
- Responses stream smoothly
- Handles "I don't know" when no relevant docs`,
          points: 13,
          priority: 1
        },
        {
          title: 'Build proactive suggestion system',
          description: `**Day 48-49, 8 points**

- Analyze user behavior (searches, filters, lists)
- Generate personalized recommendations
- "You might be interested in..." suggestions
- Similar district finder
- Recommended searches

**Suggestions:**
- "Districts similar to those in your 'Summer Conference' list"
- "New Tier 1 districts in states you search often"
- "Districts matching your recent grant search"

**Acceptance Criteria:**
- Suggestions relevant to user activity
- Updates based on recent behavior
- Can dismiss suggestions
- Explanations show why suggested`,
          points: 8,
          priority: 2
        },
        {
          title: 'Create contextual intelligence prompts',
          description: `**Day 50-51, 8 points**

- Smart quick actions based on context
- Auto-fill grant criteria from past searches
- Suggest pipeline status based on activity
- Pre-fill email templates with district info

**Examples:**
- When viewing district: "Add to Summer Conference list?"
- When searching: "Save this as 'ESSA Grant Q1'?"
- When exporting: "Use last week's export format?"

**Acceptance Criteria:**
- Prompts appear at right moment
- Suggestions save time
- Can ignore or customize
- Learns from user preferences`,
          points: 8,
          priority: 2
        },
        {
          title: 'Implement natural language query understanding',
          description: `**Day 52-53, 8 points**

- Parse complex natural language queries
- Extract entities (states, enrollment ranges, keywords)
- Handle ambiguity with clarifying questions
- Learn from user corrections

**Examples:**
- "Large districts in California with portrait of graduate" →
  enrollment > 10000 AND state = CA AND keyword_scores.readiness > 5
- "Rural schools in the southeast" →
  locale IN (rural, remote) AND state IN (AL, GA, SC, NC, TN, MS, AR, LA)

**Acceptance Criteria:**
- Queries parsed correctly >90% of time
- Clarifying questions improve accuracy
- User can correct misinterpretations
- System learns from corrections`,
          points: 8,
          priority: 2
        },
        {
          title: 'Build AI-powered email composer',
          description: `**Day 54, 5 points**

- Generate personalized outreach emails
- Use district-specific context
- Suggest talking points from documents
- Tone options (formal, friendly, brief)

**Template Variables:**
- {district_name}
- {superintendent_name}
- {relevant_initiative} (from documents)
- {similar_district} (peer reference)

**Acceptance Criteria:**
- Emails personalized per district
- Relevant context included
- Multiple tone options
- User can edit before sending`,
          points: 5,
          priority: 3
        },
        {
          title: 'Create smart duplicate detection',
          description: `**Day 55, 3 points**

- Detect when user adds duplicate districts to lists
- Identify similar saved searches
- Prevent duplicate cohorts
- Suggest merging duplicates

**Acceptance Criteria:**
- Duplicates detected accurately
- Warnings show before action
- Can ignore warning if intentional
- Merge functionality works`,
          points: 3,
          priority: 3
        },
        {
          title: 'Implement conversation memory across sessions',
          description: `**Day 56, 3 points**

- Store chat history per district
- Resume conversations seamlessly
- Reference previous interactions
- Clear conversation history option

**Acceptance Criteria:**
- Chat history persists
- Can resume conversations
- References past context appropriately
- History clear/delete works`,
          points: 3,
          priority: 3
        }
      ]
    },
    {
      name: 'Phase 6: Polish & Launch',
      description: 'Performance optimization, comprehensive testing, deployment, and documentation',
      daysFromNow: 112,
      issues: [
        {
          title: 'Optimize database queries and add caching',
          description: `**Day 57-58, 5 points**

- Profile slow queries with EXPLAIN ANALYZE
- Add Redis caching for common queries
- Implement request deduplication
- Add database connection pooling safeguards
- Optimize pgvector queries

**Targets:**
- District list: < 500ms
- Semantic search: < 2s
- Dashboard load: < 1s

**Acceptance Criteria:**
- All targets met
- Cache hit rate > 70%
- No N+1 query issues
- Connection pool never exhausted`,
          points: 5,
          priority: 1
        },
        {
          title: 'Add loading states and skeleton screens',
          description: `**Day 58, 3 points**

- Replace spinners with skeleton screens
- Add progressive loading for large lists
- Optimize perceived performance
- Add loading indicators for all async actions

**Acceptance Criteria:**
- Skeleton screens match final content shape
- Progressive loading smooth
- No blank screens during load
- Loading states consistent across app`,
          points: 3,
          priority: 2
        },
        {
          title: 'Implement error recovery and retry logic',
          description: `**Day 59, 3 points**

- Automatic retry for transient failures
- Exponential backoff for API calls
- Graceful degradation when services down
- Clear error messages with recovery steps

**Acceptance Criteria:**
- Transient errors auto-retry
- Users never see raw error messages
- Degraded mode still functional
- Recovery suggestions helpful`,
          points: 3,
          priority: 2
        },
        {
          title: 'Build comprehensive test suite',
          description: `**Day 60-62, 8 points**

- Unit tests for utilities and components
- Integration tests for API routes
- E2E tests for critical user flows
- Visual regression tests
- Performance tests

**Coverage Targets:**
- Unit: >80%
- Integration: >70%
- E2E: All critical paths

**Acceptance Criteria:**
- All tests passing
- Coverage targets met
- CI/CD pipeline runs tests
- Tests catch real bugs`,
          points: 8,
          priority: 1
        },
        {
          title: 'Create user documentation and help system',
          description: `**Day 63-64, 5 points**

- Write user guide for each mode
- Create video walkthroughs
- Build in-app help system
- Add tooltips for complex features
- Create FAQ

**Documentation:**
- Getting Started guide
- Mode-specific tutorials
- Keyboard shortcuts reference
- API documentation

**Acceptance Criteria:**
- All features documented
- Videos demonstrate key flows
- Help accessible in app
- FAQ covers common issues`,
          points: 5,
          priority: 2
        },
        {
          title: 'Set up production deployment pipeline',
          description: `**Day 65-66, 5 points**

- Configure Vercel deployment
- Set up environment variables
- Configure custom domain
- Set up SSL certificates
- Configure database connection for production

**Acceptance Criteria:**
- Deploy to production works
- Environment variables set correctly
- Custom domain working with SSL
- Database connections secure`,
          points: 5,
          priority: 1
        },
        {
          title: 'Implement monitoring and analytics',
          description: `**Day 67, 3 points**

- Set up error tracking (Sentry)
- Add analytics (PostHog or similar)
- Create uptime monitoring
- Set up alerting for critical errors
- Track key metrics (searches, exports, etc.)

**Acceptance Criteria:**
- Errors tracked in real-time
- Analytics dashboard shows usage
- Alerts trigger for downtime
- Metrics exported for reporting`,
          points: 3,
          priority: 2
        },
        {
          title: 'Conduct user acceptance testing',
          description: `**Day 68-69, 5 points**

- Test with Jeff (Sales mode)
- Test with Todd (Grant Builder mode)
- Test with Tammy (Insights mode)
- Collect feedback
- Prioritize fixes

**Acceptance Criteria:**
- All three users complete test scenarios
- Feedback documented
- Critical issues fixed
- Users sign off on functionality`,
          points: 5,
          priority: 1
        },
        {
          title: 'Performance testing and optimization',
          description: `**Day 70, 3 points**

- Load test with 10,000 districts
- Test concurrent user scenarios
- Optimize bundle size
- Add code splitting
- Implement lazy loading

**Targets:**
- Bundle size < 500KB
- Time to Interactive < 3s
- Lighthouse score > 90

**Acceptance Criteria:**
- All performance targets met
- No memory leaks
- App responsive with large datasets
- Mobile performance acceptable`,
          points: 3,
          priority: 2
        },
        {
          title: 'Security audit and hardening',
          description: `**Day 71, 3 points**

- Audit authentication flow
- Review RLS policies
- Test for SQL injection
- Check for XSS vulnerabilities
- Review API rate limiting

**Acceptance Criteria:**
- No security vulnerabilities found
- RLS prevents unauthorized access
- API rate limiting works
- Sensitive data encrypted`,
          points: 3,
          priority: 1
        },
        {
          title: 'Create admin dashboard for system health',
          description: `**Day 72, 3 points**

- Build admin-only dashboard
- Show system metrics (DB connections, API usage)
- User activity monitoring
- Error rate tracking
- Quick actions for common admin tasks

**Acceptance Criteria:**
- Dashboard shows real-time metrics
- Admin can see system health at a glance
- Quick actions work correctly
- Only admins can access`,
          points: 3,
          priority: 3
        },
        {
          title: 'Final polish and bug fixes',
          description: `**Day 73-74, 5 points**

- Fix all known bugs
- Polish UI animations
- Improve accessibility (WCAG AA)
- Optimize mobile experience
- Final QA pass

**Acceptance Criteria:**
- Zero known P0/P1 bugs
- Animations smooth
- Keyboard navigation works
- Mobile experience acceptable`,
          points: 5,
          priority: 1
        },
        {
          title: 'Launch preparation and rollout',
          description: `**Day 75-76, 5 points**

- Create launch checklist
- Schedule launch date
- Prepare announcement
- Train initial users
- Monitor launch closely

**Acceptance Criteria:**
- Launch checklist complete
- Users trained
- Monitoring active
- Launch smooth with no major issues`,
          points: 5,
          priority: 1
        }
      ]
    }
  ]
};

// Main execution
async function main() {
  console.log('\n📊 AASA District Intelligence Platform - Linear Setup\n');
  console.log('='.repeat(70));

  try {
    // Step 1: Get team ID
    console.log('\n1. Finding Business Development team...');
    const teamId = await getTeamId();

    // Step 2: Create project
    console.log('\n2. Creating project...');
    const projectId = await createProject(teamId);

    // Step 3: Create milestones and issues
    console.log('\n3. Creating milestones and issues...');
    let dayOffset = 0;

    for (const milestone of PROJECT_STRUCTURE.milestones) {
      console.log(`\n  📍 ${milestone.name}`);

      const milestoneId = await createMilestone(
        projectId,
        milestone.name,
        milestone.description,
        getTargetDate(milestone.daysFromNow)
      );

      // Create issues for this milestone
      console.log(`     Creating ${milestone.issues.length} issues...`);
      for (const issue of milestone.issues) {
        try {
          const createdIssue = await createIssue(teamId, projectId, milestoneId, issue);
          console.log(`       ✓ ${createdIssue.identifier}: ${createdIssue.title}`);
          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`       ❌ Skipping issue: ${issue.title.substring(0, 50)}...`);
        }
      }
    }

    // Summary
    const totalIssues = PROJECT_STRUCTURE.milestones.reduce((sum, m) => sum + m.issues.length, 0);
    const totalPoints = PROJECT_STRUCTURE.milestones.reduce((sum, m) =>
      sum + m.issues.reduce((s, i) => s + i.points, 0), 0
    );

    console.log('\n' + '='.repeat(70));
    console.log('✅ LINEAR PROJECT SETUP COMPLETE');
    console.log('='.repeat(70));
    console.log(`\n📊 Summary:`);
    console.log(`   Milestones: ${PROJECT_STRUCTURE.milestones.length}`);
    console.log(`   Issues: ${totalIssues}`);
    console.log(`   Total Points: ${totalPoints}`);
    console.log(`   Timeline: ${PROJECT_STRUCTURE.milestones[PROJECT_STRUCTURE.milestones.length - 1].daysFromNow} days (~16 weeks)`);
    console.log(`\n🔗 View project in Linear:`);
    console.log(`   https://linear.app/team/BUS/projects\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
