# Load State Data

Load a state's superintendent CSV file into the database.

## Arguments
- `$ARGUMENTS` - State abbreviation (e.g., IL, NY, OH)

## Process

1. **Find the CSV file**
   ```
   data/processed/{state}_superintendents.csv
   ```

2. **Read and understand the schema**
   - Map columns to `state_registry_districts` table
   - Required: district_name, state
   - Important: administrator_first_name, administrator_last_name, phone, city

3. **Create audit record FIRST**
   ```sql
   INSERT INTO data_imports (id, source_type, source_name, source_url, source_file, record_count, imported_at, imported_by)
   VALUES (gen_random_uuid(), 'state_registry', '{State} DoE', '{source_url}', '{filename}', {count}, NOW(), 'claude-code');
   ```

4. **Insert records**
   ```sql
   INSERT INTO state_registry_districts (id, state, district_name, administrator_first_name, administrator_last_name, ...)
   VALUES ...
   ```

5. **Run matching**
   - Match against `districts` table using normalized names
   - Insert results to `district_matches`
   - Flag low-confidence matches (< 0.85)

6. **Report results**
   - Records loaded
   - Match rate by method
   - New superintendent coverage for the state

## Critical Rules
- NEVER skip the data_imports record
- Use fuzzy matching, not exact string matching
- Flag uncertain matches for review

Database: `postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres`
