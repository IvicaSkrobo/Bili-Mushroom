import { convertFileSrc } from '@tauri-apps/api/core';
import { invoke } from '@tauri-apps/api/core';

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

function hasWindowsDrive(path: string): boolean {
  return /^[A-Za-z]:\//.test(path);
}

function isAbsolutePath(path: string, storagePath: string): boolean {
  if (hasWindowsDrive(path) || path.startsWith('//')) {
    return true;
  }

  if (path.startsWith('/')) {
    return !hasWindowsDrive(storagePath);
  }

  return false;
}

export function resolvePhotoAbsolutePath(storagePath: string, photoPath: string): string {
  const normalizedStoragePath = normalizePath(storagePath).replace(/\/+$/, '');
  const normalizedPhotoPath = normalizePath(photoPath);
  if (isAbsolutePath(normalizedPhotoPath, normalizedStoragePath)) {
    return normalizedPhotoPath;
  }

  const normalizedRelativePath = normalizedPhotoPath.replace(/^\/+/, '');
  return `${normalizedStoragePath}/${normalizedRelativePath}`;
}

export function resolvePhotoSrc(storagePath: string, photoPath: string, cacheVersion?: number): string {
  const src = convertFileSrc(resolvePhotoAbsolutePath(storagePath, photoPath));
  if (cacheVersion == null || cacheVersion <= 0) return src;
  return `${src}${src.includes('?') ? '&' : '?'}v=${cacheVersion}`;
}

export async function getPhotoThumbnailPath(
  storagePath: string,
  photoPath: string,
  size = 256,
): Promise<string> {
  return invoke<string>('get_photo_thumbnail', { storagePath, photoPath, size });
}

export interface ThumbnailWarmupSummary {
  processed: number;
  failed: number;
}

export async function warmPhotoThumbnailCache(
  storagePath: string,
  size = 256,
  limit = 40,
): Promise<ThumbnailWarmupSummary> {
  return invoke<ThumbnailWarmupSummary>('warm_photo_thumbnail_cache', { storagePath, size, limit });
}
