# Technology Stack

**Project:** Bili Mushroom — local-first desktop mushroom foraging catalogue
**Platform:** Windows primary (Win 10/11), distributable installer
**Researched:** 2026-04-08

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tauri | 2.10.x | Desktop shell, OS integration | Latest stable (2.10.3, Mar 2025). 10-20x smaller than Electron. Rust backend gives safe file I/O, EXIF parsing, and SQLite without Node.js on end user's machine. |
| React | 18.x | UI rendering | Already committed. Concurrent features align with Tauri 2's async IPC model. |
| TypeScript | 5.x | Type safety across frontend | Non-negotiable for a data-heavy app with complex domain types (species, finds, coordinates). |
| Vite | 5.x | Frontend build tooling | Default Tauri 2 scaffolding uses Vite. Fast HMR. No reason to deviate. |

### SQLite / Database

**Recommendation: `tauri-plugin-sql` with the `sqlite` feature, plus `libsqlite3-sys` with `bundled` feature to fix Windows build.**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| tauri-plugin-sql | 2.x | JS ↔ SQLite bridge via Tauri IPC | Official plugin. Exposes `execute()` and `select()` to the React frontend. Handles migrations at startup. Uses sqlx under the hood. |
| libsqlite3-sys | latest | SQLite native binding | Add with `features = ["bundled"]` to statically link SQLite into the Windows binary. Without this, builds on Windows fail with "sqlite3.lib not found". |
| sqlx | 0.8.x | Rust-side SQL (used internally by plugin) | Used indirectly through the plugin. If you need direct Rust-side queries (e.g. in Tauri commands), sqlx with compile-time checked queries is the right tool. |

**Why not rusqlite directly?**
rusqlite is excellent but requires writing your own Tauri command layer and JS bindings from scratch. The `tauri-plugin-sql` does this for you. Use rusqlite only if you need features the plugin doesn't expose (e.g., custom SQLite extensions, WAL mode tuning). `tauri-plugin-rusqlite2` is a community fork with transaction support but is not an official plugin — avoid until the official plugin catches up.

**Windows bundling fix — add to `src-tauri/Cargo.toml`:**
```toml
[dependencies]
libsqlite3-sys = { version = ">=0.17.2", features = ["bundled"] }
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
```

