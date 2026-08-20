---
id: 260821-0fy
slug: add-get-species-options-and-move-the-thr
date: 2026-08-21
mode: quick
status: planned
---

# Quick Task 260821-0fy: `get_species_options` for the three dialogs

## Problem

`CreateFindDialog`, `EditFindDialog` and `ImportDialog` each call bare `useFinds()`
and `useSpeciesProfiles()`. `get_finds` without a `limit` uses `unwrap_or(i64::MAX)`,
so every dialog open pulls the entire library — all finds, every text column, with
primary photo rows hydrated — plus every species profile including descriptions,
synonyms and habitat. What they actually need from that payload is:

- the set of species names that already exist (for the "new species?" hint),
- a sorted, de-duplicated list of species names for autocomplete,
- common names / synonyms / other names to match against while typing,
- the distinct `location_note` values,
- the **full** profile of the one species the user has selected, so the profile
  upsert on save is a read-modify-write rather than a field wipe.

After this change the Collection, Species, Map and Stats screens are the only
remaining full-library readers — and all four already carry filters. These three
dialogs are the last unbounded ones.

## Approach

New Rust command `get_species_options`: the union of species names from `finds` and
`species_profiles`, each with `common_name`, `synonyms`, `other_names` and a
`has_finds` flag. Internal library folders (`tile-cache`, `.bili-cache`,
`.bili-cache-tiles`) are excluded in SQL, matching `get_find_locations`. One query,
one row per species, no photo rows, no descriptions.

Location suggestions switch to the existing `useFindLocations()`.

The full profile for the selected species comes from the existing lazy
`useSpeciesProfile(name)`. On save, the profile is fetched directly with
`getSpeciesProfile` and awaited before the upsert, so a user who types a name and
saves immediately cannot blank out tags, edibility or cover — a race the current
preloaded-map version is also exposed to whenever its cache is stale.

## Tasks

- [ ] T1 — `SpeciesOption` struct + `get_species_options` command, registered in lib.rs
- [ ] T2 — Rust test: union of finds and profiles, internal folders excluded,
      `has_finds` correct for a profile with no finds
- [ ] T3 — `getSpeciesOptions` in `src/lib/finds.ts` + `useSpeciesOptions` hook + mock
- [ ] T4 — Migrate `CreateFindDialog` off `useFinds()` / `useSpeciesProfiles()`
- [ ] T5 — Migrate `EditFindDialog`
- [ ] T6 — Migrate `ImportDialog`
- [ ] T7 — Save paths fetch the full profile before upsert
- [ ] T8 — Frontend test asserting no dialog issues an unfiltered `get_finds`

## Verification

- `cargo check --all-targets`, Rust lib suite green.
- `tsc --noEmit`, full vitest suite green.
- Test asserts `get_finds` is not invoked when a dialog opens.

## Scope

`src-tauri/src/commands/import.rs`, `src-tauri/src/lib.rs`, `src/lib/finds.ts`,
`src/hooks/useFinds.ts`, the three dialogs, `src/test/tauri-mocks.ts` and tests.
Map clustering, batch mutations, WAL and the thumbnail semaphore stay out.
