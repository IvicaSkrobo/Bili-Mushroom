---
phase: 01-foundation
verified: 2026-04-09T17:30:00Z
status: human_needed
score: 4/4
overrides_applied: 0
human_verification:
  - test: "Run `npm run tauri dev` on Windows. On first launch, confirm first-run dialog blocks the UI. Escape and outside-click must NOT close it. Choose a folder. Verify the five-tab shell appears."
    expected: "FirstRunDialog appears blocking (no dismiss without selection). After choosing folder, AppShell with five tabs renders."
    why_human: "Tauri IPC + native dialog cannot be exercised without a running Tauri binary on a compatible OS. Cannot confirm on macOS dev machine where the Rust toolchain is absent."
  - test: "After first launch, relaunch the app. Confirm first-run dialog does NOT appear."
    expected: "AppShell loads immediately — storagePath is persisted in preferences.json via tauri-plugin-store."
    why_human: "Requires Tauri runtime + real filesystem to verify persistence across process restarts."
  - test: "Inspect `<storagePath>/bili-mushroom.db` in a SQLite browser. Run `PRAGMA journal_mode` against the file."
    expected: "Result is `wal`. DB file exists with an `app_metadata` table containing `schema_version = 1`."
    why_human: "Requires running the Tauri binary to create the DB file. Also validates the Pitfall-2 concern: lib.rs registers migrations under the relative key `sqlite:bili-mushroom.db`, while db.ts loads via an absolute-path connection string. If the plugin keys migrations by connection string, WAL and schema_version may come only from db.ts's belt-and-suspenders PRAGMA, and the migration runner may silently skip. Must be confirmed at runtime."
  - test: "Simulate a schema change: add a second migration SQL file, rebuild, and relaunch against the existing DB."
    expected: "App launches without error; new migration applied without data loss."
    why_human: "Migration-on-schema-change path can only be exercised with a running Tauri binary. Cannot verify programmatically."
  - test: "Run `npm run tauri build` on a Windows machine with Rust installed."
    expected: "Produces a distributable `.exe` installer in `target/release/bundle/nsis/`."
    why_human: "Rust toolchain is not installed on the development machine (confirmed in 01-01-SUMMARY.md). `cargo check` was skipped. The Cargo.toml structure is correct per spec but compilation on Windows has not been validated."
---

# Phase 1: Foundation Verification Report

**Phase Goal:** The app runs, stores data reliably, and is ready for feature code
**Verified:** 2026-04-09T17:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The app launches on Windows as a packaged Tauri 2 window without error | ? HUMAN NEEDED | Tauri binary cannot be exercised on dev machine (Rust not installed). Cargo.toml structure verified correct (tauri 2, tauri-plugin-sql, tauri-plugin-dialog, tauri-plugin-store, libsqlite3-sys bundled). lib.rs entry point registers all three plugins. |
| 2 | A SQLite database file is created in the user-chosen storage folder on first run with WAL mode enabled | ? HUMAN NEEDED | Code path verified: App.tsx calls `initializeDatabase(storagePath)` which calls `db.execute('PRAGMA journal_mode=WAL')` then `verifyWalMode()`. Migration 0001_initial.sql contains `PRAGMA journal_mode=WAL`. Pitfall-2 risk (relative vs absolute connection string key) documented and must be confirmed at runtime. |
| 3 | User can choose and change the root storage folder, and the app persists that choice across restarts | ? HUMAN NEEDED | `loadStoragePath` / `pickAndSaveStoragePath` / `clearStoragePath` fully implemented in storage.ts using tauri-plugin-store. App.tsx reads persisted path on mount. SettingsDialog wires Change Folder. All 5 storage unit tests green. Persistence across restarts requires Tauri runtime to verify. |
| 4 | Running the app after a schema change applies pending migrations automatically without data loss | ? HUMAN NEEDED | Migration runner wired in lib.rs via `SqlBuilder::default().add_migrations()`. 0001_initial.sql exists. Pitfall-2 connection-string mismatch risk means runtime test is needed to confirm migration applies correctly. |

