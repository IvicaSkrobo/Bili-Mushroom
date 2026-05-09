# Quick Task 260509-1u6: Implement Edibility and Protected-Status — Research

**Researched:** 2026-05-09
**Domain:** Species profile extension — DB schema, Rust model, TypeScript model, UI integration points
**Confidence:** HIGH (all findings verified directly from codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Badge placement: collection folder header, FindCard, CollectionPopup, PhotoLightbox sidebar
- Edit entry point: FolderEditDialog only (not EditFindDialog)
- Inline quick-edit in folder header: acceptable but secondary
- Import prefill: pre-fill edibility/protected from existing profile when species name matches
- Enum values locked:
  - `edibility: 'unknown' | 'edible' | 'inedible' | 'poisonous'`
  - `protected_status: 'unknown' | 'not_protected' | 'protected'`
- Extend existing `species_profiles` table — no parallel table
- Migration: two new columns with DEFAULT NULL
- NULL in DB = `unknown` in UI

### Claude's Discretion
- Icon/badge visual design (Forest Codex style)
- Whether to extend `useUpsertSpeciesProfile` or create a new hook
- Migration number (must be next after 0012)

### Deferred Ideas (OUT OF SCOPE)
- None stated
</user_constraints>

---

## Q1: Schema — `species_profiles` table today + next migration number

**Current columns** (verified from migrations 0009 + 0010):
```sql
species_name    TEXT PRIMARY KEY
cover_photo_id  INTEGER              -- nullable
updated_at      TEXT NOT NULL
tags_json       TEXT NOT NULL DEFAULT '[]'  -- added migration 0010
```

Index: `idx_species_profiles_cover_photo_id` on `cover_photo_id`.

**Last migration:** `0012_observed_count_range.sql`
**Next migration number:** `0013`

New migration to add:
```sql
-- 0013_species_profile_edibility.sql
ALTER TABLE species_profiles ADD COLUMN edibility TEXT;
ALTER TABLE species_profiles ADD COLUMN protected_status TEXT;
```
Both NULL by default (no DEFAULT clause needed — ALTER TABLE adds NULL for existing rows automatically in SQLite). NULL = `unknown` in UI per spec.

[VERIFIED: codebase migrations directory + migration files]

---

## Q2: Rust model — `SpeciesProfile` struct + `upsert_species_profile` location

**File:** `src-tauri/src/commands/finds.rs` (lines 93–98, 136–153)

```rust
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct SpeciesProfile {
    pub species_name: String,
    pub cover_photo_id: Option<i64>,
    pub tags: Vec<String>,
}
```

`upsert_species_profile` command signature:
```rust
pub async fn upsert_species_profile(
    storage_path: String,
    species_name: String,
    cover_photo_id: Option<i64>,
    tags: Vec<String>,
) -> Result<(), String>
```

The SQL inside uses an INSERT … ON CONFLICT … DO UPDATE pattern. Both the struct and the upsert command must be extended with `edibility: Option<String>` and `protected_status: Option<String>`.

The `get_species_profiles` SELECT query at line 118 reads only `species_name, cover_photo_id, tags_json` — it must be updated to also SELECT the two new columns.

[VERIFIED: src-tauri/src/commands/finds.rs]

---

## Q3: TS model — `SpeciesProfile` + `useUpsertSpeciesProfile`

**File:** `src/lib/finds.ts` (lines 69–73)

```typescript
export interface SpeciesProfile {
  species_name: string;
  cover_photo_id: number | null;
  tags: string[];
}
```

`upsertSpeciesProfile` in `finds.ts` passes positional args to Tauri:
```typescript
invoke('upsert_species_profile', { storagePath, speciesName, coverPhotoId, tags })
```

`useUpsertSpeciesProfile` in `useFinds.ts` (lines 124–141) destructures `{ speciesName, coverPhotoId, tags }`.

Both must be extended with `edibility` and `protectedStatus` (camelCase for Tauri IPC). The hook signature needs two new optional fields; Tauri will receive them as `edibility` and `protected_status` (snake_case) via Tauri's automatic camelCase → snake_case conversion.

[VERIFIED: src/lib/finds.ts, src/hooks/useFinds.ts]

---

## Q4: FolderEditDialog — current fields + upsert call

**File:** `src/components/finds/FolderEditDialog.tsx`

Current editable fields:
- Species name (with bold/italic markup toolbar)
- Country (applied to all finds in folder)
- Region (applied to all finds in folder)
- Lat/lng (via LocationPickerMap)
- Overwrite toggle

**Current upsert behavior:** FolderEditDialog does NOT currently call `upsertSpeciesProfile` at all. It only calls `bulkRenameSpecies` and `updateFind`. The cover photo and tags are set from CollectionTab (not from this dialog). Adding edibility/protected_status here means this dialog must gain a `useUpsertSpeciesProfile` call in `handleSave`.

FolderEditDialog receives no species profile data as a prop — it will need either a prop `speciesProfile: SpeciesProfile | undefined` passed from the parent, or it must call `useSpeciesProfiles()` internally and look up by `speciesName`.

[VERIFIED: src/components/finds/FolderEditDialog.tsx]

---

## Q5: ImportDialog — speciesProfiles access

**File:** `src/components/import/ImportDialog.tsx`

ImportDialog already imports `useSpeciesNotes` and `useFinds` (line 36):
```typescript
import { useFinds, useSpeciesNotes } from '@/hooks/useFinds';
```

It does NOT currently import `useSpeciesProfiles`. The hook is available in `useFinds.ts` — it just needs to be added to the import and called:
```typescript
const { data: speciesProfilesData } = useSpeciesProfiles();
```

The existing `useEffect` at line 158–164 pre-fills notes from `speciesNotesData` when species name changes. The same pattern applies for edibility/protected: watch `sharedName`, look up from `speciesProfilesData`, seed two new state variables (`sharedEdibility`, `sharedProtectedStatus`).

After import, `upsertSpeciesProfile` must be called if the user set non-unknown values (similar to how `upsertSpeciesNote` is called at line 306–309).

[VERIFIED: src/components/import/ImportDialog.tsx lines 36, 107, 158–164, 306–309]

---

## Q6: CollectionPopup — data access for species profile

**File:** `src/components/map/CollectionPins.tsx`

`CollectionPopup` (internal component, lines 52–180) receives:
```typescript
{
  collection: Collection;
  speciesNote: string | undefined;
  storagePath: string;
  onStartLocalPolygonForFind: (find: Find) => void;
  onStartRegionPolygonForFind: (find: Find) => void;
  zones: Zone[];
}
```

Species notes are fetched by `CollectionPinsInner` via `useSpeciesNotes()` (line 219) and passed as `speciesNote` string. The same pattern must be applied for profiles: `CollectionPinsInner` adds `useSpeciesProfiles()`, builds a `Map<string, SpeciesProfile>` alongside `speciesNotesByName`, and passes `speciesProfile={speciesProfilesByName.get(c.name)}` to `CollectionPopup`. CollectionPopup then renders edibility/protected badges from it.

CollectionPopup does not directly call any hooks — it receives all data as props from its parent.

[VERIFIED: src/components/map/CollectionPins.tsx lines 52–66, 219–228]

---

## Q7: FindCard — props + species profile data

**File:** `src/components/finds/FindCard.tsx`

Current props:
```typescript
interface FindCardProps {
  find: Find;
  storagePath: string;
  onEdit: (find: Find) => void;
  onDelete: (find: Find) => void;
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
  onToggleFavorite?: (find: Find) => void;
  onLongPress?: (id: number) => void;
  onPhotoClick?: (findId: number, photoIndex: number) => void;
}
```

FindCard does NOT receive any species profile data. It only receives `find: Find`. To show edibility/protected badges, the caller must pass a new optional prop `speciesProfile?: SpeciesProfile` (or the individual enum values). The caller is CollectionTab (which already has `useSpeciesProfiles()` data).

[VERIFIED: src/components/finds/FindCard.tsx lines 9–20]

---

## Q8: PhotoLightbox — available data in sidebar

**File:** `src/components/finds/PhotoLightbox.tsx`

Current props:
```typescript
interface PhotoLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photos: LightboxPhoto[];     // { photo: FindPhoto; find: Find }[]
  currentIndex: number;
  onIndexChange: (index: number) => void;
  storagePath: string;
  onSetAsSpeciesCover?: (photo: LightboxPhoto) => void;
  isCurrentSpeciesCover?: (photo: LightboxPhoto) => boolean;
  onEditFind?: (find: Find) => void;
  onDeletePhoto?: (photo: LightboxPhoto) => void;
}
```

PhotoLightbox receives `find: Find` (from `current.find`) in the sidebar. It does NOT receive species profile data. The sidebar renders species name, date, country/region, location, notes — a natural place to add edibility/protected badges below the species name.

The caller (CollectionTab or equivalent) must pass a new optional prop `speciesProfile?: SpeciesProfile` and thread it through. Alternatively, PhotoLightbox could accept `speciesProfiles: Map<string, SpeciesProfile>` and self-look-up by `current.find.species_name`.

[VERIFIED: src/components/finds/PhotoLightbox.tsx lines 23–34, 169–224]

---

## Implementation Summary

| Work Item | File(s) | What Changes |
|-----------|---------|--------------|
| DB migration 0013 | `src-tauri/migrations/0013_species_profile_edibility.sql` | ADD COLUMN edibility + protected_status (nullable TEXT) |
| Rust struct + SELECT | `src-tauri/src/commands/finds.rs` | Add 2 fields to `SpeciesProfile`, extend SELECT + upsert params |
| TS type | `src/lib/finds.ts` | Add `edibility?` + `protected_status?` to `SpeciesProfile`, extend `upsertSpeciesProfile` invoke |
| Hook | `src/hooks/useFinds.ts` | Extend `useUpsertSpeciesProfile` mutation payload with 2 new optional fields |
| FolderEditDialog | `src/components/finds/FolderEditDialog.tsx` | Add edibility + protected_status selects; accept `speciesProfile` prop; call upsertSpeciesProfile on save |
| ImportDialog | `src/components/import/ImportDialog.tsx` | Add `useSpeciesProfiles()`, 2 new state vars, prefill useEffect, call upsertSpeciesProfile on import |
| CollectionPinsInner | `src/components/map/CollectionPins.tsx` | Add `useSpeciesProfiles()`, build profiles map, pass profile to CollectionPopup |
| CollectionPopup | `src/components/map/CollectionPins.tsx` | Accept + render edibility/protected badges |
| FindCard | `src/components/finds/FindCard.tsx` | Accept optional `speciesProfile?: SpeciesProfile` prop, render badges |
| PhotoLightbox | `src/components/finds/PhotoLightbox.tsx` | Accept optional `speciesProfile?: SpeciesProfile` prop, render badges in sidebar |
| Caller (CollectionTab) | `src/tabs/CollectionTab.tsx` | Thread speciesProfile into FindCard, PhotoLightbox, FolderEditDialog calls |

## Key Constraint

FolderEditDialog currently has no path to `upsertSpeciesProfile`. The parent (CollectionTab) must pass the current species profile as a prop so FolderEditDialog can seed its select controls and call upsert on save. This is the only non-trivial wiring change — all badge display sites just need the profile passed as a prop.

## Sources

All findings: [VERIFIED: direct codebase reads]
- `src-tauri/migrations/0009_species_profiles.sql`
- `src-tauri/migrations/0010_species_profile_tags.sql`
- `src-tauri/migrations/0012_observed_count_range.sql`
- `src-tauri/src/commands/finds.rs`
- `src/lib/finds.ts`
- `src/hooks/useFinds.ts`
- `src/components/finds/FolderEditDialog.tsx`
- `src/components/import/ImportDialog.tsx`
- `src/components/map/CollectionPins.tsx`
- `src/components/finds/FindCard.tsx`
- `src/components/finds/PhotoLightbox.tsx`
