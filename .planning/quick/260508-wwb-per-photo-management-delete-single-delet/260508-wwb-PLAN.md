---
phase: quick
plan: 260508-wwb
type: execute
wave: 1
depends_on: []
files_modified:
  - src-tauri/src/commands/finds.rs
  - src-tauri/src/lib.rs
  - src/lib/finds.ts
  - src/hooks/useFinds.ts
  - src/components/finds/EditFindDialog.tsx
  - src/components/finds/PhotoLightbox.tsx
  - src/test/tauri-mocks.ts
autonomous: true
requirements: []

must_haves:
  truths:
    - "User can delete a single photo from the current view in PhotoLightbox without deleting the whole find"
    - "User can delete individual photos or multiple selected photos from the EditFindDialog photo grid"
    - "Deleting the primary photo when others remain auto-promotes another photo to primary"
    - "Deleting the last photo leaves the find intact with photos: []"
    - "Add photos button remains present and functional alongside per-photo delete controls"
    - "Collection and edit views refresh after any photo deletion"
  artifacts:
    - path: "src-tauri/src/commands/finds.rs"
      provides: "delete_find_photo + bulk_delete_find_photos Rust commands with primary-promotion logic"
      contains: "delete_find_photo"
    - path: "src/lib/finds.ts"
      provides: "deleteFindPhoto + bulkDeleteFindPhotos TS wrappers"
      exports: ["deleteFindPhoto", "bulkDeleteFindPhotos"]
    - path: "src/hooks/useFinds.ts"
      provides: "useDeleteFindPhoto + useBulkDeleteFindPhotos hooks"
      exports: ["useDeleteFindPhoto", "useBulkDeleteFindPhotos"]
    - path: "src/components/finds/EditFindDialog.tsx"
      provides: "Photo grid showing existing photos with per-photo X button + multi-select checkboxes + Delete selected button"
    - path: "src/components/finds/PhotoLightbox.tsx"
      provides: "Delete current photo button in metadata panel"
  key_links:
    - from: "PhotoLightbox delete button"
      to: "useDeleteFindPhoto hook"
      via: "onDeletePhoto prop callback"
    - from: "EditFindDialog photo grid"
      to: "useDeleteFindPhoto / useBulkDeleteFindPhotos"
      via: "direct hook call, invalidates FINDS_QUERY_KEY"
    - from: "delete_find_photo Rust command"
      to: "find_photos table"
      via: "DELETE + primary-promotion UPDATE + optional trash::delete"
---

<objective>
Add per-photo management: single-photo delete (Lightbox + EditFindDialog), multi-photo bulk delete
(EditFindDialog grid with checkboxes), and verify the existing "Add photos" button remains accessible.

Purpose: Users currently can only delete an entire find; they have no way to remove a bad or duplicate
photo while keeping the rest of the find intact.

Output: Two new Rust commands, two TS wrappers, two React hooks, photo grid in EditFindDialog with
delete affordances, delete button in PhotoLightbox.
</objective>

<execution_context>
@/Users/ivicaskrobo/.claude/get-shit-done/workflows/execute-plan.md
@/Users/ivicaskrobo/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/ivicaskrobo/Documents/GitHub/Bili-Mushroom/.planning/STATE.md
@/Users/ivicaskrobo/Documents/GitHub/Bili-Mushroom/CLAUDE.md

<!-- Key interfaces the executor needs — no codebase exploration required. -->

<interfaces>
<!-- From src/lib/finds.ts -->
```typescript
export interface FindPhoto {
  id: number;
  find_id: number;
  photo_path: string;   // relative to storagePath
  is_primary: boolean;
}

export interface Find {
  id: number;
  photos: FindPhoto[];
  // ...other fields
}

export const FINDS_QUERY_KEY = 'finds' as const;
```

<!-- From src/hooks/useFinds.ts — hook pattern to replicate -->
```typescript
export function useAddFindPhotos() {
  const storagePath = useAppStore((s) => s.storagePath);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ findId, sourcePaths }: { findId: number; sourcePaths: string[] }) =>
      addFindPhotos(storagePath!, findId, sourcePaths),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [FINDS_QUERY_KEY, storagePath] });
    },
  });
}
```

