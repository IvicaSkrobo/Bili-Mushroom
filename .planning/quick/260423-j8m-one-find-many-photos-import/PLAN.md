---
phase: quick
plan: 260423-j8m
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/import/ImportDialog.tsx
  - src/components/import/FindPreviewCard.tsx
  - src/components/import/PostImportReviewDialog.tsx
  - src/components/import/ImportDialog.test.tsx
  - src/components/import/FindPreviewCard.test.tsx
  - src/lib/finds.ts
autonomous: true
must_haves:
  truths:
    - "Selecting multiple photos in one import session can be saved as one find with many photos"
    - "Location, date, location note, notes, and observed count are stored on the parent find, not duplicated as separate finds per photo"
    - "Rust import already supports one primary photo plus additional_photos on the same find; frontend must use that path"
    - "Existing finds are considered merge candidates only when species_name matches, date_found matches, and location is within 300 meters"
    - "Matching older finds must produce a user-facing merge suggestion, not a silent auto-merge"
    - "Manual per-photo review remains possible before import, but the default flow is one grouped observation"
  artifacts:
    - path: "src/components/import/ImportDialog.tsx"
      provides: "Grouped import flow that sends one ImportPayload with additional_photos"
    - path: "src/components/import/FindPreviewCard.tsx"
      provides: "Primary-photo-focused preview copy/UI for grouped imports"
    - path: "src/components/import/PostImportReviewDialog.tsx"
      provides: "Review summary aligned with one-find-many-photos imports"
    - path: "src/components/import/ImportDialog.test.tsx"
      provides: "Regression coverage for grouped payload creation"
  key_links:
    - from: "ImportDialog pending state"
      to: "Rust import_find command"
      via: "ImportPayload.additional_photos"
    - from: "Import review summary"
      to: "Imported find.photos"
      via: "find.photos.length rather than one record per selected file"
---

<objective>
Convert the import workflow from "one photo = one find" to "one import batch = one find with many photos" for the common field-use case where multiple photos document the same mushroom find.

Purpose: Match user expectation that five photos of the same mushroom at one place/time should create one observation with multiple attached photos, while also offering a safe merge suggestion when the same mushroom/date/nearby-location likely already exists in the library.
Output: Updated import flow and tests, without changing historical data or adding automatic global deduplication.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/import/ImportDialog.tsx
@src/components/import/FindPreviewCard.tsx
@src/components/import/PostImportReviewDialog.tsx
@src/components/import/ImportDialog.test.tsx
@src/lib/finds.ts
@src-tauri/src/commands/import.rs

<findings>
- Current UI explicitly says each photo is imported as its own find (`import.summaryHint`).
- Rust backend already supports grouped import via `ImportPayload.additional_photos`.
- `find_photos` already models many photos per find, so the main gap is frontend payload construction and import UX.
- Hard auto-merging by date+location is risky because separate finds can happen on the same day in the same place.
- User-confirmed merge heuristic for existing finds: same `species_name`, same `date_found`, and location within 300 meters should trigger a suggestion, not a forced merge.
</findings>

<interfaces>
From `src/lib/finds.ts`:
```typescript
export interface ImportPayload {
  source_path: string;
  original_filename: string;
  species_name: string;
  date_found: string;
  country: string;
  region: string;
  location_note: string;
  lat: number | null;
  lng: number | null;
  notes: string;
  observed_count: number | null;
  additional_photos: string[];
}
```

From `src-tauri/src/commands/import.rs`:
- `payload.source_path` becomes the primary photo
- `payload.additional_photos` are copied into the same destination folder and inserted into `find_photos` with `is_primary=false`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Reframe ImportDialog around one grouped find</name>
  <files>src/components/import/ImportDialog.tsx, src/lib/finds.ts</files>
  <action>
Replace the current `PendingItem[]` model with a grouped-import model that treats the selected images as photos belonging to one draft find.

Implementation direction:
1. Introduce a single draft payload object plus a photo queue:
   - one `ImportPayload` for the parent find
   - one ordered list of selected source photos
2. Preserve the first selected photo as `source_path` / `original_filename`.
3. Map all remaining selected paths into `additional_photos`.
4. Keep EXIF-assisted defaults:
   - use the first photo's EXIF date/lat/lng as the draft default
   - when folder import is used, continue to prefill shared species name from the folder name
5. Keep shared header fields, but they now edit the single grouped draft instead of cascading across many card payloads.
6. Update import submission so `importFind(storagePath, [draftPayload], deleteSource)` sends exactly one payload for one grouped find.
7. Adjust empty/validation logic:
   - species name required once
   - date required once
   - import button text/counts can still refer to selected photos, but imported find count should be `1`
8. Update hint copy in i18n or inline usage so the dialog no longer promises one find per photo.

Do not add silent automatic merging against already-imported records in the DB during this task. Grouping is explicit within the active import session, and older records are merged only after an explicit user choice.
  </action>
  <verify>
