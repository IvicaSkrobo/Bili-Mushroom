import { MapContainer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import type { Find } from '@/lib/finds';
import type { Zone, ZoneType, ZoneViewMode } from '@/lib/zones';
import { applyLeafletIconFix } from './leafletIconFix';
import { CollectionPins } from './CollectionPins';
import { FitBoundsControl } from './FitBoundsControl';
import { LayerSwitcher } from './LayerSwitcher';
import { OnlineStatusBadge } from './OnlineStatusBadge';
import { ZoneLayers } from './ZoneLayers';
import { ZoneEditorPanel } from './ZoneEditorPanel';

applyLeafletIconFix();

const CROATIA_CENTER: [number, number] = [45.1, 15.2];
const CROATIA_ZOOM = 7;

interface FindsMapProps {
  finds: Find[];
  zones?: Zone[];
  zoneMode?: ZoneViewMode;
  onCreateZoneForFind?: (find: Find, zoneType: ZoneType) => void;
  onSelectSpecies?: (speciesName: string) => void;
  activeZoneId?: number | null;
  onZoneSaved?: (zone: Zone) => void;
  onZoneTypeSelected?: (zone: Zone, zoneType: ZoneType) => void;
  onEditZone?: (zone: Zone | null) => void;
}

export function FindsMap({
  finds,
  zones = [],
  zoneMode = 'pins',
  onCreateZoneForFind = () => undefined,
  onSelectSpecies = () => undefined,
  activeZoneId = null,
  onZoneSaved,
  onZoneTypeSelected,
  onEditZone = () => undefined,
}: FindsMapProps) {
  const [map, setMap] = useState<L.Map | null>(null);
  const activeZone = activeZoneId == null
    ? null
    : zones.find((zone) => zone.id === activeZoneId) ?? null;

  function handleZoomToZone(zone: Zone, selectedType: ZoneType) {
    if (!map || zone.center_lat == null || zone.center_lng == null || zone.radius_meters == null) return;
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
        <LayerSwitcher />
        <ZoneLayers
          zones={zones}
          finds={finds}
          mode={zoneMode}
          activeZoneId={activeZoneId}
          onEditZone={(zone) => onEditZone(zone)}
        />
        <CollectionPins
          finds={finds}
          zones={zones}
          zoneMode={zoneMode}
          onCreateZoneForFind={onCreateZoneForFind}
          onSelectSpecies={onSelectSpecies}
        />
        <FitBoundsControl finds={finds} />
        <OnlineStatusBadge />
      </MapContainer>
      {activeZone && (
        <ZoneEditorPanel
          key={activeZone.id}
          zone={activeZone}
          finds={finds}
          onClose={() => onEditZone(null)}
          onZoneSaved={(zone) => onZoneSaved?.(zone)}
          onZoneTypeSelected={(zone, zoneType) => onZoneTypeSelected?.(zone, zoneType)}
          onZoomToZone={handleZoomToZone}
        />
      )}
    </div>
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
