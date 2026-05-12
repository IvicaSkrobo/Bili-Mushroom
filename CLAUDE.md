<!-- GSD:project-start source:PROJECT.md -->
## Project

**Bili Mushroom**

Windows desktop app for mushroom foragers to catalogue, organize, explore finds. Import photos + info; app organizes by location/date, displays on interactive map, provides knowledge base: species descriptions, edibility warnings, personal notes. Tauri + React + Rust — distributable to foragers.

**Core Value:** Forager's personal mushroom journal — every find stored, organized, searchable, mapped. Nothing collected forgotten.

### Constraints

- **Platform**: Windows primary (Win 10/11) — Tauri supports Mac/Linux but not focus
- **Storage**: 100% local — no internet required for core features (map tiles may need initial download)
- **Distribution**: Packaged installer — no Node/Rust on end user machine
- **Tech Stack**: Tauri 2.x + React 18+ + Rust (already committed)
- **Species Database**: Bundled with app — no external API for species lookup in v1
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tauri | 2.10.x | Desktop shell, OS integration | Latest stable (2.10.3, Mar 2025). 10-20x smaller than Electron. Rust backend: safe file I/O, EXIF, SQLite. No Node.js on end user machine. |
| React | 18.x | UI rendering | Already committed. Concurrent features align with Tauri 2 async IPC model. |
| TypeScript | 5.x | Type safety across frontend | Non-negotiable. Data-heavy app with complex domain types (species, finds, coordinates). |
| Vite | 5.x | Frontend build tooling | Default Tauri 2 scaffolding uses Vite. Fast HMR. No reason to deviate. |
### SQLite / Database
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| rusqlite | 0.31.x | Rust-side SQLite access | Current implementation uses explicit Tauri commands backed by rusqlite, which keeps database behavior local, testable, and under app control. |
| libsqlite3-sys | latest | SQLite native binding | Included with `features = ["bundled"]` so Windows builds do not depend on a system sqlite3 library. |
### State Management
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Zustand | 5.0.x | Global UI state (active species, filter state, selected find, map viewport, active tab) | Minimal boilerplate, no Provider wrappers, excellent TS inference in v5. 5.0.12 latest (active). |
| TanStack Query | 5.x | All async data — Tauri IPC calls to SQLite | Caching, bg refetch, loading/error states. Every SQLite read is async IPC invoke — TQ handles like API calls. Avoids manual useEffect + useState per query. |
### Map Library
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Leaflet | 1.9.x | Core map engine | Battle-tested, 148KB JS, no API key, OSM out of box. Croatia has excellent OSM coverage. |
| react-leaflet | 4.2.x | React bindings for Leaflet | Current committed app uses React 18 with react-leaflet 4.2.x. Keep this unless intentionally upgrading map internals. |
| Rust tile proxy + cache | app-local | Offline-friendly map tile handling | Current app routes tiles through Rust-side proxy/cache commands instead of relying on service-worker tile caching. |
### EXIF Parsing
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| kamadak-exif | 0.6.1 | Read GPS lat/lon, DateTimeOriginal from smartphone JPEGs | Pure Rust, no C deps, active. Supports JPEG, HEIF, PNG, WebP. Exposes `GPSLatitude`, `GPSLatitudeRef`, `GPSLongitude`, `GPSLongitudeRef`, `DateTimeOriginal` directly. |
### File Watching
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| tauri-plugin-fs | 2.x (watch feature) | File system access + folder watching from frontend | `watch` feature wraps `notify`, exposes via IPC events. No separate `notify` dep needed. |
| notify | 6.x | Underlying cross-platform FS watcher | Used indirectly by `tauri-plugin-fs`. Add directly for lower-level Rust control (recursive watch + debounce). OS-native APIs (ReadDirectoryChangesW on Windows). |
### PDF Export
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @react-pdf/renderer | 4.x | Generate PDF from React components | Current app uses v4.x with a worker-based export path. Design report layout as JSX. |
| Comlink | 4.x | Web Worker bridge | Offloads PDF gen from main thread. Without it, complex reports freeze UI. Proven pattern for Tauri + react-pdf. |
### UI Component Library
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| shadcn/ui | current (CLI-managed) | Accessible, desktop-appropriate UI components | Components copy-pasted into repo — own + customize freely. Built on Radix UI primitives (keyboard nav, ARIA). Tailwind v4 compatible Mar 2025. |
| Tailwind CSS | 4.x | Utility styling | shadcn/ui v4 uses Tailwind v4. Vite plugin integrates cleanly. |
| Radix UI | (bundled via shadcn) | Accessible primitives | Don't use raw Radix directly — use via shadcn/ui. Get Dialog, DropdownMenu, Tooltip, Select, etc. wired to ARIA. |
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
| SQLite access | rusqlite Tauri commands | tauri-plugin-sql | Current app already owns migrations/queries through Rust commands; do not introduce a second DB access layer casually. |
| State management | Zustand + TanStack Query | Redux Toolkit | 3x boilerplate, wrong fit for solo dev desktop app |
| Map | react-leaflet | MapLibre GL JS | 800KB vs 148KB; WebGL overhead; Croatia use case doesn't need vector tiles or 3D |
| Map tiles | Rust proxy/cache | leaflet.offline / service worker | Tauri desktop behavior is easier to control from Rust; keep cache logic in app-owned commands. |
| EXIF | kamadak-exif | rexif | rexif is JPEG/TIFF only, less active maintenance, no HEIF support |
| PDF | @react-pdf/renderer | printpdf (Rust) | Low-level; manual photo/text layout impractical |
| PDF | @react-pdf/renderer | wkhtmltopdf | Requires bundling 30MB extra binary; deployment complexity |
| UI | shadcn/ui | Mantine | Mantine opinionated SaaS lib; shadcn/ui code ownership fits custom desktop better |
| Watch | tauri-plugin-fs (watch) | notify crate directly | Plugin wraps notify and exposes to frontend IPC — less code |
## Installation Reference
# Frontend packages
# shadcn/ui (uses CLI, not npm install)
# Tauri plugins (Cargo.toml additions)
# tauri-plugin-fs = { version = "2", features = ["watch"] }
# libsqlite3-sys = { version = ">=0.17.2", features = ["bundled"] }
# rusqlite = { version = "0.31", features = ["bundled"] }
# kamadak-exif = "0.6"
## Confidence Summary
| Area | Confidence | Notes |
|------|------------|-------|
| Tauri 2.x version (2.10.3) | HIGH | Confirmed from GitHub releases |
| rusqlite + Windows bundled SQLite | HIGH | Matches current committed backend and avoids sqlite3.lib system dependency. |
| Zustand v5 + TanStack Query v5 | HIGH | Both active, versions confirmed |
| react-leaflet v4 + Rust tile cache | HIGH | Matches current committed package versions and map proxy/cache implementation. |
| kamadak-exif 0.6.1 | HIGH | crates.io + docs.rs confirmed |
| tauri-plugin-fs watch feature | HIGH | Official docs confirmed |
| @react-pdf/renderer + Comlink | MEDIUM | Pattern confirmed Mar 2025 Tauri article |
| shadcn/ui + Tailwind v4 | HIGH | Official docs confirmed Mar 2025 |
| Species database (manual curation) | MEDIUM | No ready-made source found; approach is sound |
## Sources
- [Tauri File System Plugin — official docs](https://v2.tauri.app/plugin/file-system/)
- [Tauri GitHub Releases](https://github.com/tauri-apps/tauri/releases)
- [Windows sqlite3.lib build error + bundled fix](https://github.com/tauri-apps/tauri/discussions/6183)
- [kamadak-exif on crates.io](https://crates.io/crates/kamadak-exif)
- [kamadak-exif docs.rs (latest 0.6.1)](https://docs.rs/crate/kamadak-exif/latest)
- [notify crate — GitHub](https://github.com/notify-rs/notify)
- [Generating PDFs in Tauri with React-PDF and Web Workers (March 2025)](https://medium.com/codex/generating-pdfs-in-a-tauri-app-using-react-pdf-and-web-workers-0419999f14cf)
- [shadcn/ui Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4)
- [MapLibre GL JS vs Leaflet comparison](https://blog.jawg.io/maplibre-gl-vs-leaflet-choosing-the-right-tool-for-your-interactive-map/)
- [Zustand v5 release notes](https://github.com/pmndrs/zustand/releases)
- [TanStack Query v5 announcement](https://tanstack.com/blog/announcing-tanstack-query-v5)
- [iNaturalist Open Data on GitHub](https://github.com/inaturalist/inaturalist-open-data)
- [React UI libs 2025 comparison](https://makersden.io/blog/react-ui-libs-2025-comparing-shadcn-radix-mantine-mui-chakra)
- [Bare-Metal Offline Tauri + IndexedDB (Medium)](https://medium.com/@connect.hashblock/bare-metal-offline-architecting-a-blazing-fast-desktop-app-with-tauri-and-indexeddb-a932e6a58fb3)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

None yet. Populate as patterns emerge.

## Frontend Design

`frontend-design` skill installed at `.agents/skills/frontend-design/SKILL.md`.

**Always invoke `frontend-design` skill before implementing/modifying UI components, layouts, styling, UX flows.**

### Established aesthetic: Forest Codex

Dual light/dark herbarium theme. Current implementation is the source of truth:

- **Theme modes**: Keep both light and dark themes. Light is "Herbarium Daybook"; dark is "Nocturne Herbarium". The theme toggle in `src/components/layout/AppShell.tsx` is intentional.
- **Palette**: CSS vars in `src/index.css`. Light uses warm paper/herbarium neutrals with amber primary and green secondary. Dark uses deep nocturne blue-green surfaces with amber primary and teal secondary.
- **Typography**: Cormorant Garamond for species names and headings, Manrope for UI copy, IBM Plex Mono for coordinates and technical paths. Fonts are loaded in `index.html` and mapped in `src/index.css`.
- **Motion**: `animate-fade-up` on page-level content; `stagger-item` with `animationDelay` on list items. CSS-only.
- **Cards/hover**: Use shared shadcn-style primitives from `src/components/ui/`. The shared Card component lives in `src/components/ui/card.tsx`; changing it affects every imported `Card`, `CardContent`, etc. Collection/find rows use amber left-border reveal on hover (`group-hover:opacity-100`) and restrained hover actions.
- **Tab nav**: Uppercase tracked labels (`tracking-[0.18em]`), amber underline on active tab via `[data-slot="tabs-trigger"][data-state="active"]::after` in CSS.

No Inter, Roboto, or system-ui as the primary app font. No purple/blue gradients. Do not remove light mode or force dark-only styling.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Current app structure:

- `src/App.tsx`: bootstraps storage path, database readiness, updater state, first-run/auto-import flow, and global providers.
- `src/components/layout/AppShell.tsx`: global header, theme/settings controls, update banner, and primary tab navigation.
- `src/tabs/`: top-level feature screens (`CollectionTab`, `SpeciesTab`, `MapTab`, `StatsTab`). These are currently large orchestration components; prefer extracting pure helpers/hooks and section components when touching them.
- `src/components/finds/`, `src/components/import/`, `src/components/map/`, `src/components/species/`, `src/components/stats/`: feature components grouped by domain.
- `src/components/ui/`: shared shadcn-style primitives. Keep these generic and app-wide; avoid one-off feature behavior here.
- `src/hooks/`: TanStack Query hooks wrapping async app data.
- `src/lib/`: domain logic, data helpers, export code, storage/geocoding/tile utilities, and testable pure functions.
- `src/stores/appStore.ts`: small Zustand store for global UI/app state only.
- `src-tauri/src/commands/`: Rust command boundary for local filesystem, SQLite, EXIF, tile cache/proxy, updater, stats, zones, and imports.

Architecture preferences:

- Keep core data local-first and routed through app-owned Rust commands.
- Reuse TanStack Query hooks for async reads/writes instead of ad hoc `useEffect` data loading.
- Move duplicated parsing/formatting logic into `src/lib/` with focused tests.
- Keep UI state near the feature unless it must coordinate across tabs; use Zustand only for cross-screen state such as active tab, map layer, selected species handoff, and update state.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

None found. Add to `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with `SKILL.md` index.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before Edit, Write, or other file-changing tools, start via GSD command. Keeps planning artifacts + execution context in sync.

Entry points:
- `/gsd-quick` — small fixes, doc updates, ad-hoc tasks
- `/gsd-debug` — investigation + bug fixing
- `/gsd-execute-phase` — planned phase work

No direct repo edits outside GSD workflow unless user explicitly bypasses.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
