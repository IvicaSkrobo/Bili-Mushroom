import { useEffect, useState } from 'react';
import { SpeciesNameEditor } from './SpeciesNameEditor';
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
import { useCreateFind } from '@/hooks/useFinds';
import { useAppStore } from '@/stores/appStore';
import { useT } from '@/i18n/index';
import { reverseGeocode } from '@/lib/geocoding';
import { LocationPickerMap } from '@/components/map/LocationPickerMap';
import { Info, MapPin } from 'lucide-react';
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
  date_found: '',
  country: '',
  region: '',
  location_note: '',
  lat: '',
  lng: '',
  notes: '',
  observed_count_range: '',
};

interface CreateFindDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateFindDialog({ open, onOpenChange }: CreateFindDialogProps) {
  const t = useT();
  const storagePath = useAppStore((s) => s.storagePath);
  const createMutation = useCreateFind();
  const [speciesFolders, setSpeciesFolders] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(BLANK_FORM);

  // Reset form to blank when dialog opens
  useEffect(() => {
    if (open) {
      setForm(BLANK_FORM);
    }
  }, [open]);

  // Load species folder suggestions
  useEffect(() => {
    if (!open || !storagePath) return;
    readDir(storagePath)
      .then((entries) => {
        setSpeciesFolders(
          entries
            .filter((e) => e.isDirectory && e.name && !isInternalLibraryName(e.name))
            .map((e) => e.name as string),
        );
      })
      .catch(() => setSpeciesFolders([]));
  }, [open, storagePath]);

  function handleChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSave() {
    const observedRange = parseObservedRangeInput(form.observed_count_range);
    createMutation.mutate(
      {
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

  const canSave = form.species_name.trim() !== '' && !createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('create.title')}</DialogTitle>
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

        {createMutation.isError && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{String(createMutation.error)}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
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
