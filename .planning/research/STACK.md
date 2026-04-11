# Technology Stack

**Project:** Bili Mushroom — local-first desktop mushroom foraging catalogue
**Platform:** Windows primary (Win 10/11), distributable installer
**Researched:** 2026-04-08

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tauri | 2.10.x | Desktop shell, OS integration | Latest stable (2.10.3, Mar 2025). 10-20x smaller than Electron. Rust backend: safe file I/O, EXIF, SQLite. No Node.js on user machine. |
| React | 18.x | UI rendering | Already committed. Concurrent features align with Tauri 2 async IPC. |
| TypeScript | 5.x | Type safety across frontend | Required. Data-heavy app with complex domain types (species, finds, coordinates). |
| Vite | 5.x | Frontend build tooling | Default Tauri 2 scaffolding. Fast HMR. No reason to deviate. |

### SQLite / Database

**Recommendation: `tauri-plugin-sql` with the `sqlite` feature, plus `libsqlite3-sys` with `bundled` feature to fix Windows build.**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| tauri-plugin-sql | 2.x | JS ↔ SQLite bridge via Tauri IPC | Official plugin. Exposes `execute()` and `select()` to React frontend. Handles migrations at startup. Uses sqlx under the hood. |
| libsqlite3-sys | latest | SQLite native binding | Add with `features = ["bundled"]` to statically link SQLite into Windows binary. Without this, Windows builds fail: "sqlite3.lib not found". |
| sqlx | 0.8.x | Rust-side SQL (used internally by plugin) | Used indirectly via plugin. For direct Rust-side queries in Tauri commands, sqlx with compile-time checked queries is right. |

**Why not rusqlite directly?**
rusqlite requires writing own Tauri command layer and JS bindings. `tauri-plugin-sql` does this already. Use rusqlite only for features plugin doesn't expose (custom SQLite extensions, WAL tuning). `tauri-plugin-rusqlite2` is community fork with transaction support — not official, avoid until official plugin catches up.

**Windows bundling fix — add to `src-tauri/Cargo.toml`:**
```toml
[dependencies]
libsqlite3-sys = { version = ">=0.17.2", features = ["bundled"] }
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
```

**Known limitation:** Plugin forces DB path into `AppConfig` dir. Can't load pre-seeded read-only species DB from bundled resource via plugin (tracked: plugins-workspace issue #1155). Workaround: ship species data as Rust-embedded JSON/SQL seed, run as migration on first launch to populate SQLite DB in `AppConfig`.

**Confidence: HIGH** — Official plugin, official docs, Windows fix confirmed from community.

### State Management

**Recommendation: Zustand 5 for client/UI state + TanStack Query v5 for all data fetching from SQLite.**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Zustand | 5.0.x | Global UI state (active species, filter state, selected find, map viewport, active tab) | Minimal boilerplate, no Provider wrappers, excellent TypeScript inference in v5. 5.0.12 latest, actively maintained. |
| TanStack Query | 5.x | All async data — Tauri IPC calls to SQLite | Caching, background refetch, loading/error states. Every SQLite read is async IPC invoke — TQ handles like API calls. Avoids manual `useEffect` + `useState` per query. |

**Why not Redux Toolkit?**
RTK suits large teams needing strict patterns and time-travel debugging. Single-developer desktop app: 3x boilerplate, no gain.

**Pattern:** "Server" state (SQLite reads = async Tauri invoke) → TanStack Query. UI state (open panels, selection, filters) → Zustand. 2025 community consensus for React apps this scale.

**Confidence: HIGH** — Multiple sources, actively maintained, v5 of both stable.

### Map Library

**Recommendation: React Leaflet 5 + leaflet.offline + OpenStreetMap tiles.**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Leaflet | 1.9.x | Core map engine | Battle-tested, 148KB JS, no API key, OSM out of the box. Croatia has excellent OSM coverage. |
| react-leaflet | 5.0.x | React bindings for Leaflet | Latest stable (v5.0.0). Declarative component model fits React. |
| leaflet.offline | 3.2.x | Offline tile caching via IndexedDB | Stores tiles in IndexedDB, Tauri supports natively on Windows. Users pre-cache region tiles. |

**Why not MapLibre GL JS?**
MapLibre GL: WebGL + vector tiles, 800KB, advanced 3D/dynamic rendering. For pin display + basic OSM tiles on Croatian terrain, Leaflet: faster setup, lighter, Croatia use case needs no vector tile rotation or 3D. Use MapLibre if vector styling or offline vector tile bundles (`.mbtiles`) needed later.

