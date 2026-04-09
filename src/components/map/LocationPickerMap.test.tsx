import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocationPickerMap } from './LocationPickerMap';

// Mock react-leaflet to avoid DOM rendering issues in jsdom
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ position }: { position: { lat: number; lng: number } }) => (
    <div data-testid="marker" data-lat={position.lat} data-lng={position.lng} />
  ),
  useMapEvents: () => null,
}));

// Mock leaflet module
vi.mock('leaflet', () => ({
  default: {
    Icon: { Default: { prototype: {}, mergeOptions: vi.fn() } },
    latLng: (lat: number, lng: number) => ({ lat, lng }),
  },
  latLng: (lat: number, lng: number) => ({ lat, lng }),
}));

// Mock leaflet marker images (Vite asset imports)
vi.mock('leaflet/dist/images/marker-icon.png', () => ({ default: 'marker-icon.png' }));
vi.mock('leaflet/dist/images/marker-shadow.png', () => ({ default: 'marker-shadow.png' }));

describe('LocationPickerMap', () => {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog with "Pick location" title when open', () => {
    render(
      <LocationPickerMap
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByText('Pick location')).toBeTruthy();
  });

  it('renders confirm button disabled when no pin is set', () => {
    render(
      <LocationPickerMap
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );
    const confirmBtn = screen.getByText('Confirm location');
    expect(confirmBtn).toBeTruthy();
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders cancel button that calls onOpenChange(false)', () => {
    render(
      <LocationPickerMap
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders map container when open', () => {
    render(
      <LocationPickerMap
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByTestId('map-container')).toBeTruthy();
  });
});
