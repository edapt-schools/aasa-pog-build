# Database Migrations

**Project:** AASA District Intelligence Platform
**ORM:** Drizzle ORM 0.38+ with postgres driver
**Database:** Supabase PostgreSQL with pgvector extension

## Overview

This project uses Drizzle ORM with **manual SQL execution** (NOT `drizzle-kit push`). We follow the migration patterns from edaptation-home to avoid interactive prompts that break automation.

## Critical Rules

1. **NEVER run `npx drizzle-kit push`** - it triggers interactive prompts
2. **ALWAYS write defensive SQL** - use `IF NOT EXISTS`, `IF NOT NULL`
3. **ALWAYS enable RLS on new tables** - Supabase security requirement
4. **ALWAYS update `_journal.json`** after running migration
5. **ALWAYS update this document** with migration rationale
6. **Scripts in `packages/api/scripts/`** must load .env from root: `../../../.env`

## Current State

**Migration 0000**: Existing schema (created via scripts/ directory)
- **Tables**: 10 (districts, ccd_staff_data, state_registry_districts, district_matches, district_documents, document_crawl_log, district_keyword_scores, document_embeddings, data_imports, quality_flags)
- **Views**: 2 (national_registry, superintendent_directory)
- **Extensions**: pgvector (for semantic search)
- **Data**: 19,740 districts, 61.4% with superintendent data, 20,984 documents

## Database Schema Layers

### AUDIT LAYER
- `data_imports` - Import tracking (source_type, record_count, imported_at)
- `quality_flags` - Data quality issues (flag_type, severity, resolved)

### SOURCE LAYER (Immutable)
- `districts` - NCES baseline (19,740 districts, authoritative)
- `ccd_staff_data` - Federal enrichment
- `state_registry_districts` - State DoE data (6,384 records from 18 states)

### MATCHING LAYER
- `district_matches` - Links state data to NCES (6,309 matches, confidence scoring)

### DOCUMENT LAYER
- `district_documents` - Crawled content (~2,000 PDFs/HTML pages)
- `document_crawl_log` - Audit trail (~20,000 crawl attempts)
- `district_keyword_scores` - Taxonomy scoring (readiness, alignment, activation, branding)
- `document_embeddings` - Vector embeddings (1536 dims, OpenAI ada-002)

## Migration History

### 0000_existing_schema (2026-02-05)
- **Status**: Documentation only (tables already exist in production)
- **Rationale**: Database created before Drizzle ORM adoption via Node.js scripts in `/scripts`
- **Tables Created**: All 10 tables with data
- **Views Created**: `national_registry` (unified COALESCE view), `superintendent_directory`
- **Extensions**: `CREATE EXTENSION IF NOT EXISTS vector`
- **Indexes**: Composite indexes on high-traffic columns, HNSW index on embeddings (created after data load)

**Key Design Decisions**:
- UUID primary keys with `gen_random_uuid()` for all tables
- snake_case in database, camelCase in TypeScript (Drizzle aliasing)
- JSONB for flexible data: `raw_data`, `match_details`, `keyword_matches`
- TEXT[] arrays for: `keywords_found`
- NUMERIC(4,2) for scores (e.g., 9.86 out of 10)
- Timestamps with `DEFAULT NOW()` for audit trail

**No Migration Script Needed**: Tables exist with production data

## Future Migration Workflow

When you need to modify the schema (add column, create table, add index):

### Step 1: Update Schema
Edit `packages/api/src/db/schema.ts` to reflect the change.

### Step 2: Generate Migration File
```bash
cd packages/api
npm run db:generate
```

This creates `drizzle/XXXX_description.sql`. Review the generated SQL.

### Step 3: Create Manual Migration Script
**DO NOT run the generated SQL directly.** Instead, create a migration script:

**File**: `packages/api/scripts/apply-XXXX-migration-name.ts`

```typescript
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// CRITICAL: Load .env from project root (3 levels up from scripts/)
config({ path: resolve(__dirname, '../../../.env') })

const client = postgres(process.env.DATABASE_URL!)
const db = drizzle(client)

async function apply() {
  console.log('Applying migration XXXX...')

  try {
    // Execute SQL with defensive coding (IF NOT EXISTS, IF NOT NULL)
    await db.execute(sql`
      ALTER TABLE districts
      ADD COLUMN IF NOT EXISTS new_field VARCHAR(100)
    `)
    console.log('✓ Added column: new_field')

    // Create index if needed
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_districts_new_field
      ON districts(new_field)
    `)
    console.log('✓ Created index: idx_districts_new_field')

    // If creating a new table, ALWAYS enable RLS
    await db.execute(sql`
      ALTER TABLE new_table ENABLE ROW LEVEL SECURITY
    `)
    console.log('✓ Enabled RLS on new_table')

    // Track migration in __drizzle_migrations table
    const timestamp = Date.now()
    await db.execute(sql`
      INSERT INTO __drizzle_migrations (hash, created_at)
      VALUES ('XXXX_migration_name', ${timestamp})
      ON CONFLICT DO NOTHING
    `)
    console.log('✓ Migration tracked')

  } catch (error) {
    console.error('✗ Migration failed:', error)
    throw error
  } finally {
    await client.end()
  }
}