**Offline tile strategy in Tauri:**
Service Workers unreliable in Tauri's WebView. IndexedDB works. `leaflet.offline` uses IndexedDB — correct approach. Users trigger "Download region" to pre-fetch tiles for bounding box at zoom levels.

**Alternative for fully offline tiles:** Bundle Croatia `.mbtiles` + serve via local Rust HTTP server (`tauri-plugin-shell` or lightweight Actix endpoint). Heavier but zero internet after install. Flag for future phase.

**Confidence: MEDIUM** — Leaflet + react-leaflet versions confirmed, offline IndexedDB approach confirmed. MapLibre comparison from multiple articles. Tauri/ServiceWorker limitation inferred from architecture (no SW in WebView2) — verify in implementation phase.

### EXIF Parsing

**Recommendation: `kamadak-exif` (crate name: `exif`) in Rust.**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| kamadak-exif | 0.6.1 | Read GPS lat/lon, DateTimeOriginal from smartphone JPEGs | Pure Rust, no C deps, actively maintained. Supports JPEG, HEIF, PNG, WebP. Exposes `GPSLatitude`, `GPSLatitudeRef`, `GPSLongitude`, `GPSLongitudeRef`, `DateTimeOriginal` directly. |

**Why not rexif?**
rexif: less maintained, JPEG/TIFF only. kamadak-exif handles HEIF (iPhone photos) and WebP — matters for smartphone source photos. GPS rational decoding (degrees/minutes/seconds as fractions) well-documented in kamadak-exif.

**GPS extraction pattern (Rust):**
```rust
let exif = Reader::new().read_from_container(&mut file)?;
let lat_field = exif.get_field(Tag::GPSLatitude, In::PRIMARY);
let lat_ref = exif.get_field(Tag::GPSLatitudeRef, In::PRIMARY);
// Convert rational triplet + ref to decimal degrees in Tauri command
```

**Confidence: HIGH** — crates.io confirmed, docs.rs confirmed, 0.6.1 is latest.

### File Watching

**Recommendation: `notify` crate (via `tauri-plugin-fs` watch feature, or directly).**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| tauri-plugin-fs | 2.x (watch feature) | File system access + folder watching from frontend | `watch` feature wraps `notify`, exposes via IPC events. Avoids separate `notify` dependency. |
| notify | 6.x | Underlying cross-platform FS watcher | Used indirectly by `tauri-plugin-fs`. Add directly for lower-level Rust control (recursive watch + debounce). Uses OS-native APIs (ReadDirectoryChangesW on Windows). |

**Setup in Cargo.toml:**
```toml
tauri-plugin-fs = { version = "2", features = ["watch"] }
```

**Confidence: HIGH** — Official plugin docs confirm `watch` feature. notify crate is standard tool used by alacritty, deno, rust-analyzer, cargo-watch.

### PDF Export

**Recommendation: `@react-pdf/renderer` on the frontend, rendered in a Web Worker, saved via `tauri-plugin-fs`.**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @react-pdf/renderer | 3.x | Generate PDF from React components | Pure JS, no native deps, 860K weekly downloads, actively maintained. Renders to Blob in-browser. JSX layout for reports. |
| Comlink | 4.x | Web Worker bridge | Offloads PDF generation from main thread. Without this, complex reports (many photos + maps) freeze UI. Proven pattern documented for Tauri + react-pdf. |

**Why not printpdf (Rust)?**
printpdf: low-level PDF constructor. Manual layout of every element, embedded images as bytes, manual font handling. For photo+map+species reports, `@react-pdf/renderer` far better authoring experience.

**Why not wkhtmltopdf / headless Chromium?**
wkhtmltopdf: bundles external binary, +~30MB, added deployment surface. Headless Chromium: not officially supported from Tauri's WebView. `@react-pdf/renderer` runs fully inside existing WebView, no extra binary.

**Workflow:**
1. User clicks "Export PDF"
2. Web Worker receives find data + selected species
3. `@react-pdf/renderer` generates PDF blob in worker
4. Main thread receives blob URL
5. `tauri-plugin-fs` writes blob to user's chosen path

**Confidence: MEDIUM** — Pattern confirmed in March 2025 Medium article (Tauri + react-pdf + Web Workers). Official @react-pdf/renderer docs confirm Web Worker support.

### UI Component Library

