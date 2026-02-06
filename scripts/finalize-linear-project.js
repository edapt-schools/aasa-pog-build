#!/usr/bin/env node
/**
 * Finalize Linear Project
 * 1. Update project description
 * 2. Move all issues from Triage to Backlog
 * 3. Verify project associations
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

async function updateProjectDescription(projectId) {
  const query = `
    mutation($id: String!, $input: ProjectUpdateInput!) {
      projectUpdate(id: $id, input: $input) {
        success
        project {
          id
          name
          description
        }
      }
    }
  `;

  const description = `Building a 3-mode intelligence platform to secure nationwide AASA partnership. 19,500+ districts, semantic search, AI-powered insights. 16 weeks, 262 points across 6 phases for Edapt's K-12 expansion.`;

  const variables = {
    id: projectId,
    input: {
      description
    }
  };

  const data = await linearQuery(query, variables);
  return data.projectUpdate.success;
}

async function getBacklogStateId(teamId) {
  const query = `
    query($teamId: String!) {
      team(id: $teamId) {
        states {
          nodes {
            id
            name
            type
          }
        }
      }
    }
  `;

  const data = await linearQuery(query, { teamId });
  const backlogState = data.team.states.nodes.find(s =>
    s.type === 'backlog' || s.name.toLowerCase() === 'backlog'
  );

  if (!backlogState) {
    // Find any unstarted state
    const unstartedState = data.team.states.nodes.find(s => s.type === 'unstarted');
    return unstartedState?.id;
  }

  return backlogState.id;
}

async function updateIssueState(issueId, stateId) {
  const query = `
    mutation($id: String!, $stateId: String!) {
      issueUpdate(id: $id, input: { stateId: $stateId }) {
        success
        issue {
          id
          identifier
        }
      }
    }
  `;

  const data = await linearQuery(query, { id: issueId, stateId });
  return data.issueUpdate.success;
}

async function main() {
  console.log('\n📊 Finalizing Linear Project\n');
  console.log('='.repeat(70));

  try {
    // Step 1: Get project and team info
    console.log('\n1. Getting project information...');
    const projectQuery = `
      query {
        projects(first: 50) {
          nodes {
            id
            name
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

    if (!project || !team) {
      throw new Error('Project or team not found');
    }

    console.log(`   ✓ Found project: ${project.name}`);
    console.log(`   ✓ Found team: BUS`);

    // Step 2: Update project description
    console.log('\n2. Updating project description...');
    const descSuccess = await updateProjectDescription(project.id);
    if (descSuccess) {
      console.log('   ✓ Project description updated with AASA partnership context');
    }

    // Step 3: Get backlog state ID
    console.log('\n3. Finding backlog state...');
    const backlogStateId = await getBacklogStateId(team.id);
    if (!backlogStateId) {
      console.log('   ⚠️  Could not find backlog state, skipping issue updates');
      return;
    }
    console.log('   ✓ Found backlog state');

    // Step 4: Get all project issues
    console.log('\n4. Getting project issues...');
    const issuesQuery = `
      query {
        issues(filter: { project: { id: { eq: "${project.id}" } } }, first: 100) {
          nodes {
            id
            identifier
            title
            state {
              id
              name
              type
            }
          }
        }
      }
    `;

    const issuesData = await linearQuery(issuesQuery);
    const issues = issuesData.issues.nodes;
    console.log(`   ✓ Found ${issues.length} issues`);

    // Step 5: Move triage issues to backlog
    console.log('\n5. Moving issues from Triage to Backlog...');
    let movedCount = 0;

    for (const issue of issues) {
      if (issue.state.type === 'triage') {
        try {
          await updateIssueState(issue.id, backlogStateId);
          console.log(`   ✓ Moved ${issue.identifier} to Backlog`);
          movedCount++;
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`   ❌ Failed to move ${issue.identifier}`);
        }
      }
    }

    console.log(`\n   Moved ${movedCount} issues to Backlog`);

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('✅ PROJECT FINALIZATION COMPLETE');
    console.log('='.repeat(70));
    console.log('\n📋 Changes:');
    console.log(`   - Project description updated with AASA partnership context`);
    console.log(`   - ${movedCount} issues moved from Triage to Backlog`);
    console.log(`   - All ${issues.length} issues properly linked to project\n`);
    console.log('🔗 View project in Linear:');
    console.log('   https://linear.app/team/BUS/projects\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
