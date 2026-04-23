import { convertFileSrc } from '@tauri-apps/api/core';

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

export function resolvePhotoSrc(storagePath: string, photoPath: string): string {
  return convertFileSrc(resolvePhotoAbsolutePath(storagePath, photoPath));
}
