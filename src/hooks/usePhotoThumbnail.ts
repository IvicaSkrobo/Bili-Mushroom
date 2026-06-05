import { useQuery } from '@tanstack/react-query';
import { getPhotoThumbnailPath, resolvePhotoSrc } from '@/lib/photoSrc';
import { useAppStore } from '@/stores/appStore';

export function usePhotoThumbnailSrc(photoPath: string | null | undefined, size = 256): string | null {
  const storagePath = useAppStore((s) => s.storagePath);
  const photoAssetVersion = useAppStore((s) => s.photoAssetVersion);
  const fallbackSrc = storagePath && photoPath
    ? resolvePhotoSrc(storagePath, photoPath, photoAssetVersion)
    : null;

  const { data: thumbnailPath } = useQuery({
    queryKey: ['photo-thumbnail', storagePath, photoPath, size, photoAssetVersion],
    queryFn: () => getPhotoThumbnailPath(storagePath!, photoPath!, size),
    enabled: !!storagePath && !!photoPath,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });

  if (!storagePath || !thumbnailPath) return fallbackSrc;
  return resolvePhotoSrc(storagePath, thumbnailPath, photoAssetVersion);
}
