import { useState } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// Fix Leaflet default icon broken by Vite's asset pipeline
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface LocationPickerMapProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLatLng?: { lat: number; lng: number } | null;
  onConfirm: (lat: number, lng: number) => void;
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
  const [pin, setPin] = useState<L.LatLng | null>(
    initialLatLng ? L.latLng(initialLatLng.lat, initialLatLng.lng) : null,
  );

  const center: [number, number] = initialLatLng
    ? [initialLatLng.lat, initialLatLng.lng]
    : [45.1, 15.2]; // Croatia region default

  const handleConfirm = () => {
    if (pin) {
      onConfirm(pin.lat, pin.lng);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pick location</DialogTitle>
        </DialogHeader>
        <div style={{ height: 400 }}>
          {open && (
            <MapContainer
              key={String(open)}
              center={center}
              zoom={initialLatLng ? 13 : 7}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <ClickHandler onPick={setPin} />
              {pin && <Marker position={pin} />}
            </MapContainer>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!pin} onClick={handleConfirm}>
            Confirm location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
