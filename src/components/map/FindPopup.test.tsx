import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const setActiveTab = vi.fn();
const setEditingFindId = vi.fn();
vi.mock('@/stores/appStore', () => ({
  useAppStore: (selector: (s: {
    setActiveTab: typeof setActiveTab;
    setEditingFindId: typeof setEditingFindId;
  }) => unknown) => selector({ setActiveTab, setEditingFindId }),
}));

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (p: string) => `asset://${p}`,
}));

import { FindPopup } from './FindPopup';
import type { FindGroup } from './groupFindsByCoords';
import type { Find } from '@/lib/finds';

function mk(id: number, name: string, date: string, photo?: string): Find {
  return {
    id, species_name: name, date_found: date,
    country: '', region: '', location_note: '',
    lat: 45, lng: 15, notes: '', created_at: '',
    original_filename: '',
    photos: photo ? [{ id: 100, find_id: id, photo_path: photo, is_primary: true }] : [],
  } as Find;
}

function group(finds: Find[]): FindGroup {
  return { key: 'k', lat: 45, lng: 15, finds };
}

describe('FindPopup', () => {
  beforeEach(() => {
    setActiveTab.mockClear();
    setEditingFindId.mockClear();
  });

  it('Level 1 single find shows species name and date', () => {
    render(<FindPopup group={group([mk(1, 'Cantharellus', '2026-04-01')])} storagePath="/tmp/x" />);
    expect(screen.getByText('Cantharellus')).toBeInTheDocument();
    expect(screen.getByText('2026-04-01')).toBeInTheDocument();
  });

  it('Level 1 cluster shows all find rows', () => {
    render(
      <FindPopup
        group={group([
          mk(1, 'Boletus', '2026-04-01'),
          mk(2, 'Amanita', '2026-04-02'),
          mk(3, 'Russula', '2026-04-03'),
        ])}
        storagePath="/tmp/x"
      />,
    );
    expect(screen.getByText('Boletus')).toBeInTheDocument();
    expect(screen.getByText('Amanita')).toBeInTheDocument();
    expect(screen.getByText('Russula')).toBeInTheDocument();
  });

  it('clicking species name expands to Level 2 with Edit button and thumbnail', () => {
    const { container } = render(
      <FindPopup
        group={group([mk(1, 'Cantharellus', '2026-04-01', 'photo.jpg')])}
        storagePath="/tmp/x"
      />,
    );
    fireEvent.click(screen.getByText('Cantharellus'));
    expect(screen.getByText('Edit find')).toBeInTheDocument();
    // img has alt="" (presentational) so query via DOM directly
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toContain('asset:///tmp/x/photo.jpg');
  });

  it('Edit find button sets editingFindId and switches to collection tab', () => {
    render(
      <FindPopup
        group={group([mk(42, 'Morchella', '2026-04-01')])}
        storagePath="/tmp/x"
      />,
    );
    fireEvent.click(screen.getByText('Morchella'));
    fireEvent.click(screen.getByText('Edit find'));
    expect(setEditingFindId).toHaveBeenCalledWith(42);
    expect(setActiveTab).toHaveBeenCalledWith('collection');
  });

  it('back chevron returns to Level 1', () => {
    render(
      <FindPopup
        group={group([
          mk(1, 'Boletus', '2026-04-01'),
          mk(2, 'Amanita', '2026-04-02'),
        ])}
        storagePath="/tmp/x"
      />,
    );
    fireEvent.click(screen.getByText('Boletus'));
    expect(screen.getByLabelText('Back to summary')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Back to summary'));
    // Both rows should be visible again at Level 1
    expect(screen.getByText('Boletus')).toBeInTheDocument();
    expect(screen.getByText('Amanita')).toBeInTheDocument();
  });
});
