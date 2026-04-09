# Phase 3: Map - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can see all their finds on an interactive Leaflet map, switch between OSM and satellite layers, have previously-viewed tiles cached on disk for offline use, and pick a map location when manually entering or editing a find.

Phase 3 owns: MapTab (replaces EmptyState), find pins + cluster badges, two-level popup, layer switcher, Rust tile proxy (fetch + cache), offline status badge, location picker modal, Settings cache controls.

Phase 3 does NOT own: species DB lookup (Phase 4), wishlist map overlay (Phase 5), pre-downloading a region before going offline (v2/MAP-V2-01), AI identification (v2).

</domain>

<decisions>
## Implementation Decisions

### Pin Popup Content (MAP-01, MAP-04)
- **D-01:** Two-level popup.
  - Level 1 (default): species name + date found. Lightweight, clean for dense pin areas.
  - Level 2 (on name click): expands to full mini card — thumbnail, name, date, and an **Edit button** that opens `EditFindDialog` in CollectionTab.
- **D-02:** Multiple finds at the same lat/lng → **cluster pin with count badge** (e.g. "3"). Clicking the cluster shows a scrollable list of all finds at that spot (each row: name + date). Each row in the list is also clickable to expand to the Level 2 mini card.

### Location Picker UX (MAP-06)
- **D-03:** **Modal map picker.** `EditFindDialog` gets a "Pick on map" button. Clicking it opens a full-screen modal containing the map. User taps any spot to place a draggable pin; a "Confirm location" button closes the modal and writes `lat`/`lng` back into the edit form.
- **D-04:** When the picker opens for a find that already has coordinates, the map centers on the existing pin and the pin is shown as moveable — user can drag it or click elsewhere to relocate.

### Satellite Tile Source (MAP-02)
- **D-05:** **Esri World Imagery** for the satellite/aerial layer. Free, no API key required, excellent global coverage including Croatia. Standard Leaflet tile URL.
- **D-06:** Two layers only — OSM street view (default) + Esri satellite. No terrain/topo layer in v1. Layer switcher is the standard Leaflet `L.control.layers` widget.

### Offline Tile Cache (MAP-03)
- **D-07:** **Auto-cache as user browses.** Every tile fetched through the Rust proxy is written to disk automatically. No user action required — previously viewed areas simply load from cache when offline.
- **D-08:** **Online/offline status badge** visible on the map (small, unobtrusive). Shows whether the app is fetching live tiles or serving from cache.
- **D-09:** Settings panel shows: current tile cache size (MB) + a **"Clear tile cache"** button.
- **D-10:** Default max cache size: **200 MB**, user-configurable in Settings. When the limit is reached, **LRU eviction** removes the least-recently-accessed tiles until under the limit.
- **D-11:** Tile cache stored at `<StorageRoot>/tile-cache/`. Keeps all user data portable in one folder alongside the database.

### Rust Tile Proxy (MAP-03 — architecture, locked from Phase 1)
- **D-12:** Tile fetching MUST go through a Rust Tauri command (HTTP fetch + disk write). Do NOT use browser IndexedDB or service workers for caching — Tauri WebView2 limitations make these unreliable. (Phase 1 decision.)

### Claude's Discretion
- Exact visual design of the cluster badge, popup dimensions, and mini card layout — match the existing shadcn/ui card style from CollectionTab.
- LRU eviction implementation details (SQLite metadata table vs. filesystem timestamps) — pick the lighter approach.
- Map default center coordinates (Croatia region) and zoom level for the initial view — use approximately `[45.1, 15.2]`, zoom 7.
- How to pass the `storagePath` to the tile proxy Rust command — read from Zustand store and pass as a parameter.
- Exact Leaflet cluster library choice (Leaflet.markercluster or manual grouping) — choose what integrates cleanly with react-leaflet v5.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §MAP-01 through MAP-06 — all map requirements this phase delivers
- `.planning/PROJECT.md` §Constraints — local-only, Windows primary, no internet requirement for core features

### Prior Phase Decisions
- `.planning/phases/01-foundation/01-CONTEXT.md` §D-08 (Rust tile proxy, no IndexedDB) — locked architectural constraint
- `.planning/phases/02-import-organization/02-CONTEXT.md` §Location Input — map picker was deferred here; EditFindDialog is the trigger point

### Technology Stack (from CLAUDE.md)
- Leaflet 1.9.x + react-leaflet 5.0.x — map engine and React bindings
- leaflet.offline 3.2.x — tile caching (evaluate against custom Rust proxy approach)
- Esri World Imagery tile URL: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/tabs/MapTab.tsx` — EmptyState placeholder; Phase 3 replaces its entire content
- `src/hooks/useFinds.ts` + `src/lib/finds.ts` — already fetches finds from SQLite including `lat`, `lng`, `country`, `region`, `species_name`, `date_found`, `photo_path`
- `src/stores/appStore.ts` → `storagePath` — tile cache path is `storagePath + /tile-cache/`
- `src/components/finds/EditFindDialog.tsx` (Phase 2) — needs a "Pick on map" button added to trigger the location picker modal
- `src/components/ui/` — shadcn/ui Card, Button, Badge, Dialog components; reuse for popup and picker modal

### Established Patterns
- Heavy I/O lives in Rust Tauri commands; React calls via `invoke()` — tile proxy follows same pattern
- `useFinds` TanStack Query hook with `invalidateQueries` after mutations — map should reactively update when finds change
- Zustand `useAppStore` for cross-tab state (storagePath, activeTab)

### Integration Points
- MapTab reads finds via `useFinds()` — no new data fetching plumbing needed for pins
- EditFindDialog (CollectionTab) ← picker modal bridge: needs a callback prop (`onLocationPicked`) or a Zustand pending-pick state
- Rust `lib.rs` `invoke_handler` — tile proxy command registered here alongside existing commands
- Settings panel (Phase 1 SettingsDialog) — cache size display and clear button added here

### Not Yet Installed
- `react-leaflet`, `leaflet`, `@types/leaflet` — must be added to `package.json` before implementation
- Leaflet CSS must be imported globally (e.g., `import 'leaflet/dist/leaflet.css'` in `main.tsx`)
- `reqwest` or `tauri-plugin-http` — needed in `src-tauri/Cargo.toml` for tile HTTP fetching in Rust

</code_context>

<specifics>
## Specific Ideas

- The cluster badge should feel like a mushroom journal, not a generic map app — consider using the existing accent color from shadcn/ui theme for badge background
- The location picker modal's "Confirm location" button should also show the reverse-geocoded address if available (nice-to-have; Claude's discretion whether to include in v1 given no external API requirement)
- Online/offline badge should be subtle — a small colored dot (green = online, grey = cached) in the bottom-left corner of the map, not a banner

</specifics>

<deferred>
## Deferred Ideas

- Pre-download a region for full offline use before going into the field (v2 — MAP-V2-01 in REQUIREMENTS.md)
- Terrain/topographic layer (OpenTopoMap) — noted as v2 option
- Reverse geocoding on location picker (no external API allowed in v1)
- Map clustering animation/spiderfy (v2 polish)

</deferred>

---

*Phase: 03-map*
*Context gathered: 2026-04-09*
