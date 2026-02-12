import { sql } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { commandSearchLogs } from '../db/schema.js'
import type { CommandSearchTelemetrySummary, CommandRequest, CommandResponse } from '@aasa-platform/shared'

function normalizePrompt(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, ' ')
}

export async function logCommandSearch(
  userId: string | undefined,
  request: CommandRequest,
  response: CommandResponse,
): Promise<void> {
  const db = getDb()

  const topNcesIds = response.districts
    .map((d) => d.district.ncesId)
    .filter((id): id is string => Boolean(id))
    .slice(0, 25)

  await db.insert(commandSearchLogs).values({
    userId: userId || null,
    prompt: request.prompt.trim(),
    intent: response.intent,
    confidenceThreshold: String(response.confidenceThreshold),
    leadFilters: request.leadFilters || null,
    grantCriteria: request.grantCriteria || null,
    suppressionDays: request.engagementSignals?.suppressionDays ?? 60,
    resultCount: response.districts.length,
    topNcesIds,
    generatedAt: new Date(response.generatedAt),
  })
}

export async function getCommandSearchTelemetrySummary(
  userId: string | undefined,
  periodDays: number = 7,
): Promise<CommandSearchTelemetrySummary> {
  const db = getDb()
  const boundedDays = Math.min(60, Math.max(1, Number(periodDays || 7)))

  const userFilter = userId
    ? sql`AND c.user_id = ${userId}`
    : sql``

  const summaryRows = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total_queries,
      COALESCE(AVG(c.result_count), 0)::decimal AS avg_results_per_query
    FROM command_search_logs c
    WHERE c.generated_at >= NOW() - (${boundedDays} || ' days')::interval
    ${userFilter}
  `)

  const promptRows = await db.execute(sql`
    SELECT
      c.prompt,
      COUNT(*)::int AS query_count
    FROM command_search_logs c
    WHERE c.generated_at >= NOW() - (${boundedDays} || ' days')::interval
    ${userFilter}
    GROUP BY c.prompt
    ORDER BY query_count DESC, c.prompt ASC
    LIMIT 15
  `)

  const repeatedDistrictRows = await db.execute(sql`
    SELECT
      t.nces_id,
      COUNT(*)::int AS appearances
    FROM command_search_logs c,
      UNNEST(COALESCE(c.top_nces_ids, ARRAY[]::text[])) AS t(nces_id)
    WHERE c.generated_at >= NOW() - (${boundedDays} || ' days')::interval
    ${userFilter}
    GROUP BY t.nces_id
    ORDER BY appearances DESC, t.nces_id ASC
    LIMIT 20
  `)

  const totalQueries = Number((summaryRows[0] as any)?.total_queries || 0)
  const avgResultsPerQuery = Number((summaryRows[0] as any)?.avg_results_per_query || 0)

  const normalizedPromptSet = new Set(
    (promptRows as any[]).map((row) => normalizePrompt(String(row.prompt || ''))).filter(Boolean),
  )

  return {
    periodDays: boundedDays,
    totalQueries,
    uniquePrompts: normalizedPromptSet.size,
    avgResultsPerQuery: Number(avgResultsPerQuery.toFixed(2)),
    repeatDistricts: (repeatedDistrictRows as any[]).map((row) => ({
      ncesId: String(row.nces_id),
      appearances: Number(row.appearances || 0),
    })),
    topPrompts: (promptRows as any[]).map((row) => ({
      prompt: String(row.prompt || ''),
      count: Number(row.query_count || 0),
    })),
  }
}
