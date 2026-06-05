# Create find source photo editing summary

## Changed

- Added `edit_source_photo_image` Tauri command that edits a selected source photo into a temp copy instead of overwriting the original file.
- Added `editSourcePhotoImage` frontend wrapper.
- Added rotate and crop controls to the new-find selected-photo viewer.
- Saving an edit replaces the selected preview path with the edited temp file, so the new find imports the edited version.

## Verified

- `cargo check --manifest-path src-tauri\Cargo.toml`
- `npm.cmd run build`

## Notes

- Because a new Rust command was added, the running Tauri dev app may need a restart before the edit buttons work.
