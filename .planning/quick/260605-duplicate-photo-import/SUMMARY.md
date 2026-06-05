# Duplicate photo import guard summary

## Changed

- Added source-path normalization/deduplication in Rust import handling before copy/delete operations.
- Reused the same guard when adding photos to an existing find.
- Deduplicated selected photo paths in import and edit-find dialogs.

## Verified

- `cargo check --manifest-path src-tauri\Cargo.toml`
- `npm.cmd test -- --run src/components/import/ImportDialog.test.tsx`
- `npm.cmd run build`

## Notes

- `cargo test` compiled the test binary but failed to launch on this machine with `STATUS_ENTRYPOINT_NOT_FOUND`.
- The combined `EditFindDialog` test run still has an existing date-field query failure unrelated to the duplicate-photo changes.
