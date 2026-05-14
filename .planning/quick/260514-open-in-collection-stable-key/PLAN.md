# Plan: stable open-in-collection navigation

## Goal
Make "Otvori u zbirci" and similar cross-tab navigation use the raw stable species key instead of display/search strings.

## Steps
- Inspect store handoff and callers from species/map/stats/detail panels.
- Update collection tab to reveal/select by raw species key without relying on parsed search text.
- Remove comma-based fallback from navigation labels where present.
- Run focused build/type checks.
