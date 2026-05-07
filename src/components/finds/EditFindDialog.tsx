import { useEffect, useState } from 'react';
import { renderSpeciesName } from '@/lib/speciesName';
import { readDir } from '@tauri-apps/plugin-fs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUpdateFind } from '@/hooks/useFinds';
import { useAppStore } from '@/stores/appStore';
import { useT } from '@/i18n/index';
import { openFindFolder, type Find } from '@/lib/finds';
import { reverseGeocode } from '@/lib/geocoding';
import { LocationPickerMap } from '@/components/map/LocationPickerMap';
import { FolderOpen, Info, MapPin } from 'lucide-react';
import { isInternalLibraryName } from '@/lib/internalEntries';

interface FormState {
  species_name: string;
  date_found: string;
  country: string;
  region: string;
  location_note: string;
  lat: string;
  lng: string;
  notes: string;
  observed_count_range: string;
}

function formatObservedRange(min: number | null, max: number | null, fallback: number | null): string {
  const low = min ?? fallback;
  const high = max ?? min ?? fallback;
  if (low == null && high == null) return '';
  if (low === high) return String(low);
  return `${Math.min(low!, high!)}-${Math.max(low!, high!)}`;
}

function parseObservedRangeInput(value: string) {
  const trimmed = value.trim();
  if (trimmed === '') return { min: null as number | null, max: null as number | null, representative: null as number | null };

  const match = trimmed.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
  if (!match) return { min: null, max: null, representative: null };

  const first = Number.parseInt(match[1], 10);
  const second = match[2] ? Number.parseInt(match[2], 10) : first;
  const min = Math.min(first, second);
  const max = Math.max(first, second);
  return { min, max, representative: Math.round((min + max) / 2) };
}

function isObservedRangeInputValid(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === '' || /^(\d+)(?:\s*-\s*(\d+))?$/.test(trimmed);
}

function findToFormState(find: Find): FormState {
  return {
    species_name: find.species_name ?? '',
    date_found: find.date_found ?? '',
    country: find.country ?? '',
    region: find.region ?? '',
    location_note: find.location_note ?? '',
    lat: find.lat !== null ? String(find.lat) : '',
    lng: find.lng !== null ? String(find.lng) : '',
    notes: find.notes ?? '',
    observed_count_range: formatObservedRange(
      find.observed_count_min,
      find.observed_count_max,
      find.observed_count,
    ),
  };
}

interface EditFindDialogProps {
  find: Find | null;
  onOpenChange: (open: boolean) => void;
}

