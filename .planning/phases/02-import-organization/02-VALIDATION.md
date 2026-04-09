---
phase: 2
slug: import-organization
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (frontend) + Rust `cargo test` (backend) |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test -- --run && cargo test --manifest-path src-tauri/Cargo.toml` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run`
- **After every plan wave:** Run full suite (npm + cargo test)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|--------|
| 2-01-01 | 01 | 1 | IMP-03/04 | EXIF GPS/date parsing correct; sign flip for S/W | unit (Rust) | `cargo test exif` | ⬜ pending |
| 2-01-02 | 01 | 1 | ORG-01/03 | Path builder produces correct StorageRoot/Country/Region/YYYY-MM-DD/species_date_seq.ext | unit (Rust) | `cargo test path_builder` | ⬜ pending |
| 2-01-03 | 01 | 1 | IMP-01/02 | DB migration 0002 creates finds table; duplicate detection skips re-import | unit (Rust) | `cargo test import` | ⬜ pending |
| 2-02-01 | 02 | 2 | IMP-05 | Preview list renders per-card with editable fields | unit (Vitest) | `npm test -- --run` | ⬜ pending |
| 2-02-02 | 02 | 2 | IMP-01/02 | ImportDialog opens file/folder picker, emits progress events | unit (Vitest) | `npm test -- --run` | ⬜ pending |
| 2-03-01 | 03 | 3 | IMP-01-05, ORG-01/03/04 | CollectionTab shows find cards after import; edit dialog works | unit (Vitest) | `npm test -- --run` | ⬜ pending |
| 2-03-02 | 03 | 3 | ORG-04 | FindCard edit updates DB and refreshes list | unit (Vitest) | `npm test -- --run` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src-tauri/src/commands/import.rs` — Rust unit test stubs for EXIF parsing, path building, duplicate detection
- [ ] `src/components/import/ImportDialog.test.tsx` — Vitest stubs for import flow
- [ ] `src/tabs/CollectionTab.test.tsx` — Vitest stubs for find list and edit

*Existing infrastructure covers framework setup — no new installs needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| EXIF GPS auto-populates from real iPhone JPEG | IMP-04 | Requires real photo with GPS EXIF | Import a real smartphone photo; verify lat/lng fields pre-filled |
| EXIF date auto-populates from real photo | IMP-03 | Requires real EXIF DateTimeOriginal | Import real photo; verify date field shows correct date |
| File copy lands in correct path on disk | ORG-01/03 | Requires real file system | After import, inspect StorageRoot folder structure |
| HEIC photo shows placeholder (not broken img) | IMP-02 | Requires HEIC file + WebView2 | Import .heic file on Windows; confirm placeholder icon shown |
| Re-import same photo shows "1 skipped" toast | IMP-05 (ORG-04 duplicate) | Requires real file import cycle | Import folder twice; confirm count matches |
| Migration key match — finds table exists after launch | A5 (arch risk) | Tauri migration key vs absolute path | Open DB with SQLite browser after first launch; check finds table |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
