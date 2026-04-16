# Phase 4: Stats & Export - Pattern Map

**Mapped:** 2026-04-15
**Files analyzed:** 14 new/modified files
**Analogs found:** 12 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src-tauri/src/commands/stats.rs` | command (Rust) | request-response | `src-tauri/src/commands/finds.rs` | exact |
| `src-tauri/src/commands/mod.rs` | config | — | `src-tauri/src/commands/mod.rs` | self (modify) |
| `src-tauri/src/lib.rs` | config | — | `src-tauri/src/lib.rs` | self (modify) |
| `src-tauri/capabilities/default.json` | config | — | `src-tauri/capabilities/default.json` | self (modify) |
| `src/lib/stats.ts` | utility/IPC wrapper | request-response | `src/lib/finds.ts` | exact |
| `src/lib/exportCsv.ts` | utility | file-I/O | `src/lib/finds.ts` (IPC pattern) + Tauri plugin-fs | role-partial |
| `src/lib/exportPdf.ts` | utility | file-I/O | no analog — novel Comlink bridge | none |
| `src/workers/pdfExport.worker.ts` | utility | transform | no analog — first worker in project | none |
| `src/hooks/useStats.ts` | hook | request-response | `src/hooks/useFinds.ts` | exact |
| `src/components/stats/StatCard.tsx` | component | request-response | `src/components/ui/card.tsx` + `src/components/finds/FindCard.tsx` | role-match |
| `src/components/stats/RankedList.tsx` | component | request-response | `src/tabs/CollectionTab.tsx` (list rendering) | role-match |
| `src/components/stats/SeasonalCalendar.tsx` | component | transform | `src/tabs/CollectionTab.tsx` (group + expand) | role-match |
| `src/components/stats/MonthDetailPanel.tsx` | component | request-response | `src/tabs/CollectionTab.tsx` (folder expand panel) | role-match |
| `src/components/stats/SpeciesStatRow.tsx` | component | request-response | `src/components/finds/FindCard.tsx` (accordion row) | role-match |
| `src/tabs/StatsTab.tsx` | tab component | request-response | `src/tabs/CollectionTab.tsx` | exact |
| `src/test/tauri-mocks.ts` | test | — | `src/test/tauri-mocks.ts` | self (modify) |
| `src/hooks/useStats.test.ts` | test | — | `src/hooks/useFinds.test.tsx` | exact |
| `src/lib/exportCsv.test.ts` | test | — | `src/hooks/useFinds.test.tsx` | role-match |

---

## Pattern Assignments

### `src-tauri/src/commands/stats.rs` (command, request-response)

**Analog:** `src-tauri/src/commands/finds.rs` and `src-tauri/src/commands/import.rs`

**Imports pattern** (`finds.rs` lines 1–4):
```rust
use rusqlite::params;
use chrono::Utc;

use crate::commands::import::{open_db, FindPhoto};
```

For `stats.rs`, import only what is needed:
```rust
use rusqlite::params;
use crate::commands::import::open_db;
```

**Struct + command shape** (`finds.rs` lines 7–23, `import.rs` lines 345–408):
```rust
// Derive pattern for all response structs
#[derive(serde::Serialize, Clone, Debug)]
pub struct SpeciesNote {
    pub species_name: String,
    pub notes: String,
}

// Command signature pattern — storage_path as String, returns Result<T, String>
#[tauri::command]
pub async fn get_species_notes(storage_path: String) -> Result<Vec<SpeciesNote>, String> {
    let conn = open_db(&storage_path)?;
    let mut stmt = conn
        .prepare("SELECT species_name, notes FROM species_notes ORDER BY species_name")
        .map_err(|e| e.to_string())?;
    let notes = stmt
        .query_map([], |row| Ok(SpeciesNote { species_name: row.get(0)?, notes: row.get(1)? }))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(notes)
}
```

**query_row pattern for scalar aggregations** (`import.rs` lines 351–373):
```rust
// Single-value query pattern
let conn = open_db(&storage_path)?;
let mut find_stmt = conn
    .prepare("SELECT id, ... FROM finds ORDER BY date_found DESC, id DESC")
    .map_err(|e| format!("Failed to prepare finds query: {}", e))?;
