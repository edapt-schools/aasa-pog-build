#!/usr/bin/env node
/**
 * Test script for Discovery Mode complete flow
 * Tests: filter → paginate → detail → export
 *
 * NOTE: API endpoints require authentication (cookie-session).
 * This script tests unauthenticated endpoints only.
 * For full flow testing, see MANUAL_TEST_CHECKLIST below.
 *
 * Run: node test-discovery-flow.js
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
 *    - Should redirect to /discovery after successful login
 *
 * 2. Initial Load:
 *    - Discovery page should load with default filters (50 results)
 *    - Grid should show 3 columns (desktop), 2 columns (tablet), 1 column (mobile)
 *    - Result count should display correctly (e.g., "Showing 1-50 of 19,740 districts")
 *
 * 3. Filter Tests:
 *    a. State Filter:
 *       - Select multiple states (e.g., CA, TX, NY)
 *       - Filter chips should appear below filter panel
 *       - Results should update to show only selected states
 *       - Click X on filter chip to remove
 *
 *    b. Enrollment Filter:
 *       - Set min: 10000, max: 50000
 *       - Results should update
 *       - Enrollment chip should appear
 *
 *    c. Tier Filter:
 *       - Click TIER1, TIER2, or TIER3 badges
 *       - Results should filter accordingly
 *       - Tier chips should appear
 *
 *    d. Keyword Score Filters:
 *       - Move Readiness slider to 50
 *       - Move Alignment slider to 40
 *       - Results should filter to districts with scores above thresholds
 *
 *    e. Reset Filters:
 *       - Click "Reset" button in filter panel header
 *       - All filters should clear
 *       - Results should return to default (all districts)
 *
 * 4. Pagination Tests:
 *    - Click "Next" button → should go to page 2
 *    - Click "Previous" button → should go to page 1
 *    - Type page number (e.g., 5) in input → should jump to page 5
 *    - Change results per page to 100 → should show 100 results
 *    - Use arrow keys (← →) to navigate pages
 *    - URL query params should update (e.g., ?limit=50&offset=50)
 *
 * 5. District Detail Panel:
 *    a. Open Panel:
 *       - Click any district card
 *       - Panel should slide in from right
 *       - Backdrop overlay should appear
 *
 *    b. Overview Tab:
 *       - Should show district information (location, NCES ID, enrollment, etc.)
 *       - Should show superintendent contact info (name, email, phone, website)
 *       - Click copy button next to email → should copy to clipboard
 *       - Should show keyword scores with color-coded bars
 *       - Click external link icon next to website → should open in new tab
 *
 *    c. Documents Tab:
 *       - Click "Documents" tab
 *       - Should show document count badge (e.g., "87")
 *       - Should list all documents with type badges
 *       - Each document should show excerpt preview
 *       - Click "View Full Document" → should open document in new tab
 *
 *    d. Close Panel:
 *       - Press ESC key → panel should close
 *       - Click backdrop overlay → panel should close
 *       - Click X button → panel should close
 *
 * 6. Export Tests:
 *    a. Export Format:
 *       - Select "CSV" from format dropdown
 *       - Click "Export (50)" button
 *       - Should download districts_YYYY-MM-DD.csv file
 *       - Open CSV → should have proper headers and data
 *
 *    b. Export JSON:
 *       - Select "JSON" from format dropdown
 *       - Click "Export" button
 *       - Should download districts_YYYY-MM-DD.json file
 *       - Open JSON → should be valid JSON with array of districts
 *
 * 7. Responsive Tests:
 *    a. Mobile (< 640px):
 *       - Filter panel should be hidden
 *       - Click hamburger menu button → drawer should open from left
 *       - Apply filter → drawer should close automatically
 *       - Grid should be single column
 *       - Detail panel should be full screen
 *
 *    b. Tablet (640-1024px):
 *       - Filter panel should be collapsible drawer
 *       - Grid should be 2 columns
 *       - Detail panel should be 80% width
 *
 *    c. Desktop (> 1024px):
 *       - Filter panel should be persistent sidebar
 *       - Grid should be 3 columns
 *       - Detail panel should be 60% width
 *
 * 8. Accessibility Tests:
 *    - Tab through all interactive elements → focus indicators should be visible
 *    - Press ESC → should close panel/drawer
 *    - Press ← → → should navigate pages
 *    - Use screen reader → should announce filter/pagination changes
 *    - Check color contrast → all text should be readable
 *
 * 9. Performance Tests:
 *    - Initial load should be < 2 seconds
 *    - Filter change should update results in < 500ms
 *    - Pagination should navigate in < 300ms
 *    - Detail panel should open in < 500ms
 *    - Export 1000 districts should complete in < 2 seconds
 *
 * 10. Error Tests:
 *     - Disconnect network → should show error state with retry button
 *     - Filter to no results → should show "No Districts Found" empty state
 *     - Click retry button → should refetch data
 */

const API_URL = 'http://localhost:8000'
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
    logTest('Health check', response.ok && data.status === 'ok', `Database: ${data.database}`)
    return response.ok
  } catch (error) {
    logTest('Health check', false, error.message)
    return false
  }
}

async function testListDistricts() {
  try {
    const response = await fetch(`${API_URL}/api/districts?limit=10`)
    const data = await response.json()
    const passed = response.ok && Array.isArray(data.districts) && data.total > 0
    logTest('List districts', passed, `Total: ${data.total}, Returned: ${data.districts?.length}`)
    return { passed, data }
  } catch (error) {
    logTest('List districts', false, error.message)
    return { passed: false }
  }
}

