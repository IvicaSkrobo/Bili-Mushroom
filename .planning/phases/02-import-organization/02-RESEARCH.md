# Phase 2: Import & Organization - Research

**Researched:** 2026-04-09
**Domain:** Tauri 2 Rust commands, EXIF parsing, file I/O, SQLite migration, React import UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
1. **Database Schema** — `finds` table: `id INTEGER PRIMARY KEY`, `photo_path TEXT` (relative), `original_filename TEXT`, `species_name TEXT`, `date_found TEXT` (ISO date), `country TEXT`, `region TEXT`, `lat REAL`, `lng REAL`, `notes TEXT`, `created_at TEXT`
2. **EXIF Parsing** — Rust Tauri command `parse_exif` using `kamadak-exif`. Returns `{ date: Option<String>, lat: Option<f64>, lng: Option<f64> }`
3. **Import UI Flow** — Single screen in CollectionTab: Import Photos button → file/folder picker → scrollable preview list (one card per photo, all fields editable) → Import All confirm
4. **Location Input (No GPS)** — Country + Region text fields + optional Lat/Lng numerics in preview card. Map picker deferred to Phase 3
5. **File Organization Path** — `<StorageRoot>/<Country>/<Region>/<YYYY-MM-DD>/<species>_<YYYY-MM-DD>_<seq><ext>`. Falls back to `unknown_country/unknown_region` if empty
6. **Duplicate Detection** — `original_filename` + `date_found` match in `finds` table. Duplicates silently skipped; count shown in completion toast
7. **Rust vs JS for File Copy** — Single Rust command `import_find(payload)` handles EXIF, path resolution, file copy+rename, and DB insert atomically
8. **Batch Progress** — Sequential in Rust; progress emitted via `app.emit("import-progress", { current, total, filename })`
9. **Species Name at Import** — Free-text input in preview card. No species DB lookup (Phase 4)

### Claude's Discretion
- Card UI component selection within existing shadcn/ui components (Card, Input, Button, Progress)
- TanStack Query key and invalidation strategy for `get_finds`
- Thumbnail display method (convertFileSrc asset protocol vs base64)
- Exact filename sanitization approach for species/country/region values
- Error handling granularity in the progress toast (per-file errors vs summary)

### Deferred Ideas (OUT OF SCOPE)
- Map-based location picker (Phase 3)
- Species autocomplete from built-in DB (Phase 4)
- Parallel/chunked import for large batches (v2)
- File hash-based duplicate detection (v2)
- Move/copy prompt when changing storage folder (SettingsDialog TODO)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMP-01 | User can import all photos from a chosen folder at once | dialog `open({ directory: true })` → Rust command iterates directory |
| IMP-02 | User can add a single photo at a time via file picker | dialog `open({ multiple: true, filters: [image exts] })` |
| IMP-03 | App auto-reads date from EXIF; falls back to filename parsing, then manual entry | kamadak-exif `Tag::DateTimeOriginal`; regex on filename; manual input in preview card |
| IMP-04 | App auto-reads GPS from EXIF if available; falls back to manual location | kamadak-exif `Tag::GPSLatitude/Ref/Longitude/Ref`; DMS-to-decimal conversion; text fields in card |
| IMP-05 | App shows preview of detected metadata before confirming import | Preview card list with editable fields rendered before `import_find` is called |
| ORG-01 | App copies and organizes files into Location → Date folder structure | `std::fs::create_dir_all` + `std::fs::copy` in Rust; path built from Country/Region/date |
| ORG-03 | App renames photos on import using mushroom name + date pattern | filename = `{species}_{YYYY-MM-DD}_{seq:03}{ext}` with sanitized components |
| ORG-04 | User can edit location, date, and name of any find after import | Edit dialog/inline form for existing find cards; `update_find(id, payload)` Rust command |
</phase_requirements>

---

## Summary

Phase 2 wires together four interconnected concerns: EXIF metadata extraction in Rust, a preview-and-edit UI in React, atomic file copy + DB insert in Rust, and a post-import find list. All heavy I/O stays in Rust Tauri commands — the pattern established in Phase 1 — with React handling presentation state only.

The critical integration point is `kamadak-exif`'s GPS rational-to-decimal-degrees conversion: GPS coordinates are stored as three `Rational` values (degrees, minutes, seconds) plus a direction reference string (`N`/`S`, `E`/`W`). This conversion must happen in Rust before the payload is returned to TypeScript. The planner should allocate specific task time to this math.

Photo thumbnails in the preview list must use Tauri's `convertFileSrc` / asset protocol because WebView2 cannot load `file://` paths directly. HEIC files (from iPhones) are supported by kamadak-exif for EXIF extraction, but WebView2 on Windows cannot display HEIC natively — a JPEG thumbnail must be generated or the thumbnail must be skipped for HEIC files.

