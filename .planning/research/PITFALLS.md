# Domain Pitfalls: Bili Mushroom

**Domain:** Tauri 2 + React desktop catalogue app (Windows primary)
**Researched:** 2026-04-08
**Stack:** Tauri 2.x / React 18 / Rust / SQLite / Leaflet.js / OpenStreetMap

---

## Critical Pitfalls

Mistakes that cause data loss, rewrites, or user-facing failures.

---

### Pitfall 1: Tauri 2 HTTP Scheme Change Wipes WebView Storage

**What goes wrong:** In Tauri v1 on Windows, the frontend was served from `https://tauri.localhost`. In Tauri v2 it was changed to `http://tauri.localhost`. Any data stored in `localStorage`, `IndexedDB`, or cookies belongs to a different origin after this change — it is silently inaccessible and effectively erased from the user's point of view.

**Why it happens:** The scheme is part of the origin, so `https://` and `http://` are different storage namespaces in the WebView2 runtime. The change was intentional but creates a data loss trap for developers who store state in browser APIs during development, then discover they can't read it in production (or after upgrading from beta builds).

**Consequences:** Any React state persisted to `localStorage` (e.g., user preferences, cached species lookups, draft entries) is lost silently on app version changes. IndexedDB storage locations on Windows change from `https_tauri.localhost_0.indexeddb.leveldb` to `http_tauri.localhost_0.indexeddb.leveldb`.

**Prevention:**
- Store ALL persistent user data in SQLite via Rust commands. Never rely on `localStorage` or `IndexedDB` for anything that must survive an app update.
- If preferences must be stored on the JS side, use Tauri's `store` plugin (`tauri-plugin-store`) which persists to a JSON file in `AppData`, not the WebView storage.
- Never use `localStorage` as a database substitute in a Tauri app.

**Detection:** Data missing after fresh install or after upgrading from dev to production build. Check WebView2 storage path changes.

**Phase:** Phase 1 (architecture decisions) — bake this in before writing any persistence code.

---

### Pitfall 2: SQLite "Database is Locked" on Windows Without WAL Mode

**What goes wrong:** The default SQLite journal mode is DELETE (rollback journal). Under this mode, a write transaction holds an exclusive lock that blocks all readers and other writers. In Tauri's multi-threaded Rust backend, even a single async command that opens a second connection while a write is in progress returns `SQLITE_BUSY` and fails.

**Why it happens:** rusqlite's `Connection` is not `Send`, so it cannot cross async task boundaries easily. The common pattern of wrapping a connection in `Mutex<Connection>` and holding the lock across async calls (e.g., awaiting file I/O during an import) starves other database operations.

**Consequences:** Import operations fail mid-way through with cryptic "database is locked" errors. The app appears to hang during batch photo imports.

**Prevention:**
- Enable WAL mode immediately on first database open: `PRAGMA journal_mode=WAL;`
- Set a busy timeout: `PRAGMA busy_timeout=5000;`
- Keep write transactions short — do not hold a transaction open while doing file I/O or any async work.
- Use `Mutex<Connection>` for the simplest case, OR use `sqlx` with a connection pool (`SqlitePoolOptions`) which handles read concurrency properly. For a single-user desktop app, `Arc<Mutex<rusqlite::Connection>>` with short transactions is adequate.
- Alternatively use `tauri-plugin-sql` which handles WAL mode by default in recent versions.

**Detection:** `SQLITE_BUSY` errors during import; app freezes on the "Importing..." screen.

**Phase:** Phase 1 (database setup) — WAL mode must be the very first PRAGMA applied on connection open.

---

### Pitfall 3: Missing SQLite Schema Migration Strategy

**What goes wrong:** The app ships with schema version 1. A future release adds a column. Users who upgrade get a startup crash or silent data corruption because the running code expects the new column but the on-disk database is the old schema.

**Why it happens:** Developers test fresh installs; existing user databases are never tested against new code.

**Consequences:** App fails to start for existing users after update. Force-uninstall/reinstall loses all data. This is a critical distribution pitfall.

**Prevention:**
- Implement `PRAGMA user_version` tracking from day one, even if the schema never changes in v1.
- Use a migration runner at startup (before any other DB operations): check `user_version`, run pending migrations in order, then bump the version.
- Libraries: `rusqlite_migration` crate (simple embedded migrations), or `sqlx` with compile-time migration embedding (`sqlx::migrate!()`).
- Never use `CREATE TABLE IF NOT EXISTS` as a substitute for versioned migrations — it silently skips adding new columns to existing tables.

