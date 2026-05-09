import { useState, useCallback, useEffect, useMemo } from 'react';
import L from 'leaflet';
import { Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import type { Find, SpeciesProfile } from '@/lib/finds';
import type { Zone } from '@/lib/zones';
import { resolvePhotoSrc } from '@/lib/photoSrc';
import { useSpeciesNotes, useSpeciesProfiles } from '@/hooks/useFinds';
import { useAppStore } from '@/stores/appStore';
import { SpeciesMetadataBadges } from '@/components/species/SpeciesMetadataBadges';

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
    iconSize: [0, 0],
    iconAnchor: [0, 0],
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
  const [photoIdx, setPhotoIdx] = useState(0);
  const allPhotos = useMemo(
    () => collection.finds.flatMap((f) => f.photos.map((p) => ({ find: f, photo: p, findNotes: f.notes }))),
    [collection.finds],
  );
  const [latinName, croatianName] = collection.name.split(',').map((s) => s.trim());
  const current = allPhotos[photoIdx] ?? null;
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

  return (
    <div className="flex w-[220px] flex-col gap-2 font-sans">
      {/* Header */}
      <div>
        <p className="font-serif text-sm font-bold italic text-foreground">{latinName}</p>
        {croatianName && <p className="text-xs text-muted-foreground/80 italic">{croatianName}</p>}
        <p className="text-xs text-muted-foreground">{collection.count} {collection.count === 1 ? 'find' : 'finds'}</p>
      </div>

      <SpeciesMetadataBadges speciesProfile={speciesProfile} size="md" hideUnknown={true} />

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

      <button
        type="button"
        onClick={() => map.flyTo([collection.lat, collection.lng], Math.max(map.getZoom(), 16))}
        className="flex items-center gap-1.5 text-xs text-primary/70 hover:text-primary transition-colors"
      >
        <ZoomIn className="h-3.5 w-3.5" />
        Zoom to location
      </button>

      {current?.find.lat != null && current.find.lng != null && (
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); L.DomEvent.stopPropagation(e.nativeEvent); onStartLocalPolygonForFind(current.find); }}
            className="rounded border border-[#D4512A]/45 bg-[#D4512A]/10 px-2 py-1 text-xs font-semibold text-foreground hover:bg-[#D4512A]/18"
          >
            {existingLocalPolygon ? 'Edit local' : 'Draw local'}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); L.DomEvent.stopPropagation(e.nativeEvent); onStartRegionPolygonForFind(current.find); }}
            className="rounded border border-primary/45 bg-primary/10 px-2 py-1 text-xs font-semibold text-foreground hover:bg-primary/18"
          >
            {existingRegionPolygon ? 'Edit region' : 'Draw region'}
          </button>
        </div>
      )}
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
            <Popup minWidth={220}>
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

/** Max degree delta to consider two finds the same physical location (~22 m at mid-latitudes). */
export const SAME_LOCATION_DEG = 0.0002;

/** Groups finds into per-location-bucket collections. Each distinct (species, location) pair
 *  gets its own pin. Finds within SAME_LOCATION_DEG of an existing bucket join that bucket.
 *  After grouping, a proximity pass assigns labelText and suppressLabel:
 *  - Single species at a location: labelText = Latin name, suppressLabel = false
 *  - Multiple species at same location: first gets "N species", rest suppressed */
export function collectionsFromFinds(finds: Find[]): Collection[] {
  const bySpecies = new Map<string, Array<{ sumLat: number; sumLng: number; finds: Find[] }>>();

  for (const f of finds) {
    if (f.lat == null || f.lng == null) continue;
    if (!bySpecies.has(f.species_name)) bySpecies.set(f.species_name, []);
    const buckets = bySpecies.get(f.species_name)!;

    const existing = buckets.find(
      (b) =>
        Math.abs(b.sumLat / b.finds.length - f.lat!) <= SAME_LOCATION_DEG &&
        Math.abs(b.sumLng / b.finds.length - f.lng!) <= SAME_LOCATION_DEG,
    );

    if (existing) {
      existing.sumLat += f.lat;
      existing.sumLng += f.lng;
      existing.finds.push(f);
    } else {
      buckets.push({ sumLat: f.lat, sumLng: f.lng, finds: [f] });
    }
  }

  const result: Collection[] = [];
  for (const [name, buckets] of bySpecies) {
    const multi = buckets.length > 1;
    for (let i = 0; i < buckets.length; i++) {
      const { sumLat, sumLng, finds } = buckets[i];
      result.push({
        key: multi ? `${name}|${i}` : name,
        name,
        lat: sumLat / finds.length,
        lng: sumLng / finds.length,
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
          Math.abs(other.lat - col.lat) <= SAME_LOCATION_DEG &&
          Math.abs(other.lng - col.lng) <= SAME_LOCATION_DEG,
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
      const latinName = group[0].name.split(',')[0].trim();
      for (const col of group) {
        col.labelText = latinName;
        col.suppressLabel = false;
      }
    } else {
      group[0].labelText = `${speciesInGroup.size} species`;
      group[0].suppressLabel = false;
      for (let i = 1; i < group.length; i++) {
        // keep species name so hover over the dot reveals which species it is
        group[i].labelText = group[i].name.split(',')[0].trim();
        group[i].suppressLabel = true;
      }
    }
  }

  return result;
}
