import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { LocationPickerMap } from './LocationPickerMap';

vi.mock('leaflet', () => ({
  default: {
    control: {
      layers: () => ({
        addTo: () => ({
          remove: vi.fn(),
        }),
      }),
    },
  },
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
  }: {
    position: [number, number];
    draggable?: boolean;
    eventHandlers?: Record<string, unknown>;
  }) => (
    <div
      data-testid="marker"
      data-lat={position[0]}
      data-lng={position[1]}
    />
  ),
  useMap: () => ({
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    hasLayer: vi.fn(() => false),
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

// Mock appStore to return a storagePath
vi.mock('@/stores/appStore', () => ({
  useAppStore: (selector: (s: { storagePath: string }) => unknown) =>
    selector({ storagePath: '/tmp/storage' }),
}));

describe('LocationPickerMap', () => {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
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

  it('renders MapContainer when open is true and storagePath is set', () => {
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

  it('Confirm button is disabled until a pin is placed', () => {
    render(
      <LocationPickerMap
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );
    const btn = screen.getByText('Confirm location') as HTMLButtonElement;
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
    const btn = screen.getByText('Confirm location') as HTMLButtonElement;
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
    fireEvent.click(screen.getByText('Confirm location'));
    expect(onConfirm).toHaveBeenCalledWith(45, 15);
  });

  it('shows "Selected: —" when no pin and formatted coords when pin set', () => {
    const { rerender } = render(
      <LocationPickerMap
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );
    // "Selected:" and "—" may be split across sibling text nodes in jsdom
    const container = screen.getByText(/Selected:/).closest('div');
    expect(container?.textContent).toContain('—');

    rerender(
      <LocationPickerMap
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        initialLatLng={{ lat: 45, lng: 15 }}
      />,
    );
    expect(screen.getByText(/45\.000000, 15\.000000/)).toBeTruthy();
  });
});
