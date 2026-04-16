---
phase: 04-stats-export
plan: "02"
subsystem: stats-ui
tags: [react, typescript, ui, tailwind, forest-codex, tanstack-query]
dependency_graph:
  requires:
    - stats TanStack Query hooks from plan 01 (useStatsCards, useTopSpots, useBestMonths, useCalendar, useSpeciesStats)
    - src/lib/stats.ts types (StatsCards, TopSpot, BestMonth, CalendarEntry, SpeciesStatSummary)
  provides:
    - Full StatsTab dashboard UI (src/tabs/StatsTab.tsx)
    - StatCard component with Playfair Display amber numerals
    - RankedList component for Top Spots and Best Months
    - SeasonalCalendar with 12-month grid and expandable month detail
    - SpeciesStatRow expandable accordion rows
  affects:
    - src/tabs/StatsTab.tsx (replaced EmptyState placeholder)
    - src/components/stats/ (new directory, 4 new components)
tech_stack:
  added: []
  patterns:
    - Forest Codex aesthetic — amber serif numerals, uppercase tracked labels, left-border hover reveal
    - stagger-item + animationDelay for list animations
    - useMemo for calendar bucket grouping
    - max-h-0/max-h-96 CSS transition for expand/collapse without JS measurements
    - grid grid-cols-3 with col-span-3 detail panel for inline calendar expansion
key_files:
  created:
    - src/components/stats/StatCard.tsx
    - src/components/stats/RankedList.tsx
    - src/components/stats/SeasonalCalendar.tsx
    - src/components/stats/SpeciesStatRow.tsx
  modified:
    - src/tabs/StatsTab.tsx
decisions:
  - "StatsTab renders empty state when statsCards.total_finds === 0 (not when data is undefined), matching UI-SPEC copy contract"
  - "SeasonalCalendar detail panel inserts as col-span-3 after every 3rd cell in the flat cells[] array, avoiding nested grid complexity"
  - "Card component used for StatCard base but overriding gap/py defaults via className to achieve compact 16px padding layout"
metrics:
  duration_seconds: 310
  completed_date: "2026-04-16"
  tasks_completed: 2
  files_created: 4
  files_modified: 1
---

# Phase 04 Plan 02: Stats UI Dashboard Summary

**One-liner:** Four Forest Codex UI components (StatCard, RankedList, SeasonalCalendar, SpeciesStatRow) assembled into a full StatsTab dashboard consuming Plan 01 TanStack Query hooks.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | StatCard, RankedList, and StatsTab top section | de69581 | StatCard.tsx, RankedList.tsx, StatsTab.tsx |
| 2 | SeasonalCalendar and SpeciesStatRow components | ee7c924 | SeasonalCalendar.tsx, SpeciesStatRow.tsx |

## What Was Built

### Task 1 — Stat cards, ranked lists, StatsTab scaffold

`src/components/stats/StatCard.tsx` — single metric card with:
- Playfair Display italic 36px amber numeral (`font-serif text-4xl font-bold italic text-primary`)
- DM Sans 12px uppercase tracked label (`uppercase tracking-[0.12em] text-muted-foreground`)
- Amber left-border pseudo-element revealed on hover
- `stagger-item` with `animationDelay` prop-driven offset

`src/components/stats/RankedList.tsx` — ranked items list with:
- Amber Playfair Display italic rank number (`#1`, `#2` …)
- shadcn Badge (outline variant) for count
- Left-border amber hover reveal per Forest Codex pattern
- `emptyMessage` shown when items array is empty

`src/tabs/StatsTab.tsx` — full dashboard replacing EmptyState placeholder:
- Consumes all five `useStats*` hooks from Plan 01
- Loader2 spinner while `statsLoading`
- Empty state (`Your story starts with one find`) when `total_finds === 0`
- `grid grid-cols-4` for 4 stat cards, `flex gap-4` for 2 ranked lists side-by-side
- `formatMonth` helper parses "YYYY-MM" → "May 2024" via Intl.DateTimeFormat
- `formatTopSpots` and `formatBestMonths` map domain types to `{ label, count }[]`

### Task 2 — Seasonal calendar and per-species rows

`src/components/stats/SeasonalCalendar.tsx` — 12-month grid with:
- `useMemo` bucket grouping of `CalendarEntry[]` into per-month species sets
- `grid grid-cols-3 gap-3` layout (4 rows × 3 months)
- Amber dot indicator per unique species (max 5 dots + overflow count)
- Expandable inline detail panel: inserted as `col-span-3` after the 3-cell row containing the selected month
- Empty and populated month cell states with distinct styling
- "Your Season" uppercase tracked section heading

`src/components/stats/SpeciesStatRow.tsx` — expandable accordion row with:
- `border-primary/60 border-l-[3px]` active left-border (Forest Codex card pattern)
- `max-h-0` / `max-h-96` CSS transition (200ms) for smooth expand
- Rank number (amber serif italic), species name (serif italic), find count badge
- Expanded detail: Total Finds, First Find, Best Month (formatted via Intl), Locations list

## Test Results

- Stats hooks suite: `npm run test -- --run src/hooks/useStats.test.tsx` → 5/5 passed (Plan 01 tests unchanged)
- Full suite: 282 passing, 84 failing — identical to baseline before this plan's changes (84 pre-existing Leaflet/map mock failures, scope boundary respected)
- No regressions introduced

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All components consume live TanStack Query data from Plan 01 hooks. No hardcoded empty values flow to rendering.

## Threat Flags

None. All components are read-only display. No new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/components/stats/StatCard.tsx | FOUND |
| src/components/stats/RankedList.tsx | FOUND |
| src/components/stats/SeasonalCalendar.tsx | FOUND |
| src/components/stats/SpeciesStatRow.tsx | FOUND |
| src/tabs/StatsTab.tsx | FOUND (modified) |
| Commit de69581 (Task 1) | FOUND |
| Commit ee7c924 (Task 2) | FOUND |
