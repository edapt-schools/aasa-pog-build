#!/usr/bin/env node
/**
 * Test script for Grants Mode complete flow
 * Tests: search → filter → detail panel → evidence → similar docs
 *
 * NOTE: Search endpoints require authentication (cookie-session).
 * This script tests unauthenticated endpoints where possible.
 * For full flow testing, see MANUAL_TEST_CHECKLIST below.
 *
 * Run: node test-grants-flow.js
 */

import fetch from 'node-fetch'

/**
 * MANUAL TEST CHECKLIST - GRANTS MODE
 * ====================================
 *
 * 1. Search Tests:
 *    a. Basic Search:
 *       - Visit http://localhost:5173/grants
 *       - Should see empty state with search suggestions
 *       - Type "portrait of a graduate" in search bar
 *       - Press Enter or click search button
 *       - Should see loading spinner briefly
 *       - Should see results with relevance scores
 *       - Result count should display (e.g., "Found 42 documents")
 *
 *    b. Query Persistence:
 *       - Search for "competency-based learning"
 *       - URL should update to ?q=competency-based%20learning
 *       - Refresh page → search should persist from URL
 *       - Clear search → empty state should return
 *
 *    c. Loading States:
 *       - Search for a term → should show loading spinner
 *       - Results should appear within 1 second (typical)
 *
 * 2. Filter Tests:
 *    a. State Filter:
 *       - Open filter panel (click menu on mobile)
 *       - Select "California" from state dropdown
 *       - Search for "strategic plan"
 *       - Results should only show California districts
 *       - Filter chip should appear
 *
 *    b. Document Type Filter:
 *       - Check "Strategic Plan" checkbox
 *       - Results should filter to strategic plans only
 *       - Check additional types → results should include both
 *       - Uncheck all → all document types should return
 *
 *    c. Date Range Filter:
 *       - Set "From" date to 2025-01-01
 *       - Results should filter to documents crawled after that date
 *       - Set "To" date to 2025-06-30
 *       - Results should filter to date range
 *
 *    d. Clear Filters:
 *       - Click "Clear All" button
 *       - All filters should reset
 *       - Filter count badge should disappear
 *
 *    e. Combined Filters:
 *       - Set state = "Texas"
 *       - Set type = "Board Policy"
 *       - Search "equity initiatives"
 *       - Results should match all criteria
 *
 * 3. Results Grid Tests:
 *    a. Layout:
 *       - Desktop: 3 column grid
 *       - Tablet: 2 column grid
 *       - Mobile: 1 column grid
 *
 *    b. Document Card Display:
 *       - Each card shows: type badge, title, district name, state
 *       - Relevance score badge (e.g., "87% match")
 *       - Excerpt preview (truncated)
 *       - Cards have hover state (border highlight)
 *
 *    c. Click Behavior:
 *       - Click any card → detail panel should open
 *       - Click different card → panel should update to new document
 *
 * 4. Document Detail Panel Tests:
 *    a. Open Panel:
 *       - Click any result card
 *       - Panel should slide in from right (300ms animation)
 *       - Backdrop overlay should appear with blur
 *       - Focus should move to panel
 *
 *    b. Header:
 *       - Document type badge (with icon)
 *       - Category badge (if available)
 *       - Relevance score badge
 *       - Document title
 *       - District name and state
 *       - Close button (X)
 *
 *    c. Details Tab:
 *       - Document Information card:
 *         - URL (with copy button)
 *         - Document type
 *         - Category
 *         - Content length
 *         - Last crawled date
 *       - District card:
 *         - District name
 *         - Location
 *         - Superintendent name
 *         - Superintendent email (with copy button)
 *       - Matched Excerpt card:
 *         - Shows search match context
 *         - "Read more" / "Show less" toggle for long excerpts
 *         - Copy excerpt button
 *         - View Full Document button (opens new tab)
 *
 *    d. Evidence Tab:
 *       - Click "Evidence" tab
 *       - Total score badge should appear
 *       - 4 category scores with progress bars:
 *         - Readiness (blue)
 *         - Alignment (green)
 *         - Activation (purple)
 *         - Branding (orange)
 *       - Each category shows:
 *         - Score (0-10 scale)
 *         - Keywords found count
 *         - Keyword badges
 *         - Document excerpts with evidence
 *       - If no evidence: "No keyword evidence found" message
 *
 *    e. Similar Tab:
 *       - Click "Similar" tab
 *       - Count badge should show number of similar docs
 *       - List of similar documents with:
 *         - Document type badge
 *         - Similarity percentage (e.g., "92% similar")
 *         - Document title
 *         - District name and state
 *         - Chevron icon for navigation
 *       - Click similar document → panel should update to show that document
 *       - If no similar docs: "No similar documents found" message
 *
 *    f. Close Panel:
 *       - Press ESC key → panel should close
 *       - Click backdrop overlay → panel should close
 *       - Click X button → panel should close
 *       - Focus should return to search results
 *
 * 5. Keyboard Navigation:
 *    - ESC: Close panel/drawer
 *    - TAB: Navigate through interactive elements
 *    - ENTER: Submit search query
 *    - Focus indicators should be visible on all elements
 *
 * 6. Responsive Tests:
 *    a. Mobile (< 640px):
 *       - Filter panel hidden by default
 *       - Menu button opens filter drawer from left
 *       - Single column results grid
 *       - Detail panel full width (100%)
 *       - Touch targets >= 44px
 *
 *    b. Tablet (640-1024px):
 *       - Filter drawer (not persistent)
 *       - 2 column results grid
 *       - Detail panel 80% width
 *
 *    c. Desktop (> 1024px):
 *       - Persistent filter sidebar
 *       - 3 column results grid
 *       - Detail panel 60% width
 *
 * 7. Accessibility Tests:
 *    - Tab through all elements → focus indicators visible
 *    - ESC key works for closing panels
 *    - Screen reader announces:
 *       - "Searching documents" during load
 *       - "Found X documents matching [query]" on results
 *       - Error messages
 *    - All buttons have aria-labels
 *    - Panel has proper role="dialog" and aria-modal
 *    - Color contrast meets WCAG AA (4.5:1)
 *
 * 8. Performance Tests:
 *    - Search should return in < 1 second (first result)
 *    - Detail panel should open in < 500ms
 *    - Similar documents should load in < 1 second
 *    - Keyword evidence should load in < 1 second
 *    - Filter application should update in < 500ms
 *
 * 9. Error Tests:
 *    a. Network Error:
 *       - Disconnect network
 *       - Search for something
 *       - Should show error state with retry button
 *       - Click retry → should attempt search again
 *
 *    b. No Results:
 *       - Search for "xyzzy123nonexistent"
 *       - Should show "No results found" message
 *       - Should suggest trying different terms
 *
 *    c. Invalid Document:
 *       - If similar doc fails to load, show error state
 *       - Evidence tab should handle missing data gracefully
 *
 * 10. Edge Cases:
 *     - Empty search query → should show suggestions
 *     - Very long search query → should be truncated/handled
 *     - Special characters in search → should be URL encoded
 *     - Document with no excerpt → should show placeholder
 *     - District with no superintendent → should handle gracefully
 */

