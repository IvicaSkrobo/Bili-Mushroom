# Domain Pitfalls: Bili Mushroom

**Domain:** Tauri 2 + React desktop catalogue app (Windows primary)
**Researched:** 2026-04-08
**Stack:** Tauri 2.x / React 18 / Rust / SQLite / Leaflet.js / OpenStreetMap

---

## Critical Pitfalls

Data loss, rewrites, or user-facing failures.

---

### Pitfall 1: Tauri 2 HTTP Scheme Change Wipes WebView Storage

**What goes wrong:** Tauri v1 Windows served frontend from `https://tauri.localhost`. v2 changed to `http://tauri.localhost`. Data in `localStorage`, `IndexedDB`, or cookies belongs to different origin — silently inaccessible, effectively erased.

**Why it happens:** Scheme is part of origin. `https://` and `http://` are different storage namespaces in WebView2 runtime. Change was intentional but traps devs who store state in browser APIs during dev, then can't read it in prod or after beta upgrades.

**Consequences:** React state in `localStorage` (preferences, species lookups, draft entries) lost silently on version change. IndexedDB paths change from `https_tauri.localhost_0.indexeddb.leveldb` to `http_tauri.localhost_0.indexeddb.leveldb`.

**Prevention:**
- Store ALL persistent user data in SQLite via Rust commands. Never rely on `localStorage` or `IndexedDB` for anything surviving app update.
- If preferences must live on JS side, use Tauri `store` plugin (`tauri-plugin-store`) — persists to JSON in `AppData`, not WebView storage.
- Never use `localStorage` as DB substitute in Tauri app.

**Detection:** Data missing after fresh install or dev→prod upgrade. Check WebView2 storage path changes.

**Phase:** Phase 1 (architecture decisions) — bake in before writing persistence code.

---

### Pitfall 2: SQLite "Database is Locked" on Windows Without WAL Mode

**What goes wrong:** Default SQLite journal mode DELETE holds exclusive write lock, blocks all readers and writers. In Tauri's multi-threaded Rust backend, single async command opening second connection during write returns `SQLITE_BUSY` and fails.

**Why it happens:** rusqlite `Connection` not `Send`, can't cross async task boundaries. Wrapping connection in `Mutex<Connection>` and holding lock across async calls (e.g., awaiting file I/O during import) starves other DB ops.

**Consequences:** Import fails mid-way with cryptic "database is locked". App hangs during batch photo imports.

**Prevention:**
- Enable WAL mode on first DB open: `PRAGMA journal_mode=WAL;`
- Set busy timeout: `PRAGMA busy_timeout=5000;`
- Keep write transactions short — don't hold open during file I/O or async work.
- Use `Mutex<Connection>` for simplest case, OR `sqlx` with pool (`SqlitePoolOptions`) for read concurrency. Single-user desktop: `Arc<Mutex<rusqlite::Connection>>` with short transactions adequate.
- Or use `tauri-plugin-sql` — handles WAL mode by default in recent versions.

**Detection:** `SQLITE_BUSY` errors during import; app freezes on "Importing..." screen.

**Phase:** Phase 1 (database setup) — WAL mode must be first PRAGMA on connection open.

---

### Pitfall 3: Missing SQLite Schema Migration Strategy

**What goes wrong:** App ships schema version 1. Future release adds column. Upgrading users get startup crash or silent corruption — running code expects new column, on-disk DB is old schema.

**Why it happens:** Devs test fresh installs; existing user DBs never tested against new code.

**Consequences:** App fails to start for existing users after update. Force-uninstall/reinstall loses all data. Critical distribution pitfall.

**Prevention:**
- Implement `PRAGMA user_version` tracking from day one, even if schema never changes in v1.
- Migration runner at startup (before any DB ops): check `user_version`, run pending migrations in order, bump version.
- Libraries: `rusqlite_migration` crate (simple embedded migrations), or `sqlx` with compile-time embedding (`sqlx::migrate!()`).
- Never use `CREATE TABLE IF NOT EXISTS` as substitute for versioned migrations — silently skips new columns on existing tables.

