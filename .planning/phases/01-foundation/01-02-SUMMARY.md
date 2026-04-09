---
plan: 01-02
phase: 01-foundation
status: complete
completed: 2026-04-09
tests: 12 passing, 10 todo (Wave 0 stubs from plan 01)
build: passing
---

# Plan 01-02 Summary: Rust/DB Layer

## What Was Built

Wired the full persistence backbone: Tauri plugins registered in Rust, initial SQLite migration with WAL mode, ACL capabilities, and TypeScript storage/db libraries.

## Key Files Created/Modified

| File | What It Does |
|------|-------------|
| `src-tauri/migrations/0001_initial.sql` | Initial schema: `PRAGMA journal_mode=WAL`, `app_metadata` table, schema_version seed |
| `src-tauri/src/lib.rs` | Registers tauri-plugin-dialog, tauri-plugin-store, tauri-plugin-sql with migration v1 via `include_str!` |
| `src-tauri/capabilities/default.json` | ACL: sql (default, execute, select, load, close), dialog (default, allow-open), store (default, get, set, save, load) |
| `src/lib/storage.ts` | `loadStoragePath`, `pickAndSaveStoragePath`, `clearStoragePath` — persists to `preferences.json` via tauri-plugin-store |
| `src/lib/db.ts` | `getDatabase`, `initializeDatabase`, `verifyWalMode`, `DatabaseInitError` — belt-and-suspenders WAL enforcement |
| `src/stores/appStore.ts` | Real Zustand store (was already real from Plan 01 scaffold — confirmed shape) |

## Test Results

- `npm run test -- src/lib/` → **12 passing** (5 storage + 7 db)
- `npm run test` (full suite) → **12 passing + 10 todo** (Wave 0 stubs from Plan 01 pending Plan 03)
- `npm run build` → exits 0

## ACL Permission Identifiers

Used exactly as planned — no adjustments needed. Identifiers matched Tauri 2.x plugin naming convention:
- `sql:default`, `sql:allow-execute`, `sql:allow-select`, `sql:allow-load`, `sql:allow-close`
- `dialog:default`, `dialog:allow-open`
- `store:default`, `store:allow-get`, `store:allow-set`, `store:allow-save`, `store:allow-load`

## Pitfall 2 / A2 Tracking (Connection String Mismatch)

`lib.rs` registers migrations under `"sqlite:bili-mushroom.db"` (relative key).
`db.ts` loads via `sqlite:<absPath>/bili-mushroom.db` (absolute key).

These may not match — migrations may silently skip if the plugin keys by connection string.

**Mitigation in place:** Code comment in `lib.rs` above `add_migrations` referencing Pitfall 2/A2. Plan 03 smoke gate (Task 4, step 11) directly verifies the `app_metadata` table exists in the created DB file. If it doesn't exist, a gap-closure plan switches to Pattern 4 (custom Rust `tauri::command` using sqlx for DB init).

## WAL Mode

PRAGMA appears in:
1. `src-tauri/migrations/0001_initial.sql` — runs at migration time (may be in a transaction)
2. `src/lib/db.ts` → `initializeDatabase` → `db.execute('PRAGMA journal_mode=WAL', [])` — runs after load, outside transaction
3. `verifyWalMode` — throws `DatabaseInitError` if WAL is not active after both attempts

Runtime verification deferred to Plan 03 smoke checkpoint (step 12: SQLite browser check).

## Commits

- `8fd67cf` feat(01-02): wire Rust plugins, migration 0001 with WAL, and ACL capabilities
- `4687129` test(01-02): RED - storage and db unit test stubs
- `64201b9` feat(01-02): GREEN - implement storage.ts and db.ts with DatabaseInitError and WAL verification
- `f03c2aa` docs(01-02): complete Rust/DB layer plan - research, ROADMAP progress
