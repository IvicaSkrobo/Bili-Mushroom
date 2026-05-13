# PLAN - 260513-map-pin-explicit-merge-picker-pins

Date: 2026-05-13
Mode: /gsd-quick

## Objective

Fix map pin grouping and picker visibility:

- Do not auto-merge nearby finds into one collection pin.
- Only show multiple finds on one pin when their saved coordinates are exactly shared, which happens when the user explicitly chooses an existing pin in the picker.
- In a multi-find pin popup, browse between finds, not every photo. Use each find's primary/first photo, or a placeholder.
- Restore previous find pins inside `LocationPickerMap` when opened from create/import flows on Windows.

## Scope

Files expected:

- `src/components/map/CollectionPins.tsx`
- `src/components/map/LocationPickerMap.tsx`
- map tests around collection grouping and picker pins

## Verification

- Run focused Vitest files for map grouping/picker behavior.
- Run TypeScript/build check if feasible.
