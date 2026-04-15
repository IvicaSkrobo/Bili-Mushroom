# Phase 4: Stats & Export - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can understand their foraging patterns at a glance via a stats dashboard, drill into per-species breakdowns, view a seasonal calendar built from their own find dates, export their collection as a PDF journal or flat CSV.

Phase 4 owns: StatsTab (replaces EmptyState), stat cards, top-spots/best-months lists, seasonal calendar grid, per-species stats section, PDF export (via @react-pdf/renderer + Comlink), CSV export.

Phase 4 does NOT own: species knowledge base with edibility ratings (999.1 backlog), search/browse/wishlist (999.2 backlog), AI identification (v2).

Nav is now 3 tabs only: Collection, Map, Stats. SpeciesTab and BrowseTab removed.

</domain>

<decisions>
## Implementation Decisions

### Stats Dashboard Layout (STA-01, STA-02)
- **D-01:** Stat cards + simple list layout. No charts in v1.
  - Top section: 4 stat cards — Total Finds, Unique Species, Total Locations Visited, (4th Claude's discretion e.g. Most Active Month)
  - Below cards: two ranked lists — Top Spots (locations by find count) and Best Months (months by find count)
- **D-02:** All metrics derived from personal finds data in SQLite — no external data required.

### Seasonal Calendar (STA-03)
- **D-03:** Personal finds only — calendar is built from the user's own find dates, not general species season data. Honest and data-driven.
- **D-04:** 12-month grid layout. Each month cell shows dot/badge indicators for species found that month. Clicking a month reveals the full list of species found in that month.
- **D-05:** Empty state for months with no finds — show month name with muted styling, no dots.

### Per-Species Stats (STA-04)
- **D-06:** Lives within StatsTab as a ranked species section (not in CollectionTab). No cross-tab navigation needed.
- **D-07:** Each species row in the list is expandable/clickable to show:
  - Total find count
  - All locations found (list of country/region/location_note)
  - Date of first find
  - Best month for this species (month with most finds of this species)

### Export — PDF (EXP-01)
- **D-08:** PDF includes photos + metadata per find. Claude decides exact layout — aim for forager journal feel (not a spreadsheet). Each find gets a section with photo(s), species name, date, location, notes.
- **D-09:** Scope: full collection export (no filtered subset in v1). Export button lives in StatsTab or Settings — Claude's discretion.
- **D-10:** Use `@react-pdf/renderer` + Comlink Web Worker (per CLAUDE.md recommendation) to avoid freezing UI during generation.

### Export — CSV (EXP-02)
- **D-11:** Flat CSV included in v1. Columns: species_name, date_found, country, region, location_note, lat, lng, notes, photo_paths. Full collection only (no filtered subset in v1).

### Claude's Discretion
- Exact stat card visual design — use Forest Codex amber accent, Playfair Display for numbers, consistent with existing shadcn/ui card style.
- 4th stat card content — pick the most useful metric (e.g. Most Active Month or Avg Finds/Month).
- PDF page layout — journal-feel, photos prominent. Use `@react-pdf/renderer` JSX components.
- Placement of Export button (Stats tab action bar or Settings dialog).
- Rust vs JS for CSV generation — JS Blob export is simpler; use Rust only if file size warrants it.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Stats & Insights (STA-01 through STA-04) — all stats requirements
- `.planning/REQUIREMENTS.md` §Export (EXP-01, EXP-02) — PDF and CSV export requirements
- `.planning/PROJECT.md` §Constraints — local-only, Windows primary, no internet for core features

### Prior Phase Decisions
- `.planning/phases/01-foundation/01-CONTEXT.md` — SQLite WAL, migration runner, rusqlite pattern
- `.planning/phases/02-import-organization/02-CONTEXT.md` — finds schema, rusqlite direct queries
- `.planning/phases/03-map/03-CONTEXT.md` — Forest Codex aesthetic, shadcn/ui patterns, Zustand store

### Technology Stack (from CLAUDE.md)
- `@react-pdf/renderer` 3.x + Comlink 4.x — PDF generation in Web Worker (avoid UI freeze)
- rusqlite direct connection for Rust-side DB queries (established pattern from Phase 2)
- TanStack Query v5 for all async data hooks

### Nav Change
- SpeciesTab and BrowseTab removed from nav as of 2026-04-15 (commit 781fdcf)
- `Tab` type in `src/stores/appStore.ts` is now `'collection' | 'map' | 'stats'`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/tabs/StatsTab.tsx` — EmptyState placeholder; Phase 4 replaces entire content
- `src/hooks/useFinds.ts` + `src/lib/finds.ts` — `getFinds` fetches all finds including date_found, lat, lng, country, region, species_name, notes, photo paths
- `src/stores/appStore.ts` → `storagePath` — needed for rusqlite queries and PDF file path
- `src/components/ui/` — shadcn/ui Card, Badge, Button, Dialog — reuse for stat cards and export dialogs

### Established Patterns
- Rust Tauri commands for all DB reads; React calls via `invoke()` + TanStack Query
- `useFinds()` hook with `FINDS_QUERY_KEY` — stats queries should follow the same TanStack Query pattern
- Forest Codex amber palette (`oklch(0.72 0.12 80)`) and Playfair Display serif for display numbers

### Integration Points
- `src/lib/finds.ts` — add new Tauri IPC wrappers: `getStats()`, `getSeasonalCalendar()`, `getSpeciesStats()`
- `src-tauri/src/commands/finds.rs` — add stat query commands (aggregation SQL over finds table)
- `src-tauri/src/lib.rs` invoke_handler — register new stat commands alongside existing ones
- PDF export: new `src/workers/pdfExport.worker.ts` + `src/lib/exportPdf.ts` (Comlink bridge)
- CSV export: `src/lib/exportCsv.ts` — JS-side Blob generation, `<a download>` trigger

### Existing finds schema (for SQL aggregations)
- `finds` table: id, species_name, date_found (TEXT ISO), lat, lng, country, region, location_note, notes
- `find_photos` table: find_id, photo_path — join for PDF photo inclusion

</code_context>

<specifics>
## Specific Ideas

- **Year-end Forager Wrapped** (deferred — see below): User mentioned wanting a year-end overview — an album of images + stats combination for the past year. Captured as a deferred idea.
- Stat numbers should feel celebratory — large Playfair Display italic numerals with amber color, like a field journal header.
- Monthly calendar grid: mushroom emoji or amber dot indicator per month, not a generic calendar widget.

</specifics>

<deferred>
## Deferred Ideas

- **Year-end Forager Wrapped** — A year-end overview combining an album of the year's best find photos with personal stats (most found species, best location, most active month). Like Spotify Wrapped for foragers. Scope: own phase or feature addition after Phase 4 ships. Note for backlog.
- **Filtered PDF/CSV export** — Export a subset (by species, date range, location) rather than full collection. Deferred to after v1 ships.
- **Charts / visualizations** — Bar charts for monthly activity, pie charts for species distribution. Defer until user requests; stat cards + lists sufficient for v1.
- **General species season overlay on calendar** — Showing "chanterelles typically peak July-Sept" from external data requires Species DB (backlog Phase 999.1). Calendar in Phase 4 uses personal finds only.

</deferred>

---

*Phase: 04-stats-export*
*Context gathered: 2026-04-15*
