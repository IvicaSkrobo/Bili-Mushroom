import { useEffect, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, useMap, useMapEvents } from 'react-leaflet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/appStore';
import { applyLeafletIconFix } from './leafletIconFix';
import { createRustProxyTileLayer } from './RustProxyTileLayer';
import type { MapLayer } from '@/stores/appStore';

applyLeafletIconFix();

const CROATIA_CENTER: [number, number] = [45.1, 15.2];
const CROATIA_ZOOM = 7;
const EXISTING_PIN_ZOOM = 13;
const ESRI_TEMPLATE =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const OSM_TEMPLATE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TOPO_TEMPLATE = 'https://tile.opentopomap.org/{z}/{x}/{y}.png';

export interface LocationPickerMapProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLatLng?: { lat: number; lng: number } | null;
  onConfirm: (lat: number, lng: number) => void;
}

function PickerLayerSwitcher() {
  const map = useMap();
  const mapLayer = useAppStore((s) => s.mapLayer);
  const setMapLayer = useAppStore((s) => s.setMapLayer);

  useEffect(() => {
    const esriLayer = createRustProxyTileLayer({
      urlTemplate: ESRI_TEMPLATE,
      attribution: 'Tiles © Esri',
      maxZoom: 19,
    });
    const osmLayer = createRustProxyTileLayer({
      urlTemplate: OSM_TEMPLATE,
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    });
    const topoLayer = createRustProxyTileLayer({
      urlTemplate: TOPO_TEMPLATE,
      attribution: '© OpenTopoMap contributors',
      maxZoom: 17,
    });

    const layers: Record<MapLayer, L.TileLayer> = {
      Satellite: esriLayer,
      Street: osmLayer,
      Topo: topoLayer,
    };

    layers[mapLayer].addTo(map);

    const control = L.control
      .layers({ Satellite: esriLayer, Street: osmLayer, Topo: topoLayer }, undefined, { position: 'topright' })
      .addTo(map);

    const handleLayerChange = (e: L.LayersControlEvent) => {
      const name = e.name as MapLayer;
      if (name === 'Satellite' || name === 'Street' || name === 'Topo') {
        setMapLayer(name);
      }
    };

    map.on('baselayerchange', handleLayerChange);

    return () => {
      map.off('baselayerchange', handleLayerChange);
      control.remove();
      if (map.hasLayer(esriLayer)) map.removeLayer(esriLayer);
      if (map.hasLayer(osmLayer)) map.removeLayer(osmLayer);
      if (map.hasLayer(topoLayer)) map.removeLayer(topoLayer);
    };
  }, [map, mapLayer, setMapLayer]);
  return null;
}

function ClickHandler({ onPick }: { onPick: (latlng: L.LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng);
    },
  });
  return null;
}

export function LocationPickerMap({
  open,
  onOpenChange,
  initialLatLng,
  onConfirm,
}: LocationPickerMapProps) {
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    initialLatLng ?? null,
  );

  // Reset pin when the dialog opens (so reopening doesn't keep stale state)
  useEffect(() => {
    if (open) setPin(initialLatLng ?? null);
  }, [open, initialLatLng]);

  const initialCenter: [number, number] = initialLatLng
    ? [initialLatLng.lat, initialLatLng.lng]
    : CROATIA_CENTER;
  const initialZoom = initialLatLng ? EXISTING_PIN_ZOOM : CROATIA_ZOOM;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-screen max-h-screen w-screen max-w-none flex-col p-0">
        <DialogHeader className="px-6 py-4">
          <DialogTitle className="text-xl font-semibold">Pick a location</DialogTitle>
        </DialogHeader>
        <div className="flex-1" style={{ minHeight: 0 }}>
          {open && (
            <MapContainer
              center={initialCenter}
              zoom={initialZoom}
              style={{ height: '100%', width: '100%' }}
            >
              <PickerLayerSwitcher />
              <ClickHandler
                onPick={(latlng) => setPin({ lat: latlng.lat, lng: latlng.lng })}
              />
              {pin && (
                <Marker
                  position={[pin.lat, pin.lng]}
                  draggable
                  eventHandlers={{
                    dragend: (e) => {
                      const ll = (e.target as L.Marker).getLatLng();
                      setPin({ lat: ll.lat, lng: ll.lng });
                    },
                  }}
                />
              )}
            </MapContainer>
          )}
        </div>
        <DialogFooter className="flex flex-col gap-2 px-6 py-4">
          <div className="font-mono text-xs text-muted-foreground">
            Selected:{' '}
            {pin
              ? `${pin.lat.toFixed(6)}, ${pin.lng.toFixed(6)}`
              : '—'}
          </div>
          <Button
            disabled={!pin}
            onClick={() => pin && onConfirm(pin.lat, pin.lng)}
            className="w-full"
          >
            Confirm location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LocationPickerMap;
