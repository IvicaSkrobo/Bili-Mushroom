import { MapContainer } from 'react-leaflet';
import type { Find } from '@/lib/finds';
import { applyLeafletIconFix } from './leafletIconFix';
import { FindPins } from './FindPins';
import { CollectionPins } from './CollectionPins';
import { FitBoundsControl } from './FitBoundsControl';
import { LayerSwitcher } from './LayerSwitcher';
import { OnlineStatusBadge } from './OnlineStatusBadge';

applyLeafletIconFix();

const CROATIA_CENTER: [number, number] = [45.1, 15.2];
const CROATIA_ZOOM = 7;

interface FindsMapProps {
  finds: Find[];
  storagePath: string;
}

export function FindsMap({ finds, storagePath }: FindsMapProps) {
  return (
    <div className="animate-fade-up h-full w-full">
      <MapContainer
        center={CROATIA_CENTER}
        zoom={CROATIA_ZOOM}
        style={{ height: '100%', width: '100%' }}
        className="rounded-md"
      >
        <LayerSwitcher storagePath={storagePath} />
        <FindPins finds={finds} storagePath={storagePath} />
        <CollectionPins finds={finds} />
        <FitBoundsControl finds={finds} />
        <OnlineStatusBadge />
      </MapContainer>
    </div>
  );
}
