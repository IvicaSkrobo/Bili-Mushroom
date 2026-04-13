import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Stub react-leaflet so jsdom does not try to render a real map
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, center, zoom }: any) => (
    <div data-testid="map-container" data-center={JSON.stringify(center)} data-zoom={zoom}>
      {children}
    </div>
  ),
  useMap: () => ({ addLayer: vi.fn(), removeLayer: vi.fn() }),
}));

// Stub the tile layer factory so useEffect doesn't call real Leaflet
vi.mock('./RustProxyTileLayer', () => ({
  createRustProxyTileLayer: vi.fn(() => ({
    addTo: vi.fn(),
    remove: vi.fn(),
  })),
}));

import { FindsMap } from './FindsMap';

describe('FindsMap', () => {
  it('renders MapContainer with Croatia center [45.1, 15.2] zoom 7 when finds is empty', () => {
    render(<FindsMap finds={[]} storagePath="/tmp/x" />);
    const container = screen.getByTestId('map-container');
    expect(container.getAttribute('data-center')).toBe('[45.1,15.2]');
    expect(container.getAttribute('data-zoom')).toBe('7');
  });

  it('wraps the map in an animate-fade-up container', () => {
    const { container } = render(<FindsMap finds={[]} storagePath="/tmp/x" />);
    expect(container.querySelector('.animate-fade-up')).not.toBeNull();
  });
});
