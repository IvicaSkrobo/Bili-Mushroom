import { useState, useCallback, useEffect, useMemo } from 'react';
import L from 'leaflet';
import { Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Find } from '@/lib/finds';
import type { Zone, ZoneType, ZoneViewMode } from '@/lib/zones';
import { resolvePhotoSrc } from '@/lib/photoSrc';
import { useSpeciesNotes } from '@/hooks/useFinds';
import { useAppStore } from '@/stores/appStore';

interface Collection {
  name: string;
  lat: number;
  lng: number;
  count: number;
  finds: Find[];
}

function collectionIcon(name: string, showLabel: boolean, isSatellite: boolean): L.DivIcon {
  // Latin name only — species_name may include Croatian after comma e.g. "Agaricus bohusii, Busenasta rudnjača"
  const latinName = name.split(',')[0].trim();
  // CSS classes drive color (satellite) and crowded dot state — no inline opacity hack.
  const classes = [
    'bili-collection-marker',
    isSatellite ? 'bili-collection-marker--satellite' : '',
    !showLabel ? 'bili-collection-marker--crowded' : '',
  ].filter(Boolean).join(' ');
  const pill = `position:absolute;transform:translate(-50%,-50%);`;

  return L.divIcon({
    html: `<div class="bili-col-label" style="${pill}">${latinName}</div>`,
    className: classes,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -10],
  });
}

const collectionIconCache = new Map<string, L.DivIcon>();

function getCollectionIcon(name: string, showLabel: boolean, isSatellite: boolean): L.DivIcon {
  const cacheKey = `${name}|${showLabel ? 'l' : 'd'}|${isSatellite ? 's' : 'n'}`;
  const cached = collectionIconCache.get(cacheKey);
  if (cached) return cached;
  const created = collectionIcon(name, showLabel, isSatellite);
  collectionIconCache.set(cacheKey, created);
  return created;
}

function CollectionPopup({
  collection,
  speciesNote,
  storagePath,
  onCreateZoneForFind,
  zones,
  zoneMode,
}: {
  collection: Collection;
  speciesNote: string | undefined;
  storagePath: string;
  onCreateZoneForFind: (find: Find, zoneType: ZoneType) => void;
  zones: Zone[];
  zoneMode: ZoneViewMode;
}) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const allPhotos = useMemo(
    () => collection.finds.flatMap((f) => f.photos.map((p) => ({ find: f, photo: p, findNotes: f.notes }))),
    [collection.finds],
  );
  const [latinName, croatianName] = collection.name.split(',').map((s) => s.trim());
  const current = allPhotos[photoIdx] ?? null;
  const photo = current?.photo ?? null;
  const pinZoneType: ZoneType = zoneMode === 'region' ? 'region' : 'local';
  const existingPinZone = current?.find
    ? zones.find((zone) => {
      if (zone.zone_type !== pinZoneType) return false;
      if (pinZoneType === 'region') return true;
      return zone.source_find_id === current.find.id;
    })
    : null;
  const photoSrc = photo && storagePath
    ? resolvePhotoSrc(storagePath, photo.photo_path)
    : null;
  const displayNote = (current?.findNotes?.trim()) || speciesNote;

  return (
    <div className="flex w-[220px] flex-col gap-2 font-sans">
      {/* Header */}
      <div>
        <p className="font-serif text-sm font-bold italic text-foreground">{latinName}</p>
        {croatianName && <p className="text-xs text-muted-foreground/80 italic">{croatianName}</p>}
        <p className="text-xs text-muted-foreground">{collection.count} {collection.count === 1 ? 'find' : 'finds'}</p>
      </div>

      {/* Description — scrollable, per-photo notes or species fallback */}
      {displayNote && (
        <div className="max-h-[90px] overflow-y-auto rounded border border-border/40 bg-secondary/30 p-2 text-xs leading-relaxed text-foreground/80">
          {displayNote}
        </div>
      )}

      {/* Photo carousel */}
      {allPhotos.length > 0 && (
        <div className="flex flex-col gap-1">
          {photoSrc ? (
            <img
              src={photoSrc}
              alt=""
              className="h-[130px] w-full rounded object-cover"
            />
          ) : (
            <div className="h-[130px] w-full rounded bg-secondary" />
          )}
          {allPhotos.length > 1 && (
            <div className="flex items-center justify-between">
              <button
                type="button"
                aria-label="Previous photo"
                onClick={() => setPhotoIdx((i) => (i - 1 + allPhotos.length) % allPhotos.length)}
                className="rounded p-0.5 hover:bg-secondary"
              >
                <ChevronLeft className="h-4 w-4 text-foreground" />
              </button>
              <span className="text-xs text-muted-foreground">
                {photoIdx + 1} / {allPhotos.length}
              </span>
              <button
                type="button"
                aria-label="Next photo"
                onClick={() => setPhotoIdx((i) => (i + 1) % allPhotos.length)}
                className="rounded p-0.5 hover:bg-secondary"
              >
                <ChevronRight className="h-4 w-4 text-foreground" />
              </button>
            </div>
          )}
        </div>
      )}

      {current?.find.lat != null && current.find.lng != null && (
        <button
          type="button"
          onClick={() => onCreateZoneForFind(current.find, pinZoneType)}
          className="rounded border border-primary/45 px-2 py-1 text-xs font-semibold text-foreground hover:bg-primary/10"
        >
          {existingPinZone ? `Edit ${pinZoneType} zone` : `Add ${pinZoneType} zone`}
        </button>
      )}
    </div>
  );
}

