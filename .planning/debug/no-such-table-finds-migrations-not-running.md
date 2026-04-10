---
status: awaiting_human_verify
trigger: "no-such-table-finds-migrations-not-running"
created: 2026-04-10T00:00:00Z
updated: 2026-04-10T00:30:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED (new bug) — Previous fix removed tauri-plugin-sql from Rust (Cargo.toml, lib.rs) but did NOT update db.ts. App.tsx calls initializeDatabase() which calls Database.load() from @tauri-apps/plugin-sql — a plugin no longer registered in Rust. The IPC call fails immediately at launch (if storagePath is persisted from previous run) or when user picks a folder (SettingsDialog), producing the "database error on launch" dialog. The fix was incomplete: only the Rust side was cleaned up, not the JS side.
test: Confirmed by reading db.ts (still imports Database from @tauri-apps/plugin-sql, calls Database.load()), App.tsx (calls initializeDatabase on storagePath), SettingsDialog.tsx (calls initializeDatabase on folder change), package.json (@tauri-apps/plugin-sql still in dependencies)
expecting: N/A — root cause confirmed
next_action: Fix db.ts to remove plugin-sql usage — replace initializeDatabase with invoke('get_finds') call to eagerly trigger open_db() migrations; remove @tauri-apps/plugin-sql from package.json; update db.test.ts

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: App opens, SQLite DB is initialized with schema (finds, find_photos tables), import works, collection tab loads
actual: "Duplicate check failed: no such table: finds" on import; "failed to prepare query: no such table: finds" on collection tab
errors:
  - "Duplicate check failed: no such table: finds"
  - "failed to prepare query: no such table: finds"
reproduction: Build the app (npm run tauri build or equivalent), run installer, open app, try import or view collection tab
started: Never worked — first time testing a built installer
run_mode: Built installer (NOT npm run tauri dev)

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: Migration SQL files not bundled in the build
  evidence: Migrations are embedded via include_str!() at compile time — no disk files needed at runtime
  timestamp: 2026-04-10T00:05:00Z

- hypothesis: tauri-plugin-sql migration registration missing (plugin connected without migrations)
  evidence: lib.rs line 35 correctly calls .add_migrations("sqlite:bili-mushroom.db", migrations) with all 3 Migration structs
  timestamp: 2026-04-10T00:05:00Z

- hypothesis: Frontend DB init code not calling plugin correctly
  evidence: Frontend (finds.ts) uses invoke() to call Rust commands — it NEVER calls Database.load(). db.ts exists but is never used by the actual app flow.
  timestamp: 2026-04-10T00:05:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-04-10T00:03:00Z
  checked: src-tauri/src/lib.rs
  found: tauri-plugin-sql registered correctly with 3 Migration structs embedded via include_str!(). Plugin key is "sqlite:bili-mushroom.db" (relative path, no directory).
  implication: The plugin WOULD run migrations — but only when JS calls Database.load("sqlite:bili-mushroom.db")

- timestamp: 2026-04-10T00:03:00Z
  checked: src/lib/finds.ts + src/lib/db.ts
  found: All frontend DB operations go through invoke() (Rust Tauri commands). db.ts exists with getDatabase() / initializeDatabase() but is NOT called by any component — it's dead code. No JS code ever calls Database.load().
  implication: tauri-plugin-sql migrations NEVER execute. The plugin is registered but its DB is never opened.

- timestamp: 2026-04-10T00:04:00Z
  checked: src-tauri/src/commands/import.rs open_db() function (line 60-63)
  found: open_db() calls rusqlite::Connection::open(format!("{}/bili-mushroom.db", storage_path)). This is a raw rusqlite connection with zero migration logic. It opens whatever SQLite file is at that path, or creates a blank one.
  implication: Every Rust command (import_find, get_finds, update_find, delete_find, get_find_photos) opens a connection to a schema-less database. "no such table: finds" is exact because migrations were never applied to this connection.

- timestamp: 2026-04-10T00:04:00Z
  checked: tauri-plugin-sql migration key "sqlite:bili-mushroom.db" vs rusqlite path "{storagePath}/bili-mushroom.db"
  found: These are TWO DIFFERENT database files. The plugin's key "sqlite:bili-mushroom.db" resolves to AppData (e.g. C:\Users\<user>\AppData\Roaming\com.bili-mushroom.app\bili-mushroom.db). The rusqlite connection opens {user-chosen storagePath}/bili-mushroom.db. Even if JS called Database.load(), it would initialize the wrong file.
  implication: There are two separate DB files. The one that gets migrated (AppData) is never queried. The one that gets queried (storagePath) is never migrated.

- timestamp: 2026-04-10T00:25:00Z
  checked: src/lib/db.ts, src/App.tsx, src/components/dialogs/SettingsDialog.tsx, package.json
  found: db.ts still imports Database from @tauri-apps/plugin-sql and calls Database.load() in initializeDatabase(). App.tsx calls initializeDatabase(storagePath) on mount (when storagePath is persisted from prior run) and SettingsDialog.tsx calls it on folder change. package.json still has "@tauri-apps/plugin-sql": "^2". The Rust binary no longer registers this plugin — IPC call fails immediately, triggering MigrationErrorDialog on launch.
  implication: The previous fix was incomplete. Every production launch with a persisted storagePath hits this failure path.

- timestamp: 2026-04-10T00:28:00Z
  checked: fix applied — db.ts rewritten, db.test.ts rewritten, tauri-mocks.ts updated, package.json updated
  found: npm test: 116 passed, 1 skipped (pre-existing). cargo test: 37 passed, 0 failed. TypeScript compiles without errors.
  implication: Fix is self-verified. Awaiting production build confirmation.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: The previous fix was incomplete. Rust side was correctly fixed (migrate_db() in open_db(), tauri-plugin-sql removed from Cargo.toml/lib.rs). But src/lib/db.ts was NOT updated — it still imports Database from @tauri-apps/plugin-sql and calls Database.load() inside initializeDatabase(). App.tsx calls initializeDatabase(storagePath) on mount whenever a persisted storagePath exists, and SettingsDialog.tsx calls it on folder change. Both calls fail at runtime because the IPC endpoint no longer exists in the Rust binary, producing the "database error on launch" dialog. package.json also still lists @tauri-apps/plugin-sql as a dependency.

fix: (1) Rewrote db.ts — removed @tauri-apps/plugin-sql import entirely, replaced initializeDatabase with invoke('get_finds', { storagePath }) which triggers open_db() and therefore migrate_db() in Rust; kept DatabaseInitError class for App.tsx/SettingsDialog.tsx error handling. (2) Removed @tauri-apps/plugin-sql from package.json dependencies. (3) Rewrote db.test.ts to test the new invoke-based implementation. (4) Removed @tauri-apps/plugin-sql mock from tauri-mocks.ts.
verification: npm test — 116 passed, 1 skipped (pre-existing skip). cargo test — 37 passed, 0 failed. TypeScript compiles clean. Awaiting production build confirmation from user.
files_changed:
  - src/lib/db.ts
  - src/lib/db.test.ts
  - src/test/tauri-mocks.ts
  - package.json
