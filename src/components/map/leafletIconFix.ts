import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// Patches Leaflet's broken default icon resolution under Vite.
// Import this module once anywhere before rendering a MapContainer.
let applied = false;
export function applyLeafletIconFix() {
  if (applied) return;
  applied = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });
}
