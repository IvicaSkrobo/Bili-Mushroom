import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-leaflet', () => ({
  Marker: ({ children, position }: any) => (
    <div data-testid="marker" data-pos={JSON.stringify(position)}>
      {children}
    </div>
  ),
  Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
}));

vi.mock('./FindPopup', () => ({
  FindPopup: ({ group }: any) => (
    <div data-testid="find-popup" data-count={group.finds.length} data-key={group.key} />
  ),
}));

import { FindPins } from './FindPins';
import type { Find } from '@/lib/finds';

function mk(id: number, lat: number | null, lng: number | null): Find {
  return {
    id, species_name: `s${id}`, date_found: '2026-01-01',
    country: '', region: '', location_note: '',
    lat, lng, notes: '', created_at: '', photos: [],
    original_filename: '',
  } as Find;
}

describe('FindPins', () => {
  it('renders one marker per unique coordinate group', () => {
    const finds = [
      mk(1, 45.1, 15.2),
      mk(2, 45.1, 15.2),   // same as #1 → cluster
      mk(3, 46.0, 16.0),
    ];
    render(<FindPins finds={finds} storagePath="/tmp/x" />);
    expect(screen.getAllByTestId('marker')).toHaveLength(2);
    const popups = screen.getAllByTestId('find-popup');
    const counts = popups.map((p) => p.getAttribute('data-count'));
    expect(counts).toContain('2');
    expect(counts).toContain('1');
  });

  it('ignores finds with null lat or lng', () => {
    const finds = [mk(1, null, null), mk(2, 45.1, 15.2)];
    render(<FindPins finds={finds} storagePath="/tmp/x" />);
    expect(screen.getAllByTestId('marker')).toHaveLength(1);
  });

  it('renders nothing when no finds have coordinates', () => {
    render(<FindPins finds={[mk(1, null, null)]} storagePath="/tmp/x" />);
    expect(screen.queryAllByTestId('marker')).toHaveLength(0);
  });
});
