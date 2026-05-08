import { CircleMarker, MapContainer, Marker, Polygon, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Move, Plus, Trash2, X } from 'lucide-react';
import type { Find } from '@/lib/finds';
import { parsePolygonJson, type PolygonEditorMode, type Zone, type ZonePolygonPoint, type ZoneType, type ZoneViewMode } from '@/lib/zones';
import { applyLeafletIconFix } from './leafletIconFix';
import { CollectionPins } from './CollectionPins';
import { FitBoundsControl } from './FitBoundsControl';
import { LayerSwitcher } from './LayerSwitcher';
import { OnlineStatusBadge } from './OnlineStatusBadge';
import { ZoneLayers } from './ZoneLayers';
import { ZoneEditorPanel } from './ZoneEditorPanel';
import { useAppStore, loadMapViewport, saveMapViewport } from '@/stores/appStore';

applyLeafletIconFix();

const CROATIA_CENTER: [number, number] = [45.1, 15.2];
const CROATIA_ZOOM = 7;

interface FindsMapProps {
  finds: Find[];
  zones?: Zone[];
  zoneMode?: ZoneViewMode;
  onCreateZoneForFind?: (find: Find, zoneType: ZoneType) => void | Promise<void>;
  onPickLocalTargetFind?: (find: Find) => void;
  onPickRegionTargetFind?: (find: Find) => void;
  onStartLocalPolygonForFind?: (find: Find) => void;
  onStartRegionPolygonForFind?: (find: Find) => void;
  // Unified polygon editor
  polygonEditorActive?: boolean;
  polygonEditorMode?: PolygonEditorMode;
  polygonEditorPoints?: ZonePolygonPoint[];
  polygonEditorZoneName?: string | null;
  polygonEditorZoneType?: ZoneType | null;
  polygonEditorSelectedPoint?: number | null;
  onPolygonEditorAddPoint?: (point: ZonePolygonPoint) => void;
  onPolygonEditorMovePoint?: (index: number, point: ZonePolygonPoint) => void;
  onPolygonEditorSelectPoint?: (index: number) => void;
  onPolygonEditorInsertPoint?: (edgeStartIndex: number, point: ZonePolygonPoint) => void;
  onPolygonEditorSetMode?: (mode: PolygonEditorMode) => void;
  onPolygonEditorUndo?: () => void;
  onPolygonEditorDelete?: () => void;
  onPolygonEditorCancel?: () => void;
  onPolygonEditorSave?: () => Promise<void>;
  onStartPolygonEdit?: () => void;
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
  polygonEditorActive = false,
  polygonEditorMode = 'add',
  polygonEditorPoints = [],
  polygonEditorZoneName = null,
  polygonEditorZoneType = null,
  polygonEditorSelectedPoint = null,
  onPolygonEditorAddPoint = () => undefined,
  onPolygonEditorMovePoint = () => undefined,
  onPolygonEditorSelectPoint = () => undefined,
  onPolygonEditorInsertPoint = () => undefined,
  onPolygonEditorSetMode = () => undefined,
  onPolygonEditorUndo = () => undefined,
  onPolygonEditorDelete = () => undefined,
  onPolygonEditorCancel = () => undefined,
  onPolygonEditorSave = async () => undefined,
  onStartPolygonEdit = () => undefined,
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
  const initialViewport = useRef(loadMapViewport());
  const activeZone = activeZoneId == null
    ? null
    : zones.find((zone) => zone.id === activeZoneId) ?? null;

  // When editing, show only relevant pins; outside editing show all finds.
  const focusFinds = useMemo(() => {
    if (!polygonEditorActive) return finds;
    if (polygonEditorZoneType === 'local' && drawTargetFind != null) {
      return finds.filter((f) => f.id === drawTargetFind.id);
    }
    if (polygonEditorZoneType === 'region' && drawTargetFind != null) {
      return finds.filter((f) => f.species_name === drawTargetFind.species_name);
    }
    return [];
  }, [polygonEditorActive, polygonEditorZoneType, drawTargetFind, finds]);

