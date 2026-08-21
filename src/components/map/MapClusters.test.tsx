import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MapClusters } from './MapClusters';

const flyTo = vi.fn();
vi.mock('react-leaflet', () => ({
  useMap: () => ({ getZoom: () => 7, flyTo }),
  CircleMarker: ({ children, eventHandlers }: any) => (
    <button type="button" data-testid="cluster" onClick={eventHandlers.click}>{children}</button>
  ),
  Tooltip: ({ children }: any) => <span>{children}</span>,
}));

describe('MapClusters', () => {
  beforeEach(() => flyTo.mockClear());

  it('shows aggregate counts and zooms toward detail without exceeding the pin threshold', () => {
    render(<MapClusters clusters={[{ lat: 45.1, lng: 15.2, point_count: 240, species_count: 18 }]} />);
    expect(screen.getByText('240')).toHaveAttribute('aria-label', '240 nalaza · 18 vrsta');
    fireEvent.click(screen.getByTestId('cluster'));
    expect(flyTo).toHaveBeenCalledWith([45.1, 15.2], 9, { animate: true, duration: 0.55 });
  });
});
