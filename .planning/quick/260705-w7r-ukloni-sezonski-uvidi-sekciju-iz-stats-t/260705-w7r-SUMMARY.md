---
phase: quick
plan: 260705-w7r
subsystem: ui
tags: [react, typescript, i18n, stats, dead-code-removal]

# Dependency graph
requires: []
provides:
  - Removed the redundant "Seasonal Insights" (Sezonski uvidi) card from the Stats tab
  - insights.ts now exports only buildSpeciesSpotHint and its private helpers
affects: [stats-tab, i18n]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - src/lib/insights.ts
    - src/lib/insights.test.ts
    - src/tabs/StatsTab.tsx
    - src/i18n/index.ts

key-decisions:
  - "Removed buildSeasonalityInsights/SeasonalityInsight entirely rather than deprecating, since no other usages existed anywhere in src/"

patterns-established: []

requirements-completed: []

# Metrics
duration: 8min
completed: 2026-07-05
---

# Phase quick Plan 260705-w7r: Remove Seasonal Insights Section Summary

**Removed the redundant "Seasonal Insights" card (generic "June is historically strong" text) from the Stats tab, deleting the dead `buildSeasonalityInsights` function, its tests, and four unused i18n keys, while leaving "This Time in Past Years" and the Compass spot-hint untouched.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-05T21:07:00Z
- **Completed:** 2026-07-05T21:15:49Z
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments
- Deleted `SeasonalityInsight` interface and `buildSeasonalityInsights` function from `src/lib/insights.ts`, keeping `buildSpeciesSpotHint` and its private helpers (`markedSpeciesName`, `localMonthName`, `extractMonthNum`) fully intact
- Removed the corresponding `describe('buildSeasonalityInsights', ...)` test block and unused i18n mock templates from `src/lib/insights.test.ts`
- Removed the `seasonalityInsights` useMemo and the "Seasonal Insights" JSX card from `src/tabs/StatsTab.tsx`, updating the `@/lib/insights` import to only pull `buildSpeciesSpotHint`
- Removed four now-unused i18n keys (`stats.insightStrong`, `stats.insightMostActive`, `stats.insightLogged`, `stats.seasonalInsights`) from both the hr and en blocks in `src/i18n/index.ts`

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove buildSeasonalityInsights from insights.ts and its tests** - `e180139` (refactor)
2. **Task 2: Remove Seasonal Insights block from StatsTab.tsx and unused i18n keys** - `67c9cc9` (refactor)

**Plan metadata:** pending (docs: complete plan, handled by orchestrator)

## Files Created/Modified
- `src/lib/insights.ts` - Removed `SeasonalityInsight` interface and `buildSeasonalityInsights` function; now exports only `buildSpeciesSpotHint`
- `src/lib/insights.test.ts` - Removed `describe('buildSeasonalityInsights', ...)` block and its import; kept `buildSpeciesSpotHint` test and mock template
- `src/tabs/StatsTab.tsx` - Removed `seasonalityInsights` useMemo and its JSX card; updated import to only bring in `buildSpeciesSpotHint`
- `src/i18n/index.ts` - Removed `stats.insightStrong`, `stats.insightMostActive`, `stats.insightLogged`, `stats.seasonalInsights` from hr and en blocks

## Decisions Made
- Removed the dead code entirely (no deprecation shim) since investigation confirmed zero other usages across `src/` — matches the plan's exact, pre-verified scope.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Note: an existing repository pre-commit/post-add hook (`bump-version`) automatically bumped the app version and staged version-metadata files (`package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`, `website/src/siteData.ts`) into each commit alongside the explicitly staged task files. This is pre-existing repo automation unrelated to this plan's scope and was not something this execution introduced or could bypass without skipping hooks (which is prohibited). The excluded files (`src-tauri/src/commands/tile_proxy.rs`, `updater.rs`, `zones.rs`, `website/src/App.tsx`, `website/src/styles.css`) were verified to remain untouched and unstaged after both commits.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Stats tab now shows only "This Time in Past Years" and the Compass spot-hint for seasonal/historical context; no further follow-up required for this cleanup.
- `npm run build` and `npx vitest run src/lib/insights.test.ts` both pass.
- Deferred (per plan): manual visual verification of the Stats tab in the running app to confirm the Seasonal Insights card is visually gone and surviving sections render correctly.

---
*Phase: quick*
*Completed: 2026-07-05*

## Self-Check: PASSED

All modified files confirmed present on disk; both task commits (`e180139`, `67c9cc9`) confirmed present in git log.