**Detection:** Users reporting startup crashes after update. Test by creating a v1 database, then running the v2 binary against it.

**Phase:** Phase 1 (database setup) — must be in place before first release, not retrofitted later.

---

### Pitfall 4: OpenStreetMap Tile Offline Caching is Prohibited

**What goes wrong:** The OSM tile usage policy at `tile.openstreetmap.org` explicitly forbids bulk downloading / pre-fetching tiles for offline use. Features like "cache this region for offline use" violate the terms and can result in the IP/app being blocked.

**Why it happens:** It seems natural to cache tiles for a local-first app. But OSM's tile servers are a community resource with strict usage limits.

**Consequences:** App gets rate-limited or blocked mid-session. Legal/ToS violation for a distributed app.

**Prevention:**
- Use HTTP-cache-compliant tile caching only — respect cache headers, do not batch-download tiles the user hasn't navigated to.
- For true offline capability, self-host tiles (MBTiles format) or use a tile provider that explicitly allows offline use (e.g., Stadia Maps, MapTiler, or a local `tileserver-gl` sidecar).
- For this app (primarily online, Croatia region), standard Leaflet tile caching via the browser's HTTP cache is sufficient and compliant. Do not add a "download for offline" feature without switching tile providers.
- Display OSM attribution `© OpenStreetMap contributors` visibly on the map at all times — this is mandatory, not optional.

**Detection:** App receives HTTP 429 responses from tile servers; map tiles fail to load after heavy usage.

**Phase:** Phase 2 (map implementation) — attribution must be in the initial implementation; offline tile decisions must be made before building any caching layer.

---

### Pitfall 5: Edibility Information as Legal Liability

**What goes wrong:** The app displays edibility/toxicity status (Edible, Toxic, Deadly) from a built-in species database. A user misidentifies a species, sees "Edible" in the app, consumes it, and is harmed.

**Why it happens:** Mushroom identification is genuinely hard. Similar-looking species can have opposite toxicity. Any app that presents edibility data could be relied upon by a user making a real consumption decision.

**Consequences:** Personal harm to users. Legal liability in some jurisdictions. App store removal. Reputational damage.

**Prevention:**
- Display a persistent, prominent disclaimer on every edibility/toxicity field: the app is a personal journal, not an identification guide; never consume anything based solely on app data.
- Require a one-time disclaimer acknowledgment at first launch (store acknowledgment in SQLite, not `localStorage`).
- Use cautious language: "typically edible" rather than "edible". For deadly species, use maximum-visibility warnings (red, skull icon, clear label).
- For species data sourced from external databases (iNaturalist, GBIF, Wikipedia), include source attribution and note that data may be inaccurate.
- Do not market the app as an identification tool.

**Detection:** User reviews or community feedback treating the app as authoritative.

**Phase:** Phase 1 (species database design) — disclaimer architecture must be designed upfront, not added as an afterthought.

---

## Moderate Pitfalls

Mistakes that cause significant rework or user-facing bugs.

---

### Pitfall 6: EXIF GPS Coordinates Are Not Always Decimal Degrees

**What goes wrong:** EXIF stores GPS coordinates in Degrees/Minutes/Seconds (DMS) as rational numbers (numerator/denominator pairs), plus a hemisphere reference (N/S/E/W). Android cameras write the values as `{degrees}/{denominator},{minutes}/{denominator},{seconds}/{divisor}` which requires specific parsing. If hemisphere reference is `S` or `W` and the decimal is not negated, the pin appears in the wrong hemisphere.

**Why it happens:** Most EXIF parsing tutorials show the happy path. Edge cases include: missing `GPSLatitudeRef`/`GPSLongitudeRef` fields, zero-denominator rational numbers, GPS altitude stored with different precision, and fully missing GPS block.

**Consequences:** Mushroom pins appear at wrong coordinates — mirrored across equator or prime meridian. App appears broken; user's data is quietly corrupted.

