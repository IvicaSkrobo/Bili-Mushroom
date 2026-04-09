# Phase 1: Foundation - Research

**Researched:** 2026-04-09
**Domain:** Tauri 2 scaffold, SQLite migrations, shadcn/ui init, storage folder persistence
**Confidence:** HIGH (stack fully verified against official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** First-run modal dialog — blocks the main UI until the user has chosen a storage folder. Hard gate.
- **D-02:** "Change folder" option lives in a Settings/Preferences panel (not the main nav). When changed, app offers to move or copy the existing database to the new folder (move/copy prompt is Phase 2 scope; Phase 1 wires the dialog only).
- **D-03:** If user dismisses/cancels the first-run dialog without choosing a folder, re-show the prompt. Never leave the app with no storage folder configured.
- **D-04:** Phase 1 establishes the FULL tab navigation shell (Collection, Map, Species, Browse, Stats). Each tab shows a placeholder empty state. No structural refactors later.
- **D-05:** Migrations auto-apply silently on every startup.
- **D-06:** On migration failure: show a clear error dialog with failure details and refuse to start the app. Safe fail > silent corruption.
- **D-07:** The `.db` file lives INSIDE the user-chosen storage folder (`<StorageRoot>/bili-mushroom.db`). The storage folder path preference is stored in Tauri's app data dir.
- **D-08:** SQLite MUST use WAL mode (`PRAGMA journal_mode=WAL`).
- **D-09:** Migration runner MUST be in place before any feature code writes to DB.
- **D-10:** Stack is Tauri 2.x + React 18+ + TypeScript + Rust. No deviations.

### Claude's Discretion

- Exact visual design of the first-run storage selection dialog — functional and clear is sufficient.
- Tab navigation style (top tabs vs. sidebar) — UI-SPEC mandates top horizontal tabs.
- Internal migration file format (`.sql` files vs. embedded Rust strings) — follow tauri-plugin-sql conventions (inline Rust structs or `include_str!`).
- App icon and window title — use "Bili Mushroom" as the title; icon can be a placeholder for now.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ORG-02 | User can choose and change the root storage folder where all organized mushroom data lives | tauri-plugin-dialog (folder picker) + tauri-plugin-store (persistence) + Zustand (runtime state) |
</phase_requirements>

---

## Summary

Phase 1 is a pure scaffolding phase — no mushroom domain features, just the durable skeleton that all future phases plug into. There are three technical problems to solve: (1) getting a Tauri 2 + React + TypeScript project running on Windows with all required plugins registered; (2) wiring up SQLite via tauri-plugin-sql with WAL mode enabled and a migration runner that fails safely; and (3) delivering ORG-02 — a blocking first-run dialog for storage folder selection backed by tauri-plugin-store persistence, plus the five-tab navigation shell.

The biggest practical risk is WAL mode: tauri-plugin-sql's official documentation does not address WAL configuration and an open GitHub issue (#2328) notes WAL is "not planned" for the plugin itself. However, the workaround is straightforward and well-established in the community: include `PRAGMA journal_mode=WAL;` as the first statement in migration version 1. SQLite executes PRAGMAs in migration SQL just like any other statement, so this is not a blocker.

A second practical risk is capabilities/permissions: Tauri 2's ACL model requires each plugin's permissions to be explicitly declared in `src-tauri/capabilities/default.json`. Missing a permission silently breaks the corresponding JS API call. All required permission identifiers are documented in this research.

**Primary recommendation:** Scaffold with `npm create tauri-app@latest`, then add the four required plugins (tauri-plugin-sql, tauri-plugin-dialog, tauri-plugin-store, and the built-in path API) one at a time, declaring capabilities after each addition and verifying with `npm run tauri dev` before moving to the next.

---

## Project Constraints (from CLAUDE.md)

| Directive | Category | Enforcement |
|-----------|----------|-------------|
| Platform: Windows primary (Win 10/11) | Build target | Tauri.conf.json windows bundle; test on Windows |
| Storage: 100% local, no internet for core features | Architecture | No external API calls in data layer |
| Distribution: Packaged installer, no Node/Rust on end user machine | Build | `npm run tauri build` produces self-contained NSIS .exe |
| Tech Stack: Tauri 2.x + React 18+ + TypeScript + Rust | Hard constraint | No deviations |
| SQLite WAL mode required | Data integrity | PRAGMA in migration version 1 |
| Migration runner before any feature code writes DB | Ordering | Phase 1 delivers this; subsequent phases depend on it |
| libsqlite3-sys bundled feature required on Windows | Build | Add to Cargo.toml or Windows builds fail |
| shadcn/ui + Tailwind CSS 4.x | UI layer | Follow UI-SPEC init sequence |
| Zustand 5.x | Global state | Active tab, storage folder path |
| TanStack Query 5.x | Async data | Wrap all Tauri IPC calls |

---

## Standard Stack

### Core (Phase 1 only)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tauri | 2.10.x | Desktop shell, Window, IPC | Official; 2.10.3 is latest stable [VERIFIED: CLAUDE.md research] |
| React | 18.x | UI rendering | Already committed to project |
| TypeScript | 5.x | Type safety | Non-negotiable per CLAUDE.md |
| Vite | 5.x | Frontend build | Default Tauri 2 scaffolding [VERIFIED: official docs] |
| tauri-plugin-sql | 2.x | SQLite IPC bridge + migration runner | Official plugin, handles migrations at startup [VERIFIED: v2.tauri.app/plugin/sql/] |
| libsqlite3-sys | >=0.17.2 | Statically link SQLite on Windows | Required to avoid "sqlite3.lib not found" Windows build error [VERIFIED: CLAUDE.md research] |
| tauri-plugin-dialog | 2.x | Native OS folder picker dialog | Official plugin; `open({ directory: true })` [VERIFIED: v2.tauri.app/plugin/dialog/] |
| tauri-plugin-store | 2.x | Persist storage folder path across restarts | Official plugin; JSON key-value store in app data dir [VERIFIED: v2.tauri.app/plugin/store/] |
| @tauri-apps/api/path | (bundled) | Get `AppData\Roaming\bili-mushroom\` path | Official JS API; `appDataDir()` [VERIFIED: v2.tauri.app/reference/javascript/api/namespacepath/] |
| shadcn/ui | current CLI | Accessible UI components | Project decision per CLAUDE.md [VERIFIED: ui.shadcn.com] |
| Tailwind CSS | 4.x | Utility styling | Paired with shadcn/ui v4 [VERIFIED: ui.shadcn.com] |
| Zustand | 5.0.x | Global UI state (active tab, storage path) | Project decision per CLAUDE.md |
| TanStack Query | 5.x | Async IPC data fetching | Project decision per CLAUDE.md |
| lucide-react | (bundled with shadcn) | Icons (Sprout, Settings, tab icons) | Bundled with shadcn/ui; no separate install needed |

### Cargo.toml additions (src-tauri)

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
tauri-plugin-dialog = "2"
tauri-plugin-store = "2"
libsqlite3-sys = { version = ">=0.17.2", features = ["bundled"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

### npm packages

```bash
npm install @tauri-apps/plugin-sql @tauri-apps/plugin-dialog @tauri-apps/plugin-store
npm install zustand @tanstack/react-query
npm install @tauri-apps/api
```

shadcn/ui is CLI-managed — do NOT npm install it. See Architecture Patterns below.

---

## Architecture Patterns

### Recommended Project Structure

```
bili-mushroom/
├── src/
│   ├── main.tsx                 # React entry point, QueryClientProvider, App
│   ├── App.tsx                  # Root component: first-run gate + tab shell
│   ├── components/
│   │   ├── ui/                  # shadcn/ui generated components (CLI-managed)
│   │   ├── layout/
│   │   │   ├── AppShell.tsx     # Title bar row + tab nav
│   │   │   └── EmptyState.tsx   # Reusable empty state component
│   │   └── dialogs/
│   │       ├── FirstRunDialog.tsx
│   │       ├── MigrationErrorDialog.tsx
│   │       └── SettingsDialog.tsx
│   ├── stores/
│   │   └── appStore.ts          # Zustand store: activeTab, storagePath, dbReady
│   ├── hooks/
│   │   └── useDatabase.ts       # TanStack Query wrapper for Tauri IPC
│   ├── lib/
│   │   └── db.ts                # Database.load() call + typed query helpers
│   └── tabs/
│       ├── CollectionTab.tsx
│       ├── MapTab.tsx
│       ├── SpeciesTab.tsx
│       ├── BrowseTab.tsx
│       └── StatsTab.tsx
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs               # Plugin registration, migrations, setup hook
│   │   └── main.rs              # Desktop entry point
│   ├── migrations/              # Optional: .sql files referenced via include_str!
│   │   └── 0001_initial.sql
│   ├── capabilities/
│   │   └── default.json         # All plugin permissions declared here
│   ├── icons/                   # App icons (placeholder for Phase 1)
│   ├── Cargo.toml
│   └── tauri.conf.json
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### Pattern 1: Tauri 2 App Scaffold

**What:** Create a new Tauri 2 + React + TypeScript + Vite project from scratch.

**Commands:**
```bash
npm create tauri-app@latest bili-mushroom
# When prompted:
#   Frontend language: TypeScript / JavaScript
#   Package manager: npm
#   UI template: React
#   UI flavor: TypeScript
cd bili-mushroom
npm install
```

**Verification:** `npm run tauri dev` — a window titled "Tauri App" should open.

[VERIFIED: v2.tauri.app/start/create-project/]

### Pattern 2: Plugin Registration in lib.rs

**What:** All four plugins must be registered in `src-tauri/src/lib.rs` with migrations added to the SQL builder.

```rust
// Source: v2.tauri.app/plugin/sql/
use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "enable_wal_and_create_schema",
            sql: include_str!("../migrations/0001_initial.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(
            SqlBuilder::default()
                .add_migrations("sqlite:bili-mushroom.db", migrations)
                .build(),
        )
        .setup(|app| {
            // setup hook runs before window is shown
            // good place to check first-run state in Rust if needed
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
```

**Key point:** The `add_migrations` connection string `"sqlite:bili-mushroom.db"` must match exactly the string passed to `Database.load()` in the frontend. This string is RELATIVE to the app data dir — the actual db file lands in `AppData\Roaming\<bundle-id>\bili-mushroom.db` unless you use an absolute path.

**IMPORTANT:** For this project, the db lives in the USER-CHOSEN storage folder (D-07), not in app data dir. This means the connection string must be an ABSOLUTE path constructed at runtime. The migration runner `add_migrations` call in lib.rs receives a connection string that can be overridden at runtime via the JS `Database.load(absolutePath)` call — the Rust-side migration list is keyed by the string you pass to `add_migrations`, and `Database.load()` will run those migrations when called with a matching key. Use the absolute path consistently on both sides.

[VERIFIED: v2.tauri.app/plugin/sql/, dezoito.github.io/2025/01/01/]

### Pattern 3: Migration SQL File (WAL mode + initial schema)

**What:** The first migration enables WAL mode and creates the Phase 1 schema (a `preferences` table is useful to keep everything in one place). A PRAGMA in migration SQL is a supported pattern.

`src-tauri/migrations/0001_initial.sql`:
```sql
-- Enable Write-Ahead Logging for better concurrent read performance
PRAGMA journal_mode=WAL;

-- App preferences (fallback storage; primary prefs live in tauri-plugin-store)
CREATE TABLE IF NOT EXISTS app_metadata (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
);
```

**How WAL works here:** `PRAGMA journal_mode=WAL` is executed as a standard SQL statement inside the migration transaction. SQLite processes it and the journal mode persists for the database file going forward. [VERIFIED: community pattern via search — dev.to, dezoito.github.io; ASSUMED for tauri-plugin-sql specifically — verify that PRAGMA inside migration SQL is executed correctly by the plugin's sqlx transaction]

**Warning sign:** If WAL is not taking effect, the pragma may be silently ignored inside a transaction (SQLite does allow PRAGMA journal_mode outside transactions only in some configurations). Fallback: run the PRAGMA via a separate `db.execute("PRAGMA journal_mode=WAL", [])` call from the frontend immediately after `Database.load()`.

### Pattern 4: Dynamic DB Path (User-Chosen Storage Folder)

**What:** The database does NOT live in app data dir — it lives in the user-chosen folder (D-07). The connection string must be an absolute path.

**Frontend pattern:**
```typescript
// Source: ASSUMED (standard Tauri IPC pattern, no official example for dynamic db path)
import Database from '@tauri-apps/plugin-sql';
import { useAppStore } from '../stores/appStore';

export async function openDatabase(storageFolderPath: string): Promise<Database> {
  // Construct absolute path: <storageFolderPath>/bili-mushroom.db
  const dbPath = `${storageFolderPath}/bili-mushroom.db`;
  // "sqlite:" prefix + absolute path
  const db = await Database.load(`sqlite:${dbPath}`);
  return db;
}
```

**IMPORTANT:** The Rust-side `add_migrations("sqlite:bili-mushroom.db", migrations)` key will NOT match `sqlite:/absolute/path/to/bili-mushroom.db`. Two solutions:
1. Register migrations with the absolute path at startup (requires knowing the path before Rust setup runs — possible via tauri-plugin-store in the setup hook).
2. Use the `preload` approach in tauri.conf.json as a fallback marker, and call `Database.load(absolutePath)` from JS which re-runs migrations if schema is behind.

**Recommended approach:** Use a Tauri command (Rust function) to initialize the database, passing the user-chosen path from the frontend after it's read from the store. The Rust command uses `SqliteConnectOptions` with WAL mode directly, bypassing the JS plugin migration runner for first-time setup:

```rust
// A custom Tauri command for database initialization
// This runs AFTER the frontend reads the stored path
#[tauri::command]
async fn init_database(path: String) -> Result<(), String> {
    use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode};
    use sqlx::SqlitePool;
    let opts = SqliteConnectOptions::new()
        .filename(&path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal);
    let pool = SqlitePool::connect_with(opts).await.map_err(|e| e.to_string())?;
    sqlx::migrate!("./migrations").run(&pool).await.map_err(|e| e.to_string())?;
    Ok(())
}
```

This approach requires adding `sqlx` directly to Cargo.toml with the `migrate` feature, but gives precise WAL control and absolute path support.

[ASSUMED: architecture recommendation based on researched patterns — verify during implementation]

### Pattern 5: Storage Folder Selection + Persistence

**What:** On first run (no stored path), show blocking dialog. User picks folder via native OS dialog. Path persisted to tauri-plugin-store.

```typescript
// Source: v2.tauri.app/plugin/dialog/, v2.tauri.app/plugin/store/
import { open } from '@tauri-apps/plugin-dialog';
import { load } from '@tauri-apps/plugin-store';

const STORE_FILE = 'preferences.json';
const STORAGE_PATH_KEY = 'storageFolderPath';

export async function loadStoragePath(): Promise<string | null> {
  const store = await load(STORE_FILE, { autoSave: false });
  return await store.get<string>(STORAGE_PATH_KEY) ?? null;
}

export async function pickAndSaveStoragePath(): Promise<string | null> {
  const folder = await open({ multiple: false, directory: true });
  if (!folder) return null; // user cancelled
  const store = await load(STORE_FILE, { autoSave: false });
  await store.set(STORAGE_PATH_KEY, folder);
  await store.save();
  return folder;
}
```

**Store file location on Windows:** `AppData\Roaming\<bundle-identifier>\preferences.json`
[VERIFIED: tauri-plugin-store stores in app data dir; Windows path confirmed via path.appDataDir() = `{FOLDERID_RoamingAppData}\<bundleId>` — v2.tauri.app/reference/javascript/api/namespacepath/]

### Pattern 6: First-Run Gate in App.tsx

**What:** React-side logic to enforce D-01/D-03 — blocking dialog until storage path is set.

```typescript
// Source: ASSUMED (standard React pattern + Tauri store integration)
import { useEffect } from 'react';
import { useAppStore } from './stores/appStore';
import { loadStoragePath } from './lib/storage';
import { FirstRunDialog } from './components/dialogs/FirstRunDialog';

export function App() {
  const { storagePath, setStoragePath, dbReady } = useAppStore();

  useEffect(() => {
    loadStoragePath().then((path) => {
      if (path) setStoragePath(path);
    });
  }, []);

  // Block rendering until storage path is chosen
  if (!storagePath) {
    return <FirstRunDialog onFolderSelected={setStoragePath} />;
  }

  // Block rendering until DB is ready
  if (!dbReady) {
    return null; // or a minimal splash — Phase 1 loads fast enough to skip spinner
  }

  return <AppShell />;
}
```

**D-03 enforcement:** `FirstRunDialog` must not render a close button and must not be dismissable via Escape. Radix `<Dialog>` by default closes on Escape — set `onEscapeKeyDown={(e) => e.preventDefault()}` and `onInteractOutside={(e) => e.preventDefault()}`. [VERIFIED: Radix Dialog API — ui.shadcn.com]

### Pattern 7: Zustand Store Shape

```typescript
// Source: ASSUMED (Zustand v5 standard pattern)
import { create } from 'zustand';

type Tab = 'collection' | 'map' | 'species' | 'browse' | 'stats';

interface AppState {
  activeTab: Tab;
  storagePath: string | null;
  dbReady: boolean;
  dbError: string | null;
  setActiveTab: (tab: Tab) => void;
  setStoragePath: (path: string) => void;
  setDbReady: (ready: boolean) => void;
  setDbError: (error: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'collection',
  storagePath: null,
  dbReady: false,
  dbError: null,
  setActiveTab: (tab) => set({ activeTab: tab }),
  setStoragePath: (path) => set({ storagePath: path }),
  setDbReady: (ready) => set({ dbReady: ready }),
  setDbError: (error) => set({ dbError: error }),
}));
```

### Pattern 8: shadcn/ui Init Sequence

**What:** Exact steps to initialize shadcn/ui with Tailwind v4 in the scaffolded project.

```bash
# 1. Install Tailwind v4 + Vite plugin
npm install tailwindcss @tailwindcss/vite

# 2. Replace src/index.css content with:
# @import "tailwindcss";

# 3. Update vite.config.ts to add Tailwind plugin:
# import tailwindcss from '@tailwindcss/vite'
# export default defineConfig({ plugins: [react(), tailwindcss()] })

# 4. Add TypeScript path aliases in tsconfig.json:
# "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["./src/*"] } }
# Same in tsconfig.app.json

# 5. Install @types/node for Vite alias resolution:
npm install -D @types/node

# 6. Update vite.config.ts resolve alias:
# resolve: { alias: { "@": path.resolve(__dirname, "./src") } }

# 7. Initialize shadcn/ui:
npx shadcn@latest init
# When prompted:
#   Style: New York
#   Base color: Neutral
#   CSS variables: Yes

# 8. Add Phase 1 components:
npx shadcn@latest add dialog button tabs alert separator
```

**Forest green accent override** — add to `src/index.css` after `@import "tailwindcss";`:
```css
:root {
  --primary: oklch(0.45 0.14 145);
  --primary-foreground: oklch(0.98 0 0);
  --ring: oklch(0.45 0.14 145);
}
```

[VERIFIED: ui.shadcn.com/docs/installation/vite, ui.shadcn.com/docs/tailwind-v4]

### Pattern 9: Capabilities File

**What:** All plugin permissions must be declared in `src-tauri/capabilities/default.json`.

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Main window capabilities",
  "windows": ["main"],
  "permissions": [
    "core:path:default",
    "core:event:default",
    "core:window:default",
    "core:app:default",
    "sql:default",
    "sql:allow-execute",
    "sql:allow-select",
    "dialog:default",
    "dialog:allow-open",
    "store:default",
    "store:allow-get",
    "store:allow-set",
    "store:allow-save",
    "store:allow-load"
  ]
}
```

[VERIFIED: v2.tauri.app/learn/security/using-plugin-permissions/ — format confirmed; exact permission identifiers ASSUMED based on pattern `plugin:permission` — verify against `npm run tauri dev` error output if any permission is rejected]

### Pattern 10: tauri.conf.json (Phase 1 complete)

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Bili Mushroom",
  "version": "0.1.0",
  "identifier": "hr.biligrupa.bilimushroom",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Bili Mushroom",
        "width": 1200,
        "height": 800,
        "minWidth": 900,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "windows": {
      "webviewInstallMode": {
        "type": "downloadBootstrapper"
      },
      "nsis": {
        "installMode": "currentUser"
      }
    }
  }
}
```

**Notes:**
- `identifier` uses reverse-domain format — `hr.biligrupa.bilimushroom` is a reasonable choice for a Croatian app; adjust to match the developer's domain.
- `installMode: "currentUser"` means no admin elevation required for install — correct for a personal forager app.
- `webviewInstallMode: "downloadBootstrapper"` is the Tauri 2 default; it downloads and installs WebView2 silently if not present (Win 10/11 has it preinstalled since 2021, so this almost never triggers).

[VERIFIED: v2.tauri.app/reference/config/, v2.tauri.app/distribute/windows-installer/]

### Anti-Patterns to Avoid

- **Anti-pattern: Storing db file in app data dir.** The db must live in the user-chosen storage folder (D-07) for portability. App data dir only holds the preferences store.
- **Anti-pattern: Using raw Radix Dialog without preventing close.** Default Radix Dialog closes on Escape and outside click. Must override for first-run and migration error dialogs.
- **Anti-pattern: Calling `Database.load()` before storage path is known.** Load the stored path first, then open the database. An empty path causes a cryptic error.
- **Anti-pattern: Adding `tauri-plugin-sql` without `libsqlite3-sys bundled`.** Windows build fails with "sqlite3.lib not found". The bundled feature statically links SQLite into the binary.
- **Anti-pattern: Missing capabilities for a plugin.** The JS call silently fails or throws a permission error. Always add the plugin's permissions to `default.json` immediately after adding the Cargo dependency.
- **Anti-pattern: Dark mode Tailwind classes.** UI-SPEC is light mode only for Phase 1. Do not implement dark mode toggle.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Migration versioning + atomicity | Custom Rust migration state table | tauri-plugin-sql Builder + Migration structs (or sqlx migrate!) | Handles ordering, atomicity, tracking in `_sqlx_migrations` table automatically |
| Native folder picker | Custom HTML file input | tauri-plugin-dialog `open({ directory: true })` | Native OS dialog; file input in WebView cannot browse arbitrary filesystem paths |
| Key-value persistence | Write JSON to disk manually | tauri-plugin-store | Handles file I/O, atomic saves, app data dir placement |
| Accessible modal dialog | `<div role="dialog">` | shadcn/ui `<Dialog>` | Radix UI handles focus trap, ARIA, Escape key, scroll lock |
| Accessible tab navigation | Custom tab component | shadcn/ui `<Tabs>` | Radix handles keyboard arrows, ARIA tablist/tabpanel, roving tabindex |
| App data dir path | Hard-coded Windows path string | `appDataDir()` from `@tauri-apps/api/path` | Handles OS differences; resolves correctly on all platforms |

---

## Common Pitfalls

### Pitfall 1: WAL PRAGMA inside migration transaction

**What goes wrong:** SQLite requires `PRAGMA journal_mode=WAL` to be executed OUTSIDE of a transaction on some versions/configurations. If tauri-plugin-sql's migration runner wraps migrations in a transaction, the PRAGMA may silently not take effect.
**Why it happens:** tauri-plugin-sql docs state "all migrations are executed within a transaction." WAL mode is a per-file setting that cannot be changed while a transaction is open in some SQLite builds.
**How to avoid:** After `Database.load()` returns successfully, immediately run `db.execute("PRAGMA journal_mode=WAL", [])` as a separate call outside the migration context. This guarantees WAL is set regardless of whether the migration PRAGMA worked.
**Warning signs:** Check with `db.select("PRAGMA journal_mode", [])` — should return `"wal"`. If it returns `"delete"`, the PRAGMA is not taking effect.

### Pitfall 2: Connection string mismatch between Rust migrations and JS load

**What goes wrong:** `add_migrations("sqlite:bili-mushroom.db", ...)` in Rust expects migrations keyed to that exact string. If JS calls `Database.load("sqlite:/absolute/path/bili-mushroom.db")`, the plugin won't find matching migrations.
**Why it happens:** The plugin matches by exact string.
**How to avoid:** Use a custom Rust command for database initialization with an absolute path (Pattern 4 above), or consistently use absolute paths on both sides.
**Warning signs:** Database opens but schema is empty; tables don't exist.

### Pitfall 3: Missing `libsqlite3-sys` bundled feature on Windows

**What goes wrong:** `cargo tauri build` on Windows fails: `could not find native static library 'sqlite3'`
**Why it happens:** Windows doesn't ship sqlite3.lib. Without the bundled feature, the build system tries to link against a system SQLite that doesn't exist.
**How to avoid:** Add `libsqlite3-sys = { version = ">=0.17.2", features = ["bundled"] }` to `[dependencies]` in `src-tauri/Cargo.toml`.
**Warning signs:** Build error mentioning `sqlite3.lib` or `native static library 'sqlite3'`.

### Pitfall 4: Radix Dialog dismissable by default

**What goes wrong:** User presses Escape or clicks outside the first-run dialog — it closes, leaving the app without a storage path (violates D-03).
**Why it happens:** Radix `<DialogContent>` handles `onEscapeKeyDown` and `onInteractOutside` with default close behavior.
**How to avoid:** Override both handlers:
```tsx
<DialogContent
  onEscapeKeyDown={(e) => e.preventDefault()}
  onInteractOutside={(e) => e.preventDefault()}
>
```
Also remove the default `<DialogClose>` X button from the content.

### Pitfall 5: tauri-plugin-store file saved before directory exists

**What goes wrong:** First call to `store.save()` fails silently on first run if the app data directory hasn't been created yet.
**Why it happens:** On truly first run, `AppData\Roaming\<bundleId>\` may not exist.
**How to avoid:** Tauri typically creates the app data dir on startup, but verify by calling `appDataDir()` and ensuring the directory exists before saving. tauri-plugin-store's `load()` creates the file if missing — the directory creation is Tauri's responsibility.
**Warning signs:** `store.get(key)` returns null on second launch even after saving.

### Pitfall 6: Tailwind v4 + shadcn/ui: wrong init sequence

**What goes wrong:** shadcn init fails or produces incorrect CSS if Tailwind v4 is not configured with the Vite plugin before running `npx shadcn@latest init`.
**Why it happens:** shadcn v4 components expect `@import "tailwindcss"` at the top of index.css (not the old `@tailwind` directives).
**How to avoid:** Follow Pattern 8 (shadcn init sequence) exactly: install `@tailwindcss/vite`, update index.css, update vite.config.ts, THEN run `npx shadcn@latest init`.
**Warning signs:** Styles not applying; `tailwind.config.js` unexpectedly created (v3 behavior).

### Pitfall 7: Dialog plugin not in capabilities

**What goes wrong:** `open({ directory: true })` throws a runtime permission error, not a compilation error.
**Why it happens:** Tauri 2's ACL system requires explicit opt-in per plugin.
**How to avoid:** Add `"dialog:allow-open"` to `src-tauri/capabilities/default.json` before calling the dialog API.
**Warning signs:** Console error: "plugin dialog not allowed" or similar ACL rejection message.

---

## Code Examples

### Complete Migration 0001 SQL
```sql
-- Source: tauri-plugin-sql community pattern (dev.to/focuscookie, dezoito.github.io/2025)
-- Executed by tauri-plugin-sql MigrationKind::Up at startup

PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS app_metadata (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
);
```

### Database Initialization (Frontend, after path is known)
```typescript
// Source: ASSUMED — standard pattern derived from v2.tauri.app/plugin/sql/
import Database from '@tauri-apps/plugin-sql';

let _db: Database | null = null;

export async function getDatabase(storageFolderPath: string): Promise<Database> {
  if (_db) return _db;
  const absPath = `${storageFolderPath.replace(/\\/g, '/')}/bili-mushroom.db`;
  _db = await Database.load(`sqlite:${absPath}`);
  // Ensure WAL mode is active (safety net in case PRAGMA in migration was skipped in tx)
  await _db.execute("PRAGMA journal_mode=WAL", []);
  return _db;
}
```

### Preventing Dialog Dismiss (First-Run + Migration Error)
```tsx
// Source: ui.shadcn.com — Radix Dialog props
<Dialog open={true}>
  <DialogContent
    onEscapeKeyDown={(e) => e.preventDefault()}
    onInteractOutside={(e) => e.preventDefault()}
    // No DialogClose button rendered inside
  >
    {/* content */}
  </DialogContent>
</Dialog>
```

### Tauri Command for Opening Log File (Migration Error Dialog secondary action)
```typescript
// Source: ASSUMED — standard Tauri shell plugin pattern
import { open as shellOpen } from '@tauri-apps/plugin-shell';

async function openLogFile() {
  const logDir = await appLogDir(); // from @tauri-apps/api/path
  await shellOpen(logDir);
}
```
Note: This requires `tauri-plugin-shell` to be added if the "Open Log File" button is wired up. For Phase 1, this button can be non-functional (disabled or omitted) — the UI-SPEC says it should exist but doesn't require it to be wired.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tauri 1.x WiX installer only | Tauri 2.x: NSIS (.exe) + WiX (.msi) both available | Tauri 2.0 GA (Oct 2024) | NSIS is now default; produces standard Windows installer |
| Tailwind v3 directives (`@tailwind base`) | Tailwind v4 `@import "tailwindcss"` + Vite plugin | Tailwind v4 (Jan 2025) | No `tailwind.config.js` needed; shadcn/ui v4 requires this |
| shadcn/ui init with Tailwind v3 | shadcn/ui with Tailwind v4 (March 2025) | shadcn docs updated March 2025 | Different init steps; CSS variable usage unchanged |
| Tauri 1.x `tauri::api::path::app_data_dir()` | Tauri 2.x: `app.path().app_data_dir()` on Rust side; `appDataDir()` on JS side | Tauri 2.0 | API namespace changed |

**Deprecated/outdated:**
- `tauri::api::path::app_data_dir(&config)` (Tauri v1 pattern) — replaced by `app.path().app_data_dir()` in Tauri 2.
- `@tailwind base/components/utilities` directives — replaced by `@import "tailwindcss"` in v4.

---

## Environment Availability

> This phase requires Rust/Cargo and the Tauri CLI. The developer is building and distributing the app, so these must be available on the development machine.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite, npm, shadcn CLI | Must verify | 20+ recommended | — |
| npm | Package management | Must verify | Any recent | pnpm/yarn also work |
| Rust + Cargo | Tauri backend compilation | Must verify | 1.77.2+ required | — |
| Tauri CLI | `npm run tauri dev/build` | Installed via npm | npm package @tauri-apps/cli | — |
| WebView2 runtime | Tauri window rendering on Windows | Pre-installed Win 10/11 | Any (auto-downloads if missing) | downloadBootstrapper mode |
| Windows SDK | `npm run tauri build` NSIS packaging | Must verify | Any | NSIS downloads separately |

**Missing dependencies with no fallback:**
- Rust 1.77.2+: required for Tauri 2 compilation. Install via https://rustup.rs
- Tauri CLI: `npm install @tauri-apps/cli` as devDependency (handled by `npm create tauri-app`)

**Verification commands** (run in dev shell before starting):
```bash
node --version    # must be >= 18
rustc --version   # must be >= 1.77.2
cargo --version
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (Vite-native, zero config for unit tests) |
| Config file | `vite.config.ts` — add `test: { environment: 'jsdom' }` |
| Quick run command | `npm run test` |
| Full suite command | `npm run test -- --coverage` |

**Note:** Tauri IPC calls cannot be unit-tested without mocking. Phase 1 validation relies on smoke tests (manual) and component tests (mocked IPC). The Tauri integration layer is verified by running `npm run tauri dev` and exercising the UI.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ORG-02 | Storage folder path persists across restarts | Manual smoke | `npm run tauri dev` | ❌ Wave 0 |
| D-01 | First-run dialog blocks UI when no path configured | Component test (mock store returning null) | `npm test -- src/components/dialogs/FirstRunDialog.test.tsx` | ❌ Wave 0 |
| D-03 | Dialog re-shows on cancel/escape | Component test | above | ❌ Wave 0 |
| D-05 | Migrations run silently on startup | Manual smoke | `npm run tauri dev` + check db file created | ❌ Wave 0 |
| D-06 | Migration failure shows error dialog, refuses start | Component test (mock db error state) | `npm test -- src/components/dialogs/MigrationErrorDialog.test.tsx` | ❌ Wave 0 |
| D-08 | SQLite WAL mode active | Manual smoke | SQLite browser: `PRAGMA journal_mode` on db file | ❌ Wave 0 |
| D-04 | All 5 tabs render placeholder states | Component test | `npm test -- src/App.test.tsx` | ❌ Wave 0 |

### Smoke Tests (manual checklist for phase gate)

1. `npm run tauri dev` opens a window titled "Bili Mushroom" — no console errors.
2. On first launch (no preferences.json), the first-run dialog appears and blocks the main UI.
3. Pressing Escape does NOT close the first-run dialog.
4. Clicking outside the dialog does NOT close it.
5. Clicking "Choose Folder" opens the native OS folder picker.
6. After choosing a folder, the dialog closes and the tab shell is visible.
7. All five tabs (Collection, Map, Species, Browse, Stats) are visible and clickable.
8. Each tab shows the correct empty state icon, heading, and body text per UI-SPEC.
9. Settings gear opens the Settings dialog showing the current storage path.
10. Close the app and relaunch — the first-run dialog does NOT appear again.
11. Verify `<storagePath>/bili-mushroom.db` was created.
12. Open db in SQLite browser — check `PRAGMA journal_mode` returns `wal`.
13. `npm run tauri build` completes without error and produces a `.exe` in `target/release/bundle/nsis/`.

### Wave 0 Gaps (test infrastructure to create)

- [ ] `src/test/setup.ts` — Vitest global setup, mock `@tauri-apps/plugin-store`, `@tauri-apps/plugin-dialog`
- [ ] `src/components/dialogs/FirstRunDialog.test.tsx` — covers D-01, D-03
- [ ] `src/components/dialogs/MigrationErrorDialog.test.tsx` — covers D-06
- [ ] `src/App.test.tsx` — covers D-04 (tab shell render)
- [ ] `vitest.config.ts` or `vite.config.ts` test block — configure jsdom environment

**Mocking Tauri IPC in tests:**
```typescript
// src/test/tauri-mocks.ts
vi.mock('@tauri-apps/plugin-store', () => ({
  load: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(null), // simulate first run
    set: vi.fn(),
    save: vi.fn(),
  }),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn().mockResolvedValue('/Users/test/mushrooms'),
}));
```

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `PRAGMA journal_mode=WAL` in migration SQL executes correctly inside tauri-plugin-sql's migration transaction | Pattern 3, Pitfall 1 | WAL mode not enabled; fallback: run PRAGMA separately after `Database.load()` |
| A2 | Dynamic absolute path in `Database.load("sqlite:/abs/path")` triggers the migrations registered with `add_migrations("sqlite:bili-mushroom.db", ...)` | Pattern 4 | Schema not created; need custom Rust command approach |
| A3 | tauri-plugin-store creates the preferences.json file and its parent directory on first `load()` + `save()` | Pattern 5, Pitfall 5 | Preferences not saved; must manually ensure dir exists |
| A4 | Phase 1 component tests can be run with jsdom + mocked Tauri APIs without a real Tauri context | Validation Architecture | Tests can't run in CI without additional setup |
| A5 | Exact capabilities permission identifiers (`sql:allow-select`, `store:allow-load`, etc.) | Pattern 9 | ACL rejections at runtime; verify from Tauri CLI schema output |

---

## Open Questions

1. **WAL mode via migration transaction**
   - What we know: tauri-plugin-sql wraps migrations in transactions; SQLite WAL PRAGMA behavior in transactions varies
   - What's unclear: Does the specific version of SQLite bundled via libsqlite3-sys allow PRAGMA journal_mode=WAL inside a transaction?
   - Recommendation: After `Database.load()`, immediately run `db.execute("PRAGMA journal_mode=WAL", [])` as a belt-and-suspenders measure

2. **Dynamic DB path with tauri-plugin-sql migrations**
   - What we know: add_migrations is keyed by connection string; absolute paths differ from relative
   - What's unclear: Does `Database.load(absolutePath)` trigger migrations registered under a different key?
   - Recommendation: Use the custom Rust command approach (sqlx directly) for db initialization to get full control; use tauri-plugin-sql only for frontend query/execute operations

3. **tauri-plugin-shell for "Open Log File" button**
   - What we know: Migration error dialog (UI-SPEC) requires an "Open Log File" secondary button
   - What's unclear: Is tauri-plugin-shell needed for Phase 1, or can this button be disabled/stubbed?
   - Recommendation: Stub the button as disabled in Phase 1 with a `// TODO Phase 1: wire log file` comment; avoid adding another plugin dependency

---

## Sources

### Primary (HIGH confidence)
- [v2.tauri.app/plugin/sql/](https://v2.tauri.app/plugin/sql/) — Migration API, connection strings, Builder registration
- [v2.tauri.app/plugin/dialog/](https://v2.tauri.app/plugin/dialog/) — Folder picker API, permissions
- [v2.tauri.app/plugin/store/](https://v2.tauri.app/plugin/store/) — Persistence API, Rust + JS usage
- [v2.tauri.app/start/create-project/](https://v2.tauri.app/start/create-project/) — Scaffold commands
- [v2.tauri.app/start/project-structure/](https://v2.tauri.app/start/project-structure/) — File layout
- [v2.tauri.app/reference/config/](https://v2.tauri.app/reference/config/) — tauri.conf.json schema
- [v2.tauri.app/distribute/windows-installer/](https://v2.tauri.app/distribute/windows-installer/) — Windows NSIS config
- [v2.tauri.app/reference/javascript/api/namespacepath/](https://v2.tauri.app/reference/javascript/api/namespacepath/) — appDataDir() API
- [v2.tauri.app/learn/security/using-plugin-permissions/](https://v2.tauri.app/learn/security/using-plugin-permissions/) — Capabilities format
- [ui.shadcn.com/docs/installation/vite](https://ui.shadcn.com/docs/installation/vite) — shadcn/ui Vite init
- [ui.shadcn.com/docs/tailwind-v4](https://ui.shadcn.com/docs/tailwind-v4) — Tailwind v4 integration

### Secondary (MEDIUM confidence)
- [dezoito.github.io/2025/01/01/embedding-sqlite-in-a-tauri-application.html](https://dezoito.github.io/2025/01/01/embedding-sqlite-in-a-tauri-application.html) — SQLx WAL mode setup pattern (Jan 2025)
- [dev.to/focuscookie — Tauri 2.0 SQLite DB React](https://dev.to/focuscookie/tauri-20-sqlite-db-react-2aem) — Community implementation example
- [github.com/tauri-apps/plugins-workspace/issues/2328](https://github.com/tauri-apps/plugins-workspace/issues/2328) — WAL mode issue status (closed not-planned)

### Tertiary (LOW confidence — flag for validation)
- WAL PRAGMA inside migration transaction behavior: inferred from SQLite docs + community patterns; not confirmed with tauri-plugin-sql specifically

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against official Tauri 2 docs
- Architecture: HIGH — patterns derived from official docs; dynamic db path is MEDIUM (open question)
- WAL mode: MEDIUM — workaround established but specific behavior with tauri-plugin-sql transaction is ASSUMED
- Pitfalls: HIGH — based on verified documentation behaviors

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (Tauri 2.x moves quickly; check plugin versions before executing)
