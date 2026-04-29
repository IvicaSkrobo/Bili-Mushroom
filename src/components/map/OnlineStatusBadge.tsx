import { useEffect, useState } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { TILE_PROXY_ERROR_EVENT } from './RustProxyTileLayer';

const SHOW_TILE_PROXY_ERRORS = import.meta.env.DEV;

interface TileProxyErrorDetail {
  message: string;
  url: string;
  at: string;
}

/**
 * Adds a bottom-left Leaflet control showing an online/offline dot
 * and label. Reacts to window 'online' / 'offline' events.
 */
export function OnlineStatusBadge() {
  const map = useMap();
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [tileError, setTileError] = useState<TileProxyErrorDetail | null>(null);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!SHOW_TILE_PROXY_ERRORS) return undefined;
    const handleTileError = (event: Event) => {
      const detail = (event as CustomEvent<TileProxyErrorDetail>).detail;
      if (!detail?.message) return;
      setTileError(detail);
    };
    window.addEventListener(TILE_PROXY_ERROR_EVENT, handleTileError);
    return () => {
      window.removeEventListener(TILE_PROXY_ERROR_EVENT, handleTileError);
    };
  }, []);

  useEffect(() => {
    const StatusControl = L.Control.extend({
      onAdd() {
        const div = L.DomUtil.create('div', 'bili-online-badge');
        div.style.cssText = [
          'display:flex',
          'flex-direction:column',
          'align-items:flex-start',
          'max-width:420px',
          'gap:6px',
          'padding:4px 8px',
          'background:var(--card)',
          'border:1px solid var(--border)',
          'border-radius:4px',
          'font-family:var(--font-sans)',
          'font-size:12px',
          'color:var(--muted-foreground)',
        ].join(';');
        const statusRow = L.DomUtil.create('div', '', div);
        statusRow.style.cssText = [
          'display:flex',
          'align-items:center',
          'gap:6px',
        ].join(';');
        const dot = L.DomUtil.create('span', '', statusRow);
        dot.style.cssText = [
          'display:inline-block',
          'width:10px',
          'height:10px',
          'border-radius:50%',
          `background:${online ? '#4ade80' : 'var(--muted-foreground)'}`,
        ].join(';');
        const label = L.DomUtil.create('span', '', statusRow);
        label.textContent = online ? 'Online' : 'Cached';
        if (SHOW_TILE_PROXY_ERRORS && tileError) {
          const error = L.DomUtil.create('div', '', div);
          error.style.cssText = [
            'margin-top:2px',
            'max-width:400px',
            'white-space:normal',
            'overflow-wrap:anywhere',
            'font-family:var(--font-mono)',
            'font-size:10px',
            'line-height:1.35',
            'color:var(--destructive)',
            'user-select:text',
          ].join(';');
          error.textContent = `Tile proxy error: ${tileError.message}`;
          error.title = `${tileError.at}\n${tileError.url}\n${tileError.message}`;
        }
        return div;
      },
    });
    const control = new StatusControl({ position: 'bottomleft' });
    control.addTo(map);
    return () => {
      control.remove();
    };
  }, [map, online, tileError]);

  return null;
}
