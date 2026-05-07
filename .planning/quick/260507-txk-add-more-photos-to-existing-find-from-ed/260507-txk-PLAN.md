---
phase: quick
plan: 260507-txk
type: execute
wave: 1
depends_on: []
files_modified:
  - src-tauri/src/commands/finds.rs
  - src-tauri/src/lib.rs
  - src/lib/finds.ts
  - src/hooks/useFinds.ts
  - src/components/finds/EditFindDialog.tsx
autonomous: true
requirements: [add-photos-to-existing-find]

must_haves:
  truths:
    - "User can select additional photos from EditFindDialog via file picker"
    - "Selected photos are copied to the same species folder as existing find photos"
    - "New photos get next sequence number and is_primary = false"
    - "Primary photo remains unchanged after adding photos"
    - "After success, finds query refreshes and dialog stays open showing new photos"
    - "On failure, error is shown, dialog stays open, existing photos unaffected"
  artifacts:
    - path: "src-tauri/src/commands/finds.rs"
      provides: "add_find_photos Tauri command"
      contains: "pub async fn add_find_photos"
    - path: "src/lib/finds.ts"
      provides: "addFindPhotos invoke wrapper"
      contains: "addFindPhotos"
    - path: "src/hooks/useFinds.ts"
      provides: "useAddFindPhotos mutation hook"
      contains: "useAddFindPhotos"
    - path: "src/components/finds/EditFindDialog.tsx"
      provides: "Add photos button + preview + confirmation UI"
  key_links:
    - from: "src/components/finds/EditFindDialog.tsx"
      to: "src/hooks/useFinds.ts"
      via: "useAddFindPhotos hook"
      pattern: "useAddFindPhotos"
    - from: "src/hooks/useFinds.ts"
      to: "src/lib/finds.ts"
      via: "addFindPhotos function"
      pattern: "addFindPhotos"
    - from: "src/lib/finds.ts"
      to: "src-tauri/src/commands/finds.rs"
      via: "invoke('add_find_photos')"
      pattern: "invoke.*add_find_photos"
---

<objective>
Add the ability to append additional photos to an existing find from the EditFindDialog.

Purpose: Users currently can only add photos during initial import. This feature lets them add more photos later (e.g., different angles, later visits) without creating a new find record.

Output: New Rust command `add_find_photos`, frontend wrapper + hook, and UI in EditFindDialog with file picker, preview, and confirmation.
</objective>

<execution_context>
@.claude/skills/frontend-design/SKILL.md
</execution_context>

<context>
@src-tauri/src/commands/finds.rs
@src-tauri/src/commands/import.rs (pattern reference for additional_photos handling, path_builder usage, insert_find_photo)
@src-tauri/src/commands/path_builder.rs
@src-tauri/src/lib.rs
@src/lib/finds.ts
@src/hooks/useFinds.ts
@src/components/finds/EditFindDialog.tsx
@src/components/import/ImportDialog.tsx (pattern reference for openDialog file picker usage)

<interfaces>
From src-tauri/src/commands/import.rs:
```rust
pub(crate) fn open_db(storage_path: &str) -> Result<Connection, String>;
pub(crate) fn insert_find_photo(conn: &Connection, find_id: i64, photo_path: &str, is_primary: bool) -> rusqlite::Result<i64>;
pub(crate) fn find_record_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<FindRecord>;
pub struct FindPhoto { pub id: i64, pub find_id: i64, pub photo_path: String, pub is_primary: bool }
pub struct FindRecord { /* all find fields + photos: Vec<FindPhoto> */ }
```

From src-tauri/src/commands/path_builder.rs:
```rust
pub fn build_dest_path(storage_root: &str, species: &str, date: &str, location_label: &str, seq: u32, ext: &str) -> PathBuf;
pub fn next_seq_for_folder(folder: &Path) -> u32;
pub fn resolve_location_component(value: &str, fallback: &str) -> String;
```

From src/lib/finds.ts:
```typescript
export interface Find { id: number; species_name: string; date_found: string; location_note: string; photos: FindPhoto[]; /* ... */ }
export interface FindPhoto { id: number; find_id: number; photo_path: string; is_primary: boolean; }
export const FINDS_QUERY_KEY = 'finds';
export const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.svg', '.tiff', '.tif', '.bmp', '.avif'];
```

From src/hooks/useFinds.ts (mutation pattern):
```typescript
export function useUpdateFind() {
  const storagePath = useAppStore((s) => s.storagePath);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateFindPayload) => updateFind(storagePath!, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [FINDS_QUERY_KEY, storagePath] }); },
  });
}
```

