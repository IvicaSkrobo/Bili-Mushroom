---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: active
stopped_at: null
last_updated: "2026-04-29T15:07:00.000Z"
last_activity: 2026-04-29 -- Added GSD plan for species-specific map zones with circle-first local zones and polygon-ready region zones
progress:
  total_phases: 9
  completed_phases: 6
  total_plans: 19
  completed_plans: 19
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-09)

**Core value:** A forager's personal mushroom journal — every find stored, organized, searchable, and mapped so that nothing collected is ever forgotten.
**Current focus:** Post-Phase 04 maintenance and bug-fix follow-up

## Current Position

Phase: 04.2 complete — MAINTENANCE
Plan: Post-phase maintenance
Status: Completed planned phase work; maintenance fixes and planning artifacts are synced to the current shipped behavior
Last activity: 2026-04-23 -- Windows photo reopening bug fixed via normalized asset paths and expanded asset protocol scope

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 02-import-organization P01 | 404 | 3 tasks | 9 files |
| Phase 02-import-organization P02 | 600 | 3 tasks | 18 files |
| Phase 02.1-import-workflow-refinements P02 | 5 | 2 tasks | 7 files |
| Phase 02.1-import-workflow-refinements P01 | 11 | 2 tasks | 7 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Foundation: SQLite MUST use WAL mode; migration runner MUST be in place before any feature code writes to DB
- Foundation: Tauri 2 WebView2 limitation requires a Rust-based map tile proxy — do NOT use browser IndexedDB for tile caching
- Import: EXIF parsing via kamadak-exif crate; validate early in import phase
- [Phase 02-import-organization]: rusqlite direct connection for Rust-side DB queries (not tauri-plugin-sql JS bridge)
- [Phase 02-import-organization]: import_find accepts pre-parsed EXIF values from frontend; parse_exif called separately in preview phase
- [Phase 02-import-organization]: protocol-asset Tauri feature required when assetProtocol enabled in tauri.conf.json
- [Phase 02-import-organization]: Folder enumeration uses JS-side readDir + SUPPORTED_EXTENSIONS filter; no Rust list_images command needed
- [Phase 02-import-organization]: invokeHandlers dispatch table in tauri-mocks enables per-test handler overrides
- [Phase 02.1-import-workflow-refinements]: react-leaflet v4.2.1 used (not v5) — v5 requires React 19, project uses React 18
- [Phase 02.1-import-workflow-refinements]: LocationPickerMap tests fully mock react-leaflet and leaflet — jsdom cannot render Leaflet maps
- [Phase 02.1-import-workflow-refinements]: Test helpers placed in pub(crate) mod test_helpers at file level (not inside mod tests) so cross-module test sharing works in Rust
- [Phase 02.1-import-workflow-refinements]: Two-query get pattern: fetch all finds then all find_photos, join in Rust with HashMap<i64, Vec<FindPhoto>>

### Pending Todos

- [x] Fix quit button in error dialog — dialog now calls backend quit_app directly for reliable app exit
- [x] Add Clear All button to import photo picker — `ImportDialog` shows `Clear All` when the queue is non-empty and clears the pending list in one click
- [x] Batch metadata cascade in import picker — shared import header now cascades species/date/location/observed count while preserving per-card field locks and edits
- [x] Confirm duplicate strategy: strict timestamp+location blocking was rejected; current duplicate handling does not use burst-prone timestamp+location heuristics
- [ ] Change import flow to create one find with many photos per import batch, using explicit grouping instead of hard date+location dedupe
- [ ] Add optional home location/default map region in first run + settings, with persisted map center fallback
- [ ] Add place/country search to LocationPickerMap (forward geocoding)
- [ ] Review map-side derived computation costs and centralize persisted user preferences before adding more settings
- [ ] Audit map scalability path (grouping/clustering/render costs) before any major map-stack rewrite
- [ ] Plan staged i18n expansion beyond hr/en, prioritizing de/it/sl with completeness and UI-fit checks
- [ ] Do a post-grouped-import UX safety pass for mixed batches and future split/ungroup affordances
- [ ] Review bulk operations for consistent confirmation, refresh, and cache-update behavior
- [ ] Review map tile cache policy (limit, eviction, settings exposure, offline UX copy)
- [ ] Rework query/list strategy for large libraries (5k+ photos): lighter query shapes, targeted cache updates, and/or virtualization where needed
- [ ] Implement species-specific map zones: local circle zones first, polygon-ready region zones next, with map view modes for pins/local/region/all
- [x] Stabilize PDF export path — keep `@react-pdf/renderer`, add smoke-test diagnostics, and fall back to main-thread rendering when the worker stalls in Tauri
- [x] Redesign PDF journal pacing/content — interleave stats pages with highlight spreads and photo ribbons, convert the trailing page into a species list, and align labels with photo-count semantics
- [x] Add favorites support for finds — migration + backend command + collection UI toggle/filter + tests
- [x] Implement paired Forest Codex themes — light and dark theme tokens, persistence, and UI toggles are live in the app shell/settings

### Quick Tasks Completed

