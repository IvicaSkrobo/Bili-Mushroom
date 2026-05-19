# Roadmap: Gljivobook

## Overview

Gljivobook is built in phases, each delivering a coherent and verifiable capability. Phase 1 establishes the technical foundation - Tauri 2 app shell, SQLite with WAL mode, and migration runner - before any feature code touches the database. Phases 2 and 3 deliver the two core pillars: getting finds into the app (import + file organization) and seeing them on a map. Phase 4 delivers the stats dashboard and export so foragers can understand their patterns and share their collection. Phase 5 extends the product beyond the desktop app with a public website, automated releases/downloads, a working in-app updater, community feedback, feature voting, and support/donation flows. Species database, search, wishlist, and browse features remain in the backlog pending client demand.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Tauri 2 app shell, SQLite with WAL + migration runner, storage folder selection scaffold
- [ ] **Phase 2: Import & Organization** - Photo import, EXIF parsing, metadata preview, file organization into Location/Date folders
- [ ] **Phase 3: Map** - Interactive Leaflet map, Rust tile proxy, offline tile cache, pins, location picker
- [ ] **Phase 4: Stats & Export** - Stats dashboard, per-species stats, PDF and CSV export
- [ ] **Phase 04.1: UX Governance & Performance Hardening (INSERTED)** - Design system governance, bundle/code-splitting, E2E critical path coverage
- [ ] **Phase 04.2: Seasonal Insights & Field Hints (INSERTED)** - Seasonality insights and lightweight "go-to-spot" species reminders
- [ ] **Phase 05: Website, Releases, Community & Support (INSERTED)** - GitHub Pages website, real release/updater pipeline, support/donate entry points, GitHub Discussions/Giscus community, voted feature ideas, and funding-goal board

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
- [x] 01-01-PLAN.md â€” Scaffold Tauri 2 + React + TS + shadcn/ui + Vitest test infrastructure
- [x] 01-02-PLAN.md â€” Rust plugins, SQLite WAL migration runner, storage persistence, real Zustand store
- [x] 01-03-PLAN.md â€” UI shell (first-run dialog, tabs, migration error, settings) + 13-step smoke gate
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
- [x] 02-01-PLAN.md â€” Rust backend: EXIF parsing, import_find + get_finds commands, finds migration, capabilities
- [x] 02-02-PLAN.md â€” React import UI: ImportDialog, FindPreviewCard, useImportProgress hook, finds.ts wrappers
- [ ] 02-03-PLAN.md â€” CollectionTab rebuild: FindCard, EditFindDialog, useFinds TanStack hook, update_find command
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
- [x] 04-01-PLAN.md â€” Rust stat aggregation commands, TS types/IPC wrappers, TanStack Query hooks, test mocks + tests
- [x] 04-02-PLAN.md â€” StatsTab UI: stat cards, ranked lists, seasonal calendar, per-species stats
- [x] 04-03-PLAN.md â€” PDF and CSV export with Comlink Web Worker, export action bar in StatsTab
Post-phase UI work:
- [x] 260416-ui-identity-refresh â€” New visual identity pass (fonts/tokens/shell/stats polish) recorded in quick task log
**UI hint**: yes

### Phase 04.1: UX Governance & Performance Hardening (INSERTED)

**Goal:** Stabilize the new visual identity and improve runtime confidence before net-new UX features
**Depends on:** Phase 4
**Requirements**: UX-01, ENG-01, ENG-02
**Success Criteria** (what must be TRUE):
  1. A design-token/component governance doc exists and is referenced by future UI changes
  2. Startup and tab-switching performance improves via code-splitting/lazy-loading of heavy surfaces
  3. Updates and maintenance tools preserve user photo files; manual photo deletion remains explicit, visible, and user-controlled
  4. End-to-end tests cover first-run, import, and edit/deleteâ†’stats update critical paths
**Plans**: 4 plans
Plans:
- [x] 04.1-01-PLAN.md â€” Design token + component variant governance (completed 2026-04-16)
- [x] 04.1-02-PLAN.md â€” Bundle/perf hardening (lazy tab loading + chunk reduction) (completed 2026-04-16)
- [x] 04.1-03-PLAN.md â€” Critical-path test coverage for startup + insights flow (completed 2026-04-16)
- [x] 260512-photo-safety-update-hardening â€” Manual per-photo deletes expose permanent-delete checkbox; missing-photo cleanup is confirmed and DB-reference-only
**UI hint**: yes

