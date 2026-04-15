---
quick_id: 260415-qsu
title: Fix collection map pin visibility, label bg, description scroll box with per-photo override
status: in_progress
created: 2026-04-15T17:17:48.000Z
files:
  - src/components/map/CollectionPins.tsx
  - src/index.css
---

## Goal

Fix 3 issues in CollectionPins:
1. Badge (amber square with initials) not rendering — caused by iconSize:[0,0] → Leaflet clips content
2. Description plain text → scrollable box, max-height matching popup image reference
3. Per-photo description: current photo's find.notes if set, else speciesNote fallback

## Tasks

### T1 — Fix icon visibility (CollectionPins.tsx collectionIcon)
- Change iconSize from [0,0] to [28,28], iconAnchor from [0,0] to [14,28]
- Restructure HTML: outer div is 28×28, badge fills it, label positioned absolute below via top:32px
- Remove bottom: positioning hack — use standard top-left placement within real bounds

### T2 — Fix overflow in CSS (index.css)
- Add `overflow: visible !important` to `.bili-collection-marker` so label overflows below badge

### T3 — Scrollable description box (CollectionPopup)
- Wrap speciesNote `<p>` in `<div className="max-h-[90px] overflow-y-auto ...">` styled box
- Show displayNote (photo find notes OR speciesNote)

### T4 — Per-photo description (CollectionPopup)
- Change allPhotos from `flatMap(f => f.photos)` to `flatMap(f => f.photos.map(p => ({photo:p, findNotes:f.notes})))`
- Compute displayNote = current photo's findNotes (non-empty) || speciesNote
- Pass displayNote to description box

## Commit
`fix(quick-260415-qsu): collection pin badge visible, description scroll, per-photo notes`
