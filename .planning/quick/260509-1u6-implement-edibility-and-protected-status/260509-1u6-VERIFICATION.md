---
phase: quick-260509-1u6
verified: 2026-05-09T07:30:00Z
status: human_needed
score: 7/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open a collection folder, click edit, change edibility and protected status, save — reopen and confirm values persisted"
    expected: "Selects show the previously saved values on reopen"
    why_human: "Requires running app + DB round-trip; cannot verify SQLite persistence programmatically without running the Tauri backend"
  - test: "Start an import with a species name that already has edibility set — confirm import form pre-fills that value"
    expected: "Edibility and Protected Status selects in ImportDialog show the existing profile values"
    why_human: "Requires running app + live data in DB; the prefill path is wired in code but runtime behavior needs human confirmation"
  - test: "Old finds (rows with NULL edibility/protected_status) render without crash — no badge shown on hideUnknown=true surfaces"
    expected: "FindCard, CollectionPopup, PhotoLightbox show no badges for old finds; folder header shows Unknown/Unknown"
    why_human: "Null-safety paths are verified in code (normalizeEdibility/normalizeProtectedStatus return 'unknown'; hideUnknown suppresses 'unknown' badges) but runtime behavior with real NULL DB data needs human confirmation"
---

# Phase quick-260509-1u6: Edibility and Protected Status Verification Report

**Phase Goal:** Implement edibility and protected-status metadata for mushroom species, including support in import and edit flows
**Verified:** 2026-05-09T07:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | FolderEditDialog shows edibility and protected_status selects; saving persists values via upsert_species_profile | VERIFIED | `FolderEditDialog.tsx` lines 288–313: two `<select>` controls for edibility/protected_status; `handleSave` at line 116 calls `onSave?.(newName, edibility, protectedStatus)`; `CollectionTab.tsx` `handleFolderSave` at line 228 merges both into `upsertSpeciesProfile.mutate()` |
| 2 | ImportDialog pre-fills edibility and protected_status from existing species profile when species name matches | VERIFIED | `ImportDialog.tsx` line 115: `useSpeciesProfiles` called; lines 174–179: `existingProfile` found from `speciesProfilesData` and fed into `setSharedEdibility`/`setSharedProtectedStatus`; dependency array includes `speciesProfilesData` |
| 3 | Collection folder header shows edibility and protected_status badges when values are set | VERIFIED | `CollectionTab.tsx` lines 534–537: `<SpeciesMetadataBadges speciesProfile={speciesProfilesByName.get(speciesName)} size="md" hideUnknown={false} />` inside the folder header expansion |
| 4 | FindCard shows compact edibility and protected_status badges inline with metadata | VERIFIED | `FindCard.tsx` line 130: `<SpeciesMetadataBadges speciesProfile={speciesProfile} size="sm" hideUnknown={true} />`; `speciesProfile` prop added to `FindCardProps` |
| 5 | CollectionPopup (map) shows species profile badges | VERIFIED | `CollectionPins.tsx`: `CollectionPopup` receives `speciesProfile?: SpeciesProfile`; line 109: `<SpeciesMetadataBadges speciesProfile={speciesProfile} size="md" hideUnknown={true} />`; `CollectionPinsInner` builds `speciesProfilesByName` Map and passes `speciesProfilesByName.get(c.name)` |
| 6 | PhotoLightbox sidebar shows edibility and protected_status badges | VERIFIED | `PhotoLightbox.tsx` line 35: `speciesProfile?: SpeciesProfile` prop; line 182: `<SpeciesMetadataBadges speciesProfile={speciesProfile} size="md" hideUnknown={true} />`; `CollectionTab.tsx` lines 758–764: passes `speciesProfilesByName.get(...)` derived from `lightboxSpeciesName` or current photo's `species_name` |
| 7 | NULL in DB renders as unknown in all display surfaces — no runtime crash on old rows | VERIFIED (code path) | `speciesMetadata.ts` lines 34–42: `normalizeEdibility` and `normalizeProtectedStatus` handle `null`/`undefined`/unrecognized strings by returning `'unknown'`; `SpeciesMetadataBadges` returns `null` when both are unknown and `hideUnknown=true` — no render crash path. Runtime confirmation needs human testing. |

