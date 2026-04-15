import { useEffect, useState } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

/**
 * Adds a bottom-left Leaflet control showing an online/offline dot
 * and label. Reacts to window 'online' / 'offline' events.
 */
export function OnlineStatusBadge() {
  const map = useMap();
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

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
    const StatusControl = L.Control.extend({
      onAdd() {
        const div = L.DomUtil.create('div', 'bili-online-badge');
        div.style.cssText = [
          'display:flex',
          'align-items:center',
          'gap:6px',
          'padding:4px 8px',
          'background:var(--card)',
          'border:1px solid var(--border)',
          'border-radius:4px',
          'font-family:var(--font-sans)',
          'font-size:12px',
          'color:var(--muted-foreground)',
        ].join(';');
        const dot = L.DomUtil.create('span', '', div);
        dot.style.cssText = [
          'display:inline-block',
          'width:10px',
          'height:10px',
          'border-radius:50%',
          `background:${online ? '#4ade80' : 'var(--muted-foreground)'}`,
        ].join(';');
        const label = L.DomUtil.create('span', '', div);
        label.textContent = online ? 'Online' : 'Cached';
        return div;
      },
    });
    const control = new StatusControl({ position: 'bottomleft' });
    control.addTo(map);
    return () => {
      control.remove();
    };
  }, [map, online]);

  return null;
}
