import { useState, useEffect, useMemo } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { readDir } from '@tauri-apps/plugin-fs';
import { useQueryClient } from '@tanstack/react-query';
import { MapPin, Images, FolderOpen } from 'lucide-react';
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
  upsertSpeciesNote,
  FINDS_QUERY_KEY,
  SPECIES_NOTES_QUERY_KEY,
  SUPPORTED_EXTENSIONS,
  type ImportPayload,
} from '@/lib/finds';
import { reverseGeocode } from '@/lib/geocoding';
import { useAppStore } from '@/stores/appStore';
import { useFinds, useSpeciesNotes } from '@/hooks/useFinds';
import { useT } from '@/i18n/index';

export type LockableField = 'date_found' | 'country' | 'region' | 'location_note';

function isoToDisplay(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function displayToIso(display: string): string {
  const parts = display.split('/');
  if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  return display;
}

interface PendingItem {
  sourcePath: string;
  payload: ImportPayload;
  locked: Partial<Record<LockableField, boolean>>;
}

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: (imported: number, skipped: number) => void;
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

export function ImportDialog({ open, onOpenChange, onImportComplete }: ImportDialogProps) {
  const t = useT();
  const storagePath = useAppStore((s) => s.storagePath);
  const lang = useAppStore((s) => s.language);
  const qc = useQueryClient();
  const { data: speciesNotesData } = useSpeciesNotes();
  const { data: findsData } = useFinds();

  // Unique species names from DB — used for autocomplete
  const speciesFolders = useMemo(() => {
    if (!findsData) return [];
    const seen = new Set<string>();
    return findsData
      .map((f) => f.species_name)
      .filter((name) => { if (!name || seen.has(name)) return false; seen.add(name); return true; });
  }, [findsData]);

  const [pending, setPending] = useState<PendingItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shared header state
  const [sharedName, setSharedName] = useState('');
  const [sharedDate, setSharedDate] = useState('');
  const [sharedCountry, setSharedCountry] = useState('');
  const [sharedRegion, setSharedRegion] = useState('');
  const [sharedLocationNote, setSharedLocationNote] = useState('');
  const [sharedFolderNotes, setSharedFolderNotes] = useState('');
  const [sharedMapOpen, setSharedMapOpen] = useState(false);
  const [sharedLocation, setSharedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [nameDropdownOpen, setNameDropdownOpen] = useState(false);
  const [nameHighlight, setNameHighlight] = useState(0);

  // When species name changes to a known folder, pre-fill folder notes from DB
  useEffect(() => {
    if (!speciesNotesData || !sharedName) return;
    const existing = speciesNotesData.find(
      (sn) => sn.species_name.toLowerCase() === sharedName.toLowerCase(),
    );
    setSharedFolderNotes(existing?.notes ?? '');
  }, [sharedName, speciesNotesData]);

  const filteredFolders = sharedName
    ? speciesFolders.filter((f) => f.toLowerCase().includes(sharedName.toLowerCase()))
    : speciesFolders;

  const progress = useImportProgress(importing);

  // Cascade shared name to all cards
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
    setPending((prev) =>
      prev.map((item) => ({ ...item, payload: { ...item.payload, lat, lng } })),
    );
    const geo = await reverseGeocode(lat, lng, lang);
    if (geo.country) setSharedCountry(geo.country);
    if (geo.region) setSharedRegion(geo.region);
  };

  const allDatesSet = pending.length > 0 && pending.every((item) => item.payload.date_found !== '');
  const allNamed = pending.length > 0 && pending.every((item) => item.payload.species_name.trim() !== '');
  const canImport = pending.length > 0 && allDatesSet && allNamed && !importing;

  const applyShared = (payload: ImportPayload): ImportPayload => ({
    ...payload,
    species_name: sharedName || payload.species_name,
    date_found: payload.date_found || sharedDate,
    country: sharedCountry || payload.country,
    region: sharedRegion || payload.region,
    location_note: sharedLocationNote || payload.location_note,
  });

  /** Extract folder name from a file path */
  function folderFromPath(path: string): string {
    const segments = path.replace(/\\/g, '/').split('/');
    return segments.length >= 2 ? segments[segments.length - 2] : '';
  }

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
      // Always update name from picked folder
      const folderName = dir.split('/').pop()?.split('\\').pop() ?? '';
      if (folderName) setSharedName(folderName);
      setPending((prev) => [...prev, ...items]);
    } catch (e) {
      setError(String(e));
    }
  }

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
      // Save folder-level notes if provided
      if (sharedName && sharedFolderNotes.trim()) {
        await upsertSpeciesNote(storagePath, sharedName, sharedFolderNotes.trim());
        qc.invalidateQueries({ queryKey: [SPECIES_NOTES_QUERY_KEY, storagePath] });
      }
      onImportComplete?.(summary.imported.length, summary.skipped.length);
      setPending([]);
      setSharedName('');
      setSharedDate('');
      setSharedCountry('');
      setSharedRegion('');
      setSharedLocationNote('');
      setSharedFolderNotes('');
      setSharedLocation(null);
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
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t('import.title')}</DialogTitle>
        </DialogHeader>

        {/* Picker buttons */}
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="secondary" onClick={handlePickFiles} disabled={importing}>
            <Images className="h-4 w-4" />
            {t('import.pickPhotos')}
          </Button>
          <Button variant="secondary" onClick={handlePickFolder} disabled={importing}>
            <FolderOpen className="h-4 w-4" />
            {t('import.pickFolder')}
          </Button>
          {pending.length > 0 && (
            <Button
              variant="ghost"
              onClick={() => { setPending([]); setSharedName(''); }}
              disabled={importing}
              className="ml-auto text-destructive"
            >
              {t('import.clearAll')}
            </Button>
          )}
        </div>

        {/* Folder notes — shown always (even before picking photos) */}
        <div className="p-3 rounded-md border bg-muted/50 space-y-2 flex-shrink-0">
          {/* Row 1: name + map pin */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                placeholder={t('import.mushroomName')}
                value={sharedName}
                autoComplete="off"
                onChange={(e) => { setSharedName(e.target.value); setNameDropdownOpen(true); setNameHighlight(0); }}
                onFocus={() => setNameDropdownOpen(true)}
                onBlur={() => setTimeout(() => setNameDropdownOpen(false), 150)}
                onKeyDown={(e) => {
                  const visible = filteredFolders.slice(0, 10);
                  if (!nameDropdownOpen || visible.length === 0) return;
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setNameHighlight((h) => Math.min(h + 1, visible.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setNameHighlight((h) => Math.max(h - 1, 0));
                  } else if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    setSharedName(visible[nameHighlight]);
                    setNameDropdownOpen(false);
                  } else if (e.key === 'Escape') {
                    setNameDropdownOpen(false);
                  }
                }}
              />
              {nameDropdownOpen && filteredFolders.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                  {filteredFolders.slice(0, 10).map((f, i) => (
                    <button
                      key={f}
                      type="button"
                      className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${i === nameHighlight ? 'bg-accent' : 'hover:bg-accent'}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSharedName(f);
                        setNameDropdownOpen(false);
                      }}
                      onMouseEnter={() => setNameHighlight(i)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t('import.pickLocation')}
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

          {/* New folder hint when no matches */}
          {nameDropdownOpen && sharedName && filteredFolders.length === 0 && (
            <p className="text-xs text-muted-foreground">{t('import.newFolderHint')}</p>
          )}

          {/* Row 2: date + country + region + location note */}
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="text"
              placeholder="DD/MM/YYYY"
              value={isoToDisplay(sharedDate)}
              onChange={(e) => setSharedDate(displayToIso(e.target.value))}
            />
            <Input
              placeholder={t('import.country')}
              value={sharedCountry}
              onChange={(e) => setSharedCountry(e.target.value)}
            />
            <Input
              placeholder={t('import.region')}
              value={sharedRegion}
              onChange={(e) => setSharedRegion(e.target.value)}
            />
            <Input
              placeholder={t('import.locationMark')}
              value={sharedLocationNote}
              onChange={(e) => setSharedLocationNote(e.target.value)}
            />
          </div>

          {/* Folder-level notes — saved to species_notes on import */}
          <Textarea
            placeholder={t('import.folderNotes')}
            rows={2}
            value={sharedFolderNotes}
            onChange={(e) => setSharedFolderNotes(e.target.value)}
          />
        </div>

        <LocationPickerMap
          open={sharedMapOpen}
          onOpenChange={setSharedMapOpen}
          initialLatLng={sharedLocation}
          onConfirm={handleSharedMapConfirm}
        />

        {/* Scrollable preview list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {pending.length > 0 && (
            <div className="flex flex-col gap-3 py-1">
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
        </div>

        {/* Progress bar */}
        {importing && progress && (
          <div className="space-y-1 flex-shrink-0">
            <Progress value={(progress.current / progress.total) * 100} />
            <p className="text-xs text-muted-foreground">
              {progress.current}/{progress.total} · {progress.filename}
            </p>
          </div>
        )}

        {/* Error alert */}
        {error && (
          <Alert variant="destructive" className="flex-shrink-0">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="flex-shrink-0">
          <div className="flex flex-col items-end gap-2 w-full">
            {pending.length > 0 && !allNamed && (
              <p className="text-sm text-destructive">{t('import.nameRequired')}</p>
            )}
            <Button onClick={handleImportAll} disabled={!canImport}>
              {t('import.importAll')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
