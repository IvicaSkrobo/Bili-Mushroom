# Bili Mushroom — Code Review

**Reviewed:** 2026-05-12
**Depth:** deep (standard + cross-file tracing)
**Scope:** Rust commands (finds.rs, import.rs, path_builder.rs, tile_proxy.rs, updater.rs), React frontend (EditFindDialog.tsx, PhotoLightbox.tsx, CollectionTab.tsx, App.tsx, AppShell.tsx, SettingsDialog.tsx), lib/finds.ts, hooks/useFinds.ts, stores/appStore.ts

---

## Summary

The app is in solid shape. The data model is consistent, the permanentDelete flag is properly threaded from UI checkboxes down to Rust, and the primary-photo promotion logic is correct in all three deletion paths. Seven real bugs were found: three HIGH (data loss or silent failure under reachable conditions), four MEDIUM (logic errors / broken UX under reachable conditions). No critical security vulnerabilities. No issues in the test helpers.

---

## HIGH Issues

### H-01: `bulk_delete_find_photos` assumes all photo IDs belong to the same find — silently corrupts if they don't

**File:** `src-tauri/src/commands/finds.rs:861-867`

**Issue:** `bulk_delete_find_photos` derives `find_id` from only the first element of `photo_ids`:

```rust
let find_id: i64 = conn
    .query_row(
        "SELECT find_id FROM find_photos WHERE id = ?1",
        params![photo_ids[0]],
        |row| row.get(0),
    )
    .map_err(|_| "photo not found".to_string())?;
```

Later it re-queries the `FindRecord` using that single `find_id`. If the caller passes photo IDs from different finds (or if the UI ever changes), the DB deletes succeed for all photo rows but only one find's record is returned. The other find's data becomes inconsistent in the TanStack Query cache without an error being raised. Currently the UI only calls this from `EditFindDialog` within a single find's photo grid, so the bug is latent — but the Rust API makes no assertion and the contract is not enforced.

**Fix:** Add a validation pass before any deletions:

```rust
// Validate: all photo_ids must belong to the same find
for &photo_id in &photo_ids[1..] {
    let other_find_id: i64 = conn
        .query_row(
            "SELECT find_id FROM find_photos WHERE id = ?1",
            params![photo_id],
            |row| row.get(0),
        )
        .map_err(|_| format!("photo {} not found", photo_id))?;
    if other_find_id != find_id {
        return Err(format!(
            "photo {} belongs to find {} but expected find {}",
            photo_id, other_find_id, find_id
        ));
    }
}
```

---

### H-02: `move_find_files` — copy+delete fallback silently ignores `remove_file` errors

**File:** `src-tauri/src/commands/finds.rs:221-225`

**Issue:** When `rename` fails (cross-device move), the code falls back to `copy` + `remove_file`. The `remove_file` call's error is discarded with `let _ = ...`:

```rust
if std::fs::rename(&abs_src, &abs_dest).is_err() {
    std::fs::copy(&abs_src, &abs_dest)
        .map_err(|e| format!("Failed to copy '{}': {}", abs_src, e))?;
    let _ = std::fs::remove_file(&abs_src);  // <-- error silently dropped
}
```

If the copy succeeds but the original cannot be deleted (file in use, permissions), the operation reports success, the DB record is deleted, and the user is left with two copies on disk — the "move" semantics are violated with no indication to the user.

**Fix:** Surface the error:

```rust
std::fs::remove_file(&abs_src)
    .map_err(|e| format!("Copied '{}' but could not remove source: {}", abs_src, e))?;
```

---

### H-03: `openLightbox` dedup uses `seen2` scoped per find but `counted` is global — index mismatch when finds share duplicate photo paths

**File:** `src/tabs/CollectionTab.tsx:94-107`

**Issue:** The first loop builds `flat` using a global `seen` set (correctly deduplicating across all finds). The second loop to compute `globalIndex` uses a per-find `seen2` set. If two different finds share the same `photo_path` (duplicate file paths in DB), `flat` drops the second occurrence but `counted` still increments for it — so the calculated `globalIndex` can point past the actual length of `flat`, or to the wrong photo.

