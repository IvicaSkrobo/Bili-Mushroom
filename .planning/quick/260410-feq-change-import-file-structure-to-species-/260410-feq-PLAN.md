---
type: quick
description: Change import file structure to species-only folder, require species name to import, add location_note field with DB migration
files_modified:
  - src-tauri/src/commands/path_builder.rs
  - src-tauri/src/commands/import.rs
  - src-tauri/src/commands/finds.rs
  - src-tauri/migrations/0004_location_note.sql
  - src/lib/finds.ts
  - src/components/import/ImportDialog.tsx
  - src/components/import/FindPreviewCard.tsx
  - src/components/finds/EditFindDialog.tsx
  - src/components/finds/FindCard.tsx
  - src/test/tauri-mocks.ts
---

<objective>
Three related changes to the import workflow:
1. Simplify file storage from `<country>/<region>/<date>/<species>_<date>_<seq>.ext` to `<species_folder>/<date>_<seq>.ext`
2. Require species name before import (gate the Import button)
3. Add `location_note` text field across DB, Rust structs, TS types, and all relevant UI

Purpose: Cleaner file organization by species, enforce data quality at import time, and give foragers a free-text "oznaka mjesta" field for spot-level location notes.
</objective>

<context>
@src-tauri/src/commands/path_builder.rs
@src-tauri/src/commands/import.rs
@src-tauri/src/commands/finds.rs
@src/lib/finds.ts
@src/components/import/ImportDialog.tsx
@src/components/import/FindPreviewCard.tsx
@src/components/finds/EditFindDialog.tsx
@src/components/finds/FindCard.tsx
@src/test/tauri-mocks.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Simplify build_dest_path to species-only folder structure</name>
  <files>src-tauri/src/commands/path_builder.rs, src-tauri/src/commands/import.rs</files>
  <action>
**path_builder.rs:**

1. Change `build_dest_path` signature to remove `country` and `region` params. New signature:
```rust
pub fn build_dest_path(
    storage_root: &str,
    species: &str,
    date: &str,
    seq: u32,
    ext: &str,
) -> PathBuf
```

2. Implementation: `species_folder` = `resolve_location_component(species, "unknown_species")`. Build path as `storage_root / species_folder / date_seq.ext` where filename = `format!("{}_{:03}{}", date, seq, ext)`.

3. The `resolve_location_component` function stays as-is (still useful for species fallback). Can remove the doc comment mentioning country/region from the module if desired.

4. Update ALL tests in `mod tests`:
   - `test_build_dest_path_standard`: call with 5 args, assert path contains `Boletus_edulis` folder and `2024-05-10_001.jpg` filename. Remove country/region assertions.
   - `test_build_dest_path_empty_country_uses_fallback`: rename to `test_build_dest_path_empty_species_uses_fallback`, call with empty species, assert `unknown_species` in path.
   - All other tests (sanitize, resolve, next_seq) remain unchanged.

**import.rs:**

5. Update ALL 4 call sites of `build_dest_path` in `import_find` (2 for primary photo seq computation + actual copy, 2 for additional_photos):
   - Remove `&payload.country` and `&payload.region` arguments
   - New calls: `build_dest_path(&storage_path, &payload.species_name, &payload.date_found, seq, &ext)`

6. The `dest_folder` computation changes too. Since the new structure is `storage_root/species_folder/`, the folder for `next_seq_for_folder` is the species folder (not date folder). For the initial seq-probe call, build with seq=1 and take `.parent()` as before — this will give `storage_root/species_folder/` which is correct.
  </action>
  <verify>
    <automated>cd /Users/ivicaskrobo/Documents/GitHub/Bili-Mushroom && cargo test --manifest-path src-tauri/Cargo.toml -p bili-mushroom -- path_builder 2>&1 | tail -20</automated>
  </verify>
  <done>build_dest_path takes 5 params (no country/region), produces species_folder/date_seq.ext paths, all path_builder tests pass, all import.rs call sites updated.</done>
</task>

<task type="auto">
  <name>Task 2: Require species name before import</name>
  <files>src/components/import/ImportDialog.tsx</files>
  <action>
In ImportDialog.tsx:

