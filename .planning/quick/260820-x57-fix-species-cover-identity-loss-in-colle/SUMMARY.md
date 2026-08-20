---
id: 260820-x57
slug: fix-species-cover-identity-loss-in-colle
date: 2026-08-21
mode: quick
status: complete
committed: false
---

# Summary — Fix species cover identity loss in collection folder thumbnails

## What changed

`src-tauri/src/commands/import.rs` only. Nothing committed — the fix sits on top of the
large uncommitted performance refactor, which is to be split into separate commits next.

1. **`load_explicit_cover_finds` keys by the profile's species.** The query already
   filtered `WHERE sp.species_name IN (...)`; it now also selects `sp.species_name` as a
   trailing column and keys the returned map by it instead of by `record.species_name`
   (= `f.species_name`).

2. **`load_representative_finds_for_summaries` no longer rebuilds the key.** Records are
   threaded through hydration as `Vec<(profile_species, FindRecord)>` pairs, so the
   corrected key survives.

3. **`hydrate_representative_find_photos` selects the cover photo by profile species.**
   The old query joined `species_profiles sp ON sp.species_name = f.species_name`, which
   picked the wrong photo whenever the cover's find had moved. It now takes one query for
   the default photo per find and a new `load_cover_photos_by_species` for the explicit
   covers, combining them in Rust: the profile's cover wins when it belongs to this
   record's find, otherwise the default photo. This adds exactly one constant-cost batch
   query (the old code did the cover selection inside a single window-function query);
   still bounded per page, still no N+1.

4. **Regression test** `collection_folder_cover_stays_with_its_profile_after_the_find_moves_species`:
   a find holding Boletus' cover is moved into the Cantharellus folder; Boletus must still
   show that find *and* its chosen cover photo, and Cantharellus must keep its own latest
   photographed find. Both directions asserted.

5. **Fixed the broken test harness.** `setup_in_memory_db` ran
   `ALTER TABLE finds ADD COLUMN edibility_note TEXT` labelled "migration 0017", but
   `MIGRATION_0014` already adds that column, so every test using the helper panicked with
   `duplicate column name: edibility_note`. Migration 0017 is a guarded repair path in
   `migrate_db` and must not run unconditionally in tests. This line came from the
   uncommitted refactor (not present at HEAD) and meant its own
   `collection_folders_batch_selection_preserves_cover_and_photo_fallbacks` test had never
   executed.

## Verification

- `cargo check --all-targets` — clean.
- Rust lib suite now **runs on this machine** (see below): **92 passed, 5 failed, 1 ignored**.
- Regression proof: with the profile-species key reverted, the new test fails
  (`left: 2, right: 1` — Boletus gets the wrong find); with the fix it passes.
- `collection_folders_batch_selection_preserves_cover_and_photo_fallbacks` passes both
  before and after, so the batch selection order is unchanged.

### Why `cargo test` previously could not start — and how it was unblocked

The test binary aborted at load with `STATUS_ENTRYPOINT_NOT_FOUND` (0xc0000139). Root
cause: the unit-test executable carries no application manifest, so Windows resolves
`comctl32.dll` to the System32 v5.82 build, which does not export `TaskDialogIndirect`
(nor `RemoveWindowSubclass`) that the Tauri dependency chain imports. The app binary is
fine because its manifest binds the Common-Controls v6 side-by-side assembly.

Unblocked here by embedding that manifest into the built test executables with
`mt.exe -manifest comctl6.manifest -outputresource:<exe>;#1`. This only patches artifacts
under `target/`, so it must be repeated after each rebuild. A durable fix would embed the
manifest at link time via `.cargo/config.toml` rustflags
(`-Clink-arg=/MANIFEST:EMBED -Clink-arg=/MANIFESTINPUT:<manifest>`) — proposed as a
separate task, not done here.

### Pre-existing failures (not caused by this task, all previously invisible)

| Test | Problem |
|------|---------|
| `smoke::test_migrate_db_creates_schema_on_fresh_db` | asserts `user_version == 22`, schema is at 26 |
| `commands::tile_cache_db::tests::test_migration_v10_creates_table` | asserts `user_version == 17`, schema is at 26 |
| `commands::import::tests::test_insert_find_photo_rejects_absolute_and_parent_paths` | `insert_find_photo` accepts absolute/parent paths it is asserted to reject |
| `commands::finds::tests::test_upsert_and_get_species_profile_synonyms_other_names` | unchanged code, fails on its own assertion |
| `commands::path_builder::tests::test_build_dest_path_formatted_species_strips_markers` | unchanged code, fails on its own assertion |

The two version assertions are stale. The `insert_find_photo` one looks like a real
validation gap worth its own task.

## Follow-ups

- Split the uncommitted refactor into coherent commits (schema repair, collection
  batching, stats batching, async offloading, thumbnail/UI), then this fix.
- Durable manifest embedding so `cargo test` works without the `mt.exe` step.
- Triage the five pre-existing Rust test failures.
