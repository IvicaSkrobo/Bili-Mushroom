# Roadmap: Bili Mushroom

## Overview

Bili Mushroom is built in four phases, each delivering a coherent and verifiable capability. Phase 1 establishes the technical foundation — Tauri 2 app shell, SQLite with WAL mode, and migration runner — before any feature code touches the database. Phases 2 and 3 deliver the two core pillars: getting finds into the app (import + file organization) and seeing them on a map. Phase 4 delivers the stats dashboard and export so foragers can understand their patterns and share their collection. Species database, search, wishlist, and browse features are in the backlog pending client demand.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Tauri 2 app shell, SQLite with WAL + migration runner, storage folder selection scaffold
- [ ] **Phase 2: Import & Organization** - Photo import, EXIF parsing, metadata preview, file organization into Location/Date folders
- [ ] **Phase 3: Map** - Interactive Leaflet map, Rust tile proxy, offline tile cache, pins, location picker
- [ ] **Phase 4: Stats & Export** - Stats dashboard, per-species stats, PDF and CSV export

## Phase Details

### Phase 1: Foundation
**Goal**: The app runs, stores data reliably, and is ready for feature code
**Depends on**: Nothing (first phase)
**Requirements**: ORG-02
**Success Criteria** (what must be TRUE):
  1. The app launches on Windows as a packaged Tauri 2 window without error
  2. A SQLite database file is created in the user-chosen storage folder on first run with WAL mode enabled
  3. User can choose and change the root storage folder, and the app persists that choice across restarts
  4. Running the app after a schema change applies pending migrations automatically without data loss
**Plans**: 3 plans
Plans:
- [x] 01-01-PLAN.md — Scaffold Tauri 2 + React + TS + shadcn/ui + Vitest test infrastructure
- [x] 01-02-PLAN.md — Rust plugins, SQLite WAL migration runner, storage persistence, real Zustand store
- [x] 01-03-PLAN.md — UI shell (first-run dialog, tabs, migration error, settings) + 13-step smoke gate
**UI hint**: yes

### Phase 2: Import & Organization
**Goal**: Users can get their mushroom photos into the app with metadata correctly detected and files organized on disk
**Depends on**: Phase 1
**Requirements**: IMP-01, IMP-02, IMP-03, IMP-04, IMP-05, ORG-01, ORG-03, ORG-04
**Success Criteria** (what must be TRUE):
  1. User can import an entire folder of photos at once, and each photo appears as a separate find entry
  2. User can add a single photo via file picker and it appears as a new find entry
  3. When a photo has EXIF GPS data, the location is auto-populated; when it has EXIF date, the date is auto-populated; when neither is present, the user is prompted to enter them manually
  4. Before confirming import, user sees a preview of the detected metadata (name, date, location) and can correct it
  5. Imported files are copied and renamed into `<StorageRoot>/<Country>/<Region>/<YYYY-MM-DD>/` and re-importing the same photo does not create a duplicate entry
**Plans**: 3 plans
Plans:
- [x] 02-01-PLAN.md — Rust backend: EXIF parsing, import_find + get_finds commands, finds migration, capabilities
- [x] 02-02-PLAN.md — React import UI: ImportDialog, FindPreviewCard, useImportProgress hook, finds.ts wrappers
- [ ] 02-03-PLAN.md — CollectionTab rebuild: FindCard, EditFindDialog, useFinds TanStack hook, update_find command
**UI hint**: yes

### Phase 02.1: Import workflow refinements (INSERTED)

**Goal:** Multi-photo finds, map-based location picking during import, bulk metadata, post-import review dialog, and delete find with optional disk delete
**Requirements**: IMP-01, IMP-02, IMP-04, IMP-05, ORG-04
**Depends on:** Phase 2
**Plans:** 5/5 plans complete

Plans:
- [x] TBD (run /gsd-plan-phase 02.1 to break down) (completed 2026-04-09)

### Phase 3: Map
**Goal**: Users can see all their finds on an interactive map and pick locations manually
**Depends on**: Phase 2
**Requirements**: MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-06
**Success Criteria** (what must be TRUE):
  1. Every find with a location appears as a clickable pin on the map; clicking a pin shows the mushroom(s) found there
  2. User can switch between OpenStreetMap street view and a satellite/terrain layer without losing pin state
  3. Map tiles viewed during a session are cached on disk; previously viewed areas remain visible when the internet is disconnected
  4. Map opens centered on Croatia/Balkans region by default, and auto-zooms to fit all pins when finds outside that region exist
  5. User can tap a spot on the map to set or update the location of a find when entering or editing manually
**Plans**: TBD
**UI hint**: yes

### Phase 4: Stats & Export
**Goal**: Users can understand their foraging patterns at a glance and share or archive their collection
**Depends on**: Phase 3
**Requirements**: STA-01, STA-02, STA-03, STA-04, EXP-01, EXP-02
**Success Criteria** (what must be TRUE):
  1. Stats dashboard shows total finds, unique species count, total locations visited, top spots by find count, and best months by find count
  2. Seasonal calendar view shows which species are typically found in each calendar month
  3. Per-species stats page shows total find count, all locations where a species was found, and date of first find
  4. User can export their full collection (or a filtered subset) to a PDF report that includes photos
  5. User can export their full collection (or a filtered subset) to Excel/CSV format
**Plans**: 3 plans
Plans:
- [x] 04-01-PLAN.md — Rust stat aggregation commands, TS types/IPC wrappers, TanStack Query hooks, test mocks + tests
- [x] 04-02-PLAN.md — StatsTab UI: stat cards, ranked lists, seasonal calendar, per-species stats
- [ ] 04-03-PLAN.md — PDF and CSV export with Comlink Web Worker, export action bar in StatsTab
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2026-04-09 |
| 2. Import & Organization | 3/3 | Complete | 2026-04-09 |
| 02.1. Import Workflow Refinements | 5/5 | Complete | 2026-04-09 |
| 3. Map | 4/4 | Complete | 2026-04-15 |
| 4. Stats & Export | 0/3 | Not started | - |

## Backlog

### Phase 999.1: Species Database (BACKLOG)

**Goal:** Every find can be linked to a rich species entry with edibility, lookalike warnings, and trilingual names
**Deferred at:** 2026-04-15 — client hasn't requested; removing SpeciesTab from nav until needed
**Requirements**: SPE-01, SPE-02, SPE-03, SPE-04, SPE-05, SPE-06
**Success Criteria** (when promoted):
  1. The built-in database contains at least 150 Croatian/European species, each with Croatian, Latin, and English name
  2. Every species entry shows its edibility/danger rating (Edible / Edible with caution / Toxic / Deadly / Unknown) prominently
  3. Species that have dangerous lookalikes display a prominent warning card naming the lookalike and the distinguishing features
  4. A safety disclaimer ("Never consume based solely on this app") is visible adjacent to all edibility data

### Phase 999.2: Search, Browse & Wishlist (BACKLOG)

**Goal:** Users can find any past find quickly and track species they want to collect
**Deferred at:** 2026-04-15 — client hasn't requested; BrowseTab removed from nav until needed
**Requirements**: SCH-01, SCH-02, SCH-03, WSH-01, WSH-02, WSH-03
**Success Criteria** (when promoted):
  1. User can search their collection by species name (Croatian, Latin, or English) and results appear as the user types
  2. User can filter finds by geographic area and by date range, combining filters freely
  3. User can add any species to a wishlist and see all wishlist species in a dedicated view
  4. When user marks a wishlist species as found and imports a photo, it moves from the wishlist to the collection
  5. Wishlist species appear on the map as overlay markers showing the regions of Croatia where they typically grow
