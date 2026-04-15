import { describe, it, expect } from 'vitest';
import { groupFindsByCoords } from './groupFindsByCoords';
import type { Find } from '@/lib/finds';

function mk(id: number, lat: number | null, lng: number | null): Find {
  return {
    id,
    species_name: `species_${id}`,
    date_found: '2026-01-01',
    country: '',
    region: '',
    location_note: '',
    lat,
    lng,
    notes: '',
    created_at: '',
    photos: [],
    original_filename: '',
  } as Find;
}

describe('groupFindsByCoords', () => {
  it('returns empty array for empty input', () => {
    expect(groupFindsByCoords([])).toEqual([]);
  });

  it('three finds at different coordinates produce three groups each with 1 find', () => {
    const finds = [mk(1, 45.1, 15.2), mk(2, 46.0, 16.0), mk(3, 43.5, 14.0)];
    const groups = groupFindsByCoords(finds);
    expect(groups).toHaveLength(3);
    expect(groups.every((g) => g.finds.length === 1)).toBe(true);
  });

  it('three finds at same lat/lng produce one group with 3 finds', () => {
    const finds = [mk(1, 45.1, 15.2), mk(2, 45.1, 15.2), mk(3, 45.1, 15.2)];
    const groups = groupFindsByCoords(finds);
    expect(groups).toHaveLength(1);
    expect(groups[0].finds).toHaveLength(3);
  });

  it('two finds differing by less than 0.0000001 degrees share a group', () => {
    const finds = [mk(1, 45.100000, 15.200000), mk(2, 45.1000001, 15.2000001)];
    const groups = groupFindsByCoords(finds);
    expect(groups).toHaveLength(1);
    expect(groups[0].finds).toHaveLength(2);
  });

  it('finds with null lat or null lng are filtered out', () => {
    const finds = [mk(1, null, 15.2), mk(2, 45.1, null), mk(3, null, null), mk(4, 45.1, 15.2)];
    const groups = groupFindsByCoords(finds);
    expect(groups).toHaveLength(1);
    expect(groups[0].finds[0].id).toBe(4);
  });

  it('group insertion order matches first occurrence of each key', () => {
    const finds = [mk(1, 45.1, 15.2), mk(2, 46.0, 16.0), mk(3, 45.1, 15.2)];
    const groups = groupFindsByCoords(finds);
    expect(groups).toHaveLength(2);
    expect(groups[0].lat).toBeCloseTo(45.1);
    expect(groups[1].lat).toBeCloseTo(46.0);
  });
});
