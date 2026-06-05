# Plan: duplicate photo DB cleanup

## Goal
Safely clean duplicate `find_photos` database rows without deleting or moving user photo files.

## Steps
- Inspect existing photo audit, prune, and backup helpers.
- Add preview/audit fields for duplicate rows if needed.
- Add cleanup command that backs up DB first, removes duplicate DB rows only, preserves primary flags, and repairs primaries.
- Add TS wrapper/mock and focused verification.

## Done
- Reused existing duplicate audit output for preview.
- Added conservative `cleanup_duplicate_photo_rows` command.
- Cleanup only removes duplicate `find_id + photo_path` rows, never physical files and never cross-find shared references.
- DB backup is created before any delete.
- Primary photo flags are repaired for affected finds.
- Added TypeScript wrapper and test mock.
- Verified with focused frontend tests, frontend build, and Rust check.
