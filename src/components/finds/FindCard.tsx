import { convertFileSrc } from '@tauri-apps/api/core';
import { Pencil, Image, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isHeic, type Find } from '@/lib/finds';
import { useT } from '@/i18n/index';

interface FindCardProps {
  find: Find;
  storagePath: string;
  onEdit: (find: Find) => void;
  onDelete: (find: Find) => void;
}

export function FindCard({ find, storagePath, onEdit, onDelete }: FindCardProps) {
  const t = useT();
  const primaryPhoto = find.photos[0] ?? null;
  const absolutePath = primaryPhoto ? `${storagePath}/${primaryPhoto.photo_path}` : '';
  const heic = primaryPhoto ? isHeic(primaryPhoto.photo_path) : false;
  const extraCount = find.photos.length > 1 ? find.photos.length - 1 : 0;

  return (
    <div className="group relative flex items-start gap-3 rounded-sm border border-border/50 bg-card/60 p-3 transition-all duration-200 hover:border-primary/25 hover:bg-card">
      {/* Amber left accent */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-sm bg-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

      {/* Thumbnail */}
      <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-sm bg-muted flex items-center justify-center">
        {primaryPhoto === null ? (
          <Image className="h-7 w-7 text-muted-foreground/30" />
        ) : heic ? (
          <div className="flex flex-col items-center gap-1 text-muted-foreground/40">
            <Image className="h-7 w-7" />
            <span className="font-mono text-[9px]">HEIC</span>
          </div>
        ) : (
          <img
            src={convertFileSrc(absolutePath)}
            alt={find.original_filename}
            className="h-20 w-20 object-cover"
          />
        )}
        {extraCount > 0 && (
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 font-mono text-[9px] text-white/90">
            +{extraCount}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="font-serif text-base font-semibold leading-tight truncate text-foreground">
          {find.species_name || t('findCard.unnamed')}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {find.date_found && (
            <span className="text-xs text-muted-foreground">{find.date_found}</span>
          )}
          {(find.country || find.region) && (
            <span className="text-xs text-muted-foreground">
              {find.country}{find.region ? ` · ${find.region}` : ''}
            </span>
          )}
        </div>
        {find.location_note && (
          <p className="text-xs text-muted-foreground/60 truncate">{find.location_note}</p>
        )}
        {(find.lat !== null && find.lng !== null) && (
          <p className="font-mono text-[10px] text-muted-foreground/40">
            {find.lat?.toFixed(4)}, {find.lng?.toFixed(4)}
          </p>
        )}
        {find.notes && (
          <p className="text-xs text-muted-foreground/55 italic truncate">{find.notes}</p>
        )}
      </div>

      {/* Actions — appear on hover */}
      <div className="flex flex-shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          aria-label={t('findCard.edit')}
          onClick={() => onEdit(find)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          aria-label="Delete"
          onClick={() => onDelete(find)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
