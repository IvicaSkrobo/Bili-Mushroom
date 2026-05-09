# Changelog

## [0.1.20] — 2026-05-09

### Added
- **Psychedelic edibility status** — new `psychedelic` value joins edible/inedible/poisonous/unknown. Badge: purple with Sparkles icon.
- **Croatian edibility labels** — all edibility badge labels now in Croatian: *Može se jesti*, *Nije za jelo*, *Opasno / otrovno*, *Psihoaktivno*, *Nepoznato*.
- **Reworked edibility icons** — edible uses Utensils (fork+knife), poisonous uses Skull, psychedelic uses Sparkles, inedible keeps UtensilsCrossed.

---

## [0.1.19] — 2026-05-09

### Added
- **Edibility + protected status metadata** — species can now be tagged as edible/inedible/poisonous/unknown and protected/not protected. Stored in DB, displayed as inline badges throughout the app (FindCard rows, folder header, CollectionPopup, PhotoLightbox).
- **Edibility selects in all dialogs** — FolderEditDialog, CreateFindDialog, and ImportDialog all expose edibility and protected status fields.
- **Find-level notes vs species notes** — ImportDialog now separates find-specific notes from species-level notes with distinct inputs.
- **Map: persist viewport across restarts** — last map center/zoom restored on next open.
- **Map: zoom to location** — action button in find and collection pin popups flies to that location.

### Fixed
- Edibility preserved when setting a cover photo (was incorrectly reset).
- Import dialog now remembers last used directory — picker reopens in same folder.
- Map pin labels: smooth hover expansion with no jitter; co-located suppressed pins reveal species name on hover.

### Changed
- Map pins redesigned — dot + text label below replaces pill-as-pin style.

---

## [0.1.18] — 2026-05-08

### Added
- **Per-photo management** — photo grid in EditFindDialog with per-photo delete; delete button in PhotoLightbox.
- **Location note autocomplete** — LocationNoteInput with autocomplete suggestions wired into CreateFindDialog, EditFindDialog, and ImportDialog.
- **No-photo find creation** — finds can now be created without attaching any photo.
- **Clickable version pill** — version badge in app header checks for available updates on click.
- **Manual update check** — Settings dialog exposes a "Check for updates" action.
- **Map: zoom-gated pin labels** — labels appear only when zoomed in enough; mixed-species clusters show grouped label.
- **Map: hide clutter during zone editing** — non-essential map elements hidden while drawing/editing polygon zones.
- **Stats: historical comparison** — weekly/monthly observed-count comparison against prior periods in Stats tab.
- **Stats: observed-count range** — min/max/avg count range shown in SpeciesStatSummary.
- **Stats: top spots expanded** — top spots list now shows beyond the previous top-10 cap.

### Changed
- Stats tab: seasonal insights and historical comparison moved above top spots section.

---

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
