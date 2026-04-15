import { useEffect } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { createRustProxyTileLayer } from './RustProxyTileLayer';
import { useAppStore } from '@/stores/appStore';
import type { MapLayer } from '@/stores/appStore';

const OSM_TEMPLATE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ESRI_TEMPLATE =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const TOPO_TEMPLATE = 'https://tile.opentopomap.org/{z}/{x}/{y}.png';

/**
 * Attaches a Leaflet L.control.layers widget with three base layers:
 * Satellite (Esri, default), Street (OSM), and Topo (OpenTopoMap).
 * All route through the Rust tile proxy. Persists the user's last picked
 * layer to localStorage via appStore. Does not render any React DOM directly.
 */
export function LayerSwitcher({ storagePath }: { storagePath: string }) {
  const map = useMap();
  const mapLayer = useAppStore((s) => s.mapLayer);
  const setMapLayer = useAppStore((s) => s.setMapLayer);

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

    const layers: Record<MapLayer, L.TileLayer> = {
      Street: osmLayer,
      Satellite: esriLayer,
      Topo: topoLayer,
    };

    // Add the persisted (or default) layer
    layers[mapLayer].addTo(map);

    const control = L.control
      .layers(
        { Topo: topoLayer, Street: osmLayer, Satellite: esriLayer },
        undefined,
        { position: 'topright' },
      )
      .addTo(map);

    // Persist when user switches
    const handleLayerChange = (e: L.LayersControlEvent) => {
      const name = e.name as MapLayer;
      if (name === 'Satellite' || name === 'Topo' || name === 'Street') {
        setMapLayer(name);
      }
    };
    map.on('baselayerchange', handleLayerChange);

    return () => {
      map.off('baselayerchange', handleLayerChange);
      control.remove();
      if (map.hasLayer(osmLayer)) map.removeLayer(osmLayer);
      if (map.hasLayer(esriLayer)) map.removeLayer(esriLayer);
      if (map.hasLayer(topoLayer)) map.removeLayer(topoLayer);
    };
  }, [map, storagePath]); // NOTE: intentionally omit mapLayer/setMapLayer from deps — only read on mount

  return null;
}
