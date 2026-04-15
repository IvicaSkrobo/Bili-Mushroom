# Phase 4: Stats & Export — Research

**Researched:** 2026-04-15
**Domain:** SQLite aggregation queries (Rust/rusqlite), React stats UI (shadcn/ui), PDF generation (@react-pdf/renderer + Comlink Web Worker), CSV export (JS Blob + Tauri FS plugin), Tauri dialog plugin
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Stat cards + simple list layout. No charts in v1.
  - Top section: 4 stat cards — Total Finds, Unique Species, Total Locations Visited, Most Active Month (Claude's discretion)
  - Below cards: two ranked lists — Top Spots (locations by find count) and Best Months (months by find count)
- **D-02:** All metrics derived from personal finds data in SQLite — no external data required.
- **D-03:** Seasonal calendar = personal finds only, built from user's own find dates.
- **D-04:** 12-month grid. Each month cell shows dot/badge indicators for species found that month. Clicking a month reveals the full list of species found in that month.
- **D-05:** Empty state for months with no finds — muted styling, no dots.
- **D-06:** Per-species stats lives within StatsTab as a ranked species section (not in CollectionTab). No cross-tab navigation needed.
- **D-07:** Each species row expandable/clickable: total find count, all locations found, date of first find, best month for this species.
- **D-08:** PDF includes photos + metadata per find. Journal feel (not a spreadsheet). Each find gets a section with photo(s), species name, date, location, notes.
- **D-09:** Full collection export only (no filtered subset in v1). Export button in StatsTab.
- **D-10:** Use `@react-pdf/renderer` + Comlink Web Worker to avoid freezing UI during generation.
- **D-11:** Flat CSV included in v1. Columns: species_name, date_found, country, region, location_note, lat, lng, notes, photo_paths. Full collection only.

### Claude's Discretion

- Exact stat card visual design — Forest Codex amber accent, Playfair Display for numbers, consistent with existing shadcn/ui card style.
- 4th stat card content — Most Active Month (researcher choice).
- PDF page layout — journal-feel, photos prominent. Use `@react-pdf/renderer` JSX components.
- Placement of Export button — StatsTab sticky footer action bar (researcher choice).
- Rust vs JS for CSV generation — JS Blob export is simpler; use Rust only if file size warrants it.

### Deferred Ideas (OUT OF SCOPE)

- Year-end Forager Wrapped (own phase after Phase 4)
- Filtered PDF/CSV export (subset by species/date/location)
- Charts / visualizations (bar charts, pie charts)
- General species season overlay on calendar (requires Species DB — Phase 999.1)

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STA-01 | Stats dashboard showing total finds, unique species count, and total locations visited | Rust aggregation SQL over `finds` table; 3 COUNT/COUNT DISTINCT queries; 4th card = Most Active Month via GROUP BY strftime |
| STA-02 | Dashboard shows top spots (most finds by location) and best months (most finds by month) | Rust GROUP BY country+region+location_note ORDER BY count DESC LIMIT 10; GROUP BY strftime('%m') ORDER BY count DESC |
| STA-03 | Seasonal calendar view showing which species are typically found in each month | Rust query: all (month, species_name) pairs from finds; JS groups by month; 12-month grid in React |
| STA-04 | Per-species stats: total find count, all locations found, date of first find | Rust GROUP BY species_name with subqueries for first find date, locations, best month |
| EXP-01 | User can export collection to PDF report with photos | @react-pdf/renderer 4.5.0 + Comlink 4.4.2; photos via absolute path read as base64 from Tauri FS or asset:// |
| EXP-02 | User can export collection to Excel/CSV | JS Blob + Tauri FS writeTextFile + dialog save(); add fs:allow-write-text-file + dialog:allow-save permissions |

</phase_requirements>

---

## Summary

Phase 4 adds the stats dashboard, seasonal calendar, per-species stats, PDF export, and CSV export to the existing `StatsTab.tsx` (currently an empty state placeholder). All data comes from the existing `finds` + `find_photos` SQLite tables via rusqlite — no schema changes are needed. The established Phase 2 pattern (Rust command → `invoke()` → TanStack Query hook) applies directly to all five new data fetches.

PDF export is the only technically novel piece: `@react-pdf/renderer` v4.5.0 is not yet installed; it runs inside a Comlink Web Worker to prevent UI freeze during generation. Vite 5's native `?worker` import syntax handles worker bundling without config changes. The PDF `<Image>` component needs photos supplied as base64 data URIs (not `asset://` URLs) because the worker thread cannot use Tauri's WebView asset protocol.

CSV export is straightforward: build a CSV string in JS, write to a user-chosen path via `@tauri-apps/plugin-fs` `writeTextFile()` after a `save()` dialog, then show the path in a brief inline confirmation. Two capability permissions must be added to `default.json`: `dialog:allow-save` and `fs:allow-write-text-file`.

**Primary recommendation:** Implement all Rust stat aggregations in a new `src-tauri/src/commands/stats.rs` module, expose five Tauri commands, wire into the invoke handler, add matching TS types + IPC wrappers in `src/lib/stats.ts`, create TanStack Query hooks in `src/hooks/useStats.ts`, then build `StatsTab.tsx` section by section following the UI-SPEC layout contract.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Stat aggregation SQL | Rust / DB | — | Aggregation queries run in Rust via rusqlite; established pattern from Phase 2 |
| Stats data delivery | Rust Tauri commands | — | Five new `invoke()` commands mirror existing `get_finds` pattern |
| Stats UI rendering | Frontend (React) | — | Stat cards, ranked lists, calendar grid, per-species accordion |
| Seasonal calendar logic | Frontend (React) | — | Group (month, species) pairs from Rust response into 12-bucket map in JS |
| PDF generation | Web Worker (JS) | Frontend orchestrates | @react-pdf/renderer inside Comlink worker; main thread stays responsive |
| Photo fetch for PDF | Rust Tauri command | — | Worker cannot use asset:// protocol; needs base64 data from Rust FS read |
| CSV generation | Frontend (JS) | — | Simple string join, no Rust needed for text export |
| CSV file write | Tauri FS plugin | — | `writeTextFile()` after `save()` dialog; JS writes via IPC |
| Export file save dialog | Tauri dialog plugin | — | Already installed; needs `dialog:allow-save` permission added |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| rusqlite | 0.31 (bundled) | SQL aggregation queries in Rust | Already in Cargo.toml; established Phase 2 pattern; direct connection via `open_db()` |
| @tanstack/react-query | 5.x | Async IPC data hooks | Already installed; all Tauri IPC reads go through TQ; `useFinds` is the template |
| zustand | 5.x | `storagePath` access in hooks | Already installed; hooks read `storagePath` from `useAppStore` |
| shadcn/ui (Card, Badge, Button, Dialog, Separator) | current | Stat cards, export buttons, month detail panel | Already installed in `src/components/ui/`; new-york preset active |
| lucide-react | 0.460.0 | ChevronDown/Up, Loader2 spinner | Already installed |
| @react-pdf/renderer | 4.5.0 | PDF document generation | Not yet installed; CLAUDE.md recommended; latest stable 2026-04-15 |
| comlink | 4.4.2 | Web Worker RPC bridge | Not yet installed; CLAUDE.md recommended; latest stable Nov 2024 |
| @tauri-apps/plugin-fs | 2.5.0 | `writeTextFile()` for CSV save | Already installed (read-only permissions); needs write permission added |
| @tauri-apps/plugin-dialog | 2.7.0 | `save()` dialog for export paths | Already installed; needs `dialog:allow-save` permission added |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| chrono | 0.4 | Month name formatting in Rust | Already in Cargo.toml; use for strftime patterns in SQL |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @react-pdf/renderer | printpdf (Rust) | Rust printpdf is low-level; manual photo/layout impractical; react-pdf uses JSX |
| Comlink Web Worker | `usePDF` hook (react-pdf) | `usePDF` runs on main thread; freezes UI for large collections with photos |
| `writeTextFile` + `save()` dialog | `<a download>` Blob URL | `<a download>` does NOT open a native save dialog in Tauri WebView2; user cannot choose destination folder |
| JS Blob `<a download>` | Rust CSV generation | JS string join is sufficient for flat CSV; Rust adds complexity with no benefit at this data size |
| 5 separate Rust commands | Single `get_all_stats` command | Separate commands allow independent TQ caching and partial loading; matches existing command style |

**Installation:**

```bash
npm install @react-pdf/renderer comlink
```

```bash
# No new Cargo deps needed — rusqlite + chrono already present
```

**Version verification:** [VERIFIED: npm registry 2026-04-15] `@react-pdf/renderer@4.5.0` (published 2026-04-15), `comlink@4.4.2` (published 2024-11-07).

---

## Architecture Patterns

### System Architecture Diagram

```
                    User clicks "Stats" tab
                            │
                            ▼
                     StatsTab.tsx
                    (mounts, renders)
                            │
              ┌─────────────┼──────────────┐
              ▼             ▼              ▼
        useStatsCards   useCalendar   useSpeciesStats
        (TQ hook)       (TQ hook)      (TQ hook)
              │             │              │
              └──────────invoke()──────────┘
                            │
                   Rust Tauri Commands
                  (stats.rs module)
                            │
                     rusqlite open_db()
                            │
                   SQLite finds + find_photos
                            │
              ┌─────────────┴──────────────┐
              │   Aggregation results       │
              └──────────invoke()───────────┘
                            │
              ┌─────────────┼──────────────┐
              ▼             ▼              ▼
         Stat Cards   Calendar Grid   Species Rows

              ┌── User clicks "Export PDF" ──┐
              │                             │
              ▼                             │
     exportPdf.ts (orchestrator)            │
              │                             │
              ▼                             │
    new Worker("pdfExport.worker.ts")       │
    Comlink.wrap(worker)                    │
              │                             │
              ▼                             │
    worker: @react-pdf/renderer pdf()       │
              │ needs photo data            │
              ▼                             │
    invoke('read_photos_as_base64')         │
              │ ← base64 strings            │
              ▼                             │
    pdf(<MushroomJournal finds={...}/>)     │
    .toBlob()                               │
              │                             │
              ▼                             │
    blob passed back to main thread         │
    save() dialog → user picks path         │
    writeFile(path, Uint8Array(blob))       │

              ┌── User clicks "Export CSV" ──┐
              │                             │
              ▼                             │
    exportCsv.ts                           │
    build CSV string from finds[]          │
    save() dialog → user picks path        │
    writeTextFile(path, csvString)          │
```

### Recommended Project Structure

```
src/
├── lib/
│   ├── finds.ts         (existing — add no new functions here)
│   └── stats.ts         (NEW — IPC wrappers: getStatsCards, getCalendar, getSpeciesStats, readPhotosAsBase64)
│   └── exportPdf.ts     (NEW — Comlink bridge: createWorker(), generatePdfBlob())
│   └── exportCsv.ts     (NEW — CSV string builder + file write)
├── hooks/
│   └── useStats.ts      (NEW — TanStack Query hooks: useStatsCards, useCalendar, useSpeciesStats)
├── workers/
│   └── pdfExport.worker.ts  (NEW — Comlink.expose({ generatePdf }))
├── components/
│   └── stats/
│       ├── StatCard.tsx          (NEW — single stat card)
│       ├── RankedList.tsx        (NEW — Top Spots + Best Months)
│       ├── SeasonalCalendar.tsx  (NEW — 12-month grid)
│       ├── MonthDetailPanel.tsx  (NEW — expanded month species list)
│       └── SpeciesStatRow.tsx    (NEW — expandable per-species row)
└── tabs/
    └── StatsTab.tsx     (REPLACE empty state with full implementation)

src-tauri/src/commands/
├── stats.rs    (NEW — get_stats_cards, get_calendar, get_species_stats, read_photos_as_base64)
└── mod.rs      (MODIFY — add pub mod stats)
src-tauri/src/
└── lib.rs      (MODIFY — register 4 new commands in invoke_handler)
src-tauri/capabilities/
└── default.json  (MODIFY — add dialog:allow-save, fs:allow-write-text-file)
```

### Pattern 1: Rust Aggregation Command

All five stat commands follow this exact shape — matches existing `get_finds` pattern from `import.rs`.

```rust
// Source: Phase 2 established pattern (src-tauri/src/commands/import.rs)
#[derive(serde::Serialize, Clone, Debug)]
pub struct StatsCards {
    pub total_finds: i64,
    pub unique_species: i64,
    pub locations_visited: i64,
    pub most_active_month: Option<String>,  // "May 2024" or None
}

#[tauri::command]
pub async fn get_stats_cards(storage_path: String) -> Result<StatsCards, String> {
    let conn = open_db(&storage_path)?;
    let total_finds: i64 = conn
        .query_row("SELECT COUNT(*) FROM finds", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let unique_species: i64 = conn
        .query_row("SELECT COUNT(DISTINCT species_name) FROM finds", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let locations_visited: i64 = conn
        .query_row(
            "SELECT COUNT(DISTINCT country || '|' || region || '|' || location_note) FROM finds",
            [], |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    // most_active_month: month+year with highest find count
    let most_active_month: Option<String> = conn
        .query_row(
            "SELECT strftime('%Y-%m', date_found) as ym, COUNT(*) as cnt
             FROM finds GROUP BY ym ORDER BY cnt DESC LIMIT 1",
            [], |r| r.get::<_, String>(0),
        )
        .ok();
    Ok(StatsCards { total_finds, unique_species, locations_visited, most_active_month })
}
```

### Pattern 2: Seasonal Calendar Rust Query

```rust
// Source: CONTEXT.md D-03 + established rusqlite pattern
#[derive(serde::Serialize, Clone, Debug)]
pub struct CalendarEntry {
    pub month: u8,       // 1-12
    pub species_name: String,
    pub date_found: String,
    pub location_note: String,
}

#[tauri::command]
pub async fn get_calendar(storage_path: String) -> Result<Vec<CalendarEntry>, String> {
    let conn = open_db(&storage_path)?;
    let mut stmt = conn.prepare(
        "SELECT CAST(strftime('%m', date_found) AS INTEGER) as month,
                species_name, date_found, location_note
         FROM finds
         ORDER BY month ASC, date_found ASC"
    ).map_err(|e| e.to_string())?;
    // query_map to Vec<CalendarEntry>...
}
```

### Pattern 3: Comlink Web Worker for PDF

```typescript
// Source: Context7 /googlechromelabs/comlink + /diegomura/react-pdf
// src/workers/pdfExport.worker.ts
import * as Comlink from 'comlink';
import { pdf } from '@react-pdf/renderer';
import { MushroomJournal } from './MushroomJournalDocument'; // JSX document component

export interface PdfWorkerApi {
  generatePdf(finds: FindWithBase64Photos[]): Promise<Uint8Array>;
}

const api: PdfWorkerApi = {
  async generatePdf(finds) {
    const blob = await pdf(<MushroomJournal finds={finds} />).toBlob();
    const buf = await blob.arrayBuffer();
    return new Uint8Array(buf);
  },
};

Comlink.expose(api);

// src/lib/exportPdf.ts
import * as Comlink from 'comlink';
import type { PdfWorkerApi } from '@/workers/pdfExport.worker';

export async function generatePdfBlob(finds: FindWithBase64Photos[]): Promise<Uint8Array> {
  // Vite 5 native Web Worker syntax — no vite.config.ts changes needed
  const worker = new Worker(
    new URL('../workers/pdfExport.worker.ts', import.meta.url),
    { type: 'module' }
  );
  const api = Comlink.wrap<PdfWorkerApi>(worker);
  try {
    return await api.generatePdf(finds);
  } finally {
    worker.terminate();
  }
}
```

### Pattern 4: Photo Base64 for PDF

Photos displayed in UI via `convertFileSrc(storagePath + '/' + photo_path)` (asset:// protocol). The Comlink worker **cannot** use asset:// — it has no access to Tauri's WebView context. Photos must be read as base64 and passed into the worker.

```rust
// src-tauri/src/commands/stats.rs
#[tauri::command]
pub async fn read_photos_as_base64(
    storage_path: String,
    photo_paths: Vec<String>,  // relative paths from find_photos.photo_path
) -> Result<Vec<String>, String> {
    photo_paths.iter().map(|rel| {
        let abs = format!("{}/{}", storage_path, rel);
        let bytes = std::fs::read(&abs).map_err(|e| format!("read {}: {}", abs, e))?;
        Ok(base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes))
    }).collect()
}
```

`base64` crate is already in Cargo.toml (used by tile_proxy). [VERIFIED: grep Cargo.toml]

### Pattern 5: CSV Export with save() Dialog

```typescript
// Source: Tauri docs v2 + Context7 plugin-fs
// src/lib/exportCsv.ts
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { save } from '@tauri-apps/plugin-dialog';
import type { Find } from '@/lib/finds';

export async function exportToCsv(finds: Find[]): Promise<string | null> {
  const header = 'species_name,date_found,country,region,location_note,lat,lng,notes,photo_paths';
  const rows = finds.map(f => {
    const photos = f.photos.map(p => p.photo_path).join(';');
    return [
      csvEscape(f.species_name), f.date_found, csvEscape(f.country),
      csvEscape(f.region), csvEscape(f.location_note),
      f.lat ?? '', f.lng ?? '', csvEscape(f.notes), csvEscape(photos),
    ].join(',');
  });
  const csv = [header, ...rows].join('\n');

  const path = await save({
    defaultPath: 'bili-mushroom-export.csv',
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (!path) return null;  // user cancelled

  await writeTextFile(path, csv);
  return path;
}
```

### Pattern 6: TanStack Query Hook (stats)

```typescript
// Source: Phase 2 established pattern (src/hooks/useFinds.ts)
// src/hooks/useStats.ts
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/stores/appStore';
import { getStatsCards, getCalendar, getSpeciesStats } from '@/lib/stats';

export const STATS_QUERY_KEY = 'stats' as const;
export const CALENDAR_QUERY_KEY = 'calendar' as const;
export const SPECIES_STATS_QUERY_KEY = 'species_stats' as const;

export function useStatsCards() {
  const storagePath = useAppStore(s => s.storagePath);
  return useQuery({
    queryKey: [STATS_QUERY_KEY, storagePath],
    queryFn: () => getStatsCards(storagePath!),
    enabled: !!storagePath,
  });
}
// useCalendar() and useSpeciesStats() follow the same shape
```

### Anti-Patterns to Avoid

- **Running @react-pdf/renderer on the main thread:** react-pdf is CPU-intensive for photo-heavy exports. Without a worker, the UI freezes for seconds. Always use the Comlink worker pattern (D-10).
- **Passing asset:// URLs to @react-pdf/renderer Image src:** The worker cannot resolve `asset://localhost/...` URLs. Pass photos as `data:image/jpeg;base64,...` strings. Failure mode: blank images in PDF with no error.
- **Using `<a download>` with a Blob URL for file export in Tauri:** In Tauri WebView2 on Windows, `<a download>` does not open a native save dialog and the download may be silently blocked or routed to a non-obvious location. Use `save()` dialog + `writeTextFile()` instead.
- **Putting seasonal calendar aggregation in Rust:** The calendar only needs (month, species_name, date_found) tuples — Rust returns flat rows, React groups into 12 buckets in O(n). No need for a complex Rust struct.
- **Adding a new SQLite migration for stats:** Stats are read-only aggregations over existing tables. No schema change is needed.
- **Forgetting to add capabilities permissions:** `dialog:allow-save` and `fs:allow-write-text-file` are NOT in `default.json` yet. Export will silently fail (Tauri capability system blocks the IPC call) without them.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF document generation | Custom canvas/HTML-to-image | @react-pdf/renderer | JSX-to-PDF renderer; handles font embedding, image compression, page breaks |
| PDF image layout | Manual pixel positioning | `<View>`, `<Image>`, `StyleSheet.create()` in react-pdf | CSS-like flexbox layout in PDF |
| Worker RPC | Raw postMessage + message IDs | Comlink.expose/wrap | Handles async/await, error propagation, TypeScript types across worker boundary |
| Base64 encoding in JS | `btoa()` / manual | Rust `base64` crate (already present) | Handles binary file reads server-side; `btoa()` fails on binary data in browser |
| CSV escaping | ad-hoc string replace | A proper `csvEscape()` function wrapping values in quotes and doubling internal quotes | Species names may contain commas (e.g., "Amanita, var. alba") |
| Month name formatting | Manual month array | `new Intl.DateTimeFormat('hr', {month:'long'}).format(new Date(2024, m-1))` | Croatian month names for free; no hardcoded array |

**Key insight:** The only genuinely novel external dependency in this phase is @react-pdf/renderer + Comlink. Everything else — SQL aggregations, TanStack Query hooks, shadcn/ui components, TailwindCSS — is already in the project and established pattern.

---

## Common Pitfalls

### Pitfall 1: asset:// URLs in Comlink Worker
**What goes wrong:** PDF renders with blank image placeholders; no error thrown in console.
**Why it happens:** The Comlink worker runs in a `Worker` context, not a Tauri WebView window. `asset://localhost/...` URLs are served by Tauri's WebView protocol handler, which is inaccessible to the worker thread.
**How to avoid:** Call `read_photos_as_base64` Tauri command from the main thread BEFORE spawning/calling the worker. Pass `data:image/jpeg;base64,...` strings as the `src` prop to `@react-pdf/renderer`'s `<Image>` component. [VERIFIED: Context7 react-pdf image docs show base64 data URI support]
**Warning signs:** PDF exported but all image slots are white/blank.

### Pitfall 2: Missing Tauri Capabilities Permissions
**What goes wrong:** `save()` dialog call or `writeTextFile()` call throws a Tauri IPC error: "Permission denied" or silent failure.
**Why it happens:** Tauri 2 uses a capabilities system. Current `default.json` has `dialog:allow-open` but NOT `dialog:allow-save`. It has `fs:allow-read-file` but NOT `fs:allow-write-text-file`. [VERIFIED: grep capabilities/default.json]
**How to avoid:** Add both permissions to `src-tauri/capabilities/default.json` in Wave 0.
**Warning signs:** Export button triggers no file dialog OR throws in dev console.

### Pitfall 3: `<a download>` Not Working in Tauri WebView2
**What goes wrong:** User clicks "Export CSV" — nothing happens or a file appears in an unexpected location without a save dialog.
**Why it happens:** Tauri WebView2 on Windows does not expose standard browser download behavior for programmatic Blob URL downloads. `<a download>` works in Chrome but not reliably in WebView2.
**How to avoid:** Use `save()` dialog + `writeTextFile()` pattern (same as PDF but without the worker). [ASSUMED — WebView2 download behavior; standard recommendation from Tauri community]
**Warning signs:** No native file picker appears on CSV export button click.

### Pitfall 4: react-pdf Bundle Size in Vite
**What goes wrong:** First PDF export triggers a large chunk load delay or Vite HMR warning about chunk size.
**Why it happens:** @react-pdf/renderer bundles font processing and PDF primitives; it is ~800KB unminified.
**How to avoid:** The Comlink worker import (`new Worker(new URL(...))`) already causes Vite to code-split the worker into a separate chunk. Worker loads lazily on first export click. No extra Vite configuration needed. [VERIFIED: Vite 5 native worker support — no `worker` config block required for `{ type: 'module' }` workers]
**Warning signs:** Slow first export but subsequent exports fast = expected behavior; not a bug.

### Pitfall 5: Calendar Month Grouping Off-By-One
**What goes wrong:** Finds in December appear in January's cell, or vice versa.
**Why it happens:** `strftime('%m', date_found)` returns `'01'`–`'12'` as strings. Casting to INTEGER returns 1–12. JS `new Date(2024, m - 1)` uses 0-indexed months. If the cast is missing or the -1 offset is forgotten, months shift by one.
**How to avoid:** The Rust query `CAST(strftime('%m', date_found) AS INTEGER)` returns 1–12. In the React calendar, bucket index = `month - 1` to map into a 0-indexed array of 12 slots.
**Warning signs:** One month consistently empty while an adjacent month has double the expected entries.

### Pitfall 6: Most Active Month Display Format
**What goes wrong:** Stat card 4 shows "2024-05" instead of "May 2024".
**Why it happens:** `strftime('%Y-%m', date_found)` returns an ISO-format string. The frontend receives "2024-05" and displays it raw.
**How to avoid:** Either (a) format in Rust using chrono to return "May 2024", or (b) format in the React component using `new Intl.DateTimeFormat('hr', { month:'long', year:'numeric' }).format(new Date(year, month - 1))`. Option (b) is simpler and respects the app's UI language. [ASSUMED: Intl.DateTimeFormat is available in Tauri WebView2 — standard Web API]

---

## Code Examples

### SQL Aggregations

```sql
-- Total finds
SELECT COUNT(*) FROM finds;

-- Unique species
SELECT COUNT(DISTINCT species_name) FROM finds;

-- Unique location clusters
SELECT COUNT(DISTINCT country || '|' || region || '|' || location_note) FROM finds;

-- Most active month (returns '2024-05' format)
SELECT strftime('%Y-%m', date_found) as ym, COUNT(*) as cnt
FROM finds GROUP BY ym ORDER BY cnt DESC LIMIT 1;

-- Top Spots (top 10 locations by find count)
SELECT country, region, location_note,
       COUNT(*) as cnt
FROM finds
GROUP BY country, region, location_note
ORDER BY cnt DESC
LIMIT 10;

-- Best Months (all months ranked by find count)
SELECT strftime('%m', date_found) as month_num,
       strftime('%Y-%m', date_found) as ym,
       COUNT(*) as cnt
FROM finds
GROUP BY month_num
ORDER BY cnt DESC;

-- Seasonal calendar entries (all finds, ordered for grouping)
SELECT CAST(strftime('%m', date_found) AS INTEGER) as month,
       species_name, date_found, location_note
FROM finds
ORDER BY month ASC, date_found ASC;

-- Per-species stats (aggregated)
SELECT species_name,
       COUNT(*) as find_count,
       MIN(date_found) as first_find,
       strftime('%m', MIN(date_found)) as first_find_month
FROM finds
GROUP BY species_name
ORDER BY find_count DESC;

-- Per-species locations (for expanded row)
SELECT DISTINCT country, region, location_note
FROM finds
WHERE species_name = ?1;

-- Best month for a specific species
SELECT strftime('%Y-%m', date_found) as ym, COUNT(*) as cnt
FROM finds WHERE species_name = ?1
GROUP BY ym ORDER BY cnt DESC LIMIT 1;
```

### @react-pdf/renderer Journal Layout

```tsx
// Source: Context7 /diegomura/react-pdf — Image + View layout
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, backgroundColor: '#0F0E09' },
  findSection: { marginBottom: 24, borderBottom: '1px solid #4A4228', paddingBottom: 16 },
  photo: { width: '100%', height: 200, objectFit: 'cover', marginBottom: 8 },
  speciesName: { fontFamily: 'Playfair Display', fontSize: 18, color: '#D4941A' },
  metadata: { fontSize: 10, color: '#8A7E5C', marginTop: 4 },
});

// Fonts must be registered before Document renders:
// Font.register({ family: 'Playfair Display', src: '...' })
// Note: font registration in worker context — embed font as base64 or use standard fonts first
```

**Font registration note:** Registering Google Fonts in the Web Worker requires fetching font files from a URL, which requires network access in the worker. For v1, use standard PDF fonts (Helvetica, Times-Roman) to avoid complexity. Forest Codex typography is for the UI; PDF can use Times-Roman for the journal feel without web font loading issues. [ASSUMED: custom font loading in Comlink worker untested — recommend standard fonts for v1]

### Vite 5 Native Worker Import

```typescript
// Source: Vite 5 official docs — Web Workers with import.meta.url
// No vite.config.ts changes needed. Works with Tauri dev server.
const worker = new Worker(
  new URL('../workers/pdfExport.worker.ts', import.meta.url),
  { type: 'module' }
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `importScripts()` + UMD worker bundle | `{ type: 'module' }` Worker + Vite native splitting | Vite 3+ / 2022 | No webpack/rollup worker plugin needed |
| `PDFDownloadLink` component (react-pdf) | `pdf().toBlob()` programmatic API | react-pdf v3+ | Worker-compatible; no component tree needed |
| `btoa()` for base64 in browser | Rust `base64` crate read server-side | N/A | Handles binary photos reliably |
| Browser `fetch()` for tile/photo access | Tauri asset protocol + FS commands | Tauri 2 | Desktop app: files read via IPC, not HTTP |

**Deprecated/outdated:**
- `PDFViewer` component in react-pdf: for in-browser preview, not needed here (export to file).
- `@react-pdf/renderer` v2/v3 `Font.load()` async pattern: v4 uses synchronous `Font.register()` with src URL.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| @react-pdf/renderer | EXP-01 PDF export | ✗ not installed | — install 4.5.0 | None — must install |
| comlink | EXP-01 PDF worker | ✗ not installed | — install 4.4.2 | None — must install |
| rusqlite | STA-01..STA-04 | ✓ | 0.31 (bundled) | — |
| base64 crate | EXP-01 photo read | ✓ | 0.22 | — |
| @tauri-apps/plugin-dialog | EXP-01, EXP-02 | ✓ installed | 2.7.0 | — |
| @tauri-apps/plugin-fs | EXP-02 CSV write | ✓ installed, needs write perm | 2.5.0 | — |
| dialog:allow-save capability | EXP-01, EXP-02 | ✗ not in default.json | — | None — must add |
| fs:allow-write-text-file capability | EXP-02 | ✗ not in default.json | — | None — must add |
| Vitest + jsdom | Test suite | ✓ | vitest ^2 | — |

**Missing dependencies with no fallback:**
- `@react-pdf/renderer` + `comlink` — install in Wave 0
- `dialog:allow-save` + `fs:allow-write-text-file` in capabilities — add in Wave 0

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.x + @testing-library/react 16 |
| Config file | `vite.config.ts` (`test` block, jsdom environment) |
| Quick run command | `npm test` (runs vitest in single-pass mode) |
| Full suite command | `npm test` (same — all tests are unit/integration, no e2e) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STA-01 | `useStatsCards` returns counts from mock invoke | unit | `npm test -- src/hooks/useStats.test.ts` | ❌ Wave 0 |
| STA-02 | `useStatsCards` returns top_spots + best_months arrays | unit | `npm test -- src/hooks/useStats.test.ts` | ❌ Wave 0 |
| STA-03 | `useCalendar` groups entries by month correctly | unit | `npm test -- src/hooks/useStats.test.ts` | ❌ Wave 0 |
| STA-04 | `useSpeciesStats` returns per-species rows with locations | unit | `npm test -- src/hooks/useStats.test.ts` | ❌ Wave 0 |
| STA-01 | Rust `get_stats_cards` returns correct counts on test DB | unit (Rust) | `cargo test -p bili-mushroom-lib stats` | ❌ Wave 0 |
| STA-03 | Rust `get_calendar` month grouping (1–12, no off-by-one) | unit (Rust) | `cargo test -p bili-mushroom-lib calendar` | ❌ Wave 0 |
| EXP-01 | `exportPdf.ts` Comlink bridge returns Uint8Array | manual-only | manual — worker untestable in jsdom | N/A |
| EXP-02 | `exportCsv.ts` CSV string escapes commas/quotes correctly | unit | `npm test -- src/lib/exportCsv.test.ts` | ❌ Wave 0 |
| EXP-02 | `exportCsv.ts` calls save() + writeTextFile() with correct args | unit (mocked) | `npm test -- src/lib/exportCsv.test.ts` | ❌ Wave 0 |

**EXP-01 manual-only justification:** Comlink Web Workers cannot be instantiated in jsdom (no `Worker` constructor). The react-pdf render pipeline also relies on browser globals unavailable in jsdom. Test by launching the app in Tauri dev mode and verifying a PDF is generated with photos.

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test && cargo test -p bili-mushroom-lib`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/hooks/useStats.test.ts` — covers STA-01..STA-04 hooks with mock invokeHandlers
- [ ] `src/lib/exportCsv.test.ts` — covers EXP-02 CSV string generation and file write
- [ ] `src-tauri/src/commands/stats.rs` test module — covers STA-01 aggregation SQL correctness
- [ ] Add `@react-pdf/renderer` + `comlink` to `invokeHandlers` mock (add `read_photos_as_base64` handler)
- [ ] Add `save` export to `vi.mock('@tauri-apps/plugin-dialog')` in tauri-mocks.ts (currently only `open` is mocked)
- [ ] Add `writeTextFile` to `vi.mock('@tauri-apps/plugin-fs')` in tauri-mocks.ts

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `<a download>` with Blob URL does not work reliably in Tauri WebView2 on Windows | Anti-Patterns, Pitfall 3 | If it does work, JS Blob download approach is simpler (no writeTextFile needed); low risk — save dialog approach is strictly better UX anyway |
| A2 | Custom Google Fonts (Playfair Display) cannot be easily registered in a Comlink Web Worker without network fetch | Code Examples (font registration) | If wrong, could add Forest Codex typography to PDF; recommend deferring to v1.1 either way |
| A3 | `Intl.DateTimeFormat` is available in Tauri WebView2 (Windows 10/11) | Pitfall 6 | If unavailable, need hardcoded Croatian month name array; low risk — WebView2 uses Chromium engine |
| A4 | Vite 5 `{ type: 'module' }` Worker with `import.meta.url` works in Tauri dev server at port 1420 | Pattern 3 | If Tauri dev server has CORS/security restrictions on worker module imports, may need to adjust vite.config.ts `worker.format` — test in Wave 1 |

**If this table is empty:** Not the case — 4 assumptions logged above.

---

## Open Questions

1. **PDF file write approach (Blob → Tauri FS)**
   - What we know: `save()` dialog returns a path string. `writeTextFile()` handles text. For binary PDF, `writeFile(path, Uint8Array)` from plugin-fs is needed.
   - What's unclear: Does `fs:allow-write-file` (binary) need to be added in addition to `fs:allow-write-text-file`? Or does one permission cover both?
   - Recommendation: Add both `fs:allow-write-file` and `fs:allow-write-text-file` to capabilities in Wave 0. The cost of an extra permission is zero; the cost of a missing one is a silent runtime failure.

2. **Per-species stats query — one command or two?**
   - What we know: D-07 requires for each species: find_count, first_find_date, best_month, all_locations. The locations list requires a separate `SELECT DISTINCT` per species.
   - What's unclear: Whether one aggregated query with JSON_GROUP_ARRAY (SQLite 3.38+) is safe on Windows 10 SQLite, or two separate commands are safer.
   - Recommendation: Use two commands: `get_species_stats_summary` (GROUP BY with counts + first dates) and `get_species_locations(species_name)` called on expand. Lazy-load locations per species rather than fetching all species' locations upfront. This matches the D-07 "expandable row" UX.

---

## Sources

### Primary (HIGH confidence)
- `src-tauri/Cargo.toml` — verified rusqlite 0.31, base64 0.22, all Rust deps
- `src/package.json` — verified all JS deps and their current versions
- `src-tauri/capabilities/default.json` — verified which permissions are and are not present
- `src-tauri/migrations/*.sql` — verified full DB schema (finds, find_photos tables)
- Context7 `/diegomura/react-pdf` — pdf() API, Image component, base64 src support
- Context7 `/googlechromelabs/comlink` — expose/wrap pattern, TypeScript usage
- Tauri v2 dialog docs (v2.tauri.app/plugin/dialog/) — save() API, return type
- Tauri v2 FS docs (v2.tauri.app/plugin/file-system/) — writeTextFile() API, permissions
- npm registry — @react-pdf/renderer@4.5.0 (2026-04-15), comlink@4.4.2 (2024-11-07)
- `src-tauri/gen/schemas/desktop-schema.json` — verified `dialog:allow-save` is a valid permission string

### Secondary (MEDIUM confidence)
- CLAUDE.md §Technology Stack — @react-pdf/renderer + Comlink recommendation with article citation
- 04-CONTEXT.md — all locked decisions confirmed
- 04-UI-SPEC.md — UI layout contract (verified checker-approved)
- Existing `src/hooks/useFinds.ts` + `src-tauri/src/commands/` — established patterns

### Tertiary (LOW confidence)
- WebView2 `<a download>` behavior (community knowledge, not officially documented by Microsoft/Tauri)
- Web Worker `Intl.DateTimeFormat` availability in WebView2 (assumed from Chromium base)

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all versions verified via npm registry and Cargo.toml
- Architecture: HIGH — follows established Phase 2 rusqlite + TanStack Query pattern exactly
- PDF Export: MEDIUM — @react-pdf/renderer verified via Context7; Comlink pattern verified; base64 photo workaround is documented pattern but untested in this specific codebase
- CSV Export: HIGH — writeTextFile + save() dialog is documented Tauri 2 API; permissions gap confirmed
- Pitfalls: MEDIUM — capability permission gaps VERIFIED; asset:// in worker ASSUMED based on architecture
- Validation: HIGH — existing test infrastructure directly extensible

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (react-pdf and Tauri APIs are stable; re-verify if Tauri 2.x minor releases change capability schema)
