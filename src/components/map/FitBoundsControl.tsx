import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import type { Find } from '@/lib/finds';

const CROATIA_MIN_LAT = 42.3;
const CROATIA_MAX_LAT = 46.6;
const CROATIA_MIN_LNG = 13.5;
const CROATIA_MAX_LNG = 19.5;

export function FitBoundsControl({ finds }: { finds: Find[] }) {
  const map = useMap();
  useEffect(() => {
    const withCoords = finds.filter(
      (f): f is Find & { lat: number; lng: number } =>
        f.lat !== null && f.lng !== null,
    );
    if (withCoords.length === 0) return;
    const outside = withCoords.some(
      (f) =>
        f.lat < CROATIA_MIN_LAT ||
        f.lat > CROATIA_MAX_LAT ||
        f.lng < CROATIA_MIN_LNG ||
        f.lng > CROATIA_MAX_LNG,
    );
    if (!outside) return;
    const bounds = withCoords.map(
      (f) => [f.lat, f.lng] as [number, number],
    );
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [finds, map]);
  return null;
}
