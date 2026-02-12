import { sql, eq, and } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { savedCohorts, savedCohortItems } from '../db/schema.js'
import type {
  SavedCohort,
  CohortDetailResponse,
  ListCohortsResponse,
} from '@aasa-platform/shared'

/**
 * List all cohorts for a user
 */
export async function listCohorts(userId: string): Promise<ListCohortsResponse> {
  const db = getDb()

  const rows = await db.execute(sql`
    SELECT
      c.id,
      c.user_id,
      c.name,
      c.description,
      c.created_at,
      c.updated_at,
      COUNT(ci.id)::int AS item_count
    FROM saved_cohorts c
    LEFT JOIN saved_cohort_items ci ON c.id = ci.cohort_id
    WHERE c.user_id = ${userId}
    GROUP BY c.id
    ORDER BY c.updated_at DESC
  `)

  const cohorts: SavedCohort[] = (rows as any[]).map((row) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    itemCount: row.item_count,
  }))

  return { cohorts }
}

/**
 * Create a new cohort
 */
export async function createCohort(
  userId: string,
  name: string,
  description?: string,
): Promise<SavedCohort> {
  const db = getDb()

  const [row] = await db.insert(savedCohorts).values({
    userId,
    name,
    description: description || null,
  }).returning()

  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    itemCount: 0,
  }
}

/**
 * Get cohort detail with district information
 */
export async function getCohortDetail(
  cohortId: string,
  userId: string,
): Promise<CohortDetailResponse> {
  const db = getDb()

  // Verify ownership
  const [cohortRow] = await db
    .select()
    .from(savedCohorts)
    .where(and(eq(savedCohorts.id, cohortId), eq(savedCohorts.userId, userId)))
    .limit(1)

  if (!cohortRow) {
    throw new Error('Cohort not found')
  }

  // Get items with district details
  const items = await db.execute(sql`
    SELECT
      ci.id,
      ci.cohort_id,
      ci.nces_id,
      ci.notes,
      ci.added_at,
      d.name AS district_name,
      d.state,
      d.city,
      d.enrollment,
      d.superintendent_name,
      d.superintendent_email,
      d.phone,
      d.website_domain
    FROM saved_cohort_items ci
    LEFT JOIN districts d ON ci.nces_id = d.nces_id
    WHERE ci.cohort_id = ${cohortId}
    ORDER BY ci.added_at DESC
  `)

  return {
    cohort: {
      id: cohortRow.id,
      userId: cohortRow.userId,
      name: cohortRow.name,
      description: cohortRow.description,
      createdAt: cohortRow.createdAt.toISOString(),
      updatedAt: cohortRow.updatedAt.toISOString(),
      itemCount: (items as any[]).length,
      items: (items as any[]).map((item) => ({
        id: item.id,
        cohortId: item.cohort_id,
        ncesId: item.nces_id,
        notes: item.notes,
        addedAt: item.added_at instanceof Date ? item.added_at.toISOString() : item.added_at,
        district: item.district_name ? {
          id: '',
          ncesId: item.nces_id,
          name: item.district_name,
          state: item.state,
          city: item.city,
          county: null,
          enrollment: item.enrollment,
          gradesServed: null,
          localeCode: null,
          frplPercent: null,
          minorityPercent: null,
          websiteDomain: item.website_domain,
          superintendentName: item.superintendent_name,
          superintendentEmail: item.superintendent_email,
          phone: item.phone,
          address: null,
          lastScrapedAt: null,
          scrapeStatus: null,
          scrapeError: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } : undefined,
      })),
    },
  }
}

/**
 * Update a cohort (name/description)
 */
export async function updateCohort(
  cohortId: string,
  userId: string,
  updates: { name?: string; description?: string },
): Promise<SavedCohort> {
  const db = getDb()

  const [existing] = await db
    .select()
    .from(savedCohorts)
    .where(and(eq(savedCohorts.id, cohortId), eq(savedCohorts.userId, userId)))
    .limit(1)

  if (!existing) {
    throw new Error('Cohort not found')
  }

  const [updated] = await db
    .update(savedCohorts)
    .set({
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description }),
      updatedAt: new Date(),
    })
    .where(eq(savedCohorts.id, cohortId))
    .returning()

  return {
    id: updated.id,
    userId: updated.userId,
    name: updated.name,
    description: updated.description,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  }
}

/**
 * Delete a cohort and all its items (CASCADE)
 */
export async function deleteCohort(
  cohortId: string,
  userId: string,
): Promise<void> {
  const db = getDb()

  const [existing] = await db
    .select()
    .from(savedCohorts)
    .where(and(eq(savedCohorts.id, cohortId), eq(savedCohorts.userId, userId)))
    .limit(1)

  if (!existing) {
    throw new Error('Cohort not found')
  }

  await db.delete(savedCohorts).where(eq(savedCohorts.id, cohortId))
}

/**
 * Add districts to a cohort
 */
export async function addDistrictsToCohort(
  cohortId: string,
  userId: string,
  ncesIds: string[],
): Promise<{ added: number }> {
  const db = getDb()

  // Verify ownership
  const [existing] = await db
    .select()
    .from(savedCohorts)
    .where(and(eq(savedCohorts.id, cohortId), eq(savedCohorts.userId, userId)))
    .limit(1)

  if (!existing) {
    throw new Error('Cohort not found')
  }

  let added = 0
  for (const ncesId of ncesIds) {
    try {
      await db.insert(savedCohortItems).values({
        cohortId,
        ncesId,
      })
      added++
    } catch {
      // Skip duplicates (unique constraint)
    }
  }

  // Update cohort timestamp
  await db
    .update(savedCohorts)
    .set({ updatedAt: new Date() })
    .where(eq(savedCohorts.id, cohortId))

  return { added }
}

/**
 * Remove a district from a cohort
 */
export async function removeDistrictFromCohort(
  cohortId: string,
  userId: string,
  ncesId: string,
): Promise<void> {
  const db = getDb()

  // Verify ownership
  const [existing] = await db
    .select()
    .from(savedCohorts)
    .where(and(eq(savedCohorts.id, cohortId), eq(savedCohorts.userId, userId)))
    .limit(1)

  if (!existing) {
    throw new Error('Cohort not found')
  }

  await db.delete(savedCohortItems).where(
    and(
      eq(savedCohortItems.cohortId, cohortId),
      eq(savedCohortItems.ncesId, ncesId),
    )
  )

  // Update cohort timestamp
  await db
    .update(savedCohorts)
    .set({ updatedAt: new Date() })
    .where(eq(savedCohorts.id, cohortId))
}