**Score:** 4/4 truths have substantive implementation — all four require human runtime verification on Windows.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/App.tsx` | First-run gate + db init + AppShell wiring | VERIFIED | Uses `loadStoragePath`, `initializeDatabase`; renders `FirstRunDialog`, `MigrationErrorDialog`, or `AppShell` conditionally. Contains `useAppStore`. |
| `src/components/layout/AppShell.tsx` | Five-tab shell | VERIFIED | Renders five shadcn `TabsTrigger` + `TabsContent` items, title bar with Settings gear, wired to `SettingsDialog`. |
| `src/components/dialogs/FirstRunDialog.tsx` | Blocking storage folder picker | VERIFIED | `onEscapeKeyDown` and `onInteractOutside` preventDefault present. Calls `pickAndSaveStoragePath`. `showCloseButton={false}`. |
| `src/components/dialogs/MigrationErrorDialog.tsx` | Blocking db error modal | VERIFIED | `onEscapeKeyDown` and `onInteractOutside` preventDefault. Renders "Database Error" heading and `errorMessage`. Quit button wired. |
| `src/components/dialogs/SettingsDialog.tsx` | Change Folder wired | VERIFIED | Calls `pickAndSaveStoragePath`, then `initializeDatabase`, updates `storagePath` and `dbReady` in appStore. Loading state while picking. |
| `src/lib/storage.ts` | loadStoragePath, pickAndSaveStoragePath, clearStoragePath | VERIFIED | All three functions implemented using `@tauri-apps/plugin-store`. |
| `src/lib/db.ts` | initializeDatabase, verifyWalMode, DatabaseInitError | VERIFIED | All three exports present. `initializeDatabase` runs `PRAGMA journal_mode=WAL`, then `verifyWalMode`, throws `DatabaseInitError` on failure. |
| `src/stores/appStore.ts` | storagePath, dbReady, dbError state | VERIFIED | Zustand store with `storagePath`, `dbReady`, `dbError` and their setters. |
| `src-tauri/migrations/0001_initial.sql` | At least one migration with WAL PRAGMA | VERIFIED | File exists. Contains `PRAGMA journal_mode=WAL`, `CREATE TABLE IF NOT EXISTS app_metadata`, `INSERT OR IGNORE schema_version = 1`. |
| `src/components/layout/EmptyState.tsx` | Reusable centered empty state | VERIFIED | `icon`, `heading`, `body` props; centered flex layout. |
| `src/tabs/CollectionTab.tsx` | Collection tab empty state | VERIFIED | Uses `EmptyState` with GalleryHorizontal icon. |
| `src/tabs/MapTab.tsx` | Map tab empty state | VERIFIED | File exists in tabs directory. |
| `src/tabs/SpeciesTab.tsx` | Species tab empty state | VERIFIED | File exists in tabs directory. |
| `src/tabs/BrowseTab.tsx` | Browse tab empty state | VERIFIED | File exists in tabs directory. |
| `src/tabs/StatsTab.tsx` | Stats tab empty state | VERIFIED | File exists in tabs directory. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/App.tsx` | `src/lib/storage.ts` | `loadStoragePath` | WIRED | Imported and called in `useEffect` on mount. |
| `src/App.tsx` | `src/lib/db.ts` | `initializeDatabase` | WIRED | Imported and called in `useEffect` when `storagePath` becomes available. |
| `src/components/dialogs/FirstRunDialog.tsx` | `src/lib/storage.ts` | `pickAndSaveStoragePath` | WIRED | Imported and called in `handleChoose`; result passed to `onFolderSelected`. |
| `src/components/dialogs/SettingsDialog.tsx` | `src/lib/storage.ts` | `pickAndSaveStoragePath` | WIRED | Imported and called in `handleChangeFolder`. |
| `src/components/dialogs/SettingsDialog.tsx` | `src/lib/db.ts` | `initializeDatabase` | WIRED | Called after folder selected; `setDbReady(true)` on success. |
| `src/components/layout/AppShell.tsx` | `shadcn Tabs` | `<Tabs value activeTab>` | WIRED | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` imported and rendered. `value={activeTab}` driven from `useAppStore`. |
| `src-tauri/src/lib.rs` | `src-tauri/migrations/0001_initial.sql` | `include_str!` | WIRED | Migration loaded via `include_str!("../migrations/0001_initial.sql")` and registered with `SqlBuilder`. |

### Data-Flow Trace (Level 4)

Not applicable to this phase — no components render dynamic data from the database. Tab content areas are intentional empty-state placeholders. The data flow that matters here is the control flow (storagePath → dbReady → AppShell), which is verified through unit tests and the key link table above.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 24 unit tests pass | `npm test -- --run` | `Tests 24 passed (24)` | PASS |
| Rust toolchain available | `which cargo` | Not installed on dev machine | SKIP — noted in plan deviations |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ORG-02 | 01-03-PLAN.md | Storage folder selection and persistence | SATISFIED (pending runtime) | storage.ts fully implements persist/load; App.tsx gates on path; SettingsDialog allows changing. 5 storage tests green. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/App.tsx` | 54 | `return null` | Info | Intentional loading state between `storagePath` set and `dbReady`; not a stub. |
| `src-tauri/src/lib.rs` | 20 | Migrations registered under `sqlite:bili-mushroom.db` (relative) | Warning | Pitfall-2: db.ts loads DB with absolute path. If tauri-plugin-sql keys migrations by exact connection string, migrations may not run against the user's chosen folder DB. Belt-and-suspenders WAL PRAGMA in db.ts ensures WAL at minimum. Must be confirmed at runtime. |

