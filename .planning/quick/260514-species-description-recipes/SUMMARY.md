# Summary

## Outcome
- Renamed the user-facing edibility note concept to species description.
- Added `species_profiles.description` and migrated existing `edibility_note` values into it.
- Create, edit, import, folder edit, and species profile UI now use `Opis vrste`.
- Added `species_recipes` persistence and recipe CRUD commands.
- Recipes are edited in the Species tab, not in the Collection folder editor.

## Verification
- `npm.cmd test -- src/components/finds/CreateFindDialog.test.tsx src/components/finds/EditFindDialog.test.tsx src/components/import/ImportDialog.test.tsx src/components/finds/SpeciesNameEditor.test.tsx`
- `npm.cmd run build`
- `cargo check`

## Notes
- `cargo test` compiled but the test binary exited with `STATUS_ENTRYPOINT_NOT_FOUND` in this Windows/Tauri environment.

