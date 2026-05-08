import { describe, it, expect } from 'vitest';
import { collectionsFromFinds, SAME_LOCATION_DEG } from './CollectionPins';
import type { Find } from '@/lib/finds';

function makeFind(overrides: Partial<Find> & { id: number; species_name: string; lat: number; lng: number }): Find {
  return {
    photos: [],
    notes: null,
    date: null,
    location_name: null,
    ...overrides,
  } as unknown as Find;
}

describe('collectionsFromFinds', () => {
  it('same species, two different locations → two pins', () => {
    const finds = [
      makeFind({ id: 1, species_name: 'Cantharellus cibarius', lat: 45.1, lng: 15.2 }),
      makeFind({ id: 2, species_name: 'Cantharellus cibarius', lat: 46.5, lng: 16.8 }),
    ];
    const result = collectionsFromFinds(finds);
    expect(result).toHaveLength(2);
    // No pin at arithmetic midpoint
    const lats = result.map((c) => c.lat);
    expect(lats).not.toContain((45.1 + 46.5) / 2);
    // Each pin contains exactly one find
    expect(result.every((c) => c.count === 1)).toBe(true);
  });

  it('same species, three finds — two share coords, one elsewhere → two pins', () => {
    const finds = [
      makeFind({ id: 1, species_name: 'Boletus edulis', lat: 45.1, lng: 15.2 }),
      makeFind({ id: 2, species_name: 'Boletus edulis', lat: 45.1, lng: 15.2 }),
      makeFind({ id: 3, species_name: 'Boletus edulis', lat: 46.5, lng: 16.8 }),
    ];
    const result = collectionsFromFinds(finds);
    expect(result).toHaveLength(2);
    const byCount = result.sort((a, b) => b.count - a.count);
    expect(byCount[0].count).toBe(2);
    expect(byCount[1].count).toBe(1);
  });

  it('same species, two finds within tolerance → one shared pin', () => {
    const epsilon = SAME_LOCATION_DEG * 0.5;
    const finds = [
      makeFind({ id: 1, species_name: 'Amanita muscaria', lat: 45.1, lng: 15.2 }),
      makeFind({ id: 2, species_name: 'Amanita muscaria', lat: 45.1 + epsilon, lng: 15.2 + epsilon }),
    ];
    const result = collectionsFromFinds(finds);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(2);
    expect(result[0].finds).toHaveLength(2);
  });

  it('no pin at arithmetic midpoint of distant finds', () => {
    const lat1 = 45.0;
    const lat2 = 47.0;
    const lng1 = 14.0;
    const lng2 = 17.0;
    const finds = [
      makeFind({ id: 1, species_name: 'Macrolepiota procera', lat: lat1, lng: lng1 }),
      makeFind({ id: 2, species_name: 'Macrolepiota procera', lat: lat2, lng: lng2 }),
    ];
    const result = collectionsFromFinds(finds);
    const midLat = (lat1 + lat2) / 2;
    const midLng = (lng1 + lng2) / 2;
    expect(result.some((c) => Math.abs(c.lat - midLat) < 0.001 && Math.abs(c.lng - midLng) < 0.001)).toBe(false);
  });

  it('finds with null coords are excluded', () => {
    const finds = [
      makeFind({ id: 1, species_name: 'Boletus edulis', lat: 45.1, lng: 15.2 }),
      { id: 2, species_name: 'Boletus edulis', lat: null, lng: null, photos: [], notes: null, date: null, location_name: null } as unknown as Find,
    ];
    const result = collectionsFromFinds(finds);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(1);
  });

  it('different species at same location → separate pins', () => {
    const finds = [
      makeFind({ id: 1, species_name: 'Cantharellus cibarius', lat: 45.1, lng: 15.2 }),
      makeFind({ id: 2, species_name: 'Boletus edulis', lat: 45.1, lng: 15.2 }),
    ];
    const result = collectionsFromFinds(finds);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.name).sort()).toEqual(['Boletus edulis', 'Cantharellus cibarius']);
  });

  it('single-species single-location key equals species name', () => {
    const finds = [makeFind({ id: 1, species_name: 'Boletus edulis', lat: 45.1, lng: 15.2 })];
    const result = collectionsFromFinds(finds);
    expect(result[0].key).toBe('Boletus edulis');
  });

  it('multi-location pins get unique keys', () => {
    const finds = [
      makeFind({ id: 1, species_name: 'Boletus edulis', lat: 45.1, lng: 15.2 }),
      makeFind({ id: 2, species_name: 'Boletus edulis', lat: 46.5, lng: 16.8 }),
    ];
    const result = collectionsFromFinds(finds);
    const keys = result.map((c) => c.key);
    expect(new Set(keys).size).toBe(2);
    expect(keys.every((k) => k !== 'Boletus edulis')).toBe(true);
  });
});