**Detection:** Users report startup crashes after update. Test: create v1 DB, run v2 binary against it.

**Phase:** Phase 1 (database setup) — must exist before first release, not retrofitted.

---

### Pitfall 4: OpenStreetMap Tile Offline Caching is Prohibited

**What goes wrong:** OSM tile usage policy at `tile.openstreetmap.org` forbids bulk downloading/pre-fetching tiles for offline use. "Cache this region for offline" features violate terms; IP/app gets blocked.

**Why it happens:** Caching tiles for local-first app seems natural. OSM tile servers are community resource with strict limits.

**Consequences:** App rate-limited or blocked mid-session. Legal/ToS violation for distributed app.

**Prevention:**
- HTTP-cache-compliant caching only — respect cache headers, don't batch-download tiles user hasn't navigated to.
- For true offline: self-host tiles (MBTiles) or use provider allowing offline use (Stadia Maps, MapTiler, local `tileserver-gl` sidecar).
- For this app (online, Croatia region), standard Leaflet tile caching via browser HTTP cache is sufficient and compliant. Don't add "download for offline" without switching providers.
- Display OSM attribution `© OpenStreetMap contributors` visibly at all times — mandatory.

**Detection:** HTTP 429 from tile servers; tiles fail after heavy use.

**Phase:** Phase 2 (map implementation) — attribution in initial implementation; offline tile decisions before any caching layer.

---

### Pitfall 5: Edibility Information as Legal Liability

**What goes wrong:** App shows edibility/toxicity (Edible, Toxic, Deadly) from built-in species DB. User misidentifies species, sees "Edible", eats it, gets harmed.

**Why it happens:** Mushroom ID genuinely hard. Similar-looking species can have opposite toxicity. Any app presenting edibility data may be relied upon for real consumption decisions.

**Consequences:** User harm. Legal liability in some jurisdictions. App store removal. Reputational damage.

**Prevention:**
- Persistent, prominent disclaimer on every edibility/toxicity field: personal journal, not ID guide; never consume based solely on app data.
- One-time disclaimer acknowledgment at first launch (store in SQLite, not `localStorage`).
- Cautious language: "typically edible" not "edible". Deadly species: max-visibility warnings (red, skull icon, clear label).
- For data from external DBs (iNaturalist, GBIF, Wikipedia): include source attribution, note data may be inaccurate.
- Don't market as identification tool.

**Detection:** User reviews or community feedback treating app as authoritative.

**Phase:** Phase 1 (species database design) — disclaimer architecture designed upfront, not afterthought.

---

## Moderate Pitfalls

Significant rework or user-facing bugs.

---

### Pitfall 6: EXIF GPS Coordinates Are Not Always Decimal Degrees

**What goes wrong:** EXIF stores GPS in DMS as rational numbers (numerator/denominator pairs) plus hemisphere ref (N/S/E/W). Android cameras write `{degrees}/{denominator},{minutes}/{denominator},{seconds}/{divisor}` — requires specific parsing. Hemisphere `S` or `W` without negation puts pin in wrong hemisphere.

**Why it happens:** Most EXIF tutorials show happy path. Edge cases: missing `GPSLatitudeRef`/`GPSLongitudeRef`, zero-denominator rationals, GPS altitude at different precision, fully missing GPS block.

**Consequences:** Pins at wrong coordinates — mirrored across equator or prime meridian. App appears broken; data quietly corrupted.

**Prevention:**
- Always check `GPSLatitudeRef` and `GPSLongitudeRef`; negate decimal if `S` or `W`.
- Guard division by zero on denominators.
- Validate coordinates are geographically plausible (lat -90 to 90, lon -180 to 180).
- GPS block present but required subfield missing → fall back to manual entry, not 0,0.
- Use maintained EXIF library (`exifr` on JS side, or `kamadak-exif`/`rexiv2` on Rust side) — don't hand-roll parser.

