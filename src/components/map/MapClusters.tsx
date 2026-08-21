import { CircleMarker, Tooltip, useMap } from 'react-leaflet';
import type { MapCluster } from '@/lib/finds';
import { useT } from '@/i18n/index';

export const MAP_POINT_DETAIL_ZOOM = 12;

export function MapClusters({ clusters }: { clusters: MapCluster[] }) {
  const map = useMap();
  const t = useT();
  return clusters.map((cluster, index) => {
    const radius = Math.min(26, 11 + Math.log2(Math.max(1, cluster.point_count)) * 2.5);
    const description = cluster.species_count === 1
      ? t('map.clusterOneSpecies', { count: cluster.point_count })
      : t('map.clusterManySpecies', { finds: cluster.point_count, species: cluster.species_count });
    return (
      <CircleMarker
        key={`${cluster.lat}-${cluster.lng}-${index}`}
        center={[cluster.lat, cluster.lng]}
        radius={radius}
        pathOptions={{ color: '#f4e8c8', fillColor: '#b77812', fillOpacity: 0.92, opacity: 0.96, weight: 2 }}
        eventHandlers={{
          click: () => map.flyTo(
            [cluster.lat, cluster.lng],
            Math.min(MAP_POINT_DETAIL_ZOOM, map.getZoom() + 2),
            { animate: true, duration: 0.55 },
          ),
        }}
      >
        <Tooltip permanent direction="center" className="bili-map-cluster-label">
          <span aria-label={description}>{cluster.point_count}</span>
        </Tooltip>
      </CircleMarker>
    );
  });
}
