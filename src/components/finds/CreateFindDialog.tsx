import { useEffect, useState, useMemo, useRef } from 'react';
import { SpeciesNameEditor } from './SpeciesNameEditor';
import { LocationNoteInput } from './LocationNoteInput';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { readDir } from '@tauri-apps/plugin-fs';
import { convertFileSrc } from '@tauri-apps/api/core';
import { ChevronLeft, ChevronRight, Crop, Images, Loader2, Minus, Plus, RotateCw, Save, X, ZoomIn } from 'lucide-react';
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
import { DateInput } from '@/components/ui/date-input';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAddFindPhotos, useCreateFind, useFinds, useSpeciesProfiles, useUpsertSpeciesProfile } from '@/hooks/useFinds';
import { useAppStore } from '@/stores/appStore';
import { useT } from '@/i18n/index';
import { reverseGeocode } from '@/lib/geocoding';
import { LocationPickerMap } from '@/components/map/LocationPickerMap';
import { PickLocationButton } from '@/components/map/PickLocationButton';
import { isInternalLibraryName } from '@/lib/internalEntries';
import { compareSpeciesNames, plainSpeciesName } from '@/lib/speciesName';
import { cn } from '@/lib/utils';
import { editSourcePhotoImage, isHeic, SUPPORTED_EXTENSIONS } from '@/lib/finds';

interface FormState {
  species_name: string;
  common_name: string;
  date_found: string;
  country: string;
  region: string;
  location_note: string;
  lat: string;
  lng: string;
  notes: string;
  observed_count_range: string;
  species_description: string;
}

function parseObservedRangeInput(value: string) {
  const trimmed = value.trim();
  if (trimmed === '') return { min: null as number | null, max: null as number | null, representative: null as number | null };

  const match = trimmed.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
  if (!match) return { min: null, max: null, representative: null };

  const first = Number.parseInt(match[1], 10);
  const second = match[2] ? Number.parseInt(match[2], 10) : first;
  const min = Math.min(first, second);
  const max = Math.max(first, second);
  return { min, max, representative: Math.round((min + max) / 2) };
}

function isObservedRangeInputValid(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === '' || /^(\d+)(?:\s*-\s*(\d+))?$/.test(trimmed);
}

const BLANK_FORM: FormState = {
  species_name: '',
  common_name: '',
  date_found: '',
  country: '',
  region: '',
  location_note: '',
  lat: '',
  lng: '',
  notes: '',
  observed_count_range: '',
  species_description: '',
};

const filledTextClass =
  'border-primary/65 bg-primary/10 font-serif text-[15px] font-semibold shadow-[inset_3px_0_0_var(--primary)] placeholder:font-sans placeholder:text-muted-foreground/45 dark:bg-primary/12';
const filledUiTextClass =
  'border-primary/65 bg-primary/10 font-semibold shadow-[inset_3px_0_0_var(--primary)] placeholder:font-normal placeholder:text-muted-foreground/45 dark:bg-primary/12';
const filledNumericClass =
  'border-primary/65 bg-primary/10 font-mono text-[13px] font-semibold shadow-[inset_3px_0_0_var(--primary)] placeholder:font-sans placeholder:text-muted-foreground/45 dark:bg-primary/12';

function filledClass(value: string, variant: 'text' | 'ui' | 'numeric' = 'text') {
  if (!value.trim()) return undefined;
  if (variant === 'numeric') return filledNumericClass;
  if (variant === 'ui') return filledUiTextClass;
  return filledTextClass;
}

const CREATE_FIND_DRAFT_KEY = 'bili:create-find-draft';

interface CreateFindDraft {
  form: FormState;
  commonNameManuallyEdited: boolean;
  lastAutoCommonName: string;
}

