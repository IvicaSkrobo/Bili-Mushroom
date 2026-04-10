import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reverseGeocode } from './geocoding';

describe('reverseGeocode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves with country and region (state) on success', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        address: { country: 'Croatia', state: 'City of Zagreb' },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await reverseGeocode(45.8, 15.97);

    expect(result).toEqual({ country: 'Croatia', region: 'City of Zagreb' });

    // Verify URL contains lat/lng
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('lat=45.8');
    expect(url).toContain('lon=15.97');

    // Verify User-Agent header is set
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = init?.headers as Record<string, string>;
    expect(headers['User-Agent']).toBe('BiliMushroom/0.1 (hr.biligrupa.bilimushroom)');
  });

  it('falls back to county when state is absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        address: { country: 'Croatia', county: 'Istarska' },
      }),
    }));

    const result = await reverseGeocode(45.2, 13.9);

    expect(result).toEqual({ country: 'Croatia', region: 'Istarska' });
  });

  it('resolves with empty strings when fetch rejects (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const result = await reverseGeocode(45.8, 15.97);

    expect(result).toEqual({ country: '', region: '' });
  });

  it('resolves with empty strings when response has no address field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }));

    const result = await reverseGeocode(45.8, 15.97);

    expect(result).toEqual({ country: '', region: '' });
  });
});