  // Fly to active polygon bounds when opening the unified editor for an existing polygon.
  useEffect(() => {
    if (!polygonEditorActive || !map || activeZoneId == null) return;
    const zone = zones.find((z) => z.id === activeZoneId);
    if (!zone || zone.geometry_type !== 'polygon') return;
    const polygon = parsePolygonJson(zone.polygon_json);
    if (polygon.length < 3) return;
    map.flyToBounds(polygon as [number, number][], { animate: true, duration: 0.7, padding: [40, 40] });
  }, [polygonEditorActive, map, activeZoneId, zones]);

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
    if (!polygonEditorActive || !drawTargetFind || !drawTargetZoneType) return;
    focusDrawTarget(drawTargetFind, drawTargetZoneType);
  }, [polygonEditorActive, drawTargetFind, drawTargetZoneType, map]);

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
        center={initialViewport.current ? [initialViewport.current.lat, initialViewport.current.lng] : CROATIA_CENTER}
        zoom={initialViewport.current ? initialViewport.current.zoom : CROATIA_ZOOM}
        style={{ height: '100%', width: '100%' }}
        className="rounded-md"
      >
        <MapReady onReady={setMap} />
        <MapViewportSaver />
        <PolygonEditorController
          active={polygonEditorActive}
          mode={polygonEditorMode}
          points={polygonEditorPoints}
          onAddPoint={onPolygonEditorAddPoint}
          onInsertPoint={onPolygonEditorInsertPoint}
        />
        <LayerSwitcher />
        <ZoneLayers
          zones={zones}
          finds={finds}
          mode={zoneMode}
          activeZoneId={activeZoneId}
          hiddenZoneIds={polygonEditorActive ? zones.map((z) => z.id) : []}
          onEditZone={(zone) => onEditZone(zone)}
        />
        <PolygonDraftLayer
          drawing={polygonEditorActive && polygonEditorMode === 'add'}
          points={polygonEditorPoints}
          zoneType={polygonEditorZoneType}
        />
        <PolygonEditHandles
          active={polygonEditorActive && polygonEditorMode === 'move'}
          points={polygonEditorPoints}
          onPointMove={onPolygonEditorMovePoint}
          onPointSelect={onPolygonEditorSelectPoint}
          onPointInsert={onPolygonEditorInsertPoint}
          selectedIndex={polygonEditorSelectedPoint}
          zoneType={polygonEditorZoneType}
        />
        <CollectionPins
          finds={focusFinds}
          zones={zones}
          onStartLocalPolygonForFind={handleStartLocalPolygonFromPin}
          onStartRegionPolygonForFind={handleStartRegionPolygonFromPin}
          onSelectSpecies={onSelectSpecies}
        />
        <FitBoundsControl finds={finds} />
        {!focusMode && <OnlineStatusBadge />}
      </MapContainer>
      {activeZone && !polygonEditorActive && (
        <ZoneEditorPanel
          key={activeZone.id}
          zone={activeZone}
          finds={finds}
          onStartPolygonEdit={onStartPolygonEdit}
          onClose={() => onEditZone(null)}
          onZoneSaved={(zone) => onZoneSaved?.(zone)}
          onZoneTypeSelected={(zone, zoneType) => onZoneTypeSelected?.(zone, zoneType)}
          onZoomToZone={handleZoomToZone}
        />
      )}
      {polygonEditorActive && (
        <PolygonEditorBanner
          zoneName={polygonEditorZoneName}
          zoneType={polygonEditorZoneType}
          mode={polygonEditorMode}
          pointCount={polygonEditorPoints.length}
          selectedPointIndex={polygonEditorSelectedPoint}
          onSetMode={onPolygonEditorSetMode}
          onUndo={onPolygonEditorUndo}
          onDelete={onPolygonEditorDelete}
          onCancel={onPolygonEditorCancel}
          onSave={onPolygonEditorSave}
        />
      )}
    </div>
  );
}

