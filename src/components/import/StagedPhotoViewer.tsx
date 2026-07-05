import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus, X, ZoomIn } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPortal,
} from '@/components/ui/dialog';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useT } from '@/i18n/index';

interface StagedPhotoViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photos: string[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
}

export function StagedPhotoViewer({
  open,
  onOpenChange,
  photos,
  currentIndex,
  onIndexChange,
}: StagedPhotoViewerProps) {
  const t = useT();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragActive = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  // Reset zoom/pan when the current photo changes or the viewer re-opens
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [currentIndex, open]);

  // Keyboard navigation (ArrowLeft/ArrowRight) while open
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onIndexChange(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < photos.length - 1) {
        onIndexChange(currentIndex + 1);
      }
      // Escape is handled natively by Radix Dialog
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, currentIndex, photos.length, onIndexChange]);

  if (!open || photos.length === 0) return null;

  const path = photos[currentIndex];
  const src = convertFileSrc(path);
  const previewTransform = `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`;
  const filename = path.split(/[/\\]/).pop() ?? path;

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

  const handleMouseUp = () => {
    dragActive.current = false;
  };

  const goPrev = () => {
    if (currentIndex > 0) onIndexChange(currentIndex - 1);
  };

  const goNext = () => {
    if (currentIndex < photos.length - 1) onIndexChange(currentIndex + 1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/85" />
        <DialogPrimitive.Content
          className="fixed top-[50%] left-[50%] z-50 flex h-[85vh] w-full max-w-4xl translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden rounded-lg border border-border/40 bg-background shadow-2xl outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <DialogPrimitive.Title className="sr-only">{filename}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {photos.length > 1
              ? t('lightbox.photoCount', { current: currentIndex + 1, total: photos.length })
              : filename}
          </DialogPrimitive.Description>

          <div
            data-testid="staged-photo-stage"
            className="relative flex flex-1 min-h-0 w-full items-center justify-center overflow-hidden bg-black/60"
            style={{ cursor: zoom > 1 ? (dragActive.current ? 'grabbing' : 'grab') : 'zoom-in' }}
            onWheel={handleWheel}
            onDoubleClick={handleDoubleClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img
              src={src}
              alt={filename}
              className="max-w-full max-h-full select-none object-contain"
              style={{
                transform: previewTransform,
                transformOrigin: 'center center',
                transition: dragActive.current ? undefined : 'transform 120ms ease-out',
                willChange: 'transform',
              }}
              draggable={false}
            />

            {photos.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-2 py-0.5 font-mono text-[11px] text-white/50 pointer-events-none">
                {currentIndex + 1} / {photos.length}
              </div>
            )}

            {currentIndex > 0 && (
              <button
                type="button"
                aria-label={t('lightbox.prev')}
                title={t('lightbox.prev')}
                onClick={goPrev}
                className="absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white/60 transition-all duration-150 hover:bg-black/70 hover:text-white"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}

            {currentIndex < photos.length - 1 && (
              <button
                type="button"
                aria-label={t('lightbox.next')}
                title={t('lightbox.next')}
                onClick={goNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white/60 transition-all duration-150 hover:bg-black/70 hover:text-white"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="absolute top-3 left-3 flex items-center gap-1 z-10">
            <button
              type="button"
              aria-label={t('lightbox.zoomIn')}
              title={t('lightbox.zoomIn')}
              onClick={() => setZoom((z) => Math.min(5, z * 1.3))}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/60 transition-all duration-150 hover:bg-black/70 hover:text-white"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={t('lightbox.zoomOut')}
              title={t('lightbox.zoomOut')}
              onClick={() =>
                setZoom((z) => {
                  const next = Math.max(1, z / 1.3);
                  if (next <= 1) setPan({ x: 0, y: 0 });
                  return next;
                })
              }
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/60 transition-all duration-150 hover:bg-black/70 hover:text-white"
            >
              <Minus className="h-4 w-4" />
            </button>
            {zoom > 1 && (
              <button
                type="button"
                aria-label={t('lightbox.resetZoom')}
                title={t('lightbox.resetZoom')}
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                className="flex h-8 items-center justify-center rounded-full bg-black/40 px-2 text-white/60 transition-all duration-150 hover:bg-black/70 hover:text-white"
              >
                <ZoomIn className="mr-1 h-3.5 w-3.5" />
                <span className="font-mono text-[11px]">{Math.round(zoom * 100)}%</span>
              </button>
            )}
          </div>

          <DialogClose
            aria-label={t('lightbox.close')}
            title={t('lightbox.close')}
            className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white/60 transition-all duration-150 hover:bg-black/70 hover:text-white"
          >
            <X className="h-4 w-4" />
          </DialogClose>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
