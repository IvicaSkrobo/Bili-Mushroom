---
phase: quick-260415-syy
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/finds/PhotoLightbox.tsx
  - src/tabs/CollectionTab.tsx
  - src/components/finds/FindCard.tsx
  - src/i18n/index.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "Clicking a photo thumbnail in a collection folder opens an enlarged overlay"
    - "User can navigate prev/next through all photos in that folder"
    - "Find notes, date, and species name display alongside the enlarged photo"
    - "Pressing Esc or clicking the backdrop dismisses the lightbox"
  artifacts:
    - path: "src/components/finds/PhotoLightbox.tsx"
      provides: "Lightbox overlay component with prev/next navigation"
      min_lines: 80
  key_links:
    - from: "src/components/finds/FindCard.tsx"
      to: "CollectionTab lightbox state"
      via: "onPhotoClick callback prop"
    - from: "src/tabs/CollectionTab.tsx"
      to: "src/components/finds/PhotoLightbox.tsx"
      via: "lightbox state (open, photoIndex, flatPhotoList)"
---

<objective>
Add a lightbox-style photo viewer to the Collection tab. When browsing photos within a species folder, clicking any photo thumbnail opens an enlarged overlay showing the photo with prev/next navigation through all photos in that folder, alongside the find's notes and date. Dismissable via Esc or clicking outside.

Purpose: Foragers need to see their photos larger without leaving the collection view — quick visual review of finds within a species group.
Output: PhotoLightbox component + wiring into CollectionTab and FindCard.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@src/tabs/CollectionTab.tsx
@src/components/finds/FindCard.tsx
@src/components/ui/dialog.tsx
@src/lib/finds.ts
@src/i18n/index.ts

<interfaces>
<!-- Key types the executor needs -->

From src/lib/finds.ts:
```typescript
export interface Find {
  id: number;
  original_filename: string;
  species_name: string;
  date_found: string;
  country: string;
  region: string;
  location_note: string;
  lat: number | null;
  lng: number | null;
  notes: string;
  created_at: string;
  photos: FindPhoto[];
}

export interface FindPhoto {
  id: number;
  find_id: number;
  photo_path: string;   // relative to storagePath
  is_primary: boolean;
}

export function isHeic(filename: string): boolean;
```

From src/components/ui/dialog.tsx:
```typescript
export { Dialog, DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogTitle, DialogDescription }
// DialogContent accepts showCloseButton prop, className override
// DialogOverlay: fixed inset-0 z-50 bg-black/50
```

From src/components/finds/FindCard.tsx:
```typescript
interface FindCardProps {
  find: Find;
  storagePath: string;
  onEdit: (find: Find) => void;
  onDelete: (find: Find) => void;
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
  onLongPress?: (id: number) => void;
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create PhotoLightbox component</name>
  <files>src/components/finds/PhotoLightbox.tsx, src/i18n/index.ts</files>
  <action>
Create `src/components/finds/PhotoLightbox.tsx` — a modal overlay for viewing photos enlarged within a species folder.

**Data model for the lightbox:**
The lightbox receives a flat array of `{ photo: FindPhoto; find: Find }` entries representing ALL photos across all finds in the open folder, plus the current index and open state.

```typescript
interface LightboxPhoto {
  photo: FindPhoto;
  find: Find;
}

