# PLAN - 260605-large-collection-photo-performance

Date: 2026-06-05
Mode: /gsd-quick

## Objective

Improve Collection scalability for large local databases and many photos.

## Scope

- Add SQLite indexes for find filtering, sorting, and photo lookups.
- Reduce Collection query payload where safe.
- Add frontend debounce/stability where it lowers search and render churn.
- Verify with focused frontend tests/build and Rust compilation attempt.

## Verification

- `npm.cmd run test -- src/tabs/CollectionTab.test.tsx src/lib/finds.test.ts src/hooks/useFinds.test.tsx`
- `npm.cmd run build`
- `cargo test --manifest-path src-tauri/Cargo.toml`