**Primary recommendation:** Three Rust commands (`parse_exif`, `import_find`, `get_finds`), one migration file (`0002_finds.sql`), and one replacement for `CollectionTab.tsx`. Keep `import_find` synchronous per file inside an async command; emit events after each file completes.

---

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@tauri-apps/api` | 2.10.1 | `invoke`, `listen`, `convertFileSrc` | Installed [VERIFIED: npm list] |
| `@tauri-apps/plugin-dialog` | 2.7.0 | File + folder picker | Installed [VERIFIED: npm list] |
| `@tauri-apps/plugin-sql` | 2.4.0 | SQLite from JS (migrations) | Installed [VERIFIED: npm list] |
| `@tanstack/react-query` | 5.x | `get_finds` caching + invalidation | Installed [VERIFIED: package.json] |
| `zustand` | 5.x | `appStore` for storagePath | Installed [VERIFIED: package.json] |

### Must Add — Rust
| Crate | Version | Purpose | Why |
|-------|---------|---------|-----|
| `kamadak-exif` | `"0.6"` | EXIF GPS + date parsing | Pure Rust, supports JPEG/HEIF/PNG/WebP [CITED: CLAUDE.md] |
| `tauri-plugin-fs` | `"2"` | `std::fs` access + dir listing from Rust | Needed for directory iteration [ASSUMED] |

**Cargo.toml addition:**
```toml
kamadak-exif = "0.6"
```

`tauri-plugin-fs` may not be needed if directory traversal is done with `std::fs::read_dir` directly in the Rust command. `std::fs` is always available in Rust — no plugin needed for server-side file ops.

### Must Add — Frontend
| Package | Purpose | Install |
|---------|---------|---------|
| `@tauri-apps/api/mocks` | Vitest mockIPC for invoke tests | Already in `@tauri-apps/api` [VERIFIED: v2.tauri.app/develop/tests/mocking/] |

No additional npm packages needed for Phase 2. shadcn/ui Card, Input, Progress, and Badge components will be added via the shadcn CLI if not already present.

**shadcn additions:**
```bash
npx shadcn@latest add card input progress badge textarea
```

---

## Architecture Patterns

### Recommended Project Structure (Phase 2 additions)
```
src-tauri/
├── src/
│   ├── commands/          # NEW — one file per command group
│   │   ├── exif.rs        # parse_exif command
│   │   └── import.rs      # import_find, get_finds, update_find
│   └── lib.rs             # register commands in invoke_handler
├── migrations/
│   ├── 0001_initial.sql   # existing
│   └── 0002_finds.sql     # NEW — finds table

src/
├── tabs/
│   └── CollectionTab.tsx  # Phase 2 replaces content
├── components/
│   ├── import/            # NEW
│   │   ├── ImportPreviewCard.tsx   # per-photo editable card
│   │   ├── ImportPreviewList.tsx   # scrollable list + Import All button
│   │   └── FindCard.tsx            # read-only card for post-import list
│   └── dialogs/           # existing, no changes needed
├── lib/
│   ├── db.ts              # existing, no changes
│   └── finds.ts           # NEW — TypeScript types + invoke wrappers
└── test/
    └── tauri-mocks.ts     # extend with invoke mock for new commands
```

### Pattern 1: Rust Command Registration
**What:** All Tauri commands must be registered in `lib.rs` via `invoke_handler`.
**When to use:** Every new `#[tauri::command]` function.
**Example:**
```rust
// src-tauri/src/lib.rs
mod commands;

pub fn run() {
    let migrations = vec![
        Migration { version: 1, ... },
        Migration {
            version: 2,
            description: "create_finds_table",
            sql: include_str!("../migrations/0002_finds.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(SqlBuilder::default()
            .add_migrations("sqlite:bili-mushroom.db", migrations)
            .build())
        .invoke_handler(tauri::generate_handler![
            commands::exif::parse_exif,
            commands::import::import_find,
            commands::import::get_finds,
            commands::import::update_find,
        ])
        .setup(|_app| Ok(()))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```
[CITED: v2.tauri.app/develop/calling-rust/]

### Pattern 2: Async Rust Command with Event Emission
**What:** Use `AppHandle` parameter + `use tauri::Emitter` to emit progress events.
**When to use:** Any long-running Rust command (batch import).
**Example:**
```rust
// src-tauri/src/commands/import.rs
use tauri::{AppHandle, Emitter};
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct ImportProgress {
    pub current: usize,
    pub total: usize,
    pub filename: String,
}

#[tauri::command]
pub async fn import_find(
    app: AppHandle,
    payloads: Vec<ImportPayload>,
) -> Result<ImportSummary, String> {
    let total = payloads.len();
    for (i, payload) in payloads.iter().enumerate() {
        // ... process file ...
        app.emit("import-progress", ImportProgress {
            current: i + 1,
            total,
            filename: payload.original_filename.clone(),
        }).map_err(|e| e.to_string())?;
    }
    Ok(ImportSummary { imported, skipped })
}
```
[CITED: v2.tauri.app/develop/calling-frontend/]

