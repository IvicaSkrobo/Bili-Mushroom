import { useMemo } from 'react';
import L from 'leaflet';
import { Marker, Popup } from 'react-leaflet';
import type { Find } from '@/lib/finds';
import { groupFindsByCoords } from './groupFindsByCoords';
import { FindPopup } from './FindPopup';

const PIN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="22" viewBox="0 0 16 22">
  <path d="M8 0 C3.582 0 0 3.582 0 8 C0 13.5 8 22 8 22 C8 22 16 13.5 16 8 C16 3.582 12.418 0 8 0 Z"
        fill="oklch(0.80 0.14 78)" stroke="oklch(0.12 0.02 80)" stroke-width="1"/>
</svg>`;

function singleIcon(): L.DivIcon {
  return L.divIcon({
    html: PIN_SVG,
    className: 'bili-find-pin',
    iconSize: [16, 22],
    iconAnchor: [8, 22],
    popupAnchor: [0, -20],
  });
}

function clusterIcon(count: number): L.DivIcon {
  const style = [
    'background:oklch(0.80 0.14 78)',
    'color:oklch(0.12 0.02 80)',
    'border-radius:50%',
    'width:24px',
    'height:24px',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'font-weight:400',
    'font-size:12px',
    'border:2px solid oklch(0.12 0.02 80)',
  ].join(';');
  return L.divIcon({
    html: `<div style="${style}">${count}</div>`,
    className: 'bili-cluster-pin',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

export function FindPins({
  finds,
  storagePath,
}: {
  finds: Find[];
  storagePath: string;
}) {
  const groups = useMemo(() => groupFindsByCoords(finds), [finds]);
  return (
    <>
      {groups.map((group) => {
        const icon =
          group.finds.length === 1 ? singleIcon() : clusterIcon(group.finds.length);
        return (
          <Marker
            key={group.key}
            position={[group.lat, group.lng]}
            icon={icon}
          >
            <Popup>
              <FindPopup group={group} storagePath={storagePath} />
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
