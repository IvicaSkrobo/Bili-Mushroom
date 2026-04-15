import type { Find } from '@/lib/finds';

export interface FindGroup {
  key: string;
  lat: number;
  lng: number;
  finds: Find[];
}

export function groupFindsByCoords(finds: Find[]): FindGroup[] {
  const map = new Map<string, FindGroup>();
  for (const f of finds) {
    if (f.lat === null || f.lng === null) continue;
    const key = `${f.lat.toFixed(6)},${f.lng.toFixed(6)}`;
    const existing = map.get(key);
    if (existing) {
      existing.finds.push(f);
    } else {
      map.set(key, { key, lat: f.lat, lng: f.lng, finds: [f] });
    }
  }
  return Array.from(map.values());
}