**Frontend listen pattern:**
```typescript
// src/tabs/CollectionTab.tsx
import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';

useEffect(() => {
    const unlisten = listen<{ current: number; total: number; filename: string }>(
        'import-progress',
        (event) => setProgress(event.payload)
    );
    return () => { unlisten.then(fn => fn()); };
}, []);
```
[CITED: v2.tauri.app/develop/calling-frontend/]

### Pattern 3: kamadak-exif GPS Extraction
**What:** GPS DMS rationals to decimal degrees conversion in Rust.
**When to use:** `parse_exif` command.
**Example:**
```rust
use exif::{In, Reader, Tag};
use std::io::BufReader;

fn dms_to_decimal(field: &exif::Field) -> Option<f64> {
    if let exif::Value::Rational(ref rationals) = field.value {
        if rationals.len() < 3 { return None; }
        let deg = rationals[0].to_f64();
        let min = rationals[1].to_f64();
        let sec = rationals[2].to_f64();
        Some(deg + min / 60.0 + sec / 3600.0)
    } else {
        None
    }
}

pub fn extract_exif(path: &str) -> ExifResult {
    let file = std::fs::File::open(path).ok()?;
    let mut buf = BufReader::new(&file);
    let exif = exif::Reader::new().read_from_container(&mut buf).ok()?;

    // GPS Latitude
    let lat = exif.get_field(Tag::GPSLatitude, In::PRIMARY)
        .and_then(|f| dms_to_decimal(f));
    let lat_ref = exif.get_field(Tag::GPSLatitudeRef, In::PRIMARY)
        .and_then(|f| f.display_value().to_string().trim().chars().next())
        .unwrap_or('N');
    let lat = lat.map(|v| if lat_ref == 'S' { -v } else { v });

    // GPS Longitude
    let lng = exif.get_field(Tag::GPSLongitude, In::PRIMARY)
        .and_then(|f| dms_to_decimal(f));
    let lng_ref = exif.get_field(Tag::GPSLongitudeRef, In::PRIMARY)
        .and_then(|f| f.display_value().to_string().trim().chars().next())
        .unwrap_or('E');
    let lng = lng.map(|v| if lng_ref == 'W' { -v } else { v });

    // Date
    let date = exif.get_field(Tag::DateTimeOriginal, In::PRIMARY)
        .map(|f| f.display_value().to_string());  // format: "2024:05:10 14:23:00"

    ExifResult { date, lat, lng }
}
```
[VERIFIED: docs.rs/kamadak-exif — Tag::GPSLatitude, Tag::GPSLatitudeRef, Tag::GPSLongitude, Tag::GPSLongitudeRef, Tag::DateTimeOriginal confirmed as associated constants on Tag struct]

**Date string normalization:** kamadak-exif `DateTimeOriginal` returns `"2024:05:10 14:23:00"` (colons in date portion). Must convert to ISO `"2024-05-10"` before storing.

### Pattern 4: File Path Construction (Windows-safe)
**What:** Use `std::path::PathBuf` and `push()` — never string concatenation.
**When to use:** All file path operations in Rust.
**Example:**
```rust
use std::path::PathBuf;

fn build_dest_path(
    storage_root: &str,
    country: &str,
    region: &str,
    date: &str,       // "2024-05-10"
    species: &str,
    seq: u32,
    ext: &str,        // ".jpg"
) -> PathBuf {
    let country = sanitize_path_component(country);
    let region = sanitize_path_component(region);
    let species = sanitize_path_component(species);
    let filename = format!("{}_{}_{:03}{}", species, date, seq, ext);
    let mut path = PathBuf::from(storage_root);
    path.push(&country);
    path.push(&region);
    path.push(date);
    path.push(&filename);
    path
}

fn sanitize_path_component(s: &str) -> String {
    // Replace Windows-illegal chars: \ / : * ? " < > |
    // Also collapse spaces to underscores for cleaner filenames
    s.chars()
        .map(|c| match c {
            '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            ' ' => '_',
            c => c,
        })
        .collect::<String>()
        .trim_matches('_')
        .to_string()
}
```
[VERIFIED: Known Windows illegal filename characters; PathBuf is Rust stdlib]

### Pattern 5: Sequence Number Resolution
**What:** Count existing files in the destination folder to derive the next sequence number.
**When to use:** Inside `import_find` before copying.
**Example:**
```rust
fn next_seq_for_folder(folder: &PathBuf) -> u32 {
    if !folder.exists() { return 1; }
    std::fs::read_dir(folder)
        .map(|entries| entries.count() as u32 + 1)
        .unwrap_or(1)
}
```
[ASSUMED — no official source; straightforward std::fs approach]

### Pattern 6: Duplicate Detection SQL
**What:** Check `finds` table before inserting.
**When to use:** Start of each per-file import in `import_find`.
**SQL:**
```sql
SELECT COUNT(*) as cnt FROM finds
WHERE original_filename = ?1 AND date_found = ?2
```
If `cnt > 0`, skip and increment skipped counter.

