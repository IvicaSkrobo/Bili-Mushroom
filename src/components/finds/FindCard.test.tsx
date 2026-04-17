import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FindCard } from './FindCard';
import type { Find } from '@/lib/finds';
import { useAppStore } from '@/stores/appStore';

import '@/test/tauri-mocks';

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
  photos: [
    { id: 1, find_id: 1, photo_path: 'Croatia/Istria/2024-05-10/Amanita_muscaria_2024-05-10_001.jpg', is_primary: true },
  ],
};

const storageRoot = '/storage/test';

describe('FindCard', () => {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const onToggleFavorite = vi.fn();

  beforeEach(() => {
    onEdit.mockClear();
    onDelete.mockClear();
    onToggleFavorite.mockClear();
    useAppStore.setState({ language: 'en' });
  });

  it('renders species name', () => {
    render(<FindCard find={sampleFind} storagePath={storageRoot} onEdit={onEdit} onDelete={onDelete} onToggleFavorite={onToggleFavorite} />);
    expect(screen.getByText('Amanita muscaria')).toBeInTheDocument();
  });

  it('renders date_found', () => {
    render(<FindCard find={sampleFind} storagePath={storageRoot} onEdit={onEdit} onDelete={onDelete} onToggleFavorite={onToggleFavorite} />);
    expect(screen.getByText('2024-05-10')).toBeInTheDocument();
  });

  it('renders country / region', () => {
    render(<FindCard find={sampleFind} storagePath={storageRoot} onEdit={onEdit} onDelete={onDelete} onToggleFavorite={onToggleFavorite} />);
    expect(screen.getByText('Croatia · Istria')).toBeInTheDocument();
  });

  it('renders an img tag with convertFileSrc path from photos[0].photo_path', () => {
    render(<FindCard find={sampleFind} storagePath={storageRoot} onEdit={onEdit} onDelete={onDelete} onToggleFavorite={onToggleFavorite} />);
    const img = screen.getByRole('img');
    // convertFileSrc mock returns `asset://localhost/${path}`
    expect(img).toHaveAttribute(
      'src',
      expect.stringContaining('Amanita_muscaria_2024-05-10_001.jpg'),
    );
  });

  it('shows placeholder and no img for HEIC files', () => {
    const heicFind: Find = {
      ...sampleFind,
      photos: [{ id: 1, find_id: 1, photo_path: 'Croatia/Istria/2024-05-10/mushroom.heic', is_primary: true }],
    };
    render(<FindCard find={heicFind} storagePath={storageRoot} onEdit={onEdit} onDelete={onDelete} onToggleFavorite={onToggleFavorite} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('HEIC')).toBeInTheDocument();
  });

  it('shows no img and no crash when photos is empty', () => {
    const emptyFind: Find = { ...sampleFind, photos: [] };
    render(<FindCard find={emptyFind} storagePath={storageRoot} onEdit={onEdit} onDelete={onDelete} onToggleFavorite={onToggleFavorite} />);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('shows "(unnamed)" when species_name is empty', () => {
    const unnamed: Find = { ...sampleFind, species_name: '' };
    render(<FindCard find={unnamed} storagePath={storageRoot} onEdit={onEdit} onDelete={onDelete} onToggleFavorite={onToggleFavorite} />);
    expect(screen.getByText('(unnamed)')).toBeInTheDocument();
  });

  it('fires onEdit with the find when Edit button is clicked', () => {
    render(<FindCard find={sampleFind} storagePath={storageRoot} onEdit={onEdit} onDelete={onDelete} onToggleFavorite={onToggleFavorite} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(sampleFind);
  });

  it('fires onDelete with the find when Delete button is clicked', () => {
    render(<FindCard find={sampleFind} storagePath={storageRoot} onEdit={onEdit} onDelete={onDelete} onToggleFavorite={onToggleFavorite} />);
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(sampleFind);
  });

  it('shows "+2 more" badge when photos.length === 3', () => {
    const multiFind: Find = {
      ...sampleFind,
      photos: [
        { id: 1, find_id: 1, photo_path: 'photo1.jpg', is_primary: true },
        { id: 2, find_id: 1, photo_path: 'photo2.jpg', is_primary: false },
        { id: 3, find_id: 1, photo_path: 'photo3.jpg', is_primary: false },
      ],
    };
    render(<FindCard find={multiFind} storagePath={storageRoot} onEdit={onEdit} onDelete={onDelete} onToggleFavorite={onToggleFavorite} />);
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('does not show count badge when photos.length === 1', () => {
    render(<FindCard find={sampleFind} storagePath={storageRoot} onEdit={onEdit} onDelete={onDelete} onToggleFavorite={onToggleFavorite} />);
    expect(screen.queryByText(/\+\d+/)).toBeNull();
  });

  it('fires onToggleFavorite with the find when Favorite button is clicked', () => {
    render(<FindCard find={sampleFind} storagePath={storageRoot} onEdit={onEdit} onDelete={onDelete} onToggleFavorite={onToggleFavorite} />);
    fireEvent.click(screen.getByRole('button', { name: /add to favorites/i }));
    expect(onToggleFavorite).toHaveBeenCalledWith(sampleFind);
  });
});