**Detection:** Test with Android (Kotlin-format DMS), iPhone (standard EXIF), camera with no GPS. Verify pins against known locations.

**Phase:** Phase 2 (import pipeline) — write tests for all three GPS formats before building UI.

---

### Pitfall 7: EXIF Dates Have No Timezone Information

**What goes wrong:** `DateTimeOriginal` in EXIF is naive local timestamp, no timezone offset. Croatia (UTC+2) photo at 14:00 stored as `2024:05:10 14:00:00` — same string as UK photo at 14:00. Sorting/grouping by day shows wrong order across timezones.

**Why it happens:** EXIF standard historically lacked timezone field. `OffsetTimeOriginal` added later; most cameras (older DSLRs, basic Android) don't write it. iPhones do for GPS-tagged photos.

**Consequences:** Seasonal calendar and per-date grouping show wrong distribution. Mushroom found 23:30 Croatia time may appear under next day's group when treated as UTC.

**Prevention:**
- Store timestamps as-is (naive local time) in SQLite, with separate nullable `timezone_offset` column.
- Croatia-focused audience: minor issue (most users same timezone). Don't infer timezone from GPS in v1 — requires reverse-geocoding lookup, adds complexity.
- Display dates without timezone conversion. Document behavior.
- If `OffsetTimeOriginal` present in EXIF, use it. Otherwise store naive time, accept edge case.

**Detection:** Import photos with known capture times, verify sort order.

**Phase:** Phase 2 (import pipeline) — design schema with timezone in mind from start, even if field starts NULL.

---

### Pitfall 8: Windows Path Separators Break File Organization

**What goes wrong:** Rust `std::path::PathBuf` handles Windows paths with backslash separators. Tauri dialog `defaultPath` requires backslashes on Windows — forward slashes open dialog in default directory. Path strings across IPC as JSON (JS → Rust) can cause `file not found` from separator mismatch.

**Why it happens:** JS strings use forward slashes by convention. Rust `PathBuf` uses OS-native separator. Paths built by string concatenation instead of `PathBuf` diverge.

**Consequences:** File copy operations silently fail. Dialog opens wrong location. Folder creation fails on Windows where forward-slash paths rejected by some Win32 APIs.

**Prevention:**
- Never build file paths by string concatenation. Always use `std::path::PathBuf` and `.join()` in Rust.
- Path from frontend → pass through `PathBuf::from()` on Rust side before file ops.
- Path to frontend → use `.to_string_lossy()` for OS-native representation.
- For dialog `defaultPath`, construct path in Rust, send already formatted.
- Test file ops on Windows specifically (not just macOS/Linux during dev).

**Detection:** File not found errors Windows-only. Dialog opens wrong default folder.

**Phase:** Phase 2 (import pipeline) — cross-platform path handling in first Rust file I/O code.

---

### Pitfall 9: Duplicate Photo Detection Is Harder Than It Looks

**What goes wrong:** User imports same folder twice (re-syncing after adding photos). App creates duplicate entries for every existing photo instead of only new ones.

**Why it happens:** Filename deduplication breaks on rename, copy to different folder, or import from different copy. File mtime changes on copy.

**Consequences:** Collection doubles silently. Stats wrong. Map shows duplicate pins. User must manually clean up.

**Prevention:**
- Generate content hash (SHA-256 of first 64KB + file size) at import; store in SQLite. Re-import checks hash first.
- Full-file SHA-256 too slow for 10MB+ photos in real-time. Partial hash (first 64KB + total size) fast, sufficient for personal collection dedup.
- Do NOT use filename alone. Do NOT use file path alone.
- Store `imported_at` timestamp and `source_path` for user context.
- On re-import, show count: "X new finds added, Y duplicates skipped."

