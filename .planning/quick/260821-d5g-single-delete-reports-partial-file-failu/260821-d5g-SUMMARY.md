---
quick_id: 260821-d5g
status: complete
date: 2026-08-21
---

# Quick Task 260821-d5g — Summary

Two findings from the cross-review of Codex's v0.3.39 file-safety work, both agreed by
both reviewers. Shipped as v0.3.40.

## 1. Single delete reported a success it had not earned

`delete_find` called `bulk_delete_finds_blocking`, then dropped the returned
`file_failures` into `eprintln!` and returned `Ok(())`. The dialog said the photos were
in the Recycle Bin while they were still on disk — the same dishonesty the bulk path had
already fixed in `CollectionTab.handleBulkDeleteSuccess`.

- `delete_find` now returns `BulkOperationResult`; `deleteFind` and `useDeleteFind` pass
  it through.
- `DeleteFindDialog` warns with the number of files left behind
  (`delete.partialFiles`, hr + en) instead of the success toast.
- `src/test/tauri-mocks.ts` and the dialog test previously mocked `delete_find` as
  `undefined`, which no longer described the real contract; both now return the struct.

## 2. Deleting an already-gone find showed a red error

Old behaviour was a no-op (`DELETE` hitting zero rows was `Ok`). v0.3.39 turned that into
`Err("Find no longer exists")`, reachable from a stale list or a double confirm.

A zero-completion result is now re-checked against the row: gone means the delete already
happened and reports as completed; still present means a real failure the caller must see.
No string matching on the error, and the bulk contract is untouched —
`bulk_delete_tolerates_ids_that_are_already_gone` still expects a per-item report, which
is right for a batch.

## Structure

The healing logic was extracted into `delete_single_find_blocking` so tests can reach it.
Left inside the async `#[tauri::command]` it would have been unverifiable, since the
suite tests the `_blocking` helpers.

## Rejected finding (mine, and I was wrong)

I had flagged `remove_sample_for_find(...)?` aborting the whole batch inside the delete
transaction as an inconsistency. Codex disagreed and was right:
[samples.rs:351](../../../src-tauri/src/commands/samples.rs) returns `Ok(())` when no
sample exists, so the only route to `Err` is a genuine SQL failure. Aborting an atomic
transaction is correct there; continuing would mask a database problem. I had conflated a
benign "row already gone" with a real failure — they deserve different handling, and the
code already did the right thing.

## Verification

- Rust: **136 passed**, 0 failed, 1 ignored — two new regression tests.
- Frontend: **369 passed** — one new dialog test.
- `npm run typecheck`, `cargo check --all-targets`, `npm run version:check` all clean.

## Left open

- Codex's error-message polish for the aborted-batch case is not done.
- Viewport map fetch is already shipped (v0.3.38); the next scalability item after that
  is foreground thumbnail priority, only if warmup is ever seen to stutter scrolling.
- Filesystem and SQLite still cannot be one atomic transaction; full crash resilience
  during a rename/move would need an operation journal. Pre-existing, not a regression.
- No direct UI test clicks the CSV button in `StatsTab` (Codex's noted gap, still open).
