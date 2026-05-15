import { useRef, useState } from 'react';
import { Pencil, Image, Trash2, Square, CheckSquare, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isHeic, type Find, type SpeciesProfile } from '@/lib/finds';
import { resolvePhotoSrc } from '@/lib/photoSrc';
import { useT } from '@/i18n/index';
import { renderSpeciesName, plainSpeciesName, normalizeCommonName } from '@/lib/speciesName';
import { SpeciesMetadataBadges } from '@/components/species/SpeciesMetadataBadges';

interface FindCardProps {
  find: Find;
  storagePath: string;
  onEdit: (find: Find) => void;
  onDelete: (find: Find) => void;
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
  onToggleFavorite?: (find: Find) => void;
  onLongPress?: (id: number) => void;
  onPhotoClick?: (findId: number, photoIndex: number) => void;
  speciesProfile?: SpeciesProfile;
}

export function FindCard({ find, storagePath, onEdit, onDelete, selectMode, isSelected, onToggleSelect, onToggleFavorite, onLongPress, onPhotoClick, speciesProfile }: FindCardProps) {
  const t = useT();
  const uniquePhotos = find.photos.filter(
    (p, i, arr) => arr.findIndex((q) => q.photo_path === p.photo_path) === i,
  );
  const [photoIndex, setPhotoIndex] = useState(0);
  const currentPhoto = uniquePhotos[photoIndex] ?? null;
  const currentPhotoSrc = currentPhoto ? resolvePhotoSrc(storagePath, currentPhoto.photo_path) : null;
  const extraCount = uniquePhotos.length > 1 ? uniquePhotos.length - 1 : 0;
  const heic = currentPhoto ? isHeic(currentPhoto.photo_path) : false;
  const commonName = normalizeCommonName(speciesProfile?.common_name, find.species_name);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startLongPress = () => {
    if (selectMode || !onLongPress) return;
    longPressTimer.current = setTimeout(() => onLongPress(find.id), 600);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  const handleClick = selectMode && onToggleSelect
    ? () => onToggleSelect(find.id)
    : !selectMode && onPhotoClick
    ? () => onPhotoClick(find.id, 0)
    : undefined;

  return (
    <div
      className={`group relative flex items-start gap-3 rounded-sm border p-3 transition-all duration-200 ${
        selectMode
          ? isSelected
            ? 'border-primary/60 bg-primary/8 cursor-pointer'
            : 'border-border/50 bg-card/60 cursor-pointer hover:border-primary/25 hover:bg-card'
          : `border-border/50 bg-card/60 hover:border-primary/25 hover:bg-card${!selectMode && onPhotoClick ? ' cursor-pointer' : ''}`
      }`}
      onClick={handleClick}
      onMouseDown={startLongPress}
      onMouseUp={cancelLongPress}
      onMouseLeave={cancelLongPress}
      onTouchStart={startLongPress}
      onTouchEnd={cancelLongPress}
      onTouchCancel={cancelLongPress}
    >
      {/* Amber left accent */}
      <div className={`absolute left-0 top-0 bottom-0 w-0.5 rounded-l-sm bg-primary transition-opacity duration-200 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />

      {/* Thumbnail */}
      <div
        className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-sm bg-muted flex items-center justify-center"
      >
        {currentPhoto === null ? (
          <Image className="h-7 w-7 text-muted-foreground/30" />
        ) : heic ? (
          <div className="flex flex-col items-center gap-1 text-muted-foreground/40">
            <Image className="h-7 w-7" />
            <span className="font-mono text-[9px]">HEIC</span>
          </div>
        ) : (
          <img
            src={currentPhotoSrc!}
            alt={find.original_filename}
            className="h-20 w-20 object-cover"
            onError={() => {
              setPhotoIndex((i) => i + 1);
            }}
          />
        )}
        {extraCount > 0 && (
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 font-mono text-[9px] text-white/90">
            +{extraCount}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1 pr-14">
        <p className="font-serif text-base font-semibold leading-tight truncate text-foreground">
          <span className="inline-flex max-w-full items-center gap-1.5">
            {find.is_favorite ? <Star className="h-3.5 w-3.5 flex-shrink-0 fill-primary text-primary" /> : null}
            <span className="truncate" title={plainSpeciesName(find.species_name) || t('findCard.unnamed')}>
              {find.species_name ? renderSpeciesName(find.species_name) : t('findCard.unnamed')}
            </span>
          </span>
        </p>
        {commonName && (
          <p className="truncate text-xs font-medium text-secondary" title={commonName}>{commonName}</p>
        )}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {find.date_found && (
            <span className="text-xs text-muted-foreground">{find.date_found}</span>
          )}
          {(find.country || find.region) && (
            <span className="text-xs text-muted-foreground">
              {find.country}{find.region ? ` · ${find.region}` : ''}
            </span>
          )}
          {(find.observed_count_min != null || find.observed_count != null) && (
            <span className="text-xs text-muted-foreground">
              {find.observed_count_min != null
                ? `${find.observed_count_min}–${find.observed_count_max ?? '?'} ${t('findCard.countUnit')}`
                : `${find.observed_count} ${t('findCard.countUnit')}`}
            </span>
          )}
        </div>
        {find.location_note && (
          <p className="text-xs text-muted-foreground/75 truncate">{find.location_note}</p>
        )}
        {(find.lat !== null && find.lng !== null) && (
          <p className="font-mono text-[10px] text-muted-foreground/40">
            {find.lat?.toFixed(4)}, {find.lng?.toFixed(4)}
          </p>
        )}
        {find.notes && (
          <p className="line-clamp-2 text-xs text-muted-foreground/70 italic">{find.notes}</p>
        )}
        <SpeciesMetadataBadges speciesProfile={speciesProfile} size="sm" hideUnknown={true} />
      </div>

      {/* Actions — normal mode: corner overlay on hover; select mode: checkbox */}
      {selectMode ? (
        <div className="absolute top-2 right-2 flex items-center">
          {isSelected
            ? <CheckSquare className="h-5 w-5 text-primary" />
            : <Square className="h-5 w-5 text-muted-foreground/40 group-hover:text-muted-foreground/70" />
          }
        </div>
      ) : (
        <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-40 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className={`h-6 w-6 ${find.is_favorite ? 'text-primary hover:text-primary' : 'text-muted-foreground hover:text-primary'}`}
            aria-label={find.is_favorite ? t('findCard.unfavorite') : t('findCard.favorite')}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite?.(find);
            }}
          >
            <Star className={`h-3 w-3 ${find.is_favorite ? 'fill-primary' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-primary"
            aria-label={t('findCard.edit')}
            onClick={(e) => { e.stopPropagation(); onEdit(find); }}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            aria-label={t('delete.confirm')}
            onClick={(e) => { e.stopPropagation(); onDelete(find); }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
