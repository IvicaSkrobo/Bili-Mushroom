import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Crop, Image, Loader2, MapPin, Maximize2, Minimize2, Minus, Pencil, Plus, RotateCw, Save, Trash2, X, ZoomIn } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPortal,
} from '@/components/ui/dialog';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Button } from '@/components/ui/button';
import { editFindPhotoImage, FINDS_QUERY_KEY, isHeic, type Find, type FindPhoto, type SpeciesProfile } from '@/lib/finds';
import { resolvePhotoSrc } from '@/lib/photoSrc';
import { useT } from '@/i18n/index';
import { LocationPickerMap } from '@/components/map/LocationPickerMap';
import { useUpdateFind } from '@/hooks/useFinds';
import { useQueryClient } from '@tanstack/react-query';
import { renderSpeciesName, plainSpeciesName } from '@/lib/speciesName';
import { SpeciesMetadataBadges } from '@/components/species/SpeciesMetadataBadges';
import { useAppStore } from '@/stores/appStore';
import { formatDisplayDate } from '@/lib/dateFormat';

export interface LightboxPhoto {
  photo: FindPhoto;
  find: Find;
}

type CropSelection = { x: number; y: number; width: number; height: number };

function isEditableRasterPhoto(path: string): boolean {
  return /\.(jpe?g|png|webp|tiff?|bmp)$/i.test(path);
}

interface PhotoLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photos: LightboxPhoto[];
  fallbackFind?: Find | null;
  currentIndex: number;
  onIndexChange: (index: number) => void;
  storagePath: string;
  onSetAsSpeciesCover?: (photo: LightboxPhoto) => void;
  isCurrentSpeciesCover?: (photo: LightboxPhoto) => boolean;
  onEditFind?: (find: Find) => void;
  onDeletePhoto?: (photo: LightboxPhoto, permanentDelete: boolean) => void;
  speciesProfile?: SpeciesProfile;
}