Run `npx vitest src/components/import/ImportDialog.test.tsx` and `npx tsc --noEmit`.
  </verify>
  <done>
Selecting multiple photos produces one ImportPayload with `additional_photos` populated, and import sends one grouped find instead of N separate finds.
  </done>
</task>

<task type="auto">
  <name>Task 2: Simplify preview UI for grouped photo sets</name>
  <files>src/components/import/FindPreviewCard.tsx, src/components/import/FindPreviewCard.test.tsx</files>
  <action>
Update the import preview card to represent a grouped find instead of an individual photo record.

Implementation direction:
1. Show the primary photo prominently and indicate how many extra photos are attached.
2. Add a compact strip, counter, or text label such as "+4 more photos" so the grouped nature is obvious before import.
3. Keep editing for species/date/location/note fields on the grouped draft.
4. Keep the map picker tied to the grouped find's location.
5. If removing photos from the queue is still supported, removing the primary photo should promote the next photo to become the new primary and rebuild `source_path` / `original_filename` / `additional_photos`.
6. Ensure copy/labels talk about the grouped find, not one photo equaling one find.

Avoid reintroducing per-photo metadata editing in this task; the user's requirement is one observation-level location/date assignment.
  </action>
  <verify>
Run `npx vitest src/components/import/FindPreviewCard.test.tsx`.
  </verify>
  <done>
The preview card clearly communicates that one find contains multiple selected photos, with one editable observation-level metadata form.
  </done>
</task>

<task type="auto">
  <name>Task 3: Add merge suggestion for matching older finds</name>
  <files>src/components/import/ImportDialog.tsx, src/hooks/useFinds.ts, src/lib/finds.ts, src/components/import/ImportDialog.test.tsx</files>
  <action>
Add a user-facing merge suggestion when the grouped draft looks like it belongs to an existing find.

Implementation direction:
1. Evaluate existing finds in the library after the draft has:
   - `species_name`
   - `date_found`
   - `lat/lng`
2. A find is a merge candidate only when:
   - `species_name` matches case-insensitively
   - `date_found` matches exactly
   - both records have coordinates and the distance is within 300 meters
3. If one or more candidates exist, show a clear choice before final import:
   - `Add photos to existing find`
   - `Create new find`
4. Default selection may favor merging, but the final action must remain explicit.
5. If the user chooses merge:
   - append the grouped draft photos to the chosen existing find
   - do not create a new find row
6. If the user chooses new:
   - continue with normal grouped import and create a new find
7. If draft coordinates are missing, skip merge suggestion entirely for v1.

If the current backend has no command for attaching photos to an existing find, add the smallest new command needed rather than overloading `import_find` with ambiguous behavior.
  </action>
  <verify>
Run `npx vitest src/components/import/ImportDialog.test.tsx` and `npx tsc --noEmit`.
  </verify>
  <done>
When a same-species, same-date, within-300m find already exists, import flow asks whether to merge into the old find or create a new one.
  </done>
</task>

<task type="auto">
  <name>Task 4: Align post-import review and regression tests</name>
  <files>src/components/import/PostImportReviewDialog.tsx, src/components/import/ImportDialog.test.tsx</files>
  <action>
Update review and tests so they reflect grouped-import semantics.

Implementation direction:
1. Ensure the post-import review title/summary reports:
   - `1 find`
   - `N photos`
   when a grouped import is used.
2. Keep thumbnail selection based on the primary photo, but show attached-photo count from `find.photos.length`.
3. Add tests that verify:
   - picking multiple files results in one import payload
   - the payload contains `additional_photos` for all but the first selected file
   - matching existing find inside 300m shows merge suggestion instead of silent merge
   - choosing merge appends to existing find; choosing new creates a fresh grouped find
   - the review dialog reflects one imported find and the correct total photo count
4. Remove or update assertions that expect one preview card per selected file.

Do not migrate historical imported records in this task. Existing older one-photo-per-find data remains valid.
  </action>
  <verify>
Run `npx vitest src/components/import/ImportDialog.test.tsx src/components/import/PostImportReviewDialog.test.tsx` if the latter exists, then `npx tsc --noEmit`.
  </verify>
  <done>
Regression tests protect the grouped-import behavior, and review UI no longer implies one imported find per selected image.
  </done>
</task>

</tasks>

<verification>
1. Select 5 photos in the import dialog, fill species/date/location once, import, and confirm the collection gains exactly 1 new find.
2. Open that find in collection/lightbox and confirm it contains all 5 photos.
3. Confirm map pin count increases by 1, not 5, for the grouped import.
4. Confirm the post-import review says `1 find, 5 photos`.
5. Confirm importing a single photo still works and produces one find with one photo.
6. Confirm an existing find with same species, same date, and location within 300m triggers a merge suggestion.
7. Confirm choosing merge adds the new photos to the existing find instead of creating a duplicate record.
8. Confirm choosing new still creates a separate find even when the candidate match exists.
9. Confirm there is no merge suggestion when species differs, date differs, or location is beyond 300m.
</verification>
