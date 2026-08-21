import { invoke } from '@tauri-apps/api/core';

interface RustLibraryStorageStats {
  database_bytes: number;
  thumbnail_cache_bytes: number;
  thumbnail_count: number;
  backup_bytes: number;
  backup_count: number;
}

export interface LibraryStorageStats {
  databaseBytes: number;
  thumbnailCacheBytes: number;
  thumbnailCount: number;
  backupBytes: number;
  backupCount: number;
}

export async function getLibraryStorageStats(storagePath: string): Promise<LibraryStorageStats> {
  const raw = await invoke<RustLibraryStorageStats>('get_library_storage_stats', { storagePath });
  return {
    databaseBytes: raw.database_bytes,
    thumbnailCacheBytes: raw.thumbnail_cache_bytes,
    thumbnailCount: raw.thumbnail_count,
    backupBytes: raw.backup_bytes,
    backupCount: raw.backup_count,
  };
}

export async function openLibraryBackupsFolder(storagePath: string): Promise<void> {
  await invoke('open_library_backups_folder', { storagePath });
}

export function formatStorageBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const megabytes = bytes / (1024 * 1024);
  if (megabytes < 1) return '< 1 MB';
  if (megabytes < 10) return `${megabytes.toFixed(1)} MB`;
  if (megabytes < 1024) return `${Math.round(megabytes)} MB`;
  return `${(megabytes / 1024).toFixed(1)} GB`;
}
