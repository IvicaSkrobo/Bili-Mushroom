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

applyLeafletIconFix();

const CROATIA_CENTER: [number, number] = [45.1, 15.2];
const CROATIA_ZOOM = 7;
const EXISTING_PIN_ZOOM = 13;
const OSM_TEMPLATE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export interface LocationPickerMapProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLatLng?: { lat: number; lng: number } | null;
  onConfirm: (lat: number, lng: number) => void;
}

function RustProxyOsmLayer({ storagePath }: { storagePath: string }) {
  const map = useMap();
  useEffect(() => {
    const layer = createRustProxyTileLayer({
      urlTemplate: OSM_TEMPLATE,
      storagePath,
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    });
    layer.addTo(map);
    return () => {
      layer.remove();
    };
  }, [map, storagePath]);
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
  const storagePath = useAppStore((s) => s.storagePath);
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
          {open && storagePath && (
            <MapContainer
              center={initialCenter}
              zoom={initialZoom}
              style={{ height: '100%', width: '100%' }}
            >
              <RustProxyOsmLayer storagePath={storagePath} />
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
