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
import { Input } from '@/components/ui/input';
import { useAppStore, saveMapViewport, loadMapViewport } from '@/stores/appStore';
import { applyLeafletIconFix } from './leafletIconFix';
import { createRustProxyTileLayer } from './RustProxyTileLayer';
import type { MapLayer } from '@/stores/appStore';
import { useFinds } from '@/hooks/useFinds';
import { useZones } from '@/hooks/useZones';
import { findContainingRegionZone } from '@/lib/zones';
import { PickerPins } from './PickerPins';
import { SpeciesFilterPanel } from './SpeciesFilterPanel';
import { isInternalLibraryName } from '@/lib/internalEntries';
import { compareSpeciesNames } from '@/lib/speciesName';
import { LocateFixed } from 'lucide-react';

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
      const target = e.originalEvent.target as HTMLElement | null;
      if (target?.closest('[data-picker-map-control="true"]')) return;
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

function PickerFitButton({ finds }: { finds: Array<{ lat: number | null; lng: number | null }> }) {
  const map = useMap();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const stopMapEvent = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if ('nativeEvent' in event) {
      L.DomEvent.stopPropagation(event.nativeEvent);
      L.DomEvent.preventDefault(event.nativeEvent);
    }
  };

  useEffect(() => {
    if (!buttonRef.current) return;
    L.DomEvent.disableClickPropagation(buttonRef.current);
    L.DomEvent.disableScrollPropagation(buttonRef.current);
  }, []);

  return (
    <button
      ref={buttonRef}
      type="button"
      data-picker-map-control="true"
      onPointerDown={stopMapEvent}
      onPointerUp={stopMapEvent}
      onMouseDown={stopMapEvent}
      onMouseUp={stopMapEvent}
      onDoubleClick={stopMapEvent}
      onClick={(event) => {
        stopMapEvent(event);
        const withCoords = finds.filter(
          (find): find is { lat: number; lng: number } => find.lat != null && find.lng != null,
        );
        if (withCoords.length > 0) {
          map.fitBounds(
            withCoords.map((find) => [find.lat, find.lng] as [number, number]),
            { padding: [40, 40], maxZoom: 16 },
          );
        } else {
          map.flyTo(CROATIA_CENTER, CROATIA_ZOOM, { animate: true, duration: 0.7 });
        }
      }}
      title="Zoom to pins"
      className="absolute bottom-8 right-3 z-[1000] flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-card/90 text-foreground/60 shadow-sm transition-colors hover:border-primary/40 hover:bg-card hover:text-primary"
    >
      <LocateFixed className="h-4 w-4" />
    </button>
  );
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
  const [pinLocationNote, setPinLocationNote] = useState<string | null>(null);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [selectedSpecies, setSelectedSpecies] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);

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
      setManualLat(initialLatLng ? String(initialLatLng.lat) : '');
      setManualLng(initialLatLng ? String(initialLatLng.lng) : '');
      setManualError(null);
      setPinLabel(null);
      setPinLocationNote(null);
      setFilterOpen(false);
      const sv = !initialLatLng ? loadMapViewport() : null;
      currentZoomRef.current = initialLatLng ? EXISTING_PIN_ZOOM : (sv?.zoom ?? CROATIA_ZOOM);
    }
  }, [open, initialLatLng]);

  const { data: finds } = useFinds();
  const { data: zones } = useZones();
  const visibleFinds = (finds ?? []).filter((find) => !isInternalLibraryName(find.species_name));
  const allSpecies = Array.from(new Set(visibleFinds.map((find) => find.species_name).filter(Boolean)))
    .sort(compareSpeciesNames);
  const filteredFinds = selectedSpecies.size === 0
    ? visibleFinds
    : visibleFinds.filter((find) => selectedSpecies.has(find.species_name));

  function handleToggleSpecies(name: string) {
    setSelectedSpecies((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function setPickedCoordinate(lat: number, lng: number, existingLocationNote?: string | null, fallbackLabel?: string | null) {
    const containingRegion = findContainingRegionZone(zones ?? [], lat, lng);
    setPin({ lat, lng });
    setManualLat(formatManualCoordinate(lat));
    setManualLng(formatManualCoordinate(lng));
    setManualError(null);
    setPinLabel(containingRegion?.name ?? fallbackLabel ?? null);
    setPinLocationNote(existingLocationNote?.trim() || containingRegion?.name || null);
  }

  function applyManualCoordinates() {
    const parsed = parseManualCoordinates(manualLat, manualLng);
    if (!parsed) {
      setManualError('Unesi GPS koordinate kao lat/lng, npr. 45.7542 i 16.0186.');
      return;
    }
    setPickedCoordinate(parsed.lat, parsed.lng);
  }

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
        <div className="relative flex-1" style={{ minHeight: 0 }}>
          {open && (
            <>
              <MapContainer
                center={initialCenter}
                zoom={initialZoom}
                style={{ height: '100%', width: '100%' }}
                boxZoom={false}
              >
                <PickerLayerSwitcher />
                <MapZoomTracker zoomRef={currentZoomRef} />
                <PickerViewportSaver />
                <PickerFitButton finds={filteredFinds} />
                <ClickHandler
                  onPick={(latlng) => {
                    setPickedCoordinate(latlng.lat, latlng.lng);
                  }}
                />

              {/* Existing find pins — click to adopt that location, no popup */}
                <PickerPins
                  finds={filteredFinds}
                  onPickLocation={(lat, lng, label, locationNote) => {
                    setPickedCoordinate(lat, lng, locationNote, label);
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
                        setPickedCoordinate(ll.lat, ll.lng);
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
              <SpeciesFilterPanel
                allSpecies={allSpecies}
                selected={selectedSpecies}
                open={filterOpen}
                onOpenChange={setFilterOpen}
                onToggle={handleToggleSpecies}
                onSelectAll={() => setSelectedSpecies(new Set())}
              />
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-border/40 bg-secondary/10 px-5 py-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Latitude
              </label>
              <Input
                value={manualLat}
                onChange={(event) => {
                  setManualLat(event.target.value);
                  setManualError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') applyManualCoordinates();
                }}
                inputMode="decimal"
                placeholder="45.7542"
                className="h-8 font-mono text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Longitude
              </label>
              <Input
                value={manualLng}
                onChange={(event) => {
                  setManualLng(event.target.value);
                  setManualError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') applyManualCoordinates();
                }}
                inputMode="decimal"
                placeholder="16.0186"
                className="h-8 font-mono text-xs"
              />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={applyManualCoordinates}>
              Primijeni GPS
            </Button>
          </div>
          {manualError && <p className="mt-1 text-xs text-destructive">{manualError}</p>}
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
                onConfirm(pin.lat, pin.lng, pinLocationNote ?? undefined);
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

function formatManualCoordinate(value: number): string {
  return Number.isFinite(value) ? Number(value.toFixed(6)).toString() : '';
}

function parseManualCoordinates(latInput: string, lngInput: string): { lat: number; lng: number } | null {
  const explicitLat = parseManualNumber(latInput);
  const explicitLng = parseManualNumber(lngInput);
  if (explicitLat != null && explicitLng != null && isValidLatLng(explicitLat, explicitLng)) {
    return { lat: explicitLat, lng: explicitLng };
  }

  if (!lngInput.trim()) {
    const pair = extractCoordinatePair(latInput);
    if (pair && isValidLatLng(pair.lat, pair.lng)) return pair;
  }

  return null;
}

function parseManualNumber(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractCoordinatePair(value: string): { lat: number; lng: number } | null {
  const matches = value.match(/[-+]?\d+(?:[.,]\d+)?/g);
  if (!matches || matches.length < 2) return null;
  const lat = parseManualNumber(matches[0]);
  const lng = parseManualNumber(matches[1]);
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

function isValidLatLng(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}
