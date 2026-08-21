---
quick_id: 260821-species-find-gallery-other-names
status: complete
completed: 2026-08-21
commit: 6882d4b
files_modified:
  - src/tabs/SpeciesTab.tsx
  - src/tabs/SpeciesTab.test.tsx
---

# Species find gallery and other names — Summary

## Delivered

- Species → Finds now opens the selected find's complete photo set in the existing `PhotoLightbox`.
- The paginated species query remains on primary-photo mode; `useFindPhotos` is enabled only while a photo-bearing find gallery is open.
- The primary photo opens immediately as a fallback, then the live per-find photo list replaces it without closing the lightbox.
- Find galleries keep every photo paired with a consistent live `Find` snapshot, reset their index safely, and clear when the lightbox closes or the selected species changes.
- Finds without photos retain the existing fallback and do not enable the full-photo query.
- Description now provides a keyboard-accessible add/remove workflow for Other names, visually distinct from synonyms.
- Other-name mutations preserve synonyms, tags, cover, status, distribution, edibility details, description, habitat, and fruiting-body override.

## Files Changed

- `src/tabs/SpeciesTab.tsx`
- `src/tabs/SpeciesTab.test.tsx`

## Commit

- `6882d4b` — `feat(species): browse find photos and edit other names`

## Verification

- `npx vitest run src/tabs/SpeciesTab.test.tsx src/components/finds/PhotoLightbox.test.tsx` — 11/11 passed.
- `npm run typecheck` — passed.
- `npm run build` — passed.
- Package version remained `0.3.40` as required.

## Manual UAT

Pending user verification in the running Tauri application: in both Herbarium Daybook and Nocturne Herbarium, open a multi-photo find under Species → Finds, navigate with buttons and keyboard, close and open another find, then add and remove a synonym and an Other name under Description. Confirm that unrelated profile metadata remains unchanged.

