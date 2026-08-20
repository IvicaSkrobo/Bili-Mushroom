import { useQuery } from '@tanstack/react-query';
import { getPhotoThumbnailPath, resolvePhotoSrc } from '@/lib/photoSrc';
import { useAppStore } from '@/stores/appStore';

export function usePhotoThumbnailSrc(photoPath: string | null | undefined, size = 256): string | null {
  return usePhotoThumbnail(photoPath, size).src;
}

export function usePhotoThumbnail(photoPath: string | null | undefined, size = 256) {
  const storagePath = useAppStore((s) => s.storagePath);
  const photoAssetVersion = useAppStore((s) => s.photoAssetVersion);

  const { data: thumbnailPath, isLoading, isError } = useQuery({
    queryKey: ['photo-thumbnail', storagePath, photoPath, size, photoAssetVersion],
    queryFn: () => getPhotoThumbnailPath(storagePath!, photoPath!, size),
    enabled: !!storagePath && !!photoPath,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });

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
