import { type ReactNode, useMemo, useState } from 'react';
import L from 'leaflet';
import { Circle, Polygon, Popup, useMap } from 'react-leaflet';
import type { Find } from '@/lib/finds';
import {
  parsePolygonJson,
  visibleZonesForMode,
  zonesContainingPoint,
  type Zone,
  type ZoneViewMode,
} from '@/lib/zones';
import { useAppStore } from '@/stores/appStore';
import { renderSpeciesName } from '@/lib/speciesName';
import { useT } from '@/i18n/index';

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
  const [pickerState, setPickerState] = useState<{ lat: number; lng: number; zones: Zone[] } | null>(null);
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
                    const { lat, lng } = e.latlng;
                    const matches = zonesContainingPoint(displayZones, lat, lng);
                    if (matches.length <= 1) {
                      map.closePopup();
                      onEditZone?.(zone);
                      return;
                    }
                    setPickerState({ lat, lng, zones: matches });
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
                    const { lat, lng } = e.latlng;
                    const matches = zonesContainingPoint(displayZones, lat, lng);
                    if (matches.length <= 1) {
                      map.closePopup();
                      onEditZone?.(zone);
                      return;
                    }
                    setPickerState({ lat, lng, zones: matches });
                  },
                }}
              />
            </PolygonZoneGroup>
          );
        }

        return null;
      })}
      {pickerState && (
        <Popup
          key={`${pickerState.lat}-${pickerState.lng}`}
          position={[pickerState.lat, pickerState.lng]}
          eventHandlers={{ remove: () => setPickerState(null) }}
        >
          <ZonePickerPopup
            zones={pickerState.zones}
            onSelect={(zone) => {
              setPickerState(null);
              map.closePopup();
              onEditZone?.(zone);
            }}
          />
        </Popup>
      )}
    </>
  );
}

function ZonePickerPopup({
  zones,
  onSelect,
}: {
  zones: Zone[];
  onSelect: (zone: Zone) => void;
}) {
  const t = useT();
  return (
    <div className="w-[220px] overflow-hidden rounded-lg bg-background font-sans shadow-xl ring-1 ring-border/30">
      <p className="px-2.5 pt-2 text-[11px] font-semibold leading-snug text-foreground/80">
        {t('map.zonePickerTitle')}
      </p>
      <div className="flex flex-col gap-1 px-2 pb-2 pt-1.5">
        {zones.map((zone) => {
          const accentColor = zone.zone_type === 'local' ? '#D4512A' : '#2D8C7C';
          return (
            <button
              key={zone.id}
              type="button"
              onClick={() => onSelect(zone)}
              className="flex items-center gap-2 rounded border border-border/60 bg-input px-2 py-1.5 text-left transition-colors hover:bg-secondary"
              style={{ borderLeftColor: accentColor, borderLeftWidth: '3px' }}
            >
              <span className="min-w-0 flex-1 truncate text-[12px] leading-tight text-foreground">
                {renderSpeciesName(zone.species_name)}
              </span>
              <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {t(zone.zone_type === 'local' ? 'zone.local' : 'zone.region')}
              </span>
            </button>
          );
        })}
      </div>
    </div>
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
