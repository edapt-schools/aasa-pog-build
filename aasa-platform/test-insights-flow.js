#!/usr/bin/env node
/**
 * Test script for Insights Mode complete flow
 * Tests: overview → states → state detail → trending
 *
 * NOTE: API endpoints require authentication (cookie-session).
 * This script tests unauthenticated endpoints only.
 * For full flow testing, see MANUAL_TEST_CHECKLIST below.
 *
 * Run: node test-insights-flow.js
 */

import fetch from 'node-fetch'

/**
 * MANUAL TEST CHECKLIST
 * =====================
 *
 * 1. Authentication:
 *    - Visit http://localhost:5173
 *    - Should redirect to /login
 *    - Click "Sign in with Google" or "Sign in with Microsoft"
 *    - Navigate to /insights after successful login
 *
 * 2. Initial Load:
 *    - Insights page should load with all components
 *    - Overview cards should show national statistics
 *    - US map should render with states colored
 *    - Tier distribution chart should show pie/donut
 *    - Trending keywords chart should show bar chart
 *    - State comparison table should show top 20 states
 *
 * 3. Overview Cards Tests:
 *    a. Total Districts:
 *       - Should show ~19,740 districts
 *       - Subtitle should say "US public school districts"
 *
 *    b. Superintendent Coverage:
 *       - Should show percentage (e.g., 33.5%)
 *       - Subtitle should show actual count (e.g., "6,619 contacts")
 *
 *    c. Documents Analyzed:
 *       - Should show document count (e.g., 3,597)
 *       - Subtitle should say "PDFs, strategic plans, & more"
 *
 *    d. Average Score:
 *       - Should show average score (0-10 scale)
 *       - Subtitle should say "Across all scored districts"
 *
 * 4. State Map Tests:
 *    a. Map Rendering:
 *       - All 50 states + DC should be visible
 *       - States should be colored based on metric
 *       - Legend should show color scale
 *
 *    b. Metric Toggle:
 *       - Click "Coverage %" → map colors by superintendent coverage
 *       - Click "Avg Score" → map colors by average score
 *       - Click "Districts" → map colors by district count
 *       - Click "Tier 1" → map colors by Tier 1 count
 *
 *    c. Hover Tooltip:
 *       - Hover over any state → tooltip should appear
 *       - Tooltip should show state name and metric value
 *
 *    d. State Click:
 *       - Click any state → detail panel should slide in
 *       - Map state should highlight (thicker border)
 *
 * 5. Tier Distribution Chart Tests:
 *    a. Chart Rendering:
 *       - Donut/pie chart should render
 *       - Three segments: Tier 1 (green), Tier 2 (amber), Tier 3 (gray)
 *       - Percentages should be visible on segments
 *
 *    b. Tooltip:
 *       - Hover on segment → tooltip shows count and percentage
 *
 *    c. Summary Stats:
 *       - Below chart: three numbers for each tier
 *
 * 6. Trending Keywords Tests:
 *    a. Chart Rendering:
 *       - Horizontal bar chart with top 10 keywords
 *       - Bars colored by category
 *
 *    b. Period Toggle:
 *       - Click "7 Days" → chart updates
 *       - Click "30 Days" → chart updates
 *       - Click "90 Days" → chart updates
 *
 *    c. Category Filter:
 *       - Click "readiness" badge → filters to readiness keywords only
 *       - Click "All" → shows all categories
 *
 *    d. Tooltip:
 *       - Hover bar → tooltip shows full keyword, category, district count
 *
 * 7. State Comparison Table Tests:
 *    a. Table Rendering:
 *       - Shows top 20 states by district count
 *       - Columns: State, Districts, Coverage, Avg Score, Tier 1, Documents, Action
 *
 *    b. Coverage Coloring:
 *       - >= 50%: green text
 *       - >= 25%: amber text
 *       - < 25%: gray text
 *
 *    c. View Button:
 *       - Click "View" → opens state detail panel
 *
 * 8. State Detail Panel Tests:
 *    a. Panel Open:
 *       - Click state on map or "View" in table → panel slides in from right
 *       - Backdrop overlay appears
 *
 *    b. Quick Stats:
 *       - Shows coverage % and document count cards
 *
 *    c. Score Breakdown:
 *       - Four progress bars: Readiness, Alignment, Activation, Branding
 *       - Bars colored by category
 *
 *    d. Tier Distribution:
 *       - Three boxes showing Tier 1, 2, 3 counts
 *
 *    e. Top Districts:
 *       - List of top 10 districts by score
 *       - Each shows name, NCES ID, tier badge, score
 *
 *    f. View in Discovery Button:
 *       - Click → navigates to /discovery?state=XX
 *
 *    g. Close Panel:
 *       - Press ESC → panel closes
 *       - Click backdrop → panel closes
 *       - Click X button → panel closes
 *
 * 9. Responsive Tests:
 *    a. Mobile (< 640px):
 *       - Cards stack vertically (1 column)
 *       - Map takes full width
 *       - Table scrolls horizontally
 *       - Panel is full width
 *
 *    b. Tablet (640-1024px):
 *       - Cards in 2x2 grid
 *       - Map takes full width
 *       - Panel is 80% width
 *
 *    c. Desktop (> 1024px):
 *       - Cards in 4-column row
 *       - Map and tier chart side by side (2:1)
 *       - Panel is 480px width
 *
 * 10. Performance Tests:
 *     - Initial load: < 2 seconds
 *     - Map render: < 1 second
 *     - State panel open: < 500ms
 *     - Period toggle: < 500ms
 *
 * 11. Error Tests:
 *     - Disconnect network → should show error state
 *     - Click retry → should refetch data
 */

