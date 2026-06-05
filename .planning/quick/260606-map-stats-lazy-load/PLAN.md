# Plan: map and stats lazy-load optimization

## Goal
Avoid expensive Map/Stats work before those tabs are opened, and inspect map marker rendering for large collections.

## Steps
- [x] Inspect AppShell tab mounting and Map/Stats data hooks.
- [x] Add active-tab gated queries/effects where safe.
- [x] Inspect map marker grouping/rendering for possible viewport or clustering follow-up.
- [x] Add viewport-limited map pin rendering and label-crowding work.
- [x] Run focused tests/build/checks.

## Result
- Map and Stats queries now stay disabled until their tab is active.
- Collection map pins render only inside the current map viewport plus padding, so large coordinate sets do less React/Leaflet work.
- Pin label overlap calculation now runs only over the visible marker set instead of all coordinates.
