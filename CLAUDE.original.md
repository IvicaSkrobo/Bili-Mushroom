<!-- GSD:project-start source:PROJECT.md -->
## Project

**Bili Mushroom**

A Windows desktop app for mushroom foragers to catalogue, organize, and explore their finds. Users import photos and info about mushrooms they've collected, and the app organizes everything by location and date, displays finds on an interactive map, and provides a rich knowledge base with species descriptions, edibility warnings, and personal notes. Built with Tauri + React + Rust — distributable to other foragers.

**Core Value:** A forager's personal mushroom journal — every find stored, organized, searchable, and mapped so that nothing collected is ever forgotten.

### Constraints

- **Platform**: Windows primary (Win 10/11) — Tauri supports Mac/Linux but not the focus
- **Storage**: 100% local — no internet requirement for core features (map tiles may need initial download)
- **Distribution**: Packaged installer — must run without installing Node/Rust on end user machine
- **Tech Stack**: Tauri 2.x + React 18+ + Rust (already committed)
- **Species Database**: Bundled with app — no external API for species lookup in v1
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tauri | 2.10.x | Desktop shell, OS integration | Latest stable (2.10.3, Mar 2025). 10-20x smaller than Electron. Rust backend gives safe file I/O, EXIF parsing, and SQLite without Node.js on end user's machine. |
| React | 18.x | UI rendering | Already committed. Concurrent features align with Tauri 2's async IPC model. |
| TypeScript | 5.x | Type safety across frontend | Non-negotiable for a data-heavy app with complex domain types (species, finds, coordinates). |
| Vite | 5.x | Frontend build tooling | Default Tauri 2 scaffolding uses Vite. Fast HMR. No reason to deviate. |
### SQLite / Database
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| tauri-plugin-sql | 2.x | JS ↔ SQLite bridge via Tauri IPC | Official plugin. Exposes `execute()` and `select()` to the React frontend. Handles migrations at startup. Uses sqlx under the hood. |
| libsqlite3-sys | latest | SQLite native binding | Add with `features = ["bundled"]` to statically link SQLite into the Windows binary. Without this, builds on Windows fail with "sqlite3.lib not found". |
| sqlx | 0.8.x | Rust-side SQL (used internally by plugin) | Used indirectly through the plugin. If you need direct Rust-side queries (e.g. in Tauri commands), sqlx with compile-time checked queries is the right tool. |
### State Management
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Zustand | 5.0.x | Global UI state (active species, filter state, selected find, map viewport, active tab) | Minimal boilerplate, no Provider wrappers, TypeScript inference is excellent in v5. 5.0.12 is the latest (actively maintained). |
| TanStack Query | 5.x | All async data — Tauri IPC calls to SQLite | Caching, background refetch, loading/error states. In Tauri, every SQLite read is an async IPC invoke — TQ handles this exactly like API calls. Avoids manual useEffect + useState patterns for every list/detail query. |
### Map Library
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Leaflet | 1.9.x | Core map engine | Battle-tested, 148KB JS, no API key, OSM works out of the box. Croatia has excellent OSM coverage. |
| react-leaflet | 5.0.x | React bindings for Leaflet | Latest stable (v5.0.0). Declarative component model fits React patterns. |
| leaflet.offline | 3.2.x | Offline tile caching via IndexedDB | Stores downloaded tiles in IndexedDB, which Tauri supports natively on Windows. Users can pre-cache their region tiles. |
### EXIF Parsing
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| kamadak-exif | 0.6.1 | Read GPS lat/lon, DateTimeOriginal from smartphone JPEGs | Pure Rust, no C dependencies, actively maintained. Supports JPEG, HEIF, PNG, WebP. Exposes `GPSLatitude`, `GPSLatitudeRef`, `GPSLongitude`, `GPSLongitudeRef`, `DateTimeOriginal` tags directly. |
### File Watching
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| tauri-plugin-fs | 2.x (watch feature) | File system access + folder watching from frontend | The `watch` feature of the official FS plugin wraps `notify` and exposes it via IPC events. Avoids adding `notify` as a separate dependency. |
| notify | 6.x | Underlying cross-platform FS watcher | Used indirectly by `tauri-plugin-fs`. If you need lower-level control in Rust commands (e.g. recursive watch + debounce), add directly. Uses OS-native APIs (ReadDirectoryChangesW on Windows). |
### PDF Export
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @react-pdf/renderer | 3.x | Generate PDF from React components | Pure JavaScript, no native dependencies, 860K weekly downloads, actively maintained. Renders to a Blob in-browser. The React component model lets you design the report layout as JSX. |
| Comlink | 4.x | Web Worker bridge | Offloads PDF generation from the main thread. Without this, complex reports (many photos + maps) will freeze the UI. Proven pattern documented specifically for Tauri + react-pdf. |
### UI Component Library
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| shadcn/ui | current (CLI-managed) | Accessible, desktop-appropriate UI components | Components are copy-pasted into the repo — you own the code and customize freely. Built on Radix UI accessibility primitives (keyboard nav, ARIA). Tailwind v4 compatible as of March 2025. |
| Tailwind CSS | 4.x | Utility styling | shadcn/ui v4 components use Tailwind v4. Vite plugin makes integration straightforward. |
| Radix UI | (bundled via shadcn) | Accessible primitives | Do not use raw Radix directly — use it through shadcn/ui. You get Dialog, DropdownMenu, Tooltip, Select, etc. correctly wired to ARIA. |
### Species Database
| Source | Format | Coverage | Usability |
|--------|--------|----------|-----------|
| iNaturalist Open Data | CSV (taxa table, monthly snapshots on AWS) | Global, all species | Good taxonomy/naming, no edibility data, very large (filter to Fungi kingdom) |
| FunDiS Biodiversity Database | iNaturalist project, no offline dump | North America focus | Not useful for Croatia |
| MycoBank | Web database | Global taxonomy | No edibility data, no offline export |
| FGVCx Fungi Dataset | Image JSON + taxonomy | ~1,500 species | No edibility, no descriptions |
| Wikipedia / Wikidata | API or dumps | European species well covered | Edibility sometimes present in infoboxes, requires extraction |
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
## Installation Reference
# Frontend packages
# shadcn/ui (uses CLI, not npm install)
# Tauri plugins (Cargo.toml additions)
# tauri-plugin-sql = { version = "2", features = ["sqlite"] }
# tauri-plugin-fs = { version = "2", features = ["watch"] }
# libsqlite3-sys = { version = ">=0.17.2", features = ["bundled"] }
# kamadak-exif = "0.6"
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
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.

