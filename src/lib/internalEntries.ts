const INTERNAL_LIBRARY_NAMES = new Set([
  'tile-cache',
  '.bili-cache',
  '.bili-cache-tiles',
]);

export function isInternalLibraryName(name: string | null | undefined): boolean {
  if (!name) return false;
  return INTERNAL_LIBRARY_NAMES.has(name.trim().toLowerCase());
}
