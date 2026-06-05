# Duplicate photo import guard

## Goal

Fix the import/save bug where selecting the same source photo more than once can partially save a find and delete the source file before duplicate handling catches up.

## Scope

- Deduplicate selected photo paths in the import dialog and edit-find add-photos flow.
- Deduplicate source paths again in Rust before copying/deleting files.
- Keep changes narrowly scoped; do not alter existing import layout or unrelated dirty work.

## Verification

- Add focused Rust unit coverage for source-path deduplication.
- Run targeted frontend/Rust tests where practical.
