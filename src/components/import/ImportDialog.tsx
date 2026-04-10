import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { readDir } from '@tauri-apps/plugin-fs';
import { useQueryClient } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FindPreviewCard } from './FindPreviewCard';
import { useImportProgress } from './useImportProgress';
import { LocationPickerMap } from '@/components/map/LocationPickerMap';
import {
  parseExif,
  importFind,
  FINDS_QUERY_KEY,
  SUPPORTED_EXTENSIONS,
  type ImportPayload,
} from '@/lib/finds';
import { reverseGeocode } from '@/lib/geocoding';
import { useAppStore } from '@/stores/appStore';

export type LockableField = 'date_found' | 'country' | 'region' | 'location_note';

interface PendingItem {
  sourcePath: string;
  payload: ImportPayload;
  locked: Partial<Record<LockableField, boolean>>;
}

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function buildInitialPayload(path: string, exif: Awaited<ReturnType<typeof parseExif>>): ImportPayload {
  const filename = path.split('/').pop()?.split('\\').pop() ?? path;
  return {
    source_path: path,
    original_filename: filename,
    species_name: '',
    date_found: exif.date ?? '',
    country: '',
    region: '',
    location_note: '',
    lat: exif.lat,
    lng: exif.lng,
    notes: '',
    additional_photos: [],
  };
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const storagePath = useAppStore((s) => s.storagePath);
  const qc = useQueryClient();
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shared header state
  const [sharedName, setSharedName] = useState('');
  const [sharedDate, setSharedDate] = useState('');
  const [sharedCountry, setSharedCountry] = useState('');
  const [sharedRegion, setSharedRegion] = useState('');
  const [sharedLocationNote, setSharedLocationNote] = useState('');
  const [sharedNotes, setSharedNotes] = useState('');
  const [sharedMapOpen, setSharedMapOpen] = useState(false);
  const [sharedLocation, setSharedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [speciesFolders, setSpeciesFolders] = useState<string[]>([]);

  // Load existing species folders when dialog opens
  useEffect(() => {
    if (!open || !storagePath) return;
    readDir(storagePath)
      .then((entries) => {
        const folders = entries
          .filter((e) => e.isDirectory && e.name)
          .map((e) => e.name as string);
        setSpeciesFolders(folders);
      })
      .catch(() => setSpeciesFolders([]));
  }, [open, storagePath]);

  const filteredFolders = sharedName
    ? speciesFolders.filter((f) => f.toLowerCase().includes(sharedName.toLowerCase()))
    : [];

  const progress = useImportProgress(importing);

  // Cascade shared name to all cards (no lock on name)
  useEffect(() => {
    if (sharedName === '') return;
    setPending((prev) =>
      prev.map((item) => ({ ...item, payload: { ...item.payload, species_name: sharedName } })),
    );
  }, [sharedName]);

  // Cascade shared date to unlocked cards
  useEffect(() => {
    if (sharedDate === '') return;
    setPending((prev) =>
      prev.map((item) =>
        item.locked.date_found ? item : { ...item, payload: { ...item.payload, date_found: sharedDate } },
      ),
    );
  }, [sharedDate]);

  // Cascade shared country to unlocked cards
  useEffect(() => {
    if (sharedCountry === '') return;
    setPending((prev) =>
      prev.map((item) =>
        item.locked.country ? item : { ...item, payload: { ...item.payload, country: sharedCountry } },
      ),
    );
  }, [sharedCountry]);

  // Cascade shared region to unlocked cards
  useEffect(() => {
    if (sharedRegion === '') return;
    setPending((prev) =>
      prev.map((item) =>
        item.locked.region ? item : { ...item, payload: { ...item.payload, region: sharedRegion } },
      ),
    );
  }, [sharedRegion]);

  // Cascade shared location note to unlocked cards
  useEffect(() => {
    if (sharedLocationNote === '') return;
    setPending((prev) =>
      prev.map((item) =>
        item.locked.location_note
          ? item
          : { ...item, payload: { ...item.payload, location_note: sharedLocationNote } },
      ),
    );
  }, [sharedLocationNote]);

  const handleSharedMapConfirm = async (lat: number, lng: number) => {
    setSharedLocation({ lat, lng });
    // Cascade lat/lng to all cards
    setPending((prev) =>
      prev.map((item) => ({ ...item, payload: { ...item.payload, lat, lng } })),
    );
    // Reverse geocode → fill shared country+region (which then cascades via effects)
    const geo = await reverseGeocode(lat, lng);
    if (geo.country) setSharedCountry(geo.country);
    if (geo.region) setSharedRegion(geo.region);
  };

  const allDatesSet = pending.length > 0 && pending.every((item) => item.payload.date_found !== '');
  const allNamed = pending.length > 0 && pending.every((item) => item.payload.species_name.trim() !== '');
  const canImport = pending.length > 0 && allDatesSet && allNamed && !importing;

  /** Apply current shared header values to a freshly-built payload.
   *  EXIF date takes precedence over shared date when present. */
  const applyShared = (payload: ImportPayload): ImportPayload => ({
    ...payload,
    species_name: sharedName || payload.species_name,
    date_found: payload.date_found || sharedDate,
    country: sharedCountry || payload.country,
    region: sharedRegion || payload.region,
    location_note: sharedLocationNote || payload.location_note,
    notes: sharedNotes || payload.notes,
  });

  async function handlePickFiles() {
    try {
      const selected = await openDialog({
        multiple: true,
        filters: [{ name: 'Images', extensions: SUPPORTED_EXTENSIONS.map((ext) => ext.replace('.', '')) }],
      });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      const items: PendingItem[] = await Promise.all(
        paths.map(async (path) => {
          const exif = await parseExif(path);
          return { sourcePath: path, payload: applyShared(buildInitialPayload(path, exif)), locked: {} };
        }),
      );
      if (!sharedName && paths.length > 0) {
        const firstPath = paths[0];
        const segments = firstPath.replace(/\\/g, '/').split('/');
        const parentFolder = segments.length >= 2 ? segments[segments.length - 2] : '';
        if (parentFolder) setSharedName(parentFolder);
      }
      setPending((prev) => [...prev, ...items]);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handlePickFolder() {
    try {
      const dir = await openDialog({ directory: true });
      if (!dir || typeof dir !== 'string') return;
      const entries = await readDir(dir);
      const imagePaths = entries
        .filter((entry) => {
          const name = entry.name ?? '';
          const ext = name.toLowerCase().slice(name.lastIndexOf('.'));
          return SUPPORTED_EXTENSIONS.includes(ext as (typeof SUPPORTED_EXTENSIONS)[number]);
        })
        .map((entry) => `${dir}/${entry.name}`);

      const items: PendingItem[] = await Promise.all(
        imagePaths.map(async (path) => {
          const exif = await parseExif(path);
          return { sourcePath: path, payload: applyShared(buildInitialPayload(path, exif)), locked: {} };
        }),
      );
      const folderName = dir.split('/').pop()?.split('\\').pop() ?? '';
      if (folderName) setSharedName(folderName);
      setPending((prev) => [...prev, ...items]);
    } catch (e) {
      setError(String(e));
    }
  }

  /** Update a card's payload. If lockField is provided, also lock that field for this card. */
  const updateAt = (index: number, updated: ImportPayload, lockField?: LockableField) => {
    setPending((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        return {
          ...item,
          payload: updated,
          locked: lockField ? { ...item.locked, [lockField]: true } : item.locked,
        };
      }),
    );
  };

  const unlockAt = (index: number, field: LockableField) => {
    setPending((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const locked = { ...item.locked };
        delete locked[field];
        return { ...item, locked };
      }),
    );
  };

  const removeAt = (index: number) => {
    setPending((prev) => prev.filter((_, i) => i !== index));
  };

  async function handleImportAll() {
    if (!storagePath) return;
    setError(null);
    setImporting(true);
    try {
      const payloads = pending.map((item) => item.payload);
      const summary = await importFind(storagePath, payloads);
      toast.success(`Imported ${summary.imported.length} · Skipped ${summary.skipped.length}`);
      setPending([]);
      qc.invalidateQueries({ queryKey: [FINDS_QUERY_KEY, storagePath] });
      onOpenChange(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Photos</DialogTitle>
        </DialogHeader>

        {/* Picker buttons */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePickFiles} disabled={importing}>
            Pick Photos
          </Button>
          <Button variant="outline" onClick={handlePickFolder} disabled={importing}>
            Pick Folder
          </Button>
          {pending.length > 0 && (
            <Button
              variant="ghost"
              onClick={() => setPending([])}
              disabled={importing}
              className="ml-auto text-destructive"
            >
              Clear All
            </Button>
          )}
        </div>

        {/* Shared header — cascades to all cards */}
        {pending.length > 0 && (
          <div className="p-3 rounded-md border bg-muted/50 space-y-2">
            {/* Row 1: name + map pin */}
            <div className="flex items-center gap-2">
              <Input
                className="flex-1"
                placeholder="Mushroom name (all photos)"
                value={sharedName}
                onChange={(e) => setSharedName(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Pick shared location"
                onClick={() => setSharedMapOpen(true)}
              >
                <MapPin className="h-4 w-4" />
              </Button>
              {sharedLocation && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {sharedLocation.lat.toFixed(4)}, {sharedLocation.lng.toFixed(4)}
                </span>
              )}
            </div>

            {/* Species folder autocomplete */}
            {sharedName && (
              <div className="flex flex-wrap gap-1 items-center">
                {filteredFolders.length > 0 ? (
                  filteredFolders.slice(0, 6).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setSharedName(f)}
                      className="text-xs px-2 py-0.5 rounded bg-background border hover:bg-accent transition-colors"
                    >
                      {f}
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">New folder will be created</p>
                )}
              </div>
            )}

            {/* Row 2: date + country + region + location note */}
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                placeholder="Date (all photos)"
                value={sharedDate}
                onChange={(e) => setSharedDate(e.target.value)}
              />
              <Input
                placeholder="Country (all photos)"
                value={sharedCountry}
                onChange={(e) => setSharedCountry(e.target.value)}
              />
              <Input
                placeholder="Region (all photos)"
                value={sharedRegion}
                onChange={(e) => setSharedRegion(e.target.value)}
              />
              <Input
                placeholder="Location mark (all photos)"
                value={sharedLocationNote}
                onChange={(e) => setSharedLocationNote(e.target.value)}
              />
            </div>
            {/* Notes — pre-fills new cards only, not live-cascaded */}
            <Textarea
              placeholder="Notes (pre-fills new photos — not linked to per-photo notes)"
              rows={2}
              value={sharedNotes}
              onChange={(e) => setSharedNotes(e.target.value)}
            />
          </div>
        )}

        <LocationPickerMap
          open={sharedMapOpen}
          onOpenChange={setSharedMapOpen}
          initialLatLng={sharedLocation}
          onConfirm={handleSharedMapConfirm}
        />

        {/* Preview list */}
        {pending.length > 0 && (
          <div className="flex flex-col gap-3 mt-2">
            {pending.map((item, i) => (
              <FindPreviewCard
                key={i}
                payload={item.payload}
                sourcePath={item.sourcePath}
                locked={item.locked}
                onChange={(p, lockField) => updateAt(i, p, lockField)}
                onUnlock={(field) => unlockAt(i, field)}
                onRemove={() => removeAt(i)}
              />
            ))}
          </div>
        )}

        {/* Progress bar */}
        {importing && progress && (
          <div className="mt-2 space-y-1">
            <Progress value={(progress.current / progress.total) * 100} />
            <p className="text-xs text-muted-foreground">
              {progress.current}/{progress.total} · {progress.filename}
            </p>
          </div>
        )}

        {/* Error alert */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <div className="flex flex-col items-end gap-2 w-full">
            {pending.length > 0 && !allNamed && (
              <p className="text-sm text-destructive">All photos must have a mushroom name before importing.</p>
            )}
            <Button onClick={handleImportAll} disabled={!canImport}>
              Import All
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
