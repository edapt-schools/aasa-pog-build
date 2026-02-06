import { sql } from 'drizzle-orm'
import { getDb } from '../index.js'
import type {
  InsightsOverviewResponse,
  StateStats,
  StatesResponse,
  StateDetailResponse,
  TrendingKeyword,
  TrendingResponse,
} from '@aasa-platform/shared'

// State code to full name mapping
const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida',
  GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana',
  IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine',
  MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
  SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin',
  WY: 'Wyoming',
}

/**
 * Get national overview statistics for Insights dashboard
 */
export async function getInsightsOverview(): Promise<InsightsOverviewResponse> {
  const db = getDb()

  // Get district and superintendent counts
  const districtStats = await db.execute(sql`
    SELECT
      COUNT(*) as total_districts,
      COUNT(superintendent_name) as with_superintendent
    FROM districts
  `)

  // Get document count
  const docStats = await db.execute(sql`
    SELECT COUNT(*) as total_documents
    FROM district_documents
  `)

  // Get score statistics (reuse existing query pattern)
  const scoreStats = await db.execute(sql`
    SELECT
      COUNT(*) as scored_districts,
      COALESCE(AVG(readiness_score::decimal), 0) as avg_readiness,
      COALESCE(AVG(alignment_score::decimal), 0) as avg_alignment,
      COALESCE(AVG(activation_score::decimal), 0) as avg_activation,
      COALESCE(AVG(branding_score::decimal), 0) as avg_branding,
      COALESCE(AVG(total_score::decimal), 0) as avg_total,
      COUNT(CASE WHEN outreach_tier = 'tier1' THEN 1 END) as tier1_count,
      COUNT(CASE WHEN outreach_tier = 'tier2' THEN 1 END) as tier2_count,
      COUNT(CASE WHEN outreach_tier = 'tier3' THEN 1 END) as tier3_count
    FROM district_keyword_scores
  `)

  const dStats = districtStats[0] as any
  const docs = docStats[0] as any
  const scores = scoreStats[0] as any

  const totalDistricts = parseInt(dStats.total_districts) || 0
  const withSuper = parseInt(dStats.with_superintendent) || 0

  return {
    totalDistricts,
    superintendentCoverage: {
      count: withSuper,
      percent: totalDistricts > 0 ? Math.round((withSuper / totalDistricts) * 100 * 10) / 10 : 0,
    },
    documentStats: {
      totalDocuments: parseInt(docs.total_documents) || 0,
    },
    averageScores: {
      readiness: parseFloat(parseFloat(scores.avg_readiness || 0).toFixed(2)),
      alignment: parseFloat(parseFloat(scores.avg_alignment || 0).toFixed(2)),
      activation: parseFloat(parseFloat(scores.avg_activation || 0).toFixed(2)),
      branding: parseFloat(parseFloat(scores.avg_branding || 0).toFixed(2)),
      total: parseFloat(parseFloat(scores.avg_total || 0).toFixed(2)),
    },
    tierDistribution: {
      tier1: parseInt(scores.tier1_count) || 0,
      tier2: parseInt(scores.tier2_count) || 0,
      tier3: parseInt(scores.tier3_count) || 0,
    },
    lastUpdated: new Date().toISOString(),
  }
}

/**
 * Get aggregated statistics for all states (for map visualization)
 */
