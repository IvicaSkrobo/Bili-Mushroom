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

## Gaps closed in follow-up (commit da163af)

- **Species rename now follows.** `relocate_samples_for_finds` moves each affected sample
  to the new species name, keeping its number when that number is free there and
  renumbering only on collision — possible precisely because numbering is per species, so
  merging two species can bring two `1/2026` together. The folder moves with it and the
  data sheet is rewritten.
- **Deleting a find no longer orphans the register entry.** Both delete paths
  (`delete_find` and `move_find_files`) drop the sample row.
- **Import dialog has the "Izuzet uzorak" checkbox**, draft-persisted, registering every
  imported find after the import succeeds.
- **Removal is explained in the UI and never touches the folder.** The confirm step
  states: only the register entry is deleted; find, photos and folder stay; the number is
  not reused. Per the user's instruction the app now never deletes a sample folder on any
  path — including a delete-files run, where hard-linked photos survive in the sample
  folder because the link keeps the inode alive.

## Second follow-up (commit 02b2b13)

- **Deleting a find with a linked sample now asks.** The dialog names the sample
  ("Ovaj nalaz ima povezan uzorak 1/2026") and offers a checkbox to delete its folder
  too, unticked by default. The register entry always goes with the find — it points at a
  row that is about to vanish — but the folder and its photos survive unless asked for.
  The block only renders when a sample is actually linked, so ordinary deletes look
  exactly as before. `delete_find` gained `delete_sample_folder: Option<bool>`.
- **Herbarium labels.** `src/lib/exportSampleLabels.tsx` renders an A4 sheet of cut-out
  slips: accession number, species, date, place, coordinates, det./leg., preservation and
  storage location. Printed from the Uzorci list via the **Etikete** button, so the search
  box doubles as the filter for which labels get printed. Rendered on the main thread —
  labels are text only, so the export worker would only add failure modes.
- Deletes and bulk renames invalidate the samples query so the register refreshes.

## Remaining follow-ups

- Backing up or cloud-syncing the storage folder will duplicate hard-linked photos
  (most sync tools do not preserve links).
- Re-registering a find that was removed from the register mints a **new** number and
  folder; the earlier folder stays on disk as an orphan by design.
- Label layout is fixed at two per row on A4; no sheet-size or Avery-template options.
