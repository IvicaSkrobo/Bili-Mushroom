import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Image, MapPin, Maximize2, Minimize2, Minus, Pencil, Plus, Trash2, X, ZoomIn } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPortal,
} from '@/components/ui/dialog';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Button } from '@/components/ui/button';
import { isHeic, type Find, type FindPhoto, type SpeciesProfile } from '@/lib/finds';
import { resolvePhotoSrc } from '@/lib/photoSrc';
import { useT } from '@/i18n/index';
import { LocationPickerMap } from '@/components/map/LocationPickerMap';
import { useUpdateFind } from '@/hooks/useFinds';
import { renderSpeciesName, plainSpeciesName } from '@/lib/speciesName';
import { SpeciesMetadataBadges } from '@/components/species/SpeciesMetadataBadges';

export interface LightboxPhoto {
  photo: FindPhoto;
  find: Find;
}

interface PhotoLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photos: LightboxPhoto[];
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
  const [visible, setVisible] = useState(true);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [permanentPhotoDelete, setPermanentPhotoDelete] = useState(true);
  const updateFind = useUpdateFind();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragActive = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  // Reset zoom/pan when photo changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [currentIndex]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => {
      const next = Math.min(5, Math.max(1, prev * (e.deltaY < 0 ? 1.15 : 0.87)));
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleDoubleClick = () => {
    if (zoom > 1) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    } else {
      setZoom(2.5);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
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
      } else if (e.key === 'f' || e.key === 'F') {
        setIsFullscreen((v) => !v);
      }
      // Esc is handled natively by Radix Dialog
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, currentIndex, photos.length, onIndexChange]);

  if (!current) return null;

  const { photo, find } = current;
  const heic = isHeic(photo.photo_path);
  const photoSrc = heic ? null : resolvePhotoSrc(storagePath, photo.photo_path);
  const isSpeciesCover = isCurrentSpeciesCover?.(current) ?? false;

  // Observed count display for this find
  const obsMin = find.observed_count_min ?? find.observed_count;
  const obsMax = find.observed_count_max ?? find.observed_count_min ?? find.observed_count;
  const observedDisplay = obsMin != null
    ? (obsMin === obsMax ? String(obsMin) : `${obsMin}–${obsMax}`)
    : null;

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
            {t('lightbox.photoCount', { current: currentIndex + 1, total: photos.length })}
          </DialogPrimitive.Description>

          {/* Photo area */}
          <div className="relative flex flex-1 min-w-0 flex-col items-center justify-center bg-black/60 min-h-0">

            {/* Photo */}
            <div
              className="flex flex-1 w-full items-center justify-center min-h-0 overflow-hidden"
              style={{
                opacity: visible ? 1 : 0,
                transition: 'opacity 0.15s ease',
                cursor: zoom > 1 ? (dragActive.current ? 'grabbing' : 'grab') : 'zoom-in',
              }}
              onWheel={handleWheel}
              onDoubleClick={handleDoubleClick}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {heic ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground/40">
                  <span className="font-mono text-[11px]">HEIC</span>
                  <span className="text-xs">{photo.photo_path.split('/').pop()}</span>
                </div>
              ) : (
                <img
                  src={photoSrc!}
                  alt={find.species_name || photo.photo_path}
                  className="max-w-full max-h-full object-contain select-none"
                  style={{
                    maxHeight: isFullscreen ? 'calc(100vh - 2rem)' : 'calc(85vh - 2rem)',
                    transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                    transformOrigin: 'center center',
                  }}
                  draggable={false}
                />
              )}
            </div>

            {/* Photo counter */}
            {photos.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 font-mono text-[11px] text-white/50 bg-black/40 px-2 py-0.5 rounded-full pointer-events-none">
                {currentIndex + 1} / {photos.length}
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
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground/60">{find.date_found}</p>
                )}
              </div>

              {/* Small action icons — top-right corner */}
              <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
                {onEditFind && (
                  <button
                    type="button"
                    title={t('edit.title')}
                    onClick={() => { onEditFind(current.find); onOpenChange(false); }}
                    className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground/60 hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                {onDeletePhoto && (
                  <button
                    type="button"
                    title={t('lightbox.deletePhoto')}
                    onClick={() => { onDeletePhoto(current, permanentPhotoDelete); onOpenChange(false); }}
                    className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground/60 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                {onSetAsSpeciesCover && (
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
              </div>
            </div>

            {onDeletePhoto && (
              <label className="mx-5 mb-3 inline-flex items-center gap-1.5 rounded border border-destructive/30 bg-destructive/5 px-2 py-1 text-[11px] font-medium text-destructive">
                <input
                  type="checkbox"
                  checked={permanentPhotoDelete}
                  onChange={(event) => setPermanentPhotoDelete(event.target.checked)}
                  className="h-3.5 w-3.5 accent-current"
                />
                Permanently delete file
              </label>
            )}

            {/* Edibility badge */}
            <div className="px-5 pb-4">
              <SpeciesMetadataBadges speciesProfile={speciesProfile} size="md" hideUnknown={true} />
            </div>

            <div className="mx-5 border-t border-border/20" />

            {/* Find data — main focus area */}
            <div className="flex min-h-0 flex-1 flex-col gap-5 px-5 py-4">

              {/* Observed count — prominent */}
              {observedDisplay && (
                <div>
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
                    {t('species.observedCount')}
                  </p>
                  <p className="font-mono text-3xl font-semibold text-primary leading-none">
                    {observedDisplay}
                  </p>
                </div>
              )}

              {/* Location block */}
              <div>
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
                  {t('lightbox.location')}
                </p>
                {(find.country || find.region) && (
                  <div className="mb-1 flex flex-col gap-0.5">
                    {find.country && <span className="text-xs text-muted-foreground/70">{find.country}</span>}
                    {find.region && <span className="text-xs text-muted-foreground/70">{find.region}</span>}
                  </div>
                )}
                <button
                  type="button"
                  className="group/loc flex items-start gap-1.5 text-left -mx-1 px-1 py-0.5 rounded hover:bg-primary/10 transition-colors"
                  onClick={() => setLocationPickerOpen(true)}
                  title={t('lightbox.changeLocation')}
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70 group-hover/loc:text-primary transition-colors" />
                  <span className="text-sm text-foreground/75 leading-snug group-hover/loc:text-foreground/90 transition-colors">
                    {find.location_note || <span className="text-muted-foreground/40 italic">{t('lightbox.addLocation')}</span>}
                  </span>
                </button>
                {find.lat !== null && find.lng !== null && (
                  <p className="mt-1.5 font-mono text-[10px] text-muted-foreground/50 bg-muted/30 rounded px-1.5 py-0.5 w-fit">
                    {find.lat?.toFixed(5)}, {find.lng?.toFixed(5)}
                  </p>
                )}
              </div>

              {/* Notes — full remaining space */}
              {find.notes && (
                <div className="flex-1">
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
                    {t('lightbox.notes')}
                  </p>
                  <p className="text-sm text-foreground/90 leading-relaxed overflow-y-auto max-h-52">
                    {find.notes}
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
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen (F)'}
              title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen (F)'}
              onClick={() => setIsFullscreen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/60 hover:bg-black/70 hover:text-white transition-all duration-150"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>

            {/* Zoom controls */}
            <button
              type="button"
              aria-label="Zoom in"
              title="Zoom in"
              onClick={() => setZoom((z) => Math.min(5, z * 1.3))}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/60 hover:bg-black/70 hover:text-white transition-all duration-150"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              title="Zoom out"
              onClick={() => setZoom((z) => { const next = Math.max(1, z / 1.3); if (next <= 1) setPan({ x: 0, y: 0 }); return next; })}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/60 hover:bg-black/70 hover:text-white transition-all duration-150"
            >
              <Minus className="h-4 w-4" />
            </button>
            {zoom > 1 && (
              <button
                type="button"
                aria-label="Reset zoom"
                title="Reset zoom"
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
        speciesFilter={find.species_name ?? undefined}
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