```

**query_row for optional scalar** (use `.ok()` to convert to `Option<T>`):
```rust
// Pattern from RESEARCH.md Pattern 1 — most_active_month returns None when table is empty
let most_active_month: Option<String> = conn
    .query_row(
        "SELECT strftime('%Y-%m', date_found) as ym, COUNT(*) as cnt
         FROM finds GROUP BY ym ORDER BY cnt DESC LIMIT 1",
        [], |r| r.get::<_, String>(0),
    )
    .ok();
```

**Error mapping pattern** (used throughout `finds.rs` and `import.rs`):
```rust
.map_err(|e| e.to_string())?
// or with context:
.map_err(|e| format!("Failed to prepare query: {}", e))?
```

**Test module pattern** (`finds.rs` lines 181–267):
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::import::test_helpers::{setup_in_memory_db, make_find_record};
    use crate::commands::import::{insert_find_photo, insert_find_row};

    #[test]
    fn test_delete_find_removes_record() {
        let conn = setup_in_memory_db();
        // ... assert using conn.query_row
    }
}
```

**base64 read pattern** (Rust std::fs + base64 crate, per RESEARCH.md Pattern 4):
```rust
// base64 crate is already in Cargo.toml (verified by researcher)
let bytes = std::fs::read(&abs).map_err(|e| format!("read {}: {}", abs, e))?;
Ok(base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes))
```

---

### `src-tauri/src/commands/mod.rs` (config — modify)

**Current file** (`mod.rs` lines 1–6):
```rust
pub mod exif;
pub mod finds;
pub mod import;
pub mod path_builder;
pub mod tile_cache_db;
pub mod tile_proxy;
```

**Add one line** — append after `pub mod finds;`:
```rust
pub mod stats;
```

---

### `src-tauri/src/lib.rs` (config — modify)

**invoke_handler registration pattern** (`lib.rs` lines 8–26):
```rust
.invoke_handler(tauri::generate_handler![
    commands::exif::parse_exif,
    commands::import::import_find,
    commands::import::get_finds,
    commands::import::update_find,
    commands::finds::delete_find,
    // ... all existing commands ...
])
```

**Add five new commands** in the same comma-separated list:
```rust
commands::stats::get_stats_cards,
commands::stats::get_top_spots,
commands::stats::get_best_months,
commands::stats::get_calendar,
commands::stats::get_species_stats,
commands::stats::read_photos_as_base64,
```

---

### `src-tauri/capabilities/default.json` (config — modify)

**Current permissions** (`default.json` lines 7–22):
```json
"permissions": [
    "core:default",
    "dialog:default",
    "dialog:allow-open",
    "fs:default",
    "fs:allow-read-file",
    "fs:allow-read-dir"
]
```

**Add two permissions** (missing, confirmed by researcher):
```json
"dialog:allow-save",
"fs:allow-write-text-file",
"fs:allow-write-file"
```

---

### `src/lib/stats.ts` (utility, request-response)

**Analog:** `src/lib/finds.ts`

**Imports pattern** (`finds.ts` lines 1):
```typescript
import { invoke } from '@tauri-apps/api/core';
```

**Domain types pattern** (`finds.ts` lines 6–47):
```typescript
// Mirror Rust structs exactly — field names match serde_json snake_case output
export interface Find {
  id: number;
  original_filename: string;
  species_name: string;
  // ...
}
```

**IPC wrapper pattern** (`finds.ts` lines 82–108):
```typescript
/**
 * Calls the Rust `get_finds` command.
 * Returns all find records ordered by date_found DESC, id DESC.
 */
export async function getFinds(storagePath: string): Promise<Find[]> {
  return invoke<Find[]>('get_finds', { storagePath });
}
```