1. After the existing `allDatesSet` line (line 94), add:
```typescript
const allNamed = pending.length > 0 && pending.every((item) => item.payload.species_name.trim() !== '');
```

2. Update `canImport` (line 95) to:
```typescript
const canImport = pending.length > 0 && allDatesSet && allNamed && !importing;
```

3. Add a validation message in the DialogFooter, just above the Import All button. Show it when `pending.length > 0 && !allNamed`:
```tsx
{pending.length > 0 && !allNamed && (
  <p className="text-sm text-destructive">All photos must have a mushroom name before importing.</p>
)}
```

Place this inside the DialogFooter div, before the Button. The DialogFooter uses flex, so wrap both in a div with `className="flex flex-col items-end gap-2 w-full"` or put the message just before DialogFooter in the existing structure.
  </action>
  <verify>
    <automated>cd /Users/ivicaskrobo/Documents/GitHub/Bili-Mushroom && npx vitest run src/components/import/ImportDialog 2>&1 | tail -20</automated>
  </verify>
  <done>Import button is disabled when any pending item has empty species_name. Validation message appears when species names are missing. Existing tests still pass.</done>
</task>

<task type="auto">
  <name>Task 3: Add location_note DB migration and Rust struct updates</name>
  <files>src-tauri/migrations/0004_location_note.sql, src-tauri/src/commands/import.rs</files>
  <action>
**Create `src-tauri/migrations/0004_location_note.sql`:**
```sql
ALTER TABLE finds ADD COLUMN location_note TEXT NOT NULL DEFAULT '';
```

**import.rs changes:**

1. Add migration constant after the existing ones (line ~63):
```rust
const MIGRATION_0004: &str = include_str!("../../migrations/0004_location_note.sql");
```

2. In `migrate_db`, after the `if version < 3` block, add:
```rust
if version < 4 {
    conn.execute_batch(MIGRATION_0004)
        .map_err(|e| format!("Migration 0004 failed: {}", e))?;
    conn.execute_batch("PRAGMA user_version = 4")
        .map_err(|e| format!("Failed to set user_version=4: {}", e))?;
}
```

3. Add `location_note: String` field to `ImportPayload` struct (with `#[serde(default)]` so existing callers without it still work):
```rust
#[serde(default)]
pub location_note: String,
```

4. Add `location_note: String` field to `FindRecord` struct.

5. Add `location_note: String` field to `UpdateFindPayload` struct.

6. Update `insert_find_row` — add `location_note` to the INSERT:
```sql
INSERT INTO finds (original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, created_at)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
```
Add `record.location_note` to the params (position 9, shift created_at to 10).

7. Update ALL SELECT queries that create `FindRecord` — there are 3 locations:
   - `get_finds` (line ~311): add `location_note` to SELECT, read as `row.get(9)?`, shift `created_at` to `row.get(10)?` (column index 10 since it was previously 9).
   - `update_find` query_row (line ~409): same pattern — add location_note to SELECT, adjust indices.
   - `update_find_on_conn` in tests (line ~728): same pattern.

8. Update the UPDATE statement in `update_find` (line ~390) and `update_find_on_conn` (line ~710):
```sql
UPDATE finds SET species_name=?1, date_found=?2, country=?3, region=?4, lat=?5, lng=?6, notes=?7, location_note=?8 WHERE id=?9
```
Shift `payload.id` param to position 9, add `payload.location_note` at position 8.

9. Update `FindRecord` construction in `import_find` (line ~222): add `location_note: payload.location_note.clone()`.

10. Update `test_helpers::setup_in_memory_db` to also run MIGRATION_0004:
    - Add `const MIGRATION_0004` in the test_helpers module
    - Add `conn.execute_batch(MIGRATION_0004).expect("migration 0004");`

11. Update `test_helpers::make_find_record` to include `location_note: "".to_string()`.

12. Update `UpdateFindPayload` in test `test_update_find_changes_all_editable_fields` and `test_update_find_returns_err_for_nonexistent_id` to include `location_note: String` field.
  </action>
  <verify>
    <automated>cd /Users/ivicaskrobo/Documents/GitHub/Bili-Mushroom && cargo test --manifest-path src-tauri/Cargo.toml -p bili-mushroom 2>&1 | tail -30</automated>
  </verify>
  <done>Migration 0004 created. migrate_db runs it for version < 4. FindRecord, ImportPayload, UpdateFindPayload all have location_note. All INSERT/SELECT/UPDATE queries include location_note. All Rust tests pass.</done>
