# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 01-foundation
**Areas discussed:** Storage Folder UX, App Shell / Nav Skeleton, Migration Runner, SQLite File Location

---

## Storage Folder UX

| Option | Description | Selected |
|--------|-------------|----------|
| First-run modal (blocks UI) | Dialog that must be completed before accessing the app | ✓ |
| Settings page | Folder selection only accessible from settings | |
| Inline on first launch | Embedded in main view as a prompt | |

**User's choice:** Deferred to Claude (auto-selected recommended)
**Notes:** App cannot function without a storage folder — hard gate is the correct approach. Change option lives in Settings.

---

## App Shell / Nav Skeleton

| Option | Description | Selected |
|--------|-------------|----------|
| Full nav skeleton | Establish all tabs (Collection, Map, Species, Browse, Stats) with empty states | ✓ |
| Minimal shell | Just a window that runs — no nav structure | |
| Single landing screen | One screen until Phase 2 adds nav | |

**User's choice:** Deferred to Claude (auto-selected recommended)
**Notes:** Establishing the full skeleton in Phase 1 prevents structural refactors in later phases.

---

## Migration Runner

| Option | Description | Selected |
|--------|-------------|----------|
| Silent auto-apply, error dialog on failure | Migrations run automatically; failure shows dialog and blocks start | ✓ |
| Show changelog to user | Notify user of schema changes | |
| Prompt on failure | Ask user what to do when migration fails | |

**User's choice:** Deferred to Claude (auto-selected recommended)
**Notes:** Silent apply is standard for desktop apps. Safe fail on error is non-negotiable.

---

## SQLite File Location

| Option | Description | Selected |
|--------|-------------|----------|
| In storage folder (portable) | .db lives with user's data — fully portable library | ✓ |
| Tauri app data dir | Standard OS location (AppData\Roaming) — separate from photos | |

**User's choice:** Deferred to Claude (auto-selected recommended)
**Notes:** Portability aligns with the "forager's personal library" ethos. Folder preference stored in app data dir.

---

## Claude's Discretion

- Tab style (top vs. sidebar)
- Visual design of first-run dialog
- Migration file format
- App icon and window title

## Deferred Ideas

None.