**Recommendation: shadcn/ui (Radix UI primitives + Tailwind CSS v4).**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| shadcn/ui | current (CLI-managed) | Accessible, desktop-appropriate UI components | Components copy-pasted into repo — you own and customize freely. Built on Radix UI accessibility primitives (keyboard nav, ARIA). Tailwind v4 compatible as of March 2025. |
| Tailwind CSS | 4.x | Utility styling | shadcn/ui v4 components use Tailwind v4. Vite plugin makes integration straightforward. |
| Radix UI | (bundled via shadcn) | Accessible primitives | Use through shadcn/ui, not raw. Dialog, DropdownMenu, Tooltip, Select, etc. correctly wired to ARIA. |

**Why not Mantine?**
Mantine excellent for SaaS dashboards but opinionated bundled library. In Tauri app with custom design vision, shadcn/ui code-ownership model better — can't get stuck on Mantine release blocking customization.

**Why not raw Radix UI?**
Radix primitives unstyled by design. Would need all styling from scratch. shadcn/ui is Radix + Tailwind already done correctly.

**Desktop-specific note:** shadcn/ui's default aesthetics (neutral, slightly dense, minimal borders) suit desktop better than Mantine's SaaS-optimized look.

**Confidence: HIGH** — Multiple sources, official docs, Tailwind v4 compatibility confirmed March 2025.

### Species Database

**Recommendation: Hand-curated SQLite seed file bundled with the app.**

No ready-made "European mushroom species SQLite" drop-in exists. Available open datasets:

| Source | Format | Coverage | Usability |
|--------|--------|----------|-----------|
| iNaturalist Open Data | CSV (taxa table, monthly snapshots on AWS) | Global, all species | Good taxonomy/naming, no edibility data, very large (filter to Fungi kingdom) |
| FunDiS Biodiversity Database | iNaturalist project, no offline dump | North America focus | Not useful for Croatia |
| MycoBank | Web database | Global taxonomy | No edibility data, no offline export |
| FGVCx Fungi Dataset | Image JSON + taxonomy | ~1,500 species | No edibility, no descriptions |
| Wikipedia / Wikidata | API or dumps | European species well covered | Edibility sometimes in infoboxes, requires extraction |

**Recommended approach:**
1. Use iNaturalist's taxa CSV for canonical species list: common European fungi (filter `iconic_taxon_name = 'Fungi'`, high Europe observation counts).
2. Supplement with manually written edibility/danger/description data for 100-200 species most relevant to Croatian foraging (Boletus, Cantharellus, Amanita family, Marasmius, etc.).
3. Ship as SQL migration file seeding `species` table on first launch.

Content task (data curation), not library selection. No existing library solves "Croatian foraging species with edibility warnings" out of the box.

**Confidence: MEDIUM** — iNaturalist open data format confirmed. Absence of ready-made European mushroom SQLite confirmed by exhaustive search. Manual curation assessment HIGH confidence.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| SQLite plugin | tauri-plugin-sql | tauri-plugin-rusqlite2 | Community fork, not official, not needed |
| SQLite plugin | tauri-plugin-sql | Direct sqlx commands | More boilerplate, requires own JS bindings; plugin handles this |
| State management | Zustand + TanStack Query | Redux Toolkit | 3x boilerplate, wrong fit for single-developer desktop app |
| Map | react-leaflet | MapLibre GL JS | 800KB vs 148KB; WebGL overhead; Croatia use case needs no vector tiles or 3D |
| Map tiles | leaflet.offline (IndexedDB) | Bundled .mbtiles + local server | Valid for fully-offline install; heavier; revisit Phase 2 if needed |
| EXIF | kamadak-exif | rexif | JPEG/TIFF only, less active, no HEIF |
| PDF | @react-pdf/renderer | printpdf (Rust) | Low-level; manual layout of photos and formatted text impractical |
| PDF | @react-pdf/renderer | wkhtmltopdf | Requires bundling 30MB extra binary; deployment complexity |
| UI | shadcn/ui | Mantine | Opinionated SaaS library; shadcn/ui code ownership fits custom desktop design |
| Watch | tauri-plugin-fs (watch) | notify crate directly | Plugin wraps notify and exposes to frontend IPC — less code |

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
| react-leaflet v5 + leaflet.offline | MEDIUM | Versions confirmed; Tauri WebView/ServiceWorker limitation inferred from architecture — verify Phase 1 |
| kamadak-exif 0.6.1 | HIGH | crates.io + docs.rs confirmed |
| tauri-plugin-fs watch feature | HIGH | Official docs confirmed |
| @react-pdf/renderer + Comlink | MEDIUM | Pattern confirmed in March 2025 Tauri-specific article |
| shadcn/ui + Tailwind v4 | HIGH | Official docs confirmed March 2025 |
| Species database (manual curation) | MEDIUM | No ready-made source; approach sound |

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