import { useEffect, useState, useMemo } from 'react';
import { SpeciesNameEditor } from './SpeciesNameEditor';
import { LocationNoteInput } from './LocationNoteInput';
import { readDir } from '@tauri-apps/plugin-fs';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
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
import { useUpdateFind, useAddFindPhotos, useDeleteFindPhoto, useBulkDeleteFindPhotos, useFinds } from '@/hooks/useFinds';
import { useAppStore } from '@/stores/appStore';
import { useT } from '@/i18n/index';
import { openFindFolder, SUPPORTED_EXTENSIONS, type Find } from '@/lib/finds';
import { resolvePhotoSrc } from '@/lib/photoSrc';
import { reverseGeocode } from '@/lib/geocoding';
import { LocationPickerMap } from '@/components/map/LocationPickerMap';
import { Check, FolderOpen, ImagePlus, Info, MapPin, Trash2, X } from 'lucide-react';
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
  const addPhotosMutation = useAddFindPhotos();
  const deletePhotoMutation = useDeleteFindPhoto();
  const bulkDeletePhotosMutation = useBulkDeleteFindPhotos();
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
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<number>>(new Set());
  const [pendingPhotos, setPendingPhotos] = useState<string[]>([]);
  const [speciesFolders, setSpeciesFolders] = useState<string[]>([]);
  const [openingFolder, setOpeningFolder] = useState(false);
  const [folderOpenError, setFolderOpenError] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
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
    setPendingPhotos([]);
    setSelectedPhotoIds(new Set());
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

  function handleChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
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

  async function handlePickPhotos() {
    const selected = await openDialog({
      multiple: true,
      filters: [{ name: 'Images', extensions: SUPPORTED_EXTENSIONS.map((ext) => ext.replace('.', '')) }],
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    setPendingPhotos(paths);
  }

  function handleAddPhotos() {
    if (!find || pendingPhotos.length === 0) return;
    addPhotosMutation.mutate(
      { findId: find.id, sourcePaths: pendingPhotos },
      {
        onSuccess: () => {
          setPendingPhotos([]);
        },
      },
    );
  }

  return (
    <Dialog open={find !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('edit.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">{t('edit.species')}</label>
            <SpeciesNameEditor
              value={form.species_name}
              onChange={(raw) => handleChange('species_name', raw)}
              placeholder={t('preview.speciesName')}
              suggestions={speciesFolders}
            />
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
              <LocationNoteInput
                value={form.location_note}
                onChange={(v) => handleChange('location_note', v)}
                suggestions={locationNoteSuggestions}
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
          {find && find.photos.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Photos ({find.photos.length})</label>
                {selectedPhotoIds.size > 0 && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      bulkDeletePhotosMutation.mutate(
                        { photoIds: [...selectedPhotoIds], deleteFiles: true },
                        { onSuccess: () => setSelectedPhotoIds(new Set()) },
                      );
                    }}
                    disabled={bulkDeletePhotosMutation.isPending}
                    className="h-7 gap-1 text-xs"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete {selectedPhotoIds.size} selected
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {find.photos.map((photo) => {
                  const selected = selectedPhotoIds.has(photo.id);
                  const src = resolvePhotoSrc(storagePath!, photo.photo_path);
                  return (
                    <div
                      key={photo.id}
                      className={`group relative rounded overflow-hidden border aspect-square cursor-pointer transition-colors ${
                        selected ? 'border-primary ring-1 ring-primary' : 'border-border/40 hover:border-primary/40'
                      }`}
                      onClick={() => {
                        setSelectedPhotoIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(photo.id)) next.delete(photo.id);
                          else next.add(photo.id);
                          return next;
                        });
                      }}
                    >
                      <img
                        src={src}
                        alt={photo.photo_path.split('/').pop()}
                        className="w-full h-full object-cover"
                      />
                      {photo.is_primary && (
                        <span className="absolute bottom-0 left-0 right-0 bg-primary/80 text-[9px] text-center text-primary-foreground font-medium py-0.5">
                          Primary
                        </span>
                      )}
                      {selectedPhotoIds.size === 0 && (
                        <button
                          type="button"
                          aria-label="Delete photo"
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePhotoMutation.mutate({ photoId: photo.id, deleteFile: true });
                          }}
                          className="absolute top-1 right-1 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-rose-600 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                      {selected && (
                        <div className="absolute top-1 right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-2.5 w-2.5 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2">
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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handlePickPhotos}
                className="flex items-center gap-1"
              >
                <ImagePlus className="h-4 w-4" />
                Add photos
              </Button>
            </div>
            {pendingPhotos.length > 0 && (
              <div className="rounded-md border border-border/60 bg-card/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {pendingPhotos.length} photo{pendingPhotos.length > 1 ? 's' : ''} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingPhotos([])}
                    className="text-muted-foreground/60 hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <ul className="text-xs text-muted-foreground/70 space-y-0.5 max-h-24 overflow-y-auto">
                  {pendingPhotos.map((p) => (
                    <li key={p} className="truncate">{p.split(/[\\/]/).pop()}</li>
                  ))}
                </ul>
                <Button
                  size="sm"
                  onClick={handleAddPhotos}
                  disabled={addPhotosMutation.isPending}
                  className="w-full"
                >
                  {addPhotosMutation.isPending ? 'Adding…' : `Add ${pendingPhotos.length} photo${pendingPhotos.length > 1 ? 's' : ''}`}
                </Button>
              </div>
            )}
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

        {addPhotosMutation.isError && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{String(addPhotosMutation.error)}</AlertDescription>
          </Alert>
        )}

        {deletePhotoMutation.isError && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{String(deletePhotoMutation.error)}</AlertDescription>
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