### Pattern 7: Displaying Local Photos (convertFileSrc)
**What:** WebView2 cannot load `file://` paths. Use `convertFileSrc` to get a `http://asset.localhost/...` URL.
**When to use:** Any `<img>` that shows a local file in the preview or find list.
**Frontend:**
```typescript
import { convertFileSrc } from '@tauri-apps/api/core';
const src = convertFileSrc('/absolute/path/to/photo.jpg');
// <img src={src} />
```
**Required tauri.conf.json addition:**
```json
"app": {
  "security": {
    "csp": "default-src 'self' ipc: http://ipc.localhost; img-src 'self' asset: http://asset.localhost blob:",
    "assetProtocol": {
      "enable": true,
      "scope": ["$APPDATA/**", "$HOME/**"]
    }
  }
}
```
[CITED: github.com/orgs/tauri-apps/discussions/11498]

**Important:** The `scope` must cover `StorageRoot`. Since StorageRoot is user-chosen, use `"$HOME/**"` as a broad scope or dynamically set it — research showed `$HOME/**` is the safe broad scope for desktop use.

### Pattern 8: TanStack Query for `get_finds`
**What:** Cache find list and invalidate after import.
**When to use:** CollectionTab for the post-import find list.
**Example:**
```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '@/stores/appStore';

function useFinds() {
    const storagePath = useAppStore(s => s.storagePath);
    return useQuery({
        queryKey: ['finds', storagePath],
        queryFn: () => invoke<Find[]>('get_finds', { storageFolderPath: storagePath }),
        enabled: !!storagePath,
    });
}

// After import completes:
const qc = useQueryClient();
qc.invalidateQueries({ queryKey: ['finds'] });
```
[VERIFIED: TanStack Query v5 docs pattern — @tanstack/react-query installed at ^5]

### Anti-Patterns to Avoid
- **String path concatenation in Rust:** Use `PathBuf::push()` — backslash/forward slash normalization is handled automatically.
- **Calling `db.execute()` from JS for import:** The locked decision is single Rust command `import_find` — no JS DB writes during import.
- **`file://` in `<img src>` directly:** WebView2 blocks it. Always use `convertFileSrc`.
- **Parsing date strings with manual string splitting:** Use `chrono` crate or simple Rust string replacement to convert `"2024:05:10 14:23:00"` → `"2024-05-10"`.
- **Re-registering `add_migrations` with new key:** The migration key in `lib.rs` must remain `"sqlite:bili-mushroom.db"` — do not change it when adding migration version 2.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| EXIF GPS parsing | Custom byte parser | `kamadak-exif` crate | GPS DMS encoding, rational arithmetic, IFD traversal are extremely fiddly |
| Filename sanitization for Windows | Ad-hoc char replacement | `sanitize-filename` crate (optional) OR explicit char blacklist | Windows has 9 illegal chars + reserved names (CON, PRN, etc.) |
| Date formatting | Manual string slicing | Simple Rust string replace (`replace(':', '-').take(10)`) on DateTimeOriginal output | Simple enough; adding `chrono` is overkill for one date |
| Duplicate check | SHA-256 hash of file content | `original_filename + date_found` SQL check (locked decision) | Hash requires reading whole file; filename+date is sufficient for Phase 2 |
| Progress UI | Custom progress bar | shadcn/ui `Progress` component | Accessible, styled, already matches app design |
| IPC event subscription cleanup | Manual array of unlisten fns | `useEffect` returning unlisten cleanup | Prevents event listener leaks across re-renders |

**Key insight:** In EXIF, GPS coordinates are stored as unsigned rationals (always positive) — the direction reference (`N`/`S`, `E`/`W`) determines sign. Forgetting this produces wrong coordinates that appear correct for Northern/Eastern hemisphere (Croatia) but fail elsewhere.

---

## DB Migration

### `0002_finds.sql`
```sql
-- Phase 2: Finds table
CREATE TABLE IF NOT EXISTS finds (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_path      TEXT NOT NULL,       -- relative path within StorageRoot
    original_filename TEXT NOT NULL,
    species_name    TEXT NOT NULL DEFAULT '',
    date_found      TEXT NOT NULL,       -- ISO date: YYYY-MM-DD
    country         TEXT NOT NULL DEFAULT '',
    region          TEXT NOT NULL DEFAULT '',
    lat             REAL,
    lng             REAL,
    notes           TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL        -- ISO datetime: YYYY-MM-DDTHH:MM:SSZ
);

CREATE INDEX IF NOT EXISTS idx_finds_date ON finds(date_found);
CREATE INDEX IF NOT EXISTS idx_finds_original_filename ON finds(original_filename);
INSERT OR IGNORE INTO app_metadata (key, value) VALUES ('schema_version', '2');
```

