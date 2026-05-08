---
phase: quick-260508-wlr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/finds/LocationNoteInput.tsx
  - src/components/finds/LocationNoteInput.test.tsx
  - src/components/finds/CreateFindDialog.tsx
  - src/components/finds/EditFindDialog.tsx
  - src/components/import/ImportDialog.tsx
autonomous: true
requirements: [location-note-autocomplete]
must_haves:
  truths:
    - "Typing in location_note in CreateFindDialog shows matching suggestions from prior finds"
    - "Typing in location_note in EditFindDialog shows matching suggestions from prior finds"
    - "Typing in location_note in ImportDialog shared header shows matching suggestions"
    - "Selecting a suggestion fills the field immediately and closes the dropdown"
    - "Empty and whitespace-only location_note values never appear as suggestions"
    - "Duplicate values appear only once in the suggestion list"
    - "Matching is case-insensitive (typing 'gorski' surfaces 'Gorski kotar')"
    - "User can type a custom value not in the suggestion list"
  artifacts:
    - path: "src/components/finds/LocationNoteInput.tsx"
      provides: "Reusable Input wrapper with autocomplete dropdown for location_note"
      exports: ["LocationNoteInput"]
    - path: "src/components/finds/LocationNoteInput.test.tsx"
      provides: "Vitest tests for dedup, case-insensitive match, suggestion select, custom value"
  key_links:
    - from: "CreateFindDialog.tsx / EditFindDialog.tsx"
      to: "useFinds()"
      via: "locationNoteSuggestions derived from finds data"
      pattern: "useFinds.*location_note"
    - from: "LocationNoteInput"
      to: "suggestions prop"
      via: "filtered dropdown on input change"
      pattern: "visibleSuggestions.*filter"
---

<objective>
Add autocomplete suggestions to the location_note field across CreateFindDialog, EditFindDialog, and ImportDialog. Suggestions are derived from existing finds' location_note values — deduplicated, case-insensitive matched, empty-filtered.

Purpose: Foragers reuse named spots ("Gorski kotar", "šuma iza sela"). Autocomplete saves typing and ensures consistent naming across finds.
Output: LocationNoteInput component + wiring in three dialogs + Vitest tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/ivicaskrobo/Documents/GitHub/Bili-Mushroom/.planning/STATE.md
</context>

<interfaces>
<!-- Key patterns from SpeciesNameEditor.tsx — the existing autocomplete model to follow -->

Autocomplete pattern (from SpeciesNameEditor.tsx):
```tsx
const [dropdownOpen, setDropdownOpen] = useState(false);
const [dropdownHighlight, setDropdownHighlight] = useState(0);

const visibleSuggestions = plainText
  ? suggestions.filter((s) => s.toLowerCase().includes(plainText.toLowerCase())).slice(0, 8)
  : [];

function selectSuggestion(raw: string) {
  setDropdownOpen(false);
  setDropdownHighlight(0);
  onChange(raw);
}

function handleKeyDown(e) {
  if (e.key === 'Enter' && dropdownOpen && visibleSuggestions.length > 0) {
    selectSuggestion(visibleSuggestions[dropdownHighlight]); return;
  }
  if (e.key === 'Escape') { setDropdownOpen(false); return; }
  if (e.key === 'Tab' && dropdownOpen && visibleSuggestions.length > 0) {
    e.preventDefault(); selectSuggestion(visibleSuggestions[dropdownHighlight]); return;
  }
  if (e.key === 'ArrowDown') setDropdownHighlight(h => Math.min(h + 1, visibleSuggestions.length - 1));
  if (e.key === 'ArrowUp') setDropdownHighlight(h => Math.max(h - 1, 0));
}

// Blur delay so click on suggestion fires first
function handleBlur() { setTimeout(() => setDropdownOpen(false), 150); }
function handleFocus() { if (value) setDropdownOpen(true); }

// Dropdown JSX:
{dropdownOpen && visibleSuggestions.length > 0 && (
  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
    {visibleSuggestions.map((s, i) => (
      <button key={s} type="button"
        className={cn('w-full text-left px-3 py-1.5 text-sm transition-colors',
          i === dropdownHighlight ? 'bg-accent' : 'hover:bg-accent')}
        onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
        onMouseEnter={() => setDropdownHighlight(i)}>
        {s}
      </button>
    ))}
  </div>
)}
```