export function PhotoLightbox({
  open,
  onOpenChange,
  photos,
  fallbackFind = null,
  currentIndex,
  onIndexChange,
  storagePath,
  onSetAsSpeciesCover,
  isCurrentSpeciesCover,
  onEditFind,
  onDeletePhoto,
  speciesProfile,
}: PhotoLightboxProps) {
  const t = useT();
  const lang = useAppStore((s) => s.language);
  const photoAssetVersion = useAppStore((s) => s.photoAssetVersion);
  const bumpPhotoAssetVersion = useAppStore((s) => s.bumpPhotoAssetVersion);
  const queryClient = useQueryClient();
  const [visible, setVisible] = useState(true);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const updateFind = useUpdateFind();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [cropMode, setCropMode] = useState(false);
  const [cropSelection, setCropSelection] = useState<CropSelection | null>(null);
  const [pendingRotation, setPendingRotation] = useState(0);
  const [photoEditSaving, setPhotoEditSaving] = useState(false);
  const [photoEditError, setPhotoEditError] = useState<string | null>(null);
  const dragActive = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const imageWrapRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const cropDragRef = useRef<{ startX: number; startY: number } | null>(null);

  // Reset zoom/pan and delete confirmation when photo/find changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setConfirmingDelete(false);
    setEditingNotes(false);
    setCropMode(false);
    setCropSelection(null);
    setPendingRotation(0);
    setPhotoEditError(null);
  }, [currentIndex, fallbackFind?.id]);

  const handleWheel = (e: React.WheelEvent) => {
    if (!photos[currentIndex]?.photo || cropMode) return;
    e.preventDefault();
    setZoom((prev) => {
      const next = Math.min(5, Math.max(1, prev * (e.deltaY < 0 ? 1.15 : 0.87)));
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleDoubleClick = () => {
    if (!photos[currentIndex]?.photo || cropMode) return;
    if (zoom > 1) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    } else {
      setZoom(2.5);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!photos[currentIndex]?.photo || cropMode || zoom <= 1) return;
    dragActive.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragActive.current) return;
    setPan({
      x: dragStart.current.px + (e.clientX - dragStart.current.mx),
      y: dragStart.current.py + (e.clientY - dragStart.current.my),
    });
  };

  const handleMouseUp = () => { dragActive.current = false; };

  function cropPoint(event: React.PointerEvent<HTMLDivElement>) {
    const bounds = imageWrapRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    return {
      x: Math.max(0, Math.min(event.clientX - bounds.left, bounds.width)),
      y: Math.max(0, Math.min(event.clientY - bounds.top, bounds.height)),
    };
  }

  function startCrop(event: React.PointerEvent<HTMLDivElement>) {
    if (!cropMode || !photo || photoEditSaving) return;
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

  function cancelRotation() {
    setPendingRotation(0);
    setPhotoEditError(null);
  }

  const current = photos[currentIndex];

  const prev = () => {
    if (currentIndex > 0) {
      setVisible(false);
      setTimeout(() => {
        onIndexChange(currentIndex - 1);
        setVisible(true);
      }, 150);
    }
  };

  const next = () => {
    if (currentIndex < photos.length - 1) {
      setVisible(false);
      setTimeout(() => {
        onIndexChange(currentIndex + 1);
        setVisible(true);
      }, 150);
    }
  };

  // Exit fullscreen when lightbox closes
  useEffect(() => {
    if (!open) setIsFullscreen(false);
  }, [open]);

  // Keyboard navigation + fullscreen toggle
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onIndexChange(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < photos.length - 1) {
        onIndexChange(currentIndex + 1);
      } else if (e.key === 'F11') {
        e.preventDefault();
        setIsFullscreen((v) => !v);
      }
      // Esc is handled natively by Radix Dialog
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, currentIndex, photos.length, onIndexChange]);

  if (!current && !fallbackFind) return null;

  const photo = current?.photo ?? null;
  const find = current?.find ?? fallbackFind!;
  const heic = photo ? isHeic(photo.photo_path) : false;
  const canEditRaster = photo != null && !heic && isEditableRasterPhoto(photo.photo_path);
  const renderedPhotoSrc = photo && !heic ? resolvePhotoSrc(storagePath, photo.photo_path, photoAssetVersion) : null;
  const isSpeciesCover = current ? (isCurrentSpeciesCover?.(current) ?? false) : false;

  // Observed count display for this find
  const obsMin = find.observed_count_min ?? find.observed_count;
  const obsMax = find.observed_count_max ?? find.observed_count_min ?? find.observed_count;
  const observedDisplay = obsMin != null
    ? (obsMin === obsMax ? String(obsMin) : `${obsMin}–${obsMax}`)
    : null;

  function handleRotatePhoto() {
    if (!photo || !canEditRaster || photoEditSaving || cropMode) return;
    setPhotoEditError(null);
    setPendingRotation((value) => (value + 90) % 360);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  async function handleSaveRotation() {
    if (!photo || !canEditRaster || photoEditSaving || pendingRotation === 0) return;
    setPhotoEditSaving(true);
    setPhotoEditError(null);
    try {
      await editFindPhotoImage(storagePath, photo.id, pendingRotation, null);
      bumpPhotoAssetVersion();
      setPendingRotation(0);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      await queryClient.invalidateQueries({ queryKey: [FINDS_QUERY_KEY, storagePath] });
    } catch (error) {
      setPhotoEditError(String(error));
    } finally {
      setPhotoEditSaving(false);
    }
  }

  async function handleSaveCrop() {
    if (!photo || !canEditRaster || !cropSelection || !imageRef.current || !imageWrapRef.current || photoEditSaving) return;
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
      await editFindPhotoImage(storagePath, photo.id, 0, crop);
      bumpPhotoAssetVersion();
      setCropMode(false);
      setCropSelection(null);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      await queryClient.invalidateQueries({ queryKey: [FINDS_QUERY_KEY, storagePath] });
    } catch (error) {
      setPhotoEditError(String(error));
    } finally {
      setPhotoEditSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        {/* Darker cinematic overlay */}
        <DialogOverlay className="bg-black/85" />

        <DialogPrimitive.Content
          className={`fixed z-50 flex outline-none overflow-hidden border border-border/40 bg-background shadow-2xl data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 ${
            isFullscreen
              ? 'inset-0 top-0 left-0 w-full h-full max-w-none max-h-none rounded-none translate-x-0 translate-y-0'
              : 'top-[50%] left-[50%] w-full max-w-4xl max-h-[85vh] translate-x-[-50%] translate-y-[-50%] rounded-lg data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
          }`}
          onEscapeKeyDown={() => { if (isFullscreen) { setIsFullscreen(false); } else { onOpenChange(false); } }}
        >
          <DialogPrimitive.Title className="sr-only">
            {find.species_name || t('findCard.unnamed')}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {photos.length > 0
              ? t('lightbox.photoCount', { current: currentIndex + 1, total: photos.length })
              : (find.species_name || t('findCard.unnamed'))}
          </DialogPrimitive.Description>

          {/* Photo area */}
          <div className="relative flex flex-1 min-w-0 flex-col items-center justify-center bg-black/60 min-h-0">

            {/* Photo */}
            <div
              className="flex flex-1 w-full items-center justify-center min-h-0 overflow-hidden"
              style={{
                opacity: visible ? 1 : 0,
                transition: 'opacity 0.15s ease',
                cursor: photo ? (zoom > 1 ? (dragActive.current ? 'grabbing' : 'grab') : 'zoom-in') : 'default',
              }}
              onWheel={handleWheel}
              onDoubleClick={handleDoubleClick}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {!photo ? (
                <div className="flex flex-col items-center gap-3 text-muted-foreground/45">
                  <Image className="h-12 w-12" />
                  <span className="text-sm font-medium">
                    {t('species.noCoverOptions')}
                  </span>
                </div>
              ) : heic ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground/40">
                  <span className="font-mono text-[11px]">HEIC</span>
                  <span className="text-xs">{photo.photo_path.split('/').pop()}</span>
                </div>
              ) : (
                <div
                  ref={imageWrapRef}
                  className={`relative max-w-full max-h-full select-none ${cropMode ? 'cursor-crosshair' : ''}`}
                  style={{
                    maxHeight: isFullscreen ? 'calc(100vh - 2rem)' : 'calc(85vh - 2rem)',
                    transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                    transformOrigin: 'center center',
                  }}
                  onPointerDown={startCrop}
                  onPointerMove={updateCrop}
                  onPointerUp={endCrop}
                  onPointerCancel={endCrop}
                >
                  <img
                    ref={imageRef}
                    src={renderedPhotoSrc!}
                    alt={find.species_name || photo.photo_path}
                    className="max-w-full max-h-full object-contain transition-transform duration-150"
                    style={{
                      maxHeight: isFullscreen ? 'calc(100vh - 2rem)' : 'calc(85vh - 2rem)',
                      transform: pendingRotation ? `rotate(${pendingRotation}deg)` : undefined,
                    }}
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
            </div>

            {/* Photo counter */}
            {photos.length > 1 && !cropMode && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 font-mono text-[11px] text-white/50 bg-black/40 px-2 py-0.5 rounded-full pointer-events-none">
                {currentIndex + 1} / {photos.length}
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
                    onClick={cancelRotation}
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

            {/* Prev button */}
            {currentIndex > 0 && (
              <button
                type="button"
                aria-label={t('lightbox.prev')}
                onClick={prev}
                className="absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white/60 hover:bg-black/70 hover:text-white transition-all duration-150"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}

            {/* Next button */}
            {currentIndex < photos.length - 1 && (
              <button
                type="button"
                aria-label={t('lightbox.next')}
                onClick={next}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white/60 hover:bg-black/70 hover:text-white transition-all duration-150"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Metadata panel */}
          <div className="flex w-64 min-w-0 flex-shrink-0 flex-col border-l border-primary/20 bg-card/80 backdrop-blur-sm overflow-y-auto">
            {/* Amber top border accent */}
            <div className="h-0.5 w-full bg-primary/40 flex-shrink-0" />

            {/* Header: species name + date + action icons */}
            <div className="flex items-start justify-between gap-2 px-5 pt-5 pb-3">
              <div className="min-w-0 flex-1">
                <p className="font-serif text-lg font-semibold leading-snug text-foreground" title={find.species_name ? plainSpeciesName(find.species_name) : undefined}>
                  {find.species_name ? renderSpeciesName(find.species_name) : t('findCard.unnamed')}
                </p>
                {find.date_found && (
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground/80">{formatDisplayDate(find.date_found, lang)}</p>
                )}
              </div>

              {/* Small action icons — top-right corner */}
              <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
              {confirmingDelete && current ? (
                  /* Inline delete confirmation */
                  <div className="flex items-center gap-1 rounded border border-rose-500/30 bg-rose-500/8 px-2 py-0.5">
                    <span className="text-[11px] font-medium text-rose-400/80 pr-1">
                      {t('lightbox.deletePhoto')}?
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      className="text-[11px] font-medium text-muted-foreground/60 hover:text-foreground transition-colors px-1"
                    >
                      {t('common.cancel') ?? 'Odustani'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { onDeletePhoto!(current, false); onOpenChange(false); }}
                      className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 transition-colors px-1"
                    >
                      {t('common.delete') ?? 'Obriši'}
                    </button>
                  </div>
                ) : (
                  <>
                    {onEditFind && (
                      <button
                        type="button"
                        title={t('edit.title')}
                        onClick={() => { onEditFind(find); onOpenChange(false); }}
                        className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground/60 hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {current && onSetAsSpeciesCover && (
                      <button
                        type="button"
                        title={isSpeciesCover ? t('collection.currentRepresentativePhoto') : t('collection.setRepresentativePhoto')}
                        onClick={() => !isSpeciesCover && onSetAsSpeciesCover(current)}
                        disabled={isSpeciesCover}
                        className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${isSpeciesCover ? 'text-primary/80 cursor-default' : 'text-muted-foreground/60 hover:bg-primary/10 hover:text-primary'}`}
                      >
                        {isSpeciesCover ? <Check className="h-3.5 w-3.5" /> : <Image className="h-3.5 w-3.5" />}
                      </button>
                    )}
                    {current && onDeletePhoto && (
                      <button
                        type="button"
                        title={t('lightbox.deletePhoto')}
                        onClick={() => setConfirmingDelete(true)}
                        className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground/60 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Species status badges */}
            <div className="px-5 pb-4">
              <SpeciesMetadataBadges speciesProfile={speciesProfile} size="md" hideUnknown={true} />
            </div>

            <div className="mx-5 border-t border-border/20" />

            {/* Find data — main focus area */}
            <div className="flex min-h-0 flex-1 flex-col gap-5 px-5 py-4">

              {/* Observed count — prominent */}
              {/* Location block */}
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/90">
                  {t('lightbox.location')}
                </p>
                {(find.country || find.region) && (
                  <div className="mb-1 flex flex-col gap-0.5">
                    {find.country && <span className="text-xs font-medium text-foreground/90">{find.country}</span>}
                    {find.region && <span className="text-xs font-medium text-foreground/90">{find.region}</span>}
                  </div>
                )}
                <button
                  type="button"
                  className="group/loc flex items-start gap-1.5 text-left -mx-1 px-1 py-0.5 rounded hover:bg-primary/10 transition-colors"
                  onClick={() => setLocationPickerOpen(true)}
                  title={t('lightbox.changeLocation')}
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70 group-hover/loc:text-primary transition-colors" />
                  <span className="text-sm font-semibold text-foreground leading-snug group-hover/loc:text-primary transition-colors">
                    {find.location_note || <span className="text-muted-foreground/40 italic">{t('lightbox.addLocation')}</span>}
                  </span>
                </button>
                {find.lat !== null && find.lng !== null && (
                  <p className="mt-1.5 font-mono text-[10px] text-muted-foreground/80 bg-muted/40 rounded px-1.5 py-0.5 w-fit">
                    {find.lat?.toFixed(5)}, {find.lng?.toFixed(5)}
                  </p>
                )}
              </div>

              {/* Notes — inline edit/add */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/90">
                    {t('lightbox.notes')}
                  </p>
                  {!editingNotes && (
                    <button
                      type="button"
                      onClick={() => { setNotesValue(find.notes ?? ''); setEditingNotes(true); }}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground/65 hover:text-primary transition-colors"
                      title={find.notes ? t('lightbox.editNote') : t('lightbox.addNote')}
                    >
                      {find.notes ? <Pencil className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                      {find.notes ? t('lightbox.edit') : t('lightbox.add')}
                    </button>
                  )}
                </div>
                {editingNotes ? (
                  <div className="flex flex-col gap-1.5">
                    <textarea
                      autoFocus
                      value={notesValue}
                      onChange={(e) => setNotesValue(e.target.value)}
                      rows={4}
                      className="w-full rounded border border-border/60 bg-background/40 px-2.5 py-1.5 text-sm font-medium text-foreground leading-relaxed resize-none outline-none focus:border-primary/60 focus:ring-1 focus:ring-ring"
                    />
                    <div className="flex gap-1.5 justify-end">
                      <button
                        type="button"
                        onClick={() => setEditingNotes(false)}
                        className="rounded px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          updateFind.mutate({
                            id: find.id,
                            species_name: find.species_name ?? '',
                            date_found: find.date_found ?? '',
                            country: find.country ?? '',
                            region: find.region ?? '',
                            location_note: find.location_note ?? '',
                            lat: find.lat ?? null,
                            lng: find.lng ?? null,
                            notes: notesValue,
                            observed_count: find.observed_count ?? null,
                            observed_count_min: find.observed_count_min ?? null,
                            observed_count_max: find.observed_count_max ?? null,
                          });
                          setEditingNotes(false);
                        }}
                        className="rounded px-2.5 py-1 text-xs bg-primary/20 text-primary hover:bg-primary/30 transition-colors flex items-center gap-1"
                      >
                        <Check className="h-3 w-3" /> {t('edit.save')}
                      </button>
                    </div>
                  </div>
                ) : find.notes ? (
                  <p className="text-sm font-semibold text-foreground leading-relaxed overflow-y-auto max-h-40">
                    {find.notes}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground/30 italic">{t('lightbox.noNotes')}</p>
                )}
              </div>
              {observedDisplay && (
                <div className="mt-auto border-t border-border/25 pt-4">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/90">
                    {t('species.observedCount')}
                  </p>
                  <p className="font-mono text-3xl font-bold text-primary leading-none">
                    {observedDisplay}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Top-left controls: fullscreen + zoom */}
          <div className="absolute top-3 left-3 flex items-center gap-1 z-10">
            {/* Fullscreen toggle */}
            <button
              type="button"
              aria-label={isFullscreen ? t('lightbox.exitFullscreen') : t('lightbox.fullscreen')}
              title={isFullscreen ? t('lightbox.exitFullscreenTitle') : t('lightbox.fullscreen')}
              onClick={() => setIsFullscreen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/60 hover:bg-black/70 hover:text-white transition-all duration-150"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>

            {/* Zoom controls */}
            {photo && (
              <>
                <button
                  type="button"
                  aria-label={t('lightbox.rotatePhoto')}
                  title={t('lightbox.rotatePhoto')}
                  onClick={handleRotatePhoto}
                  disabled={photoEditSaving || cropMode || !canEditRaster}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/60 hover:bg-black/70 hover:text-white transition-all duration-150 disabled:opacity-40"
                >
                  {photoEditSaving && !cropMode ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  aria-label={t('lightbox.cropPhoto')}
                  title={t('lightbox.cropPhoto')}
                  onClick={() => {
                    if (cropMode) return;
                    setCropMode((v) => {
                      const next = !v;
                      if (next) {
                        setZoom(1);
                        setPan({ x: 0, y: 0 });
                        setCropSelection(null);
                      }
                      return next;
                    });
                  }}
                  disabled={photoEditSaving || cropMode || pendingRotation !== 0 || !canEditRaster}
                  className={`flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/60 transition-all duration-150 hover:bg-black/70 hover:text-white disabled:opacity-40 ${cropMode ? 'ring-1 ring-primary/70 text-white' : ''}`}
                >
                  <Crop className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={t('lightbox.zoomIn')}
                  title={t('lightbox.zoomIn')}
                  onClick={() => setZoom((z) => Math.min(5, z * 1.3))}
                  disabled={cropMode}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/60 hover:bg-black/70 hover:text-white transition-all duration-150 disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={t('lightbox.zoomOut')}
                  title={t('lightbox.zoomOut')}
                  onClick={() => setZoom((z) => { const next = Math.max(1, z / 1.3); if (next <= 1) setPan({ x: 0, y: 0 }); return next; })}
                  disabled={cropMode}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/60 hover:bg-black/70 hover:text-white transition-all duration-150 disabled:opacity-40"
                >
                  <Minus className="h-4 w-4" />
                </button>
              </>
            )}
            {photo && zoom > 1 && (
              <button
                type="button"
                aria-label={t('lightbox.resetZoom')}
                title={t('lightbox.resetZoom')}
                onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                className="flex h-8 items-center justify-center rounded-full bg-black/40 px-2 text-white/60 hover:bg-black/70 hover:text-white transition-all duration-150"
              >
                <ZoomIn className="h-3.5 w-3.5 mr-1" />
                <span className="font-mono text-[11px]">{Math.round(zoom * 100)}%</span>
              </button>
            )}
          </div>

          {/* Close button */}
          <DialogClose
            aria-label={t('lightbox.close')}
            className={`absolute top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white/60 hover:bg-black/70 hover:text-white transition-all duration-150 z-10 ${isFullscreen ? 'right-3' : 'right-[272px]'}`}
          >
            <X className="h-4 w-4" />
          </DialogClose>
        </DialogPrimitive.Content>
      </DialogPortal>
      <LocationPickerMap
        open={locationPickerOpen}
        onOpenChange={setLocationPickerOpen}
        initialLatLng={find.lat != null && find.lng != null ? { lat: find.lat, lng: find.lng } : null}
        onConfirm={(lat, lng, locationNote) => {
          updateFind.mutate({
            id: find.id,
            species_name: find.species_name ?? '',
            date_found: find.date_found ?? '',
            country: find.country ?? '',
            region: find.region ?? '',
            location_note: locationNote ?? find.location_note ?? '',
            lat,
            lng,
            notes: find.notes ?? '',
            observed_count: find.observed_count ?? null,
            observed_count_min: find.observed_count_min ?? null,
            observed_count_max: find.observed_count_max ?? null,
          });
          setLocationPickerOpen(false);
        }}
      />
    </Dialog>
  );
}
