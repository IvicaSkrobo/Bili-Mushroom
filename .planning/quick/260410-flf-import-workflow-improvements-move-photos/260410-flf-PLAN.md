---
quick_id: 260410-flf
description: "Import workflow improvements: location_note field, species folder autocomplete, folder path in collection"
status: pending
created: 2026-04-10
---

# Quick Task 260410-flf: Import Workflow Improvements

## Scope

Five areas:
1. Photos already move to species folder (already working via path_builder) — no change needed
2. Block import when no species name — already done in recent commits — confirm wiring only
3. Species name autocomplete from existing folders when typing
4. Add "Location Mark" (oznaka mjesta) field next to Region
5. Show species folder path in Collection (FindCard)

Also fix incomplete migration 0004 wiring: Rust tests don't compile because `location_note` was added to structs but not to test initializers or UPDATE SQL.

---

## Task 1: Fix Rust location_note wiring

**Files:**
- `src-tauri/src/commands/import.rs`

**Action:**
1. Add `location_note: "".to_string()` to `make_find_record` in test_helpers
2. Add `location_note: "".to_string()` to `UpdateFindPayload` in both test initializers
3. Fix `update_find` SQL: add `location_note=?8` and shift `id` to `?9`
4. Fix `update_find` re-query: add `location_note` column to SELECT and map it

**Verify:** `cargo test` passes

---

## Task 2: Add location_note to TypeScript and UI

**Files:**
- `src/lib/finds.ts`
- `src/components/import/FindPreviewCard.tsx`
- `src/components/finds/EditFindDialog.tsx`
- `src/components/import/ImportDialog.tsx`

**Action:**
1. `finds.ts`: Add `location_note: string` to `ImportPayload`, `Find`, `UpdateFindPayload` interfaces
2. `ImportDialog.tsx`: Add `location_note: ''` in `buildInitialPayload`
3. `FindPreviewCard.tsx`: Add Location Mark input next to Region field (col-span-1)
4. `EditFindDialog.tsx`: Add `location_note` to `FormState`, `findToFormState`, initial state, `handleSave`, and UI (grid row with Region)

**Verify:** Location Mark field appears in import card and edit dialog

---

## Task 3: Species name autocomplete in ImportDialog

**Files:**
- `src/components/import/ImportDialog.tsx`

**Action:**
1. When `pending.length > 0 && storagePath`, read top-level directories from `storagePath` using `readDir` to get existing species folders
2. Filter on sharedName input (case-insensitive prefix match)
3. Show suggestions as a small list below the shared name input:
   - Each matching folder shown as a clickable suggestion chip
   - If no match and input is non-empty: show hint text "New folder will be created"
4. Clicking a suggestion sets `sharedName` to that folder name

**Verify:** Typing a partial species name shows matching folder suggestions

---

## Task 4: Show folder path in FindCard

**Files:**
- `src/components/finds/FindCard.tsx`
- `src/lib/finds.ts` (Find type already gets location_note from Task 2)

**Action:**
1. Derive `folderPath` from primary photo path: first segment before first `/`
2. Display it as a small badge/text below the species name in FindCard (e.g. `📁 Boletus_edulis`)

**Verify:** Collection shows folder name under species name for each find with a photo