Suggestion derivation pattern (from ImportDialog.tsx):
```tsx
const locationNoteSuggestions = useMemo(() => {
  if (!findsData) return [];
  const seen = new Set<string>();
  return findsData
    .map((f) => f.location_note ?? '')
    .filter((v) => {
      const trimmed = v.trim();
      if (!trimmed || seen.has(trimmed.toLowerCase())) return false;
      seen.add(trimmed.toLowerCase());
      return true;
    });
}, [findsData]);
```

useFinds hook (from src/hooks/useFinds.ts):
```tsx
export function useFinds() {
  const storagePath = useAppStore((s) => s.storagePath);
  return useQuery<Find[]>({
    queryKey: [FINDS_QUERY_KEY, storagePath],
    queryFn: () => getFinds(storagePath!),
    enabled: !!storagePath,
  });
}
```

Find type location_note field:
```tsx
interface Find {
  location_note: string | null;
  // ...
}
```
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create LocationNoteInput component and tests</name>
  <files>src/components/finds/LocationNoteInput.tsx, src/components/finds/LocationNoteInput.test.tsx</files>
  <behavior>
    - Test 1: suggestions prop with ["Gorski kotar", "Učka", "šuma"] — typing "gor" shows only "Gorski kotar" (case-insensitive)
    - Test 2: suggestions with duplicates ["Gorski kotar", "gorski kotar", "Učka"] — only one entry per unique lowercase value shown
    - Test 3: suggestions with ["", "  ", "Gorski kotar"] — empty/whitespace entries never appear in dropdown
    - Test 4: clicking a suggestion calls onChange with exact suggestion value and closes dropdown
    - Test 5: typing a value not in suggestions does not block onChange — custom value flows through
    - Test 6: keyboard ArrowDown then Enter selects highlighted suggestion
  </behavior>
  <action>
Write tests first in LocationNoteInput.test.tsx using @testing-library/react + vitest. Use fireEvent.change to set input value, check dropdown items appear via getByText/queryByText.

Then implement LocationNoteInput.tsx:

```tsx
interface LocationNoteInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions?: string[];
  placeholder?: string;
  className?: string;
}
```

Internal logic mirrors SpeciesNameEditor autocomplete pattern exactly:
- `visibleSuggestions`: filter suggestions where s.toLowerCase().includes(value.trim().toLowerCase()), slice to 8, only when value.trim() is non-empty
- `dropdownOpen` state: true on focus if value non-empty, true on input change if suggestions exist, false on blur (150ms delay), false after selection
- `dropdownHighlight` state: reset to 0 on input change, ArrowDown/Up nav, clamped to [0, visible.length-1]
- `selectSuggestion(s)`: calls onChange(s), closes dropdown, resets highlight
- KeyDown: Enter → select highlighted if dropdown open; Escape → close; Tab → select highlighted if dropdown open (preventDefault); ArrowDown/Up → navigate
- Blur: `setTimeout(() => setDropdownOpen(false), 150)`
- Focus: if value non-empty, open dropdown
- The input itself is a standard `<Input>` (shadcn) — not contentEditable
- Wrap input + dropdown in `<div className="relative">`
- Dropdown: `absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto`
- Suggestion buttons: `onMouseDown` with e.preventDefault() so blur doesn't fire before click

Do NOT: open dropdown when value is empty (no suggestions on empty field). Do NOT deduplicate inside LocationNoteInput — the parent passes an already-deduplicated list. Do NOT add any Forest Codex-specific custom colors beyond what bg-popover/bg-accent/border already provide (these CSS vars handle theming).
  </action>
  <verify>
    <automated>cd /Users/ivicaskrobo/Documents/GitHub/Bili-Mushroom && npx vitest run src/components/finds/LocationNoteInput.test.tsx</automated>
  </verify>
  <done>All 6 tests pass. LocationNoteInput exported from its file. Dropdown appears on typing, disappears on selection/blur/escape, keyboard nav works.</done>
</task>

<task type="auto">
  <name>Task 2: Wire LocationNoteInput into CreateFindDialog, EditFindDialog, and ImportDialog</name>
  <files>src/components/finds/CreateFindDialog.tsx, src/components/finds/EditFindDialog.tsx, src/components/import/ImportDialog.tsx</files>
  <action>
