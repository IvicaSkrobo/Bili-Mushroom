# Photo Safety + Update Hardening

Date: 2026-05-12
Type: quick maintenance

## Goal

Make the app safer around user photos after updates and manual cleanup:

- App updates must never delete or prune user photo files.
- Manual find/photo deletion remains available, and per-photo deletion must visibly show whether file removal is permanent.
- Missing-photo cleanup must be clearly framed as database-reference cleanup, not file deletion.
- Zone/map overlay defaults should avoid Leaflet zoom controls and start from a compact, usable position.

## Changes

- Added explicit `permanentDelete` support to single-photo and bulk-photo delete commands.
- Added visible "Permanently delete file(s)" checkboxes for per-photo delete surfaces; default is checked per product direction.
- Kept find-level "delete record + files" behavior using Recycle Bin.
- Added confirmation around advanced missing-photo reference cleanup.
- Renamed cleanup copy to clarify it removes database references only and does not delete photo files.
- Reset zone toolbar default position to the right of Leaflet zoom controls and made it more compact.
- Reset zone editor default position to the lower-left map area and reduced its width/padding.

## Safety Policy

- Updater/release changes must not touch the selected storage folder contents.
- Schema migrations may update database tables, but must not remove image files.
- Missing-photo cleanup is manual, confirmed, and only removes DB rows for files that are already absent.
- Manual per-photo deletion may permanently delete files only when the visible checkbox is checked; unchecking uses the Recycle Bin path.

## Verification

- Run `npm.cmd run build`.
- Run relevant Rust tests when time allows, especially commands around `delete_find_photo` and `bulk_delete_find_photos`.
