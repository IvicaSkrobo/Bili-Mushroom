---
quick_id: 260820-uoz
status: complete
date: 2026-08-20
commits:
  - d5cfaf2 feat(samples): add Uzorci specimen register
---

# Quick Task 260820-uoz — Summary

New top-level **Uzorci** tab: a specimen register where a find can be entered, numbered,
and given its own folder on disk.

## Decisions taken with the user

| Question | Chosen |
|---|---|
| Data model | **A** — sample points at the find; find keeps species/date/location/photos |
| Photos on disk | **Hard links** — one file, edits show in both places |
| Fields | All proposed |
| Numbering | **Per species per year** — "Boletus edulis 1/2026" |

## Placement

Second tab: `ZBIRKA · UZORCI · VRSTE · KARTA · STATISTIKA`. Zbirka and Uzorci are both
"my material"; Vrste is reference, Karta/Statistika are analysis.

## Schema (migration 0026, user_version 26)

- `samples` — one row per find (`find_id UNIQUE`), plus `species_name`, `sample_year`,
  `sample_no`, `folder_path`, and the register fields: `preservation`,
  `storage_location`, `condition`, `spore_print`, `dna_sample`, `dried_at`,
  `dry_weight`, `loaned_to`, `loaned_at`, `notes`.
- `sample_counters(species_key, sample_year, last_no)` — counters live apart from the
  rows so **a deleted sample retires its number**; `MAX(sample_no)+1` would recycle it,
  and these numbers can end up written on a physical label.
- Both tables use `CREATE TABLE IF NOT EXISTS` and are also run from the repair block,
  so a DB whose `user_version` ran ahead still gets them.

## Hard links — verified, not assumed

`edit_find_photo_image` writes the edited image to a temp file then
`std::fs::copy(&temp, &original)` — a copy **into** the existing file, not a rename.
That preserves hard links, so rotating or cropping a photo in the app updates the copy in
the sample folder too. `std::fs::hard_link` falls back to `fs::copy` if the filesystem
refuses.

Disk layout: `Uzorci/<Species>/<year>-<nnn>/01.jpg, 02.jpg, uzorak.json`.

## Commands (`src-tauri/src/commands/samples.rs`)

`get_samples`, `get_sample_for_find`, `create_sample_for_find` (idempotent — an already
registered find keeps its number and just re-syncs), `update_sample`, `delete_sample`
(folder removal opt-in, find untouched), `sync_sample_folder`, `open_sample_folder`.

## UI

- `SamplesTab.tsx` — year-grouped register list with search on the left, detail panel on
  the right: photo strip, all register fields (saving on blur/change), Otvori mapu,
  Osvježi mapu, Ukloni iz registra with confirm step.
- "Izuzet uzorak" checkbox in Novi nalaz and Uredi nalaz. Registration runs **after**
  photos are attached, so the folder links real files. In Uredi nalaz the checkbox is
  disabled once registered and shows the assigned label instead of the help text.
- i18n hr + en for the whole tab.

## Verification

- `cargo check` clean (no warnings), `npx tsc --noEmit` clean.
- `npx vitest run` — 324 passed, 13 failed; the same 13 pre-existing failures.
- Not yet exercised against the live DB — needs an app restart and a find to be ticked.

## Known gaps / follow-ups

- **Species rename**: `samples.species_name` is not updated by bulk rename, so a renamed
  species keeps its old label and folder. Needs handling, including the number collision
  when two species merge (per-species numbering makes this possible).
- **Import dialog** has no "Izuzet uzorak" checkbox yet — only the two find dialogs.
- **Deleting a find** leaves its sample row pointing at a missing find; the join then
  drops it from the register silently. Should cascade or warn.
- **Labels (etikete)**: printable PDF labels are the natural next step — the app already
  bundles `@react-pdf/renderer`.
- Backing up or cloud-syncing the storage folder will duplicate hard-linked photos
  (most sync tools do not preserve links).
