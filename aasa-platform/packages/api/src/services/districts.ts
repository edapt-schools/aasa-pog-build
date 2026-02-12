import { eq, and, gte, lte, inArray, ilike, sql, count } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import * as schema from '../db/schema.js'
import type {
  ListDistrictsParams,
  ListDistrictsResponse,
  DistrictDetailResponse,
  DistrictDocumentsResponse,
} from '@aasa-platform/shared'

/**
 * List districts with filters and pagination
 */
export async function listDistricts(
  params: ListDistrictsParams
): Promise<ListDistrictsResponse> {
  const db = getDb()

  // Pagination defaults
  const limit = params.limit || 50
  const offset = params.offset || 0

  // Build WHERE conditions
  const conditions = []

  // State filter (multi-select)
  if (params.state && params.state.length > 0) {
    conditions.push(inArray(schema.districts.state, params.state))
  }

  // Enrollment range
  if (params.enrollmentMin !== undefined) {
    conditions.push(gte(schema.districts.enrollment, params.enrollmentMin))
  }
  if (params.enrollmentMax !== undefined) {
    conditions.push(lte(schema.districts.enrollment, params.enrollmentMax))
  }

  // Has superintendent (email not null)
  if (params.hasSuperintendent !== undefined) {
    if (params.hasSuperintendent) {
      conditions.push(sql`
        EXISTS (
          SELECT 1
          FROM national_registry nr
          WHERE nr.nces_id = ${schema.districts.ncesId}
            AND (nr.superintendent_name IS NOT NULL OR nr.superintendent_email IS NOT NULL)
        )
      `)
    } else {
      conditions.push(sql`
        NOT EXISTS (
          SELECT 1
          FROM national_registry nr
          WHERE nr.nces_id = ${schema.districts.ncesId}
            AND (nr.superintendent_name IS NOT NULL OR nr.superintendent_email IS NOT NULL)
        )
      `)
    }
  }

  // Name / superintendent search (case-insensitive)
  if (params.search) {
    const likeValue = `%${params.search}%`
    conditions.push(
      sql`(
        ${ilike(schema.districts.name, likeValue)}
        OR EXISTS (
          SELECT 1
          FROM national_registry nr
          WHERE nr.nces_id = ${schema.districts.ncesId}
            AND (
              nr.district_name ILIKE ${likeValue}
              OR nr.superintendent_name ILIKE ${likeValue}
            )
        )
      )`
    )
  }

  // FRPL % range
  if (params.frplMin !== undefined) {
    conditions.push(sql`${schema.districts.frplPercent}::decimal >= ${params.frplMin}`)
  }
  if (params.frplMax !== undefined) {
    conditions.push(sql`${schema.districts.frplPercent}::decimal <= ${params.frplMax}`)
  }

  // Minority % range
  if (params.minorityMin !== undefined) {
    conditions.push(sql`${schema.districts.minorityPercent}::decimal >= ${params.minorityMin}`)
  }
  if (params.minorityMax !== undefined) {
    conditions.push(sql`${schema.districts.minorityPercent}::decimal <= ${params.minorityMax}`)
  }

  // Locale type (NCES codes: 11-13=city, 21-23=suburb, 31-33=town, 41-43=rural)
  if (params.localeType && params.localeType.length > 0) {
    const localePrefixes: Record<string, string[]> = {
      city: ['11', '12', '13'],
      suburb: ['21', '22', '23'],
      town: ['31', '32', '33'],
      rural: ['41', '42', '43'],
    }
    const codes = params.localeType.flatMap((t) => localePrefixes[t] || [])
    if (codes.length > 0) {
      conditions.push(inArray(schema.districts.localeCode, codes))
    }
  }

  // Outreach tier (multi-select)
  if (params.outreachTier && params.outreachTier.length > 0) {
    conditions.push(inArray(schema.districtKeywordScores.outreachTier, params.outreachTier))
  }

  // Keyword score thresholds
  if (params.readinessScoreMin !== undefined) {
    conditions.push(sql`${schema.districtKeywordScores.readinessScore}::decimal >= ${params.readinessScoreMin}`)
  }
  if (params.alignmentScoreMin !== undefined) {
    conditions.push(sql`${schema.districtKeywordScores.alignmentScore}::decimal >= ${params.alignmentScoreMin}`)
  }
  if (params.activationScoreMin !== undefined) {
    conditions.push(sql`${schema.districtKeywordScores.activationScore}::decimal >= ${params.activationScoreMin}`)
  }
  if (params.brandingScoreMin !== undefined) {
    conditions.push(sql`${schema.districtKeywordScores.brandingScore}::decimal >= ${params.brandingScoreMin}`)
  }

  // Build query
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // Get total count
  const [{ total }] = await db
    .select({ total: count() })
    .from(schema.districts)
    .leftJoin(
      schema.districtKeywordScores,
      eq(schema.districts.ncesId, schema.districtKeywordScores.ncesId)
    )
    .where(whereClause)

  // Get paginated results
  const districts = await db
    .select({
      district: schema.districts,
      keywordScores: schema.districtKeywordScores,
    })
    .from(schema.districts)
    .leftJoin(
      schema.districtKeywordScores,
      eq(schema.districts.ncesId, schema.districtKeywordScores.ncesId)
    )
    .where(whereClause)
    .limit(limit)
    .offset(offset)
    .orderBy(schema.districts.name)

  const ncesIds = districts
    .map((row) => row.district.ncesId)
    .filter((id): id is string => Boolean(id))

  const nationalRows = ncesIds.length > 0
    ? await db.execute(sql`
      SELECT
        nr.nces_id,
        nr.district_name,
        nr.state,
        nr.city,
        nr.county,
        nr.enrollment,
        nr.grades_served,
        nr.locale_code,
        nr.website,
        nr.superintendent_name,
        nr.superintendent_email,
        nr.phone
      FROM national_registry nr
      WHERE nr.nces_id = ANY(${ncesIds}::text[])
    `)
    : []

  const nationalMap = new Map<string, any>(
    (nationalRows as any[]).map((row) => [row.nces_id as string, row]),
  )

  return {
    data: districts.map((row) => {
      const merged = nationalMap.get(row.district.ncesId || '')
      return serializeDistrictWithNational(row.district, merged)
    }),
    pagination: {
      total: Number(total),
      limit,
      offset,
      hasMore: offset + limit < Number(total),
    },
  }
}

