# Check Database Status

Check the current state of the AASA superintendent database.

Run `node scripts/db-status.js` and summarize:
1. Total districts and superintendent coverage percentage
2. Which states have data loaded
3. States with 0% coverage
4. Recent imports
5. Any unresolved quality flags

If the script doesn't exist or fails, query the database directly:

```sql
-- Coverage
SELECT COUNT(*), COUNT(superintendent_name),
       ROUND(COUNT(superintendent_name)*100.0/COUNT(*),1) as pct
FROM national_registry;

-- States loaded
SELECT state, COUNT(*) FROM state_registry_districts GROUP BY state ORDER BY COUNT(*) DESC;

-- Recent imports
SELECT source_name, record_count, imported_at FROM data_imports ORDER BY imported_at DESC LIMIT 5;
```

Database: `postgresql://postgres:UMK-egr6gan5vdb.nzx@db.wdvpjyymztrebwaiaidu.supabase.co:5432/postgres`
