import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const setActiveTab = vi.fn();
const setSelectedCollectionSpecies = vi.fn();
const mutateSpeciesProfile = vi.fn();
const fetchNextSpeciesFolderPage = vi.fn();
const fetchNextSelectedFindPage = vi.fn();
const emptyMutate = vi.fn();
const mockUseFindPhotos = vi.fn();
const mockLightboxProps = vi.fn();

const boletusFinds = [
  {
    id: 1,
    original_filename: 'a.jpg',
    species_name: 'Boletus edulis',
    date_found: '2026-10-12',
    country: 'Croatia',
    region: 'Gorski Kotar',
    location_note: 'Near old oak',
    lat: 45.3,
    lng: 14.8,
    notes: 'Strong flush',
    observed_count: 12,
    observed_count_min: 12,
    observed_count_max: 12,
    is_favorite: false,
    created_at: '2026-10-12T10:00:00Z',
    photos: [{ id: 1, find_id: 1, photo_path: 'Boletus/hero.jpg', is_primary: true }],
  },
  {
    id: 2,
    original_filename: 'b.jpg',
    species_name: 'Boletus edulis',
    date_found: '2025-09-28',
    country: 'Croatia',
    region: 'Gorski Kotar',
    location_note: 'Near old oak',
    lat: 45.3,
    lng: 14.8,
    notes: '',
    observed_count: null,
    observed_count_min: null,
    observed_count_max: null,
    is_favorite: true,
    created_at: '2025-09-28T10:00:00Z',
    photos: [{ id: 3, find_id: 2, photo_path: 'Boletus/older.jpg', is_primary: true }],
  },
];

const collectionFolderPages = [[
  {
    species_name: 'Boletus edulis',
    find_count: 2,
    photo_count: 3,
    favorite_count: 1,
    latest_date: '2026-10-12',
    representative_find: boletusFinds[0],
  },
  {
    species_name: 'Cantharellus cibarius',
    find_count: 1,
    photo_count: 0,
    favorite_count: 0,
    latest_date: '2026-07-03',
    representative_find: {
      id: 3,
      original_filename: 'c.jpg',
      species_name: 'Cantharellus cibarius',
      date_found: '2026-07-03',
      country: 'Croatia',
      region: 'Istria',
      location_note: 'Mossy slope',
      lat: 45.2,
      lng: 13.9,
      notes: '',
      observed_count: 7,
      observed_count_min: 7,
      observed_count_max: 7,
      is_favorite: false,
      created_at: '2026-07-03T10:00:00Z',
      photos: [],
    },
  },
]];

const allBoletusPhotoFinds = [
  {
    ...boletusFinds[0],
    photos: [
      { id: 1, find_id: 1, photo_path: 'Boletus/hero.jpg', is_primary: true },
      { id: 2, find_id: 1, photo_path: 'Boletus/alt.jpg', is_primary: false },
    ],
  },
];

const liveBoletusPhotos = [
  { id: 1, find_id: 1, photo_path: 'Boletus/hero.jpg', is_primary: true },
  { id: 2, find_id: 1, photo_path: 'Boletus/alt.jpg', is_primary: false },
  { id: 4, find_id: 1, photo_path: 'Boletus/detail.jpg', is_primary: false },
];

const speciesNotes = [
  { species_name: 'Boletus edulis', notes: 'Best after steady rain.' },
];

const speciesProfiles = [
  {
    species_name: 'Boletus edulis',
    common_name: 'Penny bun',
    cover_photo_id: 2,
    tags: ['confirmed', 'oak'],
    edibility: 'edible',
    threat_status: 'least-concern',
    distribution: 'widespread',
    edibility_note: 'Cook before eating.',
    synonyms: ['Boletus bulbosus'],
    other_names: ['Porcino'],
    fruiting_body_count_override: '12',
    description: 'A sturdy bolete.',
    habitat: 'Oak and beech woods.',
  },
];

const speciesRecipes: Array<{ id: number; species_name: string; title: string; notes: string; created_at: string; updated_at: string }> = [];

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
}));

vi.mock('@/hooks/usePhotoThumbnail', () => ({
  usePhotoThumbnailSrc: (photoPath: string | null | undefined) => (
    photoPath ? `asset://localhost/${photoPath}` : null
  ),
}));

