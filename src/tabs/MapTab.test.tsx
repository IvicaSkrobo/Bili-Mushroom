import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/map/FindsMap', () => ({
  FindsMap: () => (
    <div data-testid="finds-map" />
  ),
}));

const mapPointsRef = {
  current: { data: [] as never[], error: null as Error | null, isLoading: false },
};
vi.mock('@/hooks/useFinds', () => ({
  useMapPoints: () => mapPointsRef.current,
}));

vi.mock('@/hooks/useZones', () => ({
  useZones: () => ({ data: [], isLoading: false }),
  useUpsertZone: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// Mock the store to allow per-test override of storagePath
const storagePathRef = { current: null as string | null };
vi.mock('@/stores/appStore', () => ({
  useAppStore: (selector: (s: { activeTab: string; language: string; storagePath: string | null }) => unknown) =>
    selector({ activeTab: 'map', language: 'en', storagePath: storagePathRef.current }),
}));

import MapTab from './MapTab';

describe('MapTab', () => {
  beforeEach(() => {
    storagePathRef.current = null;
    mapPointsRef.current = { data: [], error: null, isLoading: false };
  });

  it('renders the "select a storage folder" hint when storagePath is null', () => {
    storagePathRef.current = null;
    render(<MapTab />);
    expect(screen.getByText(/select a storage folder/i)).toBeInTheDocument();
    expect(screen.queryByTestId('finds-map')).toBeNull();
  });

  it('renders FindsMap when storagePath is set', () => {
    storagePathRef.current = '/tmp/storage';
    render(<MapTab />);
    const map = screen.getByTestId('finds-map');
    expect(map).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('distinguishes a failed map query from a successfully empty map', () => {
    storagePathRef.current = '/tmp/storage';
    mapPointsRef.current = {
      data: [],
      error: new Error('unknown command get_map_points'),
      isLoading: false,
    };

    render(<MapTab />);

    expect(screen.getByRole('alert')).toHaveTextContent(/could not be loaded/i);
    expect(screen.getByTestId('finds-map')).toBeInTheDocument();
  });
});