**Known limitation:** The plugin currently forces the database path into `AppConfig` directory. You cannot load a pre-seeded read-only species database from a bundled resource via the plugin (tracked in plugins-workspace issue #1155). Workaround: ship the species data as a Rust-embedded JSON/SQL seed, run it as a migration on first launch to populate the SQLite DB in `AppConfig`.

**Confidence: HIGH** — Official plugin, official docs, confirmed Windows fix from community discussion.

### State Management

**Recommendation: Zustand 5 for client/UI state + TanStack Query v5 for all data fetching from SQLite.**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Zustand | 5.0.x | Global UI state (active species, filter state, selected find, map viewport, active tab) | Minimal boilerplate, no Provider wrappers, TypeScript inference is excellent in v5. 5.0.12 is the latest (actively maintained). |
| TanStack Query | 5.x | All async data — Tauri IPC calls to SQLite | Caching, background refetch, loading/error states. In Tauri, every SQLite read is an async IPC invoke — TQ handles this exactly like API calls. Avoids manual useEffect + useState patterns for every list/detail query. |

**Why not Redux Toolkit?**
RTK is correct for large teams needing strict patterns and time-travel debugging. For a single-developer desktop app with no server state, it is 3x the boilerplate for no gain.

**Pattern:** "Server" state (anything read from SQLite = async Tauri invoke) → TanStack Query. UI state (what panel is open, what's selected, filter values) → Zustand. This is the 2025 community consensus for React apps of this scale.

**Confidence: HIGH** — Multiple independent sources, actively maintained, v5 of both libraries stable.

### Map Library

**Recommendation: React Leaflet 5 + leaflet.offline + OpenStreetMap tiles.**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Leaflet | 1.9.x | Core map engine | Battle-tested, 148KB JS, no API key, OSM works out of the box. Croatia has excellent OSM coverage. |
| react-leaflet | 5.0.x | React bindings for Leaflet | Latest stable (v5.0.0). Declarative component model fits React patterns. |
| leaflet.offline | 3.2.x | Offline tile caching via IndexedDB | Stores downloaded tiles in IndexedDB, which Tauri supports natively on Windows. Users can pre-cache their region tiles. |

**Why not MapLibre GL JS?**
MapLibre GL uses WebGL and vector tiles, is 800KB, and is designed for advanced 3D/dynamic map rendering. For pin display + basic OpenStreetMap tiles showing Croatian terrain, Leaflet is faster to set up, lighter on resources, and the Croatia-focused use case does not need vector tile rotation or 3D extrusion. MapLibre is the right tool if you later need vector styling or offline vector tile bundles (e.g. `.mbtiles`).

**Offline tile strategy in Tauri:**
Service Workers do not work reliably in Tauri's WebView. IndexedDB does work. `leaflet.offline` uses IndexedDB for tile storage, making it the correct approach. Users initiate a "Download region" action that pre-fetches tiles for a bounding box at specified zoom levels.

**Alternative for fully offline tiles:** Bundle a Croatia `.mbtiles` file and serve tiles via a local Rust HTTP server (`tauri-plugin-shell` or a lightweight Actix endpoint). This is heavier but means zero internet dependency after install. Flag for future phase if needed.

**Confidence: MEDIUM** — Leaflet + react-leaflet version confirmed, offline IndexedDB approach confirmed. MapLibre comparison sourced from multiple articles. Tauri/ServiceWorker limitation inferred from Tauri architecture (no SW support in WebView2) — flag for verification in implementation phase.

### EXIF Parsing

**Recommendation: `kamadak-exif` (crate name: `exif`) in Rust.**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| kamadak-exif | 0.6.1 | Read GPS lat/lon, DateTimeOriginal from smartphone JPEGs | Pure Rust, no C dependencies, actively maintained. Supports JPEG, HEIF, PNG, WebP. Exposes `GPSLatitude`, `GPSLatitudeRef`, `GPSLongitude`, `GPSLongitudeRef`, `DateTimeOriginal` tags directly. |

**Why not rexif?**
rexif is less actively maintained and JPEG/TIFF only. kamadak-exif handles HEIF (iPhone photos) and WebP as well, which matters given smartphone source photos. The GPS rational number decoding (degrees/minutes/seconds as fractions) is well-documented in kamadak-exif.

**GPS extraction pattern (Rust):**
```rust
let exif = Reader::new().read_from_container(&mut file)?;
let lat_field = exif.get_field(Tag::GPSLatitude, In::PRIMARY);
let lat_ref = exif.get_field(Tag::GPSLatitudeRef, In::PRIMARY);
// Convert rational triplet + ref to decimal degrees in Tauri command
```

**Confidence: HIGH** — crates.io confirmed, docs.rs confirmed, version 0.6.1 is latest.

### File Watching

**Recommendation: `notify` crate (via `tauri-plugin-fs` watch feature, or directly).**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| tauri-plugin-fs | 2.x (watch feature) | File system access + folder watching from frontend | The `watch` feature of the official FS plugin wraps `notify` and exposes it via IPC events. Avoids adding `notify` as a separate dependency. |
| notify | 6.x | Underlying cross-platform FS watcher | Used indirectly by `tauri-plugin-fs`. If you need lower-level control in Rust commands (e.g. recursive watch + debounce), add directly. Uses OS-native APIs (ReadDirectoryChangesW on Windows). |

**Setup in Cargo.toml:**
```toml
tauri-plugin-fs = { version = "2", features = ["watch"] }
```

**Confidence: HIGH** — Official plugin docs confirm `watch` feature, notify crate is the standard tool used by alacritty, deno, rust-analyzer, cargo-watch.

### PDF Export

**Recommendation: `@react-pdf/renderer` on the frontend, rendered in a Web Worker, saved via `tauri-plugin-fs`.**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @react-pdf/renderer | 3.x | Generate PDF from React components | Pure JavaScript, no native dependencies, 860K weekly downloads, actively maintained. Renders to a Blob in-browser. The React component model lets you design the report layout as JSX. |
| Comlink | 4.x | Web Worker bridge | Offloads PDF generation from the main thread. Without this, complex reports (many photos + maps) will freeze the UI. Proven pattern documented specifically for Tauri + react-pdf. |

**Why not printpdf (Rust)?**
printpdf gives you a low-level PDF constructor. You would need to manually lay out every element, embed images as bytes, handle fonts. For a report with photos, maps, species info, and formatting, `@react-pdf/renderer` provides a dramatically better authoring experience at the cost of bundle size.

**Why not wkhtmltopdf / headless Chromium?**
wkhtmltopdf requires bundling an external binary in the installer — adds ~30MB and a deployment surface. Headless Chromium is not officially supported from Tauri's WebView. `@react-pdf/renderer` runs fully inside the existing WebView with no extra binary.

**Workflow:**
1. User clicks "Export PDF"
2. Web Worker receives find data + selected species
3. `@react-pdf/renderer` generates PDF blob in worker
4. Main thread receives blob URL
5. `tauri-plugin-fs` writes the blob to the user's chosen path

**Confidence: MEDIUM** — Pattern confirmed in a March 2025 Medium article specifically about Tauri + react-pdf + Web Workers. Official @react-pdf/renderer docs confirm Web Worker support.

### UI Component Library

**Recommendation: shadcn/ui (Radix UI primitives + Tailwind CSS v4).**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| shadcn/ui | current (CLI-managed) | Accessible, desktop-appropriate UI components | Components are copy-pasted into the repo — you own the code and customize freely. Built on Radix UI accessibility primitives (keyboard nav, ARIA). Tailwind v4 compatible as of March 2025. |
| Tailwind CSS | 4.x | Utility styling | shadcn/ui v4 components use Tailwind v4. Vite plugin makes integration straightforward. |
| Radix UI | (bundled via shadcn) | Accessible primitives | Do not use raw Radix directly — use it through shadcn/ui. You get Dialog, DropdownMenu, Tooltip, Select, etc. correctly wired to ARIA. |

**Why not Mantine?**
Mantine is excellent for SaaS dashboards but packages 490K+ downloads/week as an opinionated bundled library. In a Tauri app with a custom design vision, shadcn/ui's code-ownership model is more appropriate — you cannot get "stuck" on a Mantine release blocking your customization.

**Why not raw Radix UI?**
Radix primitives are unstyled by design. You would need to write all styling from scratch. shadcn/ui is Radix + Tailwind already done correctly.

**Desktop-specific note:** shadcn/ui's default aesthetics (neutral, slightly dense, minimal borders) suit desktop application contexts better than Mantine's SaaS-optimized look.

**Confidence: HIGH** — Multiple sources, official docs, Tailwind v4 compatibility confirmed as of March 2025.

### Species Database

**Recommendation: Hand-curated SQLite seed file bundled with the app.**

There is no ready-made "European mushroom species SQLite" drop-in. Available open datasets:

| Source | Format | Coverage | Usability |
|--------|--------|----------|-----------|
| iNaturalist Open Data | CSV (taxa table, monthly snapshots on AWS) | Global, all species | Good taxonomy/naming, no edibility data, very large (filter to Fungi kingdom) |
| FunDiS Biodiversity Database | iNaturalist project, no offline dump | North America focus | Not useful for Croatia |
| MycoBank | Web database | Global taxonomy | No edibility data, no offline export |
| FGVCx Fungi Dataset | Image JSON + taxonomy | ~1,500 species | No edibility, no descriptions |
| Wikipedia / Wikidata | API or dumps | European species well covered | Edibility sometimes present in infoboxes, requires extraction |

**Recommended approach:**
1. Use iNaturalist's taxa CSV to get a canonical species list for common European fungi (filter by `iconic_taxon_name = 'Fungi'`, high observation counts in Europe).
2. Supplement with manually written edibility/danger/description data for the 100-200 species most relevant to Croatian foraging (Boletus, Cantharellus, Amanita family, Marasmius, etc.).
3. Ship as a SQL migration file that seeds the `species` table on first launch.

This is a content task (data curation), not a library selection task. No existing library solves the "Croatian foraging species with edibility warnings" requirement out of the box.

**Confidence: MEDIUM** — iNaturalist open data format confirmed. Absence of a ready-made European mushroom SQLite confirmed by exhaustive search. Manual curation assessment is HIGH confidence.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| SQLite plugin | tauri-plugin-sql | tauri-plugin-rusqlite2 | Community fork, not official, not needed for this app's requirements |
| SQLite plugin | tauri-plugin-sql | Direct sqlx commands | More boilerplate, need to write your own JS bindings; plugin handles this |
| State management | Zustand + TanStack Query | Redux Toolkit | 3x boilerplate, wrong fit for single-developer desktop app |
| Map | react-leaflet | MapLibre GL JS | 800KB vs 148KB; WebGL overhead; Croatia use case doesn't need vector tiles or 3D |
| Map tiles | leaflet.offline (IndexedDB) | Bundled .mbtiles + local server | Valid for fully-offline install; heavier; revisit in Phase 2 if needed |
| EXIF | kamadak-exif | rexif | rexif is JPEG/TIFF only, less active maintenance, no HEIF support |
| PDF | @react-pdf/renderer | printpdf (Rust) | Low-level; manual layout of photos and formatted text is impractical |
| PDF | @react-pdf/renderer | wkhtmltopdf | Requires bundling 30MB extra binary; deployment complexity |
| UI | shadcn/ui | Mantine | Mantine is opinionated SaaS library; shadcn/ui code ownership fits custom desktop design better |
| Watch | tauri-plugin-fs (watch) | notify crate directly | Plugin wraps notify and exposes it to frontend IPC — less code |

---

## Installation Reference

```bash
# Frontend packages
npm install zustand @tanstack/react-query
npm install leaflet react-leaflet leaflet.offline
npm install @react-pdf/renderer comlink
npm install @tauri-apps/plugin-sql @tauri-apps/plugin-fs
# shadcn/ui (uses CLI, not npm install)
npx shadcn@latest init
npx shadcn@latest add button dialog input select tooltip dropdown-menu

# Tauri plugins (Cargo.toml additions)
# tauri-plugin-sql = { version = "2", features = ["sqlite"] }
# tauri-plugin-fs = { version = "2", features = ["watch"] }
# libsqlite3-sys = { version = ">=0.17.2", features = ["bundled"] }
# kamadak-exif = "0.6"
```

---

## Confidence Summary

| Area | Confidence | Notes |
|------|------------|-------|
| Tauri 2.x version (2.10.3) | HIGH | Confirmed from GitHub releases |
| tauri-plugin-sql + Windows bundled fix | HIGH | Official docs + confirmed community fix |
| Zustand v5 + TanStack Query v5 | HIGH | Both actively maintained, versions confirmed |
| react-leaflet v5 + leaflet.offline | MEDIUM | Versions confirmed; Tauri WebView/ServiceWorker limitation inferred from architecture — verify in Phase 1 |
| kamadak-exif 0.6.1 | HIGH | crates.io + docs.rs confirmed |
| tauri-plugin-fs watch feature | HIGH | Official docs confirmed |
| @react-pdf/renderer + Comlink | MEDIUM | Pattern confirmed in March 2025 Tauri-specific article |
| shadcn/ui + Tailwind v4 | HIGH | Official docs confirmed March 2025 |
| Species database (manual curation) | MEDIUM | No ready-made source found; approach is sound |

---

## Sources

- [Tauri SQL Plugin — official docs](https://v2.tauri.app/plugin/sql/)
- [Tauri File System Plugin — official docs](https://v2.tauri.app/plugin/file-system/)
- [Tauri GitHub Releases](https://github.com/tauri-apps/tauri/releases)
- [Windows sqlite3.lib build error + bundled fix](https://github.com/tauri-apps/tauri/discussions/6183)
- [tauri-plugin-sql bundled resource limitation (issue #1155)](https://github.com/tauri-apps/plugins-workspace/issues/1155)
- [kamadak-exif on crates.io](https://crates.io/crates/kamadak-exif)
- [kamadak-exif docs.rs (latest 0.6.1)](https://docs.rs/crate/kamadak-exif/latest)
- [notify crate — GitHub](https://github.com/notify-rs/notify)
- [Generating PDFs in Tauri with React-PDF and Web Workers (March 2025)](https://medium.com/codex/generating-pdfs-in-a-tauri-app-using-react-pdf-and-web-workers-0419999f14cf)
- [shadcn/ui Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4)
- [MapLibre GL JS vs Leaflet comparison](https://blog.jawg.io/maplibre-gl-vs-leaflet-choosing-the-right-tool-for-your-interactive-map/)
- [leaflet.offline on npm](https://www.npmjs.com/package/leaflet.offline)
- [Zustand v5 release notes](https://github.com/pmndrs/zustand/releases)
- [TanStack Query v5 announcement](https://tanstack.com/blog/announcing-tanstack-query-v5)
- [iNaturalist Open Data on GitHub](https://github.com/inaturalist/inaturalist-open-data)
- [React UI libs 2025 comparison](https://makersden.io/blog/react-ui-libs-2025-comparing-shadcn-radix-mantine-mui-chakra)
- [Bare-Metal Offline Tauri + IndexedDB (Medium)](https://medium.com/@connect.hashblock/bare-metal-offline-architecting-a-blazing-fast-desktop-app-with-tauri-and-indexeddb-a932e6a58fb3)
