import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '@/stores/appStore';
import { invokeHandlers } from '@/test/tauri-mocks';
import {
  pruneInactiveThumbnailQueries,
  usePhotoThumbnailSrc,
} from './usePhotoThumbnail';

import '@/test/tauri-mocks';

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('usePhotoThumbnailSrc', () => {
  beforeEach(() => {
    useAppStore.setState({
      storagePath: '/storage/test',
      photoAssetVersion: 0,
    });
  });

  it('prunes the oldest inactive thumbnail queries but preserves active and unrelated data', () => {
    const client = new QueryClient();
    for (let index = 1; index <= 5; index += 1) {
      client.setQueryData(['photo-thumbnail', '/storage', `photo-${index}.jpg`, 256, 0], `thumb-${index}`, {
        updatedAt: index,
      });
    }
    client.setQueryData(['species-profiles', '/storage'], ['keep unrelated']);

    const activeKey = ['photo-thumbnail', '/storage', 'photo-1.jpg', 256, 0] as const;
    const observer = new QueryObserver(client, { queryKey: activeKey });
    const unsubscribe = observer.subscribe(() => undefined);

    pruneInactiveThumbnailQueries(client, 2);

    expect(client.getQueryData(activeKey)).toBe('thumb-1');
    expect(client.getQueryData(['photo-thumbnail', '/storage', 'photo-5.jpg', 256, 0])).toBe('thumb-5');
    expect(client.getQueryCache().findAll({ queryKey: ['photo-thumbnail'] })).toHaveLength(2);
    expect(client.getQueryData(['species-profiles', '/storage'])).toEqual(['keep unrelated']);

    unsubscribe();
    client.clear();
  });

  it('does not expose the full-resolution original while thumbnail generation is pending', async () => {
    let finish!: (value: string) => void;
    invokeHandlers['get_photo_thumbnail'] = () => new Promise<string>((resolve) => {
      finish = resolve;
    });

    const { result } = renderHook(
      () => usePhotoThumbnailSrc('finds/boletus/original.jpg', 256),
      { wrapper: makeWrapper() },
    );

    expect(result.current).toBeNull();
    finish('.bili-cache/thumbnails/cached_256.jpg');

    await waitFor(() => {
      expect(result.current).toContain('.bili-cache/thumbnails/cached_256.jpg');
    });
    expect(result.current).not.toContain('finds/boletus/original.jpg');
  });
});