**Query key constants pattern** (`finds.ts` line 158):
```typescript
export const FINDS_QUERY_KEY = 'finds' as const;
```

Apply the same shape for stats:
```typescript
export const STATS_QUERY_KEY = 'stats' as const;
export const CALENDAR_QUERY_KEY = 'calendar' as const;
export const SPECIES_STATS_QUERY_KEY = 'species_stats' as const;

export async function getStatsCards(storagePath: string): Promise<StatsCards> {
  return invoke<StatsCards>('get_stats_cards', { storagePath });
}
```

---

### `src/lib/exportCsv.ts` (utility, file-I/O)

**Analog:** `src/lib/finds.ts` (IPC invoke pattern) + Tauri plugin-fs/plugin-dialog (no direct codebase analog for write path)

**Plugin imports pattern** (Tauri plugin pattern, consistent with how `plugin-dialog` is already used in dialogs):
```typescript
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { save } from '@tauri-apps/plugin-dialog';
```

**Invoke wrapper shape** (`finds.ts` lines 130–144 — void return + error propagation):
```typescript
export async function deleteFind(
  storagePath: string,
  findId: number,
  deleteFiles: boolean,
): Promise<void> {
  return invoke<void>('delete_find', { storagePath, findId, deleteFiles });
}
```

Apply the same async + nullable return shape:
```typescript
export async function exportToCsv(finds: Find[]): Promise<string | null> {
  // build CSV string, call save() dialog, call writeTextFile(), return path or null
}
```

---

### `src/lib/exportPdf.ts` (utility, file-I/O)

**Analog:** none in codebase — novel Comlink bridge pattern.

Use RESEARCH.md Pattern 3 (lines 302–339) as the implementation reference. Key points:
- Vite 5 `new Worker(new URL('../workers/pdfExport.worker.ts', import.meta.url), { type: 'module' })` — no vite.config.ts change needed
- `Comlink.wrap<PdfWorkerApi>(worker)` typed with the interface exported from the worker file
- `worker.terminate()` in `finally` block to prevent worker leak

---

### `src/workers/pdfExport.worker.ts` (utility, transform)

**Analog:** none in codebase — first worker file in project.

Use RESEARCH.md Pattern 3 (lines 302–320) as implementation reference. Key constraint: `pdf(<MushroomJournal finds={finds} />).toBlob()` requires React JSX support in the worker — the `MushroomJournalDocument` component must be a separate file importable without DOM globals.

---

### `src/hooks/useStats.ts` (hook, request-response)

**Analog:** `src/hooks/useFinds.ts`

**Full hook shape** (`useFinds.ts` lines 1–17):
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFinds, updateFind, deleteFind, getSpeciesNotes, upsertSpeciesNote,
  bulkRenameSpecies, moveFindToFolder,
  FINDS_QUERY_KEY, SPECIES_NOTES_QUERY_KEY,
  type Find, type UpdateFindPayload,
} from '@/lib/finds';
import { useAppStore } from '@/stores/appStore';

export function useFinds() {
  const storagePath = useAppStore((s) => s.storagePath);
  return useQuery<Find[]>({
    queryKey: [FINDS_QUERY_KEY, storagePath],
    queryFn: () => getFinds(storagePath!),
    enabled: !!storagePath,
  });
}
```

Apply identical shape for each stats query:
```typescript
export function useStatsCards() {
  const storagePath = useAppStore((s) => s.storagePath);
  return useQuery({
    queryKey: [STATS_QUERY_KEY, storagePath],
    queryFn: () => getStatsCards(storagePath!),
    enabled: !!storagePath,
  });
}
// useCalendar(), useSpeciesStats() follow the same 7-line shape
```

---

### `src/components/stats/StatCard.tsx` (component, request-response)

**Analog:** `src/components/ui/card.tsx` + Forest Codex amber styling from `CollectionTab.tsx`

**shadcn/ui Card primitive** (`card.tsx` lines 5–16):
```typescript
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm",
        className
      )}
      {...props}
    />
  )
}
```

**Amber left-border accent pattern** (`CollectionTab.tsx` line 361):
```typescript
className={`stagger-item overflow-hidden rounded-sm border bg-card ${isOpen ? 'border-primary/60 border-l-[3px]' : 'border-border/70'}`}
```

**Font-serif for display numbers** (`CollectionTab.tsx` line 387):
```typescript
<p className="font-serif text-base font-semibold leading-tight truncate text-foreground">
  {speciesName}
