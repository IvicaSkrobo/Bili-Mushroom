import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import '../../test/tauri-mocks';
import { PhotoLightbox, type LightboxPhoto } from './PhotoLightbox';
import type { Find, FindPhoto } from '@/lib/finds';

// Seed the appStore with a language + photoAssetVersion so useT/resolvePhotoSrc callers work
vi.mock('@/stores/appStore', () => ({
  useAppStore: vi.fn((selector: (s: { language: string; photoAssetVersion: number; bumpPhotoAssetVersion: () => void }) => unknown) =>
    selector({ language: 'en', photoAssetVersion: 0, bumpPhotoAssetVersion: vi.fn() }),
  ),
}));

vi.mock('@/i18n/index', () => ({
  useT: () => (key: string) => key,
}));

vi.mock('@/hooks/useFinds', () => ({
  useUpdateFind: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock('@/lib/photoSrc', () => ({
  resolvePhotoSrc: (_storagePath: string, photoPath: string) => photoPath,
}));

vi.mock('@/components/map/LocationPickerMap', () => ({
  LocationPickerMap: () => null,
}));

const findPhoto: FindPhoto = {
  id: 1,
  find_id: 1,
  photo_path: '/photos/one.jpg',
  is_primary: true,
};

const find: Find = {
  id: 1,
  original_filename: 'one.jpg',
  species_name: 'Boletus edulis',
  date_found: '2026-05-01',
  country: 'Croatia',
  region: 'Gorski kotar',
  location_note: 'Forest edge',
  lat: null,
  lng: null,
  notes: '',
  observed_count: null,
  observed_count_min: null,
  observed_count_max: null,
  is_favorite: false,
  created_at: '2026-05-01T00:00:00.000Z',
  edibility_note: null,
  photos: [findPhoto],
};

const findPhotoTwo: FindPhoto = {
  id: 2,
  find_id: 1,
  photo_path: '/photos/two.jpg',
  is_primary: false,
};

const photos: LightboxPhoto[] = [
  { photo: findPhoto, find },
  { photo: findPhotoTwo, find },
];

function renderLightbox(overrides: Partial<React.ComponentProps<typeof PhotoLightbox>> = {}) {
  const onOpenChange = vi.fn();
  const onIndexChange = vi.fn();
  const props: React.ComponentProps<typeof PhotoLightbox> = {
    open: true,
    onOpenChange,
    photos,
    currentIndex: 0,
    onIndexChange,
    storagePath: '/storage',
    ...overrides,
  };
  const utils = render(<PhotoLightbox {...props} />);
  return { ...utils, onOpenChange, onIndexChange, props };
}

function getScale(img: HTMLElement): number {
  const wrap = img.parentElement as HTMLElement;
  const scaleMatch = wrap.style.transform.match(/scale\(([\d.]+)\)/);
  expect(scaleMatch).not.toBeNull();
  return Number(scaleMatch![1]);
}

describe('PhotoLightbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resets zoom to 1 when reopened on the same photo after closing while zoomed', () => {
    const { rerender } = renderLightbox({ currentIndex: 0 });

    // Zoom in via double-click (mirrors StagedPhotoViewer test convention)
    let img = screen.getByRole('img');
    fireEvent.doubleClick(img.parentElement!.parentElement!);
    img = screen.getByRole('img');
    expect(getScale(img)).toBeCloseTo(2.5, 5);

    // Close the lightbox (component stays mounted, matching real parent usage)
    rerender(
      <PhotoLightbox
        open={false}
        onOpenChange={vi.fn()}
        photos={photos}
        currentIndex={0}
        onIndexChange={vi.fn()}
        storagePath="/storage"
      />,
    );

    // Reopen on the SAME photo/find (no change to currentIndex or find id)
    rerender(
      <PhotoLightbox
        open={true}
        onOpenChange={vi.fn()}
        photos={photos}
        currentIndex={0}
        onIndexChange={vi.fn()}
        storagePath="/storage"
      />,
    );

    img = screen.getByRole('img');
    expect(getScale(img)).toBeCloseTo(1, 5);
  });

  it('resets zoom to 1 when currentIndex changes (existing behavior, must not regress)', () => {
    const { rerender } = renderLightbox({ currentIndex: 0 });

    let img = screen.getByRole('img');
    fireEvent.doubleClick(img.parentElement!.parentElement!);
    img = screen.getByRole('img');
    expect(getScale(img)).toBeCloseTo(2.5, 5);

    rerender(
      <PhotoLightbox
        open={true}
        onOpenChange={vi.fn()}
        photos={photos}
        currentIndex={1}
        onIndexChange={vi.fn()}
        storagePath="/storage"
      />,
    );

    img = screen.getByRole('img');
    expect(getScale(img)).toBeCloseTo(1, 5);
  });
});
