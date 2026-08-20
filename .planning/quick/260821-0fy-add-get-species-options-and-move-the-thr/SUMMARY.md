---
id: 260821-0fy
slug: add-get-species-options-and-move-the-thr
date: 2026-08-21
mode: quick
status: complete
committed: true
---

# Summary — `get_species_options` for the three dialogs

## What changed

**Rust.** New `get_species_options` command in `import.rs`, registered in `lib.rs`. One
query returns the union of species names from `finds` and `species_profiles`, each with
`common_name`, `synonyms`, `other_names` and a `has_finds` flag. Names are de-duplicated
case-insensitively and the profile join uses the same key, so a profile stored with
different casing still supplies its common name. Internal folders (`tile-cache`,
`.bili-cache`, `.bili-cache-tiles`) and blank names are excluded in SQL, matching
`get_find_locations`. Runs in `spawn_blocking`.

**Frontend.** `getSpeciesOptions` / `SpeciesOption` in `src/lib/finds.ts`, a
`useSpeciesOptions` hook, and a matching mock. `CreateFindDialog`, `EditFindDialog` and
`ImportDialog` no longer call bare `useFinds()` or `useSpeciesProfiles()`:

- species suggestions, "is this a new species?" checks and known common names come from
  the options list,
- location suggestions come from the existing `useFindLocations()`,
- the full profile of the selected species comes from `useSpeciesProfile(name)`,
- `EditFindDialog`'s live photo list comes from `useFindPhotos(find.id)` instead of
  re-finding the record inside a full library load.

**Correctness improvement, not just performance.** The profile upsert on save is a
read-modify-write. It used to read from a preloaded list that could be stale, which
could blank out tags, cover, edibility or habitat. Each dialog now awaits
`getSpeciesProfile` for the current species immediately before the upsert. The typed
name is first resolved through the options list, because `get_species_profile` matches
by exact name while the old client-side map matched case- and markup-insensitively.

## Verification

- Rust: `npm run test:rust` — 98 passed, 0 failed, 1 ignored. New test
  `species_options_union_finds_and_profiles_without_internal_folders` covers the union,
  the internal-folder and blank-name exclusion, casing collapse, a profile with no finds,
  and the synonyms/other-names JSON decode.
- Frontend: 345 passed, 45 files. New `useSpeciesOptions` test asserts the autocomplete
  resolves without `get_finds` being invoked at all.
- `tsc --noEmit` clean, `cargo check --all-targets` clean.

## Remaining full-library readers

`get_finds` without a limit still defaults to `i64::MAX`. After this change every caller
passes filters:

| Caller | Filter |
|--------|--------|
| `MapTab` | `photosMode: 'primary'` |
| `StatsTab` | `photosMode: 'count'` |
| `LocationPickerMap` | `photosMode: 'none'` |
| `CollectionTab`, `SpeciesTab` | paged via infinite queries |

`CollectionTab` and `CollectionPins` still call `useSpeciesProfiles()`, which loads every
full profile including descriptions and habitat. Moving them to
`useSpeciesProfileSummaries()` is the obvious next trim.

## Follow-ups (unchanged priority order)

1. `get_map_points` — the map still loads full `FindRecord` rows.
2. Batch delete/move commands — `Promise.all` still issues one IPC call per find.
3. `spawn_blocking` for `samples.rs` and `zones.rs`.
4. WAL and related PRAGMAs, as a separate carefully-tested database change.
5. Thumbnail decode semaphore and progressive warmup.
6. Map marker clustering.
