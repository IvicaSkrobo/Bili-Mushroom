import { useEffect, useState, useMemo, useRef } from 'react';
import { SpeciesNameEditor } from './SpeciesNameEditor';
import { LocationNoteInput } from './LocationNoteInput';
import { readDir } from '@tauri-apps/plugin-fs';
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
import { DateInput } from '@/components/ui/date-input';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCreateFind, useFinds, useSpeciesProfiles, useUpsertSpeciesProfile } from '@/hooks/useFinds';
import { useAppStore } from '@/stores/appStore';
import { useT } from '@/i18n/index';
import { reverseGeocode } from '@/lib/geocoding';
import { LocationPickerMap } from '@/components/map/LocationPickerMap';
import { PickLocationButton } from '@/components/map/PickLocationButton';
import { isInternalLibraryName } from '@/lib/internalEntries';
import { plainSpeciesName } from '@/lib/speciesName';

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

const BLANK_FORM: FormState = {
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
};

const CREATE_FIND_DRAFT_KEY = 'bili:create-find-draft';

interface CreateFindDraft {
  form: FormState;
  commonNameManuallyEdited: boolean;
  lastAutoCommonName: string;
}

function loadCreateFindDraft(): CreateFindDraft | null {
  try {
    const raw = localStorage.getItem(CREATE_FIND_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CreateFindDraft>;
    if (!parsed.form || typeof parsed.form !== 'object') return null;
    return {
      form: { ...BLANK_FORM, ...parsed.form },
      commonNameManuallyEdited: Boolean(parsed.commonNameManuallyEdited),
      lastAutoCommonName: typeof parsed.lastAutoCommonName === 'string' ? parsed.lastAutoCommonName : '',
    };
  } catch {
    return null;
  }
}

function saveCreateFindDraft(draft: CreateFindDraft) {
  try {
    localStorage.setItem(CREATE_FIND_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Draft persistence is best-effort; the in-memory form still works.
  }
}

function clearCreateFindDraft() {
  try {
    localStorage.removeItem(CREATE_FIND_DRAFT_KEY);
  } catch {
    // Ignore unavailable localStorage.
  }
}

interface CreateFindDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateFindDialog({ open, onOpenChange }: CreateFindDialogProps) {
  const t = useT();
  const storagePath = useAppStore((s) => s.storagePath);
  const createMutation = useCreateFind();
  const upsertSpeciesProfile = useUpsertSpeciesProfile();
  const { data: findsData } = useFinds();
  const { data: speciesProfilesData } = useSpeciesProfiles();
  const [speciesFolders, setSpeciesFolders] = useState<string[]>([]);
  const lastAutoCommonNameRef = useRef<string>('');
  const speciesNameSet = useMemo(() => {
    const set = new Set<string>();
    for (const find of findsData ?? []) {
      if (find.species_name) set.add(find.species_name.toLowerCase());
    }
    return set;
  }, [findsData]);
  const speciesProfilesByLowerName = useMemo(() => {
    const map = new Map<string, NonNullable<typeof speciesProfilesData>[number]>();
    for (const profile of speciesProfilesData ?? []) {
      map.set(profile.species_name.toLowerCase(), profile);
      map.set(plainSpeciesName(profile.species_name).toLowerCase(), profile);
    }
    return map;
  }, [speciesProfilesData]);
  const knownCommonNames = useMemo(() => {
    const set = new Set<string>();
    for (const profile of speciesProfilesData ?? []) {
      if (profile.common_name) set.add(profile.common_name.trim().toLowerCase());
    }
    return set;
  }, [speciesProfilesData]);
  const speciesSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const values = [
      ...speciesFolders,
      ...(findsData ?? []).map((find) => find.species_name),
    ];
    return values.filter((value) => {
      const trimmed = value.trim();
      const key = trimmed.toLowerCase();
      if (!trimmed || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [findsData, speciesFolders]);

  const speciesSuggestionsProfiles = useMemo(() => {
    const map = new Map<string, { common_name?: string | null; synonyms?: string[] | null; other_names?: string[] | null }>();
    for (const profile of speciesProfilesData ?? []) {
      map.set(profile.species_name, {
        common_name: profile.common_name,
        synonyms: profile.synonyms,
        other_names: profile.other_names,
      });
    }
    return map;
  }, [speciesProfilesData]);

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => loadCreateFindDraft()?.form ?? BLANK_FORM);
  const commonNameManuallyEditedRef = useRef(false);

  useEffect(() => {
    const draft = loadCreateFindDraft();
    if (!draft) return;
    commonNameManuallyEditedRef.current = draft.commonNameManuallyEdited;
    lastAutoCommonNameRef.current = draft.lastAutoCommonName;
  }, []);

  useEffect(() => {
    const hasDraft = Object.values(form).some((value) => value.trim() !== '');
    if (!hasDraft) {
      clearCreateFindDraft();
      return;
    }
    saveCreateFindDraft({
      form,
      commonNameManuallyEdited: commonNameManuallyEditedRef.current,
      lastAutoCommonName: lastAutoCommonNameRef.current,
    });
  }, [form]);

  const speciesProfile = useMemo(
    () => speciesProfilesByLowerName.get(form.species_name.trim().toLowerCase()) ?? null,
    [speciesProfilesByLowerName, form.species_name],
  );

  useEffect(() => {
    const nextCommonName = speciesProfile?.common_name ?? '';
    setForm((prev) => {
      if (commonNameManuallyEditedRef.current) return prev;
      lastAutoCommonNameRef.current = nextCommonName;
      return { ...prev, common_name: nextCommonName };
    });
  }, [speciesProfile?.species_name, speciesProfile?.common_name]);

  useEffect(() => {
    if (!open && !form.species_name.trim()) {
      lastAutoCommonNameRef.current = '';
    }
  }, [open, form.species_name]);

  // Load species folder suggestions
  useEffect(() => {
    if (!open || !storagePath) return;
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
  }, [open, storagePath]);

  function handleChange(field: keyof FormState, value: string) {
    if (field === 'common_name') {
      const normalized = value.trim().toLowerCase();
      commonNameManuallyEditedRef.current = Boolean(
        normalized &&
        value !== lastAutoCommonNameRef.current &&
        !knownCommonNames.has(normalized),
      );
    }
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSave() {
    const observedRange = parseObservedRangeInput(form.observed_count_range);
    createMutation.mutate(
      {
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
        edibility_note: null,
      },
      {
        onSuccess: async () => {
          if (form.species_name.trim() && (form.common_name.trim() || form.species_description.trim())) {
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
              description: form.species_description.trim(),
            });
          }
          setForm(BLANK_FORM);
          commonNameManuallyEditedRef.current = false;
          lastAutoCommonNameRef.current = '';
          clearCreateFindDraft();
          onOpenChange(false);
        },
      },
    );
  }

  function handleCancel() {
    setForm(BLANK_FORM);
    commonNameManuallyEditedRef.current = false;
    lastAutoCommonNameRef.current = '';
    clearCreateFindDraft();
    onOpenChange(false);
  }

  const canSave = form.species_name.trim() !== '' && !createMutation.isPending;

  const isKnownSpecies = useMemo(() => {
    const name = form.species_name.trim().toLowerCase();
    if (!name) return false;
    return speciesNameSet.has(name) || speciesProfilesByLowerName.has(name);
  }, [form.species_name, speciesNameSet, speciesProfilesByLowerName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[82vh] !w-[min(1040px,calc(100vw-2rem))] !max-w-none flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-3">
          <DialogTitle>{t('create.title')}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground/80">
            Ručni unos nalaza bez fotografija.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
        <div className="space-y-3">
          <div className="grid gap-2">
            <div>
              <SpeciesNameEditor
                value={form.species_name}
                onChange={(raw) => handleChange('species_name', raw)}
                placeholder={t('edit.latinNamePlaceholder')}
                suggestions={speciesSuggestions}
                suggestionsProfiles={speciesSuggestionsProfiles}
                label={t('edit.latinName')}
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
            <PickLocationButton
              hasLocation={form.lat !== '' && form.lng !== ''}
              lat={form.lat !== '' ? parseFloat(form.lat) : null}
              lng={form.lng !== '' ? parseFloat(form.lng) : null}
              onClick={() => setPickerOpen(true)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('edit.date')}</label>
            <DateInput
              className="ml-2 align-middle"
              value={form.date_found}
              onChange={(value) => handleChange('date_found', value)}
              aria-label={t('edit.date')}
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
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,220px)_1fr_1fr]">
          <div>
            <div className="mb-1 flex items-center gap-1 text-sm font-medium">
              <label>{t('edit.observedCount')}</label>
              <InfoTooltip text={t('edit.observedCountHelp')} />
            </div>
            <Input
              inputMode="numeric"
              value={form.observed_count_range}
              onChange={(e) => handleChange('observed_count_range', e.target.value)}
              placeholder="npr. 15 ili 15-20"
            />
            {!isObservedRangeInputValid(form.observed_count_range) && (
              <p className="mt-1 text-xs text-amber-600">
                Unesi broj ili raspon poput 15-20. Ovakav unos nece se spremiti.
              </p>
            )}
          </div>
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
              placeholder={speciesProfile?.description ?? speciesProfile?.edibility_note ?? t('edit.speciesDescriptionPlaceholder')}
              rows={3}
            />
            <p className="mt-1 text-xs text-muted-foreground">{t('edit.speciesDescriptionHelp')}</p>
          </div>

        </div>
        </div>

        {createMutation.isError && (
          <Alert variant="destructive" role="alert" className="mx-5 mt-1">
            <AlertDescription>{String(createMutation.error)}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="border-t border-border/60 px-5 py-4">
          <Button variant="outline" onClick={handleCancel}>
            {t('edit.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {createMutation.isPending ? t('edit.saving') : t('create.save')}
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