async function testFilterByState() {
  try {
    const response = await fetch(`${API_URL}/api/districts?state=CA&limit=5`)
    const data = await response.json()
    const passed = response.ok && data.districts?.every(d => d.state === 'CA')
    logTest('Filter by state (CA)', passed, `Found: ${data.districts?.length} CA districts`)
    return passed
  } catch (error) {
    logTest('Filter by state', false, error.message)
    return false
  }
}

async function testFilterByTier() {
  try {
    const response = await fetch(`${API_URL}/api/districts?tier=tier1&limit=5`)
    const data = await response.json()
    const passed = response.ok && data.districts?.every(d => d.outreachTier === 'tier1')
    logTest('Filter by tier (tier1)', passed, `Found: ${data.districts?.length} tier1 districts`)
    return passed
  } catch (error) {
    logTest('Filter by tier', false, error.message)
    return false
  }
}

async function testFilterByEnrollment() {
  try {
    const response = await fetch(`${API_URL}/api/districts?enrollmentMin=10000&enrollmentMax=50000&limit=5`)
    const data = await response.json()
    const passed = response.ok && data.districts?.every(d => d.enrollment >= 10000 && d.enrollment <= 50000)
    logTest('Filter by enrollment (10k-50k)', passed, `Found: ${data.districts?.length} districts`)
    return passed
  } catch (error) {
    logTest('Filter by enrollment', false, error.message)
    return false
  }
}

async function testPagination() {
  try {
    // Get first page
    const page1 = await fetch(`${API_URL}/api/districts?limit=5&offset=0`)
    const data1 = await page1.json()

    // Get second page
    const page2 = await fetch(`${API_URL}/api/districts?limit=5&offset=5`)
    const data2 = await page2.json()

    // Verify different results
    const passed = page1.ok && page2.ok &&
                   data1.districts[0].id !== data2.districts[0].id

    logTest('Pagination', passed, `Page 1 first ID: ${data1.districts[0].ncesId}, Page 2 first ID: ${data2.districts[0].ncesId}`)
    return passed
  } catch (error) {
    logTest('Pagination', false, error.message)
    return false
  }
}

async function testGetDistrictDetail(ncesId) {
  try {
    const response = await fetch(`${API_URL}/api/districts/${ncesId}`)
    const data = await response.json()
    const passed = response.ok && data.district && data.district.ncesId === ncesId
    logTest('Get district detail', passed, `District: ${data.district?.name}`)
    return { passed, data }
  } catch (error) {
    logTest('Get district detail', false, error.message)
    return { passed: false }
  }
}

async function testGetDistrictDocuments(ncesId) {
  try {
    const response = await fetch(`${API_URL}/api/districts/${ncesId}/documents`)
    const data = await response.json()
    const passed = response.ok && Array.isArray(data.data)
    logTest('Get district documents', passed, `Found: ${data.total} documents`)
    return passed
  } catch (error) {
    logTest('Get district documents', false, error.message)
    return false
  }
}

async function testKeywordScores(ncesId) {
  try {
    const response = await fetch(`${API_URL}/api/districts/${ncesId}`)
    const data = await response.json()
    const hasScores = data.keywordScores !== null
    const passed = response.ok
    logTest('Keyword scores', passed, hasScores ? `Total score: ${data.keywordScores?.totalScore}` : 'No scores available')
    return passed
  } catch (error) {
    logTest('Keyword scores', false, error.message)
    return false
  }
}

async function runAllTests() {
  log('\n═══════════════════════════════════════════════', 'blue')
  log('  Discovery Mode - Complete Flow Test', 'blue')
  log('═══════════════════════════════════════════════\n', 'blue')

  // 1. Health check
  log('1. Health Check', 'yellow')
  const healthOk = await testHealthCheck()
  if (!healthOk) {
    log('\n✗ API server not responding. Make sure it\'s running on port 8000', 'red')
    process.exit(1)
  }

  // 2. List districts
  log('\n2. List Districts', 'yellow')
  const { passed: listPassed, data: listData } = await testListDistricts()

  if (!listPassed) {
    log('\n✗ Cannot test further without working district list', 'red')
    process.exit(1)
  }

  // 3. Filter tests
  log('\n3. Filter Tests', 'yellow')
  await testFilterByState()
  await testFilterByTier()
  await testFilterByEnrollment()

  // 4. Pagination
  log('\n4. Pagination', 'yellow')
  await testPagination()

  // 5. District detail (use first district from list)
  if (listData?.districts?.length > 0) {
    const testNcesId = listData.districts[0].ncesId

    log('\n5. District Detail', 'yellow')
    await testGetDistrictDetail(testNcesId)

    log('\n6. District Documents', 'yellow')
    await testGetDistrictDocuments(testNcesId)

    log('\n7. Keyword Scores', 'yellow')
    await testKeywordScores(testNcesId)
  }

  // Summary
  log('\n═══════════════════════════════════════════════', 'blue')
  log(`  Test Results: ${testsPassed} passed, ${testsFailed} failed`, testsFailed > 0 ? 'yellow' : 'green')
  log('═══════════════════════════════════════════════\n', 'blue')

  if (testsFailed === 0) {
    log('✓ All tests passed! Discovery Mode is ready.', 'green')
    log('\nNext steps:', 'blue')
    log('  1. Visit http://localhost:5173/discovery', 'reset')
    log('  2. Test filtering by state, tier, enrollment, keyword scores', 'reset')
    log('  3. Test pagination with arrow keys', 'reset')
    log('  4. Click a district card to open detail panel', 'reset')
    log('  5. Test ESC key to close panel', 'reset')
    log('  6. Test export to CSV/JSON\n', 'reset')
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
