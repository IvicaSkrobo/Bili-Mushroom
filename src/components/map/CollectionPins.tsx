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
  const [photoIdx, setPhotoIdx] = useState(0);
  const allPhotos = useMemo(
    () => collection.finds.flatMap((f) => f.photos.map((p) => ({ find: f, photo: p, findNotes: f.notes }))),
    [collection.finds],
  );
  const [latinNameRaw, croatianName] = collection.name.split(',').map((s) => s.trim());
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

  const hasPhotos = allPhotos.length > 0;

  return (
    <div className="w-[248px] overflow-hidden rounded-lg bg-background font-sans shadow-xl ring-1 ring-border/30">

      {/* ── Visual header ────────────────────────────────── */}
      <div className="relative h-[148px] w-full select-none">
        {hasPhotos ? (
          photoSrc
            ? <img src={photoSrc} alt="" className="h-full w-full object-cover" draggable={false} />
            : <div className="h-full w-full bg-secondary/60" />
        ) : (
          <div className="flex h-full w-full items-end bg-gradient-to-br from-[oklch(0.16_0.02_135)] to-[oklch(0.10_0.01_135)] p-3" />
        )}

        {/* Gradient scrim so text is always legible */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

        {/* Find-count pill — top-right */}
        <div className="absolute right-2 top-2">
          <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium tracking-wide text-white/90 backdrop-blur-sm">
            {collection.count} {collection.count === 1 ? 'nalaz' : 'nalaza'}
          </span>
        </div>

        {/* Carousel side arrows — shown when multiple photos exist */}
        {allPhotos.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => setPhotoIdx((i) => (i - 1 + allPhotos.length) % allPhotos.length)}
              className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-0.5 backdrop-blur-sm transition-colors hover:bg-black/75"
            >
              <ChevronLeft className="h-3.5 w-3.5 text-white" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => setPhotoIdx((i) => (i + 1) % allPhotos.length)}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-0.5 backdrop-blur-sm transition-colors hover:bg-black/75"
            >
              <ChevronRight className="h-3.5 w-3.5 text-white" />
            </button>
            {/* Photo counter — bottom-right, above name */}
            <span className="absolute bottom-[42px] right-2.5 text-[10px] font-medium text-white/50">
              {photoIdx + 1}/{allPhotos.length}
            </span>
          </>
        )}

        {/* Species name block — bottom of header */}
        <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2.5 pt-1">
          <p className="font-serif text-[13px] font-bold italic leading-snug text-white">
            {renderSpeciesName(latinNameRaw)}
          </p>
          {croatianName && (
            <p className="mt-0.5 text-[11px] italic leading-tight text-white/65">
              {plainSpeciesName(croatianName)}
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

/** Max degree delta to consider two finds the same physical location (~22 m at mid-latitudes). */
export const SAME_LOCATION_DEG = 0.0002;

/**
 * Converts raw species name format to HTML for pin labels.
 * "Boletus *edulis*" → "Boletus <span style='font-weight:400'>edulis</span>"
 * HTML-escapes the name before processing so user input can't inject tags.
 */
function rawToLabelHtml(raw: string): string {
  const escaped = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.replace(/\*(.*?)\*/g, (_m, word) => `<span style="font-weight:400">${word}</span>`);
}

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
