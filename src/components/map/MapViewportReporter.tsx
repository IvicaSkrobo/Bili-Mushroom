import { useEffect, useRef } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import type L from 'leaflet';
import type { MapBounds, MapViewport } from '@/lib/finds';

const VIEWPORT_OVERSCAN = 0.25;
const VIEWPORT_DEBOUNCE_MS = 120;

function rounded(value: number): number {
  return Number(value.toFixed(5));
}

export function mapBoundsWithOverscan(map: L.Map): MapBounds {
  const bounds = map.getBounds().pad(VIEWPORT_OVERSCAN);
  return {
    south: rounded(Math.max(-90, bounds.getSouth())),
    west: rounded(Math.max(-180, bounds.getWest())),
    north: rounded(Math.min(90, bounds.getNorth())),
    east: rounded(Math.min(180, bounds.getEast())),
  };
}

export function MapViewportReporter({
  onViewportChange,
}: {
  onViewportChange: (viewport: MapViewport) => void;
}) {
  const map = useMap();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(onViewportChange);
  callbackRef.current = onViewportChange;

  function report(immediate = false) {
    if (timerRef.current) clearTimeout(timerRef.current);
    const emit = () => callbackRef.current({ bounds: mapBoundsWithOverscan(map), zoom: map.getZoom() });
    if (immediate) emit();
    else timerRef.current = setTimeout(emit, VIEWPORT_DEBOUNCE_MS);
  }

  useEffect(() => {
    report(true);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // The map instance is stable for the MapContainer lifetime.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useMapEvents({
    moveend() {
      report();
    },
  });

  return null;
}
