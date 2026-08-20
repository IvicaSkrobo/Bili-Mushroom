import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '@/stores/appStore';
import { invokeHandlers } from '@/test/tauri-mocks';
import { usePhotoThumbnailSrc } from './usePhotoThumbnail';

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
