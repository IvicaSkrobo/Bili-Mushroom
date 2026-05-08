---
quick_id: 260509-0qx
slug: observed-count-range-stats
description: Add observed-count range stats to SpeciesStatSummary — min, max, avg across finds
date: 2026-05-09
status: complete
---

# Summary

## What was done

### src-tauri/src/commands/stats.rs

- Added `observed_min: Option<i64>`, `observed_max: Option<i64>`, `observed_avg: Option<f64>` to `SpeciesStatSummary` struct.
- Added per-species sub-query in `get_species_stats` using:
  - `MIN(COALESCE(observed_count_min, observed_count))` for overall low
  - `MAX(COALESCE(observed_count_max, observed_count))` for overall high
  - `AVG(midpoint)` where midpoint = exact count if present, else (min+max)/2, else whichever is available
  - Returns all-NULL when no finds have observed data (safe default via `unwrap_or`)
- Added `insert_find_with_range` test helper + 3 tests (all pass):
  1. Two finds with different ranges → correct min/max/avg
  2. No obs data → all NULL
  3. Mixed (one with, one without) → only data find contributes

### src/lib/stats.ts

- Added `observed_min`, `observed_max`, `observed_avg` to `SpeciesStatSummary` interface.

### src/components/stats/SpeciesStatRow.tsx

- Added `formatObserved(min, max, avg)` helper: formats as `"3–10 (avg 6.5)"`, `"7"`, `"avg 4.0"`, or omits section entirely when all null.
- Added "Observed" stat box inside the existing `flex gap-8` row, conditionally rendered only when at least one observed field is non-null.
- Added `flex-wrap` to the stat row so it wraps cleanly on narrow panels.

## Behaviour

| Species obs data | Display |
|---|---|
| find1: 3–5, find2: 5–10 | `3–10 (avg 5.8)` |
| exact counts only | `7 (avg 7)` |
| no obs data on any find | Observed box hidden |
| mixed (some with, some without) | Only finds with data contribute |

TypeScript: `npx tsc --noEmit` — clean (no errors).
Rust: 3 new tests pass, 68 existing pass.

## Files changed

- `src-tauri/src/commands/stats.rs`
- `src/lib/stats.ts`
- `src/components/stats/SpeciesStatRow.tsx`
