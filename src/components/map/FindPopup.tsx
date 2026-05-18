import { useState } from 'react';
import { ChevronLeft, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMap } from 'react-leaflet';
import { useAppStore } from '@/stores/appStore';
import type { Find } from '@/lib/finds';
import { resolvePhotoSrc } from '@/lib/photoSrc';
import type { FindGroup } from './groupFindsByCoords';
import { renderSpeciesName, plainSpeciesName } from '@/lib/speciesName';
import { useT } from '@/i18n/index';
import { formatDisplayDate } from '@/lib/dateFormat';

interface FindPopupProps {
  group: FindGroup;
  storagePath: string;
}

function formatDate(iso: string): string {
  // YYYY-MM-DD — display as-is for v1
  return formatDisplayDate(iso, useAppStore.getState().language);
}

function PopupRow({
  find,
  onExpand,
}: {
  find: Find;
  onExpand: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onExpand}
      className="flex w-full flex-col items-start gap-1 rounded-sm px-1 py-1 text-left hover:bg-secondary"
    >
      <span className="font-serif text-base font-semibold italic text-foreground" title={plainSpeciesName(find.species_name)}>
        {renderSpeciesName(find.species_name)}
      </span>
      <span className="text-xs text-muted-foreground">{formatDate(find.date_found)}</span>
    </button>
  );
}

function LevelTwoCard({
  find,
  storagePath,
  onBack,
}: {
  find: Find;
  storagePath: string;
  onBack: () => void;
}) {
  const t = useT();
  const map = useMap();
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const setEditingFindId = useAppStore((s) => s.setEditingFindId);
  const photoAssetVersion = useAppStore((s) => s.photoAssetVersion);
  const primaryPhoto = find.photos.find((p) => p.is_primary) ?? find.photos[0];
  const thumbSrc = primaryPhoto
    ? resolvePhotoSrc(storagePath, primaryPhoto.photo_path, photoAssetVersion)
    : null;
  return (
    <div className="flex w-[240px] flex-col gap-2">
      <button
        type="button"
        onClick={onBack}
        aria-label={t('map.backToSummary')}
        className="flex items-center text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="flex gap-3">
        {thumbSrc ? (
          <img
            src={thumbSrc}
            alt=""
            className="h-12 w-12 rounded-sm object-cover"
          />
        ) : (
          <div className="h-12 w-12 rounded-sm bg-secondary" />
        )}
        <div className="flex flex-col">
          <span className="font-serif text-base font-semibold italic text-foreground">
            {find.species_name}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDate(find.date_found)}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {find.lat != null && find.lng != null && (
          <Button
            variant="ghost"
            size="sm"
            className="justify-start gap-1.5 hover:bg-secondary"
            onClick={() => map.flyTo([find.lat!, find.lng!], Math.max(map.getZoom(), 16))}
          >
            <ZoomIn className="h-3.5 w-3.5" />
            {t('map.zoomIn')}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="hover:bg-primary hover:text-primary-foreground"
          onClick={() => {
            setEditingFindId(find.id);
            setActiveTab('collection');
          }}
        >
          {t('collection.editFind')}
        </Button>
      </div>
    </div>
  );
}

export function FindPopup({ group, storagePath }: FindPopupProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const t = useT();
  const map = useMap();

  if (expandedId !== null) {
    const find = group.finds.find((f) => f.id === expandedId);
    if (find) {
      return (
        <LevelTwoCard
          find={find}
          storagePath={storagePath}
          onBack={() => setExpandedId(null)}
        />
      );
    }
  }

  const zoomButton = (
    <button
      type="button"
      onClick={() => map.flyTo([group.lat, group.lng], Math.max(map.getZoom(), 16))}
      className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors px-1 py-0.5"
    >
      <ZoomIn className="h-3 w-3" />
      {t('map.zoomIn')}
    </button>
  );

  // Level 1
  if (group.finds.length === 1) {
    return (
      <div className="w-[200px]">
        <PopupRow find={group.finds[0]} onExpand={() => setExpandedId(group.finds[0].id)} />
        {zoomButton}
      </div>
    );
  }
  return (
    <div className="flex max-h-[200px] w-[200px] flex-col gap-1 overflow-y-auto">
      {group.finds.map((f) => (
        <PopupRow key={f.id} find={f} onExpand={() => setExpandedId(f.id)} />
      ))}
      {zoomButton}
    </div>
  );
}
