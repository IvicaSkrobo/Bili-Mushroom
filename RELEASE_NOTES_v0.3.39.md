# Gljivobook v0.3.39

This is a focused file-safety follow-up to v0.3.38.

## Fixed

- Moving photographs out of the library never overwrites a same-named file already in
  the chosen destination; Gljivobook selects a numbered filename instead.
- All source photographs are checked before the first move. If a later filesystem or
  database step fails, completed moves are returned to their original paths.
- The find and sample rows are removed in one short transaction after the files have
  moved successfully.
- Renaming part of a species no longer connects a missing photo row to an unrelated
  same-named file that happens to exist in the target species folder.
- Single-find deletion uses the same DB-first safety order as batch deletion.

## Verification

- Rust: 134 passed, 0 failed, 1 ignored (optional real-GPS EXIF fixture).
- Three new regression tests prove destination collision handling, whole-find preflight,
  and protection against same-named target-file attachment during partial rename.
- Cargo all-targets passes.

No database migration is required. No files are moved during installation or startup.
