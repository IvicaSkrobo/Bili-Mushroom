import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAppStore, saveMapViewport, loadMapViewport } from '@/stores/appStore';
import { applyLeafletIconFix } from './leafletIconFix';
import { createRustProxyTileLayer } from './RustProxyTileLayer';
import type { MapLayer } from '@/stores/appStore';
import { useFinds } from '@/hooks/useFinds';
import { PickerPins } from './PickerPins';

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

function MapZoomTracker({ zoomRef }: { zoomRef: React.MutableRefObject<number> }) {
  useMapEvents({
    zoomend(e) {
      zoomRef.current = e.target.getZoom();
    },
  });
  return null;
}

function PickerViewportSaver() {
  useMapEvents({
    moveend(e) {
      const center = (e.target as L.Map).getCenter();
      saveMapViewport(center.lat, center.lng, (e.target as L.Map).getZoom());
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
  const [pinLabel, setPinLabel] = useState<string | null>(null);

  const savedViewport = !initialLatLng ? loadMapViewport() : null;
  const initialCenter: [number, number] = initialLatLng
    ? [initialLatLng.lat, initialLatLng.lng]
    : savedViewport
      ? [savedViewport.lat, savedViewport.lng]
      : CROATIA_CENTER;
  const initialZoom = initialLatLng
    ? EXISTING_PIN_ZOOM
    : savedViewport
      ? savedViewport.zoom
      : CROATIA_ZOOM;

  const currentZoomRef = useRef<number>(initialZoom);

  // Reset pin when the dialog opens
  useEffect(() => {
    if (open) {
      setPin(initialLatLng ?? null);
      setPinLabel(null);
      const sv = !initialLatLng ? loadMapViewport() : null;
      currentZoomRef.current = initialLatLng ? EXISTING_PIN_ZOOM : (sv?.zoom ?? CROATIA_ZOOM);
    }
  }, [open, initialLatLng]);

  const { data: finds } = useFinds();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col p-0 gap-0 w-[720px] max-w-[95vw] h-[620px] max-h-[90vh]">
        <DialogHeader className="shrink-0 gap-1 border-b border-border/40 px-5 py-3 text-left">
          <DialogTitle className="text-base font-semibold">Odaberi lokaciju</DialogTitle>
          <DialogDescription>
            Klikni na kartu za postavljanje lokacije. Postojeći nalazi su prikazani na karti.
          </DialogDescription>
        </DialogHeader>

        {/* Map */}
        <div className="flex-1" style={{ minHeight: 0 }}>
          {open && (
            <MapContainer
              center={initialCenter}
              zoom={initialZoom}
              style={{ height: '100%', width: '100%' }}
              boxZoom={false}
            >
              <PickerLayerSwitcher />
              <MapZoomTracker zoomRef={currentZoomRef} />
              <PickerViewportSaver />
              <ClickHandler
                onPick={(latlng) => {
                  setPin({ lat: latlng.lat, lng: latlng.lng });
                  setPinLabel(null);
                }}
              />

              {/* Existing find pins — click to adopt that location, no popup */}
              <PickerPins
                finds={finds ?? []}
                onPickLocation={(lat, lng, label) => {
                  setPin({ lat, lng });
                  setPinLabel(label);
                }}
              />

              {/* Selected pin — draggable */}
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

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between gap-4 px-5 py-3 border-t border-border/40">
          <div className="min-w-0 flex items-center gap-2">
            {pin ? (
              pinLabel ? (
                <>
                  <span className="text-xs font-semibold truncate max-w-[300px]" style={{ color: '#D4941A' }}>
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
              <span className="text-xs text-muted-foreground">Klikni na mapu za postavljanje lokacije</span>
            )}
          </div>
          <Button
            disabled={!pin}
            size="sm"
            onClick={() => {
              if (pin) {
                saveMapViewport(pin.lat, pin.lng, currentZoomRef.current);
                onConfirm(pin.lat, pin.lng, pinLabel ?? undefined);
              }
            }}
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
