import L from 'leaflet';
import { invoke } from '@tauri-apps/api/core';

export interface RustProxyTileLayerOptions {
  urlTemplate: string;
  attribution?: string;
  minZoom?: number;
  maxZoom?: number;
  directFallback?: boolean;
}

export interface TileCoords { x: number; y: number; z: number; }

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

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

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
}

export function createOfflineTileDataUri(coords: TileCoords): string {
  const hueShift = (coords.x * 17 + coords.y * 29 + coords.z * 11) % 24;
  const bg = hueShift > 12 ? '#d9ddd2' : '#d4dbcf';
  const line = '#adb7a8';
  const contour = '#9ca990';
  const text = '#59634f';
  const label = `${coords.z}/${coords.x}/${coords.y}`;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" fill="${bg}"/>
  <path d="M-20 68C35 35 83 36 141 66S235 91 283 48" fill="none" stroke="${contour}" stroke-width="2" opacity=".42"/>
  <path d="M-16 150C38 123 89 118 137 139S218 183 278 137" fill="none" stroke="${contour}" stroke-width="2" opacity=".34"/>
  <path d="M-22 218C43 184 86 192 141 219S226 247 276 206" fill="none" stroke="${contour}" stroke-width="2" opacity=".3"/>
  <path d="M64 0V256M128 0V256M192 0V256M0 64H256M0 128H256M0 192H256" stroke="${line}" stroke-width="1" opacity=".58"/>
  <circle cx="198" cy="54" r="22" fill="#c28a33" opacity=".16"/>
  <text x="16" y="232" font-family="monospace" font-size="12" fill="${text}" opacity=".72">cached atlas ${label}</text>
</svg>`.trim();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function loadImageTile(
  img: HTMLImageElement,
  src: string,
  done: L.DoneCallback,
  errorMessage: string,
) {
  let settled = false;
  const finish = (err?: Error) => {
    if (settled) return;
    settled = true;
    done(err, img);
  };
  img.onload = () => finish();
  img.onerror = () => finish(new Error(errorMessage));
  img.src = src;
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
      const directFallback = options.directFallback ?? !isTauriRuntime();
      const offlineFallback = () => {
        loadImageTile(
          img,
          createOfflineTileDataUri(coords),
          done,
          `Offline tile fallback failed: ${url}`,
        );
      };

      const loadDirect = () => {
        if (!directFallback) {
          offlineFallback();
          return;
        }
        loadImageTile(img, url, done, `Tile load failed: ${url}`);
      };

      invoke<string>('fetch_tile', { url })
        .then((dataUri) => {
          if (!dataUri.startsWith('data:')) {
            console.error('fetch_tile returned non-data-URI, falling back:', dataUri.slice(0, 80));
            loadDirect();
            return;
          }
          loadImageTile(img, dataUri, done, `Proxied tile data failed: ${url}`);
        })
        .catch((err: unknown) => {
          console.warn('Tile proxy failed; using fallback tile path.', url, err);
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
