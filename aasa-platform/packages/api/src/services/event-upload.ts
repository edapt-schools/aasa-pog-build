/**
 * Event Upload Service
 *
 * Handles CSV parsing, fuzzy district matching, and result enrichment
 * for the event list upload feature.
 */

import { sql } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import * as eventQueries from '../db/queries/events.js'

// ============================================================================
// CSV Parsing
// ============================================================================

interface ParsedRow {
  name: string
  state: string | null
  rawRow: Record<string, string>
}

interface ParseResult {
  rows: ParsedRow[]
  headers: string[]
  nameColumn: string
  stateColumn: string | null
}

/**
 * Known column name patterns for district name detection
 */
const NAME_PATTERNS = [
  /^district[_ ]?name$/i,
  /^district$/i,
  /^name$/i,
  /^lea[_ ]?name$/i,
  /^organization$/i,
  /^school[_ ]?district$/i,
]

const STATE_PATTERNS = [
  /^state$/i,
  /^state[_ ]?code$/i,
  /^st$/i,
  /^state[_ ]?abbr/i,
]

/**
 * Parse CSV buffer into structured rows.
 * Detects name and state columns automatically.
 */
export function parseCSV(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter((line) => line.trim())

  if (lines.length < 2) {
    throw new Error('CSV must contain a header row and at least one data row')
  }

  // Parse header
  const headers = parseCSVLine(lines[0])

  // Auto-detect columns
  const nameColumn = detectColumn(headers, NAME_PATTERNS)
  const stateColumn = detectColumn(headers, STATE_PATTERNS)

  if (!nameColumn) {
    throw new Error(
      'Could not detect a district name column. Expected headers like "District Name", "Name", or "Organization". ' +
      `Found: ${headers.join(', ')}`
    )
  }

  // Parse data rows
  const rows: ParsedRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length === 0) continue

    const rawRow: Record<string, string> = {}
    headers.forEach((header, idx) => {
      rawRow[header] = values[idx] || ''
    })

    const name = rawRow[nameColumn]?.trim()
    if (!name) continue

    rows.push({
      name,
      state: stateColumn ? rawRow[stateColumn]?.trim()?.toUpperCase() || null : null,
      rawRow,
    })
  }

  return { rows, headers, nameColumn, stateColumn }
}

/**
 * Parse a single CSV line, handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // Skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        fields.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
  }

  fields.push(current.trim())
  return fields
}

/**
 * Detect a column from headers matching known patterns
 */
function detectColumn(headers: string[], patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = headers.find((h) => pattern.test(h))
    if (match) return match
  }
  return null
}

// ============================================================================
// Fuzzy Matching
// ============================================================================

interface MatchResult {
  ncesId: string
  name: string
  state: string
  confidence: number
  matchMethod: string
}

/**
 * Normalize a district name for comparison.
 * Strips common suffixes, lowercases, removes punctuation.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(unified|union|elementary|high|school|district|county|office|of|education|public|schools|independent|isd|usd|cusd|juhsd|uhsd)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Simple Levenshtein distance for short-string fuzzy matching
 */
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Fuzzy match a list of district names against the database.
 * Uses PostgreSQL ILIKE for initial candidate retrieval, then refines with
 * normalized name comparison and Levenshtein distance.
 */
export async function matchDistricts(
  rows: ParsedRow[]
): Promise<Map<number, MatchResult>> {
  const db = getDb()
  const matches = new Map<number, MatchResult>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const inputNorm = normalizeName(row.name)

    // Build state filter
    const stateFilter = row.state
      ? sql`AND d.state = ${row.state}`
      : sql``

    // Step 1: Try exact name match
    const exactResults = await db.execute(sql`
      SELECT d.nces_id, d.name, d.state
      FROM districts d
      WHERE LOWER(d.name) = LOWER(${row.name})
      ${stateFilter}
      LIMIT 1
    `)

    if ((exactResults as any[]).length > 0) {
      const r = (exactResults as any[])[0]
      matches.set(i, {
        ncesId: r.nces_id,
        name: r.name,
        state: r.state,
        confidence: 1.0,
        matchMethod: 'exact',
      })
      continue
    }

    // Step 2: Try ILIKE fuzzy candidates
    // Extract first significant word for pattern
    const words = inputNorm.split(' ').filter((w) => w.length > 2)
    if (words.length === 0) continue

    const likePattern = `%${words[0]}%`
    const candidates = await db.execute(sql`
      SELECT d.nces_id, d.name, d.state
      FROM districts d
      WHERE LOWER(d.name) ILIKE ${likePattern}
      ${stateFilter}
      LIMIT 50
    `)

    if ((candidates as any[]).length === 0) continue

    // Step 3: Score candidates by normalized name similarity
    let bestMatch: MatchResult | null = null
    let bestScore = 0

    for (const candidate of candidates as any[]) {
      const candidateNorm = normalizeName(candidate.name)

      // Exact normalized match
      if (candidateNorm === inputNorm) {
        bestMatch = {
          ncesId: candidate.nces_id,
          name: candidate.name,
          state: candidate.state,
          confidence: 0.95,
          matchMethod: 'normalized',
        }
        break
      }

      // Levenshtein-based similarity
      const maxLen = Math.max(candidateNorm.length, inputNorm.length)
      if (maxLen === 0) continue

      const distance = levenshtein(candidateNorm, inputNorm)
      const similarity = 1 - distance / maxLen

      if (similarity > bestScore && similarity >= 0.6) {
        bestScore = similarity
        bestMatch = {
          ncesId: candidate.nces_id,
          name: candidate.name,
          state: candidate.state,
          confidence: parseFloat((similarity * 0.9).toFixed(3)), // Scale down slightly
          matchMethod: 'fuzzy',
        }
      }
    }

    if (bestMatch) {
      matches.set(i, bestMatch)
    }
  }

  return matches
}

