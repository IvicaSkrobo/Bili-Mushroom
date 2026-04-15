import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUpdateFind, useBulkRenameSpecies } from '@/hooks/useFinds';
import { useAppStore } from '@/stores/appStore';
import { reverseGeocode } from '@/lib/geocoding';
import { LocationPickerMap } from '@/components/map/LocationPickerMap';
import { MapPin } from 'lucide-react';
import type { Find } from '@/lib/finds';

interface FolderEditDialogProps {
  speciesName: string | null; // null = closed
  finds: Find[];
  onOpenChange: (open: boolean) => void;
}

export function FolderEditDialog({ speciesName, finds, onOpenChange }: FolderEditDialogProps) {
  const storagePath = useAppStore((s) => s.storagePath);
  const lang = useAppStore((s) => s.language);
  const updateFind = useUpdateFind();
  const bulkRename = useBulkRenameSpecies();

  const [speciesNameInput, setSpeciesNameInput] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state when dialog opens
  useEffect(() => {
    if (speciesName !== null) {
      setSpeciesNameInput(speciesName);
      setCountry('');
      setRegion('');
      setOverwriteExisting(false);
      setError(null);
    }
  }, [speciesName]);

  async function handleSave() {
    if (!storagePath || speciesName === null) return;
    setSaving(true);
    setError(null);
    try {
      // Step 1: Rename species if changed
      if (speciesNameInput.trim() !== speciesName && speciesNameInput.trim() !== '') {
        await new Promise<void>((resolve, reject) => {
          bulkRename.mutate(
            { findIds: finds.map((f) => f.id), newSpeciesName: speciesNameInput.trim() },
            { onSuccess: () => resolve(), onError: (e) => reject(e) },
          );
        });
      }

      // Step 2: Update country/region on individual finds
      if (country || region) {
        const updates = finds.filter((f) => {
          if (overwriteExisting) return true;
          // Skip finds that already have both country and region filled
          const needsCountry = country && !f.country;
          const needsRegion = region && !f.region;
          // Apply if any targeted field is empty
          return needsCountry || needsRegion;
        });

        await Promise.all(
          updates.map((f) =>
            updateFind.mutateAsync({
              id: f.id,
              species_name: speciesNameInput.trim() || f.species_name,
              date_found: f.date_found,
              country: country ? (overwriteExisting ? country : country || f.country) : f.country,
              region: region ? (overwriteExisting ? region : region || f.region) : f.region,
              location_note: f.location_note,
              lat: f.lat,
              lng: f.lng,
              notes: f.notes,
            }),
          ),
        );
      }

      onOpenChange(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={speciesName !== null} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Folder</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Species name</label>
              <Input
                value={speciesNameInput}
                onChange={(e) => setSpeciesNameInput(e.target.value)}
                placeholder="Species name"
              />
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

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium">Country</label>
                <Input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Country"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Region</label>
                <Input
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="Region"
                />
              </div>
            </div>

            {(country || region) && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="overwrite-existing"
                  checked={overwriteExisting}
                  onChange={(e) => setOverwriteExisting(e.target.checked)}
                  className="h-4 w-4 rounded border border-border bg-input accent-primary cursor-pointer"
                />
                <label
                  htmlFor="overwrite-existing"
                  className="text-sm text-muted-foreground cursor-pointer select-none"
                >
                  Overwrite existing country/region fields
                </label>
              </div>
            )}

            {(country || region) && !overwriteExisting && (
              <p className="text-xs text-muted-foreground/70">
                Will only fill empty fields. Enable overwrite to apply to all {finds.length} finds.
              </p>
            )}
          </div>

          {error && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LocationPickerMap
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        initialLatLng={null}
        onConfirm={async (lat, lng) => {
          setPickerOpen(false);
          const geo = await reverseGeocode(lat, lng, lang);
          if (geo.country) setCountry(geo.country);
          if (geo.region) setRegion(geo.region);
        }}
      />
    </>
  );
}
