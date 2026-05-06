import { Layers3, MapPin, Minus, PencilRuler } from 'lucide-react';
import type { Find } from '@/lib/finds';
import type { ZoneViewMode } from '@/lib/zones';
import { DraggablePanel } from './DraggablePanel';

interface ZoneModeControlProps {
  mode: ZoneViewMode;
  visibleFinds: Find[];
  activeSpecies: string | null;
  localTargetFind: Find | null;
  hasLocalCircle: boolean;
  hasLocalPolygon: boolean;
  hasRegionZone: boolean;
  hasRegionPolygon: boolean;
  onModeChange: (mode: ZoneViewMode) => void;
  onCreateLocalCircle: () => void;
  onStartLocalPolygon: () => void;
  onCreateRegion: () => void;
  onStartRegionPolygon: () => void;
  onSaveRegionPolygon: () => void;
  onUndoRegionPolygon: () => void;
  onCancelRegionPolygon: () => void;
  creatingRegion: boolean;
  drawingRegionPolygon: boolean;
  regionPolygonPointCount: number;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

const OPTIONS: Array<{ mode: ZoneViewMode; label: string }> = [
  { mode: 'pins', label: 'Pins only' },
  { mode: 'local', label: 'Local' },
  { mode: 'region', label: 'Region' },
  { mode: 'all', label: 'All zones' },
];

export function ZoneModeControl({
  mode,
  visibleFinds,
  activeSpecies,
  localTargetFind,
  hasLocalCircle,
  hasLocalPolygon,
  hasRegionZone,
  hasRegionPolygon,
  onCreateLocalCircle,
  onStartLocalPolygon,
  onModeChange,
  onCreateRegion,
  onStartRegionPolygon,
  onSaveRegionPolygon,
  onUndoRegionPolygon,
  onCancelRegionPolygon,
  creatingRegion,
  drawingRegionPolygon,
  regionPolygonPointCount,
  collapsed,
  onCollapsedChange,
}: ZoneModeControlProps) {
  const species = Array.from(new Set(visibleFinds.map((find) => find.species_name)));
  const targetSpecies = activeSpecies ?? (species.length === 1 ? species[0] : null);
  const canCreateRegion = targetSpecies != null && visibleFinds.some(
    (find) => find.species_name === targetSpecies && find.lat != null && find.lng != null,
  );
  const showRegionTools = mode === 'region' || mode === 'all';
  const showLocalTools = mode === 'local';

  return (
    <DraggablePanel
      initialPosition={{ x: 16, y: 16 }}
      storageKey="bili-zone-toolbar-position"
      className="absolute z-[1001] flex max-w-[calc(100%-2rem)] flex-col gap-2 font-sans"
    >
      {({ dragHandleProps }) => (
      <>
      {collapsed ? (
        <button
          type="button"
          aria-label="Show zone controls"
          onClick={() => onCollapsedChange(false)}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/35 bg-card/95 text-foreground shadow-xl backdrop-blur hover:bg-secondary/20"
        >
          <Layers3 className="h-4 w-4" />
        </button>
      ) : (
        <>
      <div className="flex w-fit max-w-full items-center gap-1 rounded-md border border-primary/35 bg-card/95 p-1 shadow-xl backdrop-blur">
        <span
          className="flex h-7 w-7 shrink-0 cursor-move items-center justify-center rounded bg-secondary/25 text-foreground"
          title="Drag zone controls"
          {...dragHandleProps}
        >
          <Layers3 className="h-3.5 w-3.5" />
        </span>
        <div className="flex min-w-0 flex-wrap gap-1">
          {OPTIONS.map((option) => (
            <button
              key={option.mode}
              type="button"
              onClick={() => onModeChange(option.mode)}
              className={[
                'h-7 rounded px-2 text-[11px] font-semibold transition-colors',
                mode === option.mode
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-secondary/25 hover:text-foreground',
              ].join(' ')}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Hide zone controls"
          onClick={() => onCollapsedChange(true)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-secondary/25 hover:text-foreground"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
      </div>

      {showRegionTools && (
        <div className="w-fit max-w-[250px] rounded-md border border-border bg-card/95 p-2 text-xs text-muted-foreground shadow-xl backdrop-blur">
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="truncate">
              {targetSpecies ? targetSpecies.split(',')[0] : `${species.length || 'No'} species visible`}
            </span>
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            <button
              type="button"
              onClick={drawingRegionPolygon ? onSaveRegionPolygon : onStartRegionPolygon}
              disabled={!canCreateRegion || creatingRegion || (drawingRegionPolygon && regionPolygonPointCount < 3)}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded border border-secondary/50 bg-secondary/10 px-2 text-[11px] font-semibold text-foreground hover:bg-secondary/20 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <PencilRuler className="h-3.5 w-3.5" />
              {drawingRegionPolygon
                ? `Save polygon (${regionPolygonPointCount})`
                : hasRegionPolygon
                  ? 'Redraw region polygon'
                  : 'Draw region polygon'}
            </button>

            {drawingRegionPolygon ? (
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={onUndoRegionPolygon}
                  disabled={regionPolygonPointCount === 0}
                  className="inline-flex h-7 items-center justify-center rounded border border-border/60 px-2 text-[11px] font-semibold text-foreground hover:bg-secondary/20 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Undo point
                </button>
                <button
                  type="button"
                  onClick={onCancelRegionPolygon}
                  className="inline-flex h-7 items-center justify-center rounded border border-border/60 px-2 text-[11px] font-semibold text-muted-foreground hover:bg-secondary/20 hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onCreateRegion}
                disabled={!canCreateRegion || creatingRegion}
                className="inline-flex h-7 items-center justify-center gap-1.5 rounded border border-border/60 px-2 text-[11px] font-semibold text-foreground hover:bg-secondary/20 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <PencilRuler className="h-3.5 w-3.5" />
                {creatingRegion ? 'Opening' : hasRegionZone ? 'Edit region circle' : 'Add quick circle'}
              </button>
            )}
          </div>

          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/85">
            {drawingRegionPolygon
              ? 'Click the map to place boundary points, then save when the forest outline feels right.'
              : 'Polygon is the preferred region shape. Circle stays available as a faster fallback.'}
          </p>
        </div>
      )}

      {showLocalTools && (
        <div className="w-fit max-w-[250px] rounded-md border border-border bg-card/95 p-2 text-xs text-muted-foreground shadow-xl backdrop-blur">
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="truncate">
              {localTargetFind
                ? `${localTargetFind.species_name.split(',')[0]} / ${localTargetFind.date_found}`
                : 'Pick a find or pin'}
            </span>
          </div>

          {localTargetFind ? (
            <div className="mt-2 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={onStartLocalPolygon}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded border border-secondary/50 bg-secondary/10 px-2 text-[11px] font-semibold text-foreground hover:bg-secondary/20"
              >
                <PencilRuler className="h-3.5 w-3.5" />
                {hasLocalPolygon ? 'Edit local polygon' : 'Draw local polygon'}
              </button>
              <button
                type="button"
                onClick={onCreateLocalCircle}
                className="inline-flex h-7 items-center justify-center gap-1.5 rounded border border-border/60 px-2 text-[11px] font-semibold text-foreground hover:bg-secondary/20"
              >
                <PencilRuler className="h-3.5 w-3.5" />
                {hasLocalCircle ? 'Edit local circle' : 'Add quick circle'}
              </button>
            </div>
          ) : (
            <div className="mt-2 rounded-md border border-border/60 bg-secondary/10 px-2 py-2 text-[10px] leading-relaxed text-muted-foreground/85">
              Open a mushroom pin popup and choose `Pick this find`, then the local zone actions will appear here.
            </div>
          )}
        </div>
      )}
      </>
      )}
      </>
      )}
    </DraggablePanel>
  );
}
