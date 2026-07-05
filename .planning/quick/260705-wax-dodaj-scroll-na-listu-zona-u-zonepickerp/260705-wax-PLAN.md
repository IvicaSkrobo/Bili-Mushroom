---
phase: quick
plan: 260705-wax
type: execute
wave: 1
depends_on: []
files_modified: [src/components/map/ZoneLayers.tsx]
autonomous: true
requirements: [QUICK-260705-WAX]

must_haves:
  truths:
    - "When many zones overlap at a point, the ZonePickerPopup list becomes scrollable instead of growing without bound"
    - "The popup's rounded corners are preserved (outer wrapper keeps overflow-hidden)"
  artifacts:
    - path: "src/components/map/ZoneLayers.tsx"
      provides: "ZonePickerPopup inner list div with max-height + overflow-y-auto"
      contains: "max-h-[240px] overflow-y-auto"
  key_links:
    - from: "ZonePickerPopup inner list div"
      to: "outer wrapper div"
      via: "className composition"
      pattern: "w-\\[220px\\] overflow-hidden rounded-lg"
---

<objective>
Add scroll behavior to the zone list inside `ZonePickerPopup` (`src/components/map/ZoneLayers.tsx`) so that when many zones overlap at one map point, the list scrolls instead of growing unbounded and overflowing the visible map area.

Purpose: Prevent the zone-picker popup from visually breaking out of the map viewport when a location has many overlapping zones.
Output: `ZonePickerPopup`'s inner list container gains a bounded height with vertical scroll; outer wrapper's `overflow-hidden` (for rounded corners) is preserved unchanged.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/map/ZoneLayers.tsx
</context>

<interfaces>
Current `ZonePickerPopup` structure (src/components/map/ZoneLayers.tsx, ~lines 220-256):

```tsx
function ZonePickerPopup({
  zones,
  onSelect,
}: {
  zones: Zone[];
  onSelect: (zone: Zone) => void;
}) {
  const t = useT();
  return (
    <div className="w-[220px] overflow-hidden rounded-lg bg-background font-sans shadow-xl ring-1 ring-border/30">
      <p className="px-2.5 pt-2 text-[11px] font-semibold leading-snug text-foreground/80">
        {t('map.zonePickerTitle')}
      </p>
      <div className="flex flex-col gap-1 px-2 pb-2 pt-1.5">
        {zones.map((zone) => {
          const accentColor = zone.zone_type === 'local' ? '#D4512A' : '#2D8C7C';
          return (
            <button
              key={zone.id}
              type="button"
              onClick={() => onSelect(zone)}
              className="flex items-center gap-2 rounded border border-border/60 bg-input px-2 py-1.5 text-left transition-colors hover:bg-secondary"
              style={{ borderLeftColor: accentColor, borderLeftWidth: '3px' }}
            >
              <span className="min-w-0 flex-1 truncate text-[12px] leading-tight text-foreground">
                {renderSpeciesName(zone.species_name)}
              </span>
              <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {t(zone.zone_type === 'local' ? 'zone.local' : 'zone.region')}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

Only the inner list `<div className="flex flex-col gap-1 px-2 pb-2 pt-1.5">` needs its className updated. The outer wrapper div and everything else in this function stays byte-for-byte identical.
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Add max-height + scroll to ZonePickerPopup's zone list</name>
  <files>src/components/map/ZoneLayers.tsx</files>
  <action>
  In `ZonePickerPopup` (around lines 220-256), locate the inner list container:
  `<div className="flex flex-col gap-1 px-2 pb-2 pt-1.5">`

  Change its className to add a bounded height and vertical scroll:
  `<div className="flex max-h-[240px] flex-col gap-1 overflow-y-auto px-2 pb-2 pt-1.5">`

  Do NOT modify the outer wrapper div's className (`w-[220px] overflow-hidden rounded-lg bg-background font-sans shadow-xl ring-1 ring-border/30`) — it must keep `overflow-hidden` so the popup's rounded corners are preserved; only the inner list div gets `overflow-y-auto`.

  Do not change any other part of ZoneLayers.tsx: hit-test logic, click handlers, i18n keys, colors, or any other component in the file remain untouched.
  </action>
  <verify>
    <automated>cd "D:\ClaudeProjects\Bili-Mushroom" && npm run build</automated>
  </verify>
  <done>`npm run build` (tsc + vite build) passes with no errors; the inner zone-list div in `ZonePickerPopup` has `max-h-[240px] overflow-y-auto` added alongside its existing classes; outer wrapper div's className is unchanged; no other part of the file is modified.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

None — this is a pure client-side CSS/layout change with no new data flow, trust boundary, or user input handling.

## STRIDE Threat Register

No new threats introduced. This change only adjusts Tailwind utility classes on an existing, already-reviewed component; no new inputs, endpoints, or data paths are created.
</threat_model>

<verification>
Run `npm run build` from the repo root — must complete with no TypeScript or Vite build errors. Manually diffing the file confirms only the single className string on the inner list div changed; the rest of `ZoneLayers.tsx` is byte-for-byte identical to before.
</verification>

<success_criteria>
- `npm run build` passes.
- The inner list div inside `ZonePickerPopup` has `max-h-[240px] overflow-y-auto` in addition to its prior classes (`flex flex-col gap-1 px-2 pb-2 pt-1.5`).
- The outer wrapper div retains `overflow-hidden` unchanged.
- No other file is modified; no other logic in `ZoneLayers.tsx` is altered.
</success_criteria>

<output>
After completion, create `.planning/quick/260705-wax-dodaj-scroll-na-listu-zona-u-zonepickerp/260705-wax-SUMMARY.md`
</output>