vi.mock('@/hooks/useFinds', () => ({
  useFinds: () => ({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
  }),
  useInfiniteCollectionFolders: () => ({
    data: { pages: collectionFolderPages },
    isLoading: false,
    isError: false,
    error: null,
    fetchNextPage: fetchNextSpeciesFolderPage,
    hasNextPage: false,
    isFetchingNextPage: false,
  }),
  useInfiniteSpeciesFinds: (speciesName: string | null) => ({
    data: { pages: [speciesName === 'Cantharellus cibarius' ? [collectionFolderPages[0][1].representative_find] : boletusFinds] },
    fetchNextPage: fetchNextSelectedFindPage,
    hasNextPage: false,
    isFetchingNextPage: false,
  }),
  useFindPhotos: (findId: number, enabled: boolean) => {
    mockUseFindPhotos(findId, enabled);
    return { data: enabled && findId === 1 ? liveBoletusPhotos : undefined };
  },
  useSpeciesFinds: () => ({
    data: allBoletusPhotoFinds,
    isLoading: false,
    isError: false,
    error: null,
  }),
  useSpeciesNote: () => ({
    data: speciesNotes[0],
  }),
  useUpsertSpeciesNote: () => ({
    mutate: emptyMutate,
    mutateAsync: emptyMutate,
    isPending: false,
  }),
  useSpeciesProfileSummaries: () => ({
    data: speciesProfiles,
  }),
  useSpeciesProfile: () => ({
    data: speciesProfiles[0],
  }),
  useSpeciesRecipesForSpecies: () => ({
    data: speciesRecipes,
  }),
  useUpsertSpeciesProfile: () => ({
    mutate: mutateSpeciesProfile,
    isPending: false,
  }),
  useUpsertSpeciesRecipe: () => ({
    mutate: emptyMutate,
    isPending: false,
  }),
  useDeleteSpeciesRecipe: () => ({
    mutate: emptyMutate,
    isPending: false,
  }),
  useUpdateFind: () => ({
    mutate: emptyMutate,
    mutateAsync: emptyMutate,
    isPending: false,
  }),
  useAddFindPhotos: () => ({
    mutate: emptyMutate,
    isPending: false,
  }),
  useDeleteFindPhoto: () => ({
    mutate: emptyMutate,
    isPending: false,
  }),
  useBulkDeleteFindPhotos: () => ({
    mutate: emptyMutate,
    isPending: false,
  }),
}));

vi.mock('@/components/finds/PhotoLightbox', () => ({
  PhotoLightbox: (props: {
    open: boolean;
    photos: Array<{ photo: { id: number; find_id: number }; find: { id: number; photos: unknown[] } }>;
    fallbackFind: { id: number; photos: unknown[] } | null;
    currentIndex: number;
  }) => {
    mockLightboxProps(props);
    return props.open ? <div data-testid="photo-lightbox">{props.photos.map((entry) => entry.photo.id).join(',')}</div> : null;
  },
}));

vi.mock('@/components/finds/EditFindDialog', () => ({
  EditFindDialog: () => null,
}));

vi.mock('@/stores/appStore', () => ({
  useAppStore: (selector: (state: {
    language: 'en';
    storagePath: string;
    setActiveTab: typeof setActiveTab;
    setSelectedCollectionSpecies: typeof setSelectedCollectionSpecies;
  }) => unknown) => selector({
    language: 'en',
    storagePath: '/test-library',
    setActiveTab,
    setSelectedCollectionSpecies,
  }),
}));

import SpeciesTab from './SpeciesTab';

