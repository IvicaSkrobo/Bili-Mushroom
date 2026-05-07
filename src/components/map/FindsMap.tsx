import { CircleMarker, MapContainer, Marker, Polygon, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Check, Move, Trash2, X } from 'lucide-react';
import type { Find } from '@/lib/finds';
import { parsePolygonJson, type Zone, type ZonePolygonPoint, type ZoneType, type ZoneViewMode } from '@/lib/zones';
import { applyLeafletIconFix } from './leafletIconFix';
import { CollectionPins } from './CollectionPins';
import { FitBoundsControl } from './FitBoundsControl';
import { LayerSwitcher } from './LayerSwitcher';
import { OnlineStatusBadge } from './OnlineStatusBadge';
import { ZoneLayers } from './ZoneLayers';
import { ZoneEditorPanel } from './ZoneEditorPanel';
import { useAppStore } from '@/stores/appStore';

applyLeafletIconFix();

const CROATIA_CENTER: [number, number] = [45.1, 15.2];
const CROATIA_ZOOM = 7;

interface FindsMapProps {
  finds: Find[];
  zones?: Zone[];
  zoneMode?: ZoneViewMode;
  onCreateZoneForFind?: (find: Find, zoneType: ZoneType) => void;
  onPickLocalTargetFind?: (find: Find) => void;
  onPickRegionTargetFind?: (find: Find) => void;
  onStartLocalPolygonForFind?: (find: Find) => void;
  onStartRegionPolygonForFind?: (find: Find) => void;
  polygonDraftPoints?: ZonePolygonPoint[];
  polygonDraftActive?: boolean;
  onPolygonDraftPointAdd?: (point: ZonePolygonPoint) => void;
  polygonDraftZoneName?: string | null;
  polygonDraftZoneType?: ZoneType | null;
  onPolygonDraftSave?: () => Promise<void>;
  onPolygonDraftCancel?: () => void;
  onPolygonDraftUndo?: () => void;
  polygonEditPoints?: ZonePolygonPoint[];
  polygonEditActive?: boolean;
  onPolygonEditPointMove?: (index: number, point: ZonePolygonPoint) => void;
  onPolygonEditPointSelect?: (index: number) => void;
  onPolygonEditPointInsert?: (edgeStartIndex: number, point: ZonePolygonPoint) => void;
  selectedPolygonEditPointIndex?: number | null;
  onPolygonEditPointDelete?: () => void;
  onStartPolygonEdit?: () => void;
  onCancelPolygonEdit?: () => void;
  onSavePolygonEdit?: () => Promise<void>;
  polygonEditZoneName?: string | null;
  polygonEditZoneType?: ZoneType | null;
  focusMode?: boolean;
  onSelectSpecies?: (speciesName: string) => void;
  activeZoneId?: number | null;
  onZoneSaved?: (zone: Zone) => void;
  onZoneTypeSelected?: (zone: Zone, zoneType: ZoneType) => void;
  onEditZone?: (zone: Zone | null) => void;
  drawTargetFind?: Find | null;
  drawTargetZoneType?: ZoneType | null;
}

