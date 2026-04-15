---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 3 UI-SPEC approved
last_updated: "2026-04-13T12:55:13.656Z"
last_activity: 2026-04-15 -- Completed quick task 260415-q7c: folder location picker saves lat/lng to collection finds
progress:
  total_phases: 7
  completed_phases: 3
  total_plans: 15
  completed_plans: 11
  percent: 73
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-09)

**Core value:** A forager's personal mushroom journal — every find stored, organized, searchable, and mapped so that nothing collected is ever forgotten.
**Current focus:** Phase 02.1 — import-workflow-refinements

## Current Position

Phase: 02.1 (import-workflow-refinements) — EXECUTING
Plan: 2 of 2
Status: Ready to execute
Last activity: 2026-04-13 -- Phase 03 planning complete

Progress: [█░░░░░░░░░] 17%

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

- [ ] Fix quit button in error dialog — button unresponsive when DB/startup error is shown
- [ ] Add Clear All button to import photo picker — removes all queued photos in one click
- [ ] Batch metadata cascade in import picker — shared name+location header above card list, pre-filled from folder name, cascades to all cards; each card still individually editable
- [ ] Folder hierarchy import mode — main folder > mushroom sub-folders > photos; each sub-folder becomes one find batch, folder name = default mushroom name; collection reflects this structure
- [ ] Implement dark and light color themes Forest Codex — high-contrast dark + warm parchment light; use frontend-design skill + ask user for reference image at task start

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

### Roadmap Evolution

- Phase 02.1 inserted after Phase 2: Import workflow refinements (URGENT)

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-04-11T18:22:49.184Z
Stopped at: Phase 3 UI-SPEC approved
Resume file: .planning/phases/03-map/03-UI-SPEC.md
