import { useEffect, useRef, useState, useMemo } from 'react';
import { SpeciesNameEditor } from './SpeciesNameEditor';
import { LocationNoteInput } from './LocationNoteInput';
import { readDir } from '@tauri-apps/plugin-fs';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUpdateFind, useAddFindPhotos, useDeleteFindPhoto, useBulkDeleteFindPhotos, useFinds, useSpeciesProfiles, useUpsertSpeciesProfile } from '@/hooks/useFinds';
import { useAppStore } from '@/stores/appStore';
import { useT } from '@/i18n/index';
import { openFindFolder, SUPPORTED_EXTENSIONS, type Find } from '@/lib/finds';
import { resolvePhotoSrc } from '@/lib/photoSrc';
import { reverseGeocode } from '@/lib/geocoding';
import { LocationPickerMap } from '@/components/map/LocationPickerMap';
import { PickLocationButton } from '@/components/map/PickLocationButton';
import { SpeciesMetadataBadges } from '@/components/species/SpeciesMetadataBadges';
import { Check, FolderOpen, ImagePlus, Info, Trash2, X } from 'lucide-react';
import { isInternalLibraryName } from '@/lib/internalEntries';

interface FormState {
  species_name: string;
  common_name: string;
  date_found: string;
  country: string;
  region: string;
  location_note: string;
  lat: string;
  lng: string;
  notes: string;
  observed_count_range: string;
  species_description: string;
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
    common_name: '',
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
    species_description: '',
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
  const upsertSpeciesProfile = useUpsertSpeciesProfile();
  const addPhotosMutation = useAddFindPhotos();
  const deletePhotoMutation = useDeleteFindPhoto();
  const bulkDeletePhotosMutation = useBulkDeleteFindPhotos();
  const { data: findsData } = useFinds();
  const { data: speciesProfiles } = useSpeciesProfiles();
  const speciesProfilesByName = useMemo(() => {
    const map = new Map<string, NonNullable<typeof speciesProfiles>[number]>();
    for (const profile of speciesProfiles ?? []) {
      map.set(profile.species_name, profile);
    }
    return map;
  }, [speciesProfiles]);

  // Always reflect the live cache — photo deletions/additions update immediately
  // without waiting for the parent's `find` prop to re-capture the new snapshot.
  const livePhotos = useMemo(() => {
    if (!find) return [];
    const live = findsData?.find(f => f.id === find.id);
    return live?.photos ?? find.photos;
  }, [findsData, find]);

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

  const speciesSuggestionsProfiles = useMemo(() => {
    const map = new Map<string, { common_name?: string | null; synonyms?: string[] | null; other_names?: string[] | null }>();
    for (const profile of speciesProfiles ?? []) {
      map.set(profile.species_name, {
        common_name: profile.common_name,
        synonyms: profile.synonyms,
        other_names: profile.other_names,
      });
    }
    return map;
  }, [speciesProfiles]);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<number>>(new Set());
  const [pendingPhotos, setPendingPhotos] = useState<string[]>([]);
  const [speciesFolders, setSpeciesFolders] = useState<string[]>([]);
  const [openingFolder, setOpeningFolder] = useState(false);
  const [folderOpenError, setFolderOpenError] = useState<string | null>(null);
  const [photosExpanded, setPhotosExpanded] = useState(false);
  const [permanentPhotoDelete, setPermanentPhotoDelete] = useState(true);
  const prevFindIdRef = useRef<number | null>(null);
  const lastAutoCommonNameRef = useRef<string>('');

  const [pickerOpen, setPickerOpen] = useState(false);
  const [form, setForm] = useState<FormState>({
    species_name: '',
    common_name: '',
    date_found: '',
    country: '',
    region: '',
    location_note: '',
    lat: '',
    lng: '',
    notes: '',
    observed_count_range: '',
    species_description: '',
  });
  const speciesProfile = useMemo(
    () => speciesProfilesByName.get(form.species_name) ?? null,
    [speciesProfilesByName, form.species_name],
  );

  useEffect(() => {
    if (find) {
      setForm(findToFormState(find));
      lastAutoCommonNameRef.current = '';
      if (find.id !== prevFindIdRef.current) {
        setPermanentPhotoDelete(true);
        prevFindIdRef.current = find.id;
      }
    }
    setPendingPhotos([]);
    setSelectedPhotoIds(new Set());
    setPhotosExpanded(false);
  }, [find]);