**Registration in `lib.rs`:** Add version 2 Migration struct alongside the existing version 1:
```rust
Migration {
    version: 2,
    description: "create_finds_table",
    sql: include_str!("../migrations/0002_finds.sql"),
    kind: MigrationKind::Up,
},
```

**Critical note:** `tauri-plugin-sql` runs migrations in version order. Existing users with only migration 1 will have migration 2 applied on next launch. This is the designed behavior — no manual intervention needed. [CITED: v2.tauri.app/plugin/sql/]

---

## Common Pitfalls

### Pitfall 1: DateTimeOriginal Colon-in-Date Format
**What goes wrong:** kamadak-exif returns `"2024:05:10 14:23:00"` — storing this as `date_found` breaks date sorting and ISO date comparisons.
**Why it happens:** The EXIF spec uses colons in the date component, unlike ISO 8601.
**How to avoid:** After extracting, convert: `date_str[0..10].replace(':', "-")` in Rust before returning to frontend.
**Warning signs:** Dates appear correct visually but SQLite `date_found > '2024-01-01'` queries return no rows.

### Pitfall 2: HEIC Thumbnails Break on Windows WebView2
**What goes wrong:** iPhone users import `.heic` files. kamadak-exif can parse EXIF from HEIC (supported format). But `convertFileSrc` of a `.heic` file will show a broken image in WebView2 because HEIC requires the optional Windows HEIF Extension codec.
**Why it happens:** WebView2 delegates image decoding to the Windows Imaging Component (WIC). HEIC requires the HEIF Image Extensions (a separate Microsoft Store install) which foragers may not have.
**How to avoid:** In the preview card, detect `.heic`/`.HEIC` extension and render a placeholder icon instead of `<img>`. Phase 2 does not do image conversion.
**Warning signs:** Broken image icons for iPhone photos in the preview list.

### Pitfall 3: `add_migrations` Key Must Match DB Load Path
**What goes wrong:** `SqlBuilder::add_migrations("sqlite:bili-mushroom.db", ...)` but `Database.load("sqlite:/absolute/path/bili-mushroom.db")` — migrations only apply when the SQLite URI prefix matches.
**Why it happens:** tauri-plugin-sql matches the migration set to a connection string prefix. Absolute paths from the frontend do not match the bare `"sqlite:bili-mushroom.db"` key.
**How to avoid:** This was noted in Phase 1 research (A2 assumption). The existing pattern has this risk. Verify that migrations are actually applied when opening an absolute-path DB by checking `schema_version` in `app_metadata`.
**Warning signs:** Finds table does not exist at runtime even though migration was added.

