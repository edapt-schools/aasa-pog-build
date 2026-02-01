# Collect Multiple States in Parallel

Use subagents to collect superintendent data for multiple states at once.

## Arguments
- `$ARGUMENTS` - Comma-separated state abbreviations (e.g., MI,PA,NJ,AZ)

## Process

### Step 1: Parse states
Split the input into individual states.

### Step 2: Launch subagents
For each state, spawn a subagent with the collect-state task:

```
Use subagents to collect superintendent data for these states in parallel: {states}

For each state:
1. Find the official data source (Google search first)
2. Download/scrape the data
3. Save to data/processed/{state}_superintendents.csv
4. Update docs/SOURCES.md

Report back: source found, record count, any blockers.
```

### Step 3: Consolidate results
After subagents complete:
- Check which states succeeded
- Load successful CSVs with /load-state
- Document blockers for failed states

## Recommended Batch Sizes

| States | Approach |
|--------|----------|
| 1-2 | Just use /collect-state directly |
| 3-5 | Use subagents (optimal) |
| 6+ | Split into multiple batches |

## Priority States (by district count)

Large states to prioritize:
- NY (730 districts) - NOT LOADED
- PA (500 districts) - NOT LOADED
- MI (540 districts) - NOT LOADED
- IL (851 districts) - CSV exists, needs loading
- OH (610 districts) - CSV exists, needs loading

## Example

```
/collect-batch MI,PA,NJ,AZ,WA
```

This will spin up 5 subagents to collect data in parallel.