</p>
```

For stat cards, the large display number uses `font-serif` + `text-primary` (amber):
```typescript
<p className="font-serif text-4xl font-bold text-primary leading-none">
  {value}
</p>
```

**Stagger animation pattern** (`CollectionTab.tsx` line 358):
```typescript
style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
// requires className="stagger-item" — CSS keyframe already defined in index.css
```

---

### `src/components/stats/RankedList.tsx` (component, request-response)

**Analog:** `src/tabs/CollectionTab.tsx` (ranked group rendering pattern)

**Loading/error/empty guard pattern** (`CollectionTab.tsx` lines 329–346):
```typescript
{isLoading && (
  <p className="text-sm text-muted-foreground px-1">{t('collection.loading')}</p>
)}
{isError && (
  <Alert variant="destructive">
    <AlertDescription>{String(error)}</AlertDescription>
  </Alert>
)}
{!isLoading && !isError && groups.length === 0 && (
  <EmptyState ... />
)}
```

**Ranked row structure** — copy the group header pattern from `CollectionTab.tsx` lines 362–392, simplified (no expand/collapse, just the row with name + count badge).

---

### `src/components/stats/SeasonalCalendar.tsx` (component, transform)

**Analog:** `src/tabs/CollectionTab.tsx` (expand/collapse + group rendering)

**Expand toggle state pattern** (`CollectionTab.tsx` lines 36, 180–187):
```typescript
const [expanded, setExpanded] = useState<Set<string>>(new Set());

