# Changelog

## [0.3.40] — 2026-08-21

### Fixed
- **Honest single deletion** — deleting one find no longer reports full success when the record went but something could not be cleaned up; the dialog names how many files or folders were left behind, as batch deletion already did.
- **No warning for photos that are already gone** — a file removed outside the app is treated as already deleted rather than as a failure, so deletion no longer points at a photo that does not exist. The photo library audit still lists such rows.
- **Idempotent deletion** — deleting a find that is already gone counts as done instead of showing an error, so a stale list or a second confirmation no longer fails on completed work. Batch deletion still reports a missing id per item.
- **Sample lookups no longer swallow database errors** — only a genuinely absent row counts as "no sample"; an unreadable database stops the delete transaction instead of silently continuing.
- **An unreadable disk can no longer be mistaken for missing photos** — deletion, sample folder cleanup and "clean up missing photo references" now tell *confirmed absent* apart from *could not be read*. A path the filesystem refuses to answer for is never treated as deleted.
- **Safer reference cleanup** — the Settings cleanup scans every path before touching the database, removes nothing at all if any path cannot be confirmed missing and names it, and performs its row deletions and primary-photo promotions in a single transaction instead of one at a time.
- **A photo row pointing at a folder can no longer send that folder to the Recycle Bin** — paths are checked for kind, not just existence: photo cleanup acts only on regular files and sample folder cleanup only on directories.

---

## [0.3.39] — 2026-08-21

### Fixed
- **Collision-safe photo moves** — moving a find to another folder never overwrites an existing same-named file; a unique numbered name is selected before any file is touched.
- **Atomic move preflight and recovery** — every source photo is validated up front, completed file moves roll back if a later filesystem or database step fails, and the find row is removed in a short transaction only after the files are safe.
- **Honest partial rename paths** — a missing source photo is no longer silently attached to an unrelated same-named photo in the destination species folder.
- **Safe single-find deletion** — individual deletion now shares the DB-first batch mechanism, preventing trashed photos from being left behind a live DB record if SQL fails.

---

## [0.3.38] — 2026-08-21

### Performance
- **Scalable map loading** — wide views use bounded server-side clusters; detailed views load only points inside the visible viewport with overscan and debouncing.
- **Measured large-library improvement** — at 100,000 synthetic finds, the wide-map payload drops from 80,000 rows / 11.85 MiB to 8 aggregate rows, and measured SQL time drops from about 1.02 s to 147 ms.
- **Lightweight global context** — fit-to-all, fit-to-species, filters, and zone availability use compact map metadata rather than loading every point.

### Changed
- Cluster clicks progressively zoom toward the unchanged individual pins and popups.
- The location picker shares the viewport/cluster path while preserving existing-pin location-note reuse.
- Performance documentation and the repeatable benchmark now cover map metadata, viewport points, and server clustering.

---

## [0.3.37] — 2026-08-21

### Fixed
- **Long-session collection freezes** — blocking SQLite work no longer occupies the async runtime, and collection representatives are selected in batches instead of an N+1 query loop.
- **Safe species editing** — partial renames leave unselected finds and species metadata untouched; profile edits patch only fields owned by the dialog and use the library's canonical spelling.
- **Reliable bulk feedback** — bulk delete and move now report partial filesystem failures instead of showing a false success.
- **Map load failures are visible** — a failed backend request is no longer indistinguishable from an empty map, and location notes survive the lean map payload.
- **CSV photo paths** — statistics loads lean rows during normal use but hydrates full photo data for explicit CSV/PDF exports.
- **Database safety** — automatic migration and maintenance backups are SQLite-consistent, verified, retained outside cache folders, disk-budgeted, and protected from unsafe cleanup.
- **WAL compatibility** — WAL improves read/write overlap where supported and safely falls back to rollback journal with full synchronization on unsupported filesystems.

### Performance
- Collection, species autocomplete, map, statistics, dialogs, samples, zones, imports, and bulk operations no longer load or hydrate more library data than they use.
- Multi-item operations use bounded concurrency or one batch command instead of creating hundreds of threads, connections, and IPC calls.
- Thumbnail decoding and inactive thumbnail query caching are memory-bounded for long sessions and large photo libraries.
- Map marker icons are released outside the viewport; slow SQLite statements now emit diagnostic timing logs.
- Added a repeatable 5k/50k/100k-find benchmark and documented the measured threshold for future map clustering.

### Added
- Settings now shows database, thumbnail cache, map cache, and migration-backup usage, with access to the backup folder.
- Frontend builds now run a real TypeScript project check; the Windows Rust test runner now fails clearly if Cargo or the test binary cannot actually start.

---

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
