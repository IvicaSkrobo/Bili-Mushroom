import { useState, useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { tileLayerOffline } from 'leaflet.offline';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { LocateFixed } from 'lucide-react';
import { toast } from 'sonner';
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

/** Adds an offline-capable OSM tile layer using leaflet.offline.
 *  Tiles are cached in IndexedDB on first load and served from cache when offline.
 *  Uncached areas show grey boxes but the map stays fully interactive. */
function OfflineTileLayer() {
  const map = useMap();

  useEffect(() => {
    const layer = tileLayerOffline(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
        // Attempt network first; fall back to IndexedDB automatically
      },
    );
    layer.addTo(map);
    return () => {
      layer.remove();
    };
  }, [map]);

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

function LocateMeButton({ onLocate }: { onLocate: (latlng: L.LatLng) => void }) {
  const map = useMap();
  const [locating, setLocating] = useState(false);

  const handleLocate = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
        map.flyTo(latlng, 13);
        onLocate(latlng);
        setLocating(false);
      },
      (err) => {
        toast.error(`Location unavailable: ${err.message}`);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="absolute top-2 right-2 z-[1000]">
      <Button
        type="button"
        variant="secondary"
        size="icon"
        onClick={handleLocate}
        disabled={locating}
        aria-label="Use my location"
        title="Use my location"
        className="h-8 w-8 shadow-md"
      >
        <LocateFixed className={`h-4 w-4 ${locating ? 'animate-pulse' : ''}`} />
      </Button>
    </div>
  );
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

  // Default center: Croatia (45.1, 15.2) — zoom 7 shows the whole country
  const center: [number, number] = initialLatLng
    ? [initialLatLng.lat, initialLatLng.lng]
    : [45.1, 15.2];

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
        <div style={{ height: 400, position: 'relative' }}>
          {open && (
            <MapContainer
              key={String(open)}
              center={center}
              zoom={initialLatLng ? 13 : 7}
              style={{ height: '100%', width: '100%' }}
            >
              <OfflineTileLayer />
              <ClickHandler onPick={setPin} />
              <LocateMeButton onLocate={setPin} />
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
