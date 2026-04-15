---
phase: quick-260415-syy
plan: "01"
subsystem: collection-ui
tags: [lightbox, photo-viewer, collection, ui]
dependency_graph:
  requires: []
  provides: [photo-lightbox-overlay]
  affects: [CollectionTab, FindCard]
tech_stack:
  added: []
  patterns: [shadcn-dialog-primitive-composition, flat-photo-list-from-folder-finds]
key_files:
  created:
    - src/components/finds/PhotoLightbox.tsx
  modified:
    - src/components/finds/FindCard.tsx
    - src/tabs/CollectionTab.tsx
    - src/i18n/index.ts
decisions:
  - Compose PhotoLightbox using DialogPortal + DialogOverlay + DialogPrimitive.Content directly (not DialogContent wrapper) to allow custom overlay darkness (bg-black/85) without fighting the wrapper's built-in overlay
  - Thumbnail click wired on the thumbnail div with stopPropagation to avoid triggering the card-level select toggle
  - flat LightboxPhoto[] built at open time from speciesFinds array — no pre-computation needed, folders are small
metrics:
  duration_seconds: ~600
  completed_date: "2026-04-15"
  tasks_completed: 2
  files_created: 1
  files_modified: 3
---

# Quick Task 260415-syy: Collection Photo Lightbox Within Folder

**One-liner:** Cinematic lightbox overlay for browsing all photos within a species folder, with prev/next navigation and find metadata panel, wired via thumbnail click on FindCard.

## What Was Built

### PhotoLightbox component (`src/components/finds/PhotoLightbox.tsx`)

Full-screen modal overlay composed from Radix Dialog primitives (Portal + Overlay + Content directly, bypassing DialogContent wrapper to control overlay darkness). Layout: flex row with photo area (flex-1) and metadata panel (w-64 fixed).

- Dark cinematic backdrop: `bg-black/85`
- Photo display: `convertFileSrc()` for Tauri asset resolution, `object-contain` for proper framing, opacity fade transition (150ms) on index change
- HEIC placeholder (font-mono label) matching FindCard pattern
- Prev/next ChevronLeft/ChevronRight buttons, semi-transparent, hover reveals full opacity
- Keyboard: ArrowLeft/ArrowRight navigate, Esc closes (native Radix behavior)
- Photo counter: `{current} / {total}` in JetBrains Mono at bottom-center of photo area
- Metadata panel: species name in Playfair Display serif, date in DM Sans, location lines, coords in JetBrains Mono, notes in italic with scroll if long
- Amber top-border accent on metadata panel (`bg-primary/40`)
- Custom X close button (absolute top-right, 9x9, semi-transparent)

### FindCard changes (`src/components/finds/FindCard.tsx`)

- Added `onPhotoClick?: (findId: number, photoIndex: number) => void` to `FindCardProps`
- Thumbnail div gets `cursor-pointer` and click handler when `onPhotoClick` is provided and not in select mode
- Click calls `onPhotoClick(find.id, 0)` — photoIndex 0 since FindCard shows primary photo; lightbox then opens at the correct global index
- `stopPropagation` prevents card-level click (select toggle) from firing

### CollectionTab changes (`src/tabs/CollectionTab.tsx`)

- Three lightbox state vars: `lightboxOpen`, `lightboxIndex`, `lightboxPhotos`
- `openLightbox(speciesFinds, findId, photoIndex)`: builds flat `LightboxPhoto[]` iterating all finds in the folder, locates global index matching clicked find+photoIndex, sets state and opens
- `onPhotoClick` passed to each FindCard inside folder body
- `<PhotoLightbox>` rendered alongside other dialogs at bottom of component

### i18n (`src/i18n/index.ts`)

Added to both `hr` and `en`:
- `lightbox.photoCount`, `lightbox.prev`, `lightbox.next`, `lightbox.close`

## Deviations from Plan

None — plan executed exactly as written. One implementation note: the close button position uses `right-[272px]` (metadata panel width 256px + 16px gap) to place it at the top-right of the photo area rather than overlapping the metadata panel.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `aad3a3f` | PhotoLightbox component + i18n keys |
| Task 2 | `0d53535` | Wire lightbox into CollectionTab via FindCard thumbnail clicks |

## Self-Check: PASSED

- `src/components/finds/PhotoLightbox.tsx` — FOUND
- Commit `aad3a3f` — FOUND
- Commit `0d53535` — FOUND
- TypeScript: EXIT:0 (clean)
