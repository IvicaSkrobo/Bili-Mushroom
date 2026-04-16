import { invoke } from '@tauri-apps/api/core';

export interface TileCacheStats {
  sizeBytes: number;
  tileCount: number;
}

interface RustTileCacheStats {
  size_bytes: number;
  tile_count: number;
}

export async function getTileCacheStats(): Promise<TileCacheStats> {
  const raw = await invoke<RustTileCacheStats>('get_tile_cache_stats');
  return { sizeBytes: raw.size_bytes, tileCount: raw.tile_count };
}

export async function clearTileCache(storagePath?: string | null): Promise<void> {
  await invoke('clear_tile_cache', {
    storagePath: storagePath ?? null,
  });
}

export function formatMb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 MB';
  const mb = Math.round(bytes / (1024 * 1024));
  return `${mb} MB`;
}
