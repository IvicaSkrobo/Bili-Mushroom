# Changelog

## [0.1.15] — 2026-05-07

### Added
- **Species name formatting toolbar** — select text in any species name field, click B/N to toggle bold/normal weight via `*asterisks*` syntax. Available in import preview cards, bulk import dialog, Edit Find dialog, and Folder Edit dialog.
- **Live species name preview** — when `*` markers are present, a rendered preview appears below the input field in real time.

### Fixed
- **Zone popup buttons close the popup** — "Draw local" / "Edit local" / "Draw region" / "Edit region" buttons in map pin popups now stop Leaflet event propagation, preventing the popup from dismissing when the button is clicked.
- **"Edit region/local" opens existing polygon correctly** — clicking Edit on an existing zone now enters edit mode directly instead of draft mode, eliminating accidental first-click point addition on already-drawn polygons.

---

## [0.1.14] — 2026-04-XX

### Added
- **Location repick from lightbox** — location note in photo lightbox is now a clickable button that opens the location picker map to update coordinates and note without opening Edit Find.
- **Species name italic/weight rendering** — `renderSpeciesName` utility renders text wrapped in `*asterisks*` at normal (non-bold) weight; genus part (before comma) displays in bold serif. Applied to FindCard titles, lightbox header, and collection view.
- **Species filter on location picker** — location picker map pre-filters existing find pins to the current species when opened from import or lightbox.
- **Post-import delete failures panel** — if source files could not be deleted after import (e.g. file locked or moved), a distinct error panel lists the failed paths in the review dialog.
- **Map: FindsMap full rewrite** — cluster grouping, popups, and pin rendering overhauled for reliability and correctness.
- **Map: LocationPickerMap improvements** — expanded map picker with better UX for picking and confirming coordinates.
- **Collection tab redesign** — major layout and interaction overhaul.

### Fixed
- Date in lightbox sidebar displayed at reduced opacity (`text-foreground/80`) instead of muted color.
- Coordinates in lightbox displayed with background chip (`bg-muted/30`) for legibility.
- Country/region block in lightbox no longer shows `location_note` (moved to separate clickable element).
- Edit button in lightbox uses correct i18n key (`edit.title` instead of `edit.edit`).

---

## [0.1.13] — 2026-04-XX

### Fixed
- Updater release trigger and public key configuration corrected for CI auto-update pipeline.