export function FindsMap({
  finds,
  zones = [],
  zoneMode = 'pins',
  onCreateZoneForFind = () => undefined,
  onPickLocalTargetFind = () => undefined,
  onPickRegionTargetFind = () => undefined,
  onStartLocalPolygonForFind = () => undefined,
  onStartRegionPolygonForFind = () => undefined,
  polygonDraftPoints = [],
  polygonDraftActive = false,
  onPolygonDraftPointAdd = () => undefined,
  polygonDraftZoneName = null,
  polygonDraftZoneType = null,
  onPolygonDraftSave = async () => undefined,
  onPolygonDraftCancel = () => undefined,
  onPolygonDraftUndo = () => undefined,
  polygonEditPoints = [],
  polygonEditActive = false,
  onPolygonEditPointMove = () => undefined,
  onPolygonEditPointSelect = () => undefined,
  onPolygonEditPointInsert = () => undefined,
  selectedPolygonEditPointIndex = null,
  onPolygonEditPointDelete = () => undefined,
  onStartPolygonEdit = () => undefined,
  onCancelPolygonEdit = () => undefined,
  onSavePolygonEdit = async () => undefined,
  polygonEditZoneName = null,
  polygonEditZoneType = null,
  focusMode = false,
  onSelectSpecies = () => undefined,
  activeZoneId = null,
  onZoneSaved,
  onZoneTypeSelected,
  onEditZone = () => undefined,
  drawTargetFind = null,
  drawTargetZoneType = null,
}: FindsMapProps) {
  const [map, setMap] = useState<L.Map | null>(null);
  const activeZone = activeZoneId == null
    ? null
    : zones.find((zone) => zone.id === activeZoneId) ?? null;

  function focusDrawTarget(find: Find, zoneType: ZoneType) {
    if (!map || find.lat == null || find.lng == null) return;

    const existingPolygon = zones.find((zone) => {
      if (zone.zone_type !== zoneType || zone.geometry_type !== 'polygon') return false;
      if (zoneType === 'local') return zone.source_find_id === find.id;
      return zone.species_name === find.species_name;
    }) ?? null;

    if (existingPolygon) {
      const polygon = parsePolygonJson(existingPolygon.polygon_json);
      if (polygon.length >= 3) {
        map.flyToBounds(polygon, {
          animate: true,
          duration: 0.7,
          padding: [24, 24],
        });
        return;
      }
    }

    const zoom = zoneType === 'local' ? 17 : 15.2;
    map.flyTo([find.lat, find.lng], zoom, { animate: true, duration: 0.7 });
  }

  function handleStartLocalPolygonFromPin(find: Find) {
    focusDrawTarget(find, 'local');
    onStartLocalPolygonForFind(find);
  }

  function handleStartRegionPolygonFromPin(find: Find) {
    focusDrawTarget(find, 'region');
    onStartRegionPolygonForFind(find);
  }

  useEffect(() => {
    if (!polygonDraftActive || !drawTargetFind || !drawTargetZoneType) return;
    focusDrawTarget(drawTargetFind, drawTargetZoneType);
  }, [polygonDraftActive, drawTargetFind, drawTargetZoneType, map]);

  function handleZoomToZone(zone: Zone, selectedType: ZoneType) {
    if (!map) return;
    if (zone.geometry_type === 'polygon') {
      const polygon = parsePolygonJson(zone.polygon_json);
      if (polygon.length < 3) return;
      map.flyToBounds(polygon, {
        animate: true,
        duration: 0.7,
        padding: [24, 24],
      });
      return;
    }
    if (zone.center_lat == null || zone.center_lng == null || zone.radius_meters == null) return;
    const isLocal = selectedType === 'local';
    const radius = zone.radius_meters;
    const zoom = isLocal
      ? radius <= 80 ? 17 : radius <= 250 ? 16 : radius <= 700 ? 15 : 14
      : radius <= 700 ? 14 : radius <= 2000 ? 13 : radius <= 6000 ? 12 : 11;
    map.flyTo([zone.center_lat, zone.center_lng], zoom, { duration: 0.7 });
  }

  return (
    <div className="animate-fade-up relative h-full w-full">
      <MapContainer
        center={CROATIA_CENTER}
        zoom={CROATIA_ZOOM}
        style={{ height: '100%', width: '100%' }}
        className="rounded-md"
      >
        <MapReady onReady={setMap} />
        <PolygonDraftController
          drawing={polygonDraftActive}
          onAddPoint={onPolygonDraftPointAdd}
        />
        <LayerSwitcher />
        <ZoneLayers
          zones={zones}
          finds={finds}
          mode={zoneMode}
          activeZoneId={activeZoneId}
          hiddenZoneIds={polygonEditActive && activeZoneId != null ? [activeZoneId] : []}
          onEditZone={(zone) => onEditZone(zone)}
        />
        <PolygonDraftLayer
          drawing={polygonDraftActive}
          points={polygonDraftPoints}
          zoneType={polygonDraftZoneType}
        />
        <PolygonEditHandles
          active={polygonEditActive}
          points={polygonEditPoints}
          onPointMove={onPolygonEditPointMove}
          onPointSelect={onPolygonEditPointSelect}
          onPointInsert={onPolygonEditPointInsert}
          selectedIndex={selectedPolygonEditPointIndex}
          zoneType={polygonEditZoneType}
        />
        {!focusMode && (
          <CollectionPins
            finds={finds}
            zones={zones}
            onStartLocalPolygonForFind={handleStartLocalPolygonFromPin}
            onStartRegionPolygonForFind={handleStartRegionPolygonFromPin}
            onSelectSpecies={onSelectSpecies}
          />
        )}
        <FitBoundsControl finds={finds} />
        {!focusMode && <OnlineStatusBadge />}
      </MapContainer>
      {activeZone && !polygonDraftActive && (
        <ZoneEditorPanel
          key={activeZone.id}
          zone={activeZone}
          finds={finds}
          polygonEditing={polygonEditActive}
          polygonPointCount={polygonEditPoints.length}
          focusMode={focusMode}
          onStartPolygonEdit={onStartPolygonEdit}
          onCancelPolygonEdit={onCancelPolygonEdit}
          onSavePolygonEdit={onSavePolygonEdit}
          onClose={() => onEditZone(null)}
          onZoneSaved={(zone) => onZoneSaved?.(zone)}
          onZoneTypeSelected={(zone, zoneType) => onZoneTypeSelected?.(zone, zoneType)}
          onZoomToZone={handleZoomToZone}
        />
      )}
      {polygonDraftActive && (
        <PolygonDraftBanner
          zoneName={polygonDraftZoneName}
          zoneType={polygonDraftZoneType}
          pointCount={polygonDraftPoints.length}
          onUndo={onPolygonDraftUndo}
          onCancel={onPolygonDraftCancel}
          onSave={onPolygonDraftSave}
        />
      )}
      {polygonEditActive && (
        <PolygonEditBanner
          zoneName={polygonEditZoneName}
          pointCount={polygonEditPoints.length}
          selectedPointIndex={selectedPolygonEditPointIndex}
          canDeletePoint={polygonEditPoints.length > 3}
          onDeletePoint={onPolygonEditPointDelete}
          onSave={onSavePolygonEdit}
          onCancel={onCancelPolygonEdit}
        />
      )}
    </div>
  );
}

