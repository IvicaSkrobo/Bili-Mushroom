---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (Vite-native, zero config for unit tests) |
| **Config file** | `vite.config.ts` — add `test: { environment: 'jsdom' }` |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test -- --coverage` |
| **Estimated runtime** | ~10 seconds |

> **Note:** Tauri IPC calls cannot be unit-tested without mocking. Phase 1 validation relies on smoke tests (manual) and component tests (mocked IPC). The Tauri integration layer is verified by running `npm run tauri dev` and exercising the UI.

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test -- --coverage`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | ORG-02 | — | N/A | setup | create test infra | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | D-01, D-03 | — | Dialog non-dismissable | component | `npm test -- src/components/dialogs/FirstRunDialog.test.tsx` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | D-06 | — | Error dialog on migration fail | component | `npm test -- src/components/dialogs/MigrationErrorDialog.test.tsx` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | D-04 | — | 5 tabs render | component | `npm test -- src/App.test.tsx` | ❌ W0 | ⬜ pending |
| 1-01-05 | 01 | 2 | ORG-02, D-07, D-08 | — | N/A | manual smoke | `npm run tauri dev` | ❌ manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test/setup.ts` — Vitest global setup, mock `@tauri-apps/plugin-store`, `@tauri-apps/plugin-dialog`
- [ ] `src/components/dialogs/FirstRunDialog.test.tsx` — covers D-01, D-03
- [ ] `src/components/dialogs/MigrationErrorDialog.test.tsx` — covers D-06
- [ ] `src/App.test.tsx` — covers D-04 (tab shell render)
- [ ] `vite.config.ts` test block — configure jsdom environment

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Storage folder path persists across restarts | ORG-02 | Requires actual Tauri runtime + file system | Close and relaunch app; verify first-run dialog does NOT appear |
| SQLite WAL mode active | D-08 | Requires SQLite browser inspection | Open `<storagePath>/bili-mushroom.db` in DB browser; run `PRAGMA journal_mode` — expect `wal` |
| Migrations run silently on startup | D-05 | Requires Tauri runtime | Launch app; verify `bili-mushroom.db` created with no user prompt |
| Build produces Windows installer | — | Requires full `tauri build` | `npm run tauri build` — check `.exe` in `target/release/bundle/nsis/` |

### Smoke Test Checklist (phase gate)

1. `npm run tauri dev` opens window titled "Bili Mushroom" — no console errors
2. On first launch, first-run dialog appears and blocks main UI
3. Escape does NOT close the dialog
4. Click outside does NOT close the dialog
5. "Choose Folder" opens native OS folder picker
6. After choosing folder, dialog closes and tab shell is visible
7. All five tabs (Collection, Map, Species, Browse, Stats) visible and clickable
8. Each tab shows correct empty state per UI-SPEC
9. Settings gear opens Settings dialog showing current storage path
10. Relaunch — first-run dialog does NOT appear again
11. `<storagePath>/bili-mushroom.db` file exists
12. SQLite PRAGMA check: `journal_mode = wal`
13. `npm run tauri build` completes — `.exe` produced

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
