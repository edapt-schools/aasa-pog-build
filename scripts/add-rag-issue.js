#!/usr/bin/env node
/**
 * Add RAG Pipeline Issue
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
            console.error('API Errors:', JSON.stringify(response.errors, null, 2));
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

async function main() {
  console.log('\n📊 Adding RAG Pipeline Issue\n');

  try {
    // Get project and team info
    const projectQuery = `
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
          }
        }
      }
    `;

    const data = await linearQuery(projectQuery);

    const project = data.projects.nodes.find(p =>
      p.name === 'AASA District Intelligence Platform' ||
      p.name === 'AASA Nationwide District Intelligence Platform'
    );

    const team = data.teams.nodes.find(t => t.key === 'BUS');
    const milestone = project.projectMilestones.nodes.find(m => m.name === 'Phase 5: AI Features');

    console.log(`✓ Found project, team, and milestone\n`);

    const createQuery = `
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
        teamId: team.id,
        projectId: project.id,
        projectMilestoneId: milestone.id,
        title: 'Implement RAG pipeline for district chat',
        description: `Day 45-47, 13 points

Create chat interface with district context. Implement RAG architecture: retrieve relevant documents then generate response. Use Vercel AI SDK for streaming responses. Show source citations for each claim. Handle follow-up questions with context.

Architecture:
1. User asks question about district
2. Embed question with OpenAI
3. Search document embeddings for top 10 matches
4. Pass documents to GPT-4 as context
5. Stream response with citations

Acceptance Criteria:
- Chat responds accurately based on documents
- Citations link to source documents
- Follow-up questions maintain context
- Responses stream smoothly
- Handles I dont know when no relevant docs`,
        estimate: 13,
        priority: 1
      }
    };

    const result = await linearQuery(createQuery, variables);

    if (result && result.issueCreate && result.issueCreate.issue) {
      console.log(`✓ ${result.issueCreate.issue.identifier}: ${result.issueCreate.issue.title}\n`);
      console.log('✅ Success!\n');
    } else {
      console.log(`❌ Failed - unexpected response structure\n`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