const toggleExpand = (name: string) => {
  setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    return next;
  });
};
```

Apply same pattern with month number as key:
```typescript
const [expandedMonth, setExpandedMonth] = useState<number | null>(null);
```

**Conditional border accent on expand** (`CollectionTab.tsx` line 361):
```typescript
className={`... ${isOpen ? 'border-primary/60 border-l-[3px]' : 'border-border/70'}`}
```

**Chevron toggle** (`CollectionTab.tsx` lines 406–413):
```typescript
{isOpen
  ? <ChevronDown className="h-4 w-4 text-muted-foreground/50" />
  : <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
```

---

### `src/components/stats/MonthDetailPanel.tsx` (component, request-response)

**Analog:** `src/tabs/CollectionTab.tsx` (folder expand body, lines 417–449)

**Expand body pattern** (`CollectionTab.tsx` lines 417–449):
```typescript
{isOpen && (
  <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-3">
    <div className="flex flex-col gap-1.5">
      {speciesFinds.map((f) => (
        <FindCard key={f.id} find={f} ... />
      ))}
    </div>
  </div>
)}
```

---

### `src/components/stats/SpeciesStatRow.tsx` (component, request-response)

**Analog:** `src/components/finds/FindCard.tsx`

**Row container + hover pattern** (`FindCard.tsx` lines 43–58):
```typescript
<div
  className={`group relative flex items-start gap-3 rounded-sm border p-3 transition-all duration-200 ${
    'border-border/50 bg-card/60 hover:border-primary/25 hover:bg-card'
  }`}
>
```

**Hidden action buttons pattern** (`CollectionTab.tsx` lines 394–400):
```typescript
<button
  type="button"
  className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground hover:bg-accent focus:opacity-100"
>
```

**Expand/collapse on row click** — reuse the `toggleExpand` Set pattern from `CollectionTab.tsx`.

---

### `src/tabs/StatsTab.tsx` (tab, request-response — full replacement)

**Analog:** `src/tabs/CollectionTab.tsx`

**Tab shell structure** (`CollectionTab.tsx` lines 200–203):
```typescript
return (
  <div className="flex flex-col h-full">
    {/* Toolbar */}
    <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border/60">
```

**Hook consumption pattern** (`CollectionTab.tsx` lines 26–28):
```typescript
const { data: finds, isLoading, isError, error } = useFinds();
```

Apply same destructuring:
```typescript
const { data: statsCards, isLoading: statsLoading } = useStatsCards();
const { data: calendar } = useCalendar();
const { data: speciesStats } = useSpeciesStats();
```

**storagePath from store** (`CollectionTab.tsx` line 23):
```typescript
const storagePath = useAppStore((s) => s.storagePath);
```

---

### `src/test/tauri-mocks.ts` (test — modify)

**Current mock dispatch table** (`tauri-mocks.ts` lines 20–50):
```typescript
export const invokeHandlers: Record<string, (...args: unknown[]) => unknown> = {
  parse_exif: (_args: unknown) => ({ date: null, lat: null, lng: null }),
  import_find: (_args: unknown) => ({ imported: [], skipped: [] }),
  get_finds: (_args: unknown) => [],
  // ...
};
```

**Add five stat handlers** using the same shape:
```typescript
get_stats_cards: (_args: unknown) => ({
  total_finds: 0,
  unique_species: 0,
  locations_visited: 0,
  most_active_month: null,
}),
get_calendar: (_args: unknown) => [],
get_species_stats: (_args: unknown) => [],
read_photos_as_base64: (_args: unknown) => [],
```

**Add dialog save mock** (`tauri-mocks.ts` lines 12–13 — current dialog mock only has `open`):
```typescript
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn().mockResolvedValue('/tmp/test-mushroom-library'),
  save: vi.fn().mockResolvedValue('/tmp/bili-export.csv'),  // ADD THIS
}));
```

**Add plugin-fs write mocks** (`tauri-mocks.ts` lines 92–95 — current fs mock only has readDir/remove):
```typescript
vi.mock('@tauri-apps/plugin-fs', () => ({
  readDir: vi.fn().mockResolvedValue([]),
  remove: vi.fn().mockResolvedValue(undefined),
  writeTextFile: vi.fn().mockResolvedValue(undefined),  // ADD
  writeFile: vi.fn().mockResolvedValue(undefined),       // ADD
}));
```

---

### `src/hooks/useStats.test.ts` (test)

**Analog:** `src/hooks/useFinds.test.tsx`

**Full test structure** (`useFinds.test.tsx` lines 1–33):
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useFinds, useUpdateFind } from './useFinds';
import { invokeHandlers } from '@/test/tauri-mocks';
import { useAppStore } from '@/stores/appStore';

import '@/test/tauri-mocks';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}
```

**Zustand state reset + handler override pattern** (`useFinds.test.tsx` lines 64–69):
```typescript
beforeEach(() => {
  useAppStore.setState({ storagePath: '/storage/test', dbReady: true });
  invokeHandlers['get_finds'] = () => [sampleFind];
});
```

**Disabled when storagePath null test** (`useFinds.test.tsx` lines 91–100):
```typescript
it('is disabled (not loading) when storagePath is null', () => {
  useAppStore.setState({ storagePath: null });
  // ...
  expect(result.current.isLoading).toBe(false);
  expect(result.current.fetchStatus).toBe('idle');
});
```

---

### `src/lib/exportCsv.test.ts` (test)

**Analog:** `src/hooks/useFinds.test.tsx` (mocking pattern)

No renderHook needed — `exportCsv.ts` is a plain async function. Test pattern:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@/test/tauri-mocks';
// vi.mock for plugin-fs and plugin-dialog are already applied via tauri-mocks import

