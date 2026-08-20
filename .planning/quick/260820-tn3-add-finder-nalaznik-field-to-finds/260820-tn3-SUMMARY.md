---
quick_id: 260820-tn3
status: complete
date: 2026-08-20
commits:
  - fc5c1af feat(finds): record determiner and finder on a find
---

# Quick Task 260820-tn3 — Summary

Two optional free-text people fields on a find: **Determinator** (who identified the
species) and **Nalaznik** (who found it). Determinator sits immediately before
nalaznik everywhere, per the request. Same shape as `weather` (260820-tca).

## Entry points

| Surface | What was added |
|---|---|
| New find (`CreateFindDialog`) | Two-column row: Determinator, Nalaznik. Part of the saved draft |
| Edit find (`EditFindDialog`) | Same row, pre-filled from the record |
| Import (`ImportDialog`) | `sharedDeterminer` + `sharedFinder` in the shared header, draft-persisted, applied to every imported find |
| Open a find (`PhotoLightbox`) | One combined inline editor holding both inputs |

## Display

- Lightbox metadata panel: labelled lines with a person icon; empty state
  "Nije zabilježeno".
- `FindCard`: one compact line, `determinator / nalaznik` joined, shown only when at
  least one is set.
- `exportCsv`: two new columns (`determiner`, `finder`); header assertion updated.

## Persistence

- `0025_find_determiner_finder.sql` adds both columns in one migration;
  `version < 25` guard, `PRAGMA user_version = 25`, and a separate idempotent repair
  block per column.
- `FindRecord.determiner` (index 17) and `.finder` (index 18); all find `SELECT`s
  updated (8 in `finds.rs`, 1 + 2 in `import.rs`).
- Carried by `CreateFindPayload`, `ImportPayload`, `UpdateFindPayload`.

## Clobber protection

`update_find` rewrites the whole row, so all four lightbox save paths — notes,
weather, this editor, and the location picker — now pass every one of
`weather` / `determiner` / `finder` through. Verified: 8 occurrences across the file,
two per save path.

## Verification

- `cargo check --tests` clean (Rust fixtures updated).
- `npx tsc --noEmit` clean.
- `npx vitest run` — 324 passed, 13 failed; same 13 pre-existing failures.
- App relaunched; live DB at `user_version = 25` with both columns and all rows intact.

## Out of scope

- Filtering/grouping finds by determiner or finder.
- Any people registry or autocomplete — plain text, typed each time.
