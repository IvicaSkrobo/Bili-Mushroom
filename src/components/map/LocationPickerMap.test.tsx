import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { LocationPickerMap } from './LocationPickerMap';

const leafletMocks = vi.hoisted(() => ({
  addTo: vi.fn(function () {
    return { remove: vi.fn() };
  }),
  layers: vi.fn(),
}));

leafletMocks.layers.mockImplementation(() => ({
  addTo: leafletMocks.addTo,
}));

const findsMock = vi.hoisted(() => ({
  data: [] as Array<{
    id: number;
    species_name: string;
    location_note?: string;
    lat: number | null;
    lng: number | null;
  }>,
}));

vi.mock('leaflet', () => ({
  default: {
    control: {
      layers: leafletMocks.layers,
    },
    DomEvent: {
      disableClickPropagation: vi.fn(),
      disableScrollPropagation: vi.fn(),
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    },
    divIcon: vi.fn(() => ({ options: {} })),
  },
}));

const zonesMock = vi.hoisted(() => ({
  data: [] as Array<{
    id: number;
    species_name: string;
    zone_type: 'local' | 'region';
    name: string;
    geometry_type: 'circle' | 'polygon';
    center_lat: number | null;
    center_lng: number | null;
    radius_meters: number | null;
    polygon_json: string;
    source_find_id: number | null;
    notes: string;
    created_at: string;
    updated_at: string;
  }>,
}));