**Prevention:**
- Always check `GPSLatitudeRef` and `GPSLongitudeRef`; negate the decimal if `S` or `W`.
- Guard against division by zero on denominator values.
- Validate that parsed coordinates are geographically plausible (latitude -90 to 90, longitude -180 to 180).
- If GPS block is present but any required subfield is missing, fall back to manual entry rather than showing 0,0.
- Use a well-maintained EXIF library (e.g., `exifr` on JS side, or `kamadak-exif` / `rexiv2` on Rust side) rather than hand-rolling the parser.

**Detection:** Test with photos from Android (Kotlin-format DMS), iPhone (standard EXIF), and a camera with no GPS. Verify pin placement against known locations.

**Phase:** Phase 2 (import pipeline) — write tests for all three GPS formats before building the UI.

---

### Pitfall 7: EXIF Dates Have No Timezone Information

**What goes wrong:** `DateTimeOriginal` in EXIF is a naive local timestamp with no timezone offset. A photo taken in Croatia (UTC+2) at 14:00 is stored as `2024:05:10 14:00:00` — the same string as a photo taken in the UK at 14:00. When sorting by date or grouping by day, photos from different timezones appear in wrong order.

**Why it happens:** The EXIF standard historically lacked a timezone field. `OffsetTimeOriginal` was added later and most cameras (especially older DSLRs and basic Android phones) do not write it. iPhones do write it for GPS-tagged photos.

**Consequences:** The seasonal calendar and per-date grouping show incorrect date distribution. A mushroom found at 23:30 Croatia time might appear under the next day's group when treated as UTC.

**Prevention:**
- Store timestamps as-is (naive local time) in SQLite, alongside a separate nullable `timezone_offset` column.
- For the Croatia-focused audience, this is a minor issue (most users are in the same timezone). Do not attempt to infer timezone from GPS coordinates in v1 — it requires a reverse-geocoding timezone lookup which adds complexity.
- Display dates without timezone conversion in the UI. Document the behavior.
- If `OffsetTimeOriginal` is present in EXIF, use it. Otherwise, store the naive time and accept the edge case.

**Detection:** Import a set of photos with known capture times and verify sorting order.

**Phase:** Phase 2 (import pipeline) — design the schema with timezone in mind from the start, even if the field starts as NULL.

---

### Pitfall 8: Windows Path Separators Break File Organization

**What goes wrong:** Rust's `std::path::PathBuf` handles Windows paths natively with backslash separators. The Tauri dialog API's `defaultPath` parameter requires backslashes on Windows — forward slashes cause the dialog to open in the default directory instead. When path strings are passed across the IPC boundary as JSON strings (JS → Rust), a mismatch in separator expectation can cause `file not found` errors.

**Why it happens:** JavaScript strings use forward slashes by convention. Rust's `PathBuf` uses the OS-native separator. When paths are built by string concatenation rather than through `PathBuf`, the separators diverge.

**Consequences:** File copy operations silently fail. Dialog opens in wrong location, confusing users. Folder structure creation fails on Windows where forward-slash paths are rejected by some Win32 APIs.

**Prevention:**
- Never build file paths by string concatenation. Always use `std::path::PathBuf` and `.join()` in Rust.
- When receiving a path from the frontend, pass it through `PathBuf::from()` on the Rust side before any file operations.
- When sending a path to the frontend, use `.to_string_lossy()` — this converts to the OS-native representation.
- For the dialog `defaultPath`, construct the path in Rust and send it to the frontend already formatted correctly.
- Test file operations specifically on Windows (not just macOS/Linux during development).

**Detection:** File not found errors only on Windows. Dialog opens in wrong default folder.

**Phase:** Phase 2 (import pipeline) — cross-platform path handling should be in the first Rust file I/O code written.

---

### Pitfall 9: Duplicate Photo Detection Is Harder Than It Looks

**What goes wrong:** A user imports the same folder twice (intentionally, to re-sync after adding new photos). The app creates duplicate entries for every existing photo instead of only adding new ones.

**Why it happens:** Simple filename-based deduplication breaks if the user renames files, copies them to a different folder, or imports from a different copy of the same photo. File mtime also changes when copied.

**Consequences:** Collection doubles in size silently. Stats are wrong. Map shows duplicate pins. User has to manually clean up.

**Prevention:**
- Generate a content hash (SHA-256 of the first 64KB + file size) at import time; store it in SQLite. Re-import checks this hash first.
- A full-file SHA-256 is the gold standard but too slow for large photos (10MB+) in real-time. A partial hash (first 64KB + total size) is fast and sufficient for deduplication within a personal collection.
- Do NOT use filename alone for deduplication. Do NOT use file path alone.
- Store `imported_at` timestamp and `source_path` to help users understand where a record came from.
- On re-import, show the user a count: "X new finds added, Y duplicates skipped."

