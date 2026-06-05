# PLAN - 260605-collection-folder-summary-lazy-finds

Date: 2026-06-05
Mode: /gsd-quick

## Objective

Scale Collection around SQLite-side species folder summaries and lazy per-folder find loading.

## Scope

- Add Rust commands for species folder summaries and per-species paged finds.
- Add TypeScript domain types/hooks for summaries and lazy folder finds.
- Refactor CollectionTab to render summaries first and hydrate folder rows only when opened.
- Keep existing search, date, favorites, virtualization, thumbnails, and lightbox behavior intact.

## Verification

- `npm.cmd run test -- src/tabs/CollectionTab.test.tsx src/hooks/useFinds.test.tsx src/lib/finds.test.ts src/lib/photoSrc.test.ts`
- `npm.cmd run build`
- `cargo test --manifest-path src-tauri/Cargo.toml`