```typescript
// First pass — correct, global dedup
const seen = new Set<string>();
for (const f of speciesFinds) {
  for (const p of f.photos) {
    if (seen.has(p.photo_path)) continue;   // global skip
    seen.add(p.photo_path);
    flat.push({ photo: p, find: f });
  }
}

// Second pass — WRONG: seen2 is per-find, not global
for (const f of speciesFinds) {
  const seen2 = new Set<string>();          // reset each find!
  for (let pi = 0; pi < f.photos.length; pi++) {
    const p = f.photos[pi];
    if (seen2.has(p.photo_path)) continue;  // misses cross-find dups
    seen2.add(p.photo_path);
    if (f.id === findId && pi === photoIndex) {
      globalIndex = counted;
    }
    counted++;                              // counted can exceed flat.length
  }
}
```

**Fix:** Use a single shared seen set in the second loop (or compute `globalIndex` by finding the matching entry in `flat` directly):

```typescript
// Replace the second loop entirely:
const target = flat.findIndex(
  (entry) => entry.find.id === findId && entry.find.photos.indexOf(entry.photo) === photoIndex
);
const globalIndex = target >= 0 ? target : 0;
```

A simpler approach that avoids the dual-loop entirely:

```typescript
// Build flat with photo index recorded, then look up directly
let globalIndex = 0;
for (let i = 0; i < flat.length; i++) {
  if (flat[i].find.id === findId && flat[i].photo === speciesFinds
      .find(f => f.id === findId)?.photos[photoIndex]) {
    globalIndex = i;
    break;
  }
}
```

---

## MEDIUM Issues

### M-01: `sanitize_path_component` operates on the untrimed `s` but checks emptiness on `trimmed`

**File:** `src-tauri/src/commands/path_builder.rs:5-33`

**Issue:** `trimmed` is computed on line 6 but the character replacement on line 7 iterates over the original `s`. If `s` is `"  "` (spaces only), `trimmed.is_empty()` is `true`, so the function correctly returns `""`. But if `s` is `"  foo  "`, the leading/trailing spaces are included in `replaced` and not trimmed from `result` until `result.trim_matches('_').trim()` on line 32 — which correctly trims spaces too. The `trimmed` variable is computed but never used in the replacement pass, which is confusing and makes the function harder to reason about. This is not a current bug but is a latent correctness risk if the logic is extended.

**Fix:** Use `trimmed` (not `s`) as the input to the character map:

```rust
let replaced: String = trimmed   // was: s
    .chars()
    .map(|c| match c { ... })
    .collect();
```

---

### M-02: `App.tsx` — `runInstallUpdate` is not stable across renders; the `useEffect` dependency array omits it

**File:** `src/App.tsx:69-106, 145`

**Issue:** `runInstallUpdate` is defined as a plain `async function` inside the component body (not `useCallback`), so it is recreated on every render. It is called from the `AlertDialog`'s `onClick` handler (line 238) which is fine, but the startup `useEffect` on line 108 has the dependency array `[setAvailableUpdate, setInstallingUpdate]` which does not include `runInstallUpdate`. This is safe today only because `runInstallUpdate` is never called from inside that effect — but if a future change adds that call, it will silently capture a stale closure. More concretely, the `setInstallingUpdate` in the dependency array is listed but is also not used inside the effect (it was apparently left from an earlier version), which is dead code in the deps array and a lint warning.

**Fix:** Remove `setInstallingUpdate` from the dependency array (it is not used in the effect). If `runInstallUpdate` is ever needed inside an effect, wrap it with `useCallback`.

```typescript
// Line 145 — remove setInstallingUpdate
}, [setAvailableUpdate]);
```

---

### M-03: `PhotoLightbox` keyboard handler captures stale `prev`/`next` closures when photo list changes mid-open

**File:** `src/components/finds/PhotoLightbox.tsx:130-141`