interface PhotoLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photos: LightboxPhoto[];  // all photos in the folder, flattened
  currentIndex: number;
  onIndexChange: (index: number) => void;
  storagePath: string;
}
```

**Implementation:**
- Use shadcn Dialog (from `@/components/ui/dialog`) as the base overlay. Override DialogContent className to be larger: `sm:max-w-4xl max-h-[85vh]` with `showCloseButton={false}` (custom close).
- Increase overlay darkness: pass `className="bg-black/80"` to DialogOverlay (or wrap DialogContent with a custom overlay). The goal is a dark, cinematic backdrop that focuses attention on the photo.
- Layout: flexbox row on wider screens, column on narrow. Left/main area: the photo. Right/bottom area: find metadata panel.

**Photo display area:**
- Use `convertFileSrc()` from `@tauri-apps/api/core` to resolve the photo path: `convertFileSrc(\`${storagePath}/${photo.photo_path}\`)`.
- Photo renders as `<img>` with `object-contain` inside a container that fills available space (`flex-1 min-h-0`).
- For HEIC files (check with `isHeic` from `@/lib/finds`), show a placeholder with the HEIC label (same pattern as FindCard).
- Add subtle fade-in animation when photo changes (use CSS transition on opacity with a key change).

**Navigation:**
- Left/right arrow buttons (ChevronLeft, ChevronRight from lucide-react) positioned at vertical center of the photo area, semi-transparent bg, hover reveals full opacity.
- Keyboard: ArrowLeft/ArrowRight for prev/next, Escape to close. Add `useEffect` with `keydown` listener when `open` is true.
- Hide left arrow when index === 0, hide right arrow when index === photos.length - 1.
- Show photo counter: `{currentIndex + 1} / {photos.length}` in muted text, positioned top-center or bottom-center of photo area.

**Metadata panel (right side / bottom):**
- Species name in Playfair Display (`font-serif text-lg font-semibold`).
- Date found in DM Sans (`text-sm text-muted-foreground`).
- Location: country + region + location_note, each on its own line if present.
- Find notes in italic (`text-sm italic text-muted-foreground/70`), with a max-height and overflow-y-auto if long.
- Coordinates in JetBrains Mono (`font-mono text-[10px] text-muted-foreground/40`) if lat/lng present.

**Close button:** Custom X button (lucide XIcon) positioned absolute top-right of the dialog, larger hit target (`h-9 w-9`), semi-transparent, hover:opaque. Use DialogClose wrapper.

**Forest Codex styling:**
- Dark card background for metadata panel: `bg-card/80 backdrop-blur-sm`.
- Amber accent: thin top border on metadata panel `border-t border-primary/30`.
- No bright whites — use `text-foreground` and muted variants.
- Transition on photo swap: `transition-opacity duration-200`.

**i18n:** Add to both hr and en translations in `src/i18n/index.ts`:
- `'lightbox.photoCount': '{current} / {total}'` (hr: same format)
- `'lightbox.prev': 'Prethodna'` / `'Previous'`
- `'lightbox.next': 'Sljedeća'` / `'Next'`
- `'lightbox.close': 'Zatvori'` / `'Close'`
  </action>
  <verify>
    <automated>cd /Users/ivicaskrobo/Documents/GitHub/Bili-Mushroom && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>PhotoLightbox.tsx exists, TypeScript compiles without errors, i18n keys added for both languages.</done>
</task>

<task type="auto">
  <name>Task 2: Wire lightbox into CollectionTab via FindCard thumbnail clicks</name>
  <files>src/tabs/CollectionTab.tsx, src/components/finds/FindCard.tsx</files>
  <action>
**FindCard changes:**
Add an `onPhotoClick` optional callback prop to FindCardProps:
```typescript
onPhotoClick?: (findId: number, photoIndex: number) => void;
```
When NOT in select mode, make the thumbnail (the `<img>` or HEIC placeholder div, the 80x20px area) clickable. On click, call `onPhotoClick(find.id, 0)`. For multi-photo finds, the extra count badge (`+N`) is already inside the thumbnail area so it naturally triggers the same click. Add `cursor-pointer` to the thumbnail container when onPhotoClick is provided and not in select mode.

Do NOT change click behavior in select mode (checkbox toggle remains).

**CollectionTab changes:**
Add lightbox state:
```typescript
const [lightboxOpen, setLightboxOpen] = useState(false);
const [lightboxIndex, setLightboxIndex] = useState(0);
const [lightboxPhotos, setLightboxPhotos] = useState<LightboxPhoto[]>([]);
```

Import `PhotoLightbox` and the `LightboxPhoto` type from `@/components/finds/PhotoLightbox`.

Create a handler function `openLightbox(speciesFinds: Find[], findId: number, photoIndex: number)` that:
1. Builds the flat `LightboxPhoto[]` array from all finds in that folder: iterate `speciesFinds`, for each find iterate `find.photos`, create `{ photo, find }` entries.
2. Finds the global index in the flat array matching the clicked `findId` and `photoIndex`.
3. Sets `lightboxPhotos`, `lightboxIndex`, and `lightboxOpen = true`.

In the folder body section (where FindCard is rendered), pass `onPhotoClick` to each FindCard:
```tsx
onPhotoClick={(findId, photoIdx) => openLightbox(speciesFinds, findId, photoIdx)}
```

Render `<PhotoLightbox>` once at the bottom of CollectionTab (alongside ImportDialog, EditFindDialog, etc.):
```tsx
<PhotoLightbox
  open={lightboxOpen}
  onOpenChange={setLightboxOpen}
  photos={lightboxPhotos}
  currentIndex={lightboxIndex}
  onIndexChange={setLightboxIndex}
  storagePath={storagePath!}
/>
```
  </action>
  <verify>
    <automated>cd /Users/ivicaskrobo/Documents/GitHub/Bili-Mushroom && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>Clicking a photo thumbnail in any collection folder opens the lightbox showing that photo enlarged. Arrow keys and buttons navigate through all photos in the folder. Esc or clicking outside closes. Find metadata (species, date, notes, location) displays alongside the photo.</done>
</task>

</tasks>

<verification>
1. Open the app, navigate to Collection tab
2. Expand a species folder that has multiple finds with photos
3. Click any photo thumbnail — lightbox opens showing that photo enlarged
4. Use arrow buttons or keyboard Left/Right to navigate through all photos in the folder
5. Verify find notes, date, species name, and location display alongside photo
6. Press Esc — lightbox closes
7. Click backdrop outside the dialog content — lightbox closes
8. Verify select mode still works (thumbnail click toggles checkbox, not lightbox)
</verification>

<success_criteria>
- Photo thumbnails in collection folders are clickable (non-select mode)
- Lightbox overlay shows enlarged photo with dark cinematic backdrop
- Prev/next navigation works via buttons and keyboard arrows
- Find metadata (species, date, notes, location) visible alongside photo
- Photo counter shows position (e.g. "3 / 12")
- Esc and backdrop click dismiss the lightbox
- Select mode unaffected — thumbnail clicks still toggle selection
- Forest Codex aesthetic: dark overlay, amber accents, serif species name, mono coordinates
- TypeScript compiles clean
</success_criteria>

<output>
After completion, create `.planning/quick/260415-syy-collection-photo-lightbox-within-folder/260415-syy-SUMMARY.md`
</output>
