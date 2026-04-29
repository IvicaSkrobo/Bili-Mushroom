import { useMemo } from 'react';
import { Circle } from 'react-leaflet';
import type { Find } from '@/lib/finds';
import {
  visibleZonesForMode,
  type Zone,
  type ZoneViewMode,
} from '@/lib/zones';

const LOCAL_STYLE = {
  color: '#D4512A',
  fillColor: '#D4512A',
  fillOpacity: 0.14,
  opacity: 0.95,
  weight: 3,
};

const REGION_STYLE = {
  color: '#2D8C7C',
  fillColor: '#2D8C7C',
  fillOpacity: 0.12,
  opacity: 0.85,
  weight: 2,
};

interface ZoneLayersProps {
  zones: Zone[];
  finds: Find[];
  mode: ZoneViewMode;
  activeZoneId?: number | null;
  onEditZone?: (zone: Zone) => void;
}

export function ZoneLayers({
  zones,
  mode,
  activeZoneId,
  onEditZone,
}: ZoneLayersProps) {
  const visibleZones = useMemo(
    () => {
      const filtered = visibleZonesForMode(zones, mode);
      const activeZone = activeZoneId == null
        ? null
        : zones.find((zone) => zone.id === activeZoneId) ?? null;
      const merged = activeZone && !filtered.some((zone) => zone.id === activeZone.id)
        ? [...filtered, activeZone]
        : filtered;
      return merged.sort((a, b) => {
        if (a.zone_type === b.zone_type) return a.id - b.id;
        return a.zone_type === 'region' ? -1 : 1;
      });
    },
    [zones, mode, activeZoneId],
  );

  return (
    <>
      {visibleZones.map((zone) => {
        if (
          zone.geometry_type !== 'circle' ||
          zone.center_lat == null ||
          zone.center_lng == null ||
          zone.radius_meters == null
        ) {
          return null;
        }

        return (
          <Circle
            key={`${zone.id}-${zone.updated_at}-${zone.radius_meters}`}
            center={[zone.center_lat, zone.center_lng]}
            radius={zone.radius_meters}
            pathOptions={zone.zone_type === 'local' ? LOCAL_STYLE : REGION_STYLE}
            eventHandlers={{
              click: () => onEditZone?.(zone),
            }}
          />
        );
      })}
    </>
  );
}
