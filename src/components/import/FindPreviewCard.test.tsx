import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import '../../test/tauri-mocks';
import { FindPreviewCard } from './FindPreviewCard';
import type { ImportPayload } from '@/lib/finds';

const basePayload: ImportPayload = {
  source_path: '/photos/shroom.jpg',
  original_filename: 'shroom.jpg',
  species_name: 'Amanita muscaria',
  date_found: '2024-05-10',
  country: 'Croatia',
  region: 'Istria',
  lat: 45.1,
  lng: 13.9,
  notes: 'Near oak',
};

describe('FindPreviewCard', () => {
  let onChange: ReturnType<typeof vi.fn>;
  let onRemove: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChange = vi.fn();
    onRemove = vi.fn();
  });

  it('renders a thumbnail img tag for a jpg file with src from convertFileSrc', () => {
    render(
      <FindPreviewCard
        payload={basePayload}
        sourcePath="/photos/shroom.jpg"
        onChange={onChange}
        onRemove={onRemove}
      />,
    );
    const img = screen.getByRole('img', { name: /shroom\.jpg/i });
    // convertFileSrc mock returns `asset://localhost/<path>`
    expect(img.getAttribute('src')).toContain('shroom.jpg');
  });

  it('renders HEIC placeholder div (no img) for a .heic file', () => {
    const heicPayload: ImportPayload = {
      ...basePayload,
      original_filename: 'mushroom.heic',
    };
    render(
      <FindPreviewCard
        payload={heicPayload}
        sourcePath="/photos/mushroom.heic"
        onChange={onChange}
        onRemove={onRemove}
      />,
    );
    expect(screen.queryByRole('img', { name: /mushroom\.heic/i })).toBeNull();
    expect(screen.getByText(/HEIC preview not supported/i)).toBeInTheDocument();
  });

  it('renders all editable fields', () => {
    render(
      <FindPreviewCard
        payload={basePayload}
        sourcePath="/photos/shroom.jpg"
        onChange={onChange}
        onRemove={onRemove}
      />,
    );
    expect(screen.getByPlaceholderText('Species name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Country')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Region')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Latitude')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Longitude')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Notes')).toBeInTheDocument();
  });

  it('calls onChange with updated payload when species input changes', () => {
    render(
      <FindPreviewCard
        payload={basePayload}
        sourcePath="/photos/shroom.jpg"
        onChange={onChange}
        onRemove={onRemove}
      />,
    );
    const speciesInput = screen.getByPlaceholderText('Species name');
    fireEvent.change(speciesInput, { target: { value: 'Boletus edulis' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ species_name: 'Boletus edulis' }),
    );
  });

  it('shows "Date required before import" warning when date_found is empty', () => {
    const noDate: ImportPayload = { ...basePayload, date_found: '' };
    render(
      <FindPreviewCard
        payload={noDate}
        sourcePath="/photos/shroom.jpg"
        onChange={onChange}
        onRemove={onRemove}
      />,
    );
    expect(screen.getByText(/Date required before import/i)).toBeInTheDocument();
  });

  it('does NOT show date warning when date_found is set', () => {
    render(
      <FindPreviewCard
        payload={basePayload}
        sourcePath="/photos/shroom.jpg"
        onChange={onChange}
        onRemove={onRemove}
      />,
    );
    expect(screen.queryByText(/Date required before import/i)).toBeNull();
  });

  it('does not show any warning for empty lat/lng', () => {
    const noGps: ImportPayload = { ...basePayload, lat: null, lng: null };
    render(
      <FindPreviewCard
        payload={noGps}
        sourcePath="/photos/shroom.jpg"
        onChange={onChange}
        onRemove={onRemove}
      />,
    );
    expect(screen.queryByText(/lat/i)?.textContent ?? '').not.toMatch(/required/i);
    expect(screen.queryByText(/lng/i)?.textContent ?? '').not.toMatch(/required/i);
  });

  it('calls onRemove when the X button is clicked', () => {
    render(
      <FindPreviewCard
        payload={basePayload}
        sourcePath="/photos/shroom.jpg"
        onChange={onChange}
        onRemove={onRemove}
      />,
    );
    const removeBtn = screen.getByRole('button', { name: /Remove/i });
    fireEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
