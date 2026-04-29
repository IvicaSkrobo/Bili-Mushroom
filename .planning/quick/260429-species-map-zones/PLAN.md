# Species map zones

Date: 2026-04-29

## Goal

Add persistent species-specific zones to the collection map so exact find pins stay as event records, while local mycelium areas and broader productive regions can be marked, viewed, edited, and used to summarize find history over time.

Core rule:

**Finds are events. Zones are places.**

A find keeps its own species, date, photos, notes, and exact location. A zone is a persistent map area for a species. Multiple finds from different dates can belong to the same zone when they fall inside it or are manually linked later.

## Feature shape

### Zone types

1. **Local / micro zone**
   - Tied to a selected find or a small cluster of same-species finds.
   - Represents the approximate mycelium spread around a known spot.
   - First implementation should be an editable circle with center and radius in meters.
   - Visual treatment: warm danger/amber/red outline and translucent fill.
   - Should show same-species finds and dates inside the local area.

2. **Region zone**
   - A broader productive area such as a forest section, hillside, habitat, or foraging region.
   - Not necessarily tied to one exact find point.
   - Target implementation should support editable polygons because real forest regions are irregular.
   - Circle support is acceptable as a first step if polygon drawing is too much for the first pass.
   - Visual treatment: blue/green outline and translucent fill, distinct from local zones.
   - Should show all same-species finds inside the region.

### Map view modes

When a user selects a species or clicks a find pin, the map should expose a compact zone view switch:

- `Pins only`
- `Local`
- `Region`
- `All zones`

Expected behavior:

- `Pins only`: normal map, no zones visible.
- `Local`: show local/micro zones relevant to the selected species or selected find.
- `Region`: show broader region zones relevant to the selected species.
- `All zones`: show both local and region zones for the selected species.

Creating a zone should follow the active mode:

- In `Local`, create a local circle around the selected find by default.
- In `Region`, create a region shape. Prefer polygon drawing if available; otherwise start with a larger editable circle and leave the data model ready for polygon geometry.

## Suggested data model

Add a `zones` table, with geometry stored in a format that can support both circles and polygons.

Suggested fields:

- `id`
- `species_id`
- `type`: `local` or `region`
- `name`
- `geometry_type`: `circle` or `polygon`
- `center_lat`
- `center_lng`
- `radius_meters`
- `polygon_json`
- `source_find_id` nullable, mainly for local zones
- `notes`
- `created_at`
- `updated_at`

Follow-up table if manual overrides are needed:

- `zone_finds`
- `zone_id`
- `find_id`
- `link_type`: `auto`, `manual_include`, `manual_exclude`

For v1, zone membership can be calculated dynamically from geometry:

- Same species only.
- Find point is inside circle or polygon.
- Later, manual include/exclude can override the automatic result.

## Implementation plan

### 1. Data foundation

1. Add a SQLite migration for `zones`.
2. Add Rust types for zone records and geometry.
3. Add backend commands for:
   - list zones by species
   - create zone
   - update zone geometry/details
   - delete zone
4. Keep the schema update-safe so installed app updates preserve existing finds/photos.

### 2. Frontend data layer

1. Add TypeScript zone types matching backend DTOs.
2. Add query/mutation hooks for zones.
3. Add geometry helpers:
   - point-in-circle
   - point-in-polygon
   - find counts inside zone
   - first found date
   - last found date
4. Keep derived zone summaries client-side unless performance becomes an issue.

### 3. Map display and view switch

1. Add the zone view switch to the map when a species or find is selected.
2. Render local and region zones as separate Leaflet layers.
3. Preserve the current exact find pins and collection pin behavior.
4. Make zone colors match the Forest Codex theme and remain readable on satellite/topo layers.
5. Add zone popups or side panel details showing:
   - zone name
   - species
   - zone type
   - find count
   - first found
   - last found
   - notes

### 4. Circle-first creation/editing

1. Add `Create local zone` for selected find.
2. Default the circle center to the find coordinate.
3. Provide radius controls, likely presets plus a numeric meter input:
   - 10 m
   - 25 m
   - 50 m
   - 100 m
   - 250 m
   - 500 m
4. Allow editing center/radius after creation.
5. Persist changes immediately or through an explicit save action, matching existing app patterns.

### 5. Polygon region drawing

Preferred end state:

1. Add polygon drawing for region zones.
2. Use an established Leaflet drawing/editing library if compatible with the current React/Leaflet versions.
3. User flow:
   - choose `Region`
   - click `Draw region`
   - click points around the forest area
   - close polygon
   - save name/notes
4. Allow editing polygon vertices later.
5. Store polygon points in `polygon_json`.

If polygon tooling is risky in the first implementation:

1. Ship circle local zones first.
2. Add region circles using the same model.
3. Add polygon support as the next map-focused task without changing the stored `zones` concept.

### 6. Zone history and summaries

1. For each zone, calculate same-species finds inside it.
2. Show date history:
   - all dates
   - first found
   - last found
   - count by year or month later
3. Make it clear that a find can be inside:
   - no zone
   - one local zone
   - one or more region zones
   - both local and region zones

## UX notes

- Default map should stay clean: `Pins only` is safest as the default view.
- Zone controls should appear only when useful, especially when a species or pin is selected.
- Local zones should feel attached to a point; region zones should feel like broader overlays.
- Do not make brush-painting the first approach. It is harder to edit, store, simplify, and explain. Polygon drawing gives Ivan the irregular-region control he wants with much less long-term mess.
- Keep labels compact. This is a working field-journal app, not a GIS tool.

## Risks

- Polygon drawing/editing library compatibility with React 18 and the installed Leaflet version needs verification.
- Too many visible zones could clutter the map, so species-scoped visibility matters.
- Automatic zone membership may surprise users near boundaries; manual include/exclude should be planned as a later refinement.
- Coordinate geometry must be accurate enough for foraging use, especially circle radius in meters.
- Schema migration must be tested against existing local app data so updates preserve user work.

## Verification

For implementation, verify:

1. Existing finds/photos still load after migration.
2. App update path preserves existing data.
3. Creating, editing, deleting circle zones persists through restart.
4. Zone view switch correctly hides/shows `Pins only`, `Local`, `Region`, and `All zones`.
5. Same-species finds on different dates appear in the correct zone history.
6. Different species inside the same region do not get counted unless the zone is intended for that species.
7. Build passes with `npm.cmd run build`.
8. Rust/backend tests pass where the local environment supports them.

## Recommended first slice

Implement **circle local zones** first, but design the database and frontend types for both circles and polygons from day one.

That gives immediate value for mycelium areas while keeping the path open for Ivan's likely next need: polygon region zones for irregular forest sections.