### Phase 04.2: Seasonal Insights & Field Hints (INSERTED)

**Goal:** Turn stats from passive reporting into actionable field guidance
**Depends on:** Phase 04.1
**Requirements**: INS-01, INS-02
**Success Criteria** (what must be TRUE):
  1. Stats include seasonality insight cards (e.g., species activity by month and "coming into season")
  2. App shows lightweight reminders recommending likely spots for selected species based on historical finds
  3. Reminder suggestions are explainable (species + month/spot rationale shown to the user)
**Plans**: 2 plans
Plans:
- [x] 04.2-01-PLAN.md â€” Seasonal insight models + stats UI blocks (completed 2026-04-16)
- [x] 04.2-02-PLAN.md â€” "Go to this spot for species X" hint/reminder system (completed 2026-04-16)
**UI hint**: yes

### Phase 05: Website, Releases, Community & Support (INSERTED)

**Goal:** Give Gljivobook a public home that stays in sync with releases, gives users a clear download path, lets users discuss releases and vote on feature ideas, and connects in-app support/donation flows to a real support page.
**Depends on:** Phase 04.2
**Requirements**: WEB-01, WEB-02, REL-01, REL-02, COM-01, COM-02, SUP-01
**Architecture decision:** Keep the website in this repository under `/website` for now. Split it into a separate website/hub repo only when there is a second real application or when the site needs independent deployment ownership.

**Success Criteria** (what must be TRUE):
  1. GitHub Pages hosts a bilingual Gljivobook website with English default (`/`) and Croatian (`/hr`) routes.
  2. Website has Home, Download, Changelog, Support, Community, and Ideas/Funding pages in both languages.
  3. Download and changelog sections read from GitHub Releases so new tagged releases update the website without manual copy/paste.
  4. GitHub Actions builds Windows release artifacts, uploads installer/updater assets, publishes `latest.json`, and triggers the website rebuild.
  5. The in-app updater can detect and install a real GitHub-hosted update from a signed release artifact.
  6. The app has a subtle Settings/About support button that opens the website support/donate page in the user's browser.
  7. GitHub Discussions is enabled with categories for Announcements, Questions, Ideas, Bugs, and Showcase; Giscus embeds discussion/comment threads on release or changelog pages.
  8. Users can submit feature ideas, vote via GitHub Discussion reactions, and see popular ideas sorted by votes on the website.
  9. High-vote ideas can be promoted to Funding Goals with status, vote count, manual funding progress, and a support button.
  10. The first implementation requires no custom backend and no paid service.

**Plans**: 6 plans
Plans:
- [ ] 05-01-PLAN.md - Website foundation: `/website`, bilingual routing, Forest Codex visual direction, screenshot slots, Home/Download/Support/Changelog shell
- [ ] 05-02-PLAN.md - Release automation: GitHub Actions release workflow, version sync checks, installer/updater artifact upload, `latest.json` validation
- [ ] 05-03-PLAN.md - Real in-app updater and support link: stable support URL config, browser-open command/plugin, manual/background update states, changelog link from update UI
- [ ] 05-04-PLAN.md - Community layer: GitHub Discussions setup, Giscus configuration, release/changelog comments, bug/question/idea entry links
- [ ] 05-05-PLAN.md - Ideas and voting board: GitHub Discussion idea template, reaction vote import, popular/planned/released status model, website Ideas page
- [ ] 05-06-PLAN.md - Funding goals: manual funding JSON, funding progress bars, donation provider URL wiring, promote popular ideas into "Funding" cards
**UI hint**: yes

**Design Direction:**
- Use the existing Forest Codex identity: warm paper/light mode, nocturne dark mode, amber/green accents, Cormorant Garamond for display headings, Manrope for UI copy.
- Website should feel like a product home and field journal, not generic software landing-page styling.
- Prioritize accessibility: keyboard navigation, visible focus, 4.5:1 contrast for body text, real text labels on CTAs, responsive layout without horizontal scroll.
- Screenshots should show actual app surfaces: collection, species detail, map, stats, PDF/export if available.

