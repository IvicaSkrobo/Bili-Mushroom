import { useState } from 'react';
import { toast } from 'sonner';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { readDir } from '@tauri-apps/plugin-fs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FindPreviewCard } from './FindPreviewCard';
import { useImportProgress } from './useImportProgress';
import {
  parseExif,
  importFind,
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
  };
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const storagePath = useAppStore((s) => s.storagePath);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const progress = useImportProgress(importing);

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
        </div>

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