</task>

<task type="auto">
  <name>Task 4: Add location_note to TypeScript types and all UI components</name>
  <files>src/lib/finds.ts, src/components/import/ImportDialog.tsx, src/components/import/FindPreviewCard.tsx, src/components/finds/EditFindDialog.tsx, src/components/finds/FindCard.tsx, src/test/tauri-mocks.ts</files>
  <action>
**finds.ts:**
1. Add `location_note: string;` to `ImportPayload` interface (after `region`).
2. Add `location_note: string;` to `Find` interface (after `region`).
3. Add `location_note: string;` to `UpdateFindPayload` interface (after `region`).

**ImportDialog.tsx:**
4. In `buildInitialPayload`, add `location_note: ''` to the returned object.
5. In the shared header bar (the `div` with `bg-muted/50` class, around line 211), add a second row or inline input for location_note. Add after the existing shared name Input, inside the same flex container. Use a compact Input:
```tsx
<Input
  className="w-48"
  placeholder="Location note"
  value={sharedLocationNote}
  onChange={(e) => setSharedLocationNote(e.target.value)}
/>
```
6. Add state: `const [sharedLocationNote, setSharedLocationNote] = useState('');`
7. Add a useEffect to cascade sharedLocationNote to all pending items (same pattern as sharedName):
```typescript
useEffect(() => {
  if (sharedLocationNote === '') return;
  setPending((prev) =>
    prev.map((item) => ({ ...item, payload: { ...item.payload, location_note: sharedLocationNote } })),
  );
}, [sharedLocationNote]);
```

**FindPreviewCard.tsx:**
8. Add a location_note Input field in the card's fields grid, after the Region input. Single line, compact:
```tsx
<div>
  <Input
    placeholder="Location note"
    value={payload.location_note}
    onChange={(e) => updateField('location_note', e.target.value)}
  />
</div>
```
Place it in the same row as Region (make them share the 2-column grid row, or put location_note in its own row after country/region).

**EditFindDialog.tsx:**
9. Add `location_note: string;` to the `FormState` interface.
10. In `findToFormState`, add `location_note: find.location_note`.
11. In the initial state, add `location_note: ''`.
12. Add an Input field for location_note in the form, after the Country/Region grid row:
```tsx
<div>
  <label className="text-sm font-medium">Location note</label>
  <Input
    value={form.location_note}
    onChange={(e) => handleChange('location_note', e.target.value)}
    placeholder="Location note"
  />
</div>
```
13. In `handleSave`, include `location_note: form.location_note` in the mutation payload.

**FindCard.tsx:**
14. After the line that shows `{find.country} / {find.region}` (line ~53), conditionally display location_note if non-empty:
```tsx
{find.location_note && (
  <p className="text-xs text-muted-foreground italic">{find.location_note}</p>
)}
```

**tauri-mocks.ts:**
15. Add `location_note: ''` to the `update_find` mock return object (line ~24-36).
  </action>
  <verify>
    <automated>cd /Users/ivicaskrobo/Documents/GitHub/Bili-Mushroom && npx vitest run 2>&1 | tail -20</automated>
  </verify>
  <done>location_note appears in all TS interfaces. ImportDialog has shared location_note input with cascade. FindPreviewCard has per-card location_note input. EditFindDialog reads/writes location_note. FindCard displays location_note. All frontend tests pass.</done>
</task>

</tasks>

<verification>
1. `cargo test --manifest-path src-tauri/Cargo.toml -p bili-mushroom` — all Rust tests pass (path_builder, import, finds)
2. `npx vitest run` — all frontend tests pass
3. Manual: open app, pick photos, verify species name is required before Import button enables
4. Manual: import a photo, check file lands in `storagePath/Species_Name/date_seq.ext` structure
5. Manual: verify location_note field appears in import dialog (shared + per-card), edit dialog, and find card display
</verification>