// Mock react-leaflet to avoid DOM rendering issues in jsdom
vi.mock('react-leaflet', () => ({
  MapContainer: ({
    children,
    center,
    zoom,
  }: {
    children: React.ReactNode;
    center: [number, number];
    zoom: number;
  }) => (
    <div
      data-testid="map-container"
      data-center={JSON.stringify(center)}
      data-zoom={zoom}
    >
      {children}
    </div>
  ),
  Marker: ({
    position,
    children,
  }: {
    position: [number, number];
    children?: React.ReactNode;
    draggable?: boolean;
    eventHandlers?: Record<string, unknown>;
  }) => (
    <div
      data-testid="marker"
      data-lat={position[0]}
      data-lng={position[1]}
    >
      {children}
    </div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
  useMap: () => ({
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    hasLayer: vi.fn(() => false),
    on: vi.fn(),
    off: vi.fn(),
  }),
  useMapEvents: (_handlers: Record<string, unknown>) => null,
}));

// Mock RustProxyTileLayer
vi.mock('./RustProxyTileLayer', () => ({
  createRustProxyTileLayer: vi.fn(() => ({
    addTo: vi.fn(),
    remove: vi.fn(),
  })),
}));

// Mock leafletIconFix
vi.mock('./leafletIconFix', () => ({
  applyLeafletIconFix: vi.fn(),
}));

// LocationPickerMap uses useFinds to load finds passed to CollectionPins
vi.mock('@/hooks/useFinds', () => ({
  useFinds: () => ({ data: findsMock.data }),
  useSpeciesNotes: () => ({ data: [] }),
  useSpeciesProfiles: () => ({ data: [] }),
}));

// Mock PickerPins — renders one marker per find with coordinates
vi.mock('./PickerPins', () => ({
  PickerPins: ({
    finds,
    onPickLocation,
  }: {
    finds: Array<{ id: number; species_name: string; location_note?: string; lat?: number | null; lng?: number | null }>;
    onPickLocation: (lat: number, lng: number, label: string, locationNote?: string) => void;
  }) => (
    <>
      {finds
        .filter((f) => f.lat != null && f.lng != null)
        .map((f) => (
          <button
            key={f.id}
            type="button"
            data-testid="marker"
            data-lat={f.lat}
            data-lng={f.lng}
            onClick={() => onPickLocation(f.lat!, f.lng!, f.species_name, f.location_note)}
          >
            {f.species_name}
          </button>
        ))}
    </>
  ),
}));

vi.mock('@/hooks/useZones', () => ({
  useZones: () => ({ data: zonesMock.data }),
}));

// Mock appStore to return a storagePath
vi.mock('@/stores/appStore', () => ({
  useAppStore: (selector: (s: { storagePath: string; mapLayer: 'Satellite'; language: 'en'; setMapLayer: ReturnType<typeof vi.fn> }) => unknown) =>
    selector({ storagePath: '/tmp/storage', mapLayer: 'Satellite', language: 'en', setMapLayer: vi.fn() }),
  saveMapViewport: vi.fn(),
  loadMapViewport: vi.fn(() => null),
}));

describe('LocationPickerMap', () => {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    findsMock.data = [];
    zonesMock.data = [];
  });

  it('does not render MapContainer when open is false', () => {
    render(
      <LocationPickerMap
        open={false}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.queryByTestId('map-container')).toBeNull();
  });

  it('renders MapContainer when open is true', () => {
    render(
      <LocationPickerMap
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByTestId('map-container')).toBeTruthy();
  });

  it('centers on initialLatLng with zoom 13 when provided', () => {
    render(
      <LocationPickerMap
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        initialLatLng={{ lat: 45.8, lng: 16.2 }}
      />,
    );
    const map = screen.getByTestId('map-container');
    expect(JSON.parse(map.getAttribute('data-center') ?? '[]')).toEqual([45.8, 16.2]);
    expect(Number(map.getAttribute('data-zoom'))).toBe(13);
  });

  it('centers on Croatia at zoom 7 when no initialLatLng', () => {
    render(
      <LocationPickerMap
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );
    const map = screen.getByTestId('map-container');
    expect(JSON.parse(map.getAttribute('data-center') ?? '[]')).toEqual([45.1, 15.2]);
    expect(Number(map.getAttribute('data-zoom'))).toBe(7);
  });

  it('registers Satellite as a base layer in the picker', () => {
    render(
      <LocationPickerMap
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    expect(leafletMocks.layers).toHaveBeenCalledWith(
      expect.objectContaining({ Satellite: expect.anything(), Street: expect.anything(), Topo: expect.anything() }),
      undefined,
      expect.any(Object),
    );
  });

  it('Confirm button is disabled until a pin is placed', () => {
    render(
      <LocationPickerMap
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );
    const btn = screen.getByText('Potvrdi') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('Confirm button is enabled when initialLatLng is provided', () => {
    render(
      <LocationPickerMap
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        initialLatLng={{ lat: 45.1, lng: 15.2 }}
      />,
    );
    const btn = screen.getByText('Potvrdi') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('calls onConfirm with lat/lng when Confirm clicked', () => {
    render(
      <LocationPickerMap
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        initialLatLng={{ lat: 45, lng: 15 }}
      />,
    );
    fireEvent.click(screen.getByText('Potvrdi'));
    const [lat, lng] = onConfirm.mock.calls[0] as [number, number, unknown];
    expect(lat).toBe(45);
    expect(lng).toBe(15);
  });

  it('applies manually entered GPS coordinates', () => {
    render(
      <LocationPickerMap
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('45.7542'), { target: { value: '45.7542' } });
    fireEvent.change(screen.getByPlaceholderText('16.0186'), { target: { value: '16.0186' } });
    fireEvent.click(screen.getByText('Primijeni GPS'));
    fireEvent.click(screen.getByText('Potvrdi'));

    const [lat, lng] = onConfirm.mock.calls[0] as [number, number, unknown];
    expect(lat).toBe(45.7542);
    expect(lng).toBe(16.0186);
  });

  it('does not use the existing pin species label as the saved location note', () => {
    findsMock.data = [
      { id: 1, species_name: 'Boletus edulis', lat: 45.1, lng: 15.2 },
    ];

    render(
      <LocationPickerMap
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByTestId('marker'));
    fireEvent.click(screen.getByText('Potvrdi'));

    const [, , locationNote] = onConfirm.mock.calls[0] as [number, number, string | undefined];
    expect(locationNote).toBeUndefined();
  });

  it('passes through an existing pin location note when one is available', () => {
    findsMock.data = [
      { id: 1, species_name: 'Boletus edulis', location_note: 'Stari hrast', lat: 45.1, lng: 15.2 },
    ];

    render(
      <LocationPickerMap
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByTestId('marker'));
    fireEvent.click(screen.getByText('Potvrdi'));

    const [, , locationNote] = onConfirm.mock.calls[0] as [number, number, string | undefined];
    expect(locationNote).toBe('Stari hrast');
  });

  it('uses the containing named location when a picked pin has no location note', () => {
    findsMock.data = [
      { id: 1, species_name: 'Boletus edulis', lat: 45.1, lng: 15.2 },
    ];
    zonesMock.data = [
      {
        id: 1,
        species_name: 'Boletus edulis',
        zone_type: 'region',
        name: 'Bukova padina',
        geometry_type: 'polygon',
        center_lat: null,
        center_lng: null,
        radius_meters: null,
        polygon_json: JSON.stringify([[45.0, 15.0], [45.0, 15.4], [45.3, 15.4], [45.3, 15.0]]),
        source_find_id: null,
        notes: '',
        created_at: '',
        updated_at: '',
      },
    ];

    render(
      <LocationPickerMap
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByTestId('marker'));
    fireEvent.click(screen.getByText('Potvrdi'));

    const [, , locationNote] = onConfirm.mock.calls[0] as [number, number, string | undefined];
    expect(locationNote).toBe('Bukova padina');
  });

  it('shows no-pin placeholder and formatted coords when pin set', () => {
    const { rerender } = render(
      <LocationPickerMap
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );
    // No pin: component shows a "click on map" prompt — no coords visible
    expect(screen.queryByText(/45\./)).toBeNull();

    rerender(
      <LocationPickerMap
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        initialLatLng={{ lat: 45, lng: 15 }}
      />,
    );
    expect(screen.getByText(/45\.00000, 15\.00000/)).toBeTruthy();
  });

  it('shows previous find pins in the picker', () => {
    findsMock.data = [
      { id: 1, species_name: 'Boletus edulis', lat: 45.1, lng: 15.2 },
      { id: 2, species_name: 'Amanita muscaria', lat: 46.1, lng: 16.2 },
    ];

    render(
      <LocationPickerMap
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getAllByTestId('marker')).toHaveLength(2);
  });

});