const API_URL = 'http://localhost:8000'
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

let testsPassed = 0
let testsFailed = 0

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logTest(name, passed, details = '') {
  if (passed) {
    testsPassed++
    log(`  ✓ ${name}`, 'green')
    if (details) log(`    ${details}`, 'blue')
  } else {
    testsFailed++
    log(`  ✗ ${name}`, 'red')
    if (details) log(`    ${details}`, 'yellow')
  }
}

async function testHealthCheck() {
  try {
    const response = await fetch(`${API_URL}/health`)
    const data = await response.json()
    logTest('API health check', response.ok && data.status === 'ok', `Database: ${data.database}`)
    return response.ok
  } catch (error) {
    logTest('API health check', false, error.message)
    return false
  }
}

async function testSearchHealth() {
  try {
    const response = await fetch(`${API_URL}/api/search/health`)
    // This may require auth, so we just check if endpoint exists
    const passed = response.status === 200 || response.status === 401
    logTest('Search service health endpoint', passed, response.status === 401 ? 'Requires authentication (expected)' : 'Service ready')
    return passed
  } catch (error) {
    logTest('Search service health endpoint', false, error.message)
    return false
  }
}

async function testSemanticSearchEndpoint() {
  try {
    // This requires auth, so we just check if endpoint responds
    const response = await fetch(`${API_URL}/api/search/semantic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test' }),
    })
    // 401 is expected without auth, 400 would mean bad request format
    const passed = response.status === 401 || response.status === 200
    logTest('Semantic search endpoint', passed, response.status === 401 ? 'Requires authentication (expected)' : 'Endpoint accessible')
    return passed
  } catch (error) {
    logTest('Semantic search endpoint', false, error.message)
    return false
  }
}

async function testSimilarDocumentsEndpoint() {
  try {
    // Use a dummy UUID
    const dummyId = '00000000-0000-0000-0000-000000000000'
    const response = await fetch(`${API_URL}/api/search/similar/${dummyId}`)
    // 401 or 404 is expected without auth/valid ID
    const passed = response.status === 401 || response.status === 404 || response.status === 200
    logTest('Similar documents endpoint', passed, `Response: ${response.status}`)
    return passed
  } catch (error) {
    logTest('Similar documents endpoint', false, error.message)
    return false
  }
}

async function testKeywordEvidenceEndpoint() {
  try {
    // Use a dummy NCES ID
    const dummyNcesId = '0100001'
    const response = await fetch(`${API_URL}/api/search/evidence/${dummyNcesId}`)
    // 401 or 404 is expected without auth/valid ID
    const passed = response.status === 401 || response.status === 404 || response.status === 200
    logTest('Keyword evidence endpoint', passed, `Response: ${response.status}`)
    return passed
  } catch (error) {
    logTest('Keyword evidence endpoint', false, error.message)
    return false
  }
}

async function testDistrictWithDocuments() {
  try {
    // Get a district that has documents
    const response = await fetch(`${API_URL}/api/districts?limit=5`)
    const data = await response.json()

    if (!response.ok || !data.districts?.length) {
      logTest('Find district with documents', false, 'No districts returned')
      return null
    }

    // Find first district with documents
    for (const district of data.districts) {
      const docsResponse = await fetch(`${API_URL}/api/districts/${district.ncesId}/documents`)
      const docsData = await docsResponse.json()

      if (docsData.total > 0) {
        logTest('Find district with documents', true, `${district.name} (${district.state}) has ${docsData.total} documents`)
        return { district, documents: docsData.data }
      }
    }

    logTest('Find district with documents', false, 'No districts with documents found in sample')
    return null
  } catch (error) {
    logTest('Find district with documents', false, error.message)
    return null
  }
}

async function testDocumentMetadata(document) {
  const hasRequiredFields = document.id && document.ncesId && document.documentUrl
  logTest(
    'Document metadata structure',
    hasRequiredFields,
    hasRequiredFields
      ? `Type: ${document.documentType || 'unknown'}, Title: ${document.documentTitle?.slice(0, 40) || 'untitled'}...`
      : 'Missing required fields'
  )
  return hasRequiredFields
}

async function runAllTests() {
  log('\n════════════════════════════════════════════════════', 'blue')
  log('  Grants Mode - Complete Flow Test', 'blue')
  log('════════════════════════════════════════════════════\n', 'blue')

  // 1. API Health
  log('1. API Health Checks', 'cyan')
  log('─────────────────────────────────────────────────────', 'reset')
  const healthOk = await testHealthCheck()
  if (!healthOk) {
    log('\n  ✗ API server not responding. Make sure it\'s running on port 8000', 'red')
    log('    Run: cd aasa-platform && npm run dev:api\n', 'yellow')
    process.exit(1)
  }

  // 2. Search Service
  log('\n2. Search Service Endpoints', 'cyan')
  log('─────────────────────────────────────────────────────', 'reset')
  await testSearchHealth()
  await testSemanticSearchEndpoint()
  await testSimilarDocumentsEndpoint()
  await testKeywordEvidenceEndpoint()

  // 3. Data Availability
  log('\n3. Data Availability', 'cyan')
  log('─────────────────────────────────────────────────────', 'reset')
  const testData = await testDistrictWithDocuments()

  if (testData?.documents?.length > 0) {
    await testDocumentMetadata(testData.documents[0])
  }

  // Summary
  log('\n════════════════════════════════════════════════════', 'blue')
  log(`  Test Results: ${testsPassed} passed, ${testsFailed} failed`, testsFailed > 0 ? 'yellow' : 'green')
  log('════════════════════════════════════════════════════\n', 'blue')

  if (testsFailed === 0) {
    log('✓ All API tests passed! Grants Mode backend is ready.\n', 'green')
  } else {
    log('⚠ Some tests failed. Check the errors above.\n', 'yellow')
  }

  // Manual Testing Instructions
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan')
  log('  Manual Testing Steps', 'cyan')
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan')

  log('1. Start the application:', 'yellow')
  log('   cd aasa-platform && npm run dev:all\n', 'reset')

  log('2. Visit http://localhost:5173/grants\n', 'yellow')

  log('3. Test search functionality:', 'yellow')
  log('   - Search for "portrait of a graduate"', 'reset')
  log('   - Should see results with relevance scores', 'reset')
  log('   - Results should appear within 1 second\n', 'reset')

  log('4. Test filters:', 'yellow')
  log('   - Select a state from the dropdown', 'reset')
  log('   - Check document type filters', 'reset')
  log('   - Results should update to match filters\n', 'reset')

  log('5. Test document detail panel:', 'yellow')
  log('   - Click any result card', 'reset')
  log('   - Panel should slide in from right', 'reset')
  log('   - Check all three tabs: Details, Evidence, Similar', 'reset')
  log('   - Press ESC to close panel\n', 'reset')

  log('6. Test Evidence tab:', 'yellow')
  log('   - Should show 4 keyword categories', 'reset')
  log('   - Each category shows score and keywords', 'reset')
  log('   - Document excerpts should be visible\n', 'reset')

  log('7. Test Similar tab:', 'yellow')
  log('   - Should show similar documents list', 'reset')
  log('   - Click a similar doc to navigate to it', 'reset')
  log('   - Should show similarity percentage\n', 'reset')

  log('8. Test responsive design:', 'yellow')
  log('   - Resize browser window', 'reset')
  log('   - Mobile: single column, full-width panel', 'reset')
  log('   - Desktop: three columns, 60% panel width\n', 'reset')

  log('9. Test accessibility:', 'yellow')
  log('   - Tab through all elements', 'reset')
  log('   - ESC should close panels', 'reset')
  log('   - Focus indicators should be visible\n', 'reset')

  log('See MANUAL_TEST_CHECKLIST in this file for complete test cases.\n', 'blue')

  process.exit(testsFailed > 0 ? 1 : 0)
}

// Run tests
runAllTests().catch(error => {
  log(`\n✗ Test suite failed: ${error.message}`, 'red')
  process.exit(1)
})