## Frontend Design

The `frontend-design` skill is installed at `.claude/skills/frontend-design/SKILL.md`.

**Always invoke the `frontend-design` skill before implementing or modifying any UI component, page layout, visual styling, or UX flow.**

### Established aesthetic: Forest Codex

Dark forest-floor theme committed in the initial redesign (2026-04-10):

- **Palette**: Deep moss background (`oklch(0.12 0.015 135)`), chanterelle amber primary (`oklch(0.72 0.12 80)`), warm off-white text. All CSS variables defined in `src/index.css`.
- **Typography**: Playfair Display (italic serif) for species names and headings; DM Sans for all UI copy; JetBrains Mono for coordinates and paths. Fonts loaded via Google Fonts in `index.html`.
- **Motion**: `animate-fade-up` on page-level content; `stagger-item` with `animationDelay` on list items. CSS-only.
- **Cards/hover**: Amber left-border reveal on hover (`group-hover:opacity-100`), edit/delete actions hidden until hover.
- **Tab nav**: Uppercase tracked labels (`tracking-[0.18em]`), amber underline on active tab via `[data-slot="tabs-trigger"][data-state="active"]::after` in CSS.

Do not introduce Inter, Roboto, system-ui as the primary font, purple/blue gradients, or light-mode defaults. This app is dark-only.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