const API_URL = 'http://localhost:4000'
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
  blue: '\x1b[34m',
}

let testsPassed = 0
let testsFailed = 0

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logTest(name, passed, details = '') {
  if (passed) {
    testsPassed++
    log(`✓ ${name}`, 'green')
    if (details) log(`  ${details}`, 'blue')
  } else {
    testsFailed++
    log(`✗ ${name}`, 'red')
    if (details) log(`  ${details}`, 'yellow')
  }
}

async function testHealthCheck() {
  try {
    const response = await fetch(`${API_URL}/health`)
    const data = await response.json()
    logTest('Health check', response.ok && data.status === 'ok', `Status: ${data.status}`)
    return response.ok
  } catch (error) {
    logTest('Health check', false, error.message)
    return false
  }
}

async function testInsightsOverview() {
  try {
    const response = await fetch(`${API_URL}/api/insights/overview`)
    const data = await response.json()

    const passed = response.ok &&
      typeof data.totalDistricts === 'number' &&
      data.superintendentCoverage &&
      data.tierDistribution &&
      data.averageScores

    logTest(
      'GET /api/insights/overview',
      passed,
      `Districts: ${data.totalDistricts}, Coverage: ${data.superintendentCoverage?.percent}%`
    )

    return { passed, data }
  } catch (error) {
    logTest('GET /api/insights/overview', false, error.message)
    return { passed: false }
  }
}

async function testAllStateStats() {
  try {
    const response = await fetch(`${API_URL}/api/insights/states`)
    const data = await response.json()

    const passed = response.ok &&
      Array.isArray(data.states) &&
      data.states.length > 0

    const stateCount = data.states?.length || 0
    const sampleState = data.states?.[0]

    logTest(
      'GET /api/insights/states',
      passed,
      `Found ${stateCount} states, Sample: ${sampleState?.stateName} (${sampleState?.totalDistricts} districts)`
    )

    return { passed, data }
  } catch (error) {
    logTest('GET /api/insights/states', false, error.message)
    return { passed: false }
  }
}

async function testStateDetail(stateCode = 'CA') {
  try {
    const response = await fetch(`${API_URL}/api/insights/states/${stateCode}`)
    const data = await response.json()

    const passed = response.ok &&
      data.stateCode === stateCode &&
      data.stateName &&
      data.totalDistricts > 0 &&
      data.scoreStats &&
      Array.isArray(data.topDistricts)

    logTest(
      `GET /api/insights/states/${stateCode}`,
      passed,
      `${data.stateName}: ${data.totalDistricts} districts, ${data.documentsCount} docs`
    )

    return { passed, data }
  } catch (error) {
    logTest(`GET /api/insights/states/${stateCode}`, false, error.message)
    return { passed: false }
  }
}

