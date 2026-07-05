---
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/import/StagedPhotoViewer.tsx
  - src/components/import/StagedPhotoViewer.test.tsx
  - src/components/import/ImportDialog.tsx
  - src/i18n/index.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "User can click a staged (not-yet-saved) photo thumbnail in the Import dialog and see it full-size before importing"
    - "User can zoom into the full-size staged photo (scroll-to-zoom and +/- controls) to inspect gill/cap/stem detail"
    - "User can pan the image when zoomed in (drag)"
    - "User can navigate to the next/previous staged photo without leaving the viewer, when multiple photos are staged"
    - "User can close the viewer with Escape or a close button, returning to the Import dialog unchanged"
    - "Opening/zooming/closing the viewer does not delete, reorder, or otherwise mutate the staged photos array"
  artifacts:
    - path: "src/components/import/StagedPhotoViewer.tsx"
      provides: "Lightbox-style full-size viewer with zoom/pan/prev-next for staged (unsaved) import photos"
      exports: ["StagedPhotoViewer"]
    - path: "src/components/import/ImportDialog.tsx"
      provides: "Wires thumbnail click to open StagedPhotoViewer at the clicked index"
      contains: "StagedPhotoViewer"
  key_links:
    - from: "src/components/import/ImportDialog.tsx"
      to: "src/components/import/StagedPhotoViewer.tsx"
      via: "onClick handler on each thumbnail sets viewerIndex state, renders <StagedPhotoViewer open photos={photos} .../>"
      pattern: "StagedPhotoViewer"
---

<objective>
Add a full-size, zoomable preview viewer for photos that have been picked into the Import dialog but not yet saved (staged photos), so the user can inspect fine detail (gills, cap texture, stem) to help determine species before committing the import.

Purpose: Currently `ImportDialog.tsx` only shows small thumbnails (`aspect-square`, `object-cover`) of staged photos — there is no way to see them full-size or zoom in before the find is saved. Foragers need close visual inspection for accurate species determination at the point of decision (during import), not after.

Output: A new `StagedPhotoViewer` component (lightbox-style, reusing the Radix `Dialog` primitive and mirroring the interaction model already established in `src/components/finds/PhotoLightbox.tsx`) wired into `ImportDialog.tsx` so clicking any staged thumbnail opens it full-size with zoom, pan, and prev/next navigation across the staged photo list.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@./CLAUDE.md

Before writing or modifying any UI, invoke the `frontend-design` skill (per CLAUDE.md "Frontend Design" section) and follow the established "Forest Codex" aesthetic already implemented in this repo — do not introduce a new visual language. This is an additive feature on an existing screen: match the existing `PhotoLightbox.tsx` cinematic dark-overlay lightbox treatment (`bg-black/85` overlay, `bg-black/60` photo stage, translucent circular icon buttons `bg-black/40 hover:bg-black/70 text-white/60 hover:text-white`), since staged-photo preview is conceptually the same interaction as the saved-photo lightbox, just without persistence/editing actions.

Staged photos in `ImportDialog.tsx` are plain absolute filesystem path strings (`photos: string[]`, from `@tauri-apps/plugin-dialog` `open()` / `readDir`), rendered today via `convertFileSrc(path)` from `@tauri-apps/api/core` — NOT through `resolvePhotoSrc`/`storagePath` (that path is only for photos already copied into app-managed storage). The new viewer must accept raw local paths and use `convertFileSrc` directly; it must NOT depend on `storagePath` or any saved `FindPhoto`/`Find` record, since these photos do not exist in the database yet.

<interfaces>
<!-- Existing lightbox this new component takes interaction cues from (zoom/pan/prev-next/keyboard/fullscreen patterns). Do NOT reuse PhotoLightbox directly — it is tightly coupled to saved Find/FindPhoto records, storagePath resolution, delete/edit/species-cover mutations, and a metadata side panel, none of which exist for staged photos. Build a new, simpler component instead. -->

From src/components/finds/PhotoLightbox.tsx (pattern reference only — zoom/pan state machine, wheel handler, double-click-to-zoom, drag-to-pan, keyboard arrow nav, Escape-to-close via Radix Dialog, fullscreen toggle):

```typescript
const [zoom, setZoom] = useState(1);
const [pan, setPan] = useState({ x: 0, y: 0 });
// handleWheel: clamps zoom 1..5, multiplies by 1.15/0.87 per wheel tick, resets pan when zoom returns to 1
// handleDoubleClick: toggles between zoom=1 (reset pan) and zoom=2.5
// handleMouseDown/Move/Up: drag-to-pan only when zoom > 1
// keyboard effect: ArrowLeft/ArrowRight change index; Escape handled natively by Radix Dialog's onEscapeKeyDown / default behavior
// previewTransform = `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`
```

