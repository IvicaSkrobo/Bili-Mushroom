# PLAN — 260416-gsd-priority-sync

Date: 2026-04-16
Mode: /gsd-quick (planning sync)

## User-confirmed priorities

1. Keep recommendation **C** and likely **B** from prior upgrade discussion.
2. Reject strict duplicate rule based on timestamp+location because burst photos can share both.
3. Add **seasonality insights** in Stats.
4. Add a small reminder/hint to visit a likely place for a species.
5. Execute recommendation set **5A + 5B + 5C**:
   - 5A: UI governance / design system consistency
   - 5B: performance hardening (bundle + lazy loading)
   - 5C: E2E critical-path testing

## Scope decision

This quick task records planning continuity only (no feature implementation in this task).

## Planning updates applied

- Added Phase **04.1 UX Governance & Performance Hardening** to roadmap.
- Added Phase **04.2 Seasonal Insights & Field Hints** to roadmap.
- Added requirement IDs: UX-01, ENG-01, ENG-02, INS-01, INS-02.
- Updated state/todos with a concrete next-work queue.

## Next execution order

1. 04.1-01 — Write and adopt UI governance spec.
2. 04.1-02 — Implement lazy-loading/chunk budget and re-measure startup.
3. 04.1-03 — Add E2E tests for first-run/import/edit-delete-stats.
4. 04.2-01 — Implement seasonality insights in Stats.
5. 04.2-02 — Implement species spot hint reminders.

## Open question parked

- Duplicate detection should not block same timestamp+location bursts; revisit as opt-in "possible duplicate" suggestion using additional heuristics rather than hard dedupe.
