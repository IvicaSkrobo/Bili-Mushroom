# PLAN - 260513-popup-arrow-native-events

Date: 2026-05-13
Mode: /gsd-quick

## Objective

Fix map popup previous/next controls that appear clickable but do not advance between finds in the Leaflet popup on Windows WebView.

## Diagnosis

Leaflet popup propagation guards can prevent React delegated event handlers from receiving click/pointer events inside portal-rendered popup DOM. Use native DOM listeners attached directly to arrow button refs instead of relying on React synthetic events for these controls.

## Scope

- `src/components/map/CollectionPins.tsx`

## Verification

- Focused map tests.
- Production build.