  useEffect(() => {
    if (!find) return;
    const nextCommonName = speciesProfile?.common_name ?? '';
    setForm((prev) => {
      const userEditedCommonName = prev.common_name.trim() && prev.common_name !== lastAutoCommonNameRef.current;
      if (userEditedCommonName) {
        return {
          ...prev,
          species_description: speciesProfile?.description ?? speciesProfile?.edibility_note ?? '',
        };
      }
      lastAutoCommonNameRef.current = nextCommonName;
      return {
        ...prev,
        common_name: nextCommonName,
        species_description: speciesProfile?.description ?? speciesProfile?.edibility_note ?? '',
      };
    });
  }, [find, speciesProfile?.species_name, speciesProfile?.common_name, speciesProfile?.description, speciesProfile?.edibility_note]);

  useEffect(() => {
    if (!find || !storagePath) return;
    readDir(storagePath)
      .then(async (entries) => {
        const dirs = entries.filter((e) => e.isDirectory && e.name && !isInternalLibraryName(e.name));
        const nonEmptyDirs = await Promise.all(
          dirs.map(async (entry) => {
            try {
              const children = await readDir(`${storagePath}\\${entry.name}`);
              return children.length > 0 ? entry.name as string : null;
            } catch {
              return entry.name as string;
            }
          }),
        );
        setSpeciesFolders(nonEmptyDirs.filter((name): name is string => Boolean(name)));
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
        common_name: form.common_name.trim() || null,
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
        edibility_note: find.edibility_note ?? null,
      },
      {
        onSuccess: async () => {
          if (form.species_name.trim()) {
            await upsertSpeciesProfile.mutateAsync({
              speciesName: form.species_name.trim(),
              commonName: form.common_name.trim() || (speciesProfile?.common_name ?? null),
              coverPhotoId: speciesProfile?.cover_photo_id ?? null,
              tags: speciesProfile?.tags ?? [],
              edibility: speciesProfile?.edibility ?? null,
              threatStatus: speciesProfile?.threat_status ?? null,
              distribution: speciesProfile?.distribution ?? null,
              edibilityNote: speciesProfile?.edibility_note ?? null,
              synonyms: speciesProfile?.synonyms ?? [],
              otherNames: speciesProfile?.other_names ?? [],
              fruitingBodyCountOverride: speciesProfile?.fruiting_body_count_override ?? null,
              description: form.species_description.trim() || null,
            });
          }
          onOpenChange(false);
        },
      },
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
      <DialogContent className="flex max-h-[82vh] !w-[min(1180px,calc(100vw-2rem))] !max-w-none flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-3">
          <DialogTitle>{t('edit.title')}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground/80">
            Uredi podatke nalaza, upravljaj fotografijama i lokacijom.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
        <div className="space-y-3">
          <div className="grid gap-2">
            <div>
              <label className="text-sm font-medium">{t('edit.latinName')}</label>
              <SpeciesNameEditor
                value={form.species_name}
                onChange={(raw) => handleChange('species_name', raw)}
                placeholder={t('edit.latinNamePlaceholder')}
                suggestions={[
                  ...speciesFolders,
                  ...(findsData?.map((f) => f.species_name).filter(Boolean) ?? []),
                  ...(speciesProfiles?.map((p) => p.species_name) ?? []),
                ].filter((v, i, a) => v.trim() && a.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i)}
                suggestionsProfiles={speciesSuggestionsProfiles}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('edit.commonName')}</label>
              <Input
                value={form.common_name}
                onChange={(e) => handleChange('common_name', e.target.value)}
                placeholder={t('edit.commonNamePlaceholder')}
              />
            </div>
            <div className="flex items-center gap-3">
              <PickLocationButton
                hasLocation={form.lat !== '' && form.lng !== ''}
                lat={form.lat !== '' ? parseFloat(form.lat) : null}
                lng={form.lng !== '' ? parseFloat(form.lng) : null}
                onClick={() => setPickerOpen(true)}
              />
            </div>
            <div className="mt-1.5">
              <SpeciesMetadataBadges speciesProfile={speciesProfile} size="sm" hideUnknown={false} />
            </div>
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
          <div className="space-y-2">
            <div className="rounded-md border border-border/60 bg-card/35 p-3 space-y-3">
              <div>
                  <p className="text-sm font-medium text-foreground">{t('edit.photoActionsTitle')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('edit.photoActionsDescription')}
                  </p>
              </div>
              <div className="grid gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePickPhotos}
                  className="justify-start gap-2 h-10 px-3 text-left"
                >
                  <ImagePlus className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 truncate">{t('edit.addPhotos')}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenFolder('photo')}
                  disabled={!storagePath || !find?.photos.length || openingFolder}
                  className="justify-start gap-2 h-10 px-3 text-left"
                >
                  <FolderOpen className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 truncate">{t('edit.openCurrentPhotoFolder')}</span>
                </Button>
              </div>
            </div>
            {pendingPhotos.length > 0 && (
              <div className="rounded-md border border-border/60 bg-card/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t('edit.photosSelected', { count: pendingPhotos.length, suffix: pendingPhotos.length === 1 ? '' : 's' })}
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
                  {addPhotosMutation.isPending
                    ? t('edit.addingPhotos')
                    : t('edit.addSelectedPhotos', {
                      count: pendingPhotos.length,
                      suffix: pendingPhotos.length === 1 ? '' : 's',
                    })}
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
            <label className="text-sm font-medium">{t('edit.speciesDescription')}</label>
            <Textarea
              value={form.species_description}
              onChange={(e) => handleChange('species_description', e.target.value)}
              placeholder={t('edit.speciesDescriptionPlaceholder')}
              rows={3}
            />
            <p className="mt-1 text-xs text-muted-foreground">{t('edit.speciesDescriptionHelp')}</p>
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
          {find && livePhotos.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium">{t('edit.photos')} ({livePhotos.length})</label>
                <div className="flex items-center gap-2">
                  {livePhotos.length > 5 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPhotosExpanded((prev) => !prev)}
                      className="h-7 px-2 text-xs"
                    >
                      {photosExpanded ? t('edit.collapsePhotos') : t('edit.expandPhotos')}
                    </Button>
                  )}
                  {selectedPhotoIds.size > 0 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        bulkDeletePhotosMutation.mutate(
                          { photoIds: [...selectedPhotoIds], deleteFiles: true, permanentDelete: permanentPhotoDelete },
                          { onSuccess: () => setSelectedPhotoIds(new Set()) },
                        );
                      }}
                      disabled={bulkDeletePhotosMutation.isPending}
                      className="h-7 gap-1 text-xs"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t('edit.deleteSelectedPhotos', { count: selectedPhotoIds.size })}
                    </Button>
                  )}
                </div>
              </div>
              <div className={`overflow-y-auto rounded-md border border-border/40 p-2 ${photosExpanded ? 'max-h-72' : 'max-h-44'}`}>
                <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-7 lg:grid-cols-9 xl:grid-cols-10">
                  {livePhotos.map((photo) => {
                    const selected = selectedPhotoIds.has(photo.id);
                    const src = resolvePhotoSrc(storagePath!, photo.photo_path);
                    return (
                      <div
                        key={photo.id}
                        className={`group relative aspect-square cursor-pointer overflow-hidden rounded border transition-colors ${
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
                          className="h-full w-full object-cover"
                        />
                        {photo.is_primary && (
                          <span className="absolute top-1 left-1 rounded bg-sky-600/75 px-1 py-0.5 text-[8px] font-semibold text-white/90 pointer-events-none">
                            ★
                          </span>
                        )}
                        {selectedPhotoIds.size === 0 && (
                          <button
                            type="button"
                            aria-label={t('edit.deletePhoto')}
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePhotoMutation.mutate({
                                photoId: photo.id,
                                deleteFile: true,
                                permanentDelete: permanentPhotoDelete,
                              });
                            }}
                            className="absolute top-1 right-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-rose-600 group-hover:flex"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                        {selected && (
                          <div className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                            <Check className="h-2.5 w-2.5 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
        </div>

        {updateMutation.isError && (
          <Alert variant="destructive" role="alert" className="mx-5 mt-1">
            <AlertDescription>{String(updateMutation.error)}</AlertDescription>
          </Alert>
        )}

        {addPhotosMutation.isError && (
          <Alert variant="destructive" role="alert" className="mx-5 mt-1">
            <AlertDescription>{String(addPhotosMutation.error)}</AlertDescription>
          </Alert>
        )}

        {deletePhotoMutation.isError && (
          <Alert variant="destructive" role="alert" className="mx-5 mt-1">
            <AlertDescription>{String(deletePhotoMutation.error)}</AlertDescription>
          </Alert>
        )}

        {folderOpenError && (
          <Alert variant="destructive" role="alert" className="mx-5 mt-1">
            <AlertDescription>{folderOpenError}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="w-full items-center justify-between border-t border-border/60 px-5 py-4 sm:justify-between">
          {find && livePhotos.length > 0 ? (
            <label className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground cursor-pointer select-none transition-colors hover:text-foreground">
              <input
                type="checkbox"
                checked={permanentPhotoDelete}
                onChange={(event) => setPermanentPhotoDelete(event.target.checked)}
                className="h-4 w-4 rounded accent-primary cursor-pointer"
              />
              {t('preview.deleteSource')}
            </label>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('edit.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? t('edit.saving') : t('edit.save')}
            </Button>
          </div>
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