| Task | Date | Summary |
|------|------|---------|
| 260410-flf import-workflow-improvements | 2026-04-10 | Location mark field, species folder autocomplete, folder path in collection, Rust location_note fix |
| 260410-ftm shared-header-cascade | 2026-04-10 | Date/country/region/location_note in shared header; reverse geocode → shared state; per-card field lock with amber indicator + unlock button |
| 260411-uat-review-fixes | 2026-04-11 | PostImportReviewDialog: per-find delete (record-only, filters list), photo thumbnails, Import more button. ImportDialog: date picker (type=date, black text), delete-source checkbox (default checked, skips in-place files). BulkMetadataBar removed (shared header is primary bulk approach). |
| 260415-li5 folder-edit-dialog-editfinddialog-revers | 2026-04-15 | FolderEditDialog: bulk rename species + map pick → reverse geocode → country/region for folder (overwrite toggle). EditFindDialog: reverse geocode auto-fill on map pick. OpenTopoMap tile layer added to LayerSwitcher + LocationPickerMap. |
| 260415-pf0 map-topo-default-collection-pins-on-map | 2026-04-15 | Topo as default map layer; amber collection-level pins at species centroid; amber left border + warm bg on open collection folders. |
| 260415-psr collection-pin-labels-amber-pill-overlap | 2026-04-15 | Amber pill label below each collection pin; overlap detection hides labels on crowded pins; hover/focus-within reveals label via CSS transition. |
| 260415-pv9 satellite-map-default-persist-last-picked | 2026-04-15 | MapLayer type + loadMapLayer() in appStore; Satellite as default; baselayerchange persists selection to localStorage. |
| 260415-q4k fix-collection-pin-icon-badge-visible-la | 2026-04-15 | Rewrote collectionIcon: iconSize 28x28, absolute positioning, overflow:visible — badge renders correctly, label flows below pin. |
| 260415-qb3 fix-collection-pin-icon-zero-size-anchor | 2026-04-15 | iconSize:[0,0]+iconAnchor:[0,0] — 0x0 div at coordinate; badge floats above via bottom:4px; label below via top:4px; escapes Leaflet clipping. |
| 260415-qf3 collection-pin-badge-latin-name-bg | 2026-04-15 | hex colors replace oklch in DivIcon (WebView reliability); text-align+line-height replaces display:flex for badge centering; Latin name extracted (before comma) for abbr + label. |
| 260415-ql0 collection-pin-popup-species-note-photo-carousel | 2026-04-15 | CollectionPopup with species description (SpeciesNote.notes) + photo carousel (all finds' photos, prev/next); Collection carries finds[]; hooks called inside CollectionPinsInner. |
| 260415-qsu fix-collection-map-pin-visibility-label | 2026-04-15 | iconSize [0,0]→[28,28]; badge renders in real bounds; overflow:visible on marker; description scrollable max-h-[90px]; per-photo find.notes overrides species fallback. |
| 260415-rea satellite-pill-text-contrast | 2026-04-15 | White text + text-shadow on satellite collection pills; #F5E6C8 on amber had insufficient contrast ratio. |
| 260415-rjf pill-text-white-always | 2026-04-15 | Pill text always #fff + text-shadow in CSS base; removed isSatellite conditional override entirely. |
| 260415-rns pill-text-layer-aware-css-class | 2026-04-15 | Dark text on street/topo, white on satellite via CSS class; bili-collection-marker--satellite on divIcon className. |
| 260415-rpv crowded-pins-dot-hover-reveal | 2026-04-15 | Crowded pins collapse to amber dot; hover expands full pill via max-width CSS transition. |
| 260415-sj5 map-species-filter-panel | 2026-04-15 | Species filter panel on map: search + checkboxes, See all, filtered finds passed to CollectionPins. |
| 260415-syy collection-photo-lightbox-within-folder | 2026-04-15 | PhotoLightbox overlay in collection folders: click thumbnail → enlarged photo + metadata panel (species, date, notes, coords); prev/next (buttons + keyboard); Esc/click-outside closes. |
| 260416-ui-identity-refresh | 2026-04-16 | Frontend identity refresh applied: typography swap, token/palette overhaul, shell chrome updates, and stats visual polish (header/tabs/footer cohesion). |
| 260423-gsd-backlog-audit | 2026-04-23 | Re-audited backlog/todos against the repo: confirmed Clear All, shared import cascade, theme support, and lightbox are shipped; later removed the declined folder-hierarchy follow-up. |
| 260423-windows-photo-reload-fix | 2026-04-23 | Normalized persisted photo asset paths across collection/species/map surfaces and widened Tauri asset scope so thumbnails/lightbox images still load after reopening the app on Windows. |
| 260416-gsd-priority-sync | 2026-04-16 | Captured user-approved priorities: Seasonality insights + spot reminders; inserted Phase 04.1 (UX governance/perf/E2E) and 04.2 (insights/hints) into planning docs. |
| 260416-04.1-01-ui-governance | 2026-04-16 | Published governance baseline (tokens, variants, motion/accessibility rules, review checklist) for Phase 04.1-01. |
| 260416-full-implementation-pass | 2026-04-16 | Implemented lazy-loaded tab bundles, added seasonality insights + species spot hints in Stats, and added/updated critical-path tests for App and insights logic. |
| 260416-startup-quit-fix | 2026-04-16 | Startup DB error dialog Quit button now invokes backend quit_app directly; synced HANDOFF/STATE notes to current post-04.2 reality. |
| 260417-pdf-export-stabilization | 2026-04-17 | Added worker smoke test + timeout fallback to main-thread `react-pdf` rendering, kept Quick PDF as a dev-only aid, and confirmed production builds succeed. |
| 260417-pdf-journal-redesign | 2026-04-17 | Reworked the PDF into mixed stats/photo pacing with highlight spreads, photo ribbons, a species-list tail page, and photo-count labeling where users expect totals. |
| 260417-favorites-support | 2026-04-17 | Added `is_favorite` migration/command wiring, favorite toggles in find cards, favorites-only collection filter, i18n strings, and supporting tests/mocks. |

### Roadmap Evolution

- Phase 02.1 inserted after Phase 2: Import workflow refinements (URGENT)

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-04-17T13:05:00.000Z
Stopped at: null
Resume file: None
