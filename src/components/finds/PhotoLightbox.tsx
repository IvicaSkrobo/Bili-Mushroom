import { useEffect, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Check, ChevronLeft, ChevronRight, Image, X } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPortal,
} from '@/components/ui/dialog';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Button } from '@/components/ui/button';
import { isHeic, type Find, type FindPhoto } from '@/lib/finds';
import { useT } from '@/i18n/index';

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
}: PhotoLightboxProps) {
  const t = useT();
  const [visible, setVisible] = useState(true);

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

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
      // Esc is handled natively by Radix Dialog
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // prev/next are stable enough; disabling exhaustive-deps is intentional here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentIndex, photos.length]);

  if (!current) return null;

  const { photo, find } = current;
  const absolutePath = `${storagePath}/${photo.photo_path}`;
  const heic = isHeic(photo.photo_path);
  const photoSrc = heic ? null : convertFileSrc(absolutePath);
  const isSpeciesCover = isCurrentSpeciesCover?.(current) ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        {/* Darker cinematic overlay */}
        <DialogOverlay className="bg-black/85" />

        <DialogPrimitive.Content
          className="fixed top-[50%] left-[50%] z-50 flex w-full max-w-4xl max-h-[85vh] translate-x-[-50%] translate-y-[-50%] rounded-lg border border-border/40 bg-background shadow-2xl outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 overflow-hidden"
          onEscapeKeyDown={() => onOpenChange(false)}
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
              style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.15s ease' }}
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
                  className="max-w-full max-h-full object-contain"
                  style={{ maxHeight: 'calc(85vh - 2rem)' }}
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

            <div className="flex min-h-0 flex-1 flex-col gap-3 p-5">
              {/* Species name */}
              <p className="font-serif text-lg font-semibold leading-snug text-foreground">
                {find.species_name || t('findCard.unnamed')}
              </p>

              {/* Date */}
              {find.date_found && (
                <p className="text-sm text-muted-foreground">{find.date_found}</p>
              )}

              {/* Location */}
              {(find.country || find.region || find.location_note) && (
                <div className="flex flex-col gap-0.5">
                  {find.country && (
                    <span className="text-xs text-muted-foreground">{find.country}</span>
                  )}
                  {find.region && (
                    <span className="text-xs text-muted-foreground">{find.region}</span>
                  )}
                  {find.location_note && (
                    <span className="text-xs text-muted-foreground/60">{find.location_note}</span>
                  )}
                </div>
              )}

              {/* Coordinates */}
              {find.lat !== null && find.lng !== null && (
                <p className="font-mono text-[10px] text-muted-foreground/40">
                  {find.lat?.toFixed(5)}, {find.lng?.toFixed(5)}
                </p>
              )}

              {/* Notes */}
              {find.notes && (
                <div className="max-h-40 overflow-y-auto border-t border-border/30 pt-3">
                  <p className="text-sm italic text-muted-foreground/70 leading-relaxed">
                    {find.notes}
                  </p>
                </div>
              )}

              {onSetAsSpeciesCover && (
                <div className="border-t border-border/30 pt-3">
                  <Button
                    type="button"
                    variant={isSpeciesCover ? 'secondary' : 'outline'}
                    className="h-auto w-full min-w-0 justify-start gap-2 whitespace-normal py-2 text-left"
                    onClick={() => onSetAsSpeciesCover(current)}
                    disabled={isSpeciesCover}
                  >
                    {isSpeciesCover ? <Check className="h-4 w-4" /> : <Image className="h-4 w-4" />}
                    {isSpeciesCover ? t('collection.currentRepresentativePhoto') : t('collection.setRepresentativePhoto')}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Close button */}
          <DialogClose
            aria-label={t('lightbox.close')}
            className="absolute top-3 right-[272px] flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white/60 hover:bg-black/70 hover:text-white transition-all duration-150 z-10"
          >
            <X className="h-4 w-4" />
          </DialogClose>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
