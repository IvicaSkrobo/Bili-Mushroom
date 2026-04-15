import { useMemo } from 'react';
import L from 'leaflet';
import { Marker, Popup } from 'react-leaflet';
import type { Find } from '@/lib/finds';

function collectionIcon(abbr: string): L.DivIcon {
  const style = [
    'background:oklch(0.72 0.12 80)',
    'color:oklch(0.12 0.02 80)',
    'border-radius:3px',
    'width:28px',
    'height:28px',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'font-weight:700',
    'font-size:11px',
    'border:2px solid oklch(0.12 0.02 80)',
    'font-family:serif',
    'text-transform:uppercase',
    'letter-spacing:0.05em',
    'box-shadow:0 1px 4px rgba(0,0,0,0.4)',
  ].join(';');
  return L.divIcon({
    html: `<div style="${style}">${abbr}</div>`,
    className: 'bili-collection-pin',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -30],
  });
}

export function CollectionPins({ finds }: { finds: Find[] }) {
  const collections = useMemo(() => {
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
      abbr: name.slice(0, 2),
    }));
  }, [finds]);

  return (
    <>
      {collections.map((c) => (
        <Marker
          key={`col-${c.name}`}
          position={[c.lat, c.lng]}
          icon={collectionIcon(c.abbr)}
        >
          <Popup>
            <div style={{ fontFamily: 'serif', minWidth: '120px' }}>
              <strong style={{ display: 'block', marginBottom: '2px' }}>{c.name}</strong>
              <span style={{ fontSize: '12px', opacity: 0.7 }}>{c.count} {c.count === 1 ? 'find' : 'finds'}</span>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