export async function getAllStateStats(): Promise<StatesResponse> {
  const db = getDb()

  const results = await db.execute(sql`
    SELECT
      d.state as state_code,
      COUNT(DISTINCT d.nces_id) as total_districts,
      COUNT(DISTINCT CASE WHEN d.superintendent_name IS NOT NULL THEN d.nces_id END) as superintendent_count,
      COALESCE(AVG(ks.total_score::decimal), 0) as avg_total_score,
      COUNT(CASE WHEN ks.outreach_tier = 'tier1' THEN 1 END) as tier1_count,
      COUNT(CASE WHEN ks.outreach_tier = 'tier2' THEN 1 END) as tier2_count,
      COUNT(CASE WHEN ks.outreach_tier = 'tier3' THEN 1 END) as tier3_count,
      COUNT(DISTINCT dd.id) as documents_count
    FROM districts d
    LEFT JOIN district_keyword_scores ks ON d.nces_id = ks.nces_id
    LEFT JOIN district_documents dd ON d.nces_id = dd.nces_id
    GROUP BY d.state
    ORDER BY d.state
  `)

  const states: StateStats[] = results.map((row: any) => {
    const totalDistricts = parseInt(row.total_districts) || 0
    const superintendentCount = parseInt(row.superintendent_count) || 0

    return {
      stateCode: row.state_code,
      stateName: STATE_NAMES[row.state_code] || row.state_code,
      totalDistricts,
      superintendentCount,
      superintendentCoverage: totalDistricts > 0
        ? Math.round((superintendentCount / totalDistricts) * 100 * 10) / 10
        : 0,
      avgTotalScore: parseFloat(parseFloat(row.avg_total_score || 0).toFixed(2)),
      tier1Count: parseInt(row.tier1_count) || 0,
      tier2Count: parseInt(row.tier2_count) || 0,
      tier3Count: parseInt(row.tier3_count) || 0,
      documentsCount: parseInt(row.documents_count) || 0,
    }
  })

  return { states }
}

/**
 * Get detailed statistics for a single state
 */
export async function getStateDetail(stateCode: string): Promise<StateDetailResponse> {
  const db = getDb()
  const upperState = stateCode.toUpperCase()

  // Get district and superintendent counts
  const districtStats = await db.execute(sql`
    SELECT
      COUNT(*) as total_districts,
      COUNT(superintendent_name) as with_superintendent
    FROM districts
    WHERE state = ${upperState}
  `)

  // Get score statistics for the state
  const scoreStats = await db.execute(sql`
    SELECT
      COALESCE(AVG(ks.readiness_score::decimal), 0) as avg_readiness,
      COALESCE(AVG(ks.alignment_score::decimal), 0) as avg_alignment,
      COALESCE(AVG(ks.activation_score::decimal), 0) as avg_activation,
      COALESCE(AVG(ks.branding_score::decimal), 0) as avg_branding,
      COUNT(CASE WHEN ks.outreach_tier = 'tier1' THEN 1 END) as tier1_count,
      COUNT(CASE WHEN ks.outreach_tier = 'tier2' THEN 1 END) as tier2_count,
      COUNT(CASE WHEN ks.outreach_tier = 'tier3' THEN 1 END) as tier3_count
    FROM districts d
    INNER JOIN district_keyword_scores ks ON d.nces_id = ks.nces_id
    WHERE d.state = ${upperState}
  `)

  // Get top districts by total score
  const topDistricts = await db.execute(sql`
    SELECT
      d.nces_id,
      d.name,
      ks.total_score::decimal as total_score,
      ks.outreach_tier as tier
    FROM districts d
    INNER JOIN district_keyword_scores ks ON d.nces_id = ks.nces_id
    WHERE d.state = ${upperState}
      AND ks.total_score IS NOT NULL
    ORDER BY ks.total_score::decimal DESC
    LIMIT 10
  `)

  // Get document count
  const docStats = await db.execute(sql`
    SELECT COUNT(*) as total_documents
    FROM district_documents dd
    INNER JOIN districts d ON dd.nces_id = d.nces_id
    WHERE d.state = ${upperState}
  `)

  const dStats = districtStats[0] as any
  const scores = scoreStats[0] as any
  const docs = docStats[0] as any

  const totalDistricts = parseInt(dStats.total_districts) || 0
  const withSuper = parseInt(dStats.with_superintendent) || 0

  return {
    stateCode: upperState,
    stateName: STATE_NAMES[upperState] || upperState,
    totalDistricts,
    superintendentCoverage: {
      count: withSuper,
      percent: totalDistricts > 0 ? Math.round((withSuper / totalDistricts) * 100 * 10) / 10 : 0,
    },
    scoreStats: {
      averageScores: {
        readiness: parseFloat(parseFloat(scores.avg_readiness || 0).toFixed(2)),
        alignment: parseFloat(parseFloat(scores.avg_alignment || 0).toFixed(2)),
        activation: parseFloat(parseFloat(scores.avg_activation || 0).toFixed(2)),
        branding: parseFloat(parseFloat(scores.avg_branding || 0).toFixed(2)),
      },
      tierDistribution: {
        tier1: parseInt(scores.tier1_count) || 0,
        tier2: parseInt(scores.tier2_count) || 0,
        tier3: parseInt(scores.tier3_count) || 0,
      },
    },
    topDistricts: topDistricts.map((row: any) => ({
      ncesId: row.nces_id,
      name: row.name,
      totalScore: parseFloat(row.total_score) || 0,
      tier: row.tier || 'tier3',
    })),
    documentsCount: parseInt(docs.total_documents) || 0,
  }
}