**Issue:** The keyboard `useEffect` depends on `[open, currentIndex, photos.length]`. The `prev` and `next` functions are defined outside the effect as plain functions (lines 104-121) and are not listed as dependencies. They capture `currentIndex` and `photos.length` from the render closure via `onIndexChange`. This is actually correct for `onIndexChange` because it's always fresh from props. However `prev` and `next` reference `currentIndex` from the render scope — and the `// eslint-disable-next-line react-hooks/exhaustive-deps` comment on line 140 suppresses the lint warning that would catch a missing dep. If `photos` is mutated between renders (e.g. a deletion fires from the lightbox while it is open), `photos.length` in the closure and the actual array can diverge until the next effect re-subscription.

**Fix:** Remove the eslint-disable comment and add `prev` and `next` to the dependency array, or inline the navigation logic directly in the handler:

```typescript
useEffect(() => {
  if (!open) return;
  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && currentIndex > 0) {
      onIndexChange(currentIndex - 1);
    } else if (e.key === 'ArrowRight' && currentIndex < photos.length - 1) {
      onIndexChange(currentIndex + 1);
    } else if (e.key === 'f' || e.key === 'F') {
      setIsFullscreen((v) => !v);
    }
  };
  window.addEventListener('keydown', handleKey);
  return () => window.removeEventListener('keydown', handleKey);
}, [open, currentIndex, photos.length, onIndexChange]);
```

This also removes the 150ms `setTimeout` fade delay that is currently absent from keyboard navigation (keyboard nav skips the fade; mouse nav has it) — a minor UX inconsistency.

---

### M-04: `SettingsDialog` — `handlePruneMissing` does not invalidate TanStack Query cache after pruning

**File:** `src/components/dialogs/SettingsDialog.tsx:68-79`

**Issue:** After calling `prune_missing_photos`, orphaned photo rows are removed from the DB. However `handlePruneMissing` invokes the Rust command directly via `invoke` rather than through a mutation hook, so the `finds` query cache is never invalidated:

```typescript
const removed = await invoke<number>('prune_missing_photos', { storagePath });
setPruneResult(removed);
setPruneConfirmOpen(false);
```

If the user runs prune and then opens a find that had missing photos, the stale cached data will still show those photos (until the 30-second `staleTime` expires or the user reloads). The photos' `<img>` tags will silently fail to load.

**Fix:** Either use `useQueryClient().invalidateQueries` after the invoke, or expose `prune_missing_photos` through a `usePruneMissingPhotos` mutation hook that invalidates on success:

```typescript
import { useQueryClient } from '@tanstack/react-query';
import { FINDS_QUERY_KEY } from '@/lib/finds';
// ...
const qc = useQueryClient();
// inside handlePruneMissing, after invoke:
if (removed > 0) {
  qc.invalidateQueries({ queryKey: [FINDS_QUERY_KEY, storagePath] });
}
```

---

## LOW Issues

### L-01: `delete_find_photo` — file existence check creates a TOCTOU window

**File:** `src-tauri/src/commands/finds.rs:777-788`

**Issue:** The code checks `Path::new(&abs_path).exists()` before calling `trash::delete` or `std::fs::remove_file`. Between the existence check and the delete call, another process (or concurrent Tauri command) could remove or rename the file. The `exists()` guard is redundant and misleading because `trash::delete` already handles non-existent files gracefully on Windows (with a not-found error that is already logged). For `remove_file`, the `ErrorKind::NotFound` arm below handles it correctly.

The guard also means that a file deleted externally between `exists()` returning `true` and `trash::delete` being called will produce a logged error that confuses the user's trash operation.

**Fix:** Remove the `exists()` check and rely on the error handling already in place:

```rust
if delete_file {
    let abs_path = format!("{}/{}", storage_path, photo_path);
    if permanent_delete.unwrap_or(false) {
        if let Err(e) = std::fs::remove_file(&abs_path) {
            if e.kind() != std::io::ErrorKind::NotFound {
                eprintln!("remove_file failed for {}: {}", abs_path, e);
            }
        }
    } else if let Err(e) = trash::delete(&abs_path) {
        eprintln!("trash::delete failed for {}: {}", abs_path, e);
    }
}
```

The same pattern applies to `bulk_delete_find_photos` at lines 886-896.

---

### L-02: `install_app_update` performs a second `check()` call instead of installing the already-checked update

**File:** `src-tauri/src/commands/updater.rs:51-90`

