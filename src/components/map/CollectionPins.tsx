import { useState, useCallback, useEffect, useMemo, useRef, type MouseEvent } from 'react';
import L from 'leaflet';
import { Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import type { Find, SpeciesProfile } from '@/lib/finds';
import type { Zone } from '@/lib/zones';
import { resolvePhotoSrc } from '@/lib/photoSrc';
import { useSpeciesNotes, useSpeciesProfiles } from '@/hooks/useFinds';
import { useAppStore } from '@/stores/appStore';
import { SpeciesMetadataBadges } from '@/components/species/SpeciesMetadataBadges';
import { renderSpeciesName, plainSpeciesName } from '@/lib/speciesName';

export const LABEL_ZOOM_THRESHOLD = 13;

interface Collection {
  /** Unique key — species name when only one location, "species|index" for multiple. */
  key: string;
  name: string;
  lat: number;
  lng: number;
  count: number;
  finds: Find[];
  labelText: string;
  suppressLabel: boolean;
}

function collectionIcon(labelText: string, showLabel: boolean, isSatellite: boolean): L.DivIcon {
  const classes = [
    'bili-collection-marker',
    isSatellite ? 'bili-collection-marker--satellite' : '',
    !showLabel ? 'bili-collection-marker--hidden-label' : '',
  ].filter(Boolean).join(' ');

  return L.divIcon({
    html: `<div class="bili-pin-dot"></div><div class="bili-pin-label">${labelText}</div>`,
    className: classes,
    iconSize: [200, 50],
    iconAnchor: [6, 6],
    popupAnchor: [0, -14],
  });
}

const collectionIconCache = new Map<string, L.DivIcon>();

function getCollectionIcon(labelText: string, showLabel: boolean, isSatellite: boolean): L.DivIcon {
  const cacheKey = `${labelText}|${showLabel ? 'l' : 'd'}|${isSatellite ? 's' : 'n'}`;
  const cached = collectionIconCache.get(cacheKey);
  if (cached) return cached;
  const created = collectionIcon(labelText, showLabel, isSatellite);
  collectionIconCache.set(cacheKey, created);
  return created;
}

function CollectionPopup({
  collection,
  speciesNote,
  storagePath,
  onStartLocalPolygonForFind,
  onStartRegionPolygonForFind,
  zones,
  speciesProfile,
}: {
  collection: Collection;
  speciesNote: string | undefined;
  storagePath: string;
  onStartLocalPolygonForFind: (find: Find) => void;
  onStartRegionPolygonForFind: (find: Find) => void;
  zones: Zone[];
  speciesProfile?: SpeciesProfile;
}) {
  const map = useMap();
  const popupRef = useRef<HTMLDivElement | null>(null);
  const previousButtonRef = useRef<HTMLButtonElement | null>(null);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  const [findIdx, setFindIdx] = useState(0);
  const findEntries = useMemo(
    () => collection.finds.map((find) => ({
      find,
      photo: find.photos.find((p) => p.is_primary) ?? find.photos[0] ?? null,
      findNotes: find.notes,
    })),
    [collection.finds],
  );
  useEffect(() => {
    setFindIdx(0);
  }, [collection.key]);
  useEffect(() => {
    if (!popupRef.current) return;
    L.DomEvent.disableScrollPropagation(popupRef.current);
  }, []);
  const [latinNameRaw, croatianName] = collection.name.split(',').map((s) => s.trim());
  const current = findEntries[findIdx] ?? null;
  const photo = current?.photo ?? null;
  const existingLocalPolygon = current?.find
    ? zones.find(
      (zone) =>
        zone.zone_type === 'local' &&
        zone.geometry_type === 'polygon' &&
        zone.source_find_id === current.find.id,
    ) ?? null
    : null;
  const existingRegionPolygon = current?.find
    ? zones.find(
      (zone) =>
        zone.zone_type === 'region' &&
        zone.geometry_type === 'polygon' &&
        zone.species_name === current.find.species_name,
    ) ?? null
    : null;
  const photoSrc = photo && storagePath
    ? resolvePhotoSrc(storagePath, photo.photo_path)
    : null;
  const displayNote = (current?.findNotes?.trim()) || speciesNote;

  const hasPhoto = photoSrc != null;
  const stopPopupButtonEvent = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    L.DomEvent.stopPropagation(event.nativeEvent);
  };
  useEffect(() => {
    const previousButton = previousButtonRef.current;
    const nextButton = nextButtonRef.current;
    if (!previousButton || !nextButton || findEntries.length <= 1) return;

    const stopNativeEvent = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      L.DomEvent.stopPropagation(event);
    };
    const goPrevious = (event: Event) => {
      stopNativeEvent(event);
      setFindIdx((i) => (i - 1 + findEntries.length) % findEntries.length);
    };
    const goNext = (event: Event) => {
      stopNativeEvent(event);
      setFindIdx((i) => (i + 1) % findEntries.length);
    };

    previousButton.addEventListener('pointerdown', goPrevious);
    previousButton.addEventListener('click', stopNativeEvent);
    nextButton.addEventListener('pointerdown', goNext);
    nextButton.addEventListener('click', stopNativeEvent);

    return () => {
      previousButton.removeEventListener('pointerdown', goPrevious);
      previousButton.removeEventListener('click', stopNativeEvent);
      nextButton.removeEventListener('pointerdown', goNext);
      nextButton.removeEventListener('click', stopNativeEvent);
    };
  }, [findEntries.length]);

  return (
    <div ref={popupRef} className="relative w-[248px] overflow-visible font-sans">
      {findEntries.length > 1 && (
        <>
          <button
            ref={previousButtonRef}
            type="button"
            aria-label="Previous find"
            onMouseDown={stopPopupButtonEvent}
            onClick={stopPopupButtonEvent}
            className="absolute -left-8 top-[42%] z-[20] flex h-11 w-7 -translate-y-1/2 items-center justify-center rounded-l-md border border-border/50 bg-background/95 text-foreground shadow-sm transition-colors hover:bg-secondary hover:text-primary"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            ref={nextButtonRef}
            type="button"
            aria-label="Next find"
            onMouseDown={stopPopupButtonEvent}
            onClick={stopPopupButtonEvent}
            className="absolute -right-8 top-[42%] z-[20] flex h-11 w-7 -translate-y-1/2 items-center justify-center rounded-r-md border border-border/50 bg-background/95 text-foreground shadow-sm transition-colors hover:bg-secondary hover:text-primary"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}

      {/* ── Visual header ────────────────────────────────── */}
      <div className="overflow-hidden rounded-lg bg-background shadow-xl ring-1 ring-border/30">
      <div className="relative h-[148px] w-full select-none">
        {hasPhoto ? (
          <>
            <img
              src={photoSrc}
              alt=""
              className="relative z-[1] h-full w-full bg-black object-contain"
              draggable={false}
            />
          </>
        ) : (
          <div className="flex h-full w-full items-end bg-gradient-to-br from-[oklch(0.16_0.02_135)] to-[oklch(0.10_0.01_135)] p-3" />
        )}

        {/* Gradient scrim so text is always legible */}
        <div className="absolute inset-0 z-[2] bg-gradient-to-t from-black/95 via-black/50 to-black/5" />

        {/* Find-count pill — top-right */}
        <div className="absolute right-2 top-2 z-[3]">
          <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium tracking-wide text-white/90 backdrop-blur-sm">
            {collection.count} {collection.count === 1 ? 'nalaz' : 'nalaza'}
          </span>
        </div>

        {/* Find counter - shown when multiple finds share this pin */}
        {findEntries.length > 1 && (
          <span className="absolute bottom-[42px] right-2.5 z-[3] text-[10px] font-medium text-white/50">
            {findIdx + 1}/{findEntries.length}
          </span>
        )}

        {/* Species name block — bottom of header */}
        <div className="absolute bottom-0 left-0 right-0 z-[3] px-2.5 pb-1 pt-1">
          <p className="font-serif text-[13px] font-bold italic leading-snug text-white [text-shadow:0_1px_6px_rgba(0,0,0,1),0_0_20px_rgba(0,0,0,0.8)]">
            {renderSpeciesName(latinNameRaw)}
          </p>
          {croatianName && (
            <p className="mt-0.5 text-[11px] italic leading-tight text-white/80 [text-shadow:0_1px_4px_rgba(0,0,0,1)]">
              {plainSpeciesName(croatianName)}
            </p>
          )}
          {current?.find.date_found && (
            <p className="mt-0.5 text-[10px] leading-tight text-white/65 [text-shadow:0_1px_4px_rgba(0,0,0,1)]">
              {current.find.date_found}
            </p>
          )}
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 px-2.5 py-2.5">

        {/* Badges */}
        <SpeciesMetadataBadges speciesProfile={speciesProfile} size="md" hideUnknown={true} />

        {/* Note — 3-line clamp, no box */}
        {displayNote && (
          <p className="line-clamp-3 text-[11px] leading-relaxed text-foreground/65">
            {displayNote}
          </p>
        )}

        {/* ── Footer ───────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-border/25 pt-2">
          <button
            type="button"
            onClick={() => map.flyTo([collection.lat, collection.lng], Math.max(map.getZoom(), 16))}
            className="flex items-center gap-1 text-[11px] text-primary/65 transition-colors hover:text-primary"
          >
            <ZoomIn className="h-3 w-3" />
            Zoom
          </button>

          {current?.find.lat != null && current.find.lng != null && (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); L.DomEvent.stopPropagation(e.nativeEvent); onStartLocalPolygonForFind(current.find); }}
                className="rounded border border-[#D4512A]/45 bg-[#D4512A]/10 px-2 py-0.5 text-[10px] font-semibold text-foreground transition-colors hover:bg-[#D4512A]/22"
              >
                {existingLocalPolygon ? 'Edit local' : 'Draw local'}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); L.DomEvent.stopPropagation(e.nativeEvent); onStartRegionPolygonForFind(current.find); }}
                className="rounded border border-primary/45 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-foreground transition-colors hover:bg-primary/22"
              >
                {existingRegionPolygon ? 'Edit region' : 'Draw region'}
              </button>
            </div>
          )}
        </div>

      </div>
      </div>
    </div>
  );
}

const OVERLAP_PX = 18;

function computeCrowded(map: L.Map, collections: Collection[]): Set<string> {
  const crowded = new Set<string>();
  const points = collections.map((c) => ({
    key: c.key,
    pt: map.latLngToLayerPoint([c.lat, c.lng]),
  }));
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[i].pt.x - points[j].pt.x;
      const dy = points[i].pt.y - points[j].pt.y;
      if (Math.sqrt(dx * dx + dy * dy) < OVERLAP_PX) {
        crowded.add(points[i].key);
        crowded.add(points[j].key);
      }
    }
  }
  return crowded;
}

function CollectionPinsInner({
  collections,
  onStartLocalPolygonForFind,
  onStartRegionPolygonForFind,
  onSelectSpecies,
  zones,
}: {
  collections: Collection[];
  onStartLocalPolygonForFind: (find: Find) => void;
  onStartRegionPolygonForFind: (find: Find) => void;
  onSelectSpecies: (speciesName: string) => void;
  zones: Zone[];
}) {
  const map = useMap();
  const [crowded, setCrowded] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(() => map.getZoom());
  const { data: speciesNotesData } = useSpeciesNotes();
  const { data: speciesProfilesRaw } = useSpeciesProfiles();
  const storagePath = useAppStore((s) => s.storagePath) ?? '';
  const isSatellite = useAppStore((s) => s.mapLayer === 'Satellite');
  const speciesNotesByName = useMemo(() => {
    const notes = new Map<string, string>();
    for (const entry of speciesNotesData ?? []) {
      notes.set(entry.species_name, entry.notes);
    }
    return notes;
  }, [speciesNotesData]);
  const speciesProfilesByName = useMemo(() => {
    const m = new Map<string, SpeciesProfile>();
    speciesProfilesRaw?.forEach((p) => m.set(p.species_name, p));
    return m;
  }, [speciesProfilesRaw]);
  const update = useCallback(() => {
    setCrowded(computeCrowded(map, collections));
  }, [map, collections]);

  useEffect(() => {
    update();
  }, [update]);

  useMapEvents({
    zoomend: () => {
      update();
      setZoom(map.getZoom());
    },
    moveend: update,
  });

  return (
    <>
      {collections.map((c) => {
        const showLabel = zoom >= LABEL_ZOOM_THRESHOLD && !crowded.has(c.key) && !c.suppressLabel;
        const speciesNote = speciesNotesByName.get(c.name);
        const collectionZones = zones.filter((zone) => zone.species_name === c.name);
        return (
          <Marker
            key={`col-${c.key}`}
            position={[c.lat, c.lng]}
            icon={getCollectionIcon(c.labelText, showLabel, isSatellite)}
            eventHandlers={{
              click: () => onSelectSpecies(c.name),
            }}
          >
            <Popup minWidth={248}>
              <CollectionPopup
                collection={c}
                speciesNote={speciesNote}
                storagePath={storagePath}
                onStartLocalPolygonForFind={onStartLocalPolygonForFind}
                onStartRegionPolygonForFind={onStartRegionPolygonForFind}
                zones={collectionZones}
                speciesProfile={speciesProfilesByName.get(c.name)}
              />
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

export function CollectionPins({
  finds,
  zones = [],
  onStartLocalPolygonForFind = () => undefined,
  onStartRegionPolygonForFind = () => undefined,
  onSelectSpecies = () => undefined,
}: {
  finds: Find[];
  zones?: Zone[];
  onStartLocalPolygonForFind?: (find: Find) => void;
  onStartRegionPolygonForFind?: (find: Find) => void;
  onSelectSpecies?: (speciesName: string) => void;
}) {
  const collections = useMemo(() => collectionsFromFinds(finds), [finds]);
  return (
    <CollectionPinsInner
      collections={collections}
      onStartLocalPolygonForFind={onStartLocalPolygonForFind}
      onStartRegionPolygonForFind={onStartRegionPolygonForFind}
      onSelectSpecies={onSelectSpecies}
      zones={zones}
    />
  );
}

function coordKey(lat: number, lng: number): string {
  return `${lat},${lng}`;
}

/**
 * Converts raw species name format to HTML for pin labels.
 * "Boletus *edulis*" → "Boletus <span style='font-weight:400'>edulis</span>"
 * HTML-escapes the name before processing so user input can't inject tags.
 */
function rawToLabelHtml(raw: string): string {
  const escaped = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.replace(/\*(.*?)\*/g, (_m, word) => `<span style="font-weight:400">${word}</span>`);
}

/** Groups finds into per-location collections. Each distinct (species, exact saved coordinate) pair
 *  gets its own pin. Shared pins only happen when finds have the same stored coordinate.
 *  After grouping, a proximity pass assigns labelText and suppressLabel:
 *  - Single species at a location: labelText = Latin name, suppressLabel = false
 *  - Multiple species at same location: first gets "N species", rest suppressed */
export function collectionsFromFinds(finds: Find[]): Collection[] {
  const bySpecies = new Map<string, Array<{ key: string; lat: number; lng: number; finds: Find[] }>>();

  for (const f of finds) {
    if (f.lat == null || f.lng == null) continue;
    if (!bySpecies.has(f.species_name)) bySpecies.set(f.species_name, []);
    const buckets = bySpecies.get(f.species_name)!;
    const key = coordKey(f.lat, f.lng);

    const existing = buckets.find((b) => b.key === key);

    if (existing) {
      existing.finds.push(f);
    } else {
      buckets.push({ key, lat: f.lat, lng: f.lng, finds: [f] });
    }
  }

  const result: Collection[] = [];
  for (const [name, buckets] of bySpecies) {
    const multi = buckets.length > 1;
    for (let i = 0; i < buckets.length; i++) {
      const { lat, lng, finds } = buckets[i];
      result.push({
        key: multi ? `${name}|${i}` : name,
        name,
        lat,
        lng,
        count: finds.length,
        finds,
        labelText: '',       // filled by proximity pass below
        suppressLabel: false,
      });
    }
  }

  // Proximity pass: group co-located collections, assign label text and suppress secondary pins.
  const locationGroups: Collection[][] = [];
  for (const col of result) {
    let placed = false;
    for (const group of locationGroups) {
      if (group.some(
        (other) =>
          coordKey(other.lat, other.lng) === coordKey(col.lat, col.lng),
      )) {
        group.push(col);
        placed = true;
        break;
      }
    }
    if (!placed) locationGroups.push([col]);
  }

  for (const group of locationGroups) {
    const speciesInGroup = new Set(group.map((c) => c.name));
    if (speciesInGroup.size === 1) {
      const labelHtml = rawToLabelHtml(group[0].name.split(',')[0].trim());
      for (const col of group) {
        col.labelText = labelHtml;
        col.suppressLabel = false;
      }
    } else {
      group[0].labelText = `${speciesInGroup.size} species`;
      group[0].suppressLabel = false;
      for (let i = 1; i < group.length; i++) {
        group[i].labelText = rawToLabelHtml(group[i].name.split(',')[0].trim());
        group[i].suppressLabel = true;
      }
    }
  }

  return result;
}
