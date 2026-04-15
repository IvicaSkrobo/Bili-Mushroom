---
phase: 4
slug: stats-export
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-15
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vite.config.ts` (vitest inline config) |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test -- --run --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 0 | STA-01 | — | N/A | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | STA-01 | — | N/A | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | STA-02 | — | N/A | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 1 | STA-03 | — | N/A | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 04-01-05 | 01 | 1 | STA-04 | — | N/A | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | EXP-01 | — | Path traversal not possible (native save dialog forces user-chosen path) | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | EXP-02 | — | CSV output sanitized (no formula injection) | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test/stats.test.ts` — stubs for STA-01 through STA-04 stat aggregation commands
- [ ] `src/test/export.test.ts` — stubs for EXP-01 (PDF) and EXP-02 (CSV) export flows
- [ ] `src/test/setup.ts` — shared test fixtures (mock Tauri invoke, mock DB data)

*Existing vitest infrastructure from Phase 1 covers test runner; new stub files needed for Phase 4 commands.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PDF report renders photos correctly | EXP-01 | Photo rendering in react-pdf requires visual inspection | Generate PDF with 3+ finds with photos; open file; verify images appear |
| Native save dialog appears on export | EXP-01, EXP-02 | Tauri dialog plugin requires real WebView2 runtime | Click export button; confirm OS save dialog opens at expected location |
| CSV opens correctly in Excel | EXP-02 | Excel compatibility requires manual verification | Open exported CSV in Excel/LibreOffice; verify columns, encoding, no garbled characters |
| Seasonal calendar month accuracy | STA-02 | Visual calendar layout requires human review | Navigate to Stats tab; verify months show correct species for test data |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
