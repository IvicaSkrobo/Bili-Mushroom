# Requirements: Bili Mushroom

**Defined:** 2026-04-09
**Core Value:** A forager's personal mushroom journal — every find stored, organized, searchable, and mapped so that nothing collected is ever forgotten.

## v1 Requirements

### Import

- [x] **IMP-01**: User can import all photos from a chosen folder at once (batch import)
- [x] **IMP-02**: User can add a single photo at a time via file picker
- [x] **IMP-03**: App auto-reads date from photo EXIF metadata; falls back to filename parsing, then manual entry
- [x] **IMP-04**: App auto-reads GPS coordinates from photo EXIF metadata if available; falls back to manual location picker on map
- [x] **IMP-05**: App shows preview of detected metadata before confirming import

### Organization

- [x] **ORG-01**: App copies and organizes imported files into Location → Date folder structure (e.g., `Croatia/Gorski Kotar/2024-05-10/`)
- [ ] **ORG-02**: User can choose and change the root storage folder where all organized mushroom data lives
- [x] **ORG-03**: App renames photos on import using mushroom name + date pattern
- [x] **ORG-04**: User can edit the location, date, and name of any find after import

### Map

- [ ] **MAP-01**: All finds displayed as clickable pins on an interactive map
- [ ] **MAP-02**: User can switch between OpenStreetMap street view and satellite/terrain view
- [ ] **MAP-03**: Map tiles are cached on disk for offline use (within previously viewed/downloaded areas)
- [ ] **MAP-04**: Clicking a pin shows the mushroom(s) found at that location
- [ ] **MAP-05**: Map defaults to Croatia/Balkans region view; auto-zooms to fit all pins when finds outside region exist
- [ ] **MAP-06**: User can pick a location on the map when manually entering or editing a find's location

### Species Database

- [ ] **SPE-01**: Built-in database of ~150 Croatian/European mushroom species with descriptions, habitat notes, and season info
- [ ] **SPE-02**: Each species shows edibility/danger rating prominently (Edible / Edible with caution / Toxic / Deadly / Unknown)
- [ ] **SPE-03**: Each species with a dangerous lookalike shows a prominent lookalike warning with the lookalike name and distinguishing features
- [ ] **SPE-04**: Species shown with Croatian common name, Latin name, and English name
- [ ] **SPE-05**: Every find detail is editable: species name, notes, location, date, personal description, photos
- [ ] **SPE-06**: Safety disclaimer displayed prominently adjacent to all edibility data ("Never consume based solely on this app")

### Search & Browse

- [ ] **SCH-01**: User can search their collection by species name (Croatian, Latin, or English)
- [ ] **SCH-02**: User can filter finds by location (show all finds in a selected area)
- [ ] **SCH-03**: User can filter finds by date range

### Wishlist

- [ ] **WSH-01**: User can add a species to a wishlist ("want to find")
- [ ] **WSH-02**: User can mark a wishlist species as found when collected; it moves to the collection
- [ ] **WSH-03**: Wishlist species are shown on the map indicating regions where they typically grow in Croatia

### Stats & Insights

- [ ] **STA-01**: Stats dashboard showing total finds, unique species count, and total locations visited
- [ ] **STA-02**: Dashboard shows top spots (most finds by location) and best months (most finds by month)
- [ ] **STA-03**: Seasonal calendar view showing which species are typically found in each month
- [ ] **STA-04**: Per-species stats: total find count, all locations found, date of first find

### Export

- [ ] **EXP-01**: User can export their collection (or a filtered subset) to a PDF report with photos
- [ ] **EXP-02**: User can export their collection (or a filtered subset) to Excel/CSV

## v2 Requirements

### AI Identification

- **AI-01**: App can analyze a photo and suggest which mushroom species it is
- **AI-02**: AI suggestion includes confidence level and top alternatives

### Offline Maps

- **MAP-V2-01**: User can pre-download map tiles for a selected region for full offline use

### Community

- **COM-01**: User can export a shareable collection profile (anonymized, no GPS coordinates)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cloud sync / multi-device | Adds infrastructure cost and complexity; local-first is a trust feature for foragers |
| Multi-user shared collections | Single-user per installation; sharing done by distributing the app |
| Real-time weather data | External API dependency; adds complexity without core value for v1 |
| Mobile app (iOS/Android) | Windows desktop is primary target; Tauri supports other platforms but not the focus |
| Full-text search through notes | Nice-to-have but FTS5 index can be added later without schema changes |

## Traceability

*(Updated 2026-04-08 during roadmap creation)*

| Requirement | Phase | Status |
|-------------|-------|--------|
| ORG-02 | Phase 1 - Foundation | Pending |
| IMP-01 | Phase 2 - Import & Organization | Complete |
| IMP-02 | Phase 2 - Import & Organization | Complete |
| IMP-03 | Phase 2 - Import & Organization | Complete |
| IMP-04 | Phase 2 - Import & Organization | Complete |
| IMP-05 | Phase 2 - Import & Organization | Complete |
| ORG-01 | Phase 2 - Import & Organization | Complete |
| ORG-03 | Phase 2 - Import & Organization | Complete |
| ORG-04 | Phase 2 - Import & Organization | Complete |
| MAP-01 | Phase 3 - Map | Pending |
| MAP-02 | Phase 3 - Map | Pending |
| MAP-03 | Phase 3 - Map | Pending |
| MAP-04 | Phase 3 - Map | Pending |
| MAP-05 | Phase 3 - Map | Pending |
| MAP-06 | Phase 3 - Map | Pending |
| SPE-01 | Phase 4 - Species Database | Pending |
| SPE-02 | Phase 4 - Species Database | Pending |
| SPE-03 | Phase 4 - Species Database | Pending |
| SPE-04 | Phase 4 - Species Database | Pending |
| SPE-05 | Phase 4 - Species Database | Pending |
| SPE-06 | Phase 4 - Species Database | Pending |
| SCH-01 | Phase 5 - Search, Browse & Wishlist | Pending |
| SCH-02 | Phase 5 - Search, Browse & Wishlist | Pending |
| SCH-03 | Phase 5 - Search, Browse & Wishlist | Pending |
| WSH-01 | Phase 5 - Search, Browse & Wishlist | Pending |
| WSH-02 | Phase 5 - Search, Browse & Wishlist | Pending |
| WSH-03 | Phase 5 - Search, Browse & Wishlist | Pending |
| STA-01 | Phase 6 - Stats & Export | Pending |
| STA-02 | Phase 6 - Stats & Export | Pending |
| STA-03 | Phase 6 - Stats & Export | Pending |
| STA-04 | Phase 6 - Stats & Export | Pending |
| EXP-01 | Phase 6 - Stats & Export | Pending |
| EXP-02 | Phase 6 - Stats & Export | Pending |
