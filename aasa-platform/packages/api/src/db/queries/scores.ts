import { eq, and, sql, desc } from 'drizzle-orm'
import { getDb } from '../index.js'
import { districtKeywordScores, districts } from '../schema.js'

export interface ScoreFilters {
  minReadinessScore?: number
  minAlignmentScore?: number
  minActivationScore?: number
  minBrandingScore?: number
  minTotalScore?: number
  tier?: string
  state?: string
}

/**
 * Get keyword scores for a single district
 */
export async function getScoresByNcesId(ncesId: string) {
  const db = getDb()

  const results = await db
    .select()
    .from(districtKeywordScores)
    .where(eq(districtKeywordScores.ncesId, ncesId))
    .limit(1)

  if (results.length === 0) {
    return null
  }

  return serializeScore(results[0])
}

/**
 * Get districts by score thresholds
 */
export async function getDistrictsByScores(filters: ScoreFilters, limit: number = 50) {
  const db = getDb()

  const conditions = []

  if (filters.minReadinessScore !== undefined) {
    conditions.push(sql`${districtKeywordScores.readinessScore}::decimal >= ${filters.minReadinessScore}`)
  }

  if (filters.minAlignmentScore !== undefined) {
    conditions.push(sql`${districtKeywordScores.alignmentScore}::decimal >= ${filters.minAlignmentScore}`)
  }

  if (filters.minActivationScore !== undefined) {
    conditions.push(sql`${districtKeywordScores.activationScore}::decimal >= ${filters.minActivationScore}`)
  }

  if (filters.minBrandingScore !== undefined) {
    conditions.push(sql`${districtKeywordScores.brandingScore}::decimal >= ${filters.minBrandingScore}`)
  }

  if (filters.minTotalScore !== undefined) {
    conditions.push(sql`${districtKeywordScores.totalScore}::decimal >= ${filters.minTotalScore}`)
  }

  if (filters.tier) {
    conditions.push(eq(districtKeywordScores.outreachTier, filters.tier))
  }

  // Join with districts table to include state filter
  const query = db
    .select({
      score: districtKeywordScores,
      district: districts,
    })
    .from(districtKeywordScores)
    .innerJoin(districts, eq(districtKeywordScores.ncesId, districts.ncesId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(districtKeywordScores.totalScore))
    .limit(limit)

  const results = await query

  return results.map((row) => ({
    score: serializeScore(row.score),
    district: {
      ncesId: row.district.ncesId,
      name: row.district.name,
      state: row.district.state,
      city: row.district.city,
      enrollment: row.district.enrollment,
      superintendentName: row.district.superintendentName,
      superintendentEmail: row.district.superintendentEmail,
    },
  }))
}

/**
 * Get top districts by specific category score
 */
export async function getTopDistrictsByCategory(
  category: 'readiness' | 'alignment' | 'activation' | 'branding',
  limit: number = 20,
  state?: string
) {
  const db = getDb()

  const scoreColumn =
    category === 'readiness'
      ? districtKeywordScores.readinessScore
      : category === 'alignment'
        ? districtKeywordScores.alignmentScore
        : category === 'activation'
          ? districtKeywordScores.activationScore
          : districtKeywordScores.brandingScore

  const conditions = state ? [eq(districts.state, state)] : []

  const results = await db
    .select({
      score: districtKeywordScores,
      district: districts,
    })
    .from(districtKeywordScores)
    .innerJoin(districts, eq(districtKeywordScores.ncesId, districts.ncesId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(scoreColumn))
    .limit(limit)

  return results.map((row) => ({
    ncesId: row.district.ncesId,
    name: row.district.name,
    state: row.district.state,
    city: row.district.city,
    categoryScore: serializeScore(row.score)[`${category}Score`],
    totalScore: serializeScore(row.score).totalScore,
    tier: row.score.outreachTier,
  }))
}

/**
 * Get score distribution statistics
 */
export async function getScoreStatistics() {
  const db = getDb()

  const results = await db.execute(sql`
    SELECT
      COUNT(*) as total_districts,
      AVG(readiness_score)::decimal as avg_readiness,
      AVG(alignment_score)::decimal as avg_alignment,
      AVG(activation_score)::decimal as avg_activation,
      AVG(branding_score)::decimal as avg_branding,
      AVG(total_score)::decimal as avg_total,
      COUNT(CASE WHEN outreach_tier = 'tier1' THEN 1 END) as tier1_count,
      COUNT(CASE WHEN outreach_tier = 'tier2' THEN 1 END) as tier2_count,
      COUNT(CASE WHEN outreach_tier = 'tier3' THEN 1 END) as tier3_count
    FROM district_keyword_scores
  `)

  const row = results[0] as any

  return {
    totalDistricts: parseInt(row.total_districts),
    averageScores: {
      readiness: parseFloat(row.avg_readiness)?.toFixed(2) || '0',
      alignment: parseFloat(row.avg_alignment)?.toFixed(2) || '0',
      activation: parseFloat(row.avg_activation)?.toFixed(2) || '0',
      branding: parseFloat(row.avg_branding)?.toFixed(2) || '0',
      total: parseFloat(row.avg_total)?.toFixed(2) || '0',
    },
    tierDistribution: {
      tier1: parseInt(row.tier1_count),
      tier2: parseInt(row.tier2_count),
      tier3: parseInt(row.tier3_count),
    },
  }
}

/**
 * Get keyword matches for a district (evidence)
 */
export async function getKeywordEvidence(ncesId: string) {
  const db = getDb()

  const results = await db
    .select({
      keywordMatches: districtKeywordScores.keywordMatches,
    })
    .from(districtKeywordScores)
    .where(eq(districtKeywordScores.ncesId, ncesId))
    .limit(1)

  if (results.length === 0) {
    return null
  }

  return results[0].keywordMatches as Record<string, unknown>
}

/**
 * Get districts by tier with pagination
 */
export async function getDistrictsByTier(
  tier: string,
  page: number = 1,
  limit: number = 50
) {
  const db = getDb()
  const offset = (page - 1) * limit

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(districtKeywordScores)
    .where(eq(districtKeywordScores.outreachTier, tier))

  const total = countResult[0]?.count || 0

  // Get paginated results
  const results = await db
    .select({
      score: districtKeywordScores,
      district: districts,
    })
    .from(districtKeywordScores)
    .innerJoin(districts, eq(districtKeywordScores.ncesId, districts.ncesId))
    .where(eq(districtKeywordScores.outreachTier, tier))
    .orderBy(desc(districtKeywordScores.totalScore))
    .limit(limit)
    .offset(offset)

  return {
    districts: results.map((row) => ({
      ncesId: row.district.ncesId,
      name: row.district.name,
      state: row.district.state,
      city: row.district.city,
      enrollment: row.district.enrollment,
      superintendentName: row.district.superintendentName,
      superintendentEmail: row.district.superintendentEmail,
      totalScore: row.score.totalScore?.toString() || null,
      tier: row.score.outreachTier,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

/**
 * Update keyword scores for a district
 */
export async function updateScores(
  ncesId: string,
  scores: {
    readinessScore?: number
    alignmentScore?: number
    activationScore?: number
    brandingScore?: number
    totalScore?: number
    outreachTier?: string
    keywordMatches?: Record<string, unknown>
  }
) {
  const db = getDb()

  // Convert number scores to strings for decimal columns
  const updateData: any = {}
  if (scores.readinessScore !== undefined) {
    updateData.readinessScore = scores.readinessScore.toString()
  }
  if (scores.alignmentScore !== undefined) {
    updateData.alignmentScore = scores.alignmentScore.toString()
  }
  if (scores.activationScore !== undefined) {
    updateData.activationScore = scores.activationScore.toString()
  }
  if (scores.brandingScore !== undefined) {
    updateData.brandingScore = scores.brandingScore.toString()
  }
  if (scores.totalScore !== undefined) {
    updateData.totalScore = scores.totalScore.toString()
  }
  if (scores.outreachTier !== undefined) {
    updateData.outreachTier = scores.outreachTier
  }
  if (scores.keywordMatches !== undefined) {
    updateData.keywordMatches = scores.keywordMatches
  }

  await db
    .update(districtKeywordScores)
    .set(updateData)
    .where(eq(districtKeywordScores.ncesId, ncesId))

  return getScoresByNcesId(ncesId)
}

// Serialization helper
function serializeScore(score: any) {
  return {
    ncesId: score.ncesId,
    readinessScore: score.readinessScore?.toString() || null,
    alignmentScore: score.alignmentScore?.toString() || null,
    activationScore: score.activationScore?.toString() || null,
    brandingScore: score.brandingScore?.toString() || null,
    totalScore: score.totalScore?.toString() || null,
    outreachTier: score.outreachTier,
    keywordMatches: (score.keywordMatches as Record<string, unknown>) || null,
  }
}
