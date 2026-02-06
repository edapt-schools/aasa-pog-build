import { eq, and, gte, lte, ilike, or, sql } from 'drizzle-orm'
import { getDb } from '../index.js'
import { districts, districtDocuments, districtKeywordScores } from '../schema.js'
import type { District, DistrictDocument } from '@aasa-platform/shared'

export interface DistrictFilters {
  state?: string
  minEnrollment?: number
  maxEnrollment?: number
  tier?: string
  search?: string
  hasSuperintendent?: boolean
}

export interface Pagination {
  page?: number
  limit?: number
}

/**
 * Get a single district by NCES ID
 */
export async function getDistrictById(ncesId: string): Promise<District | null> {
  const db = getDb()

  const result = await db.select().from(districts).where(eq(districts.ncesId, ncesId)).limit(1)

  if (result.length === 0) {
    return null
  }

  return serializeDistrict(result[0])
}

/**
 * List districts with filters and pagination
 */
export async function listDistricts(
  filters: DistrictFilters = {},
  pagination: Pagination = {}
): Promise<{ districts: District[]; total: number }> {
  const db = getDb()

  // Build WHERE conditions
  const conditions = []

  if (filters.state) {
    conditions.push(eq(districts.state, filters.state))
  }

  if (filters.minEnrollment !== undefined) {
    conditions.push(gte(districts.enrollment, filters.minEnrollment))
  }

  if (filters.maxEnrollment !== undefined) {
    conditions.push(lte(districts.enrollment, filters.maxEnrollment))
  }

  if (filters.search) {
    conditions.push(
      or(
        ilike(districts.name, `%${filters.search}%`),
        ilike(districts.superintendentName, `%${filters.search}%`)
      )
    )
  }

  if (filters.hasSuperintendent === true) {
    conditions.push(sql`${districts.superintendentEmail} IS NOT NULL`)
  } else if (filters.hasSuperintendent === false) {
    conditions.push(sql`${districts.superintendentEmail} IS NULL`)
  }

  // Apply pagination
  const page = pagination.page || 1
  const limit = pagination.limit || 50
  const offset = (page - 1) * limit

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(districts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)

  const total = countResult[0]?.count || 0

  // Get paginated results
  const results = await db
    .select()
    .from(districts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(districts.name)
    .limit(limit)
    .offset(offset)

  return {
    districts: results.map(serializeDistrict),
    total,
  }
}

/**
 * Get all documents for a district
 */
export async function getDistrictDocuments(ncesId: string): Promise<DistrictDocument[]> {
  const db = getDb()

  const results = await db
    .select()
    .from(districtDocuments)
    .where(eq(districtDocuments.ncesId, ncesId))
    .orderBy(districtDocuments.documentType)

  return results.map(serializeDocument)
}

/**
 * Get keyword scores for a district
 */
export async function getKeywordScores(ncesId: string) {
  const db = getDb()

  const results = await db
    .select()
    .from(districtKeywordScores)
    .where(eq(districtKeywordScores.ncesId, ncesId))
    .limit(1)

  if (results.length === 0) {
    return null
  }

  const scores = results[0]

  return {
    ncesId: scores.ncesId,
    readinessScore: scores.readinessScore?.toString() || null,
    alignmentScore: scores.alignmentScore?.toString() || null,
    activationScore: scores.activationScore?.toString() || null,
    brandingScore: scores.brandingScore?.toString() || null,
    totalScore: scores.totalScore?.toString() || null,
    outreachTier: scores.outreachTier,
    keywordMatches: (scores.keywordMatches as Record<string, unknown>) || null,
  }
}

/**
 * Get districts by state (for batch operations)
 */
export async function getDistrictsByState(state: string): Promise<District[]> {
  const db = getDb()

  const results = await db
    .select()
    .from(districts)
    .where(eq(districts.state, state))
    .orderBy(districts.name)

  return results.map(serializeDistrict)
}

/**
 * Count districts by criteria
 */
export async function countDistricts(filters: DistrictFilters = {}): Promise<number> {
  const db = getDb()

  const conditions = []

  if (filters.state) {
    conditions.push(eq(districts.state, filters.state))
  }

  if (filters.tier) {
    // Join with keyword scores to filter by tier
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(districts)
      .leftJoin(districtKeywordScores, eq(districts.ncesId, districtKeywordScores.ncesId))
      .where(
        conditions.length > 0
          ? and(...conditions, eq(districtKeywordScores.outreachTier, filters.tier))
          : eq(districtKeywordScores.outreachTier, filters.tier)
      )

    return result[0]?.count || 0
  }

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(districts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)

  return result[0]?.count || 0
}

// Serialization helpers
function serializeDistrict(district: any): District {
  return {
    id: district.id,
    ncesId: district.ncesId,
    name: district.name,
    state: district.state,
    city: district.city,
    county: district.county,
    enrollment: district.enrollment,
    gradesServed: district.gradesServed,
    localeCode: district.localeCode,
    frplPercent: district.frplPercent?.toString() || null,
    minorityPercent: district.minorityPercent?.toString() || null,
    websiteDomain: district.websiteDomain,
    superintendentName: district.superintendentName,
    superintendentEmail: district.superintendentEmail,
    phone: district.phone,
    address: district.address,
    lastScrapedAt: district.lastScrapedAt?.toISOString() || null,
    scrapeStatus: district.scrapeStatus,
    scrapeError: district.scrapeError,
    createdAt: district.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: district.updatedAt?.toISOString() || new Date().toISOString(),
  }
}

function serializeDocument(doc: any): DistrictDocument {
  return {
    id: doc.id,
    ncesId: doc.ncesId,
    documentUrl: doc.documentUrl,
    documentType: doc.documentType,
    documentTitle: doc.documentTitle,
    documentCategory: doc.documentCategory,
    extractedText: doc.extractedText,
    textLength: doc.textLength,
    extractionMethod: doc.extractionMethod,
    pageDepth: doc.pageDepth,
    discoveredAt: doc.discoveredAt?.toISOString() || null,
    lastCrawledAt: doc.lastCrawledAt?.toISOString() || null,
    contentHash: doc.contentHash,
  }
}