async function testInvalidStateCode() {
  try {
    const response = await fetch(`${API_URL}/api/insights/states/INVALID`)
    const passed = response.status === 400

    logTest(
      'Invalid state code returns 400',
      passed,
      `Status: ${response.status}`
    )

    return passed
  } catch (error) {
    logTest('Invalid state code returns 400', false, error.message)
    return false
  }
}

async function testTrendingKeywords(period = '30d') {
  try {
    const response = await fetch(`${API_URL}/api/insights/trending?period=${period}`)
    const data = await response.json()

    const passed = response.ok &&
      data.period === period &&
      Array.isArray(data.keywords)

    const keywordCount = data.keywords?.length || 0
    const topKeyword = data.keywords?.[0]

    logTest(
      `GET /api/insights/trending?period=${period}`,
      passed,
      `Found ${keywordCount} keywords, Top: "${topKeyword?.keyword}" (${topKeyword?.currentCount})`
    )

    return { passed, data }
  } catch (error) {
    logTest(`GET /api/insights/trending?period=${period}`, false, error.message)
    return { passed: false }
  }
}

async function testInvalidPeriod() {
  try {
    const response = await fetch(`${API_URL}/api/insights/trending?period=invalid`)
    const passed = response.status === 400

    logTest(
      'Invalid period returns 400',
      passed,
      `Status: ${response.status}`
    )

    return passed
  } catch (error) {
    logTest('Invalid period returns 400', false, error.message)
    return false
  }
}

async function runAllTests() {
  log('\n═══════════════════════════════════════════════', 'blue')
  log('  Insights Mode - Complete Flow Test', 'blue')
  log('═══════════════════════════════════════════════\n', 'blue')

  // 1. Health check
  log('1. Health Check', 'yellow')
  const healthOk = await testHealthCheck()
  if (!healthOk) {
    log('\n✗ API server not responding. Make sure it\'s running on port 4000', 'red')
    process.exit(1)
  }

  // 2. Insights Overview
  log('\n2. Insights Overview', 'yellow')
  const { passed: overviewPassed } = await testInsightsOverview()

  // 3. All State Stats
  log('\n3. State Statistics', 'yellow')
  const { passed: statesPassed, data: statesData } = await testAllStateStats()

  // 4. State Detail
  log('\n4. State Detail', 'yellow')
  // Test with a few different states
  await testStateDetail('CA')
  await testStateDetail('TX')
  await testStateDetail('NY')

  // 5. Invalid State Code
  log('\n5. Error Handling', 'yellow')
  await testInvalidStateCode()

  // 6. Trending Keywords
  log('\n6. Trending Keywords', 'yellow')
  await testTrendingKeywords('7d')
  await testTrendingKeywords('30d')
  await testTrendingKeywords('90d')

  // 7. Invalid Period
  log('\n7. Trending Error Handling', 'yellow')
  await testInvalidPeriod()

  // Summary
  log('\n═══════════════════════════════════════════════', 'blue')
  log(`  Test Results: ${testsPassed} passed, ${testsFailed} failed`, testsFailed > 0 ? 'yellow' : 'green')
  log('═══════════════════════════════════════════════\n', 'blue')

  if (testsFailed === 0) {
    log('✓ All tests passed! Insights Mode API is ready.', 'green')
    log('\nNext steps:', 'blue')
    log('  1. Visit http://localhost:5173/insights', 'reset')
    log('  2. Verify overview cards show national statistics', 'reset')
    log('  3. Click states on map to open detail panel', 'reset')
    log('  4. Toggle metric buttons to change map coloring', 'reset')
    log('  5. Toggle period buttons on trending chart', 'reset')
    log('  6. Test ESC key to close panel\n', 'reset')
  } else {
    log('✗ Some tests failed. Check the errors above.', 'red')
    process.exit(1)
  }
}

// Run tests
runAllTests().catch(error => {
  log(`\n✗ Test suite failed: ${error.message}`, 'red')
  process.exit(1)
})
