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
import type { Find } from '@/lib/finds';

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
  const storagePath = useAppStore((s) => s.storagePath);
  const updateMutation = useUpdateFind();
  const [speciesFolders, setSpeciesFolders] = useState<string[]>([]);

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

  // Load species folders when dialog opens
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
          <DialogTitle>Edit Find</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Species</label>
            <Input
              value={form.species_name}
              onChange={(e) => handleChange('species_name', e.target.value)}
              placeholder="Species name"
            />
            {/* Autocomplete from existing folders */}
            {filteredFolders.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {filteredFolders.slice(0, 6).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => handleChange('species_name', f)}
                    className="text-xs px-2 py-0.5 rounded bg-muted border hover:bg-accent transition-colors"
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">Date found</label>
            <Input
              type="date"
              value={form.date_found}
              onChange={(e) => handleChange('date_found', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium">Country</label>
              <Input
                value={form.country}
                onChange={(e) => handleChange('country', e.target.value)}
                placeholder="Country"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Region</label>
              <Input
                value={form.region}
                onChange={(e) => handleChange('region', e.target.value)}
                placeholder="Region"
              />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium">Location mark</label>
              <Input
                value={form.location_note}
                onChange={(e) => handleChange('location_note', e.target.value)}
                placeholder="e.g. near the old oak"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium">Latitude</label>
              <Input
                type="number"
                value={form.lat}
                onChange={(e) => handleChange('lat', e.target.value)}
                placeholder="e.g. 45.1234"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Longitude</label>
              <Input
                type="number"
                value={form.lng}
                onChange={(e) => handleChange('lng', e.target.value)}
                placeholder="e.g. 13.9876"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Notes</label>
            <Textarea
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Notes"
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
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