**Detection:** Import the same folder twice and verify record count does not increase.

**Phase:** Phase 2 (import pipeline) — deduplication strategy must be designed into the schema before writing import code.

---

### Pitfall 10: Tauri's New ACL Permissions System Is Easy to Misconfigure

**What goes wrong:** Tauri 2 replaced the v1 allowlist with a capability-based ACL system. Every file system operation, dialog, and shell command must be explicitly granted in a `capabilities/*.json` file. A missing permission silently denies the operation at runtime — the frontend receives a vague error, not a clear "permission denied" message.

**Why it happens:** The new system is more granular but requires more setup. Developers test in `tauri dev` (which may have broader defaults) and find production builds missing permissions they forgot to declare. The `fs:allow-read-recursive` vs `fs:read-all` distinction is not obvious.

**Consequences:** File picker opens but reading the selected file fails. Import works in dev, breaks in production build. Users see "Error: not allowed" with no actionable guidance.

**Prevention:**
- Read the Tauri v2 permissions docs carefully before implementing any file I/O. `https://v2.tauri.app/security/permissions/`
- Test production builds (`tauri build`) from day one — do not rely solely on `tauri dev`.
- Separate capability files by category (filesystem, dialogs) as recommended by official docs.
- Grant the minimum necessary permissions: use `fs:allow-read` scoped to user-selected directories, not global `fs:read-all`.
- Log capability errors clearly: wrap Tauri command errors on the JS side with explicit messages.

**Detection:** Features work in `tauri dev` but fail in `tauri build`. Check browser console in production for IPC errors.

**Phase:** Phase 1 (project scaffold) — get capability files configured correctly at the start, then expand as needed.

---

### Pitfall 11: WebView2 Is Not Guaranteed to Be Installed on Target Windows Machines

**What goes wrong:** Tauri on Windows requires the WebView2 runtime, which is bundled with Windows 11 and included in Windows 10 updates since late 2021. However, some Windows 10 machines (especially corporate or heavily-managed environments) may not have it. The default Tauri installer attempts to download WebView2 at install time, which fails silently in offline or restricted environments.

**Why it happens:** The default `webviewInstallMode` is `downloadBootstrapper`, which requires internet access during installation.

**Consequences:** App fails to launch after successful-looking installation. User sees a blank window or WebView2 error. Support burden increases.

**Prevention:**
- Use `webviewInstallMode: "offlineInstaller"` in `tauri.conf.json` — this bundles the WebView2 offline installer (~127MB larger).
- Or use `fixedRuntime` to bundle a specific WebView2 version (~180MB larger) for maximum reproducibility.
- For the target audience (Croatian foragers distributing among friends), offline installer is the safer choice.
- Document the installer size tradeoff in project decisions.

**Detection:** Install the app on a fresh Windows 10 VM with no internet access and verify it launches.

**Phase:** Phase 4 (distribution) — but choose the bundling strategy early so installer size affects distribution planning.

---

### Pitfall 12: Windows Defender / Antivirus Flags Unsigned Tauri Installers

**What goes wrong:** Unsigned Tauri `.exe` installers (NSIS) are consistently flagged as malware by Windows Defender and third-party antivirus products. This is a documented, known NSIS upstream issue unrelated to the app's actual code. Even `.msi` installers sometimes trigger SmartScreen warnings.

**Why it happens:** NSIS plugins bundled in the installer are not individually signed. Unknown publisher + NSIS packing pattern = heuristic malware detection. Windows SmartScreen also blocks unsigned executables downloaded from the browser.

**Consequences:** Users see a red "Windows protected your PC" SmartScreen warning and must click "Run anyway." Many users will not do this. Some antivirus products quarantine the installer entirely.

**Prevention:**
- Sign the app with a code signing certificate (EV certificate removes SmartScreen warnings entirely; standard OV/DV certificates reduce but do not eliminate them).
- For early distribution among trusted users (Croatia forager community), provide SHA-256 hash of the installer for manual verification and instructions to bypass SmartScreen.
- Use `.msi` format rather than NSIS `.exe` — it triggers fewer false positives.
- If distributing more broadly, budget for code signing (~$200-500/year for an OV certificate).

