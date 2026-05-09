import { describe, it, expect } from 'vitest';
import { groupFindsByCoords } from './groupFindsByCoords';
import type { Find } from '@/lib/finds';

function mk(id: number, lat: number | null, lng: number | null, opts?: { date?: string; species?: string }): Find {
  return {
    id,
    species_name: opts?.species ?? `species_${id}`,
    date_found: opts?.date ?? '2026-01-01',
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

  it('three finds at same lat/lng produce one group with 3 finds (regardless of species)', () => {
    const finds = [
      mk(1, 45.1, 15.2, { species: 'Cantharellus cibarius' }),
      mk(2, 45.1, 15.2, { species: 'Boletus edulis' }),
      mk(3, 45.1, 15.2, { species: 'Cantharellus cibarius' }),
    ];
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

  it('different species at same coordinates produce one shared pin', () => {
    const finds = [
      mk(1, 45.1, 15.2, { species: 'Cantharellus cibarius' }),
      mk(2, 45.1, 15.2, { species: 'Boletus edulis' }),
    ];
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
    const sp = { species: 'Cantharellus cibarius' };
    const finds = [mk(1, 45.1, 15.2, sp), mk(2, 46.0, 16.0, sp), mk(3, 45.1, 15.2, sp)];
    const groups = groupFindsByCoords(finds);
    expect(groups).toHaveLength(2);
    expect(groups[0].lat).toBeCloseTo(45.1);
    expect(groups[1].lat).toBeCloseTo(46.0);
  });

  it('same species, same exact coordinates, different dates → one pin with all finds', () => {
    const finds = [
      mk(1, 45.1, 15.2, { species: 'Cantharellus cibarius', date: '2026-04-01' }),
      mk(2, 45.1, 15.2, { species: 'Cantharellus cibarius', date: '2026-05-15' }),
      mk(3, 45.1, 15.2, { species: 'Cantharellus cibarius', date: '2026-06-30' }),
    ];
    const groups = groupFindsByCoords(finds);
    expect(groups).toHaveLength(1);
    expect(groups[0].finds).toHaveLength(3);
    expect(groups[0].finds.map((f) => f.id)).toEqual([1, 2, 3]);
  });

  it('same species, different coordinates → separate pins', () => {
    const finds = [
      mk(1, 45.1, 15.2, { species: 'Cantharellus cibarius' }),
      mk(2, 46.5, 16.8, { species: 'Cantharellus cibarius' }),
    ];
    const groups = groupFindsByCoords(finds);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.finds.length === 1)).toBe(true);
  });

  it('grouped pin sits at exact coordinates of the finds, not an averaged midpoint', () => {
    const sp = { species: 'Boletus edulis' };
    const finds = [mk(1, 45.123456, 15.654321, sp), mk(2, 45.123456, 15.654321, sp)];
    const groups = groupFindsByCoords(finds);
    expect(groups).toHaveLength(1);
    expect(groups[0].lat).toBe(45.123456);
    expect(groups[0].lng).toBe(15.654321);
  });
});
