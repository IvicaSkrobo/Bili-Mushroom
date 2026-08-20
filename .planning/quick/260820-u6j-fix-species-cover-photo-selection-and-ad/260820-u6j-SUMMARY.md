---
quick_id: 260820-u6j
status: complete
date: 2026-08-20
commits:
  - f077646 fix(species): cover photo when newest find has none; location filter suggestions
---

# Quick Task 260820-u6j — Summary

Two reported items: a species cover-photo bug, and pickable options in the location
filter.

## 1. Cover photo bug — root cause

`load_representative_find_for_species` (`src-tauri/src/commands/import.rs`) selected the
species' **newest** find with `LIMIT 1` and used that find's photo as the folder
thumbnail. It had no preference for a find that actually has a photo, and no awareness
of `species_profiles.cover_photo_id`.

Two visible symptoms, both reported by the user:

- A species whose newest find is photoless showed the camera placeholder even when
  older finds had photos.
- A cover chosen from an older find was written to `cover_photo_id` but never rendered:
  `buildSpeciesJournalPreview` looks the cover up inside the representative find's
  photos, and that find was the wrong one. The frontend only appeared to work while the
  cover picker query was warm in cache, so the choice "disappeared" after a restart.

### Fix

Selection order is now: the find holding the species' `cover_photo_id` (an explicit user
choice, honoured regardless of active filters) -> the newest find that has at least one
photo -> the newest find. Implemented by splitting `load_finds_for_species` into an inner
variant taking `require_photos`, which appends
`EXISTS (SELECT 1 FROM find_photos fp WHERE fp.find_id = finds.id)`.

### Cover from disk

The cover picker gained **Dodaj fotografiju s računala**. It opens a file dialog,
attaches the image to the species' most recent find via `add_find_photos`, then sets the
new photo as cover. Initially gated to the "no photos at all" case, then made always
available at the user's request.

## 2. Location filter suggestions

`CollectionTab`'s Filters popover now lists every recorded `location_note` beneath the
location input: narrows as you type, click applies, clicking the active one clears.
Mirrors how the date filters offer a calendar instead of free typing.

## Filter audit (requested)

| Surface | Filters by | Pickable options |
|---|---|---|
| Zbirka, Filters popover | Lokacija | Added here |
| Zbirka, Filters popover | Datum | Already (calendar) |
| Zbirka, toolbar | Vrsta | Implicit — filters the folder list below |
| Vrste, sidebar | Vrsta | Implicit — filters the species list beside it |
| Karta, bottom panel | Vrsta only | Already a checkbox list |
| Statistika | none | — |

**There is no location filter anywhere except Zbirka.** The map filters by species only.
Adding a location filter to the map is a new feature, not a retrofit — left for the user
to decide.

## Verification

- `cargo check --tests` clean, `npx tsc --noEmit` clean.
- `npx vitest run` — 324 passed, 13 failed; the same 13 pre-existing failures.
- Mid-work an unescaped apostrophe in an English i18n string broke module parsing and
  21 test files failed to load. Caught in the same run and fixed before commit.

## Not done

- Location filter on the map.
- Species cover decoupled from find photos (option 3 in the original question) — the
  chosen approach keeps `cover_photo_id` pointing at a real find photo.