**Score:** 7/7 truths verified (code-level); 3 items need runtime human confirmation

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/migrations/0013_species_profile_edibility.sql` | ALTER TABLE adds edibility + protected_status as nullable TEXT | VERIFIED | File exists; 2 ALTER TABLE statements, no DEFAULT clause (NULL for existing rows) |
| `src/lib/speciesMetadata.ts` | Enum literals, label maps, badge config for edibility + protected_status | VERIFIED | Exports EDIBILITY_VALUES, PROTECTED_STATUS_VALUES, label maps, hex badge styles, normalizer functions |
| `src/components/species/SpeciesMetadataBadges.tsx` | Badge pair component rendering from SpeciesProfile | VERIFIED | Substantive component; size + hideUnknown props; renders styled span pairs using Forest Codex hex colors |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `FolderEditDialog.tsx` | `upsert_species_profile` Tauri command | `onSave` callback → `CollectionTab.handleFolderSave` → `upsertSpeciesProfile.mutate()` | WIRED | `handleFolderSave` at CollectionTab:228 calls `upsertSpeciesProfile.mutate({ edibility, protectedStatus })`; no double upsert inside FolderEditDialog |
| `ImportDialog.tsx` | `speciesProfilesData` lookup | `useSpeciesProfiles` + prefill `useEffect` | WIRED | `speciesProfilesData` from `useSpeciesProfiles()` at line 115; `useEffect` at line 168 seeds `sharedEdibility`/`sharedProtectedStatus`; `speciesProfilesData` in dep array |
| `CollectionTab.tsx` | Inline find header row / PhotoLightbox / FolderEditDialog | `speciesProfilesByName` Map prop drill | WIRED | `speciesProfilesByName` useMemo Map built at CollectionTab:222; passed as `speciesProfile` to `<FolderEditDialog>`, inline find rows (line 632), folder header (line 535), `<PhotoLightbox>` (line 758) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `SpeciesMetadataBadges.tsx` | `speciesProfile.edibility` / `speciesProfile.protected_status` | `get_species_profiles` Rust command → `useSpeciesProfiles` hook → `speciesProfilesByName` Map | Yes — Rust SELECT at finds.rs:120 fetches `edibility, protected_status` columns at indices 3,4 and maps them to the struct | FLOWING |
| `FolderEditDialog.tsx` | `edibility`, `protectedStatus` state | Seeded from `speciesProfile` prop in `useEffect` at line 65 | Yes — sourced from `speciesProfilesByName.get(folderEditing)` passed from CollectionTab | FLOWING |
| `ImportDialog.tsx` | `sharedEdibility`, `sharedProtectedStatus` state | `speciesProfilesData` lookup in `useEffect` at line 174 | Yes — from live `useSpeciesProfiles()` data | FLOWING |

### Behavioral Spot-Checks

Skipped — core functionality requires running the Tauri desktop app with an SQLite DB. No standalone runnable entry points for this feature.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| EDIBILITY-01 | 260509-1u6-PLAN.md | Edibility metadata on species profile | SATISFIED | Migration, Rust struct, TS type, badge component, FolderEditDialog selects, ImportDialog prefill — all implemented |
| PROTECTED-01 | 260509-1u6-PLAN.md | Protected status metadata on species profile | SATISFIED | Same implementation path as EDIBILITY-01; both fields treated symmetrically throughout |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

Scan confirmed: no TODO/FIXME/placeholder comments in modified files, no empty return stubs, no hardcoded empty arrays passed to badge render, normalizer functions properly guard against null/undefined inputs.

### Human Verification Required

#### 1. Edit flow round-trip

**Test:** Open the app. Navigate to Collection tab. Open a species folder that has finds. Click the edit (pencil) button to open FolderEditDialog. Change Edibility to "Edible" and Protected Status to "Protected". Click Save. Reopen the same folder's edit dialog.
**Expected:** Edibility select shows "Edible", Protected Status select shows "Protected". Folder header badges update to show the set values.
**Why human:** SQLite persistence via Tauri IPC cannot be verified without running the backend.

#### 2. ImportDialog pre-fill from existing profile

**Test:** Ensure at least one species folder has edibility set (via step 1 above). Open the Import dialog. Type the same species name in the species name field.
**Expected:** Edibility and Protected Status selects auto-fill to the previously saved values from the existing profile.
**Why human:** Requires live DB data and running app to verify the prefill useEffect fires correctly.

#### 3. NULL safety on old data

**Test:** Find a find that was created before this task (no edibility/protected_status in DB — NULL rows). Open its PhotoLightbox. Check CollectionPopup for the same species. Check the collection folder header for that species.
**Expected:** PhotoLightbox and CollectionPopup show no badges (hideUnknown=true). Folder header shows "Unknown / Unknown" badges (hideUnknown=false). No crashes.
**Why human:** Runtime NULL handling from real SQLite rows needs visual confirmation despite normalizer functions being verified in code.

### Gaps Summary

No gaps. All 7 observable truths are verified at the code level. The 3 human verification items are runtime confirmation of wired, substantive code paths — not missing implementations.

---

_Verified: 2026-05-09T07:30:00Z_
_Verifier: Claude (gsd-verifier)_
