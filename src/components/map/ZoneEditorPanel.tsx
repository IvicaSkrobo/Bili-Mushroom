import { Crosshair, GripHorizontal, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Find } from '@/lib/finds';
import { formatRadius, parsePolygonJson, summarizeZone, type Zone } from '@/lib/zones';
import { useDeleteZone, useUpsertZone } from '@/hooks/useZones';
import { DraggablePanel } from './DraggablePanel';
import { plainSpeciesName, renderSpeciesName } from '@/lib/speciesName';
import { useT } from '@/i18n/index';
import { formatDisplayDate } from '@/lib/dateFormat';
import { useAppStore } from '@/stores/appStore';

interface ZoneEditorPanelProps {
  zone: Zone;
  finds: Find[];
  focusMode?: boolean;
  onStartPolygonEdit?: () => void;
  onClose: () => void;
  onZoneSaved: (zone: Zone) => void;
  onZoneTypeSelected: (zone: Zone, zoneType: Zone['zone_type']) => void;
  onZoomToZone: (zone: Zone, selectedType: Zone['zone_type']) => void;
}

export function ZoneEditorPanel({
  zone,
  finds,
  focusMode = false,
  onStartPolygonEdit,
  onClose,
  onZoneSaved,
  onZoneTypeSelected,
  onZoomToZone,
}: ZoneEditorPanelProps) {
  const t = useT();
  const lang = useAppStore((s) => s.language);
  const upsertZone = useUpsertZone();
  const deleteZone = useDeleteZone();
  const summary = useMemo(() => summarizeZone(zone, finds), [zone, finds]);
  const [radius, setRadius] = useState(String(Math.round(zone.radius_meters ?? 50)));
  const [notes, setNotes] = useState(zone.notes);
  const [name, setName] = useState(zone.name);
  const [saving, setSaving] = useState(false);
  const isLocal = zone.zone_type === 'local';
  const isPolygon = zone.geometry_type === 'polygon';
  const displaySpeciesName = useMemo(() => {
    const zonePlain = plainSpeciesName(zone.species_name).trim().toLowerCase();
    return finds.find((find) => plainSpeciesName(find.species_name).trim().toLowerCase() === zonePlain)?.species_name
      ?? zone.species_name;
  }, [finds, zone.species_name]);
  const polygonPoints = useMemo(() => parsePolygonJson(zone.polygon_json), [zone.polygon_json]);
  const accent = isLocal ? '#D4512A' : '#2D8C7C';
  const translucentAccent = isLocal ? 'rgba(212, 81, 42, 0.14)' : 'rgba(45, 140, 124, 0.14)';

  async function handleSave() {
    const parsedRadius = Number(radius);
    if (!isPolygon && (!Number.isFinite(parsedRadius) || parsedRadius <= 0)) return;
    setSaving(true);
    try {
      const savedZone = await upsertZone.mutateAsync({
        id: zone.id,
        species_name: zone.species_name,
        zone_type: zone.zone_type,
        name,
        geometry_type: zone.geometry_type,
        center_lat: zone.center_lat,
        center_lng: zone.center_lng,
        radius_meters: isPolygon ? null : parsedRadius,
        polygon_json: zone.polygon_json,
        source_find_id: zone.source_find_id,
        notes,
      });
      setRadius(String(Math.round(savedZone.radius_meters ?? parsedRadius)));
      setName(savedZone.name);
      setNotes(savedZone.notes);
      onZoneSaved(savedZone);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <DraggablePanel
      initialPosition={{ x: 12, y: 130 }}
      storageKey="bili-zone-editor-position-v2"
      className="absolute z-[1002]"
    >
      {({ dragHandleProps }) => (
        <div className="w-[min(318px,calc(100vw-24px))] rounded-md border border-border bg-card/95 p-2.5 font-sans text-foreground shadow-2xl backdrop-blur">
          <div
            className="mb-2 flex cursor-move items-center justify-between gap-2 rounded border border-border/60 bg-secondary/15 px-2 py-0.5"
            {...dragHandleProps}
          >
            <GripHorizontal className="h-4 w-4 text-muted-foreground" />
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{ backgroundColor: translucentAccent, color: accent, border: `1px solid ${accent}` }}
            >
              {isLocal ? t('zone.local') : t('zone.region')}
            </span>
            <button
              type="button"
              aria-label={t('zone.close')}
              onClick={onClose}
              className="rounded p-0.5 text-muted-foreground hover:bg-secondary/25 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            className="mb-2 h-1 rounded-full"
            style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }}
          />

          <div className="mb-1.5 min-w-0">
            <p className="font-serif text-sm italic text-foreground">
              {displaySpeciesName ? renderSpeciesName(displaySpeciesName) : (isLocal ? t('zone.localZone') : t('zone.regionZone'))}
            </p>
            {!isLocal && name.trim() && (
              <p className="mt-0.5 truncate text-xs font-semibold text-primary">
                {name.trim()}
              </p>
            )}
            <p className="truncate text-xs text-muted-foreground">
              {isPolygon ? `${polygonPoints.length} pt` : formatRadius(Number(radius))}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onZoomToZone(zone, zone.zone_type)}
            className="mb-1.5 inline-flex h-7 w-full items-center justify-center gap-1.5 rounded border px-2 text-[11px] font-semibold text-foreground hover:bg-secondary/20"
            style={{ borderColor: accent }}
          >
            <Crosshair className="h-3.5 w-3.5" />
            {isLocal ? t('zone.zoomLocal') : t('zone.zoomRegion')}
          </button>

          <div className="mb-1.5 rounded border border-border bg-input p-1">
            <div className="grid grid-cols-2 gap-1">
              {(['local', 'region'] as const).map((type) => {
                const active = zone.zone_type === type;
                const color = type === 'local' ? '#D4512A' : '#2D8C7C';
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => onZoneTypeSelected(zone, type)}
                    className="h-7 rounded text-[11px] font-bold uppercase tracking-[0.12em] transition-colors"
                    style={{
                      backgroundColor: active ? color : 'transparent',
                      color: active ? '#FFFFFF' : 'var(--muted-foreground)',
                    }}
                  >
                    {type === 'local' ? t('zone.local') : t('zone.region')}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-1.5 grid grid-cols-3 gap-1 text-[11px] text-muted-foreground">
            <ZoneStat label={t('zone.finds')} value={String(summary.finds.length)} />
            <ZoneStat label={t('zone.first')} value={summary.firstFound ? formatDisplayDate(summary.firstFound, lang) : '-'} />
            <ZoneStat label={t('zone.last')} value={summary.lastFound ? formatDisplayDate(summary.lastFound, lang) : '-'} />
          </div>

          <label className="mb-1.5 flex flex-col gap-1 text-[11px] text-muted-foreground">
            {isLocal ? t('zone.name') : 'Ime lokacije'}
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded border border-border bg-input px-2 py-1 text-xs text-foreground outline-none"
            />
          </label>

          {isPolygon ? (
            <div className="mb-1.5 rounded border border-border/60 bg-secondary/15 px-2 py-1.5 text-[11px] text-muted-foreground">
              <p className="font-semibold uppercase tracking-[0.12em] text-secondary">{t('zone.boundaryShape')}</p>
              <p className="mt-1 leading-relaxed">
                {t('zone.polygonPoints', { n: polygonPoints.length })}
              </p>
              <button
                type="button"
                onClick={onStartPolygonEdit}
                className="mt-2 rounded border border-border/60 px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-secondary/20"
              >
                {t('zone.adjustPoints')}
              </button>
            </div>
          ) : (
            <label className="mb-1.5 flex flex-col gap-1 text-[11px] text-muted-foreground">
              {t('zone.radius')}
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={radius}
                onChange={(event) => setRadius(event.target.value.replace(/[^\d.]/g, ''))}
                className="rounded border border-border bg-input px-2 py-1 text-xs text-foreground outline-none"
              />
            </label>
          )}

          <label className="mb-1.5 flex flex-col gap-1 text-[11px] text-muted-foreground">
            {t('zone.notes')}
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              className="resize-none rounded border border-border bg-input px-2 py-1 text-xs text-foreground outline-none"
            />
          </label>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              {saving ? t('zone.saving') : isPolygon ? t('zone.saveDetails') : t('zone.save')}
            </button>
            <button
              type="button"
              onClick={() => {
                deleteZone.mutate(zone.id);
                onClose();
              }}
              className="inline-flex items-center gap-1 rounded border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3 w-3" />
              {isLocal ? t('zone.deleteLocal') : t('zone.deleteRegion')}
            </button>
          </div>
        </div>
      )}
    </DraggablePanel>
  );
}

function ZoneStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border/60 bg-secondary/20 px-1.5 py-1">
      <p className="uppercase tracking-[0.12em] opacity-60">{label}</p>
      <p className="truncate font-mono text-foreground">{value}</p>
    </div>
  );
}
