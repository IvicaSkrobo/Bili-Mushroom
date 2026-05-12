import { useState, useEffect, useMemo } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { readDir } from '@tauri-apps/plugin-fs';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useQueryClient } from '@tanstack/react-query';
import { MapPin, Images, FolderOpen, X } from 'lucide-react';
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
import { SpeciesNameEditor } from '@/components/finds/SpeciesNameEditor';
import { LocationNoteInput } from '@/components/finds/LocationNoteInput';
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
  upsertSpeciesProfile,
  FINDS_QUERY_KEY,
  SPECIES_NOTES_QUERY_KEY,
  SPECIES_PROFILES_QUERY_KEY,
  SUPPORTED_EXTENSIONS,
  type ImportPayload,
  type ImportSummary,
} from '@/lib/finds';
import { EdibilitySelectBadge, ThreatStatusSelectBadge, DistributionSelectBadge } from '@/components/species/StatusSelectBadge';
import { reverseGeocode } from '@/lib/geocoding';
import { useAppStore } from '@/stores/appStore';
import { useFinds, useSpeciesNotes, useSpeciesProfiles } from '@/hooks/useFinds';
import { useT } from '@/i18n/index';
import { isInternalLibraryName } from '@/lib/internalEntries';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: (imported: number, skipped: number) => void;
}

