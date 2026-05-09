import { useEffect, useState } from 'react';
import { SpeciesNameEditor } from './SpeciesNameEditor';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUpdateFind, useBulkRenameSpecies } from '@/hooks/useFinds';
import { useAppStore } from '@/stores/appStore';
import { openSpeciesFolder } from '@/lib/finds';
import { reverseGeocode } from '@/lib/geocoding';
import { LocationPickerMap } from '@/components/map/LocationPickerMap';
import { FolderOpen, MapPin } from 'lucide-react';
import type { Find, SpeciesProfile } from '@/lib/finds';
import {
  EDIBILITY_VALUES,
  EDIBILITY_LABELS,
  PROTECTED_STATUS_VALUES,
  PROTECTED_STATUS_LABELS,
} from '@/lib/speciesMetadata';

interface FolderEditDialogProps {
  speciesName: string | null; // null = closed
  finds: Find[];
  onOpenChange: (open: boolean) => void;
  speciesProfile?: SpeciesProfile | null;
  onSave?: (
    newName: string,
    edibility: string | null,
    protectedStatus: string | null,
  ) => void | Promise<void>;
}

export function FolderEditDialog({ speciesName, finds, onOpenChange, speciesProfile, onSave }: FolderEditDialogProps) {
  const storagePath = useAppStore((s) => s.storagePath);
  const lang = useAppStore((s) => s.language);
  const updateFind = useUpdateFind();
  const bulkRename = useBulkRenameSpecies();

  const [speciesNameInput, setSpeciesNameInput] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [pickedLat, setPickedLat] = useState<number | null>(null);
  const [pickedLng, setPickedLng] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openingFolder, setOpeningFolder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edibility, setEdibility] = useState<string>('unknown');
  const [protectedStatus, setProtectedStatus] = useState<string>('unknown');

  // Sync state when dialog opens
  useEffect(() => {
    if (speciesName !== null) {
      setSpeciesNameInput(speciesName);
      setCountry('');
      setRegion('');
      setOverwriteExisting(false);
      setPickedLat(null);
      setPickedLng(null);
      setError(null);
      setEdibility(speciesProfile?.edibility ?? 'unknown');
      setProtectedStatus(speciesProfile?.protected_status ?? 'unknown');
    }
  }, [speciesName, speciesProfile]);

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

      // Step 2: Update location fields (country, region, and/or lat/lng)
      const hasLocationUpdate = country || region || (pickedLat !== null && pickedLng !== null);
      if (hasLocationUpdate) {
        const updates = finds.filter((f) => {
          if (overwriteExisting) return true;
          const needsCountry = country && !f.country;
          const needsRegion = region && !f.region;
          const needsLatLng = pickedLat !== null && (f.lat === null || f.lng === null);
          return needsCountry || needsRegion || needsLatLng;
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
              lat: pickedLat !== null ? pickedLat : f.lat,
              lng: pickedLng !== null ? pickedLng : f.lng,
              notes: f.notes,
              observed_count: f.observed_count,
              observed_count_min: f.observed_count_min,
              observed_count_max: f.observed_count_max,
            }),
          ),
        );
      }

      await onSave?.(
        speciesNameInput.trim() || speciesName!,
        edibility === 'unknown' ? null : edibility,
        protectedStatus === 'unknown' ? null : protectedStatus,
      );
      onOpenChange(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleOpenFolder() {
    if (!storagePath || speciesName === null) return;
    setError(null);
    setOpeningFolder(true);
    try {
      await openSpeciesFolder(storagePath, speciesNameInput.trim() || speciesName);
    } catch (e) {
      setError(String(e));
    } finally {
      setOpeningFolder(false);
    }
  }

  return (
    <>
      <Dialog open={speciesName !== null} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Folder</DialogTitle>
            <DialogDescription>
              Update species-level details, location defaults, and status metadata for this folder.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="text-sm font-medium">Species name</label>
              </div>
              <SpeciesNameEditor
                value={speciesNameInput}
                onChange={setSpeciesNameInput}
                placeholder="Species name"
              />
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
                  {pickedLat !== null ? 'Change location' : 'Pick on map'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenFolder}
                  disabled={!storagePath || openingFolder}
                  className="flex items-center gap-1"
                >
                  <FolderOpen className="h-4 w-4" />
                  {openingFolder ? 'Opening folder…' : 'Open species folder'}
                </Button>
              </div>
              {pickedLat !== null && (
                <p className="mt-0.5 text-xs text-muted-foreground pl-1">
                  {pickedLat.toFixed(4)}, {pickedLng!.toFixed(4)}
                </p>
              )}
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

            {(country || region || pickedLat !== null) && (
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

            {(country || region || pickedLat !== null) && !overwriteExisting && (
              <p className="text-xs text-muted-foreground/70">
                Will only fill empty fields (country, region, coordinates). Enable overwrite to apply to all {finds.length} finds.
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium">Edibility</label>
                <select
                  value={edibility}
                  onChange={(e) => setEdibility(e.target.value)}
                  className="mt-1 h-7 w-full rounded-md border border-border bg-input px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                >
                  {EDIBILITY_VALUES.map((v) => (
                    <option key={v} value={v}>{EDIBILITY_LABELS[v]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Protected Status</label>
                <select
                  value={protectedStatus}
                  onChange={(e) => setProtectedStatus(e.target.value)}
                  className="mt-1 h-7 w-full rounded-md border border-border bg-input px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                >
                  {PROTECTED_STATUS_VALUES.map((v) => (
                    <option key={v} value={v}>{PROTECTED_STATUS_LABELS[v]}</option>
                  ))}
                </select>
              </div>
            </div>
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
          setPickedLat(lat);
          setPickedLng(lng);
          const geo = await reverseGeocode(lat, lng, lang);
          if (geo.country) setCountry(geo.country);
          if (geo.region) setRegion(geo.region);
        }}
      />
    </>
  );
}
