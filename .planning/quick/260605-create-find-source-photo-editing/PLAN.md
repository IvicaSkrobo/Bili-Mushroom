# Create find source photo editing

## Goal

Give the "Novi nalaz" selected-photo viewer the same core photo editing affordances as the saved-find lightbox: zoom, rotate, crop, and save.

## Approach

- Add a Rust command that edits an arbitrary source photo into a unique temp copy instead of overwriting the original source file.
- Add a TypeScript wrapper for that command.
- Extend the source photo viewer in `CreateFindDialog` with rotate/crop controls using the same interaction model as `PhotoLightbox`.
- Replace the selected photo path with the edited temp path, so saving the new find imports the edited image.

## Safety

- Do not mutate/delete the user's original source photo.
- Keep unsupported formats such as HEIC view-only.

## Verification

- Run `cargo check`.
- Run frontend build.
