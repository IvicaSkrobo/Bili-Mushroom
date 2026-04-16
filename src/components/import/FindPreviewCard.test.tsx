import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import '../../test/tauri-mocks';

vi.mock('@/components/map/LocationPickerMap', () => ({
  LocationPickerMap: vi.fn(({ open, onConfirm, onOpenChange }: {
    open: boolean;
    onConfirm: (lat: number, lng: number) => void;
    onOpenChange: (open: boolean) => void;
    initialLatLng?: { lat: number; lng: number } | null;
  }) => {
    if (!open) return null;
    return (
      <div data-testid="location-picker-map">
        <button onClick={() => onConfirm(45.1, 13.9)}>Confirm pin</button>
        <button onClick={() => onOpenChange(false)}>Close map</button>
      </div>
    );
  }),
}));

import { FindPreviewCard } from './FindPreviewCard';
import type { ImportPayload } from '@/lib/finds';
import { useAppStore } from '@/stores/appStore';

const basePayload: ImportPayload = {
  source_path: '/photos/shroom.jpg',
  original_filename: 'shroom.jpg',
  species_name: 'Amanita muscaria',
  date_found: '2024-05-10',
  country: 'Croatia',
  region: 'Istria',
  location_note: '',
  lat: 45.1,
  lng: 13.9,
  notes: 'Near oak',
  additional_photos: [],
};

describe('FindPreviewCard', () => {
  let onChange: ReturnType<typeof vi.fn>;
  let onRemove: ReturnType<typeof vi.fn>;

  let onUnlock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChange = vi.fn();
    onRemove = vi.fn();
    onUnlock = vi.fn();
    useAppStore.setState({ language: 'en' });
  });

  it('renders a thumbnail img tag for a jpg file with src from convertFileSrc', () => {
    render(
      <FindPreviewCard
        payload={basePayload}
        sourcePath="/photos/shroom.jpg"
        locked={{}}
        onChange={onChange}
        onUnlock={onUnlock}
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
        locked={{}}
        onChange={onChange}
        onUnlock={onUnlock}
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
        locked={{}}
        onChange={onChange}
        onUnlock={onUnlock}
        onRemove={onRemove}
      />,
    );
    expect(screen.getByPlaceholderText('Species name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Country')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Region')).toBeInTheDocument();
    // Lat/lng text inputs removed — location set via map picker button only
    expect(screen.queryByPlaceholderText('Latitude')).toBeNull();
    expect(screen.queryByPlaceholderText('Longitude')).toBeNull();
    expect(screen.getByRole('button', { name: /pick on map/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Notes')).toBeInTheDocument();
  });

  it('calls onChange with updated payload when species input changes', () => {
    render(
      <FindPreviewCard
        payload={basePayload}
        sourcePath="/photos/shroom.jpg"
        locked={{}}
        onChange={onChange}
        onUnlock={onUnlock}
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
        locked={{}}
        onChange={onChange}
        onUnlock={onUnlock}
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
        locked={{}}
        onChange={onChange}
        onUnlock={onUnlock}
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
        locked={{}}
        onChange={onChange}
        onUnlock={onUnlock}
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
        locked={{}}
        onChange={onChange}
        onUnlock={onUnlock}
        onRemove={onRemove}
      />,
    );
    const removeBtn = screen.getByRole('button', { name: /remove from list/i });
    fireEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('renders "Pick on map" button', () => {
    render(
      <FindPreviewCard
        payload={basePayload}
        sourcePath="/photos/shroom.jpg"
        locked={{}}
        onChange={onChange}
        onUnlock={onUnlock}
        onRemove={onRemove}
      />,
    );
    expect(screen.getByRole('button', { name: /pick on map/i })).toBeInTheDocument();
  });

  it('opens LocationPickerMap when "Pick on map" is clicked', () => {
    render(
      <FindPreviewCard
        payload={basePayload}
        sourcePath="/photos/shroom.jpg"
        locked={{}}
        onChange={onChange}
        onUnlock={onUnlock}
        onRemove={onRemove}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /pick on map/i }));
    expect(screen.getByTestId('location-picker-map')).toBeInTheDocument();
  });

  it('calls onChange with lat/lng from LocationPickerMap onConfirm', () => {
    render(
      <FindPreviewCard
        payload={basePayload}
        sourcePath="/photos/shroom.jpg"
        locked={{}}
        onChange={onChange}
        onUnlock={onUnlock}
        onRemove={onRemove}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /pick on map/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm pin/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 45.1, lng: 13.9 }),
    );
  });

  it('passes initialLatLng to LocationPickerMap when payload has coordinates', async () => {
    const { LocationPickerMap: MockMap } = await import('@/components/map/LocationPickerMap');
    render(
      <FindPreviewCard
        payload={basePayload}
        sourcePath="/photos/shroom.jpg"
        locked={{}}
        onChange={onChange}
        onUnlock={onUnlock}
        onRemove={onRemove}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /pick on map/i }));
    expect(MockMap).toHaveBeenCalledWith(
      expect.objectContaining({ initialLatLng: { lat: 45.1, lng: 13.9 } }),
      expect.anything(),
    );
  });

  it('passes initialLatLng=null to LocationPickerMap when payload has no coordinates', async () => {
    const { LocationPickerMap: MockMap } = await import('@/components/map/LocationPickerMap');
    const noGps: ImportPayload = { ...basePayload, lat: null, lng: null };
    render(
      <FindPreviewCard
        payload={noGps}
        sourcePath="/photos/shroom.jpg"
        locked={{}}
        onChange={onChange}
        onUnlock={onUnlock}
        onRemove={onRemove}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /pick on map/i }));
    expect(MockMap).toHaveBeenCalledWith(
      expect.objectContaining({ initialLatLng: null }),
      expect.anything(),
    );
  });
});
