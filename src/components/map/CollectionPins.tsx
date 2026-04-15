import { useState, useCallback, useEffect, useMemo } from 'react';
import L from 'leaflet';
import { Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { convertFileSrc } from '@tauri-apps/api/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Find } from '@/lib/finds';
import { useSpeciesNotes } from '@/hooks/useFinds';
import { useAppStore } from '@/stores/appStore';

interface Collection {
  name: string;
  lat: number;
  lng: number;
  count: number;
  finds: Find[];
}

function collectionIcon(name: string, showLabel: boolean): L.DivIcon {
  // Use hex colors — oklch() in Leaflet DivIcon inline styles is unreliable in Tauri WebView
  const AMBER = '#D4941A';
  const DARK = '#1C1A0C';
  // Latin name only — species_name may include Croatian after comma e.g. "Agaricus bohusii, Busenasta rudnjača"
  const latinName = name.split(',')[0].trim();
  const opacity = showLabel ? '1' : '0.35';

  // Single amber pill centered on the coordinate via transform:translate(-50%,-50%).
  // iconSize:[0,0] iconAnchor:[0,0] — anchor sits at coord; pill floats around it.
  // leaflet-div-icon default styles neutralised in index.css.
  const pill = [
    'position:absolute',
    'transform:translate(-50%,-50%)',
    `background:${AMBER}`,
    `color:${DARK}`,
    'border-radius:999px',
    'padding:3px 10px',
    'font-size:11px',
    'font-family:serif',
    'font-weight:600',
    'white-space:nowrap',
    'box-shadow:0 2px 6px rgba(0,0,0,0.5)',
    `opacity:${opacity}`,
    'transition:opacity 0.15s ease',
    'cursor:pointer',
  ].join(';');

  return L.divIcon({
    html: `<div class="bili-col-label" style="${pill}">${latinName}</div>`,
    className: 'bili-collection-marker',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -10],
  });
}

function CollectionPopup({
  collection,
  speciesNote,
  storagePath,
}: {
  collection: Collection;
  speciesNote: string | undefined;
  storagePath: string;
}) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const allPhotos = useMemo(
    () => collection.finds.flatMap((f) => f.photos.map((p) => ({ photo: p, findNotes: f.notes }))),
    [collection.finds],
  );
  const latinName = collection.name.split(',')[0].trim();
  const current = allPhotos[photoIdx] ?? null;
  const photo = current?.photo ?? null;
  const photoSrc = photo && storagePath
    ? convertFileSrc(`${storagePath}/${photo.photo_path}`)
    : null;
  const displayNote = (current?.findNotes?.trim()) || speciesNote;

  return (
    <div className="flex w-[220px] flex-col gap-2 font-sans">
      {/* Header */}
      <div>
        <p className="font-serif text-sm font-bold italic text-foreground">{latinName}</p>
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
    </div>
  );
}

const OVERLAP_PX = 130;

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

function CollectionPinsInner({ collections }: { collections: Collection[] }) {
  const map = useMap();
  const [crowded, setCrowded] = useState<Set<string>>(new Set());
  const { data: speciesNotesData } = useSpeciesNotes();
  const storagePath = useAppStore((s) => s.storagePath) ?? '';

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
        const speciesNote = speciesNotesData?.find((sn) => sn.species_name === c.name)?.notes;
        return (
          <Marker
            key={`col-${c.name}`}
            position={[c.lat, c.lng]}
            icon={collectionIcon(c.name, showLabel)}
          >
            <Popup minWidth={220}>
              <CollectionPopup
                collection={c}
                speciesNote={speciesNote}
                storagePath={storagePath}
              />
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

export function CollectionPins({ finds }: { finds: Find[] }) {
  const collections = useMemo(() => collections_from_finds(finds), [finds]);
  return <CollectionPinsInner collections={collections} />;
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
