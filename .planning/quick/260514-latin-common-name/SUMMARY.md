# Summary: split Latin and common mushroom names

## Done
- Added `species_profiles.common_name` migration and wired it through Rust create/import/update/profile commands.
- Added `Latinski naziv` and `Narodni naziv` fields to import, new find, edit find, and folder/species edit flows.
- Kept existing `species_name` as the stable Latin/main field so existing data is preserved.
- Added secondary common-name display in collection rows, find cards, species list/detail, and map popups.
- Removed comma-splitting display logic from map/zone/historical helpers so author strings with commas stay intact.

## Verification
- `npm.cmd test -- --run src/lib/speciesName.test.tsx`
- `npm.cmd run build`
- `cargo check` in `src-tauri`
