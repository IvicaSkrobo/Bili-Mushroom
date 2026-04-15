import { useState, useCallback, useEffect, useMemo } from 'react';
import L from 'leaflet';
import { Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import type { Find } from '@/lib/finds';

interface Collection {
  name: string;
  lat: number;
  lng: number;
  count: number;
}

function collectionIcon(name: string, showLabel: boolean): L.DivIcon {
  const AMBER = 'oklch(0.72 0.12 80)';
  const DARK = 'oklch(0.12 0.02 80)';
  const abbr = name.slice(0, 2).toUpperCase();
  const labelOpacity = showLabel ? '1' : '0';
  const labelEvents = showLabel ? 'auto' : 'none';

  // iconSize:[0,0] iconAnchor:[0,0] → the 0×0 div sits AT the coordinate.
  // Badge: position:absolute bottom:4px left:-14px → 28px wide, centered above coord.
  // Label: position:absolute top:4px left:50% transform:translateX(-50%) → centered below coord.
  // parent width:0 → left:50% = 0px from coord → translateX(-50%) centers label over coord.

  const badge = [
    'position:absolute',
    'bottom:4px',
    'left:-14px',
    'width:28px',
    'height:28px',
    `background:${AMBER}`,
    `color:${DARK}`,
    'border-radius:4px',
    `border:2px solid ${DARK}`,
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'font-weight:700',
    'font-size:11px',
    'font-family:serif',
    'text-transform:uppercase',
    'letter-spacing:0.05em',
    'box-shadow:0 2px 6px rgba(0,0,0,0.6)',
    'cursor:pointer',
  ].join(';');

  const label = [
    'position:absolute',
    'top:4px',
    'left:50%',
    'transform:translateX(-50%)',
    `background:${AMBER}`,
    `color:${DARK}`,
    'border-radius:999px',
    'padding:2px 9px',
    'font-size:11px',
    'font-family:serif',
    'font-weight:600',
    'white-space:nowrap',
    'box-shadow:0 2px 6px rgba(0,0,0,0.6)',
    `opacity:${labelOpacity}`,
    'transition:opacity 0.15s ease',
    `pointer-events:${labelEvents}`,
  ].join(';');

  return L.divIcon({
    html: `<div style="position:relative;width:0;height:0;overflow:visible;">
      <div style="${badge}">${abbr}</div>
      <div class="bili-col-label" style="${label}">${name}</div>
    </div>`,
    className: 'bili-collection-marker',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -36],
  });
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
        return (
          <Marker
            key={`col-${c.name}`}
            position={[c.lat, c.lng]}
            icon={collectionIcon(c.name, showLabel)}
          >
            <Popup>
              <div style={{ fontFamily: 'serif', minWidth: '120px' }}>
                <strong style={{ display: 'block', marginBottom: '2px' }}>{c.name}</strong>
                <span style={{ fontSize: '12px', opacity: 0.7 }}>
                  {c.count} {c.count === 1 ? 'find' : 'finds'}
                </span>
              </div>
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
  const map = new Map<string, { lats: number[]; lngs: number[]; count: number }>();
  for (const f of finds) {
    if (f.lat == null || f.lng == null) continue;
    if (!map.has(f.species_name)) map.set(f.species_name, { lats: [], lngs: [], count: 0 });
    const entry = map.get(f.species_name)!;
    entry.lats.push(f.lat);
    entry.lngs.push(f.lng);
    entry.count++;
  }
  return Array.from(map.entries()).map(([name, { lats, lngs, count }]) => ({
    name,
    lat: lats.reduce((a, b) => a + b, 0) / lats.length,
    lng: lngs.reduce((a, b) => a + b, 0) / lngs.length,
    count,
  }));
}
