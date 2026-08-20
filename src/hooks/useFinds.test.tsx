import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import {
  useFinds,
  useFindLocations,
  useSetFindFavorite,
  useSpeciesNote,
  useSpeciesOptions,
  useSpeciesProfile,
  useSpeciesProfileSummaries,
  useSpeciesRecipesForSpecies,
  useUpdateFind,
} from './useFinds';
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

describe('useFindLocations', () => {
  it('loads the lightweight location list without requiring full find records', async () => {
    useAppStore.setState({ storagePath: '/storage/test', dbReady: true });
    invokeHandlers['get_find_locations'] = () => ['Gorski kotar', 'Ucka'];
    const qc = makeQueryClient();
    const wrapper = makeWrapper(qc);

    const { result } = renderHook(() => useFindLocations(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(['Gorski kotar', 'Ucka']);
  });
});

describe('useSpeciesOptions', () => {
  it('loads the species autocomplete without reading any find records', async () => {
    useAppStore.setState({ storagePath: '/storage/test', dbReady: true });
    const findsSpy = vi.fn(() => []);
    invokeHandlers['get_finds'] = findsSpy;
    invokeHandlers['get_species_options'] = () => [
      { species_name: 'Amanita muscaria', common_name: null, synonyms: [], other_names: [], has_finds: true, has_profile: false },
      {
        species_name: 'Boletus edulis',
        common_name: 'Vrganj',
        synonyms: ['Boletus reticulatus'],
        other_names: ['pravi vrganj'],
        has_finds: false,
        has_profile: true,
      },
    ];
    const qc = makeQueryClient();
    const wrapper = makeWrapper(qc);

    const { result } = renderHook(() => useSpeciesOptions(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.map((option) => option.species_name)).toEqual([
      'Amanita muscaria',
      'Boletus edulis',
    ]);
    expect(result.current.data?.[1].common_name).toBe('Vrganj');
    expect(result.current.data?.[1].has_finds).toBe(false);
    expect(result.current.data?.[1].has_profile).toBe(true);
    expect(result.current.data?.[0].has_profile).toBe(false);
    // The point of the command: the autocomplete must not pull the library with it.
    expect(findsSpy).not.toHaveBeenCalled();
  });
});

describe('lazy species detail queries', () => {
  beforeEach(() => {
    useAppStore.setState({ storagePath: '/storage/test', dbReady: true });
  });

  it('loads lightweight summaries separately from one selected species detail', async () => {
    invokeHandlers['get_species_profile_summaries'] = () => [{
      species_name: 'Boletus edulis',
      common_name: 'Porcini',
      cover_photo_id: 7,
      tags: [],
      edibility: 'edible',
      threat_status: null,
      distribution: 'common',
    }];
    invokeHandlers['get_species_profile'] = (args: unknown) => ({
      species_name: (args as { speciesName: string }).speciesName,
      common_name: 'Porcini',
      cover_photo_id: 7,
      tags: [],
      description: 'Long detail loaded on demand',
    });
    const qc = makeQueryClient();
    const wrapper = makeWrapper(qc);
    const summaries = renderHook(() => useSpeciesProfileSummaries(), { wrapper });
    const detail = renderHook(() => useSpeciesProfile('Boletus edulis'), { wrapper });

    await waitFor(() => expect(summaries.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(detail.result.current.isSuccess).toBe(true));
    expect(summaries.result.current.data?.[0].cover_photo_id).toBe(7);
    expect(detail.result.current.data?.description).toBe('Long detail loaded on demand');
  });

  it('loads note and recipes only for the selected species', async () => {
    invokeHandlers['get_species_note'] = (args: unknown) => ({
      species_name: (args as { speciesName: string }).speciesName,
      notes: 'Selected note',
    });
    invokeHandlers['get_species_recipes_for_species'] = (args: unknown) => [{
      id: 1,
      species_name: (args as { speciesName: string }).speciesName,
      title: 'Risotto',
      notes: '',
      created_at: '',
      updated_at: '',
    }];
    const qc = makeQueryClient();
    const wrapper = makeWrapper(qc);
    const note = renderHook(() => useSpeciesNote('Boletus edulis'), { wrapper });
    const recipes = renderHook(() => useSpeciesRecipesForSpecies('Boletus edulis'), { wrapper });

    await waitFor(() => expect(note.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(recipes.result.current.isSuccess).toBe(true));
    expect(note.result.current.data?.species_name).toBe('Boletus edulis');
    expect(recipes.result.current.data?.[0].species_name).toBe('Boletus edulis');
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
