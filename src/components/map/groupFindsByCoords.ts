import type { Find } from '@/lib/finds';

export interface FindGroup {
  key: string;
  lat: number;
  lng: number;
  finds: Find[];
}

export function groupFindsByCoords(finds: Find[]): FindGroup[] {
  const map = new Map<string, Find[]>();
  for (const f of finds) {
    if (f.lat === null || f.lng === null) continue;
    const key = `${f.lat.toFixed(6)},${f.lng.toFixed(6)}`;
    const existing = map.get(key) ?? [];
    existing.push(f);
    map.set(key, existing);
  }

  const groups: FindGroup[] = [];
  for (const [baseKey, groupedFinds] of map.entries()) {
    if (groupedFinds.length === 1) {
      const [find] = groupedFinds;
      groups.push({ key: `${baseKey}:${find.id}`, lat: find.lat!, lng: find.lng!, finds: [find] });
      continue;
    }

    const radius = 0.00008;
    groupedFinds.forEach((find, index) => {
      const angle = (Math.PI * 2 * index) / groupedFinds.length;
      groups.push({
        key: `${baseKey}:${find.id}`,
        lat: find.lat! + Math.sin(angle) * radius,
        lng: find.lng! + Math.cos(angle) * radius,
        finds: [find],
      });
    });
  }

  return groups;
}