function PolygonEditorBanner({
  zoneName,
  zoneType,
  mode,
  pointCount,
  selectedPointIndex,
  onSetMode,
  onUndo,
  onDelete,
  onCancel,
  onSave,
}: {
  zoneName: string | null;
  zoneType: ZoneType | null;
  mode: PolygonEditorMode;
  pointCount: number;
  selectedPointIndex: number | null;
  onSetMode: (mode: PolygonEditorMode) => void;
  onUndo: () => void;
  onDelete: () => void;
  onCancel: () => void;
  onSave: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const canSave = pointCount >= 3;
  const canDelete = selectedPointIndex != null && pointCount > 3;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  }

  const statusText =
    mode === 'add'
      ? pointCount < 2
        ? `Click map to place the first points. ${pointCount} placed.`
        : `Click map to add a point on the nearest edge. ${pointCount} points.`
      : selectedPointIndex != null
        ? `Point ${selectedPointIndex + 1} selected. Drag to move it. Backspace deletes it.`
        : `Drag points to move. Click a point to select it. ${pointCount} points.`;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-[1003] flex justify-center px-4">
      <div className="pointer-events-auto flex w-[min(620px,100%)] items-center justify-between gap-3 rounded-xl border border-secondary/35 bg-card/96 px-3 py-2.5 shadow-2xl backdrop-blur">
        <div className="min-w-0">
          <p className="truncate font-serif text-sm font-semibold italic text-foreground">
            {mode === 'add' ? 'Drawing' : 'Adjusting'} {zoneType ?? 'zone'} boundary
            {zoneName ? `: ${zoneName}` : ''}
          </p>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Move className="h-3.5 w-3.5 shrink-0 text-secondary" />
            {statusText}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="flex overflow-hidden rounded-md border border-border/60">
            <button
              type="button"
              onClick={() => onSetMode('move')}
              className={`inline-flex h-7 items-center gap-1 px-2 text-[11px] font-semibold transition-colors ${
                mode === 'move'
                  ? 'bg-secondary/40 text-foreground'
                  : 'text-muted-foreground hover:bg-secondary/20 hover:text-foreground'
              }`}
            >
              <Move className="h-3 w-3" />
              Move (M)
            </button>
            <button
              type="button"
              onClick={() => onSetMode('add')}
              className={`inline-flex h-7 items-center gap-1 border-l border-border/60 px-2 text-[11px] font-semibold transition-colors ${
                mode === 'add'
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:bg-secondary/20 hover:text-foreground'
              }`}
            >
              <Plus className="h-3 w-3" />
              Add point (N)
            </button>
          </div>
          {mode === 'add' && (
            <button
              type="button"
              onClick={onUndo}
              disabled={pointCount === 0}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border/60 px-2 text-[11px] font-semibold text-muted-foreground hover:bg-secondary/20 hover:text-foreground disabled:opacity-45"
            >
              Undo
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            disabled={!canDelete}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-destructive/40 px-2 text-[11px] font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-40"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-border/60 px-2 text-[11px] font-semibold text-muted-foreground hover:bg-secondary/20 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5" />
            {saving ? 'Saving' : 'Save'}
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

function PolygonEditorController({
  active,
  mode,
  points,
  onAddPoint,
  onInsertPoint,
}: {
  active: boolean;
  mode: PolygonEditorMode;
  points: ZonePolygonPoint[];
  onAddPoint: (point: ZonePolygonPoint) => void;
  onInsertPoint: (edgeStartIndex: number, point: ZonePolygonPoint) => void;
}) {
  useMapEvents({
    click(event) {
      if (!active || mode !== 'add') return;
      const clickPoint: ZonePolygonPoint = [event.latlng.lat, event.latlng.lng];
      if (points.length < 2) {
        onAddPoint(clickPoint);
        return;
      }
      const { edgeStartIndex, projectedPoint } = findNearestEdge(clickPoint, points);
      onInsertPoint(edgeStartIndex, projectedPoint);
    },
  });
  return null;
}

function findNearestEdge(
  clickPoint: ZonePolygonPoint,
  points: ZonePolygonPoint[],
): { edgeStartIndex: number; projectedPoint: ZonePolygonPoint } {
  let bestEdge = 0;
  let bestPoint = points[0];
  let bestDist = Infinity;

  for (let i = 0; i < points.length; i++) {
    const start = points[i];
    const end = points[(i + 1) % points.length];
    const projectedPoint = projectPointOntoSegment(clickPoint, start, end);
    const dist = Math.hypot(projectedPoint[0] - clickPoint[0], projectedPoint[1] - clickPoint[1]);

    if (dist < bestDist) {
      bestDist = dist;
      bestEdge = i;
      bestPoint = projectedPoint;
    }
  }

  return { edgeStartIndex: bestEdge, projectedPoint: bestPoint };
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

function MapViewportSaver() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useMapEvents({
    moveend(e) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const center = (e.target as L.Map).getCenter();
        saveMapViewport(center.lat, center.lng, (e.target as L.Map).getZoom());
      }, 500);
    },
  });
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  return null;
}
