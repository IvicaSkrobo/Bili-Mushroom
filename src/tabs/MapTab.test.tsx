import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/map/FindsMap', () => ({
  FindsMap: ({ storagePath }: { storagePath: string }) => (
    <div data-testid="finds-map" data-storage={storagePath} />
  ),
}));

vi.mock('@/hooks/useFinds', () => ({
  useFinds: () => ({ data: [], isLoading: false }),
}));

// Mock the store to allow per-test override of storagePath
const storagePathRef = { current: null as string | null };
vi.mock('@/stores/appStore', () => ({
  useAppStore: (selector: (s: { storagePath: string | null }) => unknown) =>
    selector({ storagePath: storagePathRef.current }),
}));

import MapTab from './MapTab';

describe('MapTab', () => {
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
    expect(map.getAttribute('data-storage')).toBe('/tmp/storage');
  });
});
