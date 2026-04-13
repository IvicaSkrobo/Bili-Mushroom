---
phase: 3
slug: map
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vite.config.ts` (test block) |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 0 | MAP-01 | — | N/A | unit | `npm run test -- --run src/components/map/` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 1 | MAP-01 | — | N/A | unit | `npm run test -- --run src/components/map/MapView` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 1 | MAP-02 | — | N/A | unit | `npm run test -- --run src/components/map/MapView` | ❌ W0 | ⬜ pending |
| 3-03-01 | 03 | 1 | MAP-03 | — | N/A | unit | `npm run test -- --run src-tauri/` | ❌ W0 | ⬜ pending |
| 3-04-01 | 04 | 2 | MAP-04 | — | N/A | unit | `npm run test -- --run src/components/map/` | ❌ W0 | ⬜ pending |
| 3-05-01 | 05 | 2 | MAP-05 | — | N/A | unit | `npm run test -- --run src/components/map/` | ❌ W0 | ⬜ pending |
| 3-06-01 | 06 | 2 | MAP-06 | — | N/A | unit | `npm run test -- --run src/components/map/LocationPicker` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/map/__tests__/MapView.test.tsx` — stubs for MAP-01, MAP-02, MAP-04, MAP-05
- [ ] `src/components/map/__tests__/LocationPicker.test.tsx` — stubs for MAP-06
- [ ] `src/test/setup.ts` — add `ResizeObserver` stub (required for react-leaflet to render)
- [ ] Add `npm install leaflet react-leaflet @types/leaflet` to Wave 0 task

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Offline tile caching persists after internet disconnect | MAP-03 | Requires real network toggle and Tauri WebView | 1) Browse map area, 2) Disconnect internet, 3) Reopen app, 4) Verify tiles still display |
| Map auto-zooms to fit all pins outside Croatia | MAP-04 | Requires real DB data with non-Croatia coordinates | Add find with coordinates outside Balkans region, open map, verify autozoom |
| Satellite/OSM layer switch persists pins | MAP-02 | Visual layer verification needs real Tauri WebView | Switch layers, verify pins remain visible on both |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
