import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
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
import { useFinds } from '@/hooks/useFinds';

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
  onConfirm: (lat: number, lng: number, locationNote?: string) => void;
  /** When provided, only show previous pins matching this species name */
  speciesFilter?: string;
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

// Small amber circle icon for previously found locations
const prevLocationIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:14px;height:14px;
    background:oklch(0.72 0.12 80);
    border:2px solid oklch(0.5 0.08 80);
    border-radius:50%;
    box-shadow:0 0 4px rgba(0,0,0,0.5);
    cursor:pointer;
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export function LocationPickerMap({
  open,
  onOpenChange,
  initialLatLng,
  onConfirm,
  speciesFilter,
}: LocationPickerMapProps) {
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    initialLatLng ?? null,
  );
  const [pinLabel, setPinLabel] = useState<string | null>(null);

  // Reset pin when the dialog opens (so reopening doesn't keep stale state)
  useEffect(() => {
    if (open) {
      setPin(initialLatLng ?? null);
      setPinLabel(null);
    }
  }, [open, initialLatLng]);

  const initialCenter: [number, number] = initialLatLng
    ? [initialLatLng.lat, initialLatLng.lng]
    : CROATIA_CENTER;
  const initialZoom = initialLatLng ? EXISTING_PIN_ZOOM : CROATIA_ZOOM;

  const { data: finds } = useFinds();

  // No deduplication — every find gets its own pin.
  // Only hide the pin the user explicitly selected.
  // When speciesFilter provided, only show pins for that species.
  const prevLocations = useMemo(() => {
    if (!finds) return [];
    const needle = speciesFilter?.trim().toLowerCase();
    return finds
      .filter(
        (f) =>
          f.lat != null &&
          f.lng != null &&
          (!needle || f.species_name.toLowerCase() === needle),
      )
      .map((f) => ({ lat: f.lat as number, lng: f.lng as number, label: f.species_name }));
  }, [finds, speciesFilter]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col p-0 gap-0 w-[720px] max-w-[95vw] h-[620px] max-h-[90vh]">
        {/* Header: title only */}
        <div className="shrink-0 px-5 py-3 border-b border-border/40">
          <DialogTitle className="text-base font-semibold">Odaberi lokaciju</DialogTitle>
        </div>

        {/* Map */}
        <div className="flex-1" style={{ minHeight: 0 }}>
          {open && (
            <MapContainer
              center={initialCenter}
              zoom={initialZoom}
              style={{ height: '100%', width: '100%' }}
            >
              <PickerLayerSwitcher />
              <ClickHandler
                onPick={(latlng) => { setPin({ lat: latlng.lat, lng: latlng.lng }); setPinLabel(null); }}
              />
              {prevLocations
                .filter(
                  (loc) =>
                    !pin ||
                    loc.lat !== pin.lat ||
                    loc.lng !== pin.lng,
                )
                .map((loc) => (
                  <Marker
                    key={`prev-${loc.lat}-${loc.lng}`}
                    position={[loc.lat, loc.lng]}
                    icon={prevLocationIcon}
                    eventHandlers={{
                      click: (e) => {
                        L.DomEvent.stopPropagation(e.originalEvent);
                        setPin({ lat: loc.lat, lng: loc.lng });
                        setPinLabel(loc.label);
                      },
                    }}
                    title={loc.label}
                  />
                ))}
              {pin && (
                <Marker
                  position={[pin.lat, pin.lng]}
                  draggable
                  eventHandlers={{
                    dragend: (e) => {
                      const ll = (e.target as L.Marker).getLatLng();
                      setPin({ lat: ll.lat, lng: ll.lng });
                      setPinLabel(null);
                    },
                  }}
                >
                  {pinLabel && (
                    <Popup autoPan={false} closeButton={false}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{pinLabel}</span>
                    </Popup>
                  )}
                </Marker>
              )}
            </MapContainer>
          )}
        </div>

        {/* Footer: status + confirm */}
        <div className="shrink-0 flex items-center justify-between gap-4 px-5 py-3 border-t border-border/40">
          <div className="min-w-0 flex items-center gap-2">
            {pin ? (
              pinLabel ? (
                <>
                  <span className="text-xs font-semibold truncate max-w-[300px]" style={{ color: 'oklch(0.72 0.12 80)' }}>
                    ✓ {pinLabel}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono shrink-0">
                    {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground font-mono">
                  {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
                </span>
              )
            ) : (
              <span className="text-xs text-muted-foreground">Klikni na mapu ili odaberi postojeći pin</span>
            )}
          </div>
          <Button
            disabled={!pin}
            size="sm"
            onClick={() => pin && onConfirm(pin.lat, pin.lng, pinLabel ?? undefined)}
            className="shrink-0"
          >
            Potvrdi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default LocationPickerMap;
