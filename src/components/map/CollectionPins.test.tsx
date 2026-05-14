import { describe, it, expect } from 'vitest';
import { locationGroupsFromFinds, LABEL_ZOOM_THRESHOLD } from './CollectionPins';
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

function speciesNames(groups: ReturnType<typeof locationGroupsFromFinds>): string[][] {
  return groups.map((g) => g.species.map((s) => s.name).sort());
}

describe('locationGroupsFromFinds', () => {
  it('same species, two different locations → two LocationGroups', () => {
    const finds = [
      makeFind({ id: 1, species_name: 'Cantharellus cibarius', lat: 45.1, lng: 15.2 }),
      makeFind({ id: 2, species_name: 'Cantharellus cibarius', lat: 46.5, lng: 16.8 }),
    ];
    const result = locationGroupsFromFinds(finds);
    expect(result).toHaveLength(2);
    // Each group has one species entry with one find
    expect(result.every((g) => g.species.length === 1)).toBe(true);
    expect(result.every((g) => g.species[0].finds.length === 1)).toBe(true);
  });

  it('same species, two finds at same location → one LocationGroup with one SpeciesEntry with 2 finds', () => {
    const finds = [
      makeFind({ id: 1, species_name: 'Boletus edulis', lat: 45.1, lng: 15.2 }),
      makeFind({ id: 2, species_name: 'Boletus edulis', lat: 45.1, lng: 15.2 }),
    ];
    const result = locationGroupsFromFinds(finds);
    expect(result).toHaveLength(1);
    expect(result[0].species).toHaveLength(1);
    expect(result[0].species[0].name).toBe('Boletus edulis');
    expect(result[0].species[0].finds).toHaveLength(2);
  });

  it('two different species at same location → ONE LocationGroup with two SpeciesEntries', () => {
    const finds = [
      makeFind({ id: 1, species_name: 'Cantharellus cibarius', lat: 45.1, lng: 15.2 }),
      makeFind({ id: 2, species_name: 'Boletus edulis', lat: 45.1, lng: 15.2 }),
    ];
    const result = locationGroupsFromFinds(finds);
    expect(result).toHaveLength(1);
    expect(result[0].species).toHaveLength(2);
    const names = result[0].species.map((s) => s.name).sort();
    expect(names).toEqual(['Boletus edulis', 'Cantharellus cibarius']);
  });

  it('three finds — two share coords, one elsewhere → two LocationGroups', () => {
    const finds = [
      makeFind({ id: 1, species_name: 'Boletus edulis', lat: 45.1, lng: 15.2 }),
      makeFind({ id: 2, species_name: 'Boletus edulis', lat: 45.1, lng: 15.2 }),
      makeFind({ id: 3, species_name: 'Boletus edulis', lat: 46.5, lng: 16.8 }),
    ];
    const result = locationGroupsFromFinds(finds);
    expect(result).toHaveLength(2);
    const findCounts = result.map((g) => g.species[0].finds.length).sort((a, b) => b - a);
    expect(findCounts[0]).toBe(2);
    expect(findCounts[1]).toBe(1);
  });

  it('label text: single species plain name → label equals that name', () => {
    const finds = [
      makeFind({ id: 1, species_name: 'Cantharellus cibarius', lat: 45.1, lng: 15.2 }),
    ];
    const result = locationGroupsFromFinds(finds);
    expect(result).toHaveLength(1);
    expect(result[0].labelText).toBe('Cantharellus cibarius');
  });

  it('label text: single species with asterisk markers → asterisks stripped by plainSpeciesName', () => {
    const finds = [
      makeFind({ id: 1, species_name: 'Boletus *edulis*', lat: 45.1, lng: 15.2 }),
    ];
    const result = locationGroupsFromFinds(finds);
    expect(result).toHaveLength(1);
    // plainSpeciesName strips asterisks, rawToLabelHtml wraps italic word in span
    expect(result[0].labelText).toContain('edulis');
    expect(result[0].labelText).not.toContain('*');
  });

  it('label text: multiple species → "N species"', () => {
    const finds = [
      makeFind({ id: 1, species_name: 'Cantharellus cibarius', lat: 45.1, lng: 15.2 }),
      makeFind({ id: 2, species_name: 'Boletus edulis', lat: 45.1, lng: 15.2 }),
      makeFind({ id: 3, species_name: 'Amanita muscaria', lat: 45.1, lng: 15.2 }),
    ];
    const result = locationGroupsFromFinds(finds);
    expect(result).toHaveLength(1);
    expect(result[0].labelText).toBe('3 species');
  });

  it('label text: two species at one location → "2 species"', () => {
    const finds = [
      makeFind({ id: 1, species_name: 'Cantharellus cibarius', lat: 45.1, lng: 15.2 }),
      makeFind({ id: 2, species_name: 'Boletus edulis', lat: 45.1, lng: 15.2 }),
    ];
    const result = locationGroupsFromFinds(finds);
    expect(result[0].labelText).toBe('2 species');
  });

  it('suppressLabel is always false', () => {
    const finds = [
      makeFind({ id: 1, species_name: 'Cantharellus cibarius', lat: 45.1, lng: 15.2 }),
      makeFind({ id: 2, species_name: 'Boletus edulis', lat: 45.1, lng: 15.2 }),
      makeFind({ id: 3, species_name: 'Amanita muscaria', lat: 46.0, lng: 16.0 }),
    ];
    const result = locationGroupsFromFinds(finds);
    expect(result.every((g) => g.suppressLabel === false)).toBe(true);
  });

  it('finds with null coords are excluded', () => {
    const finds = [
      makeFind({ id: 1, species_name: 'Boletus edulis', lat: 45.1, lng: 15.2 }),
      { id: 2, species_name: 'Boletus edulis', lat: null, lng: null, photos: [], notes: null, date: null, location_name: null } as unknown as Find,
    ];
    const result = locationGroupsFromFinds(finds);
    expect(result).toHaveLength(1);
    expect(result[0].species[0].finds).toHaveLength(1);
  });

  it('key is the coordKey of the location', () => {
    const finds = [
      makeFind({ id: 1, species_name: 'Boletus edulis', lat: 45.1, lng: 15.2 }),
    ];
    const result = locationGroupsFromFinds(finds);
    expect(result[0].key).toBe('45.1,15.2');
  });

  it('two locations produce groups with distinct keys', () => {
    const finds = [
      makeFind({ id: 1, species_name: 'Boletus edulis', lat: 45.1, lng: 15.2 }),
      makeFind({ id: 2, species_name: 'Boletus edulis', lat: 46.5, lng: 16.8 }),
    ];
    const result = locationGroupsFromFinds(finds);
    const keys = result.map((g) => g.key);
    expect(new Set(keys).size).toBe(2);
  });

  it('nearby but non-identical coords produce separate groups', () => {
    const epsilon = 0.0001;
    const finds = [
      makeFind({ id: 1, species_name: 'Amanita muscaria', lat: 45.1, lng: 15.2 }),
      makeFind({ id: 2, species_name: 'Amanita muscaria', lat: 45.1 + epsilon, lng: 15.2 + epsilon }),
    ];
    const result = locationGroupsFromFinds(finds);
    expect(result).toHaveLength(2);
  });

  it('species entry finds count reflects actual finds grouped', () => {
    const finds = [
      makeFind({ id: 1, species_name: 'Cantharellus cibarius', lat: 45.1, lng: 15.2 }),
      makeFind({ id: 2, species_name: 'Boletus edulis', lat: 45.1, lng: 15.2 }),
      makeFind({ id: 3, species_name: 'Boletus edulis', lat: 45.1, lng: 15.2 }),
    ];
    const result = locationGroupsFromFinds(finds);
    expect(result).toHaveLength(1);
    const boletusEntry = result[0].species.find((s) => s.name === 'Boletus edulis');
    expect(boletusEntry?.finds).toHaveLength(2);
    const cantharellusEntry = result[0].species.find((s) => s.name === 'Cantharellus cibarius');
    expect(cantharellusEntry?.finds).toHaveLength(1);
  });

  it('speciesNames helper verifies grouping structure', () => {
    const finds = [
      makeFind({ id: 1, species_name: 'Cantharellus cibarius', lat: 45.1, lng: 15.2 }),
      makeFind({ id: 2, species_name: 'Boletus edulis', lat: 45.1, lng: 15.2 }),
      makeFind({ id: 3, species_name: 'Cantharellus cibarius', lat: 46.0, lng: 16.0 }),
    ];
    const result = locationGroupsFromFinds(finds);
    expect(result).toHaveLength(2);
    // One group has both species, the other has only Cantharellus
    const sorted = speciesNames(result).sort((a, b) => b.length - a.length);
    expect(sorted[0]).toEqual(['Boletus edulis', 'Cantharellus cibarius']);
    expect(sorted[1]).toEqual(['Cantharellus cibarius']);
  });

  it('LABEL_ZOOM_THRESHOLD is exported and equals 13', () => {
    expect(LABEL_ZOOM_THRESHOLD).toBe(13);
  });
});