From ImportDialog.tsx (file picker pattern):
```typescript
import { open as openDialog } from '@tauri-apps/plugin-dialog';
const selected = await openDialog({
  multiple: true,
  filters: [{ name: 'Images', extensions: SUPPORTED_EXTENSIONS.map((ext) => ext.replace('.', '')) }],
});
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rust command + frontend wiring (add_find_photos)</name>
  <files>src-tauri/src/commands/finds.rs, src-tauri/src/lib.rs, src/lib/finds.ts, src/hooks/useFinds.ts</files>
  <action>
**Rust command in `src-tauri/src/commands/finds.rs`:**

Add a new `#[tauri::command]` function `add_find_photos`:

```rust
#[tauri::command]
pub async fn add_find_photos(
    storage_path: String,
    find_id: i64,
    source_paths: Vec<String>,
) -> Result<FindRecord, String>
```

Implementation:
1. `open_db(&storage_path)` to get connection
2. Query the find record to get `species_name`, `date_found`, `location_note` (needed for `build_dest_path`)
3. Query existing photos for the find to determine the destination folder: get the first photo's path, resolve its parent directory as the target folder. Use `Path::new(&storage_path).join(&first_photo_path).parent()` to get `dest_folder`.
4. For each `source_path` in `source_paths`:
   - Get extension from source path (default `.jpg`)
   - Call `next_seq_for_folder(dest_folder)` for sequence number
   - Call `build_dest_path(&storage_path, &species_name, &date_found, &location_label, seq, &ext)` to build destination
   - `std::fs::copy(&source_path, &dest_path)` (never delete source -- this is not import)
   - Compute relative path by stripping storage_path prefix, normalizing separators
   - Call `insert_find_photo(&conn, find_id, &relative_path, false)` (always `is_primary = false`)
5. After all copies+inserts, re-query the full find record with photos (same pattern as `set_find_favorite` -- query find row with `find_record_from_row`, then query photos, attach, return).
6. Return the updated `FindRecord`.

Use `location_note.trim()` for the location_label (same pattern as `import_find`). Import `build_dest_path`, `next_seq_for_folder` from `path_builder` (already imported in finds.rs via `resolve_location_component` -- add the other two).

**Register in `src-tauri/src/lib.rs`:**
Add `commands::finds::add_find_photos` to the `generate_handler![]` macro invocation, next to the other `commands::finds::*` entries.

**Frontend wrapper in `src/lib/finds.ts`:**
Add function:
```typescript
export async function addFindPhotos(
  storagePath: string,
  findId: number,
  sourcePaths: string[],
): Promise<Find> {
  return invoke<Find>('add_find_photos', { storagePath, findId, sourcePaths });
}
```

**Hook in `src/hooks/useFinds.ts`:**
Add `useAddFindPhotos` following the exact pattern of `useUpdateFind`:
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
Import `addFindPhotos` from `@/lib/finds` at the top of useFinds.ts.
  </action>
  <verify>
    <automated>cd /Users/ivicaskrobo/Documents/GitHub/Bili-Mushroom && cd src-tauri && cargo check 2>&1 | tail -5</automated>
  </verify>
  <done>
    - `add_find_photos` Rust command compiles and is registered in Tauri handler
    - `addFindPhotos` wrapper exists in finds.ts with correct invoke signature
    - `useAddFindPhotos` hook exists in useFinds.ts, invalidates finds query on success
  </done>
</task>

<task type="auto">
  <name>Task 2: EditFindDialog UI -- add photos button, preview, confirmation</name>
  <files>src/components/finds/EditFindDialog.tsx</files>
  <action>
**Follow Forest Codex aesthetic** (dark moss/amber theme, DM Sans body, amber accents).

Add "Add photos" flow to EditFindDialog. The UI has three states: idle (button only), preview (selected files shown), and adding (in-progress).

**State additions:**
```typescript
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { SUPPORTED_EXTENSIONS } from '@/lib/finds';
import { useAddFindPhotos } from '@/hooks/useFinds';
import { ImagePlus, X } from 'lucide-react';
```

Add state:
```typescript
const addPhotosMutation = useAddFindPhotos();
const [pendingPhotos, setPendingPhotos] = useState<string[]>([]);
```

Reset `pendingPhotos` to `[]` when `find` changes (add to the existing `useEffect` that calls `setForm`).

