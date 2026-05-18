/**
 * PickerPins — lightweight version of CollectionPins for the location picker.
 *
 * Shows the same styled pin dots + labels as the main map, but clicking a pin
 * immediately selects that location (no popup card). Used only inside
 * LocationPickerMap; the full CollectionPins with popups stays on MapTab.
 */
import { useCallback, useEffect, useState } from 'react';
import L from 'leaflet';
import { Marker, useMap, useMapEvents } from 'react-leaflet';
import type { Find } from '@/lib/finds';
import { useAppStore } from '@/stores/appStore';
import { locationGroupsFromFinds, LABEL_ZOOM_THRESHOLD } from './CollectionPins';
import { plainSpeciesName } from '@/lib/speciesName';

const OVERLAP_PX = 88;

function computeCrowded(
  map: L.Map,
  collections: ReturnType<typeof locationGroupsFromFinds>,
): Set<string> {
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

// Reuse the same icon factory as CollectionPins — keeps the look identical.
function pickerPinIcon(
  labelText: string,
  showLabel: boolean,
  isSatellite: boolean,
): L.DivIcon {
  const classes = [
    'bili-collection-marker',
    isSatellite ? 'bili-collection-marker--satellite' : '',
    !showLabel ? 'bili-collection-marker--hidden-label' : '',
    'bili-picker-pin', // extra class so CSS can add a subtle ring on hover
  ]
    .filter(Boolean)
    .join(' ');

  return L.divIcon({
    html: `<div class="bili-pin-dot"></div><div class="bili-pin-label">${labelText}</div>`,
    className: classes,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

const iconCache = new Map<string, L.DivIcon>();
function getPickerPinIcon(
  labelText: string,
  showLabel: boolean,
  isSatellite: boolean,
): L.DivIcon {
  const key = `${labelText}|${showLabel ? 'l' : 'd'}|${isSatellite ? 's' : 'n'}`;
  if (!iconCache.has(key)) {
    iconCache.set(key, pickerPinIcon(labelText, showLabel, isSatellite));
  }
  return iconCache.get(key)!;
}

interface PickerPinsProps {
  finds: Find[];
  /** Called when the user clicks an existing pin to adopt its location. */
  onPickLocation: (lat: number, lng: number, label: string) => void;
}

export function PickerPins({ finds, onPickLocation }: PickerPinsProps) {
  const map = useMap();
  const isSatellite = useAppStore((s) => s.mapLayer === 'Satellite');
  const collections = locationGroupsFromFinds(finds);

  const [crowded, setCrowded] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(() => map.getZoom());

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
        const showLabel =
          zoom >= LABEL_ZOOM_THRESHOLD && !crowded.has(c.key) && !c.suppressLabel;
        const label = plainSpeciesName((c.species[0]?.name ?? '').trim());

        return (
          <Marker
            key={`picker-${c.key}`}
            position={[c.lat, c.lng]}
            icon={getPickerPinIcon(c.labelText, showLabel, isSatellite)}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e.originalEvent);
                onPickLocation(c.lat, c.lng, label);
              },
            }}
            title={label}
          />
        );
      })}
    </>
  );
}
