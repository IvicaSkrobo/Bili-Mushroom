# Bili Mushroom

## What This Is

A Windows desktop app for mushroom foragers to catalogue, organize, and explore their finds. Users import photos and info about mushrooms they've collected, and the app organizes everything by location and date, displays finds on an interactive map, and provides a rich knowledge base with species descriptions, edibility warnings, and personal notes. Built with Tauri + React + Rust — distributable to other foragers.

## Core Value

A forager's personal mushroom journal — every find stored, organized, searchable, and mapped so that nothing collected is ever forgotten.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Import & Organization**
- [ ] User can import photos from any folder on their PC
- [ ] App reads date from EXIF metadata if available, falls back to filename parsing
- [ ] App reads GPS coordinates from EXIF if available, falls back to manual location entry
- [ ] App organizes files into Location → Date folder structure (e.g. `Croatia/Gorski Kotar/2024-05-10/`)
- [ ] User can choose which folder all organized mushroom data lives in
- [ ] User can re-import from same folder without duplicating entries

**Map**
- [ ] Interactive map showing all find locations as pins
- [ ] Map defaults to Croatia/region view, auto-zooms out when finds outside region are added
- [ ] User can switch between OpenStreetMap and satellite/terrain view
- [ ] Clicking a pin shows mushroom(s) found at that location
- [ ] User can pick a location on the map when manually entering a find

**Species & Descriptions**
- [ ] Each mushroom entry has a description (auto-populated from built-in species database)
- [ ] User can edit all fields: name, description, notes, location, date, edibility
- [ ] Built-in species database covers common Croatian/European mushrooms with edibility/danger info
- [ ] Edibility/danger warning displayed prominently per species (edible, toxic, deadly, unknown)

**Search & Browse**
- [ ] Search collected mushrooms by name, location, date range
- [ ] Filter/search by location (show all finds in a given area)
- [ ] Wishlist — user can add mushrooms they want to find but haven't yet
- [ ] Browse wishlist and mark items as found when collected

**Stats & Insights**
- [ ] Foraging stats dashboard: total finds, most found species, best spots, top months
- [ ] Seasonal calendar — shows which mushrooms are typically found in which months
- [ ] Per-species stats: how many times found, locations, first find date

**Export**
- [ ] Export collection or selected mushrooms to PDF report

**Future (Phase 2+)**
- [ ] AI image recognition — identify mushroom species from photo

### Out of Scope

- Cloud sync / multi-device — fully local app; cloud adds complexity and infrastructure cost
- Multi-user shared collections — single-user per installation; sharing happens by distributing the app
- Real-time weather data — too complex for v1, can add later
- Mobile app — Windows desktop is primary target

## Context

- Primary user is a Croatian forager (user is building this for themselves and others in Croatia/region)
- Mushrooms found primarily in Croatia (Gorski Kotar, Istria, Slavonia region common)
- App must be distributable — packaged as a Windows installer (.msi or .exe)
- Stack already decided: Tauri 2.x + React + Rust (reflected in existing .gitignore)
- Map focus: Croatia and surrounding Balkans region, but mushrooms can come from anywhere
- Photos likely from smartphone (EXIF GPS common), but manual entry must be supported
- All data is local — no backend, no API keys required for core features
- OpenStreetMap (Leaflet.js) is the natural map choice: free, offline-capable with tile caching, excellent for Croatia terrain

## Constraints

- **Platform**: Windows primary (Win 10/11) — Tauri supports Mac/Linux but not the focus
- **Storage**: 100% local — no internet requirement for core features (map tiles may need initial download)
- **Distribution**: Packaged installer — must run without installing Node/Rust on end user machine
- **Tech Stack**: Tauri 2.x + React 18+ + Rust (already committed)
- **Species Database**: Bundled with app — no external API for species lookup in v1

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tauri + React + Rust | Cross-platform desktop with web UI; good performance; Rust handles file I/O safely | — Pending |
| Location → Date folder structure | Most natural for foragers who think in places first, then visits | — Pending |
| Fully local storage | Privacy, no infrastructure cost, works offline in the field | — Pending |
| OpenStreetMap + Leaflet | Free, no API key, good tile coverage for Croatia, supports satellite layer via provider switch | — Pending |
| SQLite for metadata | Lightweight, embedded, well-supported in Rust (rusqlite/sqlx), no server needed | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-09 after initialization*