// ============================================================================
// Full Upload Pipeline
// ============================================================================

/**
 * Process a full event list upload:
 * 1. Parse CSV
 * 2. Create upload record
 * 3. Fuzzy match districts
 * 4. Enrich with scores
 * 5. Save results
 */
export async function processUpload(
  userId: string,
  fileName: string,
  csvText: string
) {
  // 1. Parse CSV
  const parsed = parseCSV(csvText)

  // 2. Create upload record
  const upload = await eventQueries.createEventUpload({
    userId,
    fileName,
    rowCount: parsed.rows.length,
  })

  try {
    // 3. Fuzzy match districts
    const matches = await matchDistricts(parsed.rows)

    // 4. Build results with score enrichment
    const db = getDb()
    const matchedNcesIds = [...matches.values()].map((m) => m.ncesId)

    // Batch-fetch scores for all matched districts
    const scoreMap = new Map<string, any>()
    if (matchedNcesIds.length > 0) {
      const scoreRows = await db.execute(sql`
        SELECT nces_id, total_score, outreach_tier
        FROM district_keyword_scores
        WHERE nces_id = ANY(${matchedNcesIds})
      `)
      for (const row of scoreRows as any[]) {
        scoreMap.set(row.nces_id, row)
      }
    }

    // 5. Build and insert result records
    const results = parsed.rows.map((row, idx) => {
      const match = matches.get(idx)
      const scoreData = match ? scoreMap.get(match.ncesId) : null

      return {
        uploadId: upload.id,
        rowIndex: idx,
        inputName: row.name,
        inputState: row.state,
        matchedDistrictId: match?.ncesId || null,
        matchConfidence: match ? match.confidence.toString() : null,
        districtScore: scoreData?.total_score?.toString() || null,
        districtTier: scoreData?.outreach_tier || null,
      }
    })

    await eventQueries.insertUploadResults(results)

    // Update upload status
    const matchedCount = results.filter((r) => r.matchedDistrictId).length
    await eventQueries.updateEventUpload(upload.id, {
      matchedCount,
      status: 'completed',
    })

    return {
      uploadId: upload.id,
      rowCount: parsed.rows.length,
      matchedCount,
      status: 'completed',
    }
  } catch (error) {
    // Mark upload as failed
    await eventQueries.updateEventUpload(upload.id, { status: 'failed' })
    throw error
  }
}

/**
 * Generate CSV export of upload results
 */
export function generateResultsCSV(
  results: Array<{
    rowIndex: number
    inputName: string
    inputState: string | null
    matchedDistrictId: string | null
    matchConfidence: string | null
    districtScore: string | null
    districtTier: string | null
    district: {
      name: string
      state: string
      city: string | null
      enrollment: number | null
      superintendentName: string | null
      superintendentEmail: string | null
      websiteDomain: string | null
    } | null
    scores: {
      readiness: string | null
      alignment: string | null
      activation: string | null
      branding: string | null
      total: string | null
      tier: string | null
    } | null
  }>
): string {
  const headers = [
    'Input Name',
    'Input State',
    'Matched District',
    'Matched State',
    'Match Confidence',
    'NCES ID',
    'City',
    'Enrollment',
    'Superintendent',
    'Superintendent Email',
    'Website',
    'Total Score',
    'Readiness',
    'Alignment',
    'Activation',
    'Branding',
    'Tier',
  ]

  const rows = results.map((r) => [
    escapeCSV(r.inputName),
    r.inputState || '',
    r.district?.name || 'NO MATCH',
    r.district?.state || '',
    r.matchConfidence || '',
    r.matchedDistrictId || '',
    r.district?.city || '',
    r.district?.enrollment?.toString() || '',
    r.district?.superintendentName || '',
    r.district?.superintendentEmail || '',
    r.district?.websiteDomain || '',
    r.scores?.total || '',
    r.scores?.readiness || '',
    r.scores?.alignment || '',
    r.scores?.activation || '',
    r.scores?.branding || '',
    r.scores?.tier || '',
  ])

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