<!-- From src-tauri/src/commands/finds.rs — pattern for returning FindRecord after mutation -->
// set_find_favorite and add_find_photos both:
// 1. Perform the mutation
// 2. Re-query the full find record with photos and return it as FindRecord

<!-- From src/test/tauri-mocks.ts — invokeHandlers pattern for new commands -->
export const invokeHandlers: Record<string, (...args: unknown[]) => unknown> = {
  // Add to this table:
  delete_find_photo: (_args: unknown) => ({ ...fullFindRecord, photos: [] }),
  bulk_delete_find_photos: (_args: unknown) => ({ ...fullFindRecord, photos: [] }),
};
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Rust commands — delete_find_photo + bulk_delete_find_photos</name>
  <files>src-tauri/src/commands/finds.rs, src-tauri/src/lib.rs</files>
  <behavior>
    - delete_find_photo(storage_path, photo_id, delete_file) -> Result&lt;FindRecord, String&gt;:
      1. Look up the photo row: SELECT id, find_id, photo_path, is_primary FROM find_photos WHERE id = ?1
      2. If not found: return Err("photo not found")
      3. If delete_file=true: trash::delete(abs_path), ignore trash errors (log only)
      4. DELETE FROM find_photos WHERE id = ?1
      5. Promotion: if the deleted photo was is_primary=true AND other photos remain for the same find_id:
         UPDATE find_photos SET is_primary=1 WHERE id = (SELECT id FROM find_photos WHERE find_id=?1 ORDER BY id ASC LIMIT 1)
      6. Re-query and return the full FindRecord (find row + remaining photos) — same pattern as set_find_favorite

    - bulk_delete_find_photos(storage_path, photo_ids: Vec&lt;i64&gt;, delete_files: bool) -> Result&lt;FindRecord, String&gt;:
      1. If photo_ids is empty: return Err("no photo_ids provided")
      2. Look up find_id from the first photo_id (all must belong to same find)
      3. For each photo_id: get photo_path + is_primary, optionally trash, DELETE from find_photos
      4. After all deletes: if any deleted photo was is_primary=true AND remaining photos exist:
         UPDATE find_photos SET is_primary=1 WHERE id = (SELECT id FROM find_photos WHERE find_id=? ORDER BY id ASC LIMIT 1)
      5. Return full FindRecord for the find

    - Register both in lib.rs invoke_handler

    Test cases (in finds.rs #[cfg(test)] mod tests):
    - test_delete_find_photo_non_primary: insert find + 2 photos (primary + secondary), delete secondary → 1 photo remains, still primary
    - test_delete_find_photo_primary_promotes_another: delete primary → remaining photo promoted to is_primary=1
    - test_delete_find_photo_last_photo: delete the only photo → find still exists, photos empty
    - test_bulk_delete_find_photos: delete 2 of 3 photos → 1 remains
  </behavior>
  <action>
    Add delete_find_photo and bulk_delete_find_photos after the add_find_photos function in finds.rs.

    Use the same helper pattern as set_find_favorite for re-querying the FindRecord:
    ```rust
    let mut record = conn.query_row(
        "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at FROM finds WHERE id = ?1",
        params![find_id],
        |row| crate::commands::import::find_record_from_row(row),
    ).map_err(|e| format!("Failed to read updated find record: {}", e))?;
    // then query find_photos and assign to record.photos
    ```

    Primary promotion SQL after delete:
    ```sql
    UPDATE find_photos SET is_primary = 1
    WHERE id = (SELECT id FROM find_photos WHERE find_id = ?1 ORDER BY id ASC LIMIT 1)
    ```

    Run only after confirming: remaining photo count > 0 AND the deleted photo was is_primary=true.

    Register in lib.rs:
    ```rust
    commands::finds::delete_find_photo,
    commands::finds::bulk_delete_find_photos,
    ```

    Write 4 unit tests in finds.rs tests module using setup_in_memory_db() + insert_find_row() + insert_find_photo() helpers.
    Run: `cargo test -p bili-mushroom --lib -- commands::finds::tests 2>&1 | tail -20`
  </action>
  <verify>
    <automated>cd /Users/ivicaskrobo/Documents/GitHub/Bili-Mushroom/src-tauri && cargo test -p bili-mushroom --lib -- commands::finds::tests 2>&1 | tail -30</automated>
  </verify>
  <done>
    All finds tests pass including 4 new photo-delete tests.
    delete_find_photo and bulk_delete_find_photos appear in lib.rs invoke_handler.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: TS wrappers + hooks + tauri-mocks for photo delete</name>
  <files>src/lib/finds.ts, src/hooks/useFinds.ts, src/test/tauri-mocks.ts</files>
  <behavior>
    - deleteFindPhoto(storagePath, photoId, deleteFile) -> Promise&lt;Find&gt;
    - bulkDeleteFindPhotos(storagePath, photoIds, deleteFiles) -> Promise&lt;Find&gt;
    - useDeleteFindPhoto(): mutation hook → invalidates FINDS_QUERY_KEY on success
    - useBulkDeleteFindPhotos(): mutation hook → invalidates FINDS_QUERY_KEY on success
    - tauri-mocks: add delete_find_photo and bulk_delete_find_photos to invokeHandlers
      returning a stub FindRecord with photos: [] (same shape as existing mock records)
    - add_find_photos mock is already present — no change needed there
  </behavior>
  <action>
    In src/lib/finds.ts, after addFindPhotos, add:
    ```typescript
    export async function deleteFindPhoto(
      storagePath: string,
      photoId: number,
      deleteFile: boolean,
    ): Promise<Find> {
      return invoke<Find>('delete_find_photo', { storagePath, photoId, deleteFile });
    }

    export async function bulkDeleteFindPhotos(
      storagePath: string,
      photoIds: number[],
      deleteFiles: boolean,
    ): Promise<Find> {
      return invoke<Find>('bulk_delete_find_photos', { storagePath, photoIds, deleteFiles });
    }
    ```

    In src/hooks/useFinds.ts, add after useAddFindPhotos:
    ```typescript
    export function useDeleteFindPhoto() {
      const storagePath = useAppStore((s) => s.storagePath);
      const qc = useQueryClient();
      return useMutation({
        mutationFn: ({ photoId, deleteFile }: { photoId: number; deleteFile: boolean }) =>
          deleteFindPhoto(storagePath!, photoId, deleteFile),
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: [FINDS_QUERY_KEY, storagePath] });
        },
      });
    }

    export function useBulkDeleteFindPhotos() {
      const storagePath = useAppStore((s) => s.storagePath);
      const qc = useQueryClient();
      return useMutation({
        mutationFn: ({ photoIds, deleteFiles }: { photoIds: number[]; deleteFiles: boolean }) =>
          bulkDeleteFindPhotos(storagePath!, photoIds, deleteFiles),
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: [FINDS_QUERY_KEY, storagePath] });
        },
      });
    }
    ```

    In src/test/tauri-mocks.ts, add to invokeHandlers:
    ```typescript
    delete_find_photo: (_args: unknown) => ({
      id: 1, original_filename: 'shroom.jpg', species_name: 'Amanita muscaria',
      date_found: '2024-05-10', country: 'Croatia', region: 'Istria',
      location_note: '', lat: 45.1, lng: 13.9, notes: '', observed_count: null,
      observed_count_min: null, observed_count_max: null, is_favorite: false,
      created_at: '2024-05-10T14:00:00Z', photos: [],
    }),
    bulk_delete_find_photos: (_args: unknown) => ({
      // same shape, photos: []
    }),
    add_find_photos: (_args: unknown) => ({
      // already present — verify it's here, add if missing
    }),
    ```

    Verify with: `npx vitest run src/components/finds/EditFindDialog.test.tsx 2>&1 | tail -20`
    (existing tests should still pass after mocks are extended)
  </action>
  <verify>
    <automated>cd /Users/ivicaskrobo/Documents/GitHub/Bili-Mushroom && npx vitest run src/components/finds/EditFindDialog.test.tsx 2>&1 | tail -20</automated>
  </verify>
  <done>
    deleteFindPhoto and bulkDeleteFindPhotos exported from finds.ts.
    useDeleteFindPhoto and useBulkDeleteFindPhotos exported from useFinds.ts.
    Both invoke commands present in tauri-mocks.ts invokeHandlers.
    Existing EditFindDialog tests still pass.
  </done>
</task>

<task type="auto">
  <name>Task 3: UI — photo grid in EditFindDialog + delete button in PhotoLightbox</name>
  <files>src/components/finds/EditFindDialog.tsx, src/components/finds/PhotoLightbox.tsx</files>
  <action>
    ## EditFindDialog — existing photos grid

    The dialog currently has NO grid showing the find's existing photos. Add one above the
    "Add photos" button area. Use `find.photos` (already on the `Find` prop).

    Import: `useDeleteFindPhoto, useBulkDeleteFindPhotos` from hooks.
    Import: `resolvePhotoSrc` from `@/lib/photoSrc`.
    Import: `Trash2, CheckSquare` from lucide-react.

    State to add:
    ```typescript
    const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<number>>(new Set());
    ```
    Reset selectedPhotoIds in the `useEffect` that resets on `find` change.

    Hook up:
    ```typescript
    const deletePhotoMutation = useDeleteFindPhoto();
    const bulkDeletePhotosMutation = useBulkDeleteFindPhotos();
    ```

    Photo grid JSX (insert between the observed_count field and the folder/add-photos button row):
    ```tsx
    {find && find.photos.length > 0 && (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Photos ({find.photos.length})</label>
          {selectedPhotoIds.size > 0 && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                bulkDeletePhotosMutation.mutate(
                  { photoIds: [...selectedPhotoIds], deleteFiles: true },
                  { onSuccess: () => setSelectedPhotoIds(new Set()) },
                );
              }}
              disabled={bulkDeletePhotosMutation.isPending}
              className="h-7 gap-1 text-xs"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete {selectedPhotoIds.size} selected
            </Button>
          )}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {find.photos.map((photo) => {
            const selected = selectedPhotoIds.has(photo.id);
            const src = resolvePhotoSrc(storagePath!, photo.photo_path);
            return (
              <div
                key={photo.id}
                className={`group relative rounded overflow-hidden border aspect-square cursor-pointer transition-colors ${
                  selected ? 'border-primary ring-1 ring-primary' : 'border-border/40 hover:border-primary/40'
                }`}
                onClick={() => {
                  setSelectedPhotoIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(photo.id)) next.delete(photo.id); else next.add(photo.id);
                    return next;
                  });
                }}
              >
                <img
                  src={src}
                  alt={photo.photo_path.split('/').pop()}
                  className="w-full h-full object-cover"
                />
                {photo.is_primary && (
                  <span className="absolute bottom-0 left-0 right-0 bg-primary/80 text-[9px] text-center text-primary-foreground font-medium py-0.5">
                    Primary
                  </span>
                )}
                {/* Per-photo delete X — visible on hover when nothing is selected */}
                {selectedPhotoIds.size === 0 && (
                  <button
                    type="button"
                    aria-label="Delete photo"
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePhotoMutation.mutate({ photoId: photo.id, deleteFile: true });
                    }}
                    className="absolute top-1 right-1 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-rose-600 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                {/* Checkbox indicator when in multi-select mode */}
                {selected && (
                  <div className="absolute top-1 right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-2.5 w-2.5 text-primary-foreground" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    )}
    ```

    Add `Check` to the lucide-react import. `X` is already imported.

    Error alert for photo delete mutations — add after the existing addPhotosMutation error alert:
    ```tsx
    {deletePhotoMutation.isError && (
      <Alert variant="destructive" role="alert">
        <AlertDescription>{String(deletePhotoMutation.error)}</AlertDescription>
      </Alert>
    )}
    ```

    ## PhotoLightbox — delete current photo button

    Add `onDeletePhoto?: (photo: LightboxPhoto) => void` to `PhotoLightboxProps`.

    In the metadata panel's action button group (after the Edit Find button, before Set as cover),
    add a delete button — only render when `onDeletePhoto` is provided:

    ```tsx
    {onDeletePhoto && (
      <Button
        type="button"
        variant="outline"
        className="h-auto w-full justify-start gap-2 py-2 text-rose-500 hover:text-rose-400 hover:border-rose-500/40"
        onClick={() => { onDeletePhoto(current); onOpenChange(false); }}
      >
        <Trash2 className="h-4 w-4" />
        Delete photo
      </Button>
    )}
    ```

    Import `Trash2` from lucide-react in PhotoLightbox.

    ## Caller wiring (CollectionTab)

    PhotoLightbox is opened from CollectionTab. To wire up `onDeletePhoto` there:
    - Import `useDeleteFindPhoto` in CollectionTab.
    - Create `const deletePhotoMutation = useDeleteFindPhoto();`
    - Pass `onDeletePhoto={(lbp) => deletePhotoMutation.mutate({ photoId: lbp.photo.id, deleteFile: true })}`
      to the PhotoLightbox component.

    Check CollectionTab for the PhotoLightbox usage and wire accordingly (one-liner prop addition).
  </action>
  <verify>
    <automated>cd /Users/ivicaskrobo/Documents/GitHub/Bili-Mushroom && npx vitest run src/components/finds/ 2>&1 | tail -25</automated>
  </verify>
  <done>
    EditFindDialog shows a photo grid (4-column) when find.photos is non-empty.
    Each photo has a hover-reveal X delete button (single delete).
    Clicking photos toggles selection; "Delete N selected" button appears and calls bulk delete.
    "Add photos" button remains fully functional alongside the grid.
    PhotoLightbox renders a rose-toned "Delete photo" button in the metadata panel when onDeletePhoto prop is provided.
    CollectionTab passes onDeletePhoto to PhotoLightbox.
    All finds component tests pass.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Frontend → Rust IPC | photo_id values come from the frontend; must be validated as existing DB rows |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-wwb-01 | Tampering | delete_find_photo | mitigate | Rust command queries find_id from the DB before acting — cannot delete a photo belonging to a different find by guessing IDs |
| T-wwb-02 | Denial of Service | bulk_delete_find_photos | accept | Empty array guard returns early; no unbounded loops beyond the find's own photos |
| T-wwb-03 | Information Disclosure | trash::delete path | accept | Paths are stored in the app's own SQLite; no external data crosses the boundary |
</threat_model>

<verification>
- `cargo test -p bili-mushroom --lib -- commands::finds::tests` — all passes including 4 new photo-delete tests
- `npx vitest run src/components/finds/` — all component tests pass
- Manual: Open EditFindDialog on a find with 2+ photos → photo grid visible, X on hover deletes one, checkboxes + "Delete N selected" works, primary badge visible, Add photos still works
- Manual: Open PhotoLightbox → Delete photo button visible in metadata panel, clicking removes photo and closes lightbox
- Manual: After any deletion, collection refreshes (no stale data)
</verification>

<success_criteria>
- Two new Rust commands (delete_find_photo, bulk_delete_find_photos) with primary-promotion logic and 4 unit tests
- Two new TS wrappers and two new React hooks following established patterns
- EditFindDialog shows existing photo grid with per-photo delete + multi-select bulk delete + existing Add photos unchanged
- PhotoLightbox has optional onDeletePhoto prop, rendered as rose-toned button
- CollectionTab wires onDeletePhoto to lightbox
- All automated tests pass
- Forest Codex aesthetic: destructive actions use rose-500/rose-600 tones; amber for primary badge
</success_criteria>

<output>
After completion, create `.planning/quick/260508-wwb-per-photo-management-delete-single-delet/260508-wwb-SUMMARY.md`
with the standard summary template.
</output>