### Pitfall 4: Asset Protocol Scope Too Narrow
**What goes wrong:** `convertFileSrc` returns a valid URL but images still fail to load — CSP or asset scope excludes the user's chosen StorageRoot.
**Why it happens:** The asset protocol scope in `tauri.conf.json` must explicitly cover the StorageRoot path. If a user picks `D:\Mushrooms`, a scope of only `$HOME/**` won't cover it.
**How to avoid:** Use a broad scope initially (`["**"]` or the StorageRoot dynamically via Tauri's `assetProtocol` runtime configuration). For Phase 2, use `"$HOME/**", "$DOCUMENT/**", "$DESKTOP/**"` as a safe multi-scope.
**Warning signs:** `<img>` elements return 403 from `http://asset.localhost`.

### Pitfall 5: Sequence Number Race with Concurrent Imports
**What goes wrong:** If two files are imported into the same folder on the same day simultaneously, both might get sequence number 1.
**Why it happens:** Sequence is determined by reading the filesystem directory count — not a DB-managed counter.
**How to avoid:** Phase 2 uses sequential (not parallel) processing (locked decision). This race cannot occur in Phase 2. Document for v2 when parallelism is added.
**Warning signs:** N/A in Phase 2. Would manifest as overwritten files in v2.

### Pitfall 6: Windows Illegal Filename Characters in Species/Country Names
**What goes wrong:** A species name like `Amanita "muscaria"` or country/region with special characters causes `std::fs::copy` to fail with OS error.
**Why it happens:** Windows forbids `\ / : * ? " < > |` in filenames.
**How to avoid:** `sanitize_path_component()` function replaces all illegal characters before path construction. Also handle empty strings → fallback to `"unknown_species"`, `"unknown_country"`, `"unknown_region"`.
**Warning signs:** Import fails with "The filename, directory name, or volume label syntax is incorrect" on Windows.

### Pitfall 7: `listen()` Leak Without Cleanup
**What goes wrong:** Each React render calls `listen('import-progress', ...)` without unsubscribing, causing duplicate handlers and stale state updates.
**Why it happens:** `listen()` returns a Promise<UnlistenFn> — it's not an unsubscribe pattern, it's async.
**How to avoid:** Always use `useEffect` with cleanup:
```typescript
useEffect(() => {
    let unlistenFn: (() => void) | null = null;
    listen('import-progress', handler).then(fn => { unlistenFn = fn; });
    return () => { unlistenFn?.(); };
}, []);
```
**Warning signs:** Progress bar updates multiple times per file; events fire after import completes.

---

## Code Examples

### Invoke Signatures (TypeScript)

```typescript
// src/lib/finds.ts
import { invoke } from '@tauri-apps/api/core';

export interface ExifData {
    date: string | null;  // ISO "2024-05-10" or null
    lat: number | null;
    lng: number | null;
}

export interface Find {
    id: number;
    photo_path: string;
    original_filename: string;
    species_name: string;
    date_found: string;
    country: string;
    region: string;
    lat: number | null;
    lng: number | null;
    notes: string;
    created_at: string;
}

export interface ImportPayload {
    source_path: string;       // absolute path to original file
    original_filename: string;
    species_name: string;
    date_found: string;        // ISO "2024-05-10"
    country: string;
    region: string;
    lat: number | null;
    lng: number | null;
    notes: string;
    storage_folder_path: string;
}

export interface ImportSummary {
    imported: number;
    skipped: number;
}

export interface UpdateFindPayload {
    id: number;
    species_name: string;
    date_found: string;
    country: string;
    region: string;
    lat: number | null;
    lng: number | null;
    notes: string;
}

export const parseExif = (sourcePath: string) =>
    invoke<ExifData>('parse_exif', { sourcePath });

export const importFinds = (payloads: ImportPayload[]) =>
    invoke<ImportSummary>('import_find', { payloads });

export const getFinds = (storageFolderPath: string) =>
    invoke<Find[]>('get_finds', { storageFolderPath });

export const updateFind = (payload: UpdateFindPayload) =>
    invoke<void>('update_find', { payload });
```

### Tauri ACL — Capabilities Addition

The existing `default.json` already has `dialog:allow-open` and `core:event:default`. No new permissions are needed for the Rust commands (`parse_exif`, `import_find`, `get_finds`, `update_find`) because custom commands are allowed by default in Tauri 2.

The asset protocol **does** require `tauri.conf.json` changes (not capabilities JSON):
```json
// src-tauri/tauri.conf.json — modify "app" section
"app": {
  "windows": [...],
  "security": {
    "csp": "default-src 'self' ipc: http://ipc.localhost; img-src 'self' asset: http://asset.localhost blob:",
    "assetProtocol": {
      "enable": true,
      "scope": ["**"]
    }
  }
}
```
[CITED: github.com/orgs/tauri-apps/discussions/11498]

### Vitest Mock Pattern for invoke

```typescript
// Extend src/test/tauri-mocks.ts with invoke mock
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks';

beforeEach(() => {
    mockIPC((cmd, args) => {
        if (cmd === 'parse_exif') {
            return { date: '2024-05-10', lat: 45.5, lng: 14.3 };
        }
        if (cmd === 'get_finds') {
            return [];
        }
        if (cmd === 'import_find') {
            return { imported: 1, skipped: 0 };
        }
    });
});

afterEach(() => {
    clearMocks();
});
```
[CITED: v2.tauri.app/develop/tests/mocking/ — mockIPC from @tauri-apps/api/mocks, version 2.7.0+]

**Note:** `@tauri-apps/api/mocks` is part of `@tauri-apps/api` (2.10.1 installed). No separate install needed.

### Filename Date Fallback Pattern

When EXIF date is absent, attempt to parse from filename:
```rust
fn date_from_filename(filename: &str) -> Option<String> {
    // Matches: IMG_20240510_143200.jpg or 2024-05-10-143200.jpg
    let re = regex::Regex::new(r"(\d{4})[-_]?(\d{2})[-_]?(\d{2})").ok()?;
    let caps = re.captures(filename)?;
    Some(format!("{}-{}-{}", &caps[1], &caps[2], &caps[3]))
}
```
Note: If `regex` crate is not yet a dependency, use simple `find` on known positions or add `regex = "1"` to Cargo.toml.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tauri v1 `window.__TAURI__.invoke` | `import { invoke } from '@tauri-apps/api/core'` | Tauri 2.0 | Different import path |
| Tauri v1 `app.emit_all()` | `app.emit()` with `use tauri::Emitter` | Tauri 2.0 | Trait must be imported |
| `mockIPC` without event support | `mockIPC({ shouldMockEvents: true })` | @tauri-apps/api 2.7.0 | Events can now be tested in Vitest |
| `file://` for local assets | `convertFileSrc` + asset protocol | Tauri 2 WebView2 | Required config in tauri.conf.json |

**Deprecated:**
- `window.emit()` in Rust: replaced by `AppHandle::emit()` via `Emitter` trait in Tauri 2 [CITED: v2.tauri.app/develop/calling-frontend/]
- `tauri::command::CommandItem` manual parsing: replaced by automatic serde deserialization in Tauri 2

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Rust toolchain | Cargo build | ✓ | (macOS dev machine) | — |
| `kamadak-exif` crate | `parse_exif` command | Needs Cargo.toml add | `"0.6"` | None — must add |
| `@tauri-apps/api/mocks` | Vitest invoke tests | ✓ | Part of 2.10.1 | — |
| shadcn Card, Input, Progress | Preview UI | Needs `npx shadcn add` | CLI-managed | — |
| HEIC display in WebView2 | Photo thumbnails | ✗ (optional codec) | N/A | Placeholder icon for HEIC files |

**Missing dependencies with no fallback:**
- `kamadak-exif` in Cargo.toml — must be added before any Rust compilation

**Missing dependencies with fallback:**
- shadcn components (Card, Input, Progress) — add via CLI in Wave 0 setup task
- HEIC thumbnail display — use file-type detection + placeholder icon

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.x (already configured) |
| Config file | `vite.config.ts` (test block present) |
| Quick run command | `npm test` |
| Full suite command | `npm test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMP-01 | Folder selection opens directory picker | Unit | `npm test -- --run CollectionTab` | ❌ Wave 0 |
| IMP-02 | File picker with image filter returns paths | Unit | `npm test -- --run CollectionTab` | ❌ Wave 0 |
| IMP-03a | EXIF date parsed to ISO format | Unit (Rust) | `cargo test -- exif` | ❌ Wave 0 |
| IMP-03b | Filename date fallback regex | Unit (Rust) | `cargo test -- date_from_filename` | ❌ Wave 0 |
| IMP-03c | Manual date entry shown when no EXIF | Unit | `npm test -- --run ImportPreviewCard` | ❌ Wave 0 |
| IMP-04a | GPS DMS-to-decimal conversion | Unit (Rust) | `cargo test -- dms_to_decimal` | ❌ Wave 0 |
| IMP-04b | GPS direction sign applied (S→negative) | Unit (Rust) | `cargo test -- gps_sign` | ❌ Wave 0 |
| IMP-05 | Preview list renders one card per photo | Unit | `npm test -- --run ImportPreviewList` | ❌ Wave 0 |
| ORG-01 | Destination folder created if absent | Unit (Rust) | `cargo test -- build_dest_path` | ❌ Wave 0 |
| ORG-03 | Filename uses species_date_seq pattern | Unit (Rust) | `cargo test -- filename_format` | ❌ Wave 0 |
| ORG-04 | Edit find updates DB row | Unit | `npm test -- --run FindCard` | ❌ Wave 0 |
| DUP-01 | Duplicate filename+date skips, increments count | Unit (Rust) | `cargo test -- duplicate_detection` | ❌ Wave 0 |

**Manual-only (human smoke test required):**
- Actual EXIF reading from a real iPhone JPEG — requires a real photo file
- HEIC file import (EXIF parse succeeds, thumbnail shows placeholder)
- Windows path separator handling with spaces in StorageRoot
- Progress bar updates during batch import of 20+ photos
- convertFileSrc images render in preview list (cannot test in jsdom)

### Sampling Rate
- **Per task commit:** `npm test -- --run` (Vitest, ~5s) + `cargo test` (Rust unit tests)
- **Per wave merge:** full suite green
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps (items that must exist before feature tasks begin)

**Frontend (Vitest):**
- [ ] `src/components/import/ImportPreviewCard.test.tsx` — renders with mock props, editable fields
- [ ] `src/components/import/ImportPreviewList.test.tsx` — import button calls invoke mock
- [ ] `src/components/import/FindCard.test.tsx` — renders find data, edit button opens form
- [ ] `src/tabs/CollectionTab.test.tsx` — replaces existing (currently no test)
- [ ] Extend `src/test/tauri-mocks.ts` with `mockIPC` for `parse_exif`, `get_finds`, `import_find`, `update_find`

**Rust (cargo test):**
- [ ] `src-tauri/src/commands/exif.rs` — unit test module with `dms_to_decimal`, `date_from_filename`, GPS sign tests
- [ ] `src-tauri/src/commands/import.rs` — unit tests for `build_dest_path`, `sanitize_path_component`, `filename_format`

**Infrastructure:**
- [ ] `kamadak-exif = "0.6"` added to `src-tauri/Cargo.toml`
- [ ] `0002_finds.sql` migration file created
- [ ] shadcn Card, Input, Progress, Badge components installed (`npx shadcn@latest add card input progress badge`)
- [ ] `tauri.conf.json` updated with CSP + assetProtocol for `convertFileSrc`

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `tauri-plugin-fs` is not needed for Rust-side directory listing; `std::fs::read_dir` is sufficient | Standard Stack | Low — std::fs always available; plugin would add unnecessary dep |
| A2 | `sanitize-filename` crate is not needed; explicit char blacklist is sufficient for species/country/region | Don't Hand-Roll | Low — 9 Windows illegal chars are well-documented; add crate if edge cases arise |
| A3 | `regex` crate for filename date parsing is acceptable addition OR can be replaced with simple positional parsing | Code Examples | Low — regex crate is standard; positional parsing avoids dependency |
| A4 | Asset protocol scope `["**"]` is acceptable for desktop app (no security concern on single-user local app) | Architecture Patterns | Medium — too broad for multi-user; acceptable for forager's personal app |
| A5 | `migration add_migrations("sqlite:bili-mushroom.db", ...)` applies to absolute-path opened databases | DB Migration | HIGH — this is the Phase 1 Assumption A2 still unverified; if migrations don't apply, finds table won't exist |
| A6 | `mockIPC` from `@tauri-apps/api/mocks` is available in @tauri-apps/api 2.10.1 | Validation Architecture | Low — confirmed as part of @tauri-apps/api package; mocks subpath should be available |
| A7 | Sequential Rust processing (one file at a time) is fast enough for typical batch sizes (10-100 photos) | Architecture Patterns | Low — foragers import one outing at a time; parallelism deferred to v2 |

**Assumption A5 is HIGH RISK:** The migration key matching problem (CONTEXT.md "NOTE: see 01-RESEARCH.md Pitfall 2 / A2") must be verified in Wave 1 before building import logic. If migrations don't apply, add a fallback `CREATE TABLE IF NOT EXISTS finds` check in the `import_find` command.

---

## Open Questions

1. **Migration key matching for absolute-path DB**
   - What we know: `add_migrations("sqlite:bili-mushroom.db", ...)` is the key; frontend opens `sqlite:/absolute/path/bili-mushroom.db`
   - What's unclear: Whether tauri-plugin-sql matches by prefix or exact string
   - Recommendation: Wave 1 task should include a smoke test that reads `SELECT name FROM sqlite_master WHERE type='table' AND name='finds'` after launch to confirm migration applied

2. **`regex` crate dependency for filename date parsing**
   - What we know: Filename date parsing requires pattern matching; `regex` crate adds ~300KB to binary
   - What's unclear: Whether the binary size impact matters for Tauri app distribution
   - Recommendation: Use positional string parsing if filename format is known (IMG_YYYYMMDD); add regex only if multiple formats are needed

3. **Asset protocol scope on Windows with drives other than C:**
   - What we know: `$HOME/**` may not cover `D:\Mushrooms`
   - What's unclear: Which Tauri scope variable covers all Windows drives
   - Recommendation: Use `["**"]` (wildcard) in Phase 2; revisit for security hardening in v1.1

---

## Sources

### Primary (HIGH confidence)
- [CITED: v2.tauri.app/develop/calling-rust/] — Tauri command registration, invoke_handler, AppHandle
- [CITED: v2.tauri.app/develop/calling-frontend/] — app.emit() with Emitter trait, listen() in TypeScript
- [CITED: v2.tauri.app/develop/tests/mocking/] — mockIPC, clearMocks, shouldMockEvents
- [VERIFIED: docs.rs/kamadak-exif/latest] — Tag::GPSLatitude, GPSLatitudeRef, GPSLongitude, GPSLongitudeRef, DateTimeOriginal confirmed as associated constants; formats JPEG/HEIF/PNG/WebP confirmed
- [VERIFIED: npm list] — @tauri-apps/api 2.10.1, @tauri-apps/plugin-dialog 2.7.0, @tauri-apps/plugin-sql 2.4.0
- [VERIFIED: package.json] — @tanstack/react-query ^5, zustand ^5 installed

### Secondary (MEDIUM confidence)
- [CITED: github.com/orgs/tauri-apps/discussions/11498] — convertFileSrc + asset protocol configuration for WebView2
- [CITED: v2.tauri.app/plugin/dialog/] — open() with multiple:true, filters, directory:true; dialog:allow-open capability

### Tertiary (LOW confidence)
- GPS DMS-to-decimal conversion formula — standard math, well-known; not cross-verified with specific kamadak-exif docs
- `next_seq_for_folder` pattern using `read_dir().count()` — [ASSUMED] — straightforward but not from official source
- Asset protocol scope `["**"]` for broad coverage — [ASSUMED] — based on Tauri docs pattern; may need adjustment

---

## Metadata

**Confidence breakdown:**
- Rust kamadak-exif API (Tag names, GPS reading): HIGH — confirmed from docs.rs
- Tauri IPC (commands, emit/listen): HIGH — from official Tauri 2 docs
- DB migration SQL: HIGH — SQLite standard syntax, straightforward
- React UI patterns (TanStack Query, shadcn): HIGH — installed packages, Phase 1 patterns established
- Asset protocol / convertFileSrc: MEDIUM — config pattern confirmed from GitHub discussion, not official docs page
- HEIC on Windows WebView2: MEDIUM — confirmed Windows requires HEIF Extension; WebView2 specifics inferred
- Sequence number implementation: LOW — ASSUMED, no official source

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable ecosystem; Tauri 2.x patch releases won't break these APIs)
