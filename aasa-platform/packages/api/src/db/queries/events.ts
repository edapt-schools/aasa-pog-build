import { eq, and, sql, desc } from 'drizzle-orm'
import { getDb } from '../index.js'
import { eventUploads, eventUploadResults } from '../schema.js'

/**
 * Create a new event upload record
 */
export async function createEventUpload(data: {
  userId: string
  fileName: string
  rowCount: number
}) {
  const db = getDb()

  const result = await db
    .insert(eventUploads)
    .values({
      userId: data.userId,
      fileName: data.fileName,
      rowCount: data.rowCount,
      matchedCount: 0,
      status: 'processing',
    })
    .returning()

  return result[0]
}

/**
 * Update event upload status and matched count
 */
export async function updateEventUpload(
  uploadId: string,
  data: { matchedCount?: number; status?: string }
) {
  const db = getDb()

  await db
    .update(eventUploads)
    .set(data)
    .where(eq(eventUploads.id, uploadId))
}

/**
 * Insert matched results for an upload
 */
export async function insertUploadResults(
  results: Array<{
    uploadId: string
    rowIndex: number
    inputName: string
    inputState: string | null
    matchedDistrictId: string | null
    matchConfidence: string | null
    districtScore: string | null
    districtTier: string | null
  }>
) {
  const db = getDb()

  if (results.length === 0) return

  await db.insert(eventUploadResults).values(results)
}

/**
 * List all uploads for a user
 */
export async function listUploads(userId: string) {
  const db = getDb()

  const results = await db
    .select()
    .from(eventUploads)
    .where(eq(eventUploads.userId, userId))
    .orderBy(desc(eventUploads.uploadedAt))

  return results
}

/**
 * Get a single upload with its results
 */
export async function getUploadWithResults(uploadId: string, userId: string) {
  const db = getDb()

  // Get the upload record
  const uploads = await db
    .select()
    .from(eventUploads)
    .where(and(eq(eventUploads.id, uploadId), eq(eventUploads.userId, userId)))
    .limit(1)

  if (uploads.length === 0) {
    return null
  }

  const upload = uploads[0]

  // Get results with joined district data
  const results = await db.execute(sql`
    SELECT
      r.id,
      r.row_index,
      r.input_name,
      r.input_state,
      r.matched_district_id,
      r.match_confidence,
      r.district_score,
      r.district_tier,
      d.name AS district_name,
      d.state AS district_state,
      d.city AS district_city,
      d.enrollment AS district_enrollment,
      d.superintendent_name,
      d.superintendent_email,
      d.website_domain,
      s.readiness_score,
      s.alignment_score,
      s.activation_score,
      s.branding_score,
      s.total_score,
      s.outreach_tier
    FROM event_upload_results r
    LEFT JOIN districts d ON r.matched_district_id = d.nces_id
    LEFT JOIN district_keyword_scores s ON r.matched_district_id = s.nces_id
    WHERE r.upload_id = ${uploadId}
    ORDER BY r.district_score::decimal DESC NULLS LAST, r.row_index ASC
  `)

  return {
    upload,
    results: (results as any[]).map((row) => ({
      id: row.id,
      rowIndex: row.row_index,
      inputName: row.input_name,
      inputState: row.input_state,
      matchedDistrictId: row.matched_district_id,
      matchConfidence: row.match_confidence,
      districtScore: row.district_score,
      districtTier: row.district_tier,
      district: row.district_name
        ? {
            name: row.district_name,
            state: row.district_state,
            city: row.district_city,
            enrollment: row.district_enrollment,
            superintendentName: row.superintendent_name,
            superintendentEmail: row.superintendent_email,
            websiteDomain: row.website_domain,
          }
        : null,
      scores: row.total_score
        ? {
            readiness: row.readiness_score,
            alignment: row.alignment_score,
            activation: row.activation_score,
            branding: row.branding_score,
            total: row.total_score,
            tier: row.outreach_tier,
          }
        : null,
    })),
  }
}
