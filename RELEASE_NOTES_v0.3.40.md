# Gljivobook v0.3.40

A small honesty follow-up to v0.3.39, from a cross-review of the delete paths.

## Fixed

- Deleting a single find no longer reports a clean success when the record was removed
  but something could not be cleaned up. The dialog now says how many files or folders
  were left behind, matching what batch deletion already reported.
- A photograph that is no longer on disk — removed outside the app, or cleaned up
  earlier — is treated as already gone rather than as a failed deletion. It no longer
  produces a warning that would send you looking for a photo that does not exist. Such
  rows are still listed by the photo library audit.
- Deleting a find that is already gone is treated as done rather than shown as an error.
  A stale list or a second confirmation no longer produces a red failure for work that
  has already happened.
- Reading a find's sample entry no longer treats an unreadable database as "this find has
  no sample". Only a genuinely absent row counts as absent; a corrupt or failing read now
  stops the delete transaction instead of quietly continuing.
- An unplugged drive or a permissions problem is no longer mistaken for deleted photos.
  Deletion, sample folder cleanup and the Settings cleanup now tell *confirmed absent*
  apart from *could not be read*, and never act on the second.
- Paths are also checked for what they are, not only whether something is there. A photo
  entry that points at a folder is left alone instead of sending that whole folder to the
  Recycle Bin, and the cleanup no longer reads such a folder as a healthy photo.
- **Clean up missing photo references** in Settings scans the whole library before it
  changes anything, removes nothing at all if any path could not be read — naming the
  path so you can plug the drive back in — and makes its row removals and primary-photo
  promotions in one transaction rather than one row at a time.

## Deliberately unchanged

- Batch deletion still reports a missing id as a per-item failure: in a batch, "one of
  the ten was not there" is worth knowing.
- A failed sample removal inside the delete transaction still aborts the whole batch.
  That path is only reachable on a genuine SQL failure, so all-or-nothing is correct
  there and continuing would hide a database problem.
- Move preflight stays strict: one missing photograph stops the move before anything is
  touched.

## Verification

- Rust: 145 passed, 0 failed, 1 ignored (optional real-GPS EXIF fixture).
- Frontend: 371 passed.
- New Rust regression tests: the single-delete path reports what it could not remove; a
  photo already off the disk is not reported; a repeated delete of the same find succeeds
  while the batch contract keeps reporting the missing id.
- The cleanup is covered end to end, not only in its decision step: a real run removes the
  row, promotes a new primary photo and writes a backup first; a folder standing in for a
  photo stops it without a single change; and a delete that fails part way rolls the whole
  cleanup back.
- New frontend tests: the delete dialog warns instead of claiming success when something
  could not be removed, and Settings distinguishes "removed N" from "nothing was removed".
- TypeScript typecheck, Cargo all-targets and the version check pass.

No database migration is required. No files are moved during installation or startup.