**Detection:** Download the installer from a browser on a fresh Windows machine and observe SmartScreen behavior.

**Phase:** Phase 4 (distribution) — plan for this before the first public release.

---

## Minor Pitfalls

Annoyances that create polish debt or require small fixes.

---

### Pitfall 13: Leaflet Map Performance Degrades with 500+ Unclustered Markers

**What goes wrong:** Leaflet renders each map marker as a separate DOM element. At 500+ markers (achievable for an active forager over several years), panning and zooming become noticeably sluggish, and initial map render is slow.

**Prevention:**
- Use `Leaflet.markercluster` (via `react-leaflet-cluster`) from the first implementation — it handles 10,000+ markers with no perceptible lag.
- Only load markers for the current visible map bounds (viewport culling).
- Lazy-load marker data: fetch from SQLite only after map initializes, show a loading indicator.

**Phase:** Phase 2 (map) — use clustering in the initial implementation, not as an optimization added later.

---

### Pitfall 14: Thumbnail Generation Blocks the UI Thread

**What goes wrong:** Generating thumbnails for 50+ imported photos synchronously on the Rust side blocks the Tauri command and freezes the UI. A 10MB smartphone photo resized via the `image` crate takes ~200ms; 50 photos = 10 seconds of UI freeze.

**Prevention:**
- Run thumbnail generation in a Tokio `spawn_blocking` task (CPU-bound work off the async executor).
- Emit progress events to the frontend using Tauri's event system (`app.emit("import_progress", ...)`) so the user sees incremental updates.
- Generate thumbnails at a fixed size (e.g., 300×300 px JPEG at 80% quality) at import time; never resize on-the-fly during rendering.
- Store thumbnail paths in SQLite; render `<img src="asset://...">` in the UI.

**Phase:** Phase 2 (import pipeline) — async import with progress reporting must be designed in from the start.

---

### Pitfall 15: Species Data Copyright and Attribution

**What goes wrong:** Species descriptions, habitat data, and edibility information sourced from external databases (Wikipedia, iNaturalist, GBIF, Plants for a Future) have license terms that require attribution or restrict commercial use.

**Prevention:**
- Write original descriptions for the Croatian/European species in the bundled database, based on multiple sources but not copied verbatim.
- If sourcing from Wikipedia, the CC BY-SA license requires attribution and derivative works to carry the same license.
- GBIF data is CC BY 4.0 or CC0 — attribution required for BY.
- Include a "Data Sources" section in the app's About screen listing species data attribution.
- For the initial 50-100 Croatian species, hand-curated original text is feasible and legally cleanest.

**Phase:** Phase 3 (species database content) — review license terms before writing data entry code.

---

### Pitfall 16: Photo Copy vs. Move Confusion During Import

**What goes wrong:** When the user imports photos into the organized `Location/Date/` folder structure, it is not clear whether the originals are copied (safe) or moved (originals lost). If photos are moved and the operation is interrupted, the user has partially-imported photos with originals deleted.

**Prevention:**
- Always copy, never move, as the default import behavior. Offer "move originals" as an explicit opt-in with a clear warning.
- Make copy operations atomic where possible: write to a temp file in the destination directory, then rename (rename is atomic on the same filesystem/volume).
- On import failure, clean up partial copies; do not leave half-written files.
- Show the user exactly what will happen before confirming: "X photos will be copied to [path]".

**Phase:** Phase 2 (import pipeline).

---

### Pitfall 17: SQLite Database File Location Confusion

**What goes wrong:** If the SQLite database is stored in the app's install directory (`C:\Program Files\...`), writes fail on standard Windows installations due to UAC restrictions. If it is stored in a hardcoded path rather than via Tauri's `app_data_dir()`, the path differs per user and fails in multi-user Windows environments.

**Prevention:**
- Always use `app_handle.path().app_data_dir()` (Tauri v2 path API) to resolve the database path. This returns `C:\Users\[user]\AppData\Roaming\[bundle-id]\` which is always user-writable.
- Never hardcode paths like `C:\Users\ivan\...` or relative paths like `./data/mushrooms.db`.
- Store the user's chosen "mushroom data folder" (for photos) separately from the SQLite metadata database — the photos folder is user-configurable, the DB is always in AppData.

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
