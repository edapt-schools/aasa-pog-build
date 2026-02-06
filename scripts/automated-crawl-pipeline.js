#!/usr/bin/env node
/**
 * Automated Crawl Pipeline
 *
 * Runs the complete district crawling workflow with intelligent retry logic:
 * 1. Crawl districts with parallel execution
 * 2. Fix obvious URL issues (redirects, www variants)
 * 3. Retry failures with smart abort logic
 * 4. Report unrecoverable failures for manual research
 * 5. Compute keyword scores
 * 6. Generate embeddings
 * 7. Analyze results
 *
 * Usage:
 *   node scripts/automated-crawl-pipeline.js [options]
 *
 * Options:
 *   --limit N           Number of districts to crawl (default: 200)
 *   --concurrency N     Parallel crawl count (default: 10)
 *   --skip-existing     Skip already-crawled districts
 *   --no-retry          Skip retry step
 *   --no-embeddings     Skip embedding generation
 *
 * Example:
 *   node scripts/automated-crawl-pipeline.js --limit 500 --concurrency 10 --skip-existing
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Parse command line args
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    limit: 200,
    concurrency: 10,
    skipExisting: false,
    skipRetry: false,
    skipEmbeddings: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      config.limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--concurrency' && args[i + 1]) {
      config.concurrency = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--skip-existing') {
      config.skipExisting = true;
    } else if (args[i] === '--no-retry') {
      config.skipRetry = true;
    } else if (args[i] === '--no-embeddings') {
      config.skipEmbeddings = true;
    }
  }

  return config;
}

// Run a script and return promise with error resilience
function runScript(scriptPath, args = [], { optional = false } = {}) {
  return new Promise((resolve, reject) => {
    const scriptName = path.basename(scriptPath);
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🚀 Starting: ${scriptName}`);
    console.log(`   Time: ${new Date().toLocaleTimeString()}`);
    console.log(`${'='.repeat(70)}\n`);

    const child = spawn('node', [scriptPath, ...args], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    child.on('exit', (code) => {
      if (code === 0) {
        console.log(`\n✅ Completed: ${scriptName}`);
        console.log(`   Time: ${new Date().toLocaleTimeString()}\n`);
        resolve();
      } else {
        console.error(`\n❌ Failed: ${scriptName} (exit code ${code})`);
        console.error(`   Time: ${new Date().toLocaleTimeString()}\n`);

        if (optional) {
          console.log(`⚠️  Continuing despite failure (optional step)\n`);
          resolve(); // Don't stop pipeline for optional steps
        } else {
          reject(new Error(`${scriptName} failed with code ${code}`));
        }
      }
    });

    child.on('error', (err) => {
      console.error(`\n❌ Error running ${scriptName}:`, err.message);
      console.error(`   Time: ${new Date().toLocaleTimeString()}\n`);

      if (optional) {
        console.log(`⚠️  Continuing despite error (optional step)\n`);
        resolve();
      } else {
        reject(err);
      }
    });
  });
}

// Main pipeline
async function main() {
  const config = parseArgs();
  const startTime = Date.now();

  console.log('\n' + '='.repeat(70));
  console.log('📊 AUTOMATED CRAWL PIPELINE');
  console.log('='.repeat(70));
  console.log(`\nConfiguration:`);
  console.log(`  Districts: ${config.limit}`);
  console.log(`  Concurrency: ${config.concurrency}`);
  console.log(`  Skip existing: ${config.skipExisting}`);
  console.log(`  Skip retry: ${config.skipRetry}`);
  console.log(`  Skip embeddings: ${config.skipEmbeddings}`);
  console.log();

  try {
    // Step 1: Crawl districts
    const crawlerArgs = [
      '--limit', config.limit.toString(),
      '--concurrency', config.concurrency.toString()
    ];
    if (config.skipExisting) {
      crawlerArgs.push('--skip-existing');
    }

    await runScript('scripts/pilot-document-crawler.js', crawlerArgs);

    // Step 2: Fix obvious URL issues (fast, optional - don't stop if it fails)
    await runScript('scripts/verify-urls.js', ['--failed-only', '--fix'], { optional: true });

    // Step 3: Smart retry - SKIPPED for overnight runs (too slow)
    if (!config.skipRetry) {
      console.log('\n' + '='.repeat(70));
      console.log('⏭️  Skipping retry - too slow for bulk collection');
      console.log('📝 Unrecoverable failures logged in document_crawl_log');
      console.log('='.repeat(70) + '\n');
    }

    // Step 4: Compute keyword scores (optional - don't stop if it fails)
    await runScript('scripts/compute-keyword-scores.js', [], { optional: true });

    // Step 5: Generate embeddings (ONLY if requested)
    if (!config.skipEmbeddings) {
      console.log('\n⚠️  WARNING: This will use OpenAI API credits\n');
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second pause
      await runScript('scripts/generate-embeddings.js', ['--batch-size', '100'], { optional: true });
    } else {
      console.log('\n⏭️  Skipping embeddings (run manually with generate-embeddings.js)\n');
    }

    // Step 6: Analyze results (optional - don't stop if it fails)
    await runScript('scripts/analyze-crawl-results.js', [], { optional: true });

    // Final summary with database stats
    const elapsedMinutes = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log('\n' + '='.repeat(70));
    console.log('🎉 PIPELINE COMPLETE');
    console.log('='.repeat(70));
    console.log(`\n⏱️  Total time: ${elapsedMinutes} minutes`);
    console.log(`   Start: ${new Date(startTime).toLocaleString()}`);
    console.log(`   End: ${new Date().toLocaleString()}\n`);

    // Show quick database stats
    console.log('📊 Quick Stats:');
    console.log('   Run this to see full results:');
    console.log('   node scripts/db-status.js\n');

    console.log('Next steps:');
    console.log('  1. Generate embeddings: node scripts/generate-embeddings.js --batch-size 100');
    console.log('  2. Review keyword scores: SELECT * FROM district_keyword_scores ORDER BY total_score DESC;');
    console.log('  3. Check Tier 1 districts: SELECT * FROM district_keyword_scores WHERE outreach_tier = \'tier1\';');
    console.log('  4. Review failures: Check document_crawl_log for status = \'failure\'\n');

  } catch (error) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ PIPELINE FAILED');
    console.error('='.repeat(70));
    console.error(`\nError: ${error.message}\n`);
    process.exit(1);
  }
}

main();