In CreateFindDialog.tsx:
- Add `useFinds` import from `@/hooks/useFinds`
- Add `useMemo` import from `react`
- Add `LocationNoteInput` import from `./LocationNoteInput`
- After the existing `speciesFolders` state, add:
  ```tsx
  const { data: findsData } = useFinds();
  const locationNoteSuggestions = useMemo(() => {
    if (!findsData) return [];
    const seen = new Set<string>();
    return findsData
      .map((f) => f.location_note ?? '')
      .filter((v) => {
        const trimmed = v.trim();
        if (!trimmed || seen.has(trimmed.toLowerCase())) return false;
        seen.add(trimmed.toLowerCase());
        return true;
      });
  }, [findsData]);
  ```
- Replace the existing `<Input>` for location_note (inside `col-span-2` div) with:
  ```tsx
  <LocationNoteInput
    value={form.location_note}
    onChange={(v) => handleChange('location_note', v)}
    suggestions={locationNoteSuggestions}
    placeholder={t('edit.locationMarkPlaceholder')}
  />
  ```

In EditFindDialog.tsx:
- Same imports: `useFinds`, `useMemo`, `LocationNoteInput`
- Add the same `locationNoteSuggestions` memo after existing `speciesFolders` useEffect
- Replace the `<Input>` for location_note in the `col-span-2` div with `<LocationNoteInput>` using the same props pattern

In ImportDialog.tsx:
- Add `LocationNoteInput` import from `@/components/finds/LocationNoteInput`
- Add `locationNoteSuggestions` memo derived from existing `findsData` (ImportDialog already calls `useFinds()` — reuse that data):
  ```tsx
  const locationNoteSuggestions = useMemo(() => {
    if (!findsData) return [];
    const seen = new Set<string>();
    return findsData
      .map((f) => f.location_note ?? '')
      .filter((v) => {
        const trimmed = v.trim();
        if (!trimmed || seen.has(trimmed.toLowerCase())) return false;
        seen.add(trimmed.toLowerCase());
        return true;
      });
  }, [findsData]);
  ```
- Find the shared header location note `<Input>` (the one bound to `sharedLocationNote` / `setSharedLocationNote`) and replace with:
  ```tsx
  <LocationNoteInput
    value={sharedLocationNote}
    onChange={setSharedLocationNote}
    suggestions={locationNoteSuggestions}
    placeholder={t('preview.locationMark')}
  />
  ```

Note: FindPreviewCard's per-card `LockableInput` for `location_note` uses a different pattern (locked fields cascade from shared header). Leave LockableInput unchanged — the shared header autocomplete covers the primary UX path.
  </action>
  <verify>
    <automated>cd /Users/ivicaskrobo/Documents/GitHub/Bili-Mushroom && npx vitest run src/components/finds/CreateFindDialog.test.tsx src/components/finds/EditFindDialog.test.tsx src/components/import/ImportDialog.test.tsx 2>&1 | tail -20</automated>
  </verify>
  <done>All three dialogs compile without TypeScript errors (`npx tsc --noEmit` passes). Existing dialog tests pass. LocationNoteInput renders where the plain Input was.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| finds data → suggestion list | location_note values read from local SQLite — no external input |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-wlr-01 | Information Disclosure | suggestion dropdown | accept | Values are the user's own data already visible in the collection; no new disclosure |
| T-wlr-02| Tampering | LocationNoteInput value | accept | onChange propagates raw string; parent form state and Rust command validate on save |
</threat_model>

<verification>
1. `npx vitest run src/components/finds/LocationNoteInput.test.tsx` — all 6 tests green
2. `npx tsc --noEmit` — no TypeScript errors across all three modified dialogs
3. `npx vitest run src/components/finds/CreateFindDialog.test.tsx src/components/finds/EditFindDialog.test.tsx src/components/import/ImportDialog.test.tsx` — pre-existing tests still pass
</verification>

<success_criteria>
- LocationNoteInput component exists and is tested
- Dropdown appears when user types in location_note field and matching prior values exist
- Selecting a suggestion fills the field and closes the dropdown
- Keyboard navigation (ArrowDown/Up/Enter/Tab/Esc) works
- Empty/whitespace/duplicate values never surface as suggestions
- No regressions in existing dialog tests
- TypeScript compilation clean
</success_criteria>

<output>
After completion, create `.planning/quick/260508-wlr-location-note-autocomplete-in-find-dialo/260508-wlr-SUMMARY.md`
</output>