From src/components/ui/dialog.tsx (shared primitives to reuse):

```typescript
export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger }
```

Use `Dialog` + `DialogPortal` + `DialogOverlay` + Radix `Dialog.Content` (via `radix-ui`'s `Dialog as DialogPrimitive`, same import pattern as `PhotoLightbox.tsx` line 3: `import { Dialog as DialogPrimitive } from 'radix-ui';`) for full manual control over sizing/fullscreen-style layout, exactly like `PhotoLightbox.tsx` does — do not use the generic `DialogContent` wrapper (it caps width at `sm:max-w-lg` which is wrong for an image viewer).

From src/components/import/ImportDialog.tsx (current staged-photo thumbnail grid to replace the static grid's click behavior with a click-to-open handler — lines ~826-856):

```tsx
const [photos, setPhotos] = useState<string[]>([]); // staged photo paths, already in component
// existing thumbnail render:
{photos.map((path, i) => (
  <div key={path} className="relative group aspect-square rounded-md overflow-hidden bg-muted">
    <img src={convertFileSrc(path)} alt="" className="w-full h-full object-cover" />
    <button onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))} /* ... */>
      <X className="h-3 w-3" />
    </button>
  </div>
))}
```

`convertFileSrc` is already imported in `ImportDialog.tsx` from `@tauri-apps/api/core`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create StagedPhotoViewer component with zoom/pan/navigation</name>
  <files>src/components/import/StagedPhotoViewer.tsx, src/components/import/StagedPhotoViewer.test.tsx, src/i18n/index.ts</files>
  <behavior>
    - Renders nothing when `open` is false or `photos` is empty
    - Renders the photo at `currentIndex` full-size using `convertFileSrc(photos[currentIndex])`, inside a Radix Dialog content sized for image viewing (large max-width/max-height, dark stage background), matching the existing PhotoLightbox cinematic treatment
    - Shows a photo counter ("{current} / {total}") when `photos.length > 1`
    - Prev/Next chevron buttons appear only when a previous/next index exists; clicking them calls `onIndexChange` with the new index (component is controlled: `currentIndex` and `onIndexChange` are props, mirroring PhotoLightbox's controlled pattern)
    - ArrowLeft/ArrowRight keydown (only while `open`) call `onIndexChange` with prev/next index, matching PhotoLightbox's existing keyboard effect
    - Escape key closes the viewer via `onOpenChange(false)` (Radix Dialog default — do not intercept unless needed for a fullscreen sub-state)
    - Close (X) button calls `onOpenChange(false)`
    - Scroll wheel over the image adjusts zoom, clamped between 1 and 5, using the same multiplier pattern as PhotoLightbox (`prev * (deltaY < 0 ? 1.15 : 0.87)`); zoom returning to 1 snaps pan back to `{x:0, y:0}`
    - Double-click toggles zoom between 1 and 2.5 (reset pan on 1)
    - When zoom > 1, mouse-drag pans the image (mousedown/mousemove/mouseup), matching PhotoLightbox's drag math
    - Zoom in (+) / zoom out (-) buttons are present and functional independent of scroll
    - Changing `currentIndex` (or the viewer re-opening) resets zoom to 1 and pan to `{x:0, y:0}`
    - Component takes no dependency on `storagePath`, `Find`, `FindPhoto`, or TanStack Query — it is a pure, self-contained presentational viewer driven entirely by the `photos: string[]` prop
    - No delete/edit/crop/rotate/species-cover actions — this viewer is read-only inspection only (staged photos aren't persisted yet; deletion/reordering stays in ImportDialog's existing thumbnail grid)
  </behavior>
  <action>
    Invoke the `frontend-design` skill first per CLAUDE.md, confirming the "Forest Codex" cinematic-lightbox treatment applies here (dark overlay `bg-black/85`, photo stage `bg-black/60`, translucent circular white/60 icon buttons on black/40 hover:black/70, per existing `PhotoLightbox.tsx`).

    Create `src/components/import/StagedPhotoViewer.tsx`:
    - Props: `{ open: boolean; onOpenChange: (open: boolean) => void; photos: string[]; currentIndex: number; onIndexChange: (index: number) => void }`
    - Import `convertFileSrc` from `@tauri-apps/api/core`, `Dialog`/`DialogClose`/`DialogOverlay`/`DialogPortal` from `@/components/ui/dialog`, `Dialog as DialogPrimitive` from `radix-ui`, icons from `lucide-react` (`ChevronLeft, ChevronRight, Plus, Minus, X, ZoomIn`), `useT` from `@/i18n/index`.
    - Port the zoom/pan state and `handleWheel`/`handleDoubleClick`/`handleMouseDown`/`handleMouseMove`/`handleMouseUp` handlers from `PhotoLightbox.tsx`, adapted to operate on `photos[currentIndex]` (a raw path) instead of a `FindPhoto` object.
    - `useEffect` resets zoom/pan when `currentIndex` changes or `open` transitions to true.
    - Keyboard effect (ArrowLeft/ArrowRight) mirrors PhotoLightbox's, scoped to `open`.
    - Render structure: `DialogPortal` containing `DialogOverlay className="bg-black/85"` plus `DialogPrimitive.Content` (custom-styled fixed-position panel, no sidebar/metadata panel — full width/height dedicated to the image, unlike PhotoLightbox's 2-column layout) containing: `DialogPrimitive.Title` (sr-only, e.g. staged photo filename) plus `DialogPrimitive.Description` (sr-only, photo count), the image stage div with wheel/mouse handlers and the `<img>` using `previewTransform`, photo counter badge, prev/next chevrons, top-left zoom controls (+/-/reset-percentage badge), top-right close button.
    - Add i18n keys to `src/i18n/index.ts` in both the `hr` block (near existing `import.removePhoto` / `lightbox.*` keys around line 548) and the `en` block (near line 1168): `'import.viewPhoto': 'Pregledaj fotografiju'` / `'View photo'` (used as thumbnail button `title`/`aria-label` in Task 2). Reuse existing `lightbox.zoomIn`, `lightbox.zoomOut`, `lightbox.resetZoom`, `lightbox.prev`, `lightbox.next`, `lightbox.close`, `lightbox.photoCount` keys directly in the new component instead of duplicating them.
    - Write `StagedPhotoViewer.test.tsx` (Vitest + Testing Library, follow the mocking conventions in `ImportDialog.test.tsx`: mock `@tauri-apps/api/core`'s `convertFileSrc` to return the input path unchanged, mock `@/stores/appStore` if `useT`/language selection requires it). RED first: write failing tests for the behavior list above (renders full-size photo when open, renders nothing when closed or photos empty, prev/next navigation respects array bounds and calls `onIndexChange`, Escape closes via `onOpenChange(false)`, wheel event changes zoom within 1..5 bounds, double-click toggles zoom between 1 and 2.5, changing `currentIndex` resets zoom to 1). Then GREEN: implement the component until tests pass. REFACTOR if needed for clarity, keeping tests green.
  </action>
  <verify>
    <automated>cd "D:\ClaudeProjects\Bili-Mushroom" && npx vitest run src/components/import/StagedPhotoViewer.test.tsx</automated>
  </verify>
  <done>StagedPhotoViewer.tsx exists, exports StagedPhotoViewer, and all tests in StagedPhotoViewer.test.tsx pass covering open/close, zoom bounds, double-click toggle, prev/next navigation, and zoom-reset-on-index-change.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire StagedPhotoViewer into ImportDialog thumbnail grid</name>
  <files>src/components/import/ImportDialog.tsx, src/components/import/ImportDialog.test.tsx</files>
  <behavior>
    - Clicking a staged photo thumbnail (not the existing remove/X button) opens `StagedPhotoViewer` with `currentIndex` set to that thumbnail's index
    - The existing per-thumbnail remove (X) button continues to work exactly as before and does NOT trigger the viewer to open (event propagation must be stopped on the remove button's click, or the remove button must be a sibling that captures the click first)
    - Viewer navigation (`onIndexChange`) updates the same `viewerIndex` state driving the viewer, independent of the underlying `photos` array mutation elsewhere in the dialog
    - Closing the viewer (Escape, X, or overlay click per Radix Dialog default) returns focus to the Import dialog with the `photos` array and all shared metadata fields (species name, date, location, notes, etc.) completely unchanged
    - If the user removes a photo (via the X button) while the viewer is closed, no stale index or crash occurs on next open (viewer index derived fresh from the click)
  </behavior>
  <action>
    In `ImportDialog.tsx`:
    - Import `StagedPhotoViewer` from `./StagedPhotoViewer`.
    - Add local state: `const [viewerOpen, setViewerOpen] = useState(false);` and `const [viewerIndex, setViewerIndex] = useState(0);`.
    - In the thumbnail grid (existing `photos.map((path, i) => ...)` block around line 831), wrap the `<img>` in a `button type="button"` (or add an `onClick` directly to the existing thumbnail `div`) that calls `setViewerIndex(i); setViewerOpen(true);`. Add `aria-label={t('import.viewPhoto')}` / `title={t('import.viewPhoto')}` and a hover affordance consistent with Forest Codex (e.g. a subtle zoom-in cursor or icon overlay on hover, matching the existing group-hover pattern already used for the remove button).
    - Ensure the existing remove (X) button's `onClick` calls `e.stopPropagation()` before its current `setPhotos(...)` logic, so clicking remove does not also open the viewer.
    - Render `<StagedPhotoViewer open={viewerOpen} onOpenChange={setViewerOpen} photos={photos} currentIndex={viewerIndex} onIndexChange={setViewerIndex} />` near the dialog's other modal renders (alongside the existing `<LocationPickerMap .../>` render).
    - Update `ImportDialog.test.tsx`: add tests verifying (a) clicking a thumbnail image opens the viewer (assert some viewer-only element becomes visible, e.g. via a lightweight mock of `StagedPhotoViewer` similar to how `LocationPickerMap` is mocked at the top of the test file, exposing an open/closed marker and next/prev/close controls), (b) clicking the remove (X) button does not open the viewer and still removes the photo from the grid, (c) the shared metadata fields (e.g. species name value) are unaffected after opening and closing the viewer.
  </action>
  <verify>
    <automated>cd "D:\ClaudeProjects\Bili-Mushroom" && npx vitest run src/components/import/ImportDialog.test.tsx src/components/import/StagedPhotoViewer.test.tsx</automated>
  </verify>
  <done>Clicking any staged thumbnail in ImportDialog opens StagedPhotoViewer at the correct index; the remove (X) button still works without opening the viewer; all ImportDialog and StagedPhotoViewer tests pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Local filesystem paths -> `convertFileSrc` -> `<img src>` | User-picked file paths (via native OS file dialog) rendered as images inside the WebView via Tauri's asset protocol converter |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|------------------|
| T-quick-01 | Information Disclosure | StagedPhotoViewer rendering arbitrary local file paths | accept | Paths originate exclusively from the OS-native file/folder picker (`@tauri-apps/plugin-dialog` `open()`) already used elsewhere in `ImportDialog.tsx`; no new path source is introduced, and `convertFileSrc` is the same Tauri-sanctioned mechanism already used for the existing thumbnail grid. No user-supplied arbitrary string reaches `convertFileSrc` without going through the picker first. |
| T-quick-02 | Tampering | Staged `photos` array state during viewer interaction | accept | Viewer is presentation-only (no mutation methods passed in beyond `onIndexChange`, which only changes which index is displayed); `photos` array itself is only mutated by the pre-existing remove-button handler in `ImportDialog.tsx`, unchanged by this plan. |
| T-quick-03 | Denial of Service | Rendering very large staged photo lists / large image files at 5x zoom | accept | Bounded by the same constraints as the existing thumbnail grid (no new photo ingestion path); zoom is capped at 5x matching the existing `PhotoLightbox.tsx` pattern; no additional risk introduced beyond what the shipped saved-photo lightbox already accepts. |
</threat_model>

<verification>
1. Run `npx vitest run src/components/import/StagedPhotoViewer.test.tsx src/components/import/ImportDialog.test.tsx` — all tests pass.
2. Manually launch the app (`npm run tauri dev` or equivalent), open Import, pick 2+ photos, click a thumbnail — full-size viewer opens showing that photo.
3. Scroll to zoom in/out on the opened photo; confirm zoom clamps between 1x and 5x and pan drag works above 1x.
4. Click next/prev (or press ArrowRight/ArrowLeft) — viewer advances through staged photos without closing.
5. Press Escape — viewer closes, Import dialog still shows all previously entered fields and the full photo list unchanged.
6. Click the remove (X) button on a thumbnail — photo is removed from the grid, viewer does not open.
</verification>

<success_criteria>
- `StagedPhotoViewer` component exists, is fully self-contained (no `storagePath`/DB dependency), and its automated tests pass.
- Clicking any staged thumbnail in `ImportDialog` opens the viewer at that photo's index.
- Zoom (scroll + buttons + double-click) and pan work identically in spirit to the existing saved-photo `PhotoLightbox`.
- Prev/Next navigation and Escape-to-close work without mutating the staged photos array or any shared metadata field.
- Forest Codex visual language preserved (dark cinematic overlay, translucent circular icon buttons, no new color/typography system introduced).
</success_criteria>

<output>
After completion, create `.planning/quick/260705-wdb-dodaj-mogucnost-pregleda-i-zumiranja-uve/260705-wdb-SUMMARY.md`
</output>
