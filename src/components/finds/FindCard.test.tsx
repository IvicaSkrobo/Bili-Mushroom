import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FindCard } from './FindCard';
import type { Find } from '@/lib/finds';

import '@/test/tauri-mocks';

const sampleFind: Find = {
  id: 1,
  photo_path: 'Croatia/Istria/2024-05-10/Amanita_muscaria_2024-05-10_001.jpg',
  original_filename: 'shroom.jpg',
  species_name: 'Amanita muscaria',
  date_found: '2024-05-10',
  country: 'Croatia',
  region: 'Istria',
  lat: 45.1,
  lng: 13.9,
  notes: 'Found near oak tree',
  created_at: '2024-05-10T14:00:00Z',
};

const storageRoot = '/storage/test';

describe('FindCard', () => {
  const onEdit = vi.fn();

  beforeEach(() => {
    onEdit.mockClear();
  });

  it('renders species name', () => {
    render(<FindCard find={sampleFind} storagePath={storageRoot} onEdit={onEdit} />);
    expect(screen.getByText('Amanita muscaria')).toBeInTheDocument();
  });

  it('renders date_found', () => {
    render(<FindCard find={sampleFind} storagePath={storageRoot} onEdit={onEdit} />);
    expect(screen.getByText('2024-05-10')).toBeInTheDocument();
  });

  it('renders country / region', () => {
    render(<FindCard find={sampleFind} storagePath={storageRoot} onEdit={onEdit} />);
    expect(screen.getByText('Croatia / Istria')).toBeInTheDocument();
  });

  it('renders an img tag with convertFileSrc path for non-HEIC files', () => {
    render(<FindCard find={sampleFind} storagePath={storageRoot} onEdit={onEdit} />);
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
      photo_path: 'Croatia/Istria/2024-05-10/mushroom.heic',
    };
    render(<FindCard find={heicFind} storagePath={storageRoot} onEdit={onEdit} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('HEIC')).toBeInTheDocument();
  });

  it('shows "(unnamed)" when species_name is empty', () => {
    const unnamed: Find = { ...sampleFind, species_name: '' };
    render(<FindCard find={unnamed} storagePath={storageRoot} onEdit={onEdit} />);
    expect(screen.getByText('(unnamed)')).toBeInTheDocument();
  });

  it('fires onEdit with the find when Edit button is clicked', () => {
    render(<FindCard find={sampleFind} storagePath={storageRoot} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(sampleFind);
  });
});
