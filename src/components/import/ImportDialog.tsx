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
import { useAppStore } from '@/stores/appStore';

interface PendingItem {
  sourcePath: string;
  payload: ImportPayload;
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
  const [sharedName, setSharedName] = useState('');
  const [sharedMapOpen, setSharedMapOpen] = useState(false);
  const [sharedLocation, setSharedLocation] = useState<{ lat: number; lng: number } | null>(null);

  const progress = useImportProgress(importing);

  // Cascade shared name to all pending items when sharedName changes (non-empty only)
  useEffect(() => {
    if (sharedName === '') return;
    setPending((prev) =>
      prev.map((item) => ({ ...item, payload: { ...item.payload, species_name: sharedName } })),
    );
  }, [sharedName]);

  const handleSharedMapConfirm = (lat: number, lng: number) => {
    setSharedLocation({ lat, lng });
    setPending((prev) =>
      prev.map((item) => ({ ...item, payload: { ...item.payload, lat, lng } })),
    );
  };

  const allDatesSet = pending.length > 0 && pending.every((item) => item.payload.date_found !== '');
  const canImport = pending.length > 0 && allDatesSet && !importing;

  async function handlePickFiles() {
    try {
      const selected = await openDialog({
        multiple: true,
        filters: [
          {
            name: 'Images',
            extensions: SUPPORTED_EXTENSIONS.map((ext) => ext.replace('.', '')),
          },
        ],
      });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      const items = await Promise.all(
        paths.map(async (path) => {
          const exif = await parseExif(path);
          return { sourcePath: path, payload: buildInitialPayload(path, exif) };
        }),
      );
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

      const items = await Promise.all(
        imagePaths.map(async (path) => {
          const exif = await parseExif(path);
          return { sourcePath: path, payload: buildInitialPayload(path, exif) };
        }),
      );
      const folderName = dir.split('/').pop()?.split('\\').pop() ?? '';
      if (folderName) setSharedName(folderName);
      setPending((prev) => [...prev, ...items]);
    } catch (e) {
      setError(String(e));
    }
  }

  const updateAt = (index: number, updated: ImportPayload) => {
    setPending((prev) => prev.map((item, i) => (i === index ? { ...item, payload: updated } : item)));
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

        {/* Shared name + location header */}
        {pending.length > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/50">
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
              <span className="text-xs text-muted-foreground">
                {sharedLocation.lat.toFixed(4)}, {sharedLocation.lng.toFixed(4)}
              </span>
            )}
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
                onChange={(p) => updateAt(i, p)}
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
          <Button
            onClick={handleImportAll}
            disabled={!canImport}
          >
            Import All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
