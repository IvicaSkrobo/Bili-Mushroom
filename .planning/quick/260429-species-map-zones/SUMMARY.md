# Species map zones summary

Date: 2026-04-29

## Result

Implemented the first slice of species-specific map zones:

- Added persistent `zones` database storage with circle and polygon-ready fields.
- Added Rust Tauri commands to list, create/update, and delete zones.
- Added frontend zone types, query/mutation hooks, distance helpers, and zone summary logic.
- Added map zone visibility modes:
  - `Pins only`
  - `Local`
  - `Region`
  - `All zones`
- Added local circle zone creation from a collection popup's current find.
- Added region circle creation when exactly one species is visible.
- Added zone overlays with distinct local/region styling.
- Added zone popups for name, radius, notes, find count, first found date, last found date, save, and delete.

## Scope

This pass ships circle-based local and region zones. Polygon region drawing is intentionally left as the next map-editing slice, but the schema and TypeScript model already include `geometry_type = polygon` and `polygon_json` so the stored concept does not need to change later.

## Verification

- `npm.cmd run build` passed.
- `npm.cmd test -- src/tabs/MapTab.test.tsx src/components/map/FindsMap.test.tsx` passed.
- `cargo test --no-run` passed.
- Full `cargo test` compiled, but the Tauri-linked test binary failed to launch in this environment with `STATUS_ENTRYPOINT_NOT_FOUND`.
