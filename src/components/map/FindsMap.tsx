import { useEffect } from 'react';
import { MapContainer, useMap } from 'react-leaflet';
import type { Find } from '@/lib/finds';
import { applyLeafletIconFix } from './leafletIconFix';
import { createRustProxyTileLayer } from './RustProxyTileLayer';

applyLeafletIconFix();

const CROATIA_CENTER: [number, number] = [45.1, 15.2];
const CROATIA_ZOOM = 7;
const OSM_TEMPLATE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

interface FindsMapProps {
  finds: Find[];
  storagePath: string;
}

/**
 * Internal child: imperatively attach a RustProxyTileLayer via useMap.
 * MapContainer props are immutable, so tile layers must be added this way.
 */
function OsmProxyLayer({ storagePath }: { storagePath: string }) {
  const map = useMap();
  useEffect(() => {
    const layer = createRustProxyTileLayer({
      urlTemplate: OSM_TEMPLATE,
      storagePath,
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    });
    layer.addTo(map);
    return () => {
      layer.remove();
    };
  }, [map, storagePath]);
  return null;
}

export function FindsMap({ finds: _finds, storagePath }: FindsMapProps) {
  return (
    <div className="animate-fade-up h-full w-full">
      <MapContainer
        center={CROATIA_CENTER}
        zoom={CROATIA_ZOOM}
        style={{ height: '100%', width: '100%' }}
        className="rounded-md"
      >
        <OsmProxyLayer storagePath={storagePath} />
      </MapContainer>
    </div>
  );
}