**Issue:** `install_app_update` calls `app.updater().check().await` again from scratch rather than operating on the update object already obtained by `check_app_update`. This means:
1. An extra network round-trip every time the user clicks "Update".
2. A race window — the update metadata could change between the check shown to the user and the install actually executed.
3. If the update server becomes unreachable between check and install, the user sees "no update" rather than installing what was already confirmed.

The Tauri 2 updater API does not provide a way to cache the `Update` object across IPC calls (it's not `Send`), so this is an architectural constraint of using two separate Tauri commands. The correct mitigation is to combine check + download + install into a single `install_app_update` command and remove `check_app_update` from the install path.

**Fix:** Document this limitation clearly with a comment, or consolidate into a single command. At minimum, display a user-facing message if the second check returns `None` (currently it silently returns `Ok(false)` which the frontend translates to "No newer update found" — acceptable but confusing after the user already confirmed an update was available).

---

### L-03: `EditFindDialog` resets `permanentPhotoDelete` to `true` every time `find` changes, even after the user unchecked it

**File:** `src/components/finds/EditFindDialog.tsx:141-147`

**Issue:** The `useEffect` that resets form state resets `permanentPhotoDelete` to `true` unconditionally on every `find` change:

```typescript
useEffect(() => {
  if (find) setForm(findToFormState(find));
  setPendingPhotos([]);
  setSelectedPhotoIds(new Set());
  setPhotosExpanded(false);
  setPermanentPhotoDelete(true);  // always reset
}, [find]);
```

This is the correct behavior when opening a new find (don't carry dangerous state across finds), so it is not strictly a bug. However it also resets when the `find` object reference changes due to TanStack Query re-fetching after a mutation (e.g. after adding a photo, the query refetch delivers a new `find` object with the same ID). This means: user opens a find, unchecks "Permanently delete files", adds a photo, the mutation triggers a refetch, the find prop changes, and the checkbox is silently reset to checked before the user deletes.

**Fix:** Only reset `permanentPhotoDelete` when the find *ID* changes (i.e. a different find was opened), not on every object reference change:

```typescript
const prevFindId = useRef<number | null>(null);
useEffect(() => {
  if (find) {
    setForm(findToFormState(find));
    if (find.id !== prevFindId.current) {
      setPermanentPhotoDelete(true);
      prevFindId.current = find.id;
    }
  }
  setPendingPhotos([]);
  setSelectedPhotoIds(new Set());
  setPhotosExpanded(false);
}, [find]);
```

---

### L-04: `CollectionTab` — lightbox `onDeletePhoto` does not close the lightbox or update index after deletion

**File:** `src/tabs/CollectionTab.tsx:774-776`

**Issue:** The `onDeletePhoto` handler passed to `PhotoLightbox` fires the mutation but does not adjust the lightbox state:

```typescript
onDeletePhoto={(lbp, permanentDelete) =>
  deletePhotoMutation.mutate({ photoId: lbp.photo.id, deleteFile: true, permanentDelete })
}
```

`PhotoLightbox`'s delete button calls `onDeletePhoto(current, permanentPhotoDelete); onOpenChange(false)` (line 280-281 of PhotoLightbox.tsx), which closes the lightbox immediately. That is fine for the close case. But the `lightboxPhotos` state array in `CollectionTab` is stale — it still contains the deleted photo until the `finds` query refetch propagates. If the user re-opens the lightbox before the refetch completes, the deleted photo briefly appears again.

This is a minor cache consistency issue, not a data integrity issue. The refetch triggered by the mutation's `onSuccess` will correct it within one render cycle.

**Fix (optional):** Proactively remove the deleted photo from `lightboxPhotos` on mutation success, or close the lightbox and reset `lightboxPhotos` to `[]` on `onDeletePhoto`:

```typescript
onDeletePhoto={(lbp, permanentDelete) => {
  deletePhotoMutation.mutate(
    { photoId: lbp.photo.id, deleteFile: true, permanentDelete },
    { onSuccess: () => setLightboxPhotos((prev) => prev.filter((p) => p.photo.id !== lbp.photo.id)) }
  );
}}
```

---

_Reviewed: 2026-05-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
