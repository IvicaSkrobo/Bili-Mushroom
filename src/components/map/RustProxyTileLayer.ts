import L from 'leaflet';
import { invoke } from '@tauri-apps/api/core';

export interface RustProxyTileLayerOptions {
  urlTemplate: string;
  attribution?: string;
  minZoom?: number;
  maxZoom?: number;
}

export interface TileCoords { x: number; y: number; z: number; }

/**
 * Substitute {z}/{x}/{y}/{s} placeholders in a tile URL template.
 * Exported for unit testing.
 */
export function resolveTileUrl(template: string, coords: TileCoords): string {
  return template
    .replace('{z}', String(coords.z))
    .replace('{x}', String(coords.x))
    .replace('{y}', String(coords.y))
    .replace('{s}', 'a');
}

/**
 * Create a Leaflet GridLayer that routes every tile request through the Rust
 * fetch_tile Tauri command. The Rust side validates the URL against an
 * allowlist, fetches the bytes, writes them to disk, and returns a base64
 * data URI that this layer assigns to an <img> element.
 */
export function createRustProxyTileLayer(
  options: RustProxyTileLayerOptions,
): L.GridLayer {
  const RustProxyGridLayer = L.GridLayer.extend({
    createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
      const img = document.createElement('img');
      img.setAttribute('role', 'presentation');
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      const url = resolveTileUrl(options.urlTemplate, coords);

      const loadDirect = () => {
        img.src = url;
        done(undefined, img);
      };

      invoke<string>('fetch_tile', {
        url,
      })
        .then((dataUri) => {
          img.src = dataUri;
          done(undefined, img);
        })
        .catch((err: unknown) => {
          console.warn('Tile proxy failed, falling back to direct tile URL.', err);
          loadDirect();
        });
      return img;
    },
  });
  return new RustProxyGridLayer({
    attribution: options.attribution,
    minZoom: options.minZoom ?? 0,
    maxZoom: options.maxZoom ?? 19,
  });
}
