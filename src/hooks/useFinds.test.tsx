import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useFinds, useUpdateFind, useSetFindFavorite } from './useFinds';
import { invokeHandlers } from '@/test/tauri-mocks';
import { useAppStore } from '@/stores/appStore';
import type { Find, UpdateFindPayload } from '@/lib/finds';

import '@/test/tauri-mocks';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

const sampleFind: Find = {
  id: 1,
  original_filename: 'shroom.jpg',
  species_name: 'Amanita muscaria',
  date_found: '2024-05-10',
  country: 'Croatia',
  region: 'Istria',
  lat: 45.1,
  lng: 13.9,
  notes: 'Found near oak tree',
  location_note: '',
  is_favorite: false,
  created_at: '2024-05-10T14:00:00Z',
  photos: [],
};

const sampleUpdatePayload: UpdateFindPayload = {
  id: 1,
  species_name: 'Cantharellus cibarius',
  date_found: '2024-06-01',
  country: 'Slovenia',
  region: 'Triglav',
  lat: 46.3,
  lng: 14.1,
  notes: 'Updated note',
  location_note: '',
};

// ---------------------------------------------------------------------------
// useFinds
// ---------------------------------------------------------------------------

describe('useFinds', () => {
  beforeEach(() => {
    // Reset zustand store to known state
    useAppStore.setState({ storagePath: '/storage/test', dbReady: true });
    invokeHandlers['get_finds'] = () => [sampleFind];
  });

  it('starts with isLoading true and no data before query resolves', () => {
    // Make the handler block indefinitely so we can observe loading state
    invokeHandlers['get_finds'] = () => new Promise(() => {});
    const qc = makeQueryClient();
    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useFinds(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('returns Find array after query resolves', async () => {
    invokeHandlers['get_finds'] = () => [sampleFind];
    const qc = makeQueryClient();
    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useFinds(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].species_name).toBe('Amanita muscaria');
  });

  it('is disabled (not loading) when storagePath is null', () => {
    useAppStore.setState({ storagePath: null });
    const qc = makeQueryClient();
    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useFinds(), { wrapper });
    // enabled: false means fetchStatus is 'idle', not loading
    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// useUpdateFind
// ---------------------------------------------------------------------------

describe('useUpdateFind', () => {
  beforeEach(() => {
    useAppStore.setState({ storagePath: '/storage/test', dbReady: true });
    invokeHandlers['get_finds'] = () => [sampleFind];
    invokeHandlers['update_find'] = () => ({ ...sampleFind, species_name: 'Cantharellus cibarius' });
  });

  it('calls updateFind (invoke update_find) when mutate is called', async () => {
    const qc = makeQueryClient();
    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useUpdateFind(), { wrapper });

    await act(async () => {
      result.current.mutate(sampleUpdatePayload);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('invalidates [finds, storagePath] query on success', async () => {
    const qc = makeQueryClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const wrapper = makeWrapper(qc);

    const { result } = renderHook(() => useUpdateFind(), { wrapper });

    await act(async () => {
      result.current.mutate(sampleUpdatePayload);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['finds', '/storage/test'] }),
    );
  });

  it('surfaces error when mutation rejects', async () => {
    invokeHandlers['update_find'] = () => {
      throw new Error('find not found');
    };
    const qc = makeQueryClient();
    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useUpdateFind(), { wrapper });

    await act(async () => {
      result.current.mutate(sampleUpdatePayload);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useSetFindFavorite', () => {
  beforeEach(() => {
    useAppStore.setState({ storagePath: '/storage/test', dbReady: true });
    invokeHandlers['set_find_favorite'] = () => ({ ...sampleFind, is_favorite: true });
  });

  it('calls set_find_favorite and invalidates the finds query', async () => {
    const qc = makeQueryClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useSetFindFavorite(), { wrapper });

    await act(async () => {
      result.current.mutate({ findId: 1, isFavorite: true });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['finds', '/storage/test'] }),
    );
  });
});
