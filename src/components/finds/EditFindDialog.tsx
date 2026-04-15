import { useEffect, useState } from 'react';
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
import type { Find } from '@/lib/finds';
import { reverseGeocode } from '@/lib/geocoding';
import { LocationPickerMap } from '@/components/map/LocationPickerMap';
import { MapPin } from 'lucide-react';

interface FormState {
  species_name: string;
  date_found: string;
  country: string;
  region: string;
  location_note: string;
  lat: string;
  lng: string;
  notes: string;
}

function findToFormState(find: Find): FormState {
  return {
    species_name: find.species_name,
    date_found: find.date_found,
    country: find.country,
    region: find.region,
    location_note: find.location_note,
    lat: find.lat !== null ? String(find.lat) : '',
    lng: find.lng !== null ? String(find.lng) : '',
    notes: find.notes,
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
  });

  useEffect(() => {
    if (find) setForm(findToFormState(find));
  }, [find]);

  useEffect(() => {
    if (!find || !storagePath) return;
    readDir(storagePath)
      .then((entries) => {
        setSpeciesFolders(
          entries.filter((e) => e.isDirectory && e.name).map((e) => e.name as string),
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

  function handleSave() {
    if (!find) return;
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
      },
      { onSuccess: () => onOpenChange(false) },
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
            <div className="relative">
              <Input
                value={form.species_name}
                onChange={(e) => { handleChange('species_name', e.target.value); setFolderHighlight(0); }}
                placeholder={t('preview.speciesName')}
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
          </div>
          <div>
            <label className="text-sm font-medium">{t('edit.date')}</label>
            <Input
              type="date"
              value={form.date_found}
              onChange={(e) => handleChange('date_found', e.target.value)}
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
        </div>

        {updateMutation.isError && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{String(updateMutation.error)}</AlertDescription>
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