**Detection:** Import same folder twice, verify record count unchanged.

**Phase:** Phase 2 (import pipeline) — dedup strategy in schema before writing import code.

---

### Pitfall 10: Tauri's New ACL Permissions System Is Easy to Misconfigure

**What goes wrong:** Tauri 2 replaced v1 allowlist with capability-based ACL. Every filesystem op, dialog, shell command must be explicitly granted in `capabilities/*.json`. Missing permission silently denies at runtime — frontend gets vague error, not clear "permission denied".

**Why it happens:** New system more granular, more setup required. Devs test in `tauri dev` (broader defaults), then find prod builds missing permissions. `fs:allow-read-recursive` vs `fs:read-all` distinction not obvious.

**Consequences:** File picker opens but reading selected file fails. Import works in dev, breaks in prod. Users see "Error: not allowed" with no guidance.

**Prevention:**
- Read Tauri v2 permissions docs before implementing any file I/O. `https://v2.tauri.app/security/permissions/`
- Test prod builds (`tauri build`) from day one — don't rely solely on `tauri dev`.
- Separate capability files by category (filesystem, dialogs) per official docs.
- Grant minimum permissions: `fs:allow-read` scoped to user-selected directories, not global `fs:read-all`.
- Wrap Tauri command errors on JS side with explicit messages.

**Detection:** Features work in `tauri dev`, fail in `tauri build`. Check browser console in prod for IPC errors.

**Phase:** Phase 1 (project scaffold) — configure capability files correctly at start, expand as needed.

---

### Pitfall 11: WebView2 Is Not Guaranteed to Be Installed on Target Windows Machines

**What goes wrong:** Tauri Windows requires WebView2 runtime — bundled with Windows 11, included in Windows 10 updates since late 2021. Some Windows 10 machines (corporate, managed) may not have it. Default Tauri installer downloads WebView2 at install time; fails silently in offline/restricted environments.

**Why it happens:** Default `webviewInstallMode` is `downloadBootstrapper` — requires internet during installation.

**Consequences:** App fails to launch after successful-looking install. User sees blank window or WebView2 error. Support burden increases.

**Prevention:**
- Use `webviewInstallMode: "offlineInstaller"` in `tauri.conf.json` — bundles WebView2 offline installer (~127MB larger).
- Or `fixedRuntime` for specific WebView2 version (~180MB larger), maximum reproducibility.
- For target audience (Croatian foragers, distributing among friends), offline installer safer.
- Document installer size tradeoff in project decisions.

**Detection:** Install on fresh Windows 10 VM with no internet, verify it launches.

**Phase:** Phase 4 (distribution) — choose bundling strategy early; installer size affects distribution planning.

---

### Pitfall 12: Windows Defender / Antivirus Flags Unsigned Tauri Installers

**What goes wrong:** Unsigned Tauri `.exe` installers (NSIS) consistently flagged as malware by Windows Defender and third-party AV. Documented NSIS upstream issue unrelated to app code. `.msi` installers sometimes trigger SmartScreen too.

**Why it happens:** NSIS plugins not individually signed. Unknown publisher + NSIS packing = heuristic malware detection. SmartScreen blocks unsigned executables downloaded from browser.

**Consequences:** Users see "Windows protected your PC" SmartScreen warning, must click "Run anyway." Many won't. Some AV products quarantine installer entirely.

**Prevention:**
- Sign app with code signing cert (EV removes SmartScreen entirely; OV/DV reduces but not eliminates).
- For early trusted distribution (Croatia forager community): provide SHA-256 hash + bypass instructions.
- Use `.msi` not NSIS `.exe` — fewer false positives.
- Broader distribution: budget code signing (~$200-500/year OV cert).

**Detection:** Download installer from browser on fresh Windows machine, observe SmartScreen behavior.

**Phase:** Phase 4 (distribution) — plan before first public release.

