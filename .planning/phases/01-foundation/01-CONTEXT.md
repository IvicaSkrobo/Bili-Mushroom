# Phase 1: Foundation - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

The app runs on Windows as a packaged Tauri 2 window, stores data reliably in SQLite (WAL mode), and is structurally ready for feature code. The one user-facing capability delivered in this phase is storage folder selection and persistence (ORG-02). No mushroom data features are built — this phase is the scaffold everything else connects to.

</domain>

<decisions>
## Implementation Decisions

### Storage Folder Selection (ORG-02)
- **D-01:** First-run modal dialog — blocks the main UI until the user has chosen a storage folder. The app cannot function without one, so this is a hard gate.
- **D-02:** "Change folder" option lives in a Settings/Preferences panel (not the main nav). When changed, app offers to move or copy the existing database to the new folder.
- **D-03:** If user dismisses/cancels the first-run dialog without choosing a folder, re-show the prompt. Never leave the app in a state with no storage folder configured.

### App Shell / Navigation Skeleton
- **D-04:** Phase 1 establishes the FULL tab navigation shell that all future phases will populate. Recommended tabs based on the roadmap: Collection, Map, Species, Browse, Stats. Each tab shows an appropriate empty/placeholder state until its phase is implemented. This prevents structural refactors in later phases and makes the app look intentional from day 1.

### Migration Runner
- **D-05:** Migrations auto-apply silently on every startup. No user-visible changelog for migration events.
- **D-06:** On migration failure: show a clear error dialog with the failure details and refuse to start the app. Never partially apply migrations or silently corrupt data. Safe fail > silent corruption.

### SQLite File Location
- **D-07:** The `.db` file lives INSIDE the user-chosen storage folder (e.g., `<StorageRoot>/bili-mushroom.db`). This makes the user's data fully portable — they can move the entire library folder to another drive and just point the app at it. The storage folder path preference itself is stored in Tauri's app data dir (`AppData\Roaming\bili-mushroom\` or equivalent via `tauri::api::path::app_data_dir`).

### Locked Constraints (from project decisions)
- **D-08:** SQLite MUST use WAL mode (`PRAGMA journal_mode=WAL`) — already decided at project level.
- **D-09:** Migration runner MUST be in place before any feature code writes to the DB — Phase 1 delivers this.
- **D-10:** Stack is Tauri 2.x + React 18+ + TypeScript + Rust. No deviations.

### Claude's Discretion
- Exact visual design of the first-run storage selection dialog — functional and clear is sufficient; no specific visual requirements stated.
- Tab navigation style (top tabs vs. sidebar) — choose what fits a Windows desktop app best with shadcn/ui.
- Internal migration file format (`.sql` files vs. embedded Rust strings) — follow sqlx/tauri-plugin-sql conventions.
- App icon and window title — use "Bili Mushroom" as the title; icon can be a placeholder for now.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs exist for Phase 1 — requirements fully captured in decisions above.

### Project-Level Docs
- `.planning/REQUIREMENTS.md` §ORG-02 — Storage folder requirement this phase delivers
- `.planning/PROJECT.md` §Constraints — Platform (Windows primary), distribution (packaged installer), storage (100% local)
- `.planning/PROJECT.md` §Key Decisions — SQLite, Tauri, folder structure decisions

### Technology References (from CLAUDE.md)
- `tauri-plugin-sql` 2.x with `features = ["sqlite"]` — official SQL plugin
- `libsqlite3-sys` with `features = ["bundled"]` — required for Windows build (avoids "sqlite3.lib not found")
- `shadcn/ui` + Tailwind CSS 4.x — UI components
- Zustand 5.x — global UI state (active tab, storage folder path)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — project is a fresh slate. No existing components, hooks, or utilities.

### Established Patterns
- None yet — Phase 1 establishes the patterns all future phases inherit. Choose carefully here.

### Integration Points
- Phase 1's tab shell is the integration point for Phases 2-6. Each phase slots into one or more tabs.
- Phase 1's SQLite + migration setup is the integration point for all data in Phases 2-6.
- Phase 1's storage folder state (Zustand store) is consumed by Phase 2 (file organization) and beyond.

</code_context>

<specifics>
## Specific Ideas

- The first-run dialog should feel like an onboarding step, not an error — guide the user to pick their "Mushroom Library" folder with a friendly explanation of what it's used for.
- The nav skeleton with empty states means even an early beta feels like a complete app — tabs exist, they just aren't populated yet.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-09*