apply()
```

### Step 4: Run Migration
```bash
cd packages/api
npx tsx scripts/apply-XXXX-migration-name.ts
```

### Step 5: Update Journal
Edit `packages/api/drizzle/meta/_journal.json` and add entry:

```json
{
  "idx": 1,
  "version": "7",
  "when": 1738723200000,
  "tag": "XXXX_migration_name",
  "breakpoints": true
}
```

The `when` value should be `Date.now()` timestamp. The `idx` is the next sequential number.

### Step 6: Update This Document
Add entry to Migration History table:

```markdown
| XXXX_migration_name | Description of what it does | Feb 5, 2026 |
```

Also update "Last updated" date at bottom.

### Step 7: Commit Changes
```bash
git add packages/api/src/db/schema.ts
git add packages/api/drizzle/XXXX_*.sql
git add packages/api/scripts/apply-XXXX-*.ts
git add packages/api/drizzle/meta/_journal.json
git add docs/DATABASE_MIGRATIONS.md
git commit -m "Add migration XXXX: [description]"
```

## Common Migration Patterns

### Add Column (Defensive)
```sql
ALTER TABLE districts
ADD COLUMN IF NOT EXISTS new_field VARCHAR(100);
```

### Add NOT NULL Column with Default
```sql
-- Step 1: Add column as nullable with default
ALTER TABLE districts
ADD COLUMN IF NOT EXISTS new_field VARCHAR(100) DEFAULT 'default_value';

-- Step 2: Backfill existing rows (if needed)
UPDATE districts
SET new_field = 'computed_value'
WHERE new_field IS NULL;

-- Step 3: Add NOT NULL constraint
ALTER TABLE districts
ALTER COLUMN new_field SET NOT NULL;
```

### Create Index (Defensive)
```sql
CREATE INDEX IF NOT EXISTS idx_districts_new_field
ON districts(new_field);
```

### Create Composite Index
```sql
CREATE INDEX IF NOT EXISTS idx_districts_state_tier
ON districts(state, outreach_tier);
```

### Enable RLS on New Table
```sql
-- Enable row-level security
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- Example policy: Allow all reads (adjust based on requirements)
CREATE POLICY "Allow read access" ON new_table
  FOR SELECT USING (true);

-- Our backend uses service_role which bypasses RLS
-- RLS prevents unauthorized access via PostgREST (Supabase anon key)
```

### Add Foreign Key (Defensive)
```sql
-- Check if constraint already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_district_documents_nces'
  ) THEN
    ALTER TABLE district_documents
    ADD CONSTRAINT fk_district_documents_nces
    FOREIGN KEY (nces_id) REFERENCES districts(nces_id);
  END IF;
END $$;
```

## Rollback Strategy

Drizzle doesn't have built-in rollback. For reversible changes:

1. **Test on staging first**
2. **Create reverse migration script** before applying forward migration
3. **Database backups** - Supabase provides point-in-time recovery

Example reverse migration:
```typescript
// File: scripts/rollback-XXXX-migration-name.ts
await db.execute(sql`
  ALTER TABLE districts DROP COLUMN IF EXISTS new_field
`)
```

## pgvector Special Case

The `document_embeddings.embedding` column uses the pgvector extension.

**Creating Vector Index** (requires data first):
```sql
-- IVFFlat index (efficient for 1K-1M vectors)
CREATE INDEX IF NOT EXISTS idx_embeddings_vector
ON document_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

**Note**: IVFFlat index requires >1000 rows for training. If table is empty, index creation will fail. Create index AFTER loading embeddings.

## Verifying Migration Success

Check tracked migrations:
```bash
cd packages/api
npx tsx -e "
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../.env') });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);
const result = await db.execute(sql\`SELECT * FROM __drizzle_migrations ORDER BY id\`);
console.log('Tracked migrations:');
result.rows.forEach(m => console.log(\`  \${m.id}. \${m.hash}\`));
await client.end();
"
```

## Security: Row Level Security (RLS)

### Why RLS Matters
- **Supabase exposes PostgREST by default** - tables are queryable via REST API
- **Without RLS, anon key = full read access** - major security vulnerability
- **Our backend uses `service_role`** - bypasses RLS, so our app works normally
- **RLS with no policies = deny all** - safest default for internal-only tables

### RLS Checklist for Every New Table

- [ ] Add `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` in migration
- [ ] Never store sensitive data (tokens, secrets) without RLS enabled
- [ ] If public access needed, create explicit policies and document why
- [ ] Test with anon key to verify RLS blocks unauthorized access

### Verifying RLS Status

```sql
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

All tables should show `rls_enabled = true`.

## Resources

- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [Drizzle PostgreSQL Column Types](https://orm.drizzle.team/docs/column-types/pg)
- [Drizzle pgvector Extension](https://orm.drizzle.team/docs/extensions/pg#pgvector)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [postgres Driver (not pg)](https://github.com/porsager/postgres)

---

**Last Updated**: February 5, 2026
**Schema Version**: 0000 (initial documentation)