---

## Minor Pitfalls

Polish debt or small fixes.

---

### Pitfall 13: Leaflet Map Performance Degrades with 500+ Unclustered Markers

**What goes wrong:** Leaflet renders each marker as separate DOM element. At 500+ markers (reachable for active forager over years), panning/zooming sluggish, initial render slow.

**Prevention:**
- Use `Leaflet.markercluster` (via `react-leaflet-cluster`) from first implementation — handles 10,000+ markers with no lag.
- Load only markers for current visible map bounds (viewport culling).
- Lazy-load marker data: fetch from SQLite after map initializes, show loading indicator.

**Phase:** Phase 2 (map) — use clustering in initial implementation, not as later optimization.

---

### Pitfall 14: Thumbnail Generation Blocks the UI Thread

**What goes wrong:** Generating thumbnails for 50+ photos synchronously on Rust side blocks Tauri command, freezes UI. 10MB smartphone photo via `image` crate ~200ms; 50 photos = 10s UI freeze.

**Prevention:**
- Run thumbnail generation in Tokio `spawn_blocking` task (CPU-bound off async executor).
- Emit progress events via Tauri event system (`app.emit("import_progress", ...)`) for incremental UI updates.
- Generate thumbnails at fixed size (e.g., 300×300 px JPEG 80% quality) at import time; never resize on-the-fly.
- Store thumbnail paths in SQLite; render `<img src="asset://...">` in UI.

**Phase:** Phase 2 (import pipeline) — async import with progress reporting designed in from start.

---

### Pitfall 15: Species Data Copyright and Attribution

**What goes wrong:** Species descriptions, habitat data, edibility info from external DBs (Wikipedia, iNaturalist, GBIF, Plants for a Future) carry license terms requiring attribution or restricting commercial use.

**Prevention:**
- Write original descriptions for Croatian/European species, based on multiple sources, not copied verbatim.
- Wikipedia CC BY-SA requires attribution; derivative works carry same license.
- GBIF CC BY 4.0 or CC0 — attribution required for BY.
- Include "Data Sources" in app About screen.
- Initial 50-100 Croatian species: hand-curated original text feasible and legally cleanest.

**Phase:** Phase 3 (species database content) — review license terms before writing data entry code.

---

### Pitfall 16: Photo Copy vs. Move Confusion During Import

**What goes wrong:** Importing photos into `Location/Date/` structure — unclear if originals copied (safe) or moved (lost). Interrupted move = partially-imported photos with originals deleted.

**Prevention:**
- Always copy, never move, as default. Offer "move originals" as explicit opt-in with clear warning.
- Atomic copy ops: write to temp file in destination, then rename (atomic on same filesystem).
- On import failure, clean up partial copies; no half-written files.
- Show user exactly what happens before confirm: "X photos will be copied to [path]".

**Phase:** Phase 2 (import pipeline).

---

### Pitfall 17: SQLite Database File Location Confusion

**What goes wrong:** SQLite in app install dir (`C:\Program Files\...`) — writes fail on standard Windows due to UAC. Hardcoded path instead of Tauri `app_data_dir()` breaks in multi-user environments.

