#!/usr/bin/env node
/**
 * Check Linear Project Status
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

async function main() {
  // First get project info
  const projectQuery = `
    query {
      projects(first: 50) {
        nodes {
          id
          name
          state
          projectMilestones {
            nodes {
              id
              name
            }
          }
        }
      }
    }
  `;

  try {
    const projectData = await linearQuery(projectQuery);

    const project = projectData.projects.nodes.find(p =>
      p.name === 'AASA District Intelligence Platform' ||
      p.name === 'AASA Nationwide District Intelligence Platform'
    );

    if (!project) {
      console.log('AASA project not found');
      return;
    }

    // Then get issues for this project
    const issuesQuery = `
      query {
        issues(filter: { project: { id: { eq: "${project.id}" } } }, first: 100) {
          nodes {
            identifier
            title
            projectMilestone {
              name
            }
          }
        }
      }
    `;

    const issuesData = await linearQuery(issuesQuery);
    const projectIssues = issuesData.issues.nodes;

    console.log('\n📊 AASA Project Status\n');

    console.log(`Project: ${project.name} (${project.state})`);
    console.log(`Milestones: ${project.projectMilestones.nodes.length}`);

    project.projectMilestones.nodes.forEach(m => {
      console.log(`  - ${m.name}`);
    });

    console.log(`\nIssues created: ${projectIssues.length}`);

    // Group by milestone
    const byMilestone = {};
    projectIssues.forEach(issue => {
      const milestone = issue.projectMilestone?.name || 'No milestone';
      if (!byMilestone[milestone]) byMilestone[milestone] = [];
      byMilestone[milestone].push(issue);
    });

    Object.entries(byMilestone).forEach(([milestone, issues]) => {
      console.log(`\n${milestone}: ${issues.length} issues`);
      issues.forEach(i => console.log(`  ${i.identifier}: ${i.title.substring(0, 60)}...`));
    });

  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