/**
 * Get trending keywords from keyword_matches JSONB
 * Analyzes keyword frequencies across all districts
 */
export async function getTrendingKeywords(period: string = '30d'): Promise<TrendingResponse> {
  const db = getDb()

  // Get keyword counts from keyword_matches JSONB
  // This aggregates keywords across all districts
  const results = await db.execute(sql`
    WITH keyword_data AS (
      SELECT
        jsonb_array_elements(keyword_matches->'readiness') as readiness_kw,
        jsonb_array_elements(keyword_matches->'alignment') as alignment_kw,
        jsonb_array_elements(keyword_matches->'activation') as activation_kw,
        jsonb_array_elements(keyword_matches->'branding') as branding_kw
      FROM district_keyword_scores
      WHERE keyword_matches IS NOT NULL
    ),
    readiness_counts AS (
      SELECT
        readiness_kw->>'keyword' as keyword,
        'readiness' as category,
        COUNT(*) as count
      FROM keyword_data
      WHERE readiness_kw->>'keyword' IS NOT NULL
      GROUP BY readiness_kw->>'keyword'
    ),
    alignment_counts AS (
      SELECT
        alignment_kw->>'keyword' as keyword,
        'alignment' as category,
        COUNT(*) as count
      FROM keyword_data
      WHERE alignment_kw->>'keyword' IS NOT NULL
      GROUP BY alignment_kw->>'keyword'
    ),
    activation_counts AS (
      SELECT
        activation_kw->>'keyword' as keyword,
        'activation' as category,
        COUNT(*) as count
      FROM keyword_data
      WHERE activation_kw->>'keyword' IS NOT NULL
      GROUP BY activation_kw->>'keyword'
    ),
    branding_counts AS (
      SELECT
        branding_kw->>'keyword' as keyword,
        'branding' as category,
        COUNT(*) as count
      FROM keyword_data
      WHERE branding_kw->>'keyword' IS NOT NULL
      GROUP BY branding_kw->>'keyword'
    ),
    all_keywords AS (
      SELECT * FROM readiness_counts
      UNION ALL SELECT * FROM alignment_counts
      UNION ALL SELECT * FROM activation_counts
      UNION ALL SELECT * FROM branding_counts
    )
    SELECT keyword, category, SUM(count) as total_count
    FROM all_keywords
    GROUP BY keyword, category
    ORDER BY total_count DESC
    LIMIT 20
  `)

  const keywords: TrendingKeyword[] = results.map((row: any) => ({
    keyword: row.keyword,
    category: row.category as 'readiness' | 'alignment' | 'activation' | 'branding',
    currentCount: parseInt(row.total_count) || 0,
    // For now, we don't have historical data to compute change
    // In a production system, you'd compare against a previous period
    changePercent: 0,
    trend: 'stable' as const,
  }))

  return {
    period,
    keywords,
  }
}