function parseObservedRangeBound(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseObservedRangeInput(value: string): {
  min: number | null;
  max: number | null;
  representative: number | null;
} {
  const trimmed = value.trim();
  if (trimmed === '') return { min: null, max: null, representative: null };

  const match = trimmed.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
  if (!match) return { min: null, max: null, representative: null };

  const first = parseObservedRangeBound(match[1] ?? '');
  const second = parseObservedRangeBound(match[2] ?? '');
  const min = first != null && second != null ? Math.min(first, second) : first;
  const max = first != null && second != null ? Math.max(first, second) : (second ?? first);

  return {
    min,
    max,
    representative: min != null && max != null ? Math.round((min + max) / 2) : null,
  };
}

function isObservedRangeInputValid(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === '' || /^(\d+)(?:\s*-\s*(\d+))?$/.test(trimmed);
}

function isImagePath(name: string): boolean {
  const ext = name.toLowerCase().slice(name.lastIndexOf('.'));
  return SUPPORTED_EXTENSIONS.includes(ext as (typeof SUPPORTED_EXTENSIONS)[number]);
}

// ---------------------------------------------------------------------------
// Persist last used import directory so the picker reopens in the same place
// ---------------------------------------------------------------------------

const LAST_IMPORT_DIR_KEY = 'bili_last_import_dir';

function loadLastImportDir(): string | undefined {
  try { return localStorage.getItem(LAST_IMPORT_DIR_KEY) ?? undefined; } catch { return undefined; }
}

function saveLastImportDir(path: string): void {
  // For file paths, strip the filename to get the directory
  const sep = path.includes('\\') ? '\\' : '/';
  const dir = path.slice(0, path.lastIndexOf(sep)) || path;
  try { localStorage.setItem(LAST_IMPORT_DIR_KEY, dir); } catch { /* ignore */ }
}

export function ImportDialog({ open, onOpenChange, onImportComplete }: ImportDialogProps) {
  const t = useT();
  const storagePath = useAppStore((s) => s.storagePath);
  const lang = useAppStore((s) => s.language);
  const qc = useQueryClient();
  const { data: speciesNotesData } = useSpeciesNotes();
  const { data: findsData } = useFinds();
  const { data: speciesProfilesData } = useSpeciesProfiles();


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

  const locationNoteSuggestions = useMemo(() => {
    if (!findsData) return [];
    const seen = new Set<string>();
    return findsData
      .map((f) => f.location_note ?? '')
      .filter((v) => {
        const trimmed = v.trim();
        if (!trimmed || seen.has(trimmed.toLowerCase())) return false;
        seen.add(trimmed.toLowerCase());
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
  const [sharedObservedRange, setSharedObservedRange] = useState('');
  const [sharedFolderNotes, setSharedFolderNotes] = useState('');
  const [sharedFindNotes, setSharedFindNotes] = useState('');
  const [sharedMapOpen, setSharedMapOpen] = useState(false);
  const [sharedLocation, setSharedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [sharedEdibilityNote, setSharedEdibilityNote] = useState<string>('');
  const [sharedEdibility, setSharedEdibility] = useState<string>('unknown');
  const [sharedProtectedStatus, setSharedProtectedStatus] = useState<string>('unknown');
  const [sharedDistribution, setSharedDistribution] = useState<string>('unknown');

  const isNewSpecies = useMemo(() => {
    const name = sharedName.trim().toLowerCase();
    if (!name) return false;
    const inFinds = findsData?.some((f) => f.species_name.toLowerCase() === name);
    const inProfiles = speciesProfilesData?.some((p) => p.species_name.toLowerCase() === name);
    return !inFinds && !inProfiles;
  }, [sharedName, findsData, speciesProfilesData]);

  // When species name changes to a known folder, pre-fill notes + species metadata from DB
  useEffect(() => {
    if (!speciesNotesData || !sharedName) return;
    const existing = speciesNotesData.find(
      (sn) => sn.species_name.toLowerCase() === sharedName.toLowerCase(),
    );
    setSharedFolderNotes(existing?.notes ?? '');
  }, [sharedName, speciesNotesData]);

  const progress = useImportProgress(importing);

  const canImport = photos.length > 0 && sharedName.trim() !== '' && sharedDate !== '' && !importing;

  const [datFromExif, setDateFromExif] = useState(false);

  /** Auto-fill date + location from first photo's EXIF when photos are first added */
  async function prefillFromExif(paths: string[]) {
    if (paths.length === 0) return;
    // Default to today immediately; override with EXIF if available
    const today = new Date().toISOString().slice(0, 10);
    if (!sharedDate) setSharedDate(today);
    try {
      const exif = await parseExif(paths[0]);
      if (exif.date) {
        setSharedDate(exif.date);
        setDateFromExif(true);
      }
      if (exif.lat != null && exif.lng != null && !sharedLocation) {
        setSharedLocation({ lat: exif.lat, lng: exif.lng });
        const geo = await reverseGeocode(exif.lat, exif.lng, lang);
        if (geo.country && !sharedCountry) setSharedCountry(geo.country);
        if (geo.region && !sharedRegion) setSharedRegion(geo.region);
      }
    } catch {
      // EXIF unavailable — today's date used as default
    }
  }

  const handleSharedMapConfirm = async (lat: number, lng: number) => {
    setSharedLocation({ lat, lng });
    const geo = await reverseGeocode(lat, lng, lang);
    if (geo.country) setSharedCountry(geo.country);
    if (geo.region) setSharedRegion(geo.region);
    setSharedMapOpen(false);
  };

  async function handlePickFiles() {
    try {
      const selected = await openDialog({
        multiple: true,
        defaultPath: loadLastImportDir(),
        filters: [{ name: 'Images', extensions: SUPPORTED_EXTENSIONS.map((ext) => ext.replace('.', '')) }],
      });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      saveLastImportDir(paths[0]);
      const isFirst = photos.length === 0;
      setPhotos((prev) => [...prev, ...paths]);
      if (isFirst) await prefillFromExif(paths);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handlePickFolder() {
    try {
      const dir = await openDialog({ directory: true, defaultPath: loadLastImportDir() });
      if (!dir || typeof dir !== 'string') return;
      try { localStorage.setItem(LAST_IMPORT_DIR_KEY, dir); } catch { /* ignore */ }
      const entries = await readDir(dir);

      const directImages = entries
        .filter((e) => e.isFile && e.name && isImagePath(e.name))
        .map((e) => `${dir}/${e.name}`);

      // Scan named subfolders — folder name takes precedence over filenames
      const subdirs = entries.filter((e) => e.isDirectory && e.name && !e.name.startsWith('.'));
      const subfolderGroups: { name: string; paths: string[] }[] = [];
      for (const sub of subdirs) {
        try {
          const subEntries = await readDir(`${dir}/${sub.name}`);
          const imgs = subEntries
            .filter((se) => se.isFile && se.name && isImagePath(se.name))
            .map((se) => `${dir}/${sub.name}/${se.name}`);
          if (imgs.length > 0) subfolderGroups.push({ name: sub.name!, paths: imgs });
        } catch { /* skip unreadable */ }
      }

      const isFirst = photos.length === 0;

      if (subfolderGroups.length === 1) {
        // One named subfolder → use its name as species, add all its photos
        if (!sharedName) setSharedName(subfolderGroups[0].name);
        const paths = [...directImages, ...subfolderGroups[0].paths];
        setPhotos((prev) => [...prev, ...paths]);
        if (isFirst) await prefillFromExif(paths);
      } else if (subfolderGroups.length > 1) {
        // Multiple named subfolders = multi-species library → only take direct images,
        // show a hint to use Settings > Change Folder for structured folders
        const paths = directImages;
        const folderName = dir.split('/').pop()?.split('\\').pop() ?? '';
        if (folderName && !sharedName) setSharedName(folderName);
        if (paths.length > 0) {
          setPhotos((prev) => [...prev, ...paths]);
          if (isFirst) await prefillFromExif(paths);
        }
        setError(`Mapa sadrži ${subfolderGroups.length} podmapa s vrstama. Za uvoz cijele knjižnice koristi Postavke → Promijeni mapu.`);
      } else {
        // No subfolders — flat folder, use folder name
        const folderName = dir.split('/').pop()?.split('\\').pop() ?? '';
        if (folderName && !sharedName) setSharedName(folderName);
        setPhotos((prev) => [...prev, ...directImages]);
        if (isFirst) await prefillFromExif(directImages);
      }
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleImportAll() {
    if (!storagePath || photos.length === 0) return;
    setError(null);
    setImporting(true);
    try {
      const observedRange = parseObservedRangeInput(sharedObservedRange);

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
        notes: sharedFindNotes.trim(),
        observed_count: observedRange.representative,
        observed_count_min: observedRange.min,
        observed_count_max: observedRange.max,
        additional_photos: photos.slice(1),
        edibility_note: sharedEdibilityNote.trim() || null,
      };

      const summary = await importFind(storagePath, [payload], deleteSource);

      if (sharedName && sharedFolderNotes.trim()) {
        await upsertSpeciesNote(storagePath, sharedName, sharedFolderNotes.trim());
        qc.invalidateQueries({ queryKey: [SPECIES_NOTES_QUERY_KEY, storagePath] });
      }

      if (isNewSpecies && (sharedEdibility !== 'unknown' || sharedProtectedStatus !== 'unknown' || sharedDistribution !== 'unknown')) {
        await upsertSpeciesProfile(
          storagePath,
          sharedName.trim(),
          null,
          [],
          sharedEdibility !== 'unknown' ? sharedEdibility : null,
          sharedProtectedStatus !== 'unknown' ? sharedProtectedStatus : null,
          sharedDistribution !== 'unknown' ? sharedDistribution : null,
          null,
        );
        qc.invalidateQueries({ queryKey: [SPECIES_PROFILES_QUERY_KEY, storagePath] });
      }

      onImportComplete?.(summary.imported.length, summary.skipped.length);
      qc.invalidateQueries({ queryKey: [FINDS_QUERY_KEY, storagePath] });

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
    setSharedObservedRange('');
    setSharedFolderNotes('');
    setSharedFindNotes('');
    setSharedLocation(null);
    setImportSummary(null);
    setReviewOpen(false);
    setError(null);
    setSharedEdibility('unknown');
    setSharedProtectedStatus('unknown');
    setSharedDistribution('unknown');
    setSharedEdibilityNote('');
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
        <DialogContent className="flex max-h-[84vh] max-w-2xl flex-col overflow-hidden p-0">
          <DialogHeader className="border-b border-border/60 px-5 py-3">
            <DialogTitle>{t('import.title')}</DialogTitle>
            <DialogDescription>
              Build one new find from selected photos, metadata, and optional species-level notes.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {t('import.summaryHint')}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={handlePickFiles} disabled={importing}>
              <Images className="h-4 w-4" />
              {t('import.pickPhotos')}
            </Button>
            <Button variant="secondary" size="sm" onClick={handlePickFolder} disabled={importing}>
              <FolderOpen className="h-4 w-4" />
              {t('import.pickFolder')}
            </Button>
            {photos.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPhotos([])}
                disabled={importing}
                className="ml-auto text-destructive"
              >
                {t('import.clearAll')}
              </Button>
            )}
          </div>

          {/* Find metadata form */}
          <div className="rounded-md border bg-muted/50 p-3 space-y-2">
            {/* Row 1: species name + map pin */}
            <div className="flex items-end gap-2">
              <div className="relative flex-1 min-w-0">
                <SpeciesNameEditor
                  value={sharedName}
                  onChange={setSharedName}
                  placeholder={t('import.mushroomName')}
                  suggestions={speciesFolders}
                  showBoldButton
                  label={t('import.mushroomName')}
                />
              </div>
              <div className="flex flex-col items-center gap-0.5 pb-0.5 flex-shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t('import.pickLocation')}
                  onClick={() => setSharedMapOpen(true)}
                  className={[
                    'border border-primary/35 bg-primary/14 text-primary',
                    'hover:bg-primary/22 hover:text-primary hover:border-primary/55',
                    'focus-visible:ring-primary/45',
                    sharedLocation ? 'bg-secondary/18 text-secondary border-secondary/45 hover:bg-secondary/26 hover:border-secondary/60' : '',
                  ].join(' ')}
                >
                  <MapPin className="h-4 w-4" />
                </Button>
                {sharedLocation && (
                  <span className="text-[10px] text-muted-foreground/60 font-mono whitespace-nowrap">
                    {sharedLocation.lat.toFixed(3)}, {sharedLocation.lng.toFixed(3)}
                  </span>
                )}
              </div>
            </div>

            {/* Status badges — only for new species */}
            {isNewSpecies && (
              <div className="flex flex-wrap gap-2">
                <EdibilitySelectBadge value={sharedEdibility} onChange={setSharedEdibility} />
                <ThreatStatusSelectBadge value={sharedProtectedStatus} onChange={setSharedProtectedStatus} />
                <DistributionSelectBadge value={sharedDistribution} onChange={setSharedDistribution} />
              </div>
            )}

            {/* Row 2: date + country + region + location note + observed range */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Input
                  type="date"
                  value={sharedDate}
                  onChange={(e) => { setSharedDate(e.target.value); setDateFromExif(false); }}
                  className="text-foreground [color-scheme:light]"
                />
                {sharedDate && !datFromExif && (
                  <p className="text-xs text-muted-foreground/60 mt-0.5">Datum nije pronađen u fotografiji — provjeri</p>
                )}
              </div>
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
              <LocationNoteInput
                value={sharedLocationNote}
                onChange={setSharedLocationNote}
                suggestions={locationNoteSuggestions}
                placeholder={t('import.locationMark')}
              />
              <div className="col-span-2">
                <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{t('import.observedCount')}</span>
                  <span>{t('import.observedCountHelp')}</span>
                </div>
                <Input
                  inputMode="numeric"
                  placeholder="npr. 15 ili 15-20"
                  value={sharedObservedRange}
                  onChange={(e) => setSharedObservedRange(e.target.value)}
                />
                {!isObservedRangeInputValid(sharedObservedRange) && (
                  <p className="mt-1 text-xs text-amber-600">
                    Unesi broj ili raspon poput 15-20. Ovakav unos neće se spremiti.
                  </p>
                )}
              </div>
            </div>

            <Textarea
              placeholder={t('import.folderNotes')}
              rows={2}
              value={sharedFolderNotes}
              onChange={(e) => setSharedFolderNotes(e.target.value)}
            />

            <Textarea
              placeholder="Notes about this specific find..."
              rows={2}
              value={sharedFindNotes}
              onChange={(e) => setSharedFindNotes(e.target.value)}
            />

            <Textarea
              placeholder={t('edit.edibilityNotePlaceholder')}
              rows={2}
              value={sharedEdibilityNote}
              onChange={(e) => setSharedEdibilityNote(e.target.value)}
            />

          </div>

          {/* Photo thumbnails */}
          <div>
            {photos.length > 0 && (
              <div className="max-h-56 overflow-y-auto rounded-md border border-border/40 p-2">
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
              </div>
            )}
            {photos.length === 0 && (
              <p className="rounded-md border border-dashed border-border/50 py-6 text-center text-sm text-muted-foreground">
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
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          </div>
          </div>

          <LocationPickerMap
            open={sharedMapOpen}
            onOpenChange={setSharedMapOpen}
            initialLatLng={sharedLocation}
            onConfirm={handleSharedMapConfirm}
            speciesFilter={sharedName || undefined}
          />

          <DialogFooter className="border-t border-border/60 px-5 py-4">
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
