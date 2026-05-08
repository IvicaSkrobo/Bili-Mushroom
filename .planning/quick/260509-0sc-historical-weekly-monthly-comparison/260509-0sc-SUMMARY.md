---
quick_id: 260509-0sc
slug: historical-weekly-monthly-comparison
description: Add "This Time in Past Years" section to Stats tab — per-year finds for current ISO week and month
date: 2026-05-09
status: complete
---

# Summary

## What was done

### src/lib/historicalComparison.ts (new)

- `getISOWeek(date)` — standard UTC-based ISO week algorithm (1–53).
- `buildHistoricalComparison(entries, today)` — groups `CalendarEntry[]` into per-year `YearBucket[]` for the current ISO week and current calendar month. Current year excluded. Species deduplicated (Latin name before comma). Buckets sorted most-recent year first.
- Exports: `YearBucket`, `HistoricalPeriodData` interfaces.

### src/components/stats/HistoricalComparison.tsx (new)

- Two-column grid: "This Week — Week N" (left) and "This Month — MonthName" (right).
- `PeriodColumn`: italic muted empty state; per-year rows with amber italic year / find count / species abbreviation.
- `formatSpecies`: shows up to 2 species names; "Species A, +N more" for longer lists.
- Forest Codex style: `font-serif italic text-primary` year, `text-xs text-muted-foreground` species.

### src/tabs/StatsTab.tsx (edit)

- Added imports for `HistoricalComparison` and `buildHistoricalComparison`.
- Added `historicalComparison` useMemo from `calendar`.
- Added "This Time in Past Years" section after the `speciesSpotHint` Alert block, before the seasonal calendar divider. Only renders when `calendar` data is present.

## Behaviour

| Scenario | Display |
|---|---|
| Finds in same ISO week in 2023 + 2024 | Two rows: 2024 first, then 2023 |
| No finds in this week/month historically | Italic empty state per column |
| Multiple finds same species | Species listed once (dedup'd) |
| Current year finds | Excluded |

TypeScript: `npx tsc --noEmit` — clean.
Vitest: 10 tests pass (8 behaviour + 2 getISOWeek).

## Files changed

- `src/lib/historicalComparison.ts` (new)
- `src/components/stats/HistoricalComparison.tsx` (new)
- `src/lib/historicalComparison.test.ts` (new)
- `src/tabs/StatsTab.tsx` (edited)
