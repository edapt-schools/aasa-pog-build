import { eq, and, desc } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { savedSearches } from '../db/schema.js'
import type {
  SavedSearchRecord,
  ListSavedSearchesResponse,
} from '@aasa-platform/shared'

/**
 * List all saved searches for a user
 */
export async function listSearches(userId: string): Promise<ListSavedSearchesResponse> {
  const db = getDb()

  const rows = await db
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.userId, userId))
    .orderBy(desc(savedSearches.createdAt))

  const searches: SavedSearchRecord[] = rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    name: row.name,
    query: row.query,
    intent: row.intent,
    filters: row.filters as Record<string, unknown> | null,
    resultCount: row.resultCount,
    createdAt: row.createdAt.toISOString(),
  }))

  return { searches }
}

/**
 * Save a search
 */
export async function createSearch(
  userId: string,
  data: {
    name: string
    query: string
    intent?: string
    filters?: Record<string, unknown>
    resultCount?: number
  },
): Promise<SavedSearchRecord> {
  const db = getDb()

  const [row] = await db.insert(savedSearches).values({
    userId,
    name: data.name,
    query: data.query,
    intent: data.intent || null,
    filters: data.filters || null,
    resultCount: data.resultCount || null,
  }).returning()

  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    query: row.query,
    intent: row.intent,
    filters: row.filters as Record<string, unknown> | null,
    resultCount: row.resultCount,
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * Delete a saved search
 */
export async function deleteSearch(
  searchId: string,
  userId: string,
): Promise<void> {
  const db = getDb()

  const [existing] = await db
    .select()
    .from(savedSearches)
    .where(and(eq(savedSearches.id, searchId), eq(savedSearches.userId, userId)))
    .limit(1)

  if (!existing) {
    throw new Error('Search not found')
  }

  await db.delete(savedSearches).where(eq(savedSearches.id, searchId))
}
