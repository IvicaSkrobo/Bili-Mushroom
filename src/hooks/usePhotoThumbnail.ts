import { useEffect } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { getPhotoThumbnailPath, resolvePhotoSrc } from '@/lib/photoSrc';
import { useAppStore } from '@/stores/appStore';

export const MAX_CACHED_THUMBNAIL_QUERIES = 1_000;
const THUMBNAIL_QUERY_GC_MS = 5 * 60 * 1_000;

/**
 * Bounds the bookkeeping retained by TanStack Query while preserving everything that
 * is currently visible. Thumbnail files themselves remain in the Rust disk cache, so a
 * pruned entry only needs a cheap path lookup if the user scrolls back much later.
 */
export function pruneInactiveThumbnailQueries(
  queryClient: QueryClient,
  maxQueries = MAX_CACHED_THUMBNAIL_QUERIES,
): void {
  const thumbnailQueries = queryClient.getQueryCache().findAll({
    queryKey: ['photo-thumbnail'],
  });
  const excess = thumbnailQueries.length - Math.max(0, maxQueries);
  if (excess <= 0) return;

  const oldestInactive = thumbnailQueries
    .filter((query) => query.getObserversCount() === 0)
    .sort((a, b) => a.state.dataUpdatedAt - b.state.dataUpdatedAt)
    .slice(0, excess);
  const queryCache = queryClient.getQueryCache();
  for (const query of oldestInactive) queryCache.remove(query);
}

export function usePhotoThumbnailSrc(photoPath: string | null | undefined, size = 256): string | null {
  return usePhotoThumbnail(photoPath, size).src;
}

export function usePhotoThumbnail(photoPath: string | null | undefined, size = 256) {
  const queryClient = useQueryClient();
  const storagePath = useAppStore((s) => s.storagePath);
  const photoAssetVersion = useAppStore((s) => s.photoAssetVersion);

  const { data: thumbnailPath, isLoading, isError } = useQuery({
    queryKey: ['photo-thumbnail', storagePath, photoPath, size, photoAssetVersion],
    queryFn: () => getPhotoThumbnailPath(storagePath!, photoPath!, size),
    enabled: !!storagePath && !!photoPath,
    staleTime: Infinity,
    gcTime: THUMBNAIL_QUERY_GC_MS,
    retry: false,
  });

  useEffect(() => {
    if (thumbnailPath) pruneInactiveThumbnailQueries(queryClient);
  }, [queryClient, thumbnailPath]);

  // Thumbnail surfaces must never briefly load the full-resolution original while
  // the Rust worker is generating a cached image. On large libraries that fallback
  // caused WebView2 to decode and retain many originals during ordinary scrolling.
  return {
    src: storagePath && thumbnailPath
      ? resolvePhotoSrc(storagePath, thumbnailPath, photoAssetVersion)
      : null,
    isLoading,
    isError,
  };
}