export function EditFindDialog({ find, onOpenChange }: EditFindDialogProps) {
  const t = useT();
  const storagePath = useAppStore((s) => s.storagePath);
  const updateMutation = useUpdateFind();
  const [speciesFolders, setSpeciesFolders] = useState<string[]>([]);
  const [folderHighlight, setFolderHighlight] = useState(0);
  const [openingFolder, setOpeningFolder] = useState(false);
  const [folderOpenError, setFolderOpenError] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [speciesSelection, setSpeciesSelection] = useState<{ start: number; end: number } | null>(null);
  const [form, setForm] = useState<FormState>({
    species_name: '',
    date_found: '',
    country: '',
    region: '',
    location_note: '',
    lat: '',
    lng: '',
    notes: '',
    observed_count_range: '',
  });

  useEffect(() => {
    if (find) setForm(findToFormState(find));
  }, [find]);

  useEffect(() => {
    if (!find || !storagePath) return;
    readDir(storagePath)
      .then((entries) => {
        setSpeciesFolders(
          entries
            .filter((e) => e.isDirectory && e.name && !isInternalLibraryName(e.name))
            .map((e) => e.name as string),
        );
      })
      .catch(() => setSpeciesFolders([]));
  }, [find, storagePath]);

  const filteredFolders = form.species_name
    ? speciesFolders.filter((f) => f.toLowerCase().includes(form.species_name.toLowerCase()))
    : [];

  function handleChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function applySpeciesWeight(weight: 'bold' | 'normal') {
    if (!speciesSelection) return;
    const { start, end } = speciesSelection;
    const val = form.species_name;
    const selected = val.slice(start, end);
    let next: string;
    const alreadyWrapped = val[start - 1] === '*' && val[end] === '*';
    if (weight === 'normal') {
      // Wrap in * if not already wrapped
      next = alreadyWrapped
        ? val
        : val.slice(0, start) + '*' + selected + '*' + val.slice(end);
    } else {
      // Remove * wrapping if present
      next = alreadyWrapped
        ? val.slice(0, start - 1) + selected + val.slice(end + 1)
        : val;
    }
    handleChange('species_name', next);
    setSpeciesSelection(null);
  }

  function handleSave() {
    if (!find) return;
    const observedRange = parseObservedRangeInput(form.observed_count_range);
    updateMutation.mutate(
      {
        id: find.id,
        species_name: form.species_name,
        date_found: form.date_found,
        country: form.country,
        region: form.region,
        location_note: form.location_note,
        lat: form.lat !== '' ? parseFloat(form.lat) : null,
        lng: form.lng !== '' ? parseFloat(form.lng) : null,
        notes: form.notes,
        observed_count: observedRange.representative,
        observed_count_min: observedRange.min,
        observed_count_max: observedRange.max,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  async function handleOpenFolder(scope: 'species' | 'photo') {
    if (!find || !storagePath) return;
    setFolderOpenError(null);
    setOpeningFolder(true);
    try {
      await openFindFolder(storagePath, find.id, scope);
    } catch (error) {
      setFolderOpenError(String(error));
    } finally {
      setOpeningFolder(false);
    }
  }

  return (
    <Dialog open={find !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('edit.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="text-sm font-medium">{t('edit.species')}</label>
              <div className="flex items-center gap-1">
                {speciesSelection && (
                  <span className="text-[10px] text-muted-foreground/50">selected:</span>
                )}
                <button
                  type="button"
                  disabled={!speciesSelection}
                  onMouseDown={(e) => { e.preventDefault(); applySpeciesWeight('bold'); }}
                  className="inline-flex items-center justify-center h-6 w-6 rounded border border-border/60 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/8 hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
                  title="Mark selected as bold"
                >
                  <span className="font-serif font-bold">B</span>
                </button>
                <button
                  type="button"
                  disabled={!speciesSelection}
                  onMouseDown={(e) => { e.preventDefault(); applySpeciesWeight('normal'); }}
                  className="inline-flex items-center justify-center h-6 w-6 rounded border border-border/60 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/8 hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
                  title="Mark selected as normal weight"
                >
                  <span className="font-serif font-normal">N</span>
                </button>
              </div>
            </div>
            <div className="relative">
              <Input
                value={form.species_name}
                onChange={(e) => { handleChange('species_name', e.target.value); setFolderHighlight(0); setSpeciesSelection(null); }}
                placeholder={t('preview.speciesName')}
                onSelect={(e) => {
                  const input = e.currentTarget;
                  const start = input.selectionStart ?? 0;
                  const end = input.selectionEnd ?? 0;
                  setSpeciesSelection(start !== end ? { start, end } : null);
                }}
                onBlur={() => setSpeciesSelection(null)}
                onKeyDown={(e) => {
                  const visible = filteredFolders.slice(0, 8);
                  if (visible.length === 0) return;
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setFolderHighlight((h) => Math.min(h + 1, visible.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setFolderHighlight((h) => Math.max(h - 1, 0));
                  } else if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    handleChange('species_name', visible[folderHighlight]);
                    setFolderHighlight(0);
                  } else if (e.key === 'Escape') {
                    setFolderHighlight(0);
                    handleChange('species_name', '');
                  }
                }}
              />
              {filteredFolders.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                  {filteredFolders.slice(0, 8).map((f, i) => (
                    <button
                      key={f}
                      type="button"
                      className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${i === folderHighlight ? 'bg-accent' : 'hover:bg-accent'}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleChange('species_name', f);
                        setFolderHighlight(0);
                      }}
                      onMouseEnter={() => setFolderHighlight(i)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {form.species_name.includes('*') && (
              <p className="mt-1.5 font-serif text-sm font-semibold text-foreground/80 px-0.5">
                {renderSpeciesName(form.species_name)}
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">{t('edit.date')}</label>
            <Input
              type="date"
              value={form.date_found}
              onChange={(e) => handleChange('date_found', e.target.value)}
              className="text-foreground [color-scheme:light]"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium">{t('edit.country')}</label>
              <Input
                value={form.country}
                onChange={(e) => handleChange('country', e.target.value)}
                placeholder={t('edit.country')}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('edit.region')}</label>
              <Input
                value={form.region}
                onChange={(e) => handleChange('region', e.target.value)}
                placeholder={t('edit.region')}
              />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium">{t('edit.locationMark')}</label>
              <Input
                value={form.location_note}
                onChange={(e) => handleChange('location_note', e.target.value)}
                placeholder={t('edit.locationMarkPlaceholder')}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium">{t('edit.lat')}</label>
              <Input
                type="number"
                value={form.lat}
                onChange={(e) => handleChange('lat', e.target.value)}
                placeholder="e.g. 45.1234"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('edit.lng')}</label>
              <Input
                type="number"
                value={form.lng}
                onChange={(e) => handleChange('lng', e.target.value)}
                placeholder="e.g. 13.9876"
              />
            </div>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPickerOpen(true)}
                className="flex items-center gap-1"
              >
                <MapPin className="h-4 w-4" />
                Pick on map
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleOpenFolder('species')}
                disabled={!storagePath || openingFolder}
                className="flex items-center gap-1"
              >
                <FolderOpen className="h-4 w-4" />
                {openingFolder ? 'Opening folder…' : 'Open species folder'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleOpenFolder('photo')}
                disabled={!storagePath || !find?.photos.length || openingFolder}
                className="flex items-center gap-1"
              >
                <FolderOpen className="h-4 w-4" />
                Open photo folder
              </Button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">{t('edit.notes')}</label>
            <Textarea
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder={t('edit.notes')}
              rows={3}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1 text-sm font-medium">
              <label>{t('edit.observedCount')}</label>
              <span
                className="text-muted-foreground"
                title={t('edit.observedCountHelp')}
                aria-label={t('edit.observedCountHelp')}
              >
                <Info className="h-3.5 w-3.5" />
              </span>
            </div>
            <Input
              inputMode="numeric"
              value={form.observed_count_range}
              onChange={(e) => handleChange('observed_count_range', e.target.value)}
              placeholder="npr. 15 ili 15-20"
            />
            {!isObservedRangeInputValid(form.observed_count_range) && (
              <p className="mt-1 text-xs text-amber-600">
                Unesi broj ili raspon poput 15-20. Ovakav unos neće se spremiti.
              </p>
            )}
          </div>
        </div>

        {updateMutation.isError && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{String(updateMutation.error)}</AlertDescription>
          </Alert>
        )}

        {folderOpenError && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{folderOpenError}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('edit.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? t('edit.saving') : t('edit.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
      <LocationPickerMap
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        initialLatLng={
          form.lat !== '' && form.lng !== ''
            ? { lat: parseFloat(form.lat), lng: parseFloat(form.lng) }
            : null
        }
        onConfirm={async (lat, lng) => {
          setForm((f) => ({ ...f, lat: String(lat), lng: String(lng) }));
          setPickerOpen(false);
          const lang = useAppStore.getState().language;
          const geo = await reverseGeocode(lat, lng, lang);
          if (geo.country || geo.region) {
            setForm((f) => ({
              ...f,
              country: geo.country || f.country,
              region: geo.region || f.region,
            }));
          }
        }}
      />
    </Dialog>
  );
}
