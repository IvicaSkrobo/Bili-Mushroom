---
quick_id: 260820-tca
description: Add manual weather (vremenski uvjeti) field to finds
date: 2026-08-20
mode: quick
---

# Quick Task 260820-tca: Manual weather field on finds

## Goal

Every place a find is entered gets an optional, hand-typed **Vrijeme** field, and the
value is visible when you open that individual find. Free text only — no weather API,
no auto-fill.

## Tasks

### Task 1 — Persistence (Rust + SQLite)

**Files:** `src-tauri/migrations/0024_find_weather.sql` (new), `import.rs`, `finds.rs`

- Migration adds `weather TEXT` to `finds`; `version < 24` guard + `PRAGMA user_version = 24`,
  plus an idempotent repair block (same shape as 0023/habitat).
- `FindRecord.weather`, `find_record_from_row` reads index 16.
- Append `, weather` to every `SELECT ... FROM finds` that feeds `find_record_from_row`
  (11 single-line sites + 2 multi-line list queries).
- `insert_find_row` INSERT gains the column; `CreateFindPayload`, `ImportPayload`, and
  `UpdateFindPayload` (`update_find` UPDATE) all carry `weather`.
- Test fixtures constructing `FindRecord` gain `weather: None`.

**Verify:** `cargo check`.

### Task 2 — Frontend types + entry points

**Files:** `src/lib/finds.ts`, `CreateFindDialog.tsx`, `EditFindDialog.tsx`,
`ImportDialog.tsx`, `PhotoLightbox.tsx`

- `Find`, `ImportPayload`, `UpdateFindPayload` gain `weather`.
- **CreateFindDialog** — `weather` in `FormState`/`BLANK_FORM` (so it persists in the
  draft), input under Notes, sent in the create payload.
- **EditFindDialog** — form field seeded from `find.weather`, sent on save.
- **ImportDialog** — `sharedWeather` in the shared header + its draft persistence,
  written to every imported find's payload.
- **PhotoLightbox** — the two existing `updateFind.mutate` calls must pass
  `weather: find.weather ?? null` or the field would be wiped on note/location edits.

**Verify:** `npx tsc --noEmit`.

### Task 3 — Display + i18n

**Files:** `PhotoLightbox.tsx`, `FindCard.tsx`, `exportCsv.ts`, `src/i18n/index.ts`

- **PhotoLightbox** — weather block in the metadata panel with the same inline
  edit/add affordance as Notes (this is the "open the find and see it" surface).
- **FindCard** — compact line with a cloud icon, rendered only when weather is set.
- **exportCsv** — new `weather` column so exports don't silently drop it.
- i18n: `edit.weather`, `edit.weatherPlaceholder`, `lightbox.weather`,
  `lightbox.noWeather`, `lightbox.addWeather`, `lightbox.editWeather` (hr + en).

**Verify:** `npx tsc --noEmit`, `npx vitest run`, app launches and the field
round-trips (type → reopen → still there).

## Out of scope

- Weather correlation in Stats ("najčešće nalaziš po kišnom vremenu"). Free text can't
  be aggregated reliably without a controlled vocabulary; revisit if the user wants it.
- PDF export.
- Any automatic weather lookup.