import { exportToCsv } from '@/lib/exportCsv';
import type { Find } from '@/lib/finds';
```

Mock override pattern from `useFinds.test.tsx` applied to function-level test:
```typescript
// Override mock return for specific test
import { save } from '@tauri-apps/plugin-dialog';
(save as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null); // user cancelled
```

---

## Shared Patterns

### Store Access
**Source:** `src/stores/appStore.ts` line 53, `src/tabs/CollectionTab.tsx` line 23
**Apply to:** `src/hooks/useStats.ts`, `src/tabs/StatsTab.tsx`, `src/lib/exportCsv.ts`
```typescript
const storagePath = useAppStore((s) => s.storagePath);
```

### Forest Codex Amber Primary Color
**Source:** `src/index.css` lines 61–62 (dark mode), 36–37 (light mode)
```css
/* Dark mode amber primary */
--primary: oklch(0.78 0.170 78);
/* Light mode amber primary */
--primary: oklch(0.57 0.135 76);
```
**Apply to:** All `src/components/stats/` components — use `text-primary` for large stat numbers, `border-primary/60` for active left-border accent.

### Playfair Display Serif for Display Text
**Source:** `src/index.css` line 23, `src/tabs/CollectionTab.tsx` line 387
```css
--font-serif: 'Playfair Display', Georgia, 'Times New Roman', serif;
```
```typescript
<p className="font-serif text-base font-semibold ...">
```
**Apply to:** `StatCard.tsx` (large number), `SpeciesStatRow.tsx` (species name), `SeasonalCalendar.tsx` (month name). Do NOT use for metadata text (use DM Sans / font-sans).

### Stagger Animation
**Source:** `src/tabs/CollectionTab.tsx` lines 357–359
```typescript
<div
  className="stagger-item overflow-hidden rounded-sm border bg-card"
  style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
>
```
**Apply to:** `StatCard.tsx` grid (4 cards staggered 0/30/60/90ms), `RankedList.tsx` rows, `SpeciesStatRow.tsx` list rows.

### `open_db()` Helper
**Source:** `src-tauri/src/commands/import.rs` lines 117–123
```rust
pub(crate) fn open_db(storage_path: &str) -> Result<Connection, String> {
    let db_path = format!("{}/bili-mushroom.db", storage_path);
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open DB at {}: {}", db_path, e))?;
    migrate_db(&conn)?;
    Ok(conn)
}
```
**Apply to:** Every `#[tauri::command]` in `stats.rs` — always call `open_db(&storage_path)?` as the first line, never open a raw Connection directly.

### Rust Error Mapping
**Source:** `src-tauri/src/commands/finds.rs` lines 15–23
```rust
.map_err(|e| e.to_string())?
// or for context:
.map_err(|e| format!("Failed to prepare query: {}", e))?
```
**Apply to:** Every fallible operation in `stats.rs` — all `rusqlite` method chains, all `std::fs::read()` calls.

### TanStack Query `enabled` Guard
**Source:** `src/hooks/useFinds.ts` lines 12–16
```typescript
return useQuery<Find[]>({
  queryKey: [FINDS_QUERY_KEY, storagePath],
  queryFn: () => getFinds(storagePath!),
  enabled: !!storagePath,
});
```
**Apply to:** All three hooks in `src/hooks/useStats.ts` — guard with `enabled: !!storagePath` so queries don't fire before storage path is set.

### `invoke<T>` IPC Wrapper
**Source:** `src/lib/finds.ts` lines 106–108
```typescript
export async function getFinds(storagePath: string): Promise<Find[]> {
  return invoke<Find[]>('get_finds', { storagePath });
}
```
**Apply to:** All five functions in `src/lib/stats.ts` — same single-line body, same camelCase JS ↔ snake_case Rust command name mapping.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/exportPdf.ts` | utility | file-I/O | No Comlink/Web Worker bridge exists in the project yet |
| `src/workers/pdfExport.worker.ts` | utility | transform | First Web Worker file in project; no worker precedent to copy |

For these two files, use RESEARCH.md Pattern 3 (lines 302–339) and Pattern 4 (lines 343–357) as implementation references.

---

## Metadata

**Analog search scope:** `src/`, `src-tauri/src/` — all TypeScript, Rust, and test files
**Files scanned:** 18 source files read in full
**Pattern extraction date:** 2026-04-15
