---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: "Released v0.1.22: stats drill-down, Windows compat, species editor UX overhaul, edibility note migrations, import/create dialog UX polish"
last_updated: "2026-05-19T14:30:00.000Z"
last_activity: 2026-05-19 -- Added Phase 05-07 Real App Alignment Pass so the public website is checked against real collection, species, map, and find workflows before sharing
progress:
  total_phases: 10
  completed_phases: 6
  total_plans: 25
  completed_plans: 19
  percent: 79
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-09)

**Core value:** A forager's personal mushroom journal — every find stored, organized, searchable, and mapped so that nothing collected is ever forgotten.
**Current focus:** Website/release work plus newly planned large-library management/scalability for users with existing photo folders or multi-thousand-photo libraries

## Current Position

Phase: 04.2 complete — MAINTENANCE
Plan: Post-phase maintenance
Status: Completed planned phase work; maintenance fixes and planning artifacts are synced to the current shipped behavior
Last activity: 2026-07-06 - Completed quick task 260706-p4x: Collection tab date filters use a calendar picker instead of typed digits

Progress: [████████░░] 79%

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
| Phase quick P260508-w26 | 20 | 4 tasks | 9 files |
| Phase quick P260508-wlr | 8 | 2 tasks | 5 files |
| Phase quick P260508-wwb | 25 | 3 tasks | 9 files |
| Phase quick P260509-bt0 | 12 | 3 tasks | 5 files |

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
- No-photo find creation: create_find Rust command with no photo insert, open_find_folder photo-scope falls back to species folder when no photos
- LocationNoteInput uses internal localValue state for dropdown filter — controlled-component pattern where parent mock does not propagate onChange as prop update
- per-photo delete uses std::fs::remove_file (not trash) — explicit permanent deletion, NotFound errors silently ignored
- Edibility/protected_status stored as NULL in DB when unknown — UI normalizes to 'unknown' enum via guard functions; 'unknown' string never written to DB
- Single upsert path for edibility/protected_status: FolderEditDialog passes values via onSave callback; CollectionTab's single upsertSpeciesProfile.mutate() call merges them — no double upsert
- Separate find-level notes (finds.notes) from species-level notes (species_notes) in ImportDialog — two distinct textareas for semantically different content
- CreateFindDialog offers edibility and protected-status selects matching ImportDialog and FolderEditDialog — upserts species profile on save when values are set

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
- [ ] Execute Phase 06 Large Library Management & Scalability: clear folder semantics/tooltips, copy/move/register flows, batch import/relocation, paginated query shapes, virtualized collection browsing, and viewport-aware map rendering for 5k+ and stretch 100k-photo libraries
- [ ] Implement species-specific map zones: local circle zones first, polygon-ready region zones next, with map view modes for pins/local/region/all
- [ ] Add manual "Check for updates" action plus low-noise background update re-check every few hours
- [ ] Add non-mutating photo library health check: report missing files/references before any cleanup action
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
| 260507-map-zone-ux-pass | 2026-05-07 | Region/local polygon workflows polished: draw/edit actions from pins, focused draw mode, local-color drafts/edit handles, smoother polygon editing, and improved zone panel switching/empty states. |
| 260507-updater-release-hardening | 2026-05-07 | Added app updater wiring, visible header version/update CTA, release automation script, release workflow fallback on GitHub Release publish, and fixed public-key configuration for updater bundles. |
| 260507-folder-edit-disk-sync | 2026-05-07 | Species rename from edit now moves files on disk, species-folder editing can open the on-disk species folder, and find edit can open species/photo folders for inspection. |
| 260507-txk add-more-photos-to-existing-find | 2026-05-07 | Add photos button in EditFindDialog: file picker, preview list, confirmation; Rust add_find_photos command copies to species folder, inserts DB rows with is_primary=false. |
| 260508-vtz add-manual-update-flow | 2026-05-08 | Manual Check for updates / Update now panel in SettingsDialog: 7-state checkStatus, pre-populates from store auto-check, error messages always shown. |
| 260508-w26 implement-no-photo-find-creation | 2026-05-08 | create_find Rust command + open_find_folder no-photo guard; createFind TS wrapper + useCreateFind hook; CreateFindDialog (mirrors EditFindDialog, all fields); "New Find" button in CollectionTab; 8 Rust + 11 Vitest tests. |
| 260508-wlr location-note-autocomplete | 2026-05-08 | LocationNoteInput component (mirrors SpeciesNameEditor: keyboard nav, 150ms blur delay); wired into CreateFindDialog, EditFindDialog, ImportDialog; 6 Vitest tests. |
| 260508-wwb per-photo-management | 2026-05-08 | delete_find_photo + bulk_delete_find_photos Rust commands (primary-promotion, disk removal); TS hooks; EditFindDialog photo grid with per-photo X + multi-select + "Delete N"; PhotoLightbox rose delete button; 4 Rust + Vitest tests. |
| 260705-vu3 kad-se-preklapa-vise-zona-na-karti-klik- | 2026-07-05 | Added zonesContainingPoint(zones, lat, lng) hit-test helper in zones.ts (+ unit tests); ZoneLayers.tsx now hit-tests all displayed zones on click and shows a ZonePickerPopup when 2+ zones overlap at that point, letting the user choose which one to open instead of always opening the topmost. |
| 260705-w03 popravi-izgled-hover-tooltipa-za-pin-s-v | 2026-07-05 | Multi-species hover tooltip (CollectionPins.tsx) now stacks species names vertically via explicit flex-column instead of relying on implicit div stacking; removed white-space: nowrap on .bili-species-tooltip that was collapsing the layout. |
| 260705-w54 primijeni-filled-field-vizualni-tretman- | 2026-07-05 | Extracted filledClass helper from CreateFindDialog.tsx into shared src/lib/filledFieldStyle.ts; applied the same amber/bold filled-field styling to all 9 shared-header fields in ImportDialog.tsx (species name, common name, date, country, region, location note, observed count, find notes, species notes, species description). |
| 260705-w7r ukloni-sezonski-uvidi-sekciju-iz-stats-t | 2026-07-05 | Removed redundant "Seasonal Insights" card from Stats tab: deleted buildSeasonalityInsights/SeasonalityInsight from insights.ts + its tests, removed the useMemo and JSX block from StatsTab.tsx, and dropped 4 unused i18n keys (hr+en). "This Time in Past Years" and Compass spot-hint untouched. |
| 260705-wax dodaj-scroll-na-listu-zona-u-zonepickerp | 2026-07-05 | Added max-h-[240px] overflow-y-auto to ZonePickerPopup's inner zone list (ZoneLayers.tsx) so the picker scrolls instead of growing unbounded when many zones overlap at one point. |
| 260705-wdb dodaj-mogucnost-pregleda-i-zumiranja-uve | 2026-07-05 | New StagedPhotoViewer.tsx: read-only lightbox for staged (not-yet-saved) import photos with scroll/button/double-click zoom (1x-5x), drag-to-pan, prev/next navigation, Escape/X close — mirrors PhotoLightbox interaction model without any storagePath/Find DB dependency. ImportDialog.tsx wires thumbnail click to open it at the clicked index; existing remove (X) button unaffected. 36 tests pass. |
| 260705-wx6 popravi-photolightbox-zoom-pan-se-ne-res | 2026-07-05 | Fixed bug: reopening the same photo in PhotoLightbox (Collection view) showed it still zoomed-in/cropped from a previous session because the zoom/pan/crop/rotation reset useEffect only depended on [currentIndex, fallbackFind?.id], not on `open`. Added `open` to the dependency array so every reopen resets to zoom=1. New PhotoLightbox.test.tsx regression test (2 tests). |
| 260706-02t auto-populate-find-lat-lng-from-photo-ex | 2026-07-06 | Import now auto-fills a find's lat/lng from the first GPS-tagged photo's EXIF (import.rs: `first_gps_coords_from_paths`/`resolve_find_coords`); `add_find_photos` (finds.rs) backfills lat/lng the same way when photos are added to an existing find. Manual coordinates (payload or already-set find) always win — EXIF only fills genuinely empty lat/lng. EditFindDialog/LocationPickerMap unchanged. |
| debug/open-in-collection-no-op | 2026-07-06 | Fixed recurring bug: "Otvori u zbirci" button in Species tab silently did nothing for species names containing `*markup*` asterisks. Root cause: the jump-to-species search filter stripped asterisks from the query string but not from the raw `species_name` DB column, so the server-side SQL `LIKE` clause never matched — compounded by `CollectionTab` staying mounted (forceMount) with stale filter state across tab switches. Fix: `push_find_search_filters` (import.rs) now strips `*` from the DB column too (`LOWER(REPLACE(species_name, '*', ''))`); `CollectionTab.tsx` jump effect shows the plain (markup-stripped) name in the search box. Regression test added in CollectionTab.test.tsx. See `.planning/debug/open-in-collection-no-op.md`. |
| 260705-wvk popravi-pretragu-po-datumu-u-kolekciji-n | 2026-07-05 | Added a 5th "day+month" (Dan i mjesec / Day & month) date filter mode to the Collection tab, so users can find every find from the same day+month across all years (e.g. every May 20th) — useful for revisiting the same spot/species in season. Backend: `date_day_month` field on `FindSearchFilters` + `substr(date_found, 6) = ?` SQL match in the shared `push_find_search_filters` (covers get_finds/get_collection_folders/load_finds_for_species). Frontend: `DatePartsInput` gained a day-month-only (no year) variant; existing exact/range/month/year modes unaffected. |
| 260509-0fm hide-map-clutter-during-zone-edit | 2026-05-09 | focusFinds computed in FindsMap: local edit → single pin, region edit → species pins; hiddenZoneIds hides all zones during editing; CollectionPins always renders with focusFinds. |
| 260509-0me collection-pin-labels-zoom-threshold | 2026-05-09 | LABEL_ZOOM_THRESHOLD=13; labels hidden below zoom 13; proximity post-pass in collectionsFromFinds assigns labelText/suppressLabel; mixed-species location shows "N species" on primary pin; 3 new tests. |
| 260509-0qx observed-count-range-stats | 2026-05-09 | observed_min/max/avg added to SpeciesStatSummary (Rust+TS); per-species sub-query aggregates COALESCE(obs_min,obs_count)/midpoint AVG; SpeciesStatRow shows "3–10 (avg 5.8)" when data present; 3 Rust tests pass. |
| 260509-0sc historical-weekly-monthly-comparison | 2026-05-09 | "This Time in Past Years" section in Stats tab; historicalComparison.ts (getISOWeek + buildHistoricalComparison); HistoricalComparison.tsx two-column grid; reuses calendar data; 10 Vitest tests pass. |
| 260509-1u6 implement-edibility-and-protected-status | 2026-05-09 | Migration 0013 + Rust/TS model extension; speciesMetadata.ts enums + normalizers; SpeciesMetadataBadges component; FolderEditDialog selects + CollectionTab upsert wiring; ImportDialog prefill; badges in folder header, inline find row, CollectionPopup, PhotoLightbox. Status: Needs Review (runtime verification pending). |
| 260509-bt0 audit-and-fix-consistency-between-import | 2026-05-09 | Separated find-level notes (sharedFindNotes) from species notes (sharedFolderNotes) in ImportDialog; added edibility+protected-status selects to CreateFindDialog matching ImportDialog/FolderEditDialog; deleted dead FindPreviewCard code and tests; fixed 10 stale ImportDialog tests. |
| 260512-stats-map-improvements | 2026-05-12 | Stats: Seasonal Insights moved below Top Spots/Best Months; historical "this time in past years" shows all species per year bucket (no truncation); Top Spots + Best Months rows clickable — inline expand shows species found at that location/month. Map: fit-to-pins button (LocateFixed icon, bottom-right); flies to Croatia overview if no pins. |
| 260512-windows-compat | 2026-05-12 | Input fields: bg-white hardcode replaced with bg-input CSS variable. Default theme changed to dark for fresh installs. Collection pin iconSize [0,0]→[200,50] fixes invisible pins on Win WebView2. LocationPickerMap pin icon + status span: oklch() → hex (#D4941A / #A67010). SpeciesNameEditor: overflow-x-hidden + whitespace-nowrap prevents field height expansion on long names. |
| 260512-species-editor-ux | 2026-05-12 | SpeciesNameEditor: label prop renders inside toolbar row (eliminates wasted label row); B/N button pair always visible; Slack-style active state tracks cursor position + selection (resets on blur); button handlers read DOM state fresh (no stale React state); double-click word → instant format toggle; Ctrl+B/Ctrl+I shortcuts. Map pin labels: rawToLabelHtml renders genus at weight 800 and epithet at weight 400 for clear visual split. |
| 260512-import-create-dialog-ux | 2026-05-12 | ImportDialog: status badges (edibility/threat/distribution) shown only when species is new (not in finds or profiles); saved to species profile on import. Label moved inside SpeciesNameEditor toolbar. MapPin button inline with species field in ImportDialog + CreateFindDialog. CreateFindDialog: location card removed, MapPin inline with species; speciesFilter passed to LocationPickerMap (known species → own pins only, new → all pins). FolderEditDialog: edibility note textarea always visible. Migrations 0014 (find edibility_note), 0015 (species_profile edibility_note), 0016 (species_profile threat/distribution). |
| 260512-1yg settings-dialog-tabbed-ux-v0125 | 2026-05-12 | SettingsDialog redesigned from single tall scroll to compact 3-tab layout (Općenito/Mapa/Napredno); 12 new i18n keys; version bumped to 0.1.25 across package.json + tauri.conf.json + Cargo.toml; tagged v0.1.25. |
| 260512-photo-safety-update-hardening | 2026-05-12 | Photo safety pass after missing-photo concern: per-photo and bulk per-photo deletes now expose a visible permanent-delete checkbox (default on) with Recycle Bin fallback when unchecked; Settings cleanup is confirmed and described as missing DB-reference cleanup only; zone toolbar/editor default positions reset compactly away from Leaflet zoom controls. |
| 260512-m5v fix-map-pins-not-showing-on-windows-webv | 2026-05-12 | collectionIcon iconAnchor [0,0]→[6,6]; removed translate(-50%,-50%) from .bili-pin-dot — dot now inside container bounds, no WebView2 clipping; label left:0→6px; prevLocationIcon className ''→'bili-picker-prev-icon' prevents white Leaflet div-icon background. |
| 260512-r5n uat-fix-pass-nach-zadnjeg-builda | 2026-05-12 | 12 UAT fixes: stats bold rendering + section order + null-date crash + observed min–max; map viewport persistence to last find; lightbox notes contrast + no-photo find opens edit; species tab: remove add-tag, reorder sections, fix scroll lock; import overflow; edibility translations jestiva/nejestiva. |
| 260512-rt7 fix-species-folder-star-markers | 2026-05-12 | plain_species_name() strips *italic* markers before folder path building in build_dest_path + bulk_rename_species; missing source files handled gracefully (DB path updated regardless); added test. |
| 260512-find-row-open-lightbox-or-edit | 2026-05-12 | CollectionTab: find row click always opens lightbox (first photo) or EditFindDialog (no photos); chevron converted to standalone expand button with stopPropagation. SpeciesTab: find row click opens lightbox or EditFindDialog for no-photo finds; EditFindDialog imported + wired; PhotoLightbox onEditFind handler connected. |
| 260512-map-topo-notes-editor-fixes | 2026-05-12 | LayerSwitcher: replaced OpenTopoMap with ESRI World Topo (elevation contours, more reliable). SpeciesNameEditor: flex→block + overflow-x:auto + scrollbar hidden so long names scroll without escaping bounds. PhotoLightbox: inline notes add/edit with textarea + save/cancel; always shows notes section with Dodaj/Uredi button. |
| 260512-species-synonyms-other-names | 2026-05-12 | Migration 0018 adds synonyms+other_names TEXT columns to species_profiles. Rust SpeciesProfile extended + upsert/get updated. TS type + upsertSpeciesProfile + hook extended. FolderEditDialog: tag-chip add/remove UI for both fields. CollectionTab: passes synonyms/other_names through onSave + displays in folder header. SpeciesTab: inline add/remove chips for both fields with per-field handlers. i18n: 8 keys (hr+en). Rust roundtrip test + lib.rs user_version bumped to 18. |
| 260706-b7f collection-alphabetical-default | 2026-07-06 | CollectionTab: speciesSortMode default changed from 'recent' to 'alpha' — Zbirka now opens alphabetically sorted by default; Recent/Alphabetical toggle unchanged and fully functional. Test updated to match new default. |
| 260706-k2m collection-toolbar-filters-popover | 2026-07-06 | New src/components/ui/popover.tsx (radix Popover wrapper). CollectionTab toolbar: location search + date filter group collapsed into a "Filters" popover trigger with active-state dot indicator; New find/Import pinned as ml-auto trailing group; flex-wrap safety net added — fixes Import photos button being clipped off-screen. i18n: filtersButton/filtersActive (hr+en). Tests updated to open popover before asserting on date filter controls. |
| 260706-p4x collection-calendar-date-picker | 2026-07-06 | New src/components/ui/calendar.tsx: Calendar (day-grid, prev/next month, showYear=false locks to fixed leap-year 2024 ref for day+month-any-year mode) + MonthYearPicker (12-month grid, prev/next year). CollectionTab: removed DatePartsInput digit-typing component; exact/range/month/dayMonth filter modes now open these calendar pickers via Popover triggers instead of typing dd/mm/yyyy. i18n: pickDate/pickMonth/pickDayMonth (hr+en). Tests rewritten for calendar interaction. |

### Roadmap Evolution

- Phase 02.1 inserted after Phase 2: Import workflow refinements (URGENT)

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-05-12T00:00:00.000Z
Stopped at: Fixed map pins invisible on Windows WebView2 — iconAnchor/CSS overflow fix in CollectionPins; prevLocationIcon className fix
Resume file: None