const OVERLAP_PX = 18;

function computeCrowded(map: L.Map, collections: Collection[]): Set<string> {
  const crowded = new Set<string>();
  const points = collections.map((c) => ({
    name: c.name,
    pt: map.latLngToLayerPoint([c.lat, c.lng]),
  }));
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[i].pt.x - points[j].pt.x;
      const dy = points[i].pt.y - points[j].pt.y;
      if (Math.sqrt(dx * dx + dy * dy) < OVERLAP_PX) {
        crowded.add(points[i].name);
        crowded.add(points[j].name);
      }
    }
  }
  return crowded;
}

function CollectionPinsInner({
  collections,
  onCreateZoneForFind,
  onSelectSpecies,
  zones,
  zoneMode,
}: {
  collections: Collection[];
  onCreateZoneForFind: (find: Find, zoneType: ZoneType) => void;
  onSelectSpecies: (speciesName: string) => void;
  zones: Zone[];
  zoneMode: ZoneViewMode;
}) {
  const map = useMap();
  const [crowded, setCrowded] = useState<Set<string>>(new Set());
  const { data: speciesNotesData } = useSpeciesNotes();
  const storagePath = useAppStore((s) => s.storagePath) ?? '';
  const isSatellite = useAppStore((s) => s.mapLayer === 'Satellite');
  const speciesNotesByName = useMemo(() => {
    const notes = new Map<string, string>();
    for (const entry of speciesNotesData ?? []) {
      notes.set(entry.species_name, entry.notes);
    }
    return notes;
  }, [speciesNotesData]);
  const update = useCallback(() => {
    setCrowded(computeCrowded(map, collections));
  }, [map, collections]);

  useEffect(() => {
    update();
  }, [update]);

  useMapEvents({
    zoomend: update,
    moveend: update,
  });

  return (
    <>
      {collections.map((c) => {
        const showLabel = !crowded.has(c.name);
        const speciesNote = speciesNotesByName.get(c.name);
        const collectionZones = zones.filter((zone) => zone.species_name === c.name);
        return (
          <Marker
            key={`col-${c.name}`}
            position={[c.lat, c.lng]}
            icon={getCollectionIcon(c.name, showLabel, isSatellite)}
            eventHandlers={{
              click: () => onSelectSpecies(c.name),
            }}
          >
            <Popup minWidth={220}>
              <CollectionPopup
                collection={c}
                speciesNote={speciesNote}
                storagePath={storagePath}
                onCreateZoneForFind={onCreateZoneForFind}
                zones={collectionZones}
                zoneMode={zoneMode}
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
  zoneMode = 'pins',
  onCreateZoneForFind = () => undefined,
  onSelectSpecies = () => undefined,
}: {
  finds: Find[];
  zones?: Zone[];
  zoneMode?: ZoneViewMode;
  onCreateZoneForFind?: (find: Find, zoneType: ZoneType) => void;
  onSelectSpecies?: (speciesName: string) => void;
}) {
  const collections = useMemo(() => collections_from_finds(finds), [finds]);
  return (
    <CollectionPinsInner
      collections={collections}
      onCreateZoneForFind={onCreateZoneForFind}
      onSelectSpecies={onSelectSpecies}
      zones={zones}
      zoneMode={zoneMode}
    />
  );
}

function collections_from_finds(finds: Find[]): Collection[] {
  const map = new Map<string, { lats: number[]; lngs: number[]; count: number; finds: Find[] }>();
  for (const f of finds) {
    if (f.lat == null || f.lng == null) continue;
    if (!map.has(f.species_name)) map.set(f.species_name, { lats: [], lngs: [], count: 0, finds: [] });
    const entry = map.get(f.species_name)!;
    entry.lats.push(f.lat);
    entry.lngs.push(f.lng);
    entry.count++;
    entry.finds.push(f);
  }
  return Array.from(map.entries()).map(([name, { lats, lngs, count, finds }]) => ({
    name,
    lat: lats.reduce((a, b) => a + b, 0) / lats.length,
    lng: lngs.reduce((a, b) => a + b, 0) / lngs.length,
    count,
    finds,
  }));
}
