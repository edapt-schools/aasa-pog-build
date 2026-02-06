/**
 * Database Client for AASA District Intelligence Platform
 *
 * Lazy singleton pattern prevents connection leaks
 * Uses postgres driver (not pg) with Drizzle ORM
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import * as schema from './schema.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// CRITICAL: Load .env from monorepo root (3 levels up: api/src/db -> api/src -> api -> root)
config({ path: resolve(__dirname, '../../../.env') })

// Lazy singleton - connection created only when first accessed
let db: ReturnType<typeof drizzle> | null = null
let client: ReturnType<typeof postgres> | null = null

/**
 * Get Drizzle database instance (singleton)
 *
 * @returns Drizzle database with schema for type-safe queries
 * @throws Error if DATABASE_URL not found in environment
 */
export function getDb() {
  if (!db) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'DATABASE_URL not found in environment variables. ' +
        'Ensure .env file exists at monorepo root with DATABASE_URL set.'
      )
    }

    // Create postgres client with connection pooling
    client = postgres(process.env.DATABASE_URL, {
      max: 10, // Connection pool size (Supabase free tier limit: 60 total)
      idle_timeout: 20, // Close idle connections after 20s
      connect_timeout: 10, // Timeout connecting in 10s
      ssl: 'require', // Supabase requires SSL
    })

    // Create Drizzle instance with schema for relations
    db = drizzle(client, { schema })

    console.log('[DB] Connected to Supabase PostgreSQL')
  }

  return db
}

/**
 * Get raw postgres client for direct SQL queries
 * Use sparingly - prefer getDb() for type-safe queries
 *
 * @returns Raw postgres client
 */
export function getClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not found in environment variables')
  }

  return postgres(process.env.DATABASE_URL, {
    ssl: 'require',
  })
}

/**
 * Close database connection
 * Call this in server shutdown hooks
 */
export async function closeDb() {
  if (client) {
    await client.end()
    db = null
    client = null
    console.log('[DB] Connection closed')
  }
}

// Re-export schema and types for convenience
export * from './schema.js'
export { sql, eq, and, or, isNull, isNotNull, inArray, like, ilike } from 'drizzle-orm'
