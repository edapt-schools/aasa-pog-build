#!/usr/bin/env node
/**
 * Add Missing Linear Issues
 */

const https = require('https');

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;

if (!LINEAR_API_KEY) {
  console.error('Error: LINEAR_API_KEY environment variable is required');
  process.exit(1);
}

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

async function getProjectAndMilestones() {
  const query = `
    query {
      projects(first: 50) {
        nodes {
          id
          name
          projectMilestones {
            nodes {
              id
              name
            }
          }
        }
      }
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

  if (!data.projects || !data.projects.nodes || data.projects.nodes.length === 0) {
    throw new Error('No projects found');
  }

  let project = data.projects.nodes.find(p => p.name === 'AASA District Intelligence Platform');

  if (!project) {
    project = data.projects.nodes.find(p => p.name === 'AASA Nationwide District Intelligence Platform');
  }

  if (!project) {
    console.log('Available projects:');
    data.projects.nodes.forEach(p => console.log(`  - ${p.name}`));
    throw new Error('AASA project not found');
  }

  const team = data.teams.nodes.find(t => t.key === 'BUS');

  if (!team) {
    throw new Error('Team not found');
  }

  return { projectId: project.id, milestones: project.projectMilestones.nodes, teamId: team.id };
}

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

  const data = await linearQuery(query, variables);
  if (!data || !data.issueCreate || !data.issueCreate.issue) {
    throw new Error('Invalid API response');
  }
  return data.issueCreate.issue;
}

const MISSING_ISSUES = {
  'Phase 3: Mode 2 - Grant Builder (Todd)': [
    {
      title: 'Implement multi-criteria filtering with scoring',
      description: `**Day 26, 5 points**

- Add weight sliders for each search criterion
- Calculate composite match scores
- Show why each district matched (criteria breakdown)
- Filter by minimum match threshold
- Sort by composite score

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

**Acceptance Criteria:**
- Can create cohort from search results
- Cohorts save search criteria
- Can view/edit cohorts
- Export includes all evidence`,
      points: 8,
      priority: 1
    }
  ],
  'Phase 4: Mode 3 - Insights (Tammy)': [
    {
      title: 'Build keyword trend analysis charts',
      description: `**Day 39-40, 5 points**

- Create time-series charts for keyword mentions
- Show adoption rate by state
- Compare categories (Readiness vs Activation)
- Identify early adopters vs laggards
- Forecast future trends

**Acceptance Criteria:**
- Charts render correctly
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

**Acceptance Criteria:**
- Drag-and-drop works smoothly
- Layouts save correctly
- PDF export preserves layout
- Widgets configurable`,
      points: 5,
      priority: 2
    }
  ],
  'Phase 5: AI Features': [
    {
      title: 'Implement RAG pipeline for district chat',
      description: `**Day 45-47, 13 points**

- Create chat interface with district context
- Implement RAG: retrieve relevant documents → generate response
- Use Vercel AI SDK for streaming responses
- Show source citations for each claim
- Handle follow-up questions with context

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

**Acceptance Criteria:**
- Suggestions relevant to user activity
- Updates based on recent behavior
- Can dismiss suggestions
- Explanations show why suggested`,
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

**Acceptance Criteria:**
- Emails personalized per district
- Relevant context included
- Multiple tone options
- User can edit before sending`,
      points: 5,
      priority: 3
    }
  ]
};

async function main() {
  console.log('\n📊 Adding Missing Issues\n');
  console.log('='.repeat(70));

  try {
    const { projectId, milestones, teamId } = await getProjectAndMilestones();
    console.log(`✓ Found project and team\n`);

    let added = 0;

    for (const [milestoneName, issues] of Object.entries(MISSING_ISSUES)) {
      const milestone = milestones.find(m => m.name === milestoneName);
      if (!milestone) {
        console.log(`⚠️  Milestone not found: ${milestoneName}`);
        continue;
      }

      console.log(`\n📍 ${milestoneName}`);
      console.log(`   Adding ${issues.length} missing issues...`);

      for (const issue of issues) {
        try {
          const createdIssue = await createIssue(teamId, projectId, milestone.id, issue);
          console.log(`     ✓ ${createdIssue.identifier}: ${createdIssue.title}`);
          added++;
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`     ❌ Failed: ${issue.title.substring(0, 50)}...`);
          console.error(`        ${error.message}`);
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`✅ Added ${added} missing issues`);
    console.log('='.repeat(70));
    console.log('\n📊 Run check script for final summary:');
    console.log('   node scripts/check-linear-project.js\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
