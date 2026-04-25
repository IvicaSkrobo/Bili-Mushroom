import { useState, useEffect, useMemo } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { readDir, remove } from '@tauri-apps/plugin-fs';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useQueryClient } from '@tanstack/react-query';
import { MapPin, Images, FolderOpen, Info, X } from 'lucide-react';
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
import { PostImportReviewDialog } from './PostImportReviewDialog';
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
  type ImportSummary,
} from '@/lib/finds';
import { reverseGeocode } from '@/lib/geocoding';
import { useAppStore } from '@/stores/appStore';
import { useFinds, useSpeciesNotes } from '@/hooks/useFinds';
import { useT } from '@/i18n/index';
import { isInternalLibraryName } from '@/lib/internalEntries';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: (imported: number, skipped: number) => void;
}

function parseObservedCount(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function isImagePath(name: string): boolean {
  const ext = name.toLowerCase().slice(name.lastIndexOf('.'));
  return SUPPORTED_EXTENSIONS.includes(ext as (typeof SUPPORTED_EXTENSIONS)[number]);
}

export function ImportDialog({ open, onOpenChange, onImportComplete }: ImportDialogProps) {
  const t = useT();
  const storagePath = useAppStore((s) => s.storagePath);
  const lang = useAppStore((s) => s.language);
  const qc = useQueryClient();
  const { data: speciesNotesData } = useSpeciesNotes();
  const { data: findsData } = useFinds();

  const speciesFolders = useMemo(() => {
    if (!findsData) return [];
    const seen = new Set<string>();
    return findsData
      .map((f) => f.species_name)
      .filter((name) => {
        if (!name || seen.has(name) || isInternalLibraryName(name)) return false;
        seen.add(name);
        return true;
      });
  }, [findsData]);

  // All photos for this single find
  const [photos, setPhotos] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [deleteSource, setDeleteSource] = useState(true);

  // Find metadata
  const [sharedName, setSharedName] = useState('');
  const [sharedDate, setSharedDate] = useState('');
  const [sharedCountry, setSharedCountry] = useState('');
  const [sharedRegion, setSharedRegion] = useState('');
  const [sharedLocationNote, setSharedLocationNote] = useState('');
  const [sharedObservedCount, setSharedObservedCount] = useState('');
  const [sharedFolderNotes, setSharedFolderNotes] = useState('');
  const [sharedMapOpen, setSharedMapOpen] = useState(false);
  const [sharedLocation, setSharedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [nameDropdownOpen, setNameDropdownOpen] = useState(false);
  const [nameHighlight, setNameHighlight] = useState(0);

  // When species name changes to a known folder, pre-fill notes from DB
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

  const canImport = photos.length > 0 && sharedName.trim() !== '' && sharedDate !== '' && !importing;

  /** Auto-fill date + location from first photo's EXIF when photos are first added */
  async function prefillFromExif(paths: string[]) {
    if (paths.length === 0) return;
    try {
      const exif = await parseExif(paths[0]);
      if (exif.date && !sharedDate) setSharedDate(exif.date);
      if (exif.lat != null && exif.lng != null && !sharedLocation) {
        setSharedLocation({ lat: exif.lat, lng: exif.lng });
        const geo = await reverseGeocode(exif.lat, exif.lng, lang);
        if (geo.country && !sharedCountry) setSharedCountry(geo.country);
        if (geo.region && !sharedRegion) setSharedRegion(geo.region);
      }
    } catch {
      // EXIF unavailable — user fills manually
    }
  }

  const handleSharedMapConfirm = async (lat: number, lng: number) => {
    setSharedLocation({ lat, lng });
    const geo = await reverseGeocode(lat, lng, lang);
    if (geo.country) setSharedCountry(geo.country);
    if (geo.region) setSharedRegion(geo.region);
  };

  async function handlePickFiles() {
    try {
      const selected = await openDialog({
        multiple: true,
        filters: [{ name: 'Images', extensions: SUPPORTED_EXTENSIONS.map((ext) => ext.replace('.', '')) }],
      });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      const isFirst = photos.length === 0;
      setPhotos((prev) => [...prev, ...paths]);
      if (isFirst) await prefillFromExif(paths);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handlePickFolder() {
    try {
      const dir = await openDialog({ directory: true });
      if (!dir || typeof dir !== 'string') return;
      const entries = await readDir(dir);

      const directImages = entries
        .filter((e) => e.isFile && e.name && isImagePath(e.name))
        .map((e) => `${dir}/${e.name}`);

      const subfolderImages: string[] = [];
      for (const sub of entries.filter((e) => e.isDirectory && e.name)) {
        try {
          const subEntries = await readDir(`${dir}/${sub.name}`);
          for (const se of subEntries) {
            if (se.isFile && se.name && isImagePath(se.name)) {
              subfolderImages.push(`${dir}/${sub.name}/${se.name}`);
            }
          }
        } catch { /* skip unreadable */ }
      }

      const paths = [...directImages, ...subfolderImages];
      const isFirst = photos.length === 0;
      const folderName = dir.split('/').pop()?.split('\\').pop() ?? '';
      if (folderName && !sharedName) setSharedName(folderName);
      setPhotos((prev) => [...prev, ...paths]);
      if (isFirst) await prefillFromExif(paths);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleImportAll() {
    if (!storagePath || photos.length === 0) return;
    setError(null);
    setImporting(true);
    try {
      const payload: ImportPayload = {
        source_path: photos[0],
        original_filename: photos[0].split('/').pop()?.split('\\').pop() ?? photos[0],
        species_name: sharedName.trim(),
        date_found: sharedDate,
        country: sharedCountry,
        region: sharedRegion,
        location_note: sharedLocationNote,
        lat: sharedLocation?.lat ?? null,
        lng: sharedLocation?.lng ?? null,
        notes: sharedFolderNotes,
        observed_count: parseObservedCount(sharedObservedCount),
        additional_photos: photos.slice(1),
      };

      const summary = await importFind(storagePath, [payload]);

      if (sharedName && sharedFolderNotes.trim()) {
        await upsertSpeciesNote(storagePath, sharedName, sharedFolderNotes.trim());
        qc.invalidateQueries({ queryKey: [SPECIES_NOTES_QUERY_KEY, storagePath] });
      }

      onImportComplete?.(summary.imported.length, summary.skipped.length);
      qc.invalidateQueries({ queryKey: [FINDS_QUERY_KEY, storagePath] });

      if (deleteSource) {
        await Promise.allSettled(
          photos
            .filter((p) => !p.startsWith(storagePath))
            .map((p) => remove(p)),
        );
      }

      setImportSummary(summary);
      setReviewOpen(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setImporting(false);
    }
  }

  function resetState() {
    setPhotos([]);
    setSharedName('');
    setSharedDate('');
    setSharedCountry('');
    setSharedRegion('');
    setSharedLocationNote('');
    setSharedObservedCount('');
    setSharedFolderNotes('');
    setSharedLocation(null);
    setImportSummary(null);
    setReviewOpen(false);
    setError(null);
  }

  function handleReviewClose(open: boolean) {
    if (!open) {
      resetState();
      onOpenChange(false);
    }
  }

  function handleImportMore() {
    resetState();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{t('import.title')}</DialogTitle>
          </DialogHeader>

          <p className="text-xs text-muted-foreground flex-shrink-0">
            {t('import.summaryHint')}
          </p>

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
            {photos.length > 0 && (
              <Button
                variant="ghost"
                onClick={() => setPhotos([])}
                disabled={importing}
                className="ml-auto text-destructive"
              >
                {t('import.clearAll')}
              </Button>
            )}
          </div>

          {/* Find metadata form */}
          <div className="p-3 rounded-md border bg-muted/50 space-y-2 flex-shrink-0">
            {/* Row 1: species name + map pin */}
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
                    if (e.key === 'ArrowDown') { e.preventDefault(); setNameHighlight((h) => Math.min(h + 1, visible.length - 1)); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setNameHighlight((h) => Math.max(h - 1, 0)); }
                    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); setSharedName(visible[nameHighlight]); setNameDropdownOpen(false); }
                    else if (e.key === 'Escape') { setNameDropdownOpen(false); }
                  }}
                />
                {nameDropdownOpen && filteredFolders.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                    {filteredFolders.slice(0, 10).map((f, i) => (
                      <button
                        key={f}
                        type="button"
                        className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${i === nameHighlight ? 'bg-accent' : 'hover:bg-accent'}`}
                        onMouseDown={(e) => { e.preventDefault(); setSharedName(f); setNameDropdownOpen(false); }}
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

            {nameDropdownOpen && sharedName && filteredFolders.length === 0 && (
              <p className="text-xs text-muted-foreground">{t('import.newFolderHint')}</p>
            )}

            {/* Row 2: date + country + region + location note + observed count */}
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={sharedDate}
                onChange={(e) => setSharedDate(e.target.value)}
                className="text-foreground [color-scheme:light]"
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
              <div className="col-span-2">
                <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{t('import.observedCount')}</span>
                  <span title={t('import.observedCountHelp')} aria-label={t('import.observedCountHelp')}>
                    <Info className="h-3.5 w-3.5" />
                  </span>
                </div>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder={t('import.observedCountPlaceholder')}
                  value={sharedObservedCount}
                  onChange={(e) => setSharedObservedCount(e.target.value)}
                />
              </div>
            </div>

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

          {/* Photo thumbnails */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {photos.length > 0 && (
              <div className="grid grid-cols-4 gap-2 py-1">
                {photos.map((path, i) => (
                  <div key={path} className="relative group aspect-square rounded-md overflow-hidden bg-muted">
                    <img
                      src={convertFileSrc(path)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full p-0.5 text-white"
                      aria-label="Remove photo"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {photos.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                {t('import.summaryHint')}
              </p>
            )}
          </div>

          {photos.length > 0 && (
            <p className="text-xs text-muted-foreground flex-shrink-0">
              {photos.length} {photos.length === 1 ? 'photo' : 'photos'} → 1 find
            </p>
          )}

          {importing && progress && (
            <div className="space-y-1 flex-shrink-0">
              <Progress value={(progress.current / progress.total) * 100} />
              <p className="text-xs text-muted-foreground">
                {progress.current}/{progress.total} · {progress.filename}
              </p>
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="flex-shrink-0">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="flex-shrink-0">
            <div className="flex flex-col items-end gap-2 w-full">
              {photos.length > 0 && !sharedName.trim() && (
                <p className="text-sm text-destructive">{t('import.nameRequired')}</p>
              )}
              {photos.length > 0 && sharedName.trim() && !sharedDate && (
                <p className="text-xs text-muted-foreground/60">{t('preview.dateRequired')}</p>
              )}
              <div className="flex items-center justify-between w-full">
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={deleteSource}
                    onChange={(e) => setDeleteSource(e.target.checked)}
                    className="h-4 w-4 rounded accent-primary cursor-pointer"
                  />
                  Delete from source folder after import
                </label>
                <Button onClick={handleImportAll} disabled={!canImport}>
                  {t('import.importAll')}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PostImportReviewDialog
        summary={reviewOpen ? importSummary : null}
        onOpenChange={handleReviewClose}
        onImportMore={handleImportMore}
      />
    </>
  );
}
