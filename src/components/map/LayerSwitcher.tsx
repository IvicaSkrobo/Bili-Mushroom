import { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { createRustProxyTileLayer } from './RustProxyTileLayer';

const OSM_TEMPLATE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ESRI_TEMPLATE =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

/**
 * Attaches a Leaflet L.control.layers widget with two base layers:
 * OSM street (default) and Esri satellite. Both route through the Rust
 * tile proxy. Does not render any React DOM directly.
 */
export function LayerSwitcher({ storagePath }: { storagePath: string }) {
  const map = useMap();
  useEffect(() => {
    const osmLayer = createRustProxyTileLayer({
      urlTemplate: OSM_TEMPLATE,
      storagePath,
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    });
    const esriLayer = createRustProxyTileLayer({
      urlTemplate: ESRI_TEMPLATE,
      storagePath,
      attribution: 'Tiles © Esri',
      maxZoom: 19,
    });
    osmLayer.addTo(map);
    const control = L.control
      .layers(
        { Street: osmLayer, Satellite: esriLayer },
        undefined,
        { position: 'topright' },
      )
      .addTo(map);
    return () => {
      control.remove();
      map.removeLayer(osmLayer);
      if (map.hasLayer(esriLayer)) map.removeLayer(esriLayer);
    };
  }, [map, storagePath]);
  return null;
}