/**
 * Get single district by NCES ID
 */
export async function getDistrictByNcesId(
  ncesId: string
): Promise<DistrictDetailResponse | null> {
  const db = getDb()

  // Get district
  const [district] = await db
    .select()
    .from(schema.districts)
    .where(eq(schema.districts.ncesId, ncesId))
    .limit(1)

  if (!district) {
    return null
  }

  const nationalRows = await db.execute(sql`
    SELECT
      nr.nces_id,
      nr.district_name,
      nr.state,
      nr.city,
      nr.county,
      nr.enrollment,
      nr.grades_served,
      nr.locale_code,
      nr.website,
      nr.superintendent_name,
      nr.superintendent_email,
      nr.phone
    FROM national_registry nr
    WHERE nr.nces_id = ${ncesId}
    LIMIT 1
  `)
  const national = (nationalRows as any[])[0]

  // Get keyword scores
  const [keywordScores] = await db
    .select()
    .from(schema.districtKeywordScores)
    .where(eq(schema.districtKeywordScores.ncesId, ncesId))
    .limit(1)

  // Get document count
  const [{ documentCount }] = await db
    .select({ documentCount: count() })
    .from(schema.districtDocuments)
    .where(eq(schema.districtDocuments.ncesId, ncesId))

  return {
    district: serializeDistrictWithNational(district, national),
    keywordScores: keywordScores ? serializeKeywordScores(keywordScores) : null,
    documentCount: Number(documentCount),
  }
}

/**
 * Get documents for a district
 */
export async function getDistrictDocuments(
  ncesId: string
): Promise<DistrictDocumentsResponse> {
  const db = getDb()

  const documents = await db
    .select()
    .from(schema.districtDocuments)
    .where(eq(schema.districtDocuments.ncesId, ncesId))
    .orderBy(schema.districtDocuments.discoveredAt)

  return {
    data: documents.map(serializeDocument),
    total: documents.length,
  }
}

// =============================================================================
// Serialization helpers (convert DB types to API types)
// =============================================================================

function serializeDistrict(district: typeof schema.districts.$inferSelect) {
  return {
    ...district,
    createdAt: district.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: district.updatedAt?.toISOString() || new Date().toISOString(),
    lastScrapedAt: district.lastScrapedAt?.toISOString() || null,
    frplPercent: district.frplPercent?.toString() || null,
    minorityPercent: district.minorityPercent?.toString() || null,
  }
}

function serializeDistrictWithNational(
  district: typeof schema.districts.$inferSelect,
  national?: any,
) {
  const base = serializeDistrict(district)

  if (!national) return base

  return {
    ...base,
    name: national.district_name || base.name,
    state: national.state || base.state,
    city: national.city || base.city,
    county: national.county || base.county,
    enrollment: national.enrollment ?? base.enrollment,
    gradesServed: national.grades_served || base.gradesServed,
    localeCode: national.locale_code || base.localeCode,
    websiteDomain: national.website || base.websiteDomain,
    superintendentName: national.superintendent_name || base.superintendentName,
    superintendentEmail: national.superintendent_email || base.superintendentEmail,
    phone: national.phone || base.phone,
  }
}

function serializeKeywordScores(
  scores: typeof schema.districtKeywordScores.$inferSelect
) {
  return {
    ...scores,
    readinessScore: scores.readinessScore?.toString() || null,
    alignmentScore: scores.alignmentScore?.toString() || null,
    activationScore: scores.activationScore?.toString() || null,
    brandingScore: scores.brandingScore?.toString() || null,
    totalScore: scores.totalScore?.toString() || null,
    keywordMatches: (scores.keywordMatches as Record<string, unknown>) || null,
    scoredAt: scores.scoredAt?.toISOString() || null,
    updatedAt: scores.updatedAt?.toISOString() || null,
  }
}

function serializeDocument(doc: typeof schema.districtDocuments.$inferSelect) {
  return {
    ...doc,
    discoveredAt: doc.discoveredAt?.toISOString() || null,
    lastCrawledAt: doc.lastCrawledAt?.toISOString() || null,
  }
}