**Community/Voting Notes:**
- Giscus is free and uses GitHub Discussions as storage.
- Voting is initially GitHub reactions on Ideas discussions, with thumbs-up treated as a vote.
- Funding progress is manual in v1 to avoid payment-provider complexity; later it can connect to Ko-fi, GitHub Sponsors, OpenCollective, or PayPal if an API is useful.

**Open Decisions Before Implementation:**
- Support/donation provider and final URL.
- Whether website domain starts as GitHub Pages URL or custom domain.
- Whether screenshots should be captured from local demo data or provided manually from real usage.
- Whether release notes are authored directly in GitHub Releases or generated from `CHANGELOG.md`.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 â†’ 2 â†’ 3 â†’ 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2026-04-09 |
| 2. Import & Organization | 3/3 | Complete | 2026-04-09 |
| 02.1. Import Workflow Refinements | 5/5 | Complete | 2026-04-09 |
| 3. Map | 4/4 | Complete | 2026-04-15 |
| 4. Stats & Export | 3/3 | Complete | 2026-04-16 |
| 04.1 UX Governance & Performance Hardening | 3/3 | Complete | 2026-04-16 |
| 04.2 Seasonal Insights & Field Hints | 2/2 | Complete | 2026-04-16 |
| 05 Website, Releases, Community & Support | 0/6 | Planned | - |

## Backlog

### Phase 999.0: Windows Code Signing via SignPath Foundation (BACKLOG)

**Goal:** Sign the Windows installer and executable with a trusted Authenticode certificate so SmartScreen no longer prompts on install and Windows Defender does not throttle the app's network connections (auto-updater)
**Deferred at:** 2026-05-12 â€” updater times out due to Defender blocking unsigned native HTTPS; signing is the proper fix
**Requirements**: None
**Success Criteria** (when promoted):
  1. Installer runs without SmartScreen "Unknown publisher" prompt on a clean Windows machine
  2. Auto-updater check completes within 5 seconds on the same machine where it previously timed out
  3. Certificate chain shows a trusted publisher in Windows security dialogs
**Notes**:
  - Apply at signpath.org (free for open source projects â€” no personal ID required, they verify builds from the public GitHub repo)
  - Key technical constraint: Authenticode signing must happen INSIDE `tauri build` via `bundle.windows.signCommand` so minisign (Tauri updater signature) is computed on the already-signed installer
  - After approval: add `SIGNPATH_API_TOKEN` secret to GitHub repo, update workflow to use `signpath/github-action-submit-signing-request@v2`, configure `signCommand` in tauri.conf.json

### Phase 999.1: Species Database (BACKLOG)

**Goal:** Every find can be linked to a rich species entry with edibility, lookalike warnings, and trilingual names
**Deferred at:** 2026-04-15 â€” client hasn't requested; removing SpeciesTab from nav until needed
**Requirements**: SPE-01, SPE-02, SPE-03, SPE-04, SPE-05, SPE-06
**Success Criteria** (when promoted):
  1. The built-in database contains at least 150 Croatian/European species, each with Croatian, Latin, and English name
  2. Every species entry shows its edibility/danger rating (Edible / Edible with caution / Toxic / Deadly / Unknown) prominently
  3. Species that have dangerous lookalikes display a prominent warning card naming the lookalike and the distinguishing features
  4. A safety disclaimer ("Never consume based solely on this app") is visible adjacent to all edibility data

### Phase 999.2: Search, Browse & Wishlist (BACKLOG)

**Goal:** Users can find any past find quickly and track species they want to collect
**Deferred at:** 2026-04-15 â€” client hasn't requested; BrowseTab removed from nav until needed
**Requirements**: SCH-01, SCH-02, SCH-03, WSH-01, WSH-02, WSH-03
**Success Criteria** (when promoted):
  1. User can search their collection by species name (Croatian, Latin, or English) and results appear as the user types
  2. User can filter finds by geographic area and by date range, combining filters freely
  3. User can add any species to a wishlist and see all wishlist species in a dedicated view
  4. When user marks a wishlist species as found and imports a photo, it moves from the wishlist to the collection
  5. Wishlist species appear on the map as overlay markers showing the regions of Croatia where they typically grow