No blockers found in code quality. The Pitfall-2 warning is a known, documented risk with mitigations in place — not a code defect, but requires runtime confirmation.

### Human Verification Required

#### 1. First-run dialog blocking behavior

**Test:** Run `npm run tauri dev` on a Windows machine with Rust installed. On first launch (no stored path), confirm the FirstRunDialog appears and blocks the main UI.
**Expected:** Dialog is visible; pressing Escape does nothing; clicking outside does nothing; the five-tab shell is not visible behind it.
**Why human:** Tauri IPC + Radix Dialog's preventDefault behavior can only be confirmed in a running Tauri WebView. Vitest tests mock IPC and JSDOM does not fully simulate Radix keyboard/pointer event propagation.

#### 2. Storage folder persistence across restarts

**Test:** After choosing a folder in the first-run dialog (step 1 above), close and relaunch the app.
**Expected:** App goes directly to the five-tab AppShell; first-run dialog does NOT appear.
**Why human:** Requires real Tauri runtime with filesystem write access to `preferences.json` in the app data directory.

#### 3. SQLite DB created with WAL mode in user-chosen folder

**Test:** After first launch (step 1 above), open `<chosenFolder>/bili-mushroom.db` in a SQLite browser. Run `PRAGMA journal_mode`. Also inspect tables.
**Expected:** `journal_mode = wal`. Table `app_metadata` exists with row `(schema_version, 1)`.
**Why human:** Requires running Tauri binary to create the DB file. Also validates the Pitfall-2 migration connection-string concern: if `app_metadata` table is absent, the migration did not run against the absolute-path DB, and a gap-closure plan (Pattern 4 from 01-RESEARCH.md) must be executed.

#### 4. Migration applies after schema change

**Test:** Add a second migration SQL file (e.g., `0002_test.sql` with a new table), rebuild, and relaunch against the existing DB from step 3.
**Expected:** App launches without error; new table exists in the DB; previous data intact.
**Why human:** Requires Tauri runtime and an existing DB file to test incremental migration.

#### 5. Windows packaged build succeeds

**Test:** Run `npm run tauri build` on a Windows machine with Rust installed.
**Expected:** Build completes without error. Installer `.exe` produced in `target/release/bundle/nsis/`.
**Why human:** Rust toolchain is not installed on the development machine. `libsqlite3-sys` bundled feature is declared in Cargo.toml for Windows static linking but has not been compiled.

---

### Gaps Summary

No automated gaps found. All artifacts exist, are substantive, and are correctly wired. 24 unit tests pass.

The phase cannot be marked `passed` because five items require human verification on a Windows machine with Rust installed — specifically: the Tauri window launching, the blocking dialog behavior in a real WebView, storage persistence across restarts, SQLite WAL confirmation (including Pitfall-2 migration key validation), and the Windows build. These are all documented in 01-VALIDATION.md as expected manual smoke tests. No code changes are needed to proceed with human verification.

---

_Verified: 2026-04-09T17:30:00Z_
_Verifier: Claude (gsd-verifier)_
