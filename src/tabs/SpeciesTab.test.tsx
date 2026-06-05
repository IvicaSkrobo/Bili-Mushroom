import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const setActiveTab = vi.fn();
const setSelectedCollectionSpecies = vi.fn();
const mutateSpeciesProfile = vi.fn();
const fetchNextSpeciesFolderPage = vi.fn();
const fetchNextSelectedFindPage = vi.fn();
const emptyMutate = vi.fn();

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

const speciesNotes = [
  { species_name: 'Boletus edulis', notes: 'Best after steady rain.' },
];

const speciesProfiles = [
  { species_name: 'Boletus edulis', cover_photo_id: 2, tags: ['confirmed', 'oak'] },
];

const speciesRecipes: Array<{ id: number; species_name: string; title: string; notes: string; created_at: string; updated_at: string }> = [];

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
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
  useInfiniteSpeciesFinds: () => ({
    data: { pages: [boletusFinds] },
    fetchNextPage: fetchNextSelectedFindPage,
    hasNextPage: false,
    isFetchingNextPage: false,
  }),
  useSpeciesFinds: () => ({
    data: allBoletusPhotoFinds,
    isLoading: false,
    isError: false,
    error: null,
  }),
  useSpeciesNotes: () => ({
    data: speciesNotes,
  }),
  useUpsertSpeciesNote: () => ({
    mutate: emptyMutate,
    mutateAsync: emptyMutate,
    isPending: false,
  }),
  useSpeciesProfiles: () => ({
    data: speciesProfiles,
  }),
  useSpeciesRecipes: () => ({
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
  PhotoLightbox: () => null,
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
});
