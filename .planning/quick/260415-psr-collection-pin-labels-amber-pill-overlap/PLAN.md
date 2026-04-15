---
quick_id: 260415-psr
slug: collection-pin-labels-amber-pill-overlap
description: "Collection pin labels — amber pill, overlap-hide, zoom/hover reveal"
date: 2026-04-15
status: planned
---

# Quick Task 260415-psr

Collection pins: show species name label below each pin. Smart visibility: hide labels when
pins overlap, show always when isolated. Reveal on hover/tap. Smooth transitions.

## Approach

Pure DivIcon approach — embed the label inside the icon HTML itself. No separate Leaflet
layer/layer groups needed. The icon contains:
1. The amber square badge (existing)
2. A label pill below it with species name

**Overlap detection:** Use `useMapEvents` + `useMap` to listen for `zoomend` and `moveend`.
At each event, project each collection's lat/lng to pixel coords using `map.latLngToLayerPoint()`,
then compare pixel distances. If any two pins are within ~120px of each other, both are
"crowded" — hide their labels. Isolated pins always show label.

**Hover/tap:** Each DivIcon has a `.bili-col-label` span. CSS in `index.css`:
- `.bili-collection-pin:hover .bili-col-label` — show label (opacity 1)
- `.bili-collection-pin.crowded .bili-col-label` — hidden by default, show on hover

State is managed in React: `crowded: Set<string>` recomputed on zoom/move.

**Label design:**
- Amber pill: `background: oklch(0.72 0.12 80)`, `color: oklch(0.12 0.02 80)`
- Rounded pill: `border-radius: 999px`, `padding: 2px 7px`
- Font: serif, 11px, no-wrap
- Drop shadow for readability over map tiles
- Positioned below the badge via flex column layout

## Implementation

### 1. `src/components/map/CollectionPins.tsx` — full rewrite

- Replace `collectionIcon(abbr)` with `collectionIcon(abbr, name, showLabel)`:
  - `showLabel=true` → label visible (no crowded class)
  - `showLabel=false` → label hidden, only shows on hover (crowded class)
- Add `CollectionPinsInner` component (needs `useMap`/`useMapEvents`):
  - Tracks `zoomLevel` and `crowdedNames: Set<string>` in state
  - On `zoomend`/`moveend`: project all pin positions, compute pixel distances,
    mark any pair within 120px as crowded
  - Renders Markers with correct icon per crowded state
- Export `CollectionPins` as wrapper (no map context needed at wrapper level)

### 2. `src/index.css` — add label hover CSS

```css
/* Collection pin labels */
.bili-collection-pin .bili-col-label {
  transition: opacity 0.15s ease;
}
.bili-collection-pin.crowded .bili-col-label {
  opacity: 0;
  pointer-events: none;
}
.bili-collection-pin.crowded:hover .bili-col-label,
.bili-collection-pin.crowded:focus-within .bili-col-label {
  opacity: 1;
  pointer-events: auto;
}
```

Mobile tap: because `.bili-collection-pin` is a div in the DOM, touch events on Leaflet
markers also fire hover (Leaflet adds mouse-enter on touchstart for mobile). No extra work.

## Icon HTML structure

```html
<div class="bili-collection-pin-inner" style="display:flex;flex-direction:column;align-items:center;gap:2px">
  <div style="/* amber badge styles */">AB</div>
  <span class="bili-col-label" style="/* pill styles */">Species Name</span>
</div>
```

DivIcon:
- `iconSize`: [80, 52] — wide enough for label
- `iconAnchor`: [40, 28] — anchor at bottom of badge (top part)
- `popupAnchor`: [0, -30]

## Commit
`feat(quick-260415-psr): collection pin labels with overlap-aware visibility`