function loadCreateFindDraft(): CreateFindDraft | null {
  try {
    const raw = localStorage.getItem(CREATE_FIND_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CreateFindDraft>;
    if (!parsed.form || typeof parsed.form !== 'object') return null;
    return {
      form: { ...BLANK_FORM, ...parsed.form },
      commonNameManuallyEdited: Boolean(parsed.commonNameManuallyEdited),
      lastAutoCommonName: typeof parsed.lastAutoCommonName === 'string' ? parsed.lastAutoCommonName : '',
    };
  } catch {
    return null;
  }
}

function saveCreateFindDraft(draft: CreateFindDraft) {
  try {
    localStorage.setItem(CREATE_FIND_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Draft persistence is best-effort; the in-memory form still works.
  }
}

function clearCreateFindDraft() {
  try {
    localStorage.removeItem(CREATE_FIND_DRAFT_KEY);
  } catch {
    // Ignore unavailable localStorage.
  }
}

function filenameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function sourcePhotoSrc(path: string): string {
  return convertFileSrc(path.replace(/\\/g, '/'));
}

type CropSelection = { x: number; y: number; width: number; height: number };

function isEditableRasterPhoto(path: string): boolean {
  return /\.(jpe?g|png|webp|tiff?|bmp)$/i.test(path);
}

interface SourcePhotoViewerProps {
  open: boolean;
  photos: string[];
  currentIndex: number;
  onOpenChange: (open: boolean) => void;
  onIndexChange: (index: number) => void;
  onReplacePhoto: (index: number, path: string) => void;
}

function SourcePhotoViewer({ open, photos, currentIndex, onOpenChange, onIndexChange, onReplacePhoto }: SourcePhotoViewerProps) {
  const t = useT();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [pendingRotation, setPendingRotation] = useState(0);
  const [cropMode, setCropMode] = useState(false);
  const [cropSelection, setCropSelection] = useState<CropSelection | null>(null);
  const [photoEditSaving, setPhotoEditSaving] = useState(false);
  const [photoEditError, setPhotoEditError] = useState<string | null>(null);
  const dragActive = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const imageWrapRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const cropDragRef = useRef<{ startX: number; startY: number } | null>(null);
  const current = photos[currentIndex] ?? null;
  const heic = current ? isHeic(current) : false;
  const canEditRaster = current != null && !heic && isEditableRasterPhoto(current);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setPendingRotation(0);
    setCropMode(false);
    setCropSelection(null);
    setPhotoEditError(null);
  }, [currentIndex, open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && currentIndex > 0) onIndexChange(currentIndex - 1);
      if (event.key === 'ArrowRight' && currentIndex < photos.length - 1) onIndexChange(currentIndex + 1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentIndex, onIndexChange, open, photos.length]);

  if (!current) return null;
  const previewTransform = `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom}) rotate(${pendingRotation}deg)`;

  const zoomBy = (factor: number) => {
    setZoom((value) => {
      const next = Math.min(5, Math.max(1, value * factor));
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleWheel = (event: React.WheelEvent) => {
    if (cropMode) return;
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1.15 : 0.87);
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    if (zoom <= 1 || cropMode) return;
    dragActive.current = true;
    dragStart.current = { mx: event.clientX, my: event.clientY, px: pan.x, py: pan.y };
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!dragActive.current) return;
    setPan({
      x: dragStart.current.px + (event.clientX - dragStart.current.mx),
      y: dragStart.current.py + (event.clientY - dragStart.current.my),
    });
  };

  const handleMouseUp = () => {
    dragActive.current = false;
  };

  function cropPoint(event: React.PointerEvent<HTMLDivElement>) {
    const bounds = imageWrapRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    return {
      x: Math.max(0, Math.min(event.clientX - bounds.left, bounds.width)),
      y: Math.max(0, Math.min(event.clientY - bounds.top, bounds.height)),
    };
  }

  function startCrop(event: React.PointerEvent<HTMLDivElement>) {
    if (!cropMode || !current || photoEditSaving) return;
    const point = cropPoint(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    cropDragRef.current = { startX: point.x, startY: point.y };
    setCropSelection({ x: point.x, y: point.y, width: 0, height: 0 });
  }

  function updateCrop(event: React.PointerEvent<HTMLDivElement>) {
    if (!cropMode || !cropDragRef.current) return;
    const point = cropPoint(event);
    if (!point) return;
    const start = cropDragRef.current;
    setCropSelection({
      x: Math.min(start.startX, point.x),
      y: Math.min(start.startY, point.y),
      width: Math.abs(point.x - start.startX),
      height: Math.abs(point.y - start.startY),
    });
  }

  function endCrop() {
    cropDragRef.current = null;
  }

  function cancelCrop() {
    setCropMode(false);
    setCropSelection(null);
    setPhotoEditError(null);
  }

  function handleRotatePhoto() {
    if (!current || !canEditRaster || photoEditSaving || cropMode) return;
    setPhotoEditError(null);
    setPendingRotation((value) => (value + 90) % 360);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  async function handleSaveRotation() {
    if (!current || !canEditRaster || photoEditSaving || pendingRotation === 0) return;
    setPhotoEditSaving(true);
    setPhotoEditError(null);
    try {
      const editedPath = await editSourcePhotoImage(current, pendingRotation, null);
      onReplacePhoto(currentIndex, editedPath);
      setPendingRotation(0);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    } catch (error) {
      setPhotoEditError(String(error));
    } finally {
      setPhotoEditSaving(false);
    }
  }

  async function handleSaveCrop() {
    if (!current || !canEditRaster || !cropSelection || !imageRef.current || !imageWrapRef.current || photoEditSaving) return;
    const bounds = imageWrapRef.current.getBoundingClientRect();
    const naturalWidth = imageRef.current.naturalWidth;
    const naturalHeight = imageRef.current.naturalHeight;
    if (!bounds.width || !bounds.height || !naturalWidth || !naturalHeight || cropSelection.width < 8 || cropSelection.height < 8) {
      setPhotoEditError(t('lightbox.cropTooSmall'));
      return;
    }
    const crop = {
      x: Math.round((cropSelection.x / bounds.width) * naturalWidth),
      y: Math.round((cropSelection.y / bounds.height) * naturalHeight),
      width: Math.round((cropSelection.width / bounds.width) * naturalWidth),
      height: Math.round((cropSelection.height / bounds.height) * naturalHeight),
    };
    setPhotoEditSaving(true);
    setPhotoEditError(null);
    try {
      const editedPath = await editSourcePhotoImage(current, 0, crop);
      onReplacePhoto(currentIndex, editedPath);
      setCropMode(false);
      setCropSelection(null);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    } catch (error) {
      setPhotoEditError(String(error));
    } finally {
      setPhotoEditSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[86vh] !w-[min(1120px,calc(100vw-2rem))] !max-w-none flex-col overflow-hidden border-border/50 bg-background p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
          <div className="min-w-0">
            <DialogTitle className="truncate font-serif text-xl italic text-primary">
              {filenameFromPath(current)}
            </DialogTitle>
            <DialogDescription className="font-mono text-[11px] text-muted-foreground">
              {photos.length > 1 ? t('lightbox.photoCount', { current: currentIndex + 1, total: photos.length }) : t('edit.photos')}
            </DialogDescription>
          </div>
          <div className="mr-8 flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label={t('lightbox.zoomOut')}
              title={t('lightbox.zoomOut')}
              onClick={() => zoomBy(1 / 1.3)}
              disabled={cropMode}
              className="flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={t('lightbox.zoomIn')}
              title={t('lightbox.zoomIn')}
              onClick={() => zoomBy(1.3)}
              disabled={cropMode}
              className="flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={t('lightbox.rotatePhoto')}
              title={t('lightbox.rotatePhoto')}
              onClick={handleRotatePhoto}
              disabled={photoEditSaving || cropMode || !canEditRaster}
              className="flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
            >
              {photoEditSaving && !cropMode ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
            </button>
            <button
              type="button"
              aria-label={t('lightbox.cropPhoto')}
              title={t('lightbox.cropPhoto')}
              onClick={() => {
                if (cropMode) return;
                setPhotoEditError(null);
                setPendingRotation(0);
                setZoom(1);
                setPan({ x: 0, y: 0 });
                setCropSelection(null);
                setCropMode(true);
              }}
              disabled={photoEditSaving || cropMode || pendingRotation !== 0 || !canEditRaster}
              className="flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
            >
              <Crop className="h-4 w-4" />
            </button>
            {zoom > 1 && (
              <button
                type="button"
                aria-label={t('lightbox.resetZoom')}
                title={t('lightbox.resetZoom')}
                onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                className="flex h-8 items-center gap-1 rounded-sm px-2 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ZoomIn className="h-3.5 w-3.5" />
                {Math.round(zoom * 100)}%
              </button>
            )}
          </div>
        </div>
        <div
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black/90"
          onWheel={handleWheel}
          onDoubleClick={() => {
            if (zoom > 1) {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            } else {
              setZoom(2.5);
            }
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: zoom > 1 ? (dragActive.current ? 'grabbing' : 'grab') : 'zoom-in' }}
        >
          {heic ? (
            <div className="flex flex-col items-center gap-2 text-white/55">
              <Images className="h-10 w-10" />
              <span className="font-mono text-xs">HEIC</span>
              <span className="max-w-md truncate text-xs">{filenameFromPath(current)}</span>
            </div>
          ) : (
            <div
              ref={imageWrapRef}
              className={`relative max-h-full max-w-full select-none ${cropMode ? 'cursor-crosshair' : ''}`}
              style={{
                transform: previewTransform,
                transformOrigin: 'center center',
              }}
              onPointerDown={startCrop}
              onPointerMove={updateCrop}
              onPointerUp={endCrop}
              onPointerCancel={endCrop}
            >
              <img
                ref={imageRef}
                src={sourcePhotoSrc(current)}
                alt={filenameFromPath(current)}
                className="max-h-full max-w-full select-none object-contain"
                draggable={false}
              />
              {cropMode && (
                <div className="absolute inset-0 bg-black/20">
                  {cropSelection && cropSelection.width > 0 && cropSelection.height > 0 && (
                    <div
                      className="absolute border-2 border-primary bg-primary/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.42)]"
                      style={{
                        left: cropSelection.x,
                        top: cropSelection.y,
                        width: cropSelection.width,
                        height: cropSelection.height,
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          )}
          {photoEditError && (
            <div className={`absolute left-1/2 max-w-[80%] -translate-x-1/2 rounded-md border border-destructive/40 bg-background/95 px-3 py-1.5 text-xs font-medium text-destructive shadow-lg ${cropMode ? 'bottom-24' : 'bottom-10'}`}>
              {photoEditError}
            </div>
          )}
          {cropMode && (
            <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center px-4">
              <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-primary/35 bg-black/70 p-1.5 text-white shadow-xl backdrop-blur-md">
                <span className="hidden px-2 text-xs font-medium text-white/75 sm:inline">
                  {t('lightbox.cropHint')}
                </span>
                <button
                  type="button"
                  onClick={cancelCrop}
                  disabled={photoEditSaving}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-white/80 transition-colors hover:bg-white/12 hover:text-white disabled:opacity-45"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleSaveCrop}
                  disabled={photoEditSaving || !cropSelection || cropSelection.width < 8 || cropSelection.height < 8}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-45"
                >
                  {photoEditSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {t('edit.save')}
                </button>
              </div>
            </div>
          )}
          {pendingRotation !== 0 && !cropMode && (
            <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center px-4">
              <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-primary/35 bg-black/70 p-1.5 text-white shadow-xl backdrop-blur-md">
                <span className="hidden px-2 text-xs font-medium text-white/75 sm:inline">
                  {t('lightbox.rotatePhoto')} {pendingRotation}°
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPendingRotation(0);
                    setPhotoEditError(null);
                  }}
                  disabled={photoEditSaving}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-white/80 transition-colors hover:bg-white/12 hover:text-white disabled:opacity-45"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleSaveRotation}
                  disabled={photoEditSaving}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-45"
                >
                  {photoEditSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {t('edit.save')}
                </button>
              </div>
            </div>
          )}
          {currentIndex > 0 && (
            <button
              type="button"
              aria-label={t('lightbox.prev')}
              onClick={() => onIndexChange(currentIndex - 1)}
              className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white/70 transition-colors hover:bg-black/75 hover:text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {currentIndex < photos.length - 1 && (
            <button
              type="button"
              aria-label={t('lightbox.next')}
              onClick={() => onIndexChange(currentIndex + 1)}
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white/70 transition-colors hover:bg-black/75 hover:text-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface CreateFindDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateFindDialog({ open, onOpenChange }: CreateFindDialogProps) {
  const t = useT();
  const storagePath = useAppStore((s) => s.storagePath);
  const createMutation = useCreateFind();
  const addPhotosMutation = useAddFindPhotos();
  const upsertSpeciesProfile = useUpsertSpeciesProfile();
  const { data: findsData } = useFinds();
  const { data: speciesProfilesData } = useSpeciesProfiles();
  const [speciesFolders, setSpeciesFolders] = useState<string[]>([]);
  const lastAutoCommonNameRef = useRef<string>('');
  const speciesNameSet = useMemo(() => {
    const set = new Set<string>();
    for (const find of findsData ?? []) {
      if (find.species_name) set.add(find.species_name.toLowerCase());
    }
    return set;
  }, [findsData]);
  const speciesProfilesByLowerName = useMemo(() => {
    const map = new Map<string, NonNullable<typeof speciesProfilesData>[number]>();
    for (const profile of speciesProfilesData ?? []) {
      map.set(profile.species_name.toLowerCase(), profile);
      map.set(plainSpeciesName(profile.species_name).toLowerCase(), profile);
    }
    return map;
  }, [speciesProfilesData]);
  const knownCommonNames = useMemo(() => {
    const set = new Set<string>();
    for (const profile of speciesProfilesData ?? []) {
      if (profile.common_name) set.add(profile.common_name.trim().toLowerCase());
    }
    return set;
  }, [speciesProfilesData]);
  const speciesSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const values = [
      ...speciesFolders,
      ...(findsData ?? []).map((find) => find.species_name),
    ];
    return values.filter((value) => {
      const trimmed = value.trim();
      const key = trimmed.toLowerCase();
      if (!trimmed || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort(compareSpeciesNames);
  }, [findsData, speciesFolders]);

  const speciesSuggestionsProfiles = useMemo(() => {
    const map = new Map<string, { common_name?: string | null; synonyms?: string[] | null; other_names?: string[] | null }>();
    for (const profile of speciesProfilesData ?? []) {
      map.set(profile.species_name, {
        common_name: profile.common_name,
        synonyms: profile.synonyms,
        other_names: profile.other_names,
      });
    }
    return map;
  }, [speciesProfilesData]);

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => loadCreateFindDraft()?.form ?? BLANK_FORM);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0);
  const commonNameManuallyEditedRef = useRef(false);

  useEffect(() => {
    const draft = loadCreateFindDraft();
    if (!draft) return;
    commonNameManuallyEditedRef.current = draft.commonNameManuallyEdited;
    lastAutoCommonNameRef.current = draft.lastAutoCommonName;
  }, []);

  useEffect(() => {
    const hasDraft = Object.values(form).some((value) => value.trim() !== '');
    if (!hasDraft) {
      clearCreateFindDraft();
      return;
    }
    saveCreateFindDraft({
      form,
      commonNameManuallyEdited: commonNameManuallyEditedRef.current,
      lastAutoCommonName: lastAutoCommonNameRef.current,
    });
  }, [form]);

  const speciesProfile = useMemo(
    () => speciesProfilesByLowerName.get(form.species_name.trim().toLowerCase()) ?? null,
    [speciesProfilesByLowerName, form.species_name],
  );

  useEffect(() => {
    const nextCommonName = speciesProfile?.common_name ?? '';
    setForm((prev) => {
      if (commonNameManuallyEditedRef.current) return prev;
      lastAutoCommonNameRef.current = nextCommonName;
      return { ...prev, common_name: nextCommonName };
    });
  }, [speciesProfile?.species_name, speciesProfile?.common_name]);

  useEffect(() => {
    if (!open && !form.species_name.trim()) {
      lastAutoCommonNameRef.current = '';
    }
  }, [open, form.species_name]);

  // Load species folder suggestions
  useEffect(() => {
    if (!open || !storagePath) return;
    readDir(storagePath)
      .then(async (entries) => {
        const dirs = entries.filter((e) => e.isDirectory && e.name && !isInternalLibraryName(e.name));
        const nonEmptyDirs = await Promise.all(
          dirs.map(async (entry) => {
            try {
              const children = await readDir(`${storagePath}\\${entry.name}`);
              return children.length > 0 ? entry.name as string : null;
            } catch {
              return entry.name as string;
            }
          }),
        );
        setSpeciesFolders(nonEmptyDirs.filter((name): name is string => Boolean(name)));
      })
      .catch(() => setSpeciesFolders([]));
  }, [open, storagePath]);

  function handleChange(field: keyof FormState, value: string) {
    if (field === 'common_name') {
      const normalized = value.trim().toLowerCase();
      commonNameManuallyEditedRef.current = Boolean(
        normalized &&
        value !== lastAutoCommonNameRef.current &&
        !knownCommonNames.has(normalized),
      );
    }
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handlePickPhotos() {
    try {
      const selected = await openDialog({
        multiple: true,
        filters: [{ name: 'Images', extensions: SUPPORTED_EXTENSIONS.map((ext) => ext.replace('.', '')) }],
      });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      setSelectedPhotos((prev) => {
        const seen = new Set(prev);
        return [...prev, ...paths.filter((path) => {
          if (seen.has(path)) return false;
          seen.add(path);
          return true;
        })];
      });
    } catch {
      // Tauri's file picker can be cancelled or unavailable in tests; leave the form intact.
    }
  }

  function removeSelectedPhoto(path: string) {
    setSelectedPhotos((prev) => prev.filter((photoPath) => photoPath !== path));
    setPhotoViewerIndex((index) => Math.max(0, Math.min(index, selectedPhotos.length - 2)));
  }

  async function handleSave() {
    const observedRange = parseObservedRangeInput(form.observed_count_range);
    try {
      const created = await createMutation.mutateAsync({
        species_name: form.species_name,
        common_name: form.common_name.trim() || null,
        date_found: form.date_found,
        country: form.country,
        region: form.region,
        location_note: form.location_note,
        lat: form.lat !== '' ? parseFloat(form.lat) : null,
        lng: form.lng !== '' ? parseFloat(form.lng) : null,
        notes: form.notes,
        observed_count: observedRange.representative,
        observed_count_min: observedRange.min,
        observed_count_max: observedRange.max,
        edibility_note: null,
      });

      if (selectedPhotos.length > 0) {
        await addPhotosMutation.mutateAsync({ findId: created.id, sourcePaths: selectedPhotos });
      }

      if (form.species_name.trim() && (form.common_name.trim() || form.species_description.trim())) {
        await upsertSpeciesProfile.mutateAsync({
          speciesName: form.species_name.trim(),
          commonName: form.common_name.trim() || (speciesProfile?.common_name ?? null),
          coverPhotoId: speciesProfile?.cover_photo_id ?? null,
          tags: speciesProfile?.tags ?? [],
          edibility: speciesProfile?.edibility ?? null,
          threatStatus: speciesProfile?.threat_status ?? null,
          distribution: speciesProfile?.distribution ?? null,
          edibilityNote: speciesProfile?.edibility_note ?? null,
          synonyms: speciesProfile?.synonyms ?? [],
          otherNames: speciesProfile?.other_names ?? [],
          fruitingBodyCountOverride: speciesProfile?.fruiting_body_count_override ?? null,
          description: form.species_description.trim(),
        });
      }

      setForm(BLANK_FORM);
      setSelectedPhotos([]);
      setPhotoViewerOpen(false);
      setPhotoViewerIndex(0);
      commonNameManuallyEditedRef.current = false;
      lastAutoCommonNameRef.current = '';
      clearCreateFindDraft();
      onOpenChange(false);
    } catch {
      // Mutation state renders the error below.
    }
  }

  function handleCancel() {
    setForm(BLANK_FORM);
    setSelectedPhotos([]);
    setPhotoViewerOpen(false);
    setPhotoViewerIndex(0);
    commonNameManuallyEditedRef.current = false;
    lastAutoCommonNameRef.current = '';
    clearCreateFindDraft();
    onOpenChange(false);
  }

  const canSave = form.species_name.trim() !== '' && !createMutation.isPending && !addPhotosMutation.isPending;

  const isKnownSpecies = useMemo(() => {
    const name = form.species_name.trim().toLowerCase();
    if (!name) return false;
    return speciesNameSet.has(name) || speciesProfilesByLowerName.has(name);
  }, [form.species_name, speciesNameSet, speciesProfilesByLowerName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[82vh] !w-[min(1040px,calc(100vw-2rem))] !max-w-none flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-3">
          <DialogTitle>{t('create.title')}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground/80">
            {t('create.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
        <div className="space-y-3">
          <div className="grid gap-2">
            <div>
              <SpeciesNameEditor
                value={form.species_name}
                onChange={(raw) => handleChange('species_name', raw)}
                placeholder={t('edit.latinNamePlaceholder')}
                suggestions={speciesSuggestions}
                suggestionsProfiles={speciesSuggestionsProfiles}
                label={t('edit.latinName')}
                className={filledClass(form.species_name)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('edit.commonName')}</label>
              <Input
                value={form.common_name}
                onChange={(e) => handleChange('common_name', e.target.value)}
                placeholder={t('edit.commonNamePlaceholder')}
                className={filledClass(form.common_name)}
              />
            </div>
            <PickLocationButton
              hasLocation={form.lat !== '' && form.lng !== ''}
              lat={form.lat !== '' ? parseFloat(form.lat) : null}
              lng={form.lng !== '' ? parseFloat(form.lng) : null}
              onClick={() => setPickerOpen(true)}
            />
          </div>
          <div className="rounded-sm border border-border/70 bg-card/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">{t('edit.photos')}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedPhotos.length > 0
                    ? t('edit.photosSelected', { count: selectedPhotos.length, suffix: selectedPhotos.length === 1 ? '' : 's' })
                    : t('create.photosHint')}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handlePickPhotos}>
                <Images className="mr-1.5 h-4 w-4" />
                {t('import.pickPhotos')}
              </Button>
            </div>
            {selectedPhotos.length > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                {selectedPhotos.map((path, index) => {
                  const heic = isHeic(path);
                  return (
                    <div key={path} className="group relative aspect-square overflow-hidden rounded-sm border border-border/70 bg-muted">
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoViewerIndex(index);
                          setPhotoViewerOpen(true);
                        }}
                        className="flex h-full w-full items-center justify-center"
                        title={filenameFromPath(path)}
                      >
                        {heic ? (
                          <div className="flex flex-col items-center gap-1 text-muted-foreground/60">
                            <Images className="h-5 w-5" />
                            <span className="font-mono text-[10px]">HEIC</span>
                          </div>
                        ) : (
                          <img
                            src={sourcePhotoSrc(path)}
                            alt={filenameFromPath(path)}
                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                            onError={(event) => { event.currentTarget.style.display = 'none'; }}
                          />
                        )}
                        <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-1 text-left text-[10px] text-white/80 opacity-0 transition-opacity group-hover:opacity-100">
                          {filenameFromPath(path)}
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={t('import.removePhoto')}
                        title={t('import.removePhoto')}
                        onClick={() => removeSelectedPhoto(path)}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white/80 opacity-0 transition-opacity hover:bg-black/75 hover:text-white group-hover:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">{t('edit.date')}</label>
            <DateInput
              className={cn('ml-2 align-middle', filledClass(form.date_found, 'ui'))}
              value={form.date_found}
              onChange={(value) => handleChange('date_found', value)}
              aria-label={t('edit.date')}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium">{t('edit.country')}</label>
              <Input
                value={form.country}
                onChange={(e) => handleChange('country', e.target.value)}
                placeholder={t('edit.country')}
                className={filledClass(form.country, 'ui')}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('edit.region')}</label>
              <Input
                value={form.region}
                onChange={(e) => handleChange('region', e.target.value)}
                placeholder={t('edit.region')}
                className={filledClass(form.region, 'ui')}
              />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium">{t('edit.locationMark')}</label>
              <LocationNoteInput
                value={form.location_note}
                onChange={(v) => handleChange('location_note', v)}
                suggestions={locationNoteSuggestions}
                placeholder={t('edit.locationMarkPlaceholder')}
                inputClassName={filledClass(form.location_note, 'ui')}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,220px)_1fr_1fr]">
          <div>
            <div className="mb-1 flex items-center gap-1 text-sm font-medium">
              <label>{t('edit.observedCount')}</label>
              <InfoTooltip text={t('edit.observedCountHelp')} />
            </div>
            <Input
              inputMode="numeric"
              value={form.observed_count_range}
              onChange={(e) => handleChange('observed_count_range', e.target.value)}
              placeholder="npr. 15 ili 15-20"
              className={filledClass(form.observed_count_range, 'numeric')}
            />
            {!isObservedRangeInputValid(form.observed_count_range) && (
              <p className="mt-1 text-xs text-amber-600">
                Unesi broj ili raspon poput 15-20. Ovakav unos nece se spremiti.
              </p>
            )}
          </div>
            <div>
              <label className="text-sm font-medium">{t('edit.lat')}</label>
              <Input
                type="number"
                value={form.lat}
                onChange={(e) => handleChange('lat', e.target.value)}
                placeholder="e.g. 45.1234"
                className={filledClass(form.lat, 'numeric')}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('edit.lng')}</label>
              <Input
                type="number"
                value={form.lng}
                onChange={(e) => handleChange('lng', e.target.value)}
                placeholder="e.g. 13.9876"
                className={filledClass(form.lng, 'numeric')}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">{t('edit.notes')}</label>
            <Textarea
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder={t('edit.notes')}
              rows={3}
              className={filledClass(form.notes)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('edit.speciesDescription')}</label>
            <Textarea
              value={form.species_description}
              onChange={(e) => handleChange('species_description', e.target.value)}
              placeholder={speciesProfile?.description ?? speciesProfile?.edibility_note ?? t('edit.speciesDescriptionPlaceholder')}
              rows={3}
              className={filledClass(form.species_description)}
            />
            <p className="mt-1 text-xs text-muted-foreground">{t('edit.speciesDescriptionHelp')}</p>
          </div>

        </div>
        </div>

        {(createMutation.isError || addPhotosMutation.isError) && (
          <Alert variant="destructive" role="alert" className="mx-5 mt-1">
            <AlertDescription>{String(createMutation.error ?? addPhotosMutation.error)}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="border-t border-border/60 px-5 py-4">
          <Button variant="outline" onClick={handleCancel}>
            {t('edit.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {createMutation.isPending || addPhotosMutation.isPending ? t('edit.saving') : t('create.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
      <SourcePhotoViewer
        open={photoViewerOpen}
        photos={selectedPhotos}
        currentIndex={photoViewerIndex}
        onOpenChange={setPhotoViewerOpen}
        onIndexChange={setPhotoViewerIndex}
        onReplacePhoto={(index, path) => {
          setSelectedPhotos((prev) => prev.map((photoPath, photoIndex) => (
            photoIndex === index ? path : photoPath
          )));
        }}
      />
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