describe('SpeciesTab', () => {
  beforeEach(() => {
    mutateSpeciesProfile.mockClear();
    mockUseFindPhotos.mockClear();
    mockLightboxProps.mockClear();
  });

  it('renders searchable species list and selected journal details', () => {
    render(<SpeciesTab />);

    expect(screen.getByPlaceholderText(/search species/i)).toBeInTheDocument();
    expect(screen.getAllByText('Boletus edulis').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cantharellus cibarius').length).toBeGreaterThan(0);
    expect(screen.getByText(/best after steady rain/i)).toBeInTheDocument();
    expect(screen.getAllByText(/favorites 1/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/you find it most often in september/i)).toBeInTheDocument();
    expect(screen.getByText(/you last recorded it on oct 12, 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/favorites at that spot: 1/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /remove tag/i })).toHaveLength(2);
    expect(screen.getByRole('button', { name: /edit cover photo/i })).toBeInTheDocument();
  });

  it('filters the species list from search input', () => {
    render(<SpeciesTab />);

    fireEvent.change(screen.getByPlaceholderText(/search species/i), {
      target: { value: 'canth' },
    });

    expect(screen.getAllByText('Cantharellus cibarius').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Boletus edulis')).toHaveLength(0);
  });

  it('searches scientific names by default and includes aliases only when requested', () => {
    render(<SpeciesTab />);
    const search = screen.getByPlaceholderText(/search species/i);
    const searchAllNames = screen.getByRole('checkbox', { name: /search common names and aliases too/i });

    expect(searchAllNames).not.toBeChecked();
    fireEvent.change(search, { target: { value: 'edu' } });
    expect(screen.getAllByText('Boletus edulis').length).toBeGreaterThan(0);

    fireEvent.change(search, { target: { value: 'bun' } });
    expect(screen.queryAllByText('Boletus edulis')).toHaveLength(0);

    fireEvent.click(searchAllNames);
    for (const query of ['bun', 'bulb', 'porc']) {
      fireEvent.change(search, { target: { value: query } });
      expect(screen.getAllByText('Boletus edulis').length).toBeGreaterThan(0);
      expect(screen.queryAllByText('Cantharellus cibarius')).toHaveLength(0);
    }

    fireEvent.change(search, { target: { value: 'rci' } });
    expect(screen.queryAllByText('Boletus edulis')).toHaveLength(0);

    fireEvent.change(search, { target: { value: 'bun' } });
    fireEvent.click(searchAllNames);
    expect(screen.queryAllByText('Boletus edulis')).toHaveLength(0);
  });

  it('switches back to collection from the journal action', () => {
    setActiveTab.mockClear();
    setSelectedCollectionSpecies.mockClear();
    render(<SpeciesTab />);

    fireEvent.click(screen.getByRole('button', { name: /open in collection/i }));

    expect(setActiveTab).toHaveBeenCalledWith('collection');
    expect(setSelectedCollectionSpecies).toHaveBeenCalledWith('Boletus edulis');
  });

  it('opens the cover picker dialog from the photo action', () => {
    render(<SpeciesTab />);

    fireEvent.click(screen.getAllByRole('button', { name: /edit cover photo/i })[0]);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/choose a photo from the collection/i)).toBeInTheDocument();
  });

  it('renders selected species journal actions', () => {
    render(<SpeciesTab />);

    expect(screen.getByRole('button', { name: /open in collection/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit cover photo/i })).toBeInTheDocument();
  });

  it('loads and opens every photo only for the clicked find', async () => {
    render(<SpeciesTab />);

    fireEvent.click(screen.getByRole('button', { name: /^finds \d+$/i }));
    fireEvent.click(screen.getByRole('button', { name: /show photos: oct 12, 2026/i }));

    await waitFor(() => expect(mockUseFindPhotos).toHaveBeenCalledWith(1, true));
    await waitFor(() => expect(screen.getByTestId('photo-lightbox')).toHaveTextContent('1,2,4'));

    const props = mockLightboxProps.mock.calls.at(-1)?.[0];
    expect(props.currentIndex).toBe(0);
    expect(props.photos.map((entry: { photo: { find_id: number } }) => entry.photo.find_id)).toEqual([1, 1, 1]);
    expect(props.photos.every((entry: { find: { id: number; photos: unknown[] } }) => entry.find.id === 1 && entry.find.photos.length === 3)).toBe(true);
  });

  it('opens a photo-free find without enabling the full photo query', async () => {
    render(<SpeciesTab />);

    fireEvent.click(screen.getAllByText('Cantharellus cibarius')[0]);
    fireEvent.click(screen.getByRole('button', { name: /^finds \d+$/i }));
    fireEvent.click(screen.getByRole('button', { name: /show photos: jul 3, 2026/i }));

    await waitFor(() => expect(screen.getByTestId('photo-lightbox')).toBeInTheDocument());
    expect(mockUseFindPhotos).not.toHaveBeenCalledWith(3, true);
    const props = mockLightboxProps.mock.calls.at(-1)?.[0];
    expect(props.photos).toEqual([]);
    expect(props.fallbackFind.id).toBe(3);
  });

  it('adds another name without changing synonyms or other profile fields', () => {
    render(<SpeciesTab />);

    fireEvent.click(screen.getByRole('button', { name: /^description$/i }));
    const input = screen.getByPlaceholderText(/add other name/i);
    fireEvent.change(input, { target: { value: '  King bolete  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mutateSpeciesProfile).toHaveBeenCalledWith(expect.objectContaining({
      speciesName: 'Boletus edulis',
      tags: ['confirmed', 'oak'],
      synonyms: ['Boletus bulbosus'],
      otherNames: ['Porcino', 'King bolete'],
      edibility: 'edible',
      threatStatus: 'least-concern',
      distribution: 'widespread',
      description: 'A sturdy bolete.',
      habitat: 'Oak and beech woods.',
    }));
  });

  it('removes only the selected other name and rejects blank or duplicate additions', () => {
    render(<SpeciesTab />);

    fireEvent.click(screen.getByRole('button', { name: /^description$/i }));
    const input = screen.getByPlaceholderText(/add other name/i);
    fireEvent.change(input, { target: { value: 'Porcino' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: ',' });
    expect(mutateSpeciesProfile).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /remove other name porcino/i }));
    expect(mutateSpeciesProfile).toHaveBeenCalledWith(expect.objectContaining({
      synonyms: ['Boletus bulbosus'],
      otherNames: [],
      tags: ['confirmed', 'oak'],
      description: 'A sturdy bolete.',
    }));
  });
});