**Prevention:**
- Always use `app_handle.path().app_data_dir()` (Tauri v2 path API). Returns `C:\Users\[user]\AppData\Roaming\[bundle-id]\` — always user-writable.
- Never hardcode `C:\Users\ivan\...` or relative paths like `./data/mushrooms.db`.
- User's chosen "mushroom data folder" (photos) separate from SQLite metadata DB — photos folder user-configurable, DB always in AppData.

**Phase:** Phase 1 (project scaffold).

---

## Phase-Specific Warning Map

| Phase | Topic | Likely Pitfall | Mitigation |
|-------|-------|---------------|------------|
| Phase 1: Scaffold | Database setup | No migration strategy at start | Add `user_version` PRAGMA tracking before first table |
| Phase 1: Scaffold | Persistence | Using localStorage for any user data | Use SQLite + tauri-plugin-store exclusively |
| Phase 1: Scaffold | DB path | Hardcoded or install-dir path | Use `app_data_dir()` from day one |
| Phase 1: Scaffold | Permissions | Capability files misconfigured | Test production build immediately |
| Phase 2: Import | EXIF GPS | Wrong hemisphere, zero denominator | Test with Android, iPhone, and GPS-less photos |
| Phase 2: Import | EXIF dates | Naive timestamps sorted wrong | Store naive time + nullable offset; do not infer timezone |
| Phase 2: Import | Windows paths | String concat with wrong separators | PathBuf everywhere in Rust |
| Phase 2: Import | Duplicates | Re-import doubles all records | Content hash deduplication in schema from start |
| Phase 2: Import | Thumbnails | UI freeze during batch generation | spawn_blocking + progress events |
| Phase 2: Import | Copy vs move | Originals lost on interrupted move | Copy-only default; atomic rename |
| Phase 2: Map | OSM tiles | Bulk caching violates ToS | HTTP-cache only; mandatory attribution |
| Phase 2: Map | Map performance | Slow at 500+ markers | Use markercluster from day one |
| Phase 3: Species | Edibility | Liability from wrong data | Prominent disclaimer; cautious language |
| Phase 3: Species | Copyright | Copied descriptions violate license | Original text or properly attributed CC0 |
| Phase 4: Distribute | Antivirus | SmartScreen blocks installer | MSI format; document bypass; plan for signing |
| Phase 4: Distribute | WebView2 | Missing runtime on some Win 10 machines | offlineInstaller bundle mode |
| Phase 4: Distribute | SQLite schema | Old DB schema crashes on update | Migration runner must exist before first public release |

---

## Sources

- Tauri v2 migration guide: https://v2.tauri.app/start/migrate/from-tauri-1/
- Tauri v2 permissions: https://v2.tauri.app/security/permissions/
- Tauri Windows installer docs: https://v2.tauri.app/distribute/windows-installer/
- Tauri Windows code signing: https://v2.tauri.app/distribute/sign/windows/
- Tauri false positives (community guide): https://tauri.by.simon.hyll.nu/concepts/security/false_positives/
- Tauri NSIS antivirus issue: https://github.com/tauri-apps/tauri/issues/4749
- Tauri IndexedDB path change (v1→v2): https://github.com/tauri-apps/tauri/issues/11252
- Tauri dialog defaultPath backslash issue: https://github.com/tauri-apps/tauri/issues/8074
- SQLite WAL mode: https://www.sqlite.org/wal.html
- SQLite locking: https://sqlite.org/lockingv3.html
- SQLite concurrent write errors (practical guide): https://tenthousandmeters.com/blog/sqlite-concurrent-writes-and-database-is-locked-errors/
- OSM tile usage policy: https://operations.osmfoundation.org/policies/tiles/
- OSM attribution guidelines: https://osmfoundation.org/wiki/Licence/Attribution_Guidelines
- Leaflet.markercluster: https://github.com/Leaflet/Leaflet.markercluster
- EXIF Android GPS format (TypeScript): https://timjwilliams.medium.com/parsing-android-exif-coordinates-in-typescript-8a7c9c8dae69
- EXIF timezone issues (PhotoPrism discussion): https://github.com/photoprism/photoprism/discussions/3780
- Mushroom edibility disclaimer examples: https://fungiatlas.com/disclaimer/
- Mushroom ID app liability analysis: https://www.citizen.org/article/mushroom-risk-ai-app-misinformation/
- GBIF species data: https://www.gbif.org/
- Duplicate image detection: https://benhoyt.com/writings/duplicate-image-detection/
- Rust AppData path for Tauri: https://dezoito.github.io/2025/01/01/embedding-sqlite-in-a-tauri-application.html