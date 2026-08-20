---
id: 260820-x57
slug: fix-species-cover-identity-loss-in-colle
date: 2026-08-20
mode: quick
status: planned
---

# Quick Task 260820-x57: Fix species cover identity loss in collection folder thumbnails

## Problem

The batched collection-folder thumbnail selection introduced in the uncommitted
performance refactor loses the identity of the *profile* species. A species cover is
stored as `species_profiles.cover_photo_id`, which points at a `find_photos` row. The
find that owns that photo can later be renamed or moved to a different species folder
(`bulk_rename_species`, `move_find_to_folder`), while the profile keeps pointing at it.
The previous per-species implementation (`load_representative_find_for_species`) looked
up `cover_find_id` for the species being processed and bound the result to *that*
species, so the cover stayed with its profile. The batched replacement does not.

Three distinct identity losses, all in `src-tauri/src/commands/import.rs`:

1. `load_explicit_cover_finds` filters `WHERE sp.species_name IN (...)` but builds its
   map from `record.species_name`, i.e. `f.species_name`.
2. `load_representative_finds_for_summaries` rebuilds the map key from
   `record.species_name` a second time after photo hydration, so even a corrected key
   from (1) would be discarded.
3. `hydrate_representative_find_photos` picks *which photo* of the representative find
   to show by joining `species_profiles sp ON sp.species_name = f.species_name` — again
   the find's species, not the folder's species. So a correctly selected cover find
   would still render the wrong photo.

Impact: the moved find's cover is attributed to the wrong folder, and because
`representatives.entry(species).or_insert(record)` runs afterwards, the wrongly-keyed
entry occupies the victim species' slot and that species loses its own correct
representative thumbnail too. Both folders render wrong.

## Approach

Carry the profile species name end-to-end instead of re-deriving it from the record.

1. `load_explicit_cover_finds`: append `sp.species_name` as a trailing column and key
   the returned map by it.
2. `load_representative_finds_for_summaries`: thread `Vec<(String, FindRecord)>`
   through hydration so the key is never rebuilt from the record.
3. `hydrate_representative_find_photos`: accept `&mut [(String, FindRecord)]`. Drop the
   `species_profiles`-on-`f.species_name` join from the photo query. Instead:
   - one query for the default photo per find (`is_primary DESC, id ASC`, rank 1),
   - one query mapping profile species → its cover photo row,
   - in Rust, prefer the profile's cover photo when it belongs to this record's find,
     otherwise fall back to the default photo.

Both queries stay bounded by the existing page size; no new N+1.

## Tasks

- [ ] T1 — Key `load_explicit_cover_finds` by `sp.species_name`
- [ ] T2 — Thread `(profile_species, FindRecord)` pairs through
      `load_representative_finds_for_summaries` without rebuilding keys
- [ ] T3 — Rework `hydrate_representative_find_photos` to select the cover photo by
      profile species rather than by the find's own species
- [ ] T4 — Regression test: a cover whose find was reassigned to another species must
      still represent the original profile species, and the receiving species must keep
      its own correct representative

## Verification

- `cargo check --all-targets` clean.
- Existing `collection_folders_batch_selection_preserves_cover_and_photo_fallbacks`
  must still pass unchanged.
- New regression test asserts both directions.

Known limitation of this machine: `cargo test` cannot execute — the test binary aborts
at startup with `STATUS_ENTRYPOINT_NOT_FOUND` (0xc0000139). Rust tests are written and
compile-verified here but must be run elsewhere.

## Scope

`src-tauri/src/commands/import.rs` only. Frontend test files are being edited
concurrently by another agent and must not be touched. Nothing is committed by this
task — the working tree holds a large uncommitted performance refactor that will be
split into separate commits afterwards.
