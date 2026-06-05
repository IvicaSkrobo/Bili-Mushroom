import { type ReactNode, useMemo } from 'react';
import L from 'leaflet';
import { Circle, Polygon, useMap } from 'react-leaflet';
import type { Find } from '@/lib/finds';
import {
  parsePolygonJson,
  visibleZonesForMode,
  type Zone,
  type ZoneViewMode,
} from '@/lib/zones';
import { useAppStore } from '@/stores/appStore';

function getZoneStyle(zoneType: Zone['zone_type'], isSatellite: boolean, active = false) {
  if (zoneType === 'local') {
    const style = isSatellite
      ? {
          halo: {
            color: '#FFF2D6',
            opacity: active ? 0.86 : 0.62,
            weight: active ? 9 : 8,
            fillOpacity: 0,
          },
          main: {
            color: '#FF7B4A',
            fillColor: '#C94A25',
            fillOpacity: active ? 0.2 : 0.09,
            opacity: active ? 1 : 0.78,
            weight: active ? 4 : 2,
          },
        }
      : {
          halo: null,
          main: {
            color: '#D4512A',
            fillColor: '#D4512A',
            fillOpacity: active ? 0.16 : 0.08,
            opacity: active ? 1 : 0.78,
            weight: active ? 4 : 2,
          },
        };
    return style;
  }

  const style = isSatellite
    ? {
        halo: {
          color: '#FFF4D9',
          opacity: active ? 0.9 : 0.66,
          weight: active ? 8 : 7,
          fillOpacity: 0,
        },
        main: {
          color: '#49D7C6',
          fillColor: '#2FAE9E',
          fillOpacity: active ? 0.2 : 0.08,
          opacity: active ? 1 : 0.76,
          weight: active ? 4 : 2,
          dashArray: '10 8',
        },
      }
    : {
        halo: null,
        main: {
          color: '#2D8C7C',
          fillColor: '#2D8C7C',
          fillOpacity: active ? 0.16 : 0.07,
          opacity: active ? 0.98 : 0.72,
          weight: active ? 4 : 2,
        },
      };
  return style;
}

interface ZoneLayersProps {
  zones: Zone[];
  finds: Find[];
  mode: ZoneViewMode;
  activeZoneId?: number | null;
  hiddenZoneIds?: number[];
  onEditZone?: (zone: Zone) => void;
}

export function ZoneLayers({
  zones,
  mode,
  activeZoneId,
  hiddenZoneIds = [],
  onEditZone,
}: ZoneLayersProps) {
  const isSatellite = useAppStore((s) => s.mapLayer === 'Satellite');
  const map = useMap();
  const visibleZones = useMemo(
    () => {
      const filtered = visibleZonesForMode(zones, mode).filter(
        (zone) => !hiddenZoneIds.includes(zone.id),
      );
      const activeZone = activeZoneId == null
        ? null
        : zones.find((zone) => zone.id === activeZoneId) ?? null;
      const merged = activeZone && !filtered.some((zone) => zone.id === activeZone.id)
        ? [...filtered, activeZone]
        : filtered;
      return merged
        .filter((zone) => !hiddenZoneIds.includes(zone.id))
        .sort((a, b) => {
        if (a.zone_type === b.zone_type) return a.id - b.id;
        return a.zone_type === 'region' ? -1 : 1;
      });
    },
    [zones, mode, activeZoneId, hiddenZoneIds],
  );
  const displayZones = useMemo(() => dedupeVisualZones(visibleZones, activeZoneId), [visibleZones, activeZoneId]);

  return (
    <>
      {displayZones.map((zone) => {
        const active = activeZoneId === zone.id;
        const style = getZoneStyle(zone.zone_type, isSatellite, active);
        if (
          zone.geometry_type === 'circle' &&
          zone.center_lat != null &&
          zone.center_lng != null &&
          zone.radius_meters != null
        ) {
          return (
            <PolygonZoneGroup key={`${zone.id}-${zone.updated_at}-circle`}>
              {style.halo && (
                <Circle
                  key={`${zone.id}-${zone.updated_at}-${zone.radius_meters}-halo`}
                  center={[zone.center_lat, zone.center_lng]}
                  radius={zone.radius_meters}
                  pathOptions={style.halo}
                  interactive={false}
                />
              )}
              <Circle
                key={`${zone.id}-${zone.updated_at}-${zone.radius_meters}`}
                center={[zone.center_lat, zone.center_lng]}
                radius={zone.radius_meters}
                pathOptions={style.main}
                eventHandlers={{
                  click: (e) => {
                    L.DomEvent.stopPropagation(e.originalEvent);
                    map.closePopup();
                    onEditZone?.(zone);
                  },
                }}
              />
            </PolygonZoneGroup>
          );
        }

        if (zone.geometry_type === 'polygon') {
          const polygon = parsePolygonJson(zone.polygon_json);
          if (polygon.length < 3) return null;
          return (
            <PolygonZoneGroup key={`${zone.id}-${zone.updated_at}-polygon-group`}>
              {style.halo && (
                <Polygon
                  key={`${zone.id}-${zone.updated_at}-polygon-halo`}
                  positions={polygon}
                  pathOptions={style.halo}
                  interactive={false}
                />
              )}
              <Polygon
                key={`${zone.id}-${zone.updated_at}-polygon`}
                positions={polygon}
                pathOptions={style.main}
                eventHandlers={{
                  click: (e) => {
                    L.DomEvent.stopPropagation(e.originalEvent);
                    map.closePopup();
                    onEditZone?.(zone);
                  },
                }}
              />
            </PolygonZoneGroup>
          );
        }

        return null;
      })}
    </>
  );
}

function PolygonZoneGroup({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}

function dedupeVisualZones(zones: Zone[], activeZoneId: number | null | undefined): Zone[] {
  const seen = new Set<string>();
  const result: Zone[] = [];
  for (const zone of zones) {
    if (zone.id === activeZoneId) {
      result.push(zone);
      continue;
    }
    const key = visualKey(zone);
    if (!key || !seen.has(key)) {
      if (key) seen.add(key);
      result.push(zone);
    }
  }
  return result;
}

function visualKey(zone: Zone): string | null {
  if (
    zone.geometry_type === 'circle' &&
    zone.center_lat != null &&
    zone.center_lng != null &&
    zone.radius_meters != null
  ) {
    return [
      zone.zone_type,
      zone.geometry_type,
      zone.center_lat.toFixed(5),
      zone.center_lng.toFixed(5),
      Math.round(zone.radius_meters),
    ].join(':');
  }
  if (zone.geometry_type === 'polygon' && zone.polygon_json) {
    return [zone.zone_type, zone.geometry_type, zone.polygon_json].join(':');
  }
  return null;
}
