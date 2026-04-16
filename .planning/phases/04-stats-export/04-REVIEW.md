---
phase: 04-stats-export
reviewed: 2026-04-16T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - src-tauri/capabilities/default.json
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/commands/stats.rs
  - src-tauri/src/lib.rs
  - src/components/stats/ExportDocument.tsx
  - src/components/stats/RankedList.tsx
  - src/components/stats/SeasonalCalendar.tsx
  - src/components/stats/SpeciesStatRow.tsx
  - src/components/stats/StatCard.tsx
  - src/hooks/useStats.test.tsx
  - src/hooks/useStats.ts
  - src/lib/exportCsv.test.ts
  - src/lib/exportCsv.ts
  - src/lib/exportPdf.ts
  - src/lib/stats.ts
  - src/tabs/StatsTab.tsx
  - src/test/tauri-mocks.ts
  - src/workers/pdfExport.worker.ts
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-04-16
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

The phase delivers stats dashboard UI, five Tauri IPC commands for data aggregation, CSV export, and PDF export via a Comlink Web Worker. The architecture is sound and follows established patterns. One critical security issue was found: the path traversal guard in `read_photos_as_base64` is insufficient and can be bypassed. Four warnings cover a potential data-loss bug (worker never terminated on error before the fix, but the current code's finally-block is correct — actually the worker IS terminated), unhandled promise rejections, a photo MIME type assumption, and an N+1 query pattern that will cause UI hangs for large collections. Three info items cover typos, test coverage gaps, and CSV formula injection acknowledgement.

---

## Critical Issues

### CR-01: Path traversal guard is bypassable via encoded or alternative separators

**File:** `src-tauri/src/commands/stats.rs:261`

**Issue:** The guard `rel.contains("..")` only checks for the literal string `..`. An attacker (or a corrupt database row) can supply paths like `photos%2F..%2Fetc%2Fpasswd`, `.%2F.%2F` (URL-encoded), or on Windows `photos\..\Windows\System32\file` using backslash separators. Because the path is joined with `format!("{}/{}", storage_path, rel)` and passed directly to `std::fs::read`, an attacker who can influence `photo_paths` (e.g., via a tampered SQLite row or a crafted IPC call from a compromised renderer) can read arbitrary files on the filesystem.

The fix should canonicalize the joined path and verify it still starts with `storage_path`:

```rust
use std::path::Path;

for rel in &photo_paths {
    // Reject obvious traversal early
    if rel.contains("..") {
        return Err(format!("Invalid photo path '{}': path traversal not allowed", rel));
    }

    let abs = Path::new(&storage_path).join(rel);

    // Canonicalize resolves symlinks and `..` segments; then verify prefix
    let canonical = abs.canonicalize()
        .map_err(|e| format!("Cannot resolve photo path '{}': {}", rel, e))?;
    let canonical_storage = Path::new(&storage_path).canonicalize()
        .map_err(|e| format!("Cannot resolve storage path: {}", e))?;

    if !canonical.starts_with(&canonical_storage) {
        return Err(format!(
            "Invalid photo path '{}': resolves outside storage directory",
            rel
        ));
    }

    let bytes = std::fs::read(&canonical)
        .map_err(|e| format!("Failed to read photo '{}': {}", rel, e))?;
    result.push(base64::engine::general_purpose::STANDARD.encode(&bytes));
}
```

Note: `canonicalize` requires the file to exist, which is correct here — we're about to read it anyway.

---

## Warnings

### WR-01: PDF export hardcodes `data:image/jpeg` for all photos regardless of actual format

**File:** `src/lib/exportPdf.ts:36`

**Issue:** Every photo base64 string is wrapped with `data:image/jpeg;base64,...` regardless of the actual file extension. The codebase accepts JPEG, HEIF, PNG, and WebP (via `kamadak-exif`). A PNG stored under a `.png` extension passed into `@react-pdf/renderer` with a JPEG MIME type prefix will fail to render or produce a corrupted image in the exported PDF.

```typescript
// Current (line 36):
return `data:image/jpeg;base64,${b64}`;

// Fix: infer MIME type from photo_path extension
function mimeForPath(photoPath: string): string {
  const ext = photoPath.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',
  };
  return map[ext] ?? 'image/jpeg';
}

// Then in the map:
const photos_base64 = f.photos.map((p) => {
  const b64 = base64Photos[photoIdx++];
  return `data:${mimeForPath(p.photo_path)};base64,${b64}`;
});
```

---

### WR-02: `get_species_stats` executes N+2 queries per species — will hang for large collections

**File:** `src-tauri/src/commands/stats.rs:205-244`

**Issue:** For each species row returned by the aggregate query, two additional SQL queries are fired synchronously: one for `best_month` (line 207) and one for `locations` (line 217). A collection with 100 unique species executes 201 queries in a tight loop on the async command. This is not a performance note — it is a correctness concern because rusqlite connections are single-threaded and this loop holds the connection locked; any concurrent Tauri command that also calls `open_db` will open a separate connection, but long sequential I/O can starve the Tauri async executor, causing the frontend to show a spinner indefinitely with no timeout or cancellation path.

Fix: replace the N+1 pattern with two batch queries and merge results in Rust:

```rust
// Best months for all species in one query
let best_months_query = "
  SELECT species_name,
         strftime('%Y-%m', date_found) as ym,
         COUNT(*) as cnt
  FROM finds
  GROUP BY species_name, ym
  ORDER BY species_name, cnt DESC
";

// Locations for all species in one query
let locations_query = "
  SELECT DISTINCT species_name, country, region, location_note
  FROM finds
";
// Then merge into species_rows via HashMap lookups.
```

---

### WR-03: Export error handlers silently swallow error details — hinders debugging

**File:** `src/tabs/StatsTab.tsx:81` and `src/tabs/StatsTab.tsx:104`

**Issue:** Both `catch` blocks in `handleExportCsv` and `handleExportPdf` catch an unnamed error and discard it entirely, showing only a generic string to the user. If the Tauri IPC command fails (e.g., disk full, permission denied, missing worker file), the original error is lost with no log. The missing error object means there is no way to diagnose production failures.

```typescript
// Current:
} catch {
  setExportError('CSV export failed. Try again.');
}

// Fix: capture and log the error
} catch (err) {
  console.error('[exportCsv] failed:', err);
  setExportError('CSV export failed. Try again.');
}
```

Apply same pattern to the PDF handler at line 104.

---

### WR-04: `useStatsCards` does not check `dbReady` — may query before migrations complete

**File:** `src/hooks/useStats.ts:23-27`

**Issue:** The `enabled` guard on all five hooks only checks `!!storagePath`. The `appStore` also carries a `dbReady` flag (observed in test setup: `useAppStore.setState({ storagePath: '/storage/test', dbReady: true })`). If `storagePath` becomes non-null before `open_db` finishes its migration (race between two fast IPC responses), TanStack Query fires the stats queries against a partially-migrated schema. The other hooks have the same issue.

```typescript
// Fix: also guard on dbReady
export function useStatsCards() {
  const storagePath = useAppStore((s) => s.storagePath);
  const dbReady = useAppStore((s) => s.dbReady);
  return useQuery<StatsCards>({
    queryKey: [STATS_QUERY_KEY, storagePath],
    queryFn: () => getStatsCards(storagePath!),
    enabled: !!storagePath && dbReady,
  });
}
```

Apply same fix to `useTopSpots`, `useBestMonths`, `useCalendar`, `useSpeciesStats`.

---

## Info

### IN-01: Typo in `SeasonalCalendar.tsx` variable name `hasFins`

**File:** `src/components/stats/SeasonalCalendar.tsx:32`

**Issue:** `const hasFins = bucket.species.size > 0;` — the variable is named `hasFins` (fish fins) instead of `hasFinds`. This does not cause a bug but will confuse future readers.

```typescript
// Change:
const hasFins = bucket.species.size > 0;
// To:
const hasFinds = bucket.species.size > 0;
// And update all references on lines 39, 43, 44, 52, 60
```

---

### IN-02: CSV header columns do not match the order of values in data rows

**File:** `src/lib/exportCsv.ts:20-34`

**Issue:** The header string is `species_name,date_found,country,region,location_note,lat,lng,notes,photo_paths` (9 columns) and the value array matches in the same order. This is correct and produces a valid CSV. However, `lat` and `lng` are written as raw numbers (not quoted via `csvEscape`), while `photo_paths` is always quoted. If `lat` or `lng` is `null`, the cell renders as an empty string (`''`), which is valid CSV but may confuse tools that expect a numeric column. Minor clarification: the comment on line 9 states formula injection is prevented, but numeric cells (`lat`, `lng`) bypass `csvEscape` — that is fine since numbers cannot start with `=`, `+`, `-`, `@`.

No code change required. This is documentation-level: the comment on line 9 is slightly misleading since lat/lng are unquoted. Consider a clarifying comment.

---

### IN-03: `useStats.test.tsx` does not test the `useBestMonths` hook

**File:** `src/hooks/useStats.test.tsx`

**Issue:** The test file covers `useStatsCards`, `useCalendar`, `useSpeciesStats`, and `useTopSpots` but has no describe block for `useBestMonths`. The hook is used in `StatsTab` to drive the "Best Months" ranked list. A future regression in the `get_best_months` IPC wiring would go undetected. Consider adding a minimal `useBestMonths` test matching the pattern of the other four suites.

---

_Reviewed: 2026-04-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
