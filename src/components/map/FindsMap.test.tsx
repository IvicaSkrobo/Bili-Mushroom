import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

let mapEvents: Record<string, (event: any) => void> = {};

// Stub react-leaflet so jsdom does not try to render a real map
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, center, zoom }: any) => (
    <div data-testid="map-container" data-center={JSON.stringify(center)} data-zoom={zoom}>
      {children}
    </div>
  ),
  useMap: () => ({ addLayer: vi.fn(), removeLayer: vi.fn() }),
  useMapEvents: (events: Record<string, (event: any) => void>) => {
    mapEvents = events;
    return {};
  },
  Polygon: () => null,
  Polyline: () => null,
  CircleMarker: () => null,
  Marker: () => null,
}));

// Stub all child components so they don't try to call real Leaflet
vi.mock('./LayerSwitcher', () => ({ LayerSwitcher: () => null }));
vi.mock('./CollectionPins', () => ({ CollectionPins: () => null }));
vi.mock('./FitBoundsControl', () => ({ FitBoundsControl: () => null }));
vi.mock('./OnlineStatusBadge', () => ({ OnlineStatusBadge: () => null }));
vi.mock('./ZoneLayers', () => ({ ZoneLayers: () => null }));

import { FindsMap } from './FindsMap';

describe('FindsMap', () => {
  beforeEach(() => {
    mapEvents = {};
  });

  it('renders MapContainer with Croatia center [45.1, 15.2] zoom 7 when finds is empty', () => {
    render(<FindsMap finds={[]} />);
    const container = screen.getByTestId('map-container');
    expect(container.getAttribute('data-center')).toBe('[45.1,15.2]');
    expect(container.getAttribute('data-zoom')).toBe('7');
  });

  it('wraps the map in an animate-fade-up container', () => {
    const { container } = render(<FindsMap finds={[]} />);
    expect(container.querySelector('.animate-fade-up')).not.toBeNull();
  });

  it('shows the unified polygon editor toolbar for first draw with move/add shortcuts', () => {
    render(
      <FindsMap
        finds={[]}
        polygonEditorActive={true}
        polygonEditorMode="add"
        polygonEditorPoints={[]}
        polygonEditorZoneType="local"
        polygonEditorZoneName="Test local"
      />,
    );

    expect(screen.getByText(/drawing local boundary: test local/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /move \(m\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add point \(n\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
  });

  it('inserts add-mode clicks into the nearest polygon edge once a polygon exists', () => {
    const onAddPoint = vi.fn();
    const onInsertPoint = vi.fn();

    render(
      <FindsMap
        finds={[]}
        polygonEditorActive={true}
        polygonEditorMode="add"
        polygonEditorPoints={[
          [0, 0],
          [0, 10],
          [10, 10],
          [10, 0],
        ]}
        polygonEditorZoneType="local"
        onPolygonEditorAddPoint={onAddPoint}
        onPolygonEditorInsertPoint={onInsertPoint}
      />,
    );

    mapEvents.click?.({ latlng: { lat: 0.2, lng: 5 } });

    expect(onAddPoint).not.toHaveBeenCalled();
    expect(onInsertPoint).toHaveBeenCalledWith(0, [0.2, 5]);
  });
});
