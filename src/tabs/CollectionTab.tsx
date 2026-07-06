import { memo, useState, useMemo, useEffect, useRef, useDeferredValue, useCallback, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { GalleryHorizontal, Plus, ChevronDown, ChevronRight, FolderOpen, Search, X, CheckSquare, Pencil, Star, SquarePen, Trash2, BookOpen, Map as MapIcon, CalendarDays, MapPin } from 'lucide-react';
import { EmptyState } from '@/components/layout/EmptyState';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { ImportDialog } from '@/components/import/ImportDialog';
import { CreateFindDialog } from '@/components/finds/CreateFindDialog';
import { FindCard } from '@/components/finds/FindCard';
import { PhotoLightbox, type LightboxPhoto } from '@/components/finds/PhotoLightbox';
import { EditFindDialog } from '@/components/finds/EditFindDialog';
import { FolderEditDialog } from '@/components/finds/FolderEditDialog';
import { DeleteFindDialog } from '@/components/finds/DeleteFindDialog';
import { BulkDeleteDialog } from '@/components/finds/BulkDeleteDialog';
import { SpeciesMetadataBadges } from '@/components/species/SpeciesMetadataBadges';
import { useInfiniteCollectionFolders, useInfiniteSpeciesFinds, useFindPhotos, useSpeciesNotes, useSpeciesProfiles, useUpsertSpeciesNote, useUpsertSpeciesProfile, useBulkRenameSpecies, useSetFindFavorite, useDeleteFindPhoto } from '@/hooks/useFinds';
import { usePhotoThumbnailSrc } from '@/hooks/usePhotoThumbnail';
import { useAppStore } from '@/stores/appStore';
import { useT, tFindsCount } from '@/i18n/index';
import type { Find, FindSearchFilters, SpeciesFolderSummary, SpeciesProfile } from '@/lib/finds';
import { getFindPhotoCount, openSpeciesFolder, SUPPORTED_EXTENSIONS } from '@/lib/finds';
import { isInternalLibraryName } from '@/lib/internalEntries';
import { renderSpeciesName, plainSpeciesName, normalizeCommonName, compareSpeciesNames } from '@/lib/speciesName';
import { formatDisplayDate } from '@/lib/dateFormat';

const DATE_SEARCH_AUTO_EXPAND_LIMIT = 80;
const COLLAPSED_SPECIES_ROW_ESTIMATE = 210;
const OPEN_SPECIES_ROW_ESTIMATE = 520;
const COLLECTION_FIND_PAGE_SIZE = 200;
const COLLECTION_VIRTUALIZATION_THRESHOLD = 50;
const SPECIES_FIND_PAGE_SIZE = 100;
const FIND_ROW_VIRTUALIZATION_THRESHOLD = 60;
const FIND_ROW_ESTIMATE = 92;
const PHOTO_GRID_INITIAL_LIMIT = 30;
const PHOTO_GRID_INCREMENT = 30;

function normalizeDateQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function dateVariants(isoDate: string): string[] {
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return [isoDate.toLowerCase()];
  const dayNumber = String(Number(day));
  const monthNumber = String(Number(month));
  return [
    isoDate,
    `${year}${month}${day}`,
    `${day}.${month}.${year}`,
    `${day}${month}${year}`,
    `${dayNumber}.${monthNumber}.${year}`,
    `${dayNumber}${monthNumber}${year}`,
    `${day}.${month}`,
    `${dayNumber}.${monthNumber}`,
    `${month}.${year}`,
    `${monthNumber}.${year}`,
    year,
    month,
    monthNumber,
    day,
    dayNumber,
  ].map(normalizeDateQuery);
}

function matchesSmartDate(isoDate: string, query: string): boolean {
  const q = normalizeDateQuery(query);
  if (!q) return true;
  const compactQuery = q.replace(/[./-]/g, '');
  return dateVariants(isoDate).some((variant) => {
    const compactVariant = variant.replace(/[./-]/g, '');
    return variant.startsWith(q) || compactVariant.startsWith(compactQuery);
  });
}

function matchesDateVariants(variants: string[], query: string): boolean {
  const q = normalizeDateQuery(query);
  if (!q) return true;
  const compactQuery = q.replace(/[./-]/g, '');
  return variants.some((variant) => {
    const compactVariant = variant.replace(/[./-]/g, '');
    return variant.startsWith(q) || compactVariant.startsWith(compactQuery);
  });
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return debounced;
}

function parseCompleteDateQuery(query: string): string | null {
  // Check the raw (not-yet-whitespace-stripped) value first: DatePartsInput (joinDateParts)
  // always emits day/month/year as separate space-joined tokens, e.g. "1 12 2026". Splitting on
  // whitespace here preserves the field boundaries the user actually typed. Falling through to
  // normalizeDateQuery + the compact-digit regex below would concatenate tokens of unknown
  // length (e.g. "1" + "12" + "2026" -> "1122026") and re-split them ambiguously, silently
  // misreading day=1/month=12 as day=11/month=02. See collection-search-sort-bugs debug session.
  const rawParts = query.trim().split(/\s+/).filter(Boolean);
  if (rawParts.length === 3 && rawParts.every((part) => /^\d{1,4}$/.test(part))) {
    const [day, month, year] = rawParts;
    if (year.length !== 4 || day.length > 2 || month.length > 2) return null;
    const dayNum = Number(day);
    const monthNum = Number(month);
    if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12) return null;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const q = normalizeDateQuery(query);
  let match = q.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const [, year, month, day] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  match = q.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  match = q.match(/^(\d{1,2})(\d{1,2})(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}

function matchesSmartMonth(isoDate: string, query: string): boolean {
  const q = normalizeDateQuery(query);
  if (!q) return true;
  const [year, month] = isoDate.split('-');
  if (!year || !month) return false;
  const monthNumber = String(Number(month));
  const variants = [
    `${year}-${month}`,
    `${year}${month}`,
    `${month}.${year}`,
    `${monthNumber}.${year}`,
    month,
    monthNumber,
    year,
  ].map(normalizeDateQuery);
  const compactQuery = q.replace(/[./-]/g, '');
  return variants.some((variant) => variant.startsWith(q) || variant.replace(/[./-]/g, '').startsWith(compactQuery));
}

function monthVariants(isoDate: string): string[] {
  const [year, month] = isoDate.split('-');
  if (!year || !month) return [];
  const monthNumber = String(Number(month));
  return [
    `${year}-${month}`,
    `${year}${month}`,
    `${month}.${year}`,
    `${monthNumber}.${year}`,
    month,
    monthNumber,
    year,
  ].map(normalizeDateQuery);
}

interface DatePartsInputProps {
  value: string;
  onChange: (value: string) => void;
  includeDay?: boolean;
  includeYear?: boolean;
  ariaLabel: string;
  className?: string;
}

function splitDateParts(value: string, includeDay: boolean, includeYear = true): string[] {
  const parts = value.trim().split(/\D+/).filter(Boolean);
  if (includeDay && includeYear) return [parts[0] ?? '', parts[1] ?? '', parts[2] ?? ''];
  if (includeDay && !includeYear) return [parts[0] ?? '', parts[1] ?? ''];
  return [parts[0] ?? '', parts[1] ?? ''];
}

function joinDateParts(parts: string[]): string {
  return parts.filter(Boolean).join(' ');
}

function DatePartsInput({ value, onChange, includeDay = true, includeYear = true, ariaLabel, className = '' }: DatePartsInputProps) {
  const parts = splitDateParts(value, includeDay, includeYear);
  const placeholders = includeDay && includeYear ? ['dd', 'mm', 'yyyy'] : includeDay ? ['dd', 'mm'] : ['mm', 'yyyy'];
  const widths = includeDay && includeYear ? ['w-7', 'w-7', 'w-11'] : includeDay ? ['w-7', 'w-7'] : ['w-7', 'w-11'];
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const updatePart = (index: number, nextValue: string) => {
    const next = [...parts];
    next[index] = nextValue.replace(/\D/g, '').slice(0, index === parts.length - 1 && includeYear ? 4 : 2);
    const monthIndex = includeDay ? 1 : 0;
    const dayIndex = includeDay ? 0 : -1;
    const numericValue = Number.parseInt(next[index], 10);

    if (index === dayIndex && next[index].length === 2 && (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 31)) {
      next[index] = '';
      onChange(joinDateParts(next));
      refs.current[index]?.focus();
      return;
    }

    if (index === monthIndex && next[index].length === 2 && (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 12)) {
      next[index] = '';
      onChange(joinDateParts(next));
      refs.current[index]?.focus();
      return;
    }

    onChange(joinDateParts(next));
    if (index < parts.length - 1 && next[index].length === 2) {
      refs.current[index + 1]?.focus();
      refs.current[index + 1]?.select();
    }
  };

  return (
    <div className={`flex h-7 items-center gap-0.5 rounded bg-background/35 px-1 ${className}`} aria-label={ariaLabel}>
      {placeholders.map((placeholder, index) => (
        <input
          key={placeholder}
          ref={(node) => { refs.current[index] = node; }}
          type="text"
          inputMode="numeric"
          value={parts[index] ?? ''}
          onChange={(e) => updatePart(index, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !(parts[index] ?? '') && index > 0) {
              refs.current[index - 1]?.focus();
              refs.current[index - 1]?.select();
            }
          }}
          placeholder={placeholder}
          aria-label={`${ariaLabel} ${placeholder}`}
          className={`${widths[index]} bg-transparent text-center text-xs text-foreground outline-none placeholder:text-muted-foreground/45`}
        />
      ))}
    </div>
  );
}

type CollectionT = ReturnType<typeof useT>;

interface PhotoThumbnailImageProps {
  photoPath: string;
  size?: number;
  alt?: string;
  className: string;
}

const PhotoThumbnailImage = memo(function PhotoThumbnailImage({
  photoPath,
  size = 256,
  alt = '',
  className,
}: PhotoThumbnailImageProps) {
  const src = usePhotoThumbnailSrc(photoPath, size);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
    />
  );
});

interface FindRowProps {
  find: Find;
  index: number;
  speciesFinds: Find[];
  lang: string;
  t: CollectionT;
  speciesProfilesByName: Map<string, SpeciesProfile>;
  selectMode: boolean;
  selectedIds: Set<number>;
  isExpanded: boolean;
  onToggleSelect: (id: number) => void;
  onOpenLightbox: (speciesFinds: Find[], findId: number, photoIndex: number) => void;
  onSetEditing: (find: Find) => void;
  onSetDeleting: (find: Find) => void;
  onToggleFindExpand: (id: number) => void;
  onViewOnMap: (find: Find) => void;
}

const FindRow = memo(function FindRow({
  find,
  index,
  speciesFinds,
  lang,
  t,
  speciesProfilesByName,
  selectMode,
  selectedIds,
  isExpanded,
  onToggleSelect,
  onOpenLightbox,
  onSetEditing,
  onSetDeleting,
  onToggleFindExpand,
  onViewOnMap,
}: FindRowProps) {
  const firstPhoto = find.photos[0];
  const photoCount = getFindPhotoCount(find);
  const shouldLoadAllPhotos = isExpanded && photoCount > find.photos.length;
  const { data: loadedPhotos } = useFindPhotos(find.id, shouldLoadAllPhotos);
  const rowPhotos = loadedPhotos ?? find.photos;
  const [visiblePhotoCount, setVisiblePhotoCount] = useState(PHOTO_GRID_INITIAL_LIMIT);
  const visiblePhotos = rowPhotos.slice(0, visiblePhotoCount);
  const hiddenPhotoCount = Math.max(0, rowPhotos.length - visiblePhotos.length);
  const lightboxSpeciesFinds = rowPhotos === find.photos
    ? speciesFinds
    : speciesFinds.map((entry) => entry.id === find.id ? { ...entry, photos: rowPhotos } : entry);

  useEffect(() => {
    setVisiblePhotoCount(PHOTO_GRID_INITIAL_LIMIT);
  }, [find.id, isExpanded]);

  return (
    <div
      className={`group/findrow overflow-hidden rounded border bg-card shadow-sm transition-colors ${
        selectMode && selectedIds.has(find.id)
          ? 'border-primary/60 bg-primary/8'
          : 'border-border/50 hover:border-border/80'
      }`}
    >
      <div
        className={`flex items-center gap-2.5 px-3 py-2 transition-colors cursor-pointer ${
          selectMode && selectedIds.has(find.id)
            ? 'bg-primary/10'
            : 'hover:bg-accent/30'
        }`}
        onClick={() => {
          if (selectMode) {
            onToggleSelect(find.id);
          } else {
            onOpenLightbox(speciesFinds, find.id, 0);
          }
        }}
      >
        {firstPhoto ? (
          <PhotoThumbnailImage
            photoPath={firstPhoto.photo_path}
            size={128}
            className="h-9 w-9 flex-shrink-0 rounded-sm object-cover"
          />
        ) : (
          <div className="h-9 w-9 flex-shrink-0 rounded-sm bg-muted" />
        )}

        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground/90 truncate">
            <span className="font-mono text-[10px] text-muted-foreground/45 mr-1 select-none">{index + 1}.</span>
            {find.date_found ? formatDisplayDate(find.date_found, lang) : t('collection.noDate')}
            {find.location_note && (
              <span className="text-muted-foreground"> · {find.location_note}</span>
            )}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
            {photoCount} {photoCount === 1 ? t('collection.photoUnit.one') : t('collection.photoUnit.many')}
            {find.is_favorite && <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />}
          </p>
          <div className="mt-0.5">
            <SpeciesMetadataBadges
              speciesProfile={speciesProfilesByName.get(find.species_name)}
              size="sm"
              hideUnknown={true}
            />
          </div>
        </div>

        <div className="flex items-center gap-0.5 opacity-40 group-hover/findrow:opacity-100 focus-within:opacity-100 transition-opacity">
          {find.lat != null && find.lng != null && (
            <button
              type="button"
              className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
              onClick={(e) => { e.stopPropagation(); onViewOnMap(find); }}
              title={t('collection.viewOnMap')}
            >
              <MapIcon className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
            onClick={(e) => { e.stopPropagation(); onSetEditing(find); }}
            title={t('findCard.edit')}
          >
            <SquarePen className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
            onClick={(e) => { e.stopPropagation(); onSetDeleting(find); }}
            title={t('collection.deleteFind')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {photoCount > 0 && (
          <button
            type="button"
            className="rounded p-1 text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent/50 transition-colors flex-shrink-0"
            onClick={(e) => { e.stopPropagation(); onToggleFindExpand(find.id); }}
            title={isExpanded ? t('collection.hidePhotos') : t('collection.showPhotos')}
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-150 ${isExpanded ? '' : '-rotate-90'}`}
            />
          </button>
        )}
      </div>

      {isExpanded && rowPhotos.length > 0 && (
        <div className="border-t border-border/30 px-3 pb-3 pt-2">
          <div className="grid grid-cols-8 gap-1 sm:grid-cols-10">
            {visiblePhotos.map((photo, photoIdx) => (
              <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-sm bg-muted flex items-center justify-center">
                <GalleryHorizontal className="h-4 w-4 text-muted-foreground/20 pointer-events-none" />
                <button
                  type="button"
                  className="absolute inset-0 w-full h-full"
                  onClick={() => onOpenLightbox(lightboxSpeciesFinds, find.id, photoIdx)}
                >
                  <PhotoThumbnailImage
                    photoPath={photo.photo_path}
                    size={256}
                    className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-105"
                  />
                </button>
                <button
                  type="button"
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded p-0.5 text-white hover:bg-black/80 z-10"
                  onClick={(e) => { e.stopPropagation(); onSetEditing(find); }}
                  title={t('collection.editFind')}
                >
                  <SquarePen className="h-3 w-3" />
                </button>
                {selectMode && (
                  <div
                    className={`absolute inset-0 flex items-center justify-center transition-colors z-10 ${selectedIds.has(find.id) ? 'bg-primary/40' : 'bg-black/0 group-hover:bg-black/20'}`}
                    onClick={(e) => { e.stopPropagation(); onToggleSelect(find.id); }}
                  />
                )}
              </div>
            ))}
          </div>
          {hiddenPhotoCount > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="mt-2 h-7 w-full text-[11px] text-muted-foreground hover:text-primary"
              onClick={() => setVisiblePhotoCount((count) => count + PHOTO_GRID_INCREMENT)}
            >
              {t('collection.loadMore')} ({hiddenPhotoCount})
            </Button>
          )}
        </div>
      )}
    </div>
  );
});

interface SpeciesFolderProps {
  index: number;
  virtualIndex: number;
  isOpen: boolean;
  isJumpTarget: boolean;
  measureElement: (element: HTMLDivElement | null) => void;
  children: ReactNode;
}

const SpeciesFolder = memo(function SpeciesFolder({
  index,
  virtualIndex,
  isOpen,
  isJumpTarget,
  measureElement,
  children,
}: SpeciesFolderProps) {
  return (
    <div
      ref={measureElement}
      data-index={virtualIndex}
      className={`stagger-item overflow-hidden rounded-sm border bg-card ${
        isJumpTarget
          ? 'border-primary border-l-[3px] ring-1 ring-primary/30'
          : isOpen
            ? 'border-primary/60 border-l-[3px]'
            : 'border-border/70'
      }`}
      style={{
        animationDelay: `${Math.min(index * 30, 300)}ms`,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
});

interface SpeciesFindRowsProps {
  speciesName: string;
  filters: FindSearchFilters;
  initialFinds?: Find[];
  lang: string;
  t: CollectionT;
  speciesProfilesByName: Map<string, SpeciesProfile>;
  selectMode: boolean;
  selectedIds: Set<number>;
  expandedFinds: Set<number>;
  onToggleSelect: (id: number) => void;
  onOpenLightbox: (speciesFinds: Find[], findId: number, photoIndex: number) => void;
  onSetEditing: (find: Find) => void;
  onSetDeleting: (find: Find) => void;
  onToggleFindExpand: (id: number) => void;
  onViewOnMap: (find: Find) => void;
}

const SpeciesFindRows = memo(function SpeciesFindRows({
  speciesName,
  filters,
  initialFinds = [],
  lang,
  t,
  speciesProfilesByName,
  selectMode,
  selectedIds,
  expandedFinds,
  onToggleSelect,
  onOpenLightbox,
  onSetEditing,
  onSetDeleting,
  onToggleFindExpand,
  onViewOnMap,
}: SpeciesFindRowsProps) {
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteSpeciesFinds(speciesName, filters, SPECIES_FIND_PAGE_SIZE);
  const speciesFinds = useMemo(() => {
    const loaded = data?.pages.flat() ?? [];
    return loaded.length > 0 ? loaded : initialFinds;
  }, [data, initialFinds]);
  const [findScrollElement, setFindScrollElement] = useState<HTMLDivElement | null>(null);
  const shouldVirtualizeFindRows = speciesFinds.length > FIND_ROW_VIRTUALIZATION_THRESHOLD;
  const findRowVirtualizer = useVirtualizer({
    count: shouldVirtualizeFindRows ? speciesFinds.length : 0,
    getScrollElement: () => findScrollElement,
    estimateSize: () => FIND_ROW_ESTIMATE,
    getItemKey: (index) => speciesFinds[index]?.id ?? index,
    initialRect: { width: 1024, height: 520 },
    measureElement: (element) => element.getBoundingClientRect().height + 8,
    overscan: 8,
  });
  const virtualFindRows = findRowVirtualizer.getVirtualItems();
  const renderedFindRows = useMemo(() => {
    if (shouldVirtualizeFindRows && virtualFindRows.length > 0) return virtualFindRows;
    let start = 0;
    return speciesFinds.map((find, index) => {
      const row = { key: find.id, index, start, size: FIND_ROW_ESTIMATE };
      start += FIND_ROW_ESTIMATE;
      return row;
    });
  }, [shouldVirtualizeFindRows, speciesFinds, virtualFindRows]);
  const findRowsTotalSize = shouldVirtualizeFindRows
    ? findRowVirtualizer.getTotalSize()
    : renderedFindRows.at(-1)
      ? renderedFindRows.at(-1)!.start + renderedFindRows.at(-1)!.size
      : 0;
  const firstRenderedFindRow = renderedFindRows[0];
  const lastRenderedFindRow = renderedFindRows.at(-1);
  const findRowsTopSpacer = shouldVirtualizeFindRows ? firstRenderedFindRow?.start ?? 0 : 0;
  const findRowsBottomSpacer = shouldVirtualizeFindRows && lastRenderedFindRow
    ? Math.max(0, findRowsTotalSize - lastRenderedFindRow.start - lastRenderedFindRow.size)
    : 0;

  useEffect(() => {
    if (!findScrollElement || !hasNextPage || isFetchingNextPage) return;

    const maybeFetchNextPage = () => {
      const { scrollTop, clientHeight, scrollHeight } = findScrollElement;
      if (scrollHeight <= clientHeight) return;
      if (scrollTop + clientHeight >= scrollHeight - 500) {
        void fetchNextPage();
      }
    };

    maybeFetchNextPage();
    findScrollElement.addEventListener('scroll', maybeFetchNextPage, { passive: true });
    return () => findScrollElement.removeEventListener('scroll', maybeFetchNextPage);
  }, [fetchNextPage, findScrollElement, hasNextPage, isFetchingNextPage, speciesFinds.length]);

  if (isLoading && speciesFinds.length === 0) {
    return <p className="text-xs text-muted-foreground">{t('collection.loading')}</p>;
  }
  if (isError) {
    return <p className="text-xs text-destructive">{String(error)}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={setFindScrollElement}
        className={shouldVirtualizeFindRows ? 'max-h-[min(58vh,42rem)] overflow-y-auto pr-1' : ''}
      >
        {findRowsTopSpacer > 0 && (
          <div aria-hidden="true" style={{ height: findRowsTopSpacer }} />
        )}
        {renderedFindRows.map((virtualRow) => {
          const find = speciesFinds[virtualRow.index];
          if (!find) return null;
          return (
            <div
              key={find.id}
              ref={shouldVirtualizeFindRows ? findRowVirtualizer.measureElement : undefined}
              data-index={virtualRow.index}
              style={{ marginBottom: 8 }}
            >
              <FindRow
                find={find}
                index={virtualRow.index}
                speciesFinds={speciesFinds}
                lang={lang}
                t={t}
                speciesProfilesByName={speciesProfilesByName}
                selectMode={selectMode}
                selectedIds={selectedIds}
                isExpanded={expandedFinds.has(find.id)}
                onToggleSelect={onToggleSelect}
                onOpenLightbox={onOpenLightbox}
                onSetEditing={onSetEditing}
                onSetDeleting={onSetDeleting}
                onToggleFindExpand={onToggleFindExpand}
                onViewOnMap={onViewOnMap}
              />
            </div>
          );
        })}
        {findRowsBottomSpacer > 0 && (
          <div aria-hidden="true" style={{ height: findRowsBottomSpacer }} />
        )}
      </div>
      {hasNextPage && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => void fetchNextPage()}
          disabled={isFetchingNextPage}
          className="self-center"
        >
          {isFetchingNextPage ? t('collection.loading') : t('collection.loadMore')}
        </Button>
      )}
    </div>
  );
});

export default function CollectionTab() {
  const t = useT();
  const lang = useAppStore((s) => s.language);
  const storagePath = useAppStore((s) => s.storagePath);
  const editingFindId = useAppStore((s) => s.editingFindId);
  const setEditingFindId = useAppStore((s) => s.setEditingFindId);
  const selectedCollectionSpecies = useAppStore((s) => s.selectedCollectionSpecies);
  const setSelectedCollectionSpecies = useAppStore((s) => s.setSelectedCollectionSpecies);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const setPendingSpeciesSelection = useAppStore((s) => s.setPendingSpeciesSelection);
  const setPendingMapCenter = useAppStore((s) => s.setPendingMapCenter);
  const setPendingMapSpeciesFilter = useAppStore((s) => s.setPendingMapSpeciesFilter);
  const { data: speciesNotesData } = useSpeciesNotes();
  const { data: speciesProfiles } = useSpeciesProfiles();
  const upsertNote = useUpsertSpeciesNote();
  const upsertSpeciesProfile = useUpsertSpeciesProfile();
  const setFindFavorite = useSetFindFavorite();
  const deletePhotoMutation = useDeleteFindPhoto();

  const [contentScrollElement, setContentScrollElement] = useState<HTMLDivElement | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [createFindOpen, setCreateFindOpen] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const importMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editing, setEditing] = useState<Find | null>(null);
  const [deleting, setDeleting] = useState<Find | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [dateFilterMode, setDateFilterMode] = useState<'exact' | 'range' | 'month' | 'year' | 'dayMonth'>('exact');
  const [dateSearch, setDateSearch] = useState('');
  const [dateSearchEnd, setDateSearchEnd] = useState('');
  const [monthSearch, setMonthSearch] = useState('');
  const [yearSearch, setYearSearch] = useState('');
  const [dayMonthSearch, setDayMonthSearch] = useState('');
  const [speciesSortMode, setSpeciesSortMode] = useState<'recent' | 'alpha'>('alpha');
  const deferredSearch = useDeferredValue(search);
  const deferredLocationSearch = useDeferredValue(locationSearch);
  const deferredDateSearch = useDeferredValue(dateSearch);
  const deferredDateSearchEnd = useDeferredValue(dateSearchEnd);
  const deferredMonthSearch = useDeferredValue(monthSearch);
  const deferredYearSearch = useDeferredValue(yearSearch);
  const deferredDayMonthSearch = useDeferredValue(dayMonthSearch);
  const debouncedSearch = useDebouncedValue(deferredSearch, 180);
  const debouncedLocationSearch = useDebouncedValue(deferredLocationSearch, 180);
  const debouncedDateSearch = useDebouncedValue(deferredDateSearch, 180);
  const debouncedDateSearchEnd = useDebouncedValue(deferredDateSearchEnd, 180);
  const debouncedMonthSearch = useDebouncedValue(deferredMonthSearch, 180);
  const debouncedYearSearch = useDebouncedValue(deferredYearSearch, 180);
  const debouncedDayMonthSearch = useDebouncedValue(deferredDayMonthSearch, 180);
  const [jumpTargetSpecies, setJumpTargetSpecies] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const collectionFindFilters = useMemo(() => {
    const filters: {
      speciesQuery?: string;
      locationQuery?: string;
      favoritesOnly?: boolean;
      dateStart?: string;
      dateEnd?: string;
      datePrefix?: string;
      dateDayMonth?: string;
      photosMode: 'primary';
    } = { photosMode: 'primary' };
    const speciesQuery = plainSpeciesName(debouncedSearch).trim();
    const locationQuery = debouncedLocationSearch.trim();
    if (speciesQuery) filters.speciesQuery = speciesQuery;
    if (locationQuery) filters.locationQuery = locationQuery;
    if (favoritesOnly) filters.favoritesOnly = true;

    if (dateFilterMode === 'exact') {
      const complete = parseCompleteDateQuery(debouncedDateSearch);
      if (complete) {
        filters.dateStart = complete;
        filters.dateEnd = complete;
      }
    } else if (dateFilterMode === 'range') {
      const start = parseCompleteDateQuery(debouncedDateSearch);
      const end = parseCompleteDateQuery(debouncedDateSearchEnd);
      if (start) filters.dateStart = start;
      if (end) filters.dateEnd = end;
    } else if (dateFilterMode === 'month') {
      const [month, year] = splitDateParts(debouncedMonthSearch, false);
      if (year?.length === 4) {
        filters.datePrefix = month ? `${year}-${month.padStart(2, '0')}` : year;
      }
    } else if (dateFilterMode === 'dayMonth') {
      const [day, month] = splitDateParts(debouncedDayMonthSearch, true, false);
      if (day && month && day.length <= 2 && month.length <= 2) {
        filters.dateDayMonth = `${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    } else {
      const year = debouncedYearSearch.trim();
      if (/^\d{4}$/.test(year)) filters.datePrefix = year;
    }

    return filters;
  }, [dateFilterMode, debouncedDateSearch, debouncedDateSearchEnd, debouncedDayMonthSearch, debouncedLocationSearch, debouncedMonthSearch, debouncedSearch, debouncedYearSearch, favoritesOnly]);

  const {
    data: folderPages,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteCollectionFolders(collectionFindFilters, COLLECTION_FIND_PAGE_SIZE);
  const folderSummaries = useMemo(() => folderPages?.pages.flat() ?? [], [folderPages]);
  const representativeFinds = useMemo(
    () => folderSummaries.map((summary) => summary.representative_find).filter((find): find is Find => Boolean(find)),
    [folderSummaries],
  );
  const finds = representativeFinds;

  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const [folderEditing, setFolderEditing] = useState<string | null>(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState('');
  const [moveDropdownOpen, setMoveDropdownOpen] = useState(false);
  const [moveHighlight, setMoveHighlight] = useState(0);
  const bulkRename = useBulkRenameSpecies();

  const [expandedFinds, setExpandedFinds] = useState<Set<number>>(new Set());
  const toggleFindExpand = useCallback((id: number) => {
    setExpandedFinds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxPhotos, setLightboxPhotos] = useState<LightboxPhoto[]>([]);
  const [lightboxFallbackFind, setLightboxFallbackFind] = useState<Find | null>(null);
  const [lightboxSpeciesName, setLightboxSpeciesName] = useState<string | null>(null);

  const handleViewFindOnMap = useCallback((target: Find) => {
    if (target.lat == null || target.lng == null) return;
    setPendingMapCenter({ lat: target.lat, lng: target.lng, zoom: 16 });
    setActiveTab('map');
  }, [setActiveTab, setPendingMapCenter]);

  const openLightbox = useCallback((speciesFinds: Find[], findId: number, photoIndex: number) => {
    const fallbackFind = speciesFinds.find((f) => f.id === findId) ?? null;
    const targetPhoto = fallbackFind?.photos[photoIndex];
    if (!targetPhoto) {
      setLightboxPhotos([]);
      setLightboxIndex(0);
      setLightboxFallbackFind(fallbackFind);
      setLightboxSpeciesName(fallbackFind?.species_name ?? speciesFinds[0]?.species_name ?? null);
      setLightboxOpen(true);
      return;
    }

    const seen = new Set<string>();
    const flat: LightboxPhoto[] = [];
    for (const f of speciesFinds) {
      for (const p of f.photos) {
        const ext = p.photo_path.slice(p.photo_path.lastIndexOf('.')).toLowerCase();
        if (!SUPPORTED_EXTENSIONS.includes(ext as (typeof SUPPORTED_EXTENSIONS)[number])) continue;
        if (seen.has(p.photo_path)) continue;
        seen.add(p.photo_path);
        flat.push({ photo: p, find: f });
      }
    }
    // Find the global index matching the clicked find + photoIndex (in deduplicated list)
    const foundIndex = flat.findIndex(
      (entry) => entry.find.id === findId && entry.photo === targetPhoto,
    );
    const globalIndex = foundIndex >= 0 ? foundIndex : 0;
    setLightboxPhotos(flat);
    setLightboxIndex(globalIndex);
    setLightboxFallbackFind(fallbackFind);
    setLightboxSpeciesName(fallbackFind?.species_name ?? speciesFinds[0]?.species_name ?? null);
    setLightboxOpen(true);
  }, []);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const enterSelectMode = () => {
    setSelectMode(true);
    setSelectedIds(new Set());
    setMoveTarget('');
  };

  const enterSelectModeWith = (id: number) => {
    setSelectMode(true);
    setSelectedIds(new Set([id]));
    setMoveTarget('');
  };

  const cancelSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setMoveTarget('');
    setMoveDropdownOpen(false);
  };

  const handleBulkMoveSuccess = () => {
    setImportMsg(t('collection.movedToast', { n: selectedIds.size, name: moveTarget }));
    if (importMsgTimer.current) clearTimeout(importMsgTimer.current);
    importMsgTimer.current = setTimeout(() => setImportMsg(null), 4000);
    cancelSelectMode();
  };

  const handleBulkMove = () => {
    if (!moveTarget.trim() || selectedIds.size === 0) return;
    bulkRename.mutate(
      { findIds: Array.from(selectedIds), newSpeciesName: moveTarget.trim() },
      { onSuccess: handleBulkMoveSuccess },
    );
  };

  const handleBulkDeleteSuccess = () => {
    setImportMsg(t('collection.deletedToast', { n: selectedIds.size }));
    if (importMsgTimer.current) clearTimeout(importMsgTimer.current);
    importMsgTimer.current = setTimeout(() => setImportMsg(null), 4000);
    cancelSelectMode();
  };

  useEffect(() => {
    if (!speciesNotesData) return;
    setNoteDrafts((prev) => {
      const next = { ...prev };
      for (const sn of speciesNotesData) {
        next[sn.species_name] = sn.notes;
      }
      return next;
    });
  }, [speciesNotesData]);

  // Map popup "Edit find" round-trip: when editingFindId is set from the map tab,
  // find the record and open EditFindDialog, then clear the store value.
  useEffect(() => {
    if (!editingFindId || !finds) return;
    const target = finds.find((f) => f.id === editingFindId);
    if (target) {
      setEditing(target);
    }
    setEditingFindId(null);
  }, [editingFindId, finds, setEditingFindId]);

  const allGroups = useMemo(
    () => folderSummaries
      .filter((summary) => !isInternalLibraryName(summary.species_name))
      .map((summary) => [summary.species_name, summary] as [string, SpeciesFolderSummary]),
    [folderSummaries],
  );

  const groups = useMemo(() => {
    if (speciesSortMode !== 'alpha') return allGroups;
    return [...allGroups].sort(([nameA], [nameB]) => compareSpeciesNames(nameA, nameB));
  }, [allGroups, speciesSortMode]);

  useEffect(() => {
    if (!selectedCollectionSpecies) return;

    const rawTarget = selectedCollectionSpecies.trim();
    const plainTarget = plainSpeciesName(rawTarget).toLowerCase();
    const matchedSpecies = allGroups.find(([name]) => name === rawTarget)?.[0]
      ?? allGroups.find(([name]) => plainSpeciesName(name).toLowerCase() === plainTarget)?.[0]
      ?? allGroups.find(([name]) => plainTarget.startsWith(plainSpeciesName(name).toLowerCase()))?.[0]
      ?? null;
    const resolvedSpecies = matchedSpecies ?? rawTarget;
    // Use the plain (markup-stripped) name for the search box/filter query. The stored species
    // name may contain `*asterisk*` display markup; feeding that raw into the search filter is
    // purely cosmetic here since the server-side query already strips '*' before matching, but
    // showing literal asterisks in the search input would be a confusing artifact.
    const displayTarget = plainSpeciesName(rawTarget);

    setExpanded(new Set([resolvedSpecies]));
    setExpandedFinds(new Set());
    setSearch((current) => (current === displayTarget ? current : displayTarget));
    setLocationSearch('');
    setDateSearch('');
    setDateSearchEnd('');
    setMonthSearch('');
    setYearSearch('');
    setFavoritesOnly(false);
    setSelectMode(false);
    setSelectedIds(new Set());
    setMoveTarget('');
    setMoveDropdownOpen(false);
    setJumpTargetSpecies(resolvedSpecies);

    if (matchedSpecies) {
      setSelectedCollectionSpecies(null);
    }

    const timer = window.setTimeout(() => setJumpTargetSpecies(null), 2200);
    return () => window.clearTimeout(timer);
  }, [allGroups, selectedCollectionSpecies, setSelectedCollectionSpecies]);

  const filteredGroups = groups;
  const shouldVirtualizeSpeciesFolders = filteredGroups.length > COLLECTION_VIRTUALIZATION_THRESHOLD;
  const filteredGroupKey = useMemo(
    () => filteredGroups.map(([name]) => name).join('\u001f'),
    [filteredGroups],
  );

  useEffect(() => {
    if (!contentScrollElement) return;
    contentScrollElement.scrollTop = 0;
  }, [contentScrollElement, filteredGroupKey]);

  const speciesNames = useMemo(
    () => groups.map(([name]) => name).filter((n) => n !== '(unnamed)'),
    [groups],
  );
  const filteredSpecies = useMemo(() => {
    if (!moveTarget.trim()) return speciesNames;
    const q = moveTarget.trim().toLowerCase();
    return speciesNames.filter((n) => plainSpeciesName(n).toLowerCase().startsWith(q));
  }, [speciesNames, moveTarget]);

  const isSearching = search.trim().length > 0;
  const isLocationSearching = locationSearch.trim().length > 0;
  const isDateSearching =
    (dateFilterMode === 'exact' && dateSearch.length > 0) ||
    (dateFilterMode === 'range' && (dateSearch.length > 0 || dateSearchEnd.length > 0)) ||
    (dateFilterMode === 'month' && monthSearch.length > 0) ||
    (dateFilterMode === 'dayMonth' && dayMonthSearch.length > 0) ||
    (dateFilterMode === 'year' && yearSearch.trim().length > 0);
  const filteredFindCount = useMemo(
    () => filteredGroups.reduce((sum, [, summary]) => sum + summary.find_count, 0),
    [filteredGroups],
  );
  const autoExpandDateResults = isDateSearching && filteredFindCount <= DATE_SEARCH_AUTO_EXPAND_LIMIT;
  const estimateSpeciesFolderSize = (index: number) => {
    const speciesName = filteredGroups[index]?.[0];
    const isOpen = Boolean(speciesName && (autoExpandDateResults || expanded.has(speciesName)));
    return (isOpen ? OPEN_SPECIES_ROW_ESTIMATE : COLLAPSED_SPECIES_ROW_ESTIMATE) + 8;
  };
  const speciesFolderVirtualizer = useVirtualizer({
    count: shouldVirtualizeSpeciesFolders ? filteredGroups.length : 0,
    getScrollElement: () => contentScrollElement,
    estimateSize: estimateSpeciesFolderSize,
    getItemKey: (index) => filteredGroups[index]?.[0] ?? index,
    initialRect: { width: 1024, height: 768 },
    measureElement: (element) => element.getBoundingClientRect().height + 8,
    overscan: 6,
  });
  const virtualSpeciesFolders = speciesFolderVirtualizer.getVirtualItems();
  const renderedSpeciesFolders = useMemo(() => {
    if (shouldVirtualizeSpeciesFolders && virtualSpeciesFolders.length > 0) return virtualSpeciesFolders;
    let start = 0;
    return filteredGroups.map(([speciesName], index) => {
      const size = estimateSpeciesFolderSize(index);
      const row = { key: speciesName, index, start, size };
      start += size;
      return row;
    });
  }, [filteredGroups, shouldVirtualizeSpeciesFolders, virtualSpeciesFolders]);
  const speciesFoldersTotalSize = shouldVirtualizeSpeciesFolders
    ? speciesFolderVirtualizer.getTotalSize()
    : renderedSpeciesFolders.at(-1)
      ? renderedSpeciesFolders.at(-1)!.start + renderedSpeciesFolders.at(-1)!.size
      : 0;
  const firstRenderedSpeciesFolder = renderedSpeciesFolders[0];
  const lastRenderedSpeciesFolder = renderedSpeciesFolders.at(-1);
  const virtualTopSpacer = shouldVirtualizeSpeciesFolders
    ? firstRenderedSpeciesFolder?.start ?? 0
    : 0;
  const virtualBottomSpacer = shouldVirtualizeSpeciesFolders && lastRenderedSpeciesFolder
    ? Math.max(0, speciesFoldersTotalSize - lastRenderedSpeciesFolder.start - lastRenderedSpeciesFolder.size)
    : 0;
  useEffect(() => {
    if (!contentScrollElement || !hasNextPage || isFetchingNextPage) return;

    const maybeFetchNextPage = () => {
      const { scrollTop, clientHeight, scrollHeight } = contentScrollElement;
      const hasScrollableContent = scrollHeight > clientHeight + 200;
      if (hasScrollableContent && scrollTop + clientHeight >= scrollHeight - 900) {
        void fetchNextPage();
      }
    };

    maybeFetchNextPage();
    contentScrollElement.addEventListener('scroll', maybeFetchNextPage, { passive: true });
    return () => contentScrollElement.removeEventListener('scroll', maybeFetchNextPage);
  }, [contentScrollElement, fetchNextPage, hasNextPage, isFetchingNextPage, filteredGroups.length]);
  const clearDateSearch = () => {
    setDateSearch('');
    setDateSearchEnd('');
    setMonthSearch('');
    setYearSearch('');
    setDayMonthSearch('');
  };
  const dateSearchLabel =
    dateFilterMode === 'month' ? monthSearch :
      dateFilterMode === 'year' ? yearSearch :
        dateFilterMode === 'dayMonth' ? dayMonthSearch :
          dateFilterMode === 'range' ? [dateSearch, dateSearchEnd].filter(Boolean).join(' - ') :
            dateSearch;
  const activeSearchLabel = dateSearchLabel || locationSearch || search;
  const favoriteCount = useMemo(
    () => (finds ?? []).filter((find) => find.is_favorite && !isInternalLibraryName(find.species_name)).length,
    [finds],
  );

  const speciesProfilesByName = useMemo(() => {
    const m = new Map<string, SpeciesProfile>();
    speciesProfiles?.forEach((p) => m.set(p.species_name, p));
    return m;
  }, [speciesProfiles]);

  const handleFolderSave = async (
    newName: string,
    edibility: string | null,
    threatStatus: string | null,
    distribution: string | null,
    commonName: string | null,
    note: string | null,
    synonyms: string[],
    otherNames: string[],
  ) => {
    if (!folderEditing) return;
    const existingProfile = speciesProfilesByName.get(folderEditing);
    await upsertSpeciesProfile.mutateAsync({
      speciesName: newName,
      commonName,
      coverPhotoId: existingProfile?.cover_photo_id ?? null,
      tags: existingProfile?.tags ?? [],
      edibility,
      threatStatus,
      distribution,
      edibilityNote: existingProfile?.edibility_note ?? null,
      synonyms,
      otherNames,
      fruitingBodyCountOverride: existingProfile?.fruiting_body_count_override ?? null,
      description: existingProfile?.description ?? null,
    });
    await upsertNote.mutateAsync({ speciesName: newName, notes: note ?? '' });
  };

  const toggleExpand = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleImportComplete = (imported: number, skipped: number) => {
    if (importMsgTimer.current) clearTimeout(importMsgTimer.current);
    setImportMsg(
      t('collection.importSummary', { finds: imported, photos: imported }) +
      (skipped > 0 ? t('collection.skipped', { n: skipped }) : ''),
    );
    importMsgTimer.current = setTimeout(() => setImportMsg(null), 5000);
  };

  const handleNoteSave = (speciesName: string) => {
    const notes = noteDrafts[speciesName] ?? '';
    upsertNote.mutate({ speciesName, notes });
  };

  const handleSetSpeciesCover = (photo: LightboxPhoto) => {
    const speciesName = lightboxSpeciesName ?? photo.find.species_name;
    if (!speciesName) return;
    const existingProfile = speciesProfiles?.find((entry) => entry.species_name === speciesName);
    upsertSpeciesProfile.mutate({
      speciesName,
      commonName: existingProfile?.common_name ?? null,
      coverPhotoId: photo.photo.id,
      tags: existingProfile?.tags ?? [],
      edibility: existingProfile?.edibility ?? null,
      threatStatus: existingProfile?.threat_status ?? null,
      distribution: existingProfile?.distribution ?? null,
      edibilityNote: existingProfile?.edibility_note ?? null,
      synonyms: existingProfile?.synonyms ?? [],
      otherNames: existingProfile?.other_names ?? [],
      fruitingBodyCountOverride: existingProfile?.fruiting_body_count_override ?? null,
      description: existingProfile?.description ?? existingProfile?.edibility_note ?? null,
    });
  };

  const handleOpenSpeciesFolder = async (speciesName: string) => {
    if (!storagePath) return;
    try {
      await openSpeciesFolder(storagePath, speciesName);
    } catch (error) {
      setImportMsg(String(error));
      if (importMsgTimer.current) clearTimeout(importMsgTimer.current);
      importMsgTimer.current = setTimeout(() => setImportMsg(null), 5000);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border/60">
        {selectMode ? (
          <>
            <span className="flex-1 text-sm text-muted-foreground">
              {selectedIds.size > 0
                ? tFindsCount(selectedIds.size, lang)
                : t('collection.selectHint')}
            </span>
            <Button variant="ghost" size="sm" onClick={cancelSelectMode} className="flex-shrink-0">
              {t('collection.cancelSelect')}
            </Button>
          </>
        ) : (
          <>
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                }}
                placeholder={t('species.search')}
                className="w-full h-9 rounded-md border border-border bg-input pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40 transition-colors"
              />
              {isSearching && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="relative w-56 flex-shrink-0">
              <MapPin className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                placeholder={t('collection.locationSearch')}
                aria-label={t('collection.locationSearch')}
                className="h-9 w-full rounded-md border border-border bg-input pl-8 pr-8 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40 transition-colors"
              />
              {isLocationSearching && (
                <button
                  type="button"
                  onClick={() => setLocationSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={t('collection.clearLocationSearch')}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Toast message */}
            {importMsg && (
              <span className="text-xs font-medium text-primary whitespace-nowrap">{importMsg}</span>
            )}
            <div className="flex flex-shrink-0 items-center gap-1 rounded-md border border-border bg-input px-1 py-1">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={dateFilterMode}
                onChange={(e) => {
                  setDateFilterMode(e.target.value as 'exact' | 'range' | 'month' | 'year' | 'dayMonth');
                  clearDateSearch();
                }}
                aria-label={t('collection.dateSearchMode')}
                className="h-7 rounded bg-transparent px-1 text-[11px] text-muted-foreground outline-none"
              >
                <option value="exact">{t('collection.dateModeExact')}</option>
                <option value="range">{t('collection.dateModeRange')}</option>
                <option value="month">{t('collection.dateModeMonth')}</option>
                <option value="dayMonth">{t('collection.dateModeDayMonth')}</option>
                <option value="year">{t('collection.dateModeYear')}</option>
              </select>
              {dateFilterMode === 'exact' && (
                <DatePartsInput
                  value={dateSearch}
                  onChange={setDateSearch}
                  aria-label={t('collection.dateSearch')}
                />
              )}
              {dateFilterMode === 'range' && (
                <>
                  <DatePartsInput
                    value={dateSearch}
                    onChange={setDateSearch}
                    aria-label={t('collection.dateSearchFrom')}
                  />
                  <span className="text-muted-foreground/50">-</span>
                  <DatePartsInput
                    value={dateSearchEnd}
                    onChange={setDateSearchEnd}
                    aria-label={t('collection.dateSearchTo')}
                  />
                </>
              )}
              {dateFilterMode === 'month' && (
                <DatePartsInput
                  value={monthSearch}
                  onChange={setMonthSearch}
                  includeDay={false}
                  aria-label={t('collection.monthSearch')}
                />
              )}
              {dateFilterMode === 'dayMonth' && (
                <DatePartsInput
                  value={dayMonthSearch}
                  onChange={setDayMonthSearch}
                  includeYear={false}
                  aria-label={t('collection.dayMonthSearch')}
                />
              )}
              {dateFilterMode === 'year' && (
                <input
                  type="text"
                  value={yearSearch}
                  onChange={(e) => setYearSearch(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="2026"
                  aria-label={t('collection.yearSearch')}
                  className="h-7 w-16 rounded bg-transparent px-1 text-xs text-foreground outline-none"
                />
              )}
              {isDateSearching && (
                <button
                  type="button"
                  onClick={clearDateSearch}
                  className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={t('collection.clearDateSearch')}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div
              className="flex flex-shrink-0 items-center gap-0.5 rounded-md border border-border bg-input p-0.5"
              role="group"
              aria-label={t('collection.sortMode')}
            >
              <button
                type="button"
                onClick={() => setSpeciesSortMode('recent')}
                className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                  speciesSortMode === 'recent'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {t('collection.sortRecent')}
              </button>
              <button
                type="button"
                onClick={() => setSpeciesSortMode('alpha')}
                className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                  speciesSortMode === 'alpha'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {t('collection.sortAlphabetical')}
              </button>
            </div>
            <Button variant="ghost" size="sm" onClick={enterSelectMode} className="gap-1.5 flex-shrink-0 text-muted-foreground hover:text-foreground">
              <CheckSquare className="h-3.5 w-3.5" />
              {t('collection.selectFinds')}
            </Button>
            <Button
              variant={favoritesOnly ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFavoritesOnly((prev) => !prev)}
              className={`gap-1.5 flex-shrink-0 ${favoritesOnly ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Star className={`h-3.5 w-3.5 ${favoritesOnly ? 'fill-primary' : ''}`} />
              {t('collection.favoritesFilter', { n: favoriteCount })}
            </Button>
            <Button
              onClick={() => setCreateFindOpen(true)}
              size="sm"
              variant="outline"
              className="gap-1.5 flex-shrink-0"
            >
              <SquarePen className="h-3.5 w-3.5" />
              {t('collection.newFind')}
            </Button>
            <Button onClick={() => setImportOpen(true)} size="sm" className="gap-1.5 flex-shrink-0">
              <Plus className="h-3.5 w-3.5" />
              {t('collection.importBtn')}
            </Button>
          </>
        )}
      </div>

      {/* Bulk action bar — visible in select mode when items are selected */}
      {selectMode && selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/60 bg-card/40">
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              value={moveTarget}
              onChange={(e) => { setMoveTarget(e.target.value); setMoveDropdownOpen(true); setMoveHighlight(0); }}
              onFocus={() => setMoveDropdownOpen(true)}
              onBlur={() => setTimeout(() => setMoveDropdownOpen(false), 150)}
              onKeyDown={(e) => {
                const visible = filteredSpecies.slice(0, 8);
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setMoveHighlight((h) => Math.min(h + 1, visible.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setMoveHighlight((h) => Math.max(h - 1, 0));
                } else if ((e.key === 'Enter' || e.key === 'Tab') && moveDropdownOpen && visible.length > 0) {
                  e.preventDefault();
                  setMoveTarget(visible[moveHighlight]);
                  setMoveDropdownOpen(false);
                } else if (e.key === 'Enter' && !moveDropdownOpen) {
                  handleBulkMove();
                } else if (e.key === 'Escape') {
                  setMoveDropdownOpen(false);
                }
              }}
              placeholder={t('collection.moveTargetPlaceholder')}
              className="h-8 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40 transition-colors"
            />
            {moveDropdownOpen && filteredSpecies.length > 0 && (
              <div className="absolute z-50 w-full top-full mt-0.5 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                {filteredSpecies.slice(0, 8).map((name, i) => (
                  <button
                    key={name}
                    type="button"
                    className={`w-full text-left px-3 py-1.5 text-sm font-serif transition-colors ${i === moveHighlight ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setMoveTarget(name);
                      setMoveDropdownOpen(false);
                    }}
                    onMouseEnter={() => setMoveHighlight(i)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleBulkMove}
            disabled={!moveTarget.trim() || bulkRename.isPending}
            className="flex-shrink-0 whitespace-nowrap"
          >
            {t('collection.bulkMoveBtn', { n: selectedIds.size })}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setBulkDeleteOpen(true)}
            className="flex-shrink-0 whitespace-nowrap"
          >
            {t('collection.deleteSelected', { n: selectedIds.size })}
          </Button>
        </div>
      )}

      {/* Content */}
      <div ref={setContentScrollElement} className="flex-1 overflow-auto p-4 pb-10">
        {isLoading && (
          <p className="text-sm text-muted-foreground px-1">{t('collection.loading')}</p>
        )}
        {isError && (
          <Alert variant="destructive">
            <AlertDescription>{String(error)}</AlertDescription>
          </Alert>
        )}
        {!isLoading && !isError && groups.length === 0 && (
          <EmptyState
            icon={GalleryHorizontal}
            heading={t('collection.empty.heading')}
            body={t('collection.empty.body')}
          />
        )}
        {!isLoading && !isError && (isSearching || isLocationSearching || isDateSearching) && filteredGroups.length === 0 && (
          <p className="text-sm text-muted-foreground px-1 pt-4 text-center">
            {t('collection.noResults', { search: activeSearchLabel })}
          </p>
        )}
        {!isLoading && !isError && favoritesOnly && filteredGroups.length === 0 && !isSearching && !isLocationSearching && !isDateSearching && (
          <p className="text-sm text-muted-foreground px-1 pt-4 text-center">
            {t('collection.noFavorites')}
          </p>
        )}

        {/* Species folders */}
        {!isLoading && !isError && filteredGroups.length > 0 && (
          <>
            <div
              className="w-full"
            >
              {virtualTopSpacer > 0 && (
                <div aria-hidden="true" style={{ height: virtualTopSpacer }} />
              )}
              {renderedSpeciesFolders.map((virtualRow) => {
              const group = filteredGroups[virtualRow.index];
              if (!group) return null;
              const [speciesName, summary] = group;
              const idx = virtualRow.index;
          const isOpen = autoExpandDateResults || expanded.has(speciesName);
          const canToggleFolder = !autoExpandDateResults;
          const profile = speciesProfilesByName.get(speciesName) ?? null;
          const commonName = normalizeCommonName(profile?.common_name, speciesName);
          const representativeFind = summary.representative_find;
          const representativePhoto = representativeFind?.photos[0] ?? null;
          const isJumpTarget = speciesName === jumpTargetSpecies;
          const speciesFavoriteCount = summary.favorite_count;

          return (
            <SpeciesFolder
              key={speciesName}
              index={idx}
              virtualIndex={virtualRow.index}
              isOpen={isOpen}
              isJumpTarget={isJumpTarget}
              measureElement={speciesFolderVirtualizer.measureElement}
            >
              {/* Folder header */}
              <div className={`group relative flex w-full items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-accent/60 ${isOpen ? 'bg-accent/20' : ''}`}>
                {/* Thumbnail — separate button opens lightbox */}
                {representativePhoto ? (
                  <button
                    type="button"
                    className="flex-shrink-0 overflow-hidden rounded-sm h-11 w-11 focus:outline-none focus:ring-2 focus:ring-ring/40"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (representativeFind) openLightbox([representativeFind], representativeFind.id, 0);
                    }}
                    title={t('collection.openPhoto')}
                  >
                    <PhotoThumbnailImage
                      photoPath={representativePhoto.photo_path}
                      size={160}
                      alt={speciesName}
                      className="h-11 w-11 object-cover transition-transform duration-150 hover:scale-110"
                    />
                  </button>
                ) : (
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-sm bg-muted">
                    <FolderOpen className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                )}

                  <button
                    type="button"
                    className="flex flex-1 min-w-0 items-center gap-3 text-left"
                  onClick={() => canToggleFolder && toggleExpand(speciesName)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-serif text-base font-semibold leading-tight truncate text-foreground" title={plainSpeciesName(speciesName)}>
                        {renderSpeciesName(speciesName)}
                      </p>
                      {speciesFavoriteCount > 0 && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600"
                          title={t('species.favoriteCountLabel', { count: speciesFavoriteCount })}
                        >
                          <Star className="h-3 w-3 fill-current" />
                          <span>{speciesFavoriteCount}</span>
                        </span>
                      )}
                    </div>
                    {commonName && (
                      <p className="mt-0.5 truncate text-sm font-bold text-foreground/80 dark:text-foreground/80" title={commonName}>
                        {commonName}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {tFindsCount(summary.find_count, lang)}
                      {' · '}
                      {summary.photo_count} {summary.photo_count === 1 ? t('collection.photoUnit.one') : t('collection.photoUnit.many')}
                    </p>
                    <div className="mt-1">
                      <SpeciesMetadataBadges
                        speciesProfile={speciesProfilesByName.get(speciesName)}
                        size="md"
                        hideUnknown={false}
                      />
                    </div>
                  </div>
                </button>

                <div className="flex shrink-0 items-end gap-1.5 opacity-75 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    className="flex min-w-10 flex-col items-center gap-0.5 rounded px-1 py-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus:text-primary"
                    onClick={(e) => { e.stopPropagation(); setPendingSpeciesSelection(speciesName); setActiveTab('species'); }}
                    title={t('collection.viewSpecies')}
                    aria-label={t('collection.viewSpecies')}
                  >
                    <span className="text-[10px] font-medium leading-none">{t('collection.actionSpecies')}</span>
                    <BookOpen className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="flex min-w-10 flex-col items-center gap-0.5 rounded px-1 py-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus:text-primary"
                    onClick={(e) => { e.stopPropagation(); setFolderEditing(speciesName); }}
                    title={t('collection.editFolder')}
                    aria-label={t('collection.editFolder')}
                  >
                    <span className="text-[10px] font-medium leading-none">{t('collection.actionEdit')}</span>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="flex min-w-10 flex-col items-center gap-0.5 rounded px-1 py-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus:text-primary"
                    onClick={(e) => { e.stopPropagation(); handleOpenSpeciesFolder(speciesName); }}
                    title={t('folder.openFolder')}
                    aria-label={t('folder.openFolder')}
                  >
                    <span className="text-[10px] font-medium leading-none">{t('collection.actionFolder')}</span>
                    <FolderOpen className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="flex min-w-10 flex-col items-center gap-0.5 rounded px-1 py-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus:text-primary"
                    onClick={(e) => { e.stopPropagation(); setPendingMapSpeciesFilter(speciesName); setActiveTab('map'); }}
                    title={t('collection.viewOnMap')}
                    aria-label={t('collection.viewOnMap')}
                  >
                    <span className="text-[10px] font-medium leading-none">{t('collection.actionMap')}</span>
                    <MapIcon className="h-3.5 w-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  className="flex-shrink-0"
                  onClick={() => canToggleFolder && toggleExpand(speciesName)}
                  tabIndex={-1}
                  disabled={!canToggleFolder}
                >
                  {isOpen
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground/50" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
                </button>
              </div>

              {/* Folder body */}
              {isOpen && (
                <div className="border-t border-border/60 bg-muted/[0.07] px-4 pb-4 pt-4 space-y-3">
                  <textarea
                    placeholder={t('collection.folderNotes')}
                    rows={3}
                    value={noteDrafts[speciesName] ?? ''}
                    onChange={(e) =>
                      setNoteDrafts((prev) => ({ ...prev, [speciesName]: e.target.value }))
                    }
                    onBlur={() => handleNoteSave(speciesName)}
                    className="w-full resize-none rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
                  />
                  {/* Synonyms and other names — compact inline pills, no section headers */}
                  {(() => {
                    const profile = speciesProfilesByName.get(speciesName);
                    const otherNames = profile?.other_names ?? [];
                    const synonyms = profile?.synonyms ?? [];
                    if (otherNames.length === 0 && synonyms.length === 0) return null;
                    return (
                      <div className="space-y-1">
                        {synonyms.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              {t('species.synonyms')}:
                            </span>
                            {synonyms.map((name) => (
                              <span key={name} className="inline-flex items-center rounded border border-border/60 bg-muted/50 px-1.5 py-px text-[10px] italic text-foreground/70">
                                {name}
                              </span>
                            ))}
                          </div>
                        )}
                        {otherNames.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              {t('species.otherNames')}:
                            </span>
                            {otherNames.map((name) => (
                              <span key={name} className="inline-flex items-center rounded border border-border/60 bg-muted/50 px-1.5 py-px text-[10px] text-foreground/70">
                                {name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Per-find collapsible rows */}
                  <div className="flex items-center gap-2 pt-1">
                    <div className="h-px flex-1 bg-border/40" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/45">
                      {t('collection.findsSection')}
                    </span>
                    <div className="h-px flex-1 bg-border/40" />
                  </div>
                  <SpeciesFindRows
                    speciesName={speciesName}
                    filters={collectionFindFilters}
                    initialFinds={representativeFind ? [representativeFind] : []}
                    lang={lang}
                    t={t}
                    speciesProfilesByName={speciesProfilesByName}
                    selectMode={selectMode}
                    selectedIds={selectedIds}
                    expandedFinds={expandedFinds}
                    onToggleSelect={toggleSelect}
                    onOpenLightbox={openLightbox}
                    onSetEditing={setEditing}
                    onSetDeleting={setDeleting}
                    onToggleFindExpand={toggleFindExpand}
                    onViewOnMap={handleViewFindOnMap}
                  />
                </div>
              )}
            </SpeciesFolder>
          );
            })}
              {virtualBottomSpacer > 0 && (
                <div aria-hidden="true" style={{ height: virtualBottomSpacer }} />
              )}
            </div>
            {hasNextPage && (
              <div className="flex justify-center pt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => void fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? t('collection.loading') : t('collection.loadMore')}
                </Button>
              </div>
            )}
            {!hasNextPage && folderSummaries.length > COLLECTION_FIND_PAGE_SIZE && (
              <p className="pt-3 text-center text-[11px] text-muted-foreground/60">
                {t('collection.allLoaded')}
              </p>
            )}
          </>
        )}
      </div>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImportComplete={handleImportComplete}
      />
      <EditFindDialog
        find={editing}
        onOpenChange={(open) => !open && setEditing(null)}
      />
      <FolderEditDialog
        speciesName={folderEditing}
        finds={folderEditing
          ? [filteredGroups.find(([name]) => name === folderEditing)?.[1]?.representative_find
            ?? groups.find(([name]) => name === folderEditing)?.[1]?.representative_find]
            .filter((find): find is Find => Boolean(find))
          : []}
        onOpenChange={(open) => !open && setFolderEditing(null)}
        speciesProfile={folderEditing ? speciesProfilesByName.get(folderEditing) : undefined}
        speciesNote={folderEditing ? (speciesNotesData?.find((n) => n.species_name === folderEditing)?.notes ?? '') : ''}
        onSave={handleFolderSave}
      />
      <DeleteFindDialog
        find={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
      <BulkDeleteDialog
        count={selectedIds.size}
        findIds={Array.from(selectedIds)}
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onSuccess={handleBulkDeleteSuccess}
      />
      <PhotoLightbox
        open={lightboxOpen}
        onOpenChange={(open) => {
          setLightboxOpen(open);
          if (!open) {
            setLightboxSpeciesName(null);
            setLightboxFallbackFind(null);
          }
        }}
        photos={lightboxPhotos}
        fallbackFind={lightboxFallbackFind}
        currentIndex={lightboxIndex}
        onIndexChange={setLightboxIndex}
        storagePath={storagePath!}
        onEditFind={(find) => setEditing(find)}
        onDeletePhoto={(lbp, permanentDelete) => {
          deletePhotoMutation.mutate(
            { photoId: lbp.photo.id, deleteFile: true, permanentDelete },
            { onSuccess: () => setLightboxPhotos((prev) => prev.filter((p) => p.photo.id !== lbp.photo.id)) },
          );
        }}
        onSetAsSpeciesCover={handleSetSpeciesCover}
        isCurrentSpeciesCover={(entry) => {
          const speciesName = lightboxSpeciesName ?? entry.find.species_name;
          const profile = speciesProfiles?.find((item) => item.species_name === speciesName);
          return profile?.cover_photo_id === entry.photo.id;
        }}
        speciesProfile={
          lightboxSpeciesName
            ? speciesProfilesByName.get(lightboxSpeciesName)
            : lightboxPhotos[lightboxIndex]?.find?.species_name
              ? speciesProfilesByName.get(lightboxPhotos[lightboxIndex].find.species_name)
              : lightboxFallbackFind?.species_name
                ? speciesProfilesByName.get(lightboxFallbackFind.species_name)
                : undefined
        }
      />
      <CreateFindDialog open={createFindOpen} onOpenChange={setCreateFindOpen} />
    </div>
  );
}
