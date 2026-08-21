import type { MapBounds, MapMetadata } from './finds';

export function combineMapBounds(bounds: MapBounds[]): MapBounds | null {
  if (bounds.length === 0) return null;
  return bounds.slice(1).reduce((combined, next) => ({
    south: Math.min(combined.south, next.south),
    west: Math.min(combined.west, next.west),
    north: Math.max(combined.north, next.north),
    east: Math.max(combined.east, next.east),
  }), bounds[0]);
}

export function boundsForSelectedSpecies(
  metadata: MapMetadata | undefined,
  selectedSpecies: Set<string>,
): MapBounds | null {
  if (!metadata) return null;
  if (selectedSpecies.size === 0) return metadata.bounds;
  return combineMapBounds(
    metadata.species
      .filter((summary) => selectedSpecies.has(summary.species_name))
      .map((summary) => summary.bounds),
  );
}
