import { describe, expect, it } from 'vitest';
import { boundsForSelectedSpecies, combineMapBounds } from './mapViewport';
import type { MapMetadata } from './finds';

const metadata: MapMetadata = {
  total_points: 7,
  bounds: { south: 42, west: 13, north: 47, east: 19 },
  species: [
    {
      species_name: 'Boletus edulis',
      point_count: 3,
      bounds: { south: 44, west: 14, north: 46, east: 16 },
    },
    {
      species_name: 'Amanita muscaria',
      point_count: 4,
      bounds: { south: 42, west: 13, north: 47, east: 19 },
    },
  ],
};

describe('map viewport bounds', () => {
  it('combines selected species without needing every map point', () => {
    expect(combineMapBounds(metadata.species.map((summary) => summary.bounds))).toEqual(metadata.bounds);
  });

  it('returns global bounds when no species filter is active', () => {
    expect(boundsForSelectedSpecies(metadata, new Set())).toEqual(metadata.bounds);
  });

  it('returns only the selected species bounds for fit-to-pins', () => {
    expect(boundsForSelectedSpecies(metadata, new Set(['Boletus edulis']))).toEqual(
      metadata.species[0].bounds,
    );
  });

  it('returns null for a selection with no mapped finds', () => {
    expect(boundsForSelectedSpecies(metadata, new Set(['Unknown species']))).toBeNull();
  });
});
