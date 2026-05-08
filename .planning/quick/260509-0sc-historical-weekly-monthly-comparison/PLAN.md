---
quick_id: 260509-0sc
slug: historical-weekly-monthly-comparison
description: Add "This Time in Past Years" section to Stats tab — per-year finds for current ISO week and month
date: 2026-05-09
status: in-progress
---

# Plan

## Goal

Stats tab shows a two-column section answering:
- What did I find around this week in earlier years?
- What did I find in this month in earlier years?

Pure frontend — reuses existing `calendar` data (already fetched).

## Tasks

1. Create `src/lib/historicalComparison.ts` — ISO week util + `buildHistoricalComparison`
2. Create `src/components/stats/HistoricalComparison.tsx` — two-column display component
3. Edit `src/tabs/StatsTab.tsx` — add import, useMemo, section after speciesSpotHint
4. Create `src/lib/historicalComparison.test.ts` — 8 Vitest tests

## Files

- `src/lib/historicalComparison.ts` (new)
- `src/components/stats/HistoricalComparison.tsx` (new)
- `src/lib/historicalComparison.test.ts` (new)
- `src/tabs/StatsTab.tsx` (edit)
