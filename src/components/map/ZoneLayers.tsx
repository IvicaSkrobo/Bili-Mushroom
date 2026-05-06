import { type ReactNode, useMemo } from 'react';
import { Circle, Polygon } from 'react-leaflet';
import type { Find } from '@/lib/finds';
import {
  parsePolygonJson,
  visibleZonesForMode,
  type Zone,
  type ZoneViewMode,
} from '@/lib/zones';
import { useAppStore } from '@/stores/appStore';

function getZoneStyle(zoneType: Zone['zone_type'], isSatellite: boolean) {
  if (zoneType === 'local') {
    return isSatellite
      ? {
          halo: {
            color: '#FFF2D6',
            opacity: 0.78,
            weight: 8,
            fillOpacity: 0,
          },
          main: {
            color: '#FF7B4A',
            fillColor: '#C94A25',
            fillOpacity: 0.18,
            opacity: 0.98,
            weight: 3,
          },
        }
      : {
          halo: null,
          main: {
            color: '#D4512A',
            fillColor: '#D4512A',
            fillOpacity: 0.14,
            opacity: 0.95,
            weight: 3,
          },
        };
  }

  return isSatellite
    ? {
        halo: {
          color: '#FFF4D9',
          opacity: 0.86,
          weight: 7,
          fillOpacity: 0,
        },
        main: {
          color: '#49D7C6',
          fillColor: '#2FAE9E',
          fillOpacity: 0.18,
          opacity: 0.98,
          weight: 3,
          dashArray: '10 8',
        },
      }
    : {
        halo: null,
        main: {
          color: '#2D8C7C',
          fillColor: '#2D8C7C',
          fillOpacity: 0.12,
          opacity: 0.85,
          weight: 2,
        },
      };
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

  return (
    <>
      {visibleZones.map((zone) => {
        const style = getZoneStyle(zone.zone_type, isSatellite);
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
                  click: () => onEditZone?.(zone),
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
                  click: () => onEditZone?.(zone),
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
