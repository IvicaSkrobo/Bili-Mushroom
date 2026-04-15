import { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { createRustProxyTileLayer } from './RustProxyTileLayer';

const OSM_TEMPLATE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ESRI_TEMPLATE =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const TOPO_TEMPLATE = 'https://tile.opentopomap.org/{z}/{x}/{y}.png';

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
    const topoLayer = createRustProxyTileLayer({
      urlTemplate: TOPO_TEMPLATE,
      storagePath,
      attribution: '© OpenTopoMap contributors',
      maxZoom: 17,
    });
    topoLayer.addTo(map);
    const control = L.control
      .layers(
        { Topo: topoLayer, Street: osmLayer, Satellite: esriLayer },
        undefined,
        { position: 'topright' },
      )
      .addTo(map);
    return () => {
      control.remove();
      if (map.hasLayer(osmLayer)) map.removeLayer(osmLayer);
      if (map.hasLayer(esriLayer)) map.removeLayer(esriLayer);
      if (map.hasLayer(topoLayer)) map.removeLayer(topoLayer);
    };
  }, [map, storagePath]);
  return null;
}
