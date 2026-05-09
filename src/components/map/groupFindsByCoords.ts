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
  for (const [key, groupedFinds] of map.entries()) {
    const first = groupedFinds[0];
    groups.push({ key, lat: first.lat!, lng: first.lng!, finds: groupedFinds });
  }

  return groups;
}