function PolygonDraftBanner({
  zoneName,
  zoneType,
  pointCount,
  onUndo,
  onCancel,
  onSave,
}: {
  zoneName: string | null;
  zoneType: ZoneType | null;
  pointCount: number;
  onUndo: () => void;
  onCancel: () => void;
  onSave: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const canSave = pointCount >= 3;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-[1003] flex justify-center px-4">
      <div className="pointer-events-auto flex w-[min(560px,100%)] items-center justify-between gap-3 rounded-xl border border-secondary/35 bg-card/96 px-3 py-2 shadow-2xl backdrop-blur">
        <div className="min-w-0">
          <p className="truncate font-serif text-sm font-semibold italic text-foreground">
            Drawing {zoneType ?? 'zone'} boundary{zoneName ? `: ${zoneName}` : ''}
          </p>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Move className="h-3.5 w-3.5 text-secondary" />
            Click the map to add points. {pointCount} points placed.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onUndo}
            disabled={pointCount === 0}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-border/60 px-2.5 text-[11px] font-semibold text-muted-foreground hover:bg-secondary/20 hover:text-foreground disabled:opacity-45"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-border/60 px-2.5 text-[11px] font-semibold text-muted-foreground hover:bg-secondary/20 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5" />
            {saving ? 'Saving' : 'Save shape'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PolygonEditBanner({
  zoneName,
  pointCount,
  selectedPointIndex,
  canDeletePoint,
  onDeletePoint,
  onSave,
  onCancel,
}: {
  zoneName: string | null;
  pointCount: number;
  selectedPointIndex: number | null;
  canDeletePoint: boolean;
  onDeletePoint: () => void;
  onSave: () => Promise<void>;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-[1003] flex justify-center px-4">
      <div className="pointer-events-auto flex w-[min(560px,100%)] items-center justify-between gap-3 rounded-xl border border-secondary/35 bg-card/96 px-3 py-2 shadow-2xl backdrop-blur">
        <div className="min-w-0">
          <p className="truncate font-serif text-sm font-semibold italic text-foreground">
            Editing boundary{zoneName ? `: ${zoneName}` : ''}
          </p>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Move className="h-3.5 w-3.5 text-secondary" />
            Drag the numbered points on the map, then save the shape. {pointCount} points active.
            {selectedPointIndex != null ? ` Point ${selectedPointIndex + 1} selected.` : ' Click a point to select it.'}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground/80">
            Use the small `+` handles on polygon edges to insert a new point.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onDeletePoint}
            disabled={selectedPointIndex == null || !canDeletePoint}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-destructive/40 px-2.5 text-[11px] font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-45"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete point
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-border/60 px-2.5 text-[11px] font-semibold text-muted-foreground hover:bg-secondary/20 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5" />
            {saving ? 'Saving' : 'Save shape'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PolygonEditHandles({
  active,
  points,
  onPointMove,
  onPointSelect,
  onPointInsert,
  selectedIndex,
  zoneType,
}: {
  active: boolean;
  points: ZonePolygonPoint[];
  onPointMove: (index: number, point: ZonePolygonPoint) => void;
  onPointSelect: (index: number) => void;
  onPointInsert: (edgeStartIndex: number, point: ZonePolygonPoint) => void;
  selectedIndex: number | null;
  zoneType: ZoneType | null;
}) {
  const isSatellite = useAppStore((s) => s.mapLayer === 'Satellite');
  const haloPolygonRef = useRef<L.Polygon | null>(null);
  const mainPolygonRef = useRef<L.Polygon | null>(null);
  const previewPointsRef = useRef<ZonePolygonPoint[]>(points);
  const isLocal = zoneType === 'local';
  const strokeColor = isLocal
    ? (isSatellite ? '#FF9A5A' : '#D4512A')
    : (isSatellite ? '#49D7C6' : '#2D8C7C');
  const fillColor = isLocal
    ? (isSatellite ? '#D4512A' : '#D4512A')
    : (isSatellite ? '#2FAE9E' : '#2D8C7C');
  const haloColor = isLocal ? '#FFE0C2' : '#FFF4D9';

  function syncPreviewLayers(nextPoints: ZonePolygonPoint[]) {
    previewPointsRef.current = nextPoints;
    haloPolygonRef.current?.setLatLngs(nextPoints);
    mainPolygonRef.current?.setLatLngs(nextPoints);
  }

  useEffect(() => {
    syncPreviewLayers(points);
  }, [points]);

  if (!active || points.length === 0) return null;

  return (
    <>
      {points.length >= 3 && isSatellite && (
        <Polygon
          ref={haloPolygonRef}
          positions={points}
          pathOptions={{
            color: haloColor,
            fillColor: haloColor,
            fillOpacity: 0.06,
            opacity: 0.8,
            weight: 7,
          }}
        />
      )}
      {points.length >= 3 && (
        <Polygon
          ref={mainPolygonRef}
          positions={points}
          pathOptions={{
            color: strokeColor,
            fillColor,
            fillOpacity: isSatellite ? 0.18 : 0.1,
            opacity: 0.98,
            weight: isSatellite ? 3 : 2,
          }}
        />
      )}
      {points.map((point, index) => (
        <Marker
          key={`${point[0]}-${point[1]}-${index}-drag`}
          position={point}
          draggable
          zIndexOffset={1000}
          icon={createPolygonHandleIcon(isSatellite, index + 1, selectedIndex === index)}
          eventHandlers={{
            click: () => onPointSelect(index),
            drag: (event) => {
              const marker = event.target as L.Marker;
              const next = marker.getLatLng();
              syncPreviewLayers(
                previewPointsRef.current.map((existing, existingIndex) =>
                  existingIndex === index ? [next.lat, next.lng] : existing,
                ),
              );
            },
            dragend: (event) => {
              const marker = event.target as L.Marker;
              const next = marker.getLatLng();
              onPointSelect(index);
              onPointMove(index, [next.lat, next.lng]);
            },
          }}
        />
      ))}
      {points.length >= 2 &&
        points.map((point, index) => {
          const nextPoint = points[(index + 1) % points.length];

          return (
            <Fragment key={`edge-${index}-${point[0]}-${point[1]}-${nextPoint[0]}-${nextPoint[1]}`}>
              {isSatellite && (
                <Polyline
                  positions={[point, nextPoint]}
                  pathOptions={{
                    color: haloColor,
                    weight: 7,
                    opacity: 0.84,
                  }}
                />
              )}
              <Polyline
                positions={[point, nextPoint]}
                pathOptions={{
                  color: strokeColor,
                  weight: isSatellite ? 3 : 2,
                  opacity: 0.98,
                }}
              />
              <Polyline
                positions={[point, nextPoint]}
                pathOptions={{
                  color: '#F4E8C8',
                  weight: 8,
                  opacity: 0,
                }}
                eventHandlers={{
                  click: (event) => {
                    onPointInsert(index, projectPointOntoSegment([event.latlng.lat, event.latlng.lng], point, nextPoint));
                  },
                }}
              />
            </Fragment>
          );
        })}
    </>
  );
}

const polygonHandleIconCache = new Map<string, L.DivIcon>();

function projectPointOntoSegment(
  point: ZonePolygonPoint,
  segmentStart: ZonePolygonPoint,
  segmentEnd: ZonePolygonPoint,
): ZonePolygonPoint {
  const [pointLat, pointLng] = point;
  const [startLat, startLng] = segmentStart;
  const [endLat, endLng] = segmentEnd;
  const deltaLat = endLat - startLat;
  const deltaLng = endLng - startLng;
  const segmentLengthSquared = deltaLat * deltaLat + deltaLng * deltaLng;

  if (segmentLengthSquared <= Number.EPSILON) {
    return segmentStart;
  }

  const projection =
    ((pointLat - startLat) * deltaLat + (pointLng - startLng) * deltaLng) / segmentLengthSquared;
  const clampedProjection = Math.max(0, Math.min(1, projection));

  return [
    startLat + deltaLat * clampedProjection,
    startLng + deltaLng * clampedProjection,
  ];
}

function createPolygonHandleIcon(isSatellite: boolean, number: number, selected: boolean) {
  const cacheKey = `${isSatellite ? 'sat' : 'base'}-${number}-${selected ? 'selected' : 'idle'}`;
  const cached = polygonHandleIconCache.get(cacheKey);
  if (cached) return cached;
  const icon = L.divIcon({
    className: 'bili-zone-vertex-icon',
    html: `
      <div class="bili-zone-vertex ${isSatellite ? 'bili-zone-vertex--satellite' : ''} ${selected ? 'bili-zone-vertex--selected' : ''}">
        <span>${number}</span>
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
  polygonHandleIconCache.set(cacheKey, icon);
  return icon;
}

function PolygonDraftController({
  drawing,
  onAddPoint,
}: {
  drawing: boolean;
  onAddPoint: (point: ZonePolygonPoint) => void;
}) {
  useMapEvents({
    click(event) {
      if (!drawing) return;
      onAddPoint([event.latlng.lat, event.latlng.lng]);
    },
  });

  return null;
}

function PolygonDraftLayer({
  drawing,
  points,
  zoneType,
}: {
  drawing: boolean;
  points: ZonePolygonPoint[];
  zoneType: ZoneType | null;
}) {
  const isSatellite = useAppStore((s) => s.mapLayer === 'Satellite');
  if (!drawing && points.length === 0) return null;

  const isLocal = zoneType === 'local';
  const strokeColor = isLocal
    ? (isSatellite ? '#FF9A5A' : '#D4512A')
    : (isSatellite ? '#49D7C6' : '#2D8C7C');
  const fillColor = isLocal
    ? (isSatellite ? '#D4512A' : '#D4512A')
    : (isSatellite ? '#2FAE9E' : '#2D8C7C');
  const haloColor = isLocal ? '#FFE0C2' : '#FFF4D9';

  return (
    <>
      {isSatellite && points.length >= 2 && (
        <Polyline
          positions={points}
          pathOptions={{
            color: haloColor,
            weight: 7,
            opacity: 0.84,
          }}
        />
      )}
      {points.length >= 2 && (
        <Polyline
          positions={points}
          pathOptions={{
            color: strokeColor,
            weight: isSatellite ? 3 : 2,
            opacity: 0.98,
            dashArray: isSatellite ? '10 8' : '6 6',
          }}
        />
      )}
      {isSatellite && points.length >= 3 && (
        <Polygon
          positions={points}
          pathOptions={{
            color: haloColor,
            fillColor: haloColor,
            fillOpacity: 0,
            opacity: 0.78,
            weight: 7,
          }}
        />
      )}
      {points.length >= 3 && (
        <Polygon
          positions={points}
          pathOptions={{
            color: strokeColor,
            fillColor,
            fillOpacity: isSatellite ? 0.16 : 0.08,
            opacity: 0.98,
            weight: isSatellite ? 3 : 2,
            dashArray: isSatellite ? '10 8' : '6 6',
          }}
        />
      )}
      {points.map((point, index) => (
        [
          ...(isSatellite
            ? [
                <CircleMarker
                  key={`${point[0]}-${point[1]}-${index}-halo`}
                  center={point}
                  radius={8}
                  pathOptions={{
                    color: '#1A2520',
                    fillColor: haloColor,
                    fillOpacity: 0.96,
                    weight: 2,
                  }}
                />,
              ]
            : []),
          <CircleMarker
            key={`${point[0]}-${point[1]}-${index}`}
            center={point}
            radius={isSatellite ? 6 : 5}
            pathOptions={{
              color: '#F4E8C8',
              fillColor,
              fillOpacity: 1,
              weight: 2,
            }}
          />,
        ]
      ))}
    </>
  );
}

function MapReady({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap();
  const didSet = useRef(false);
  useEffect(() => {
    if (didSet.current) return;
    didSet.current = true;
    onReady(map);
  }, [map, onReady]);
  return null;
}
