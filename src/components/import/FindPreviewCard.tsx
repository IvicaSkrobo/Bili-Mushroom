import { useState } from 'react';
import { renderSpeciesName } from '@/lib/speciesName';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Image, Info, MapPin, X, Unlock, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LocationPickerMap } from '@/components/map/LocationPickerMap';
import { isHeic, type ImportPayload } from '@/lib/finds';
import { reverseGeocode } from '@/lib/geocoding';
import { useT } from '@/i18n/index';
import { useAppStore } from '@/stores/appStore';
import type { LockableField } from './ImportDialog';

const TRASH_HINT_KEY = 'bili_trash_hint_seen';

function isoToDisplay(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function displayToIso(display: string): string {
  const parts = display.split('/');
  if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  return display;
}

interface FindPreviewCardProps {
  payload: ImportPayload;
  sourcePath: string;
  locked: Partial<Record<LockableField, boolean>>;
  onChange: (updated: ImportPayload, lockField?: LockableField) => void;
  onUnlock: (field: LockableField) => void;
  onRemove: () => void;
}

export function FindPreviewCard({
  payload,
  sourcePath,
  locked,
  onChange,
  onUnlock,
  onRemove,
}: FindPreviewCardProps) {
  const t = useT();
  const lang = useAppStore((s) => s.language);
  const [mapOpen, setMapOpen] = useState(false);
  const [showTrashHint, setShowTrashHint] = useState(false);
  const [trashing, setTrashing] = useState(false);
  const [speciesSelection, setSpeciesSelection] = useState<{ start: number; end: number } | null>(null);

  function applySpeciesWeight(weight: 'bold' | 'normal') {
    if (!speciesSelection) return;
    const { start, end } = speciesSelection;
    const val = payload.species_name;
    const selected = val.slice(start, end);
    const alreadyWrapped = val[start - 1] === '*' && val[end] === '*';
    let next: string;
    if (weight === 'normal') {
      next = alreadyWrapped
        ? val
        : val.slice(0, start) + '*' + selected + '*' + val.slice(end);
    } else {
      next = alreadyWrapped
        ? val.slice(0, start - 1) + selected + val.slice(end + 1)
        : val;
    }
    onChange({ ...payload, species_name: next });
    setSpeciesSelection(null);
  }

  const updateLockable = <K extends LockableField>(key: K, value: string) => {
    const nextValue = key === 'observed_count'
      ? (() => {
          if (value.trim() === '') return null;
          const parsed = Number.parseInt(value, 10);
          return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
        })()
      : value;
    onChange({ ...payload, [key]: nextValue }, key);
  };

  const handleMapConfirm = async (lat: number, lng: number) => {
    onChange({ ...payload, lat, lng });
    const geo = await reverseGeocode(lat, lng, lang);
    if (geo.country || geo.region) {
      onChange({ ...payload, lat, lng, country: geo.country, region: geo.region }, 'country');
    }
  };

  const handleTrashClick = () => {
    const seen = localStorage.getItem(TRASH_HINT_KEY);
    if (!seen) {
      setShowTrashHint(true);
    } else {
      doTrash();
    }
  };

  const doTrash = async () => {
    setTrashing(true);
    try {
      await invoke('trash_source_file', { path: sourcePath });
    } catch {
      // If trash fails (e.g. read-only USB), still remove from list
    } finally {
      setTrashing(false);
      localStorage.setItem(TRASH_HINT_KEY, '1');
      setShowTrashHint(false);
      onRemove();
    }
  };

  const isHeicFile = isHeic(payload.original_filename);

    function LockableInput({
      field,
      ...inputProps
    }: { field: LockableField } & React.InputHTMLAttributes<HTMLInputElement>) {
      const isDate = field === 'date_found';
      const isObservedCount = field === 'observed_count';
      const rawValue = payload[field] as string;
      return (
        <div className="flex items-center gap-1">
          <Input
            {...inputProps}
            value={isObservedCount ? (payload.observed_count ?? '') : (isDate ? isoToDisplay(rawValue) : rawValue)}
            onChange={(e) => updateLockable(field, isDate ? displayToIso(e.target.value) : e.target.value)}
            className={locked[field] ? 'border-amber-400 focus-visible:ring-amber-400' : ''}
          />
        {locked[field] && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-amber-500 hover:text-amber-700"
            title="Allow shared header to override this field"
            onClick={() => onUnlock(field)}
          >
            <Unlock className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <Card className="relative">
        {/* Remove (X) and Delete source (trash) buttons */}
        <div className="absolute top-2 right-2 flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={handleTrashClick}
            disabled={trashing}
            aria-label={t('preview.deleteSource')}
            title={t('preview.deleteSource')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onRemove}
            aria-label={t('preview.remove')}
            title={t('preview.remove')}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <CardContent className="pt-4">
          {/* First-time trash hint */}
          {showTrashHint && (
            <Alert variant="destructive" className="mb-3">
              <AlertDescription className="text-xs">
                {t('preview.deleteSourceHint')}
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="destructive" onClick={doTrash} disabled={trashing}>
                    {t('delete.confirm')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowTrashHint(false)}>
                    {t('edit.cancel')}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-[auto_1fr] gap-4">
            {/* Thumbnail */}
            <div className="flex-shrink-0">
              {isHeicFile ? (
                <div className="h-24 w-24 flex flex-col items-center justify-center rounded bg-muted text-muted-foreground text-xs text-center p-1">
                  <Image className="h-8 w-8 mb-1" />
                  <span>HEIC preview not supported</span>
                </div>
              ) : (
                <img
                  src={convertFileSrc(sourcePath)}
                  alt={payload.original_filename}
                  className="h-24 w-24 object-cover rounded"
                />
              )}
            </div>

            {/* Fields */}
            <div className="grid grid-cols-2 gap-2 pr-16">
              <div className="col-span-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs text-muted-foreground">{t('preview.speciesName')}</span>
                  <button
                    type="button"
                    disabled={!speciesSelection}
                    onMouseDown={(e) => { e.preventDefault(); applySpeciesWeight('bold'); }}
                    className="inline-flex items-center justify-center h-5 w-5 rounded border border-border/60 text-[10px] text-muted-foreground hover:border-primary/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
                    title="Mark selected as bold"
                  >
                    <span className="font-serif font-bold leading-none">B</span>
                  </button>
                  <button
                    type="button"
                    disabled={!speciesSelection}
                    onMouseDown={(e) => { e.preventDefault(); applySpeciesWeight('normal'); }}
                    className="inline-flex items-center justify-center h-5 w-5 rounded border border-border/60 text-[10px] text-muted-foreground hover:border-primary/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
                    title="Mark selected as normal weight"
                  >
                    <span className="font-serif font-normal leading-none">N</span>
                  </button>
                </div>
                <Input
                  placeholder={t('preview.speciesName')}
                  value={payload.species_name}
                  onChange={(e) => { onChange({ ...payload, species_name: e.target.value }); setSpeciesSelection(null); }}
                  onSelect={(e) => {
                    const input = e.currentTarget;
                    const start = input.selectionStart ?? 0;
                    const end = input.selectionEnd ?? 0;
                    setSpeciesSelection(start !== end ? { start, end } : null);
                  }}
                  onBlur={() => setSpeciesSelection(null)}
                />
                {payload.species_name.includes('*') && (
                  <p className="mt-1 font-serif text-xs font-semibold text-foreground/80 px-0.5">
                    {renderSpeciesName(payload.species_name)}
                  </p>
                )}
              </div>

              <div>
                <LockableInput field="date_found" type="text" placeholder="DD/MM/YYYY" />
                {payload.date_found === '' && (
                  <p className="text-xs text-muted-foreground/60 mt-0.5">{t('preview.dateRequired')}</p>
                )}
              </div>

              <div>
                <LockableInput field="country" placeholder={t('preview.country')} />
              </div>

              <div>
                <LockableInput field="region" placeholder={t('preview.region')} />
              </div>

              <div>
                <LockableInput field="location_note" placeholder={t('preview.locationMark')} />
              </div>

              <div>
                <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{t('preview.observedCount')}</span>
                  <span
                    title={t('preview.observedCountHelp')}
                    aria-label={t('preview.observedCountHelp')}
                  >
                    <Info className="h-3.5 w-3.5" />
                  </span>
                </div>
                <LockableInput
                  field="observed_count"
                  type="number"
                  min="0"
                  step="1"
                  placeholder={t('preview.observedCountPlaceholder')}
                />
              </div>

              <div className="col-span-2 flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Pick on map"
                  onClick={() => setMapOpen(true)}
                  title="Pick on map"
                  className={payload.lat !== null && payload.lng !== null ? 'text-green-600 border-green-600' : ''}
                >
                  <MapPin className="h-4 w-4 mr-1" />
                  {payload.lat !== null && payload.lng !== null
                    ? `${payload.lat.toFixed(4)}, ${payload.lng.toFixed(4)}`
                    : t('preview.setLocation')}
                </Button>
              </div>

              <div className="col-span-2">
                <Textarea
                  placeholder={t('preview.notes')}
                  rows={2}
                  value={payload.notes}
                  onChange={(e) => onChange({ ...payload, notes: e.target.value })}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <LocationPickerMap
        open={mapOpen}
        onOpenChange={setMapOpen}
        initialLatLng={
          payload.lat !== null && payload.lng !== null
            ? { lat: payload.lat, lng: payload.lng }
            : null
        }
        onConfirm={handleMapConfirm}
        speciesFilter={payload.species_name || undefined}
      />
    </>
  );
}
