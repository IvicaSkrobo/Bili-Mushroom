---
quick_id: 260415-ql0
slug: collection-pin-popup-species-note-photo-carousel
description: "Collection pin popup: species description + photo carousel with prev/next"
date: 2026-04-15
status: planned
---

# Quick Task 260415-ql0

Replace plain popup (name + count) with rich popup:
- Latin name header
- Species note/description (from SpeciesNote.notes via useSpeciesNotes hook)
- Photo carousel — all photos from all finds in collection, prev/next navigation
- Count of finds

## Files
- src/components/map/CollectionPins.tsx only

## Changes
- Collection interface: add `finds: Find[]`
- collections_from_finds: accumulate finds per collection
- CollectionPinsInner: call useSpeciesNotes() + useAppStore(s=>s.storagePath)
- Add CollectionPopup component with useState for photo index
- Replace <Popup> content with <CollectionPopup>

## Commit
`feat(quick-260415-ql0): collection pin popup with species note + photo carousel`
