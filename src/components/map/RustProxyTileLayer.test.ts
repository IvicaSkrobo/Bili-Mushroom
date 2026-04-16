import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveTileUrl, createRustProxyTileLayer } from './RustProxyTileLayer';

// Mock the Tauri invoke directly (tauri-mocks handles the global, but this
// isolates the test to only this layer's behavior)
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));
import { invoke } from '@tauri-apps/api/core';

describe('resolveTileUrl', () => {
  it('substitutes z/x/y in OSM template', () => {
    expect(
      resolveTileUrl('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { x: 10, y: 12, z: 5 }),
    ).toBe('https://tile.openstreetmap.org/5/10/12.png');
  });

  it('replaces {s} with fixed "a" subdomain', () => {
    expect(
      resolveTileUrl('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { x: 2, y: 3, z: 1 }),
    ).toBe('https://a.tile.openstreetmap.org/1/2/3.png');
  });

  it('substitutes z/y/x in Esri template (y before x)', () => {
    expect(
      resolveTileUrl(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { x: 10, y: 12, z: 5 },
      ),
    ).toBe('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/5/12/10');
  });
});

describe('createRustProxyTileLayer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a Leaflet GridLayer', () => {
    const layer = createRustProxyTileLayer({
      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    });
    // Duck-type check: GridLayer exposes getTileSize()
    expect(typeof (layer as unknown as { getTileSize: unknown }).getTileSize).toBe('function');
  });

  it('calls invoke("fetch_tile") with url and storagePath when createTile runs', async () => {
    (invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      'data:image/png;base64,AAAA',
    );
    const layer = createRustProxyTileLayer({
      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    });
    const done = vi.fn();
    // Call createTile directly — it is a method on the prototype
    const coords = { x: 1, y: 2, z: 3 } as L.Coords;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const img = (layer as any).createTile(coords, done);
    expect(img).toBeInstanceOf(HTMLElement);
    expect(invoke).toHaveBeenCalledWith('fetch_tile', {
      url: 'https://tile.openstreetmap.org/3/1/2.png',
    });
    // Flush microtasks so the .then runs
    await new Promise((r) => setTimeout(r, 0));
    expect(done).toHaveBeenCalledWith(undefined, img);
    expect((img as HTMLImageElement).src).toContain('data:image/png;base64,AAAA');
  });

  it('falls back to the direct tile URL when the proxy fails', async () => {
    (invoke as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
    const layer = createRustProxyTileLayer({
      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    });
    const done = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const img = (layer as any).createTile({ x: 0, y: 0, z: 0 } as L.Coords, done);
    await new Promise((r) => setTimeout(r, 0));
    expect(done).toHaveBeenCalledWith(undefined, img);
    expect((img as HTMLImageElement).src).toContain('https://tile.openstreetmap.org/0/0/0.png');
  });
});
