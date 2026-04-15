import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

const fitBoundsSpy = vi.fn();
vi.mock('react-leaflet', () => ({
  useMap: () => ({ fitBounds: fitBoundsSpy }),
}));

import { FitBoundsControl } from './FitBoundsControl';
import type { Find } from '@/lib/finds';

function mk(id: number, lat: number | null, lng: number | null): Find {
  return {
    id, species_name: 's', date_found: '2026-01-01',
    country: '', region: '', location_note: '',
    lat, lng, notes: '', created_at: '', photos: [],
    original_filename: '',
  } as Find;
}

describe('FitBoundsControl', () => {
  beforeEach(() => fitBoundsSpy.mockClear());

  it('does not call fitBounds when all finds are inside Croatia bbox', () => {
    render(<FitBoundsControl finds={[mk(1, 45.1, 15.2), mk(2, 43.5, 16.4)]} />);
    expect(fitBoundsSpy).not.toHaveBeenCalled();
  });

  it('calls fitBounds when any find is outside Croatia bbox', () => {
    render(<FitBoundsControl finds={[mk(1, 45.1, 15.2), mk(2, 48.8, 2.3)]} />);
    expect(fitBoundsSpy).toHaveBeenCalledTimes(1);
    const [bounds, options] = fitBoundsSpy.mock.calls[0];
    expect(bounds).toEqual([[45.1, 15.2], [48.8, 2.3]]);
    expect(options).toEqual({ padding: [40, 40] });
  });

  it('is a no-op when no finds have coordinates', () => {
    render(<FitBoundsControl finds={[mk(1, null, null)]} />);
    expect(fitBoundsSpy).not.toHaveBeenCalled();
  });
});
