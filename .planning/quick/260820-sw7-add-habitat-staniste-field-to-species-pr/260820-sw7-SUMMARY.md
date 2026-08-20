---
quick_id: 260820-sw7
status: complete
date: 2026-08-20
commits:
  - 931fadc feat(species): persist habitat field on species profiles
  - 5c27e02 feat(species): add Stanište (habitat) editor to species detail
---

# Quick Task 260820-sw7 — Summary

Species profiles now carry a second free-text field, `habitat` ("Stanište"),
alongside `description` ("Opis").

## What changed

**Persistence (commit 931fadc)**
- `src-tauri/migrations/0023_species_profile_habitat.sql` — `ALTER TABLE species_profiles ADD COLUMN habitat TEXT`
- `import.rs` — `MIGRATION_0023` registered, `if version < 23` guarded block (`PRAGMA user_version = 23`),
  plus the idempotent repair block used for `synonyms`/`other_names` so local DBs whose
  `user_version` already advanced still gain the column.
- `finds.rs` — `SpeciesProfile.habitat`, SELECT + row mapping, `upsert_species_profile` param,
  INSERT `?14` and `habitat = excluded.habitat` (plain excluded, so the field can be cleared).
- `finds.ts` / `useFinds.ts` — interface field, wrapper arg, mutation variable.
- Call sites updated to pass the stored habitat so they don't clobber it:
  CollectionTab (folder rename, cover pick), CreateFindDialog, EditFindDialog, ImportDialog.

**UI (commit 5c27e02)**
- `SpeciesTab.tsx` — `habitat` added to the detail tab strip after `description`;
  auto-growing textarea saving on blur, styled identically to the description editor;
  `speciesHabitatInput` state reset on species switch; all seven profile mutations in the
  tab now send `habitat: profileHabitat`.
- `i18n/index.ts` — `species.tabHabitat` and `edit.speciesHabitatPlaceholder` (hr + en).

## Verification

- `npx tsc --noEmit` — clean
- `cargo check` — clean
- `npx vitest run` — 324 passed, 13 failed; all 13 failures reproduce identically on a
  stashed (pre-change) tree, so they are pre-existing and unrelated.
- `cargo test` — could not run: the test binary aborts at load with
  `STATUS_ENTRYPOINT_NOT_FOUND` (0xc0000139) before any test executes. Environment/linking
  issue on this machine, not a code failure.

## Notes / out of scope

- Habitat is not yet included in PDF/CSV export.
- Habitat is species-level only; individual finds are unchanged.