**File picker handler:**
```typescript
async function handlePickPhotos() {
  const selected = await openDialog({
    multiple: true,
    filters: [{ name: 'Images', extensions: SUPPORTED_EXTENSIONS.map((ext) => ext.replace('.', '')) }],
  });
  if (!selected) return;
  const paths = Array.isArray(selected) ? selected : [selected];
  setPendingPhotos(paths);
}
```

**Add photos handler:**
```typescript
function handleAddPhotos() {
  if (!find || pendingPhotos.length === 0) return;
  addPhotosMutation.mutate(
    { findId: find.id, sourcePaths: pendingPhotos },
    {
      onSuccess: () => {
        setPendingPhotos([]);
        // Dialog stays open -- finds query is invalidated by the hook
      },
    },
  );
}
```

**UI placement:** Add a new section between the existing "Open photo folder" button row and the Notes field. The section contains:

1. **When `pendingPhotos.length === 0`:** A ghost button with ImagePlus icon:
```tsx
<Button type="button" variant="ghost" size="sm" onClick={handlePickPhotos} className="flex items-center gap-1">
  <ImagePlus className="h-4 w-4" />
  Add photos
</Button>
```
Place this button in the existing `flex flex-wrap items-center gap-2` div that contains "Pick on map", "Open species folder", "Open photo folder" buttons.

2. **When `pendingPhotos.length > 0`:** Show a preview section below the button row:
```tsx
{pendingPhotos.length > 0 && (
  <div className="rounded-md border border-border/60 bg-card/50 p-3 space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">
        {pendingPhotos.length} photo{pendingPhotos.length > 1 ? 's' : ''} selected
      </span>
      <button
        type="button"
        onClick={() => setPendingPhotos([])}
        className="text-muted-foreground/60 hover:text-foreground transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
    <ul className="text-xs text-muted-foreground/70 space-y-0.5 max-h-24 overflow-y-auto">
      {pendingPhotos.map((p) => (
        <li key={p} className="truncate">{p.split(/[\\/]/).pop()}</li>
      ))}
    </ul>
    <Button
      size="sm"
      onClick={handleAddPhotos}
      disabled={addPhotosMutation.isPending}
      className="w-full"
    >
      {addPhotosMutation.isPending ? 'Adding...' : `Add ${pendingPhotos.length} photo${pendingPhotos.length > 1 ? 's' : ''}`}
    </Button>
  </div>
)}
```

3. **Error display:** Add after the existing `updateMutation.isError` alert:
```tsx
{addPhotosMutation.isError && (
  <Alert variant="destructive" role="alert">
    <AlertDescription>{String(addPhotosMutation.error)}</AlertDescription>
  </Alert>
)}
```

Place the preview section as a new div right after the button row div (outside the `flex flex-wrap` div, but inside the same parent `<div>` wrapper). Wrap the button row and the preview together in a single `<div className="space-y-2">`.
  </action>
  <verify>
    <automated>cd /Users/ivicaskrobo/Documents/GitHub/Bili-Mushroom && npx tsc --noEmit 2>&1 | tail -10</automated>
  </verify>
  <done>
    - EditFindDialog shows "Add photos" ghost button with ImagePlus icon alongside existing action buttons
    - Clicking "Add photos" opens native file picker filtered to image extensions
    - Selected files appear in a preview list showing filenames with count
    - User can dismiss selection with X button
    - "Add N photo(s)" confirmation button triggers the mutation
    - On success: pending photos cleared, dialog stays open, finds query refreshes (new photos visible)
    - On failure: error alert shown, dialog stays open, existing photos unaffected
    - All styling follows Forest Codex theme (dark bg, amber accents, DM Sans)
  </done>
</task>

</tasks>

<verification>
1. `cargo check` passes in src-tauri (Rust command compiles)
2. `npx tsc --noEmit` passes (TypeScript types check)
3. Manual test: open EditFindDialog for a find, click "Add photos", select images, confirm -- new photos appear in find's photo list without page reload
</verification>

<success_criteria>
- User can add photos to existing find from EditFindDialog
- Photos are copied (not moved) to the same species folder
- New photos get sequential numbering, is_primary = false
- Primary photo is never changed
- Dialog stays open after adding, showing updated photo count
- Errors display inline without closing dialog or affecting existing photos
</success_criteria>

<output>
After completion, create `.planning/quick/260507-txk-add-more-photos-to-existing-find-from-ed/260507-txk-SUMMARY.md`
</output>
