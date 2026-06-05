import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';

// SpeciesNameEditor is contenteditable — render a plain input for test assertions
vi.mock('./SpeciesNameEditor', () => ({
  SpeciesNameEditor: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  }) => (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
}));

import { EditFindDialog } from './EditFindDialog';
import { invokeHandlers } from '@/test/tauri-mocks';
import { useAppStore } from '@/stores/appStore';
import type { Find } from '@/lib/finds';

import '@/test/tauri-mocks';

vi.mock('@/lib/geocoding', () => ({
  reverseGeocode: vi.fn().mockResolvedValue({ country: 'Croatia', region: 'Istria' }),
}));

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

const sampleFind: Find = {
  id: 1,
  original_filename: 'shroom.jpg',
  species_name: 'Amanita muscaria',
  date_found: '2024-05-10',
  country: 'Croatia',
  region: 'Istria',
  location_note: '',
  lat: 45.1,
  lng: 13.9,
  notes: 'Found near oak tree',
  observed_count: null,
  observed_count_min: null,
  observed_count_max: null,
  is_favorite: false,
  created_at: '2024-05-10T14:00:00Z',
  photos: [],
};

describe('EditFindDialog', () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    onOpenChange.mockClear();
    vi.mocked(openDialog).mockResolvedValue('/tmp/test-mushroom-library');
    useAppStore.setState({ storagePath: '/storage/test', dbReady: true, language: 'en' });
    invokeHandlers['parse_exif'] = (_args: unknown) => ({ date: null, lat: null, lng: null });
    invokeHandlers['update_find'] = () => ({ ...sampleFind, species_name: 'Updated species' });
  });

  function renderDialog(find: Find | null = sampleFind) {
    const qc = makeQueryClient();
    const Wrapper = makeWrapper(qc);
    render(
      <Wrapper>
        <EditFindDialog find={find} onOpenChange={onOpenChange} />
      </Wrapper>,
    );
    return qc;
  }

  it('shows the dialog when find is not null', () => {
    renderDialog(sampleFind);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('pre-fills species_name from find', () => {
    renderDialog(sampleFind);
    expect(screen.getByDisplayValue('Amanita muscaria')).toBeInTheDocument();
  });

  it('pre-fills country from find', () => {
    renderDialog(sampleFind);
    expect(screen.getByDisplayValue('Croatia')).toBeInTheDocument();
  });

  it('pre-fills date_found from find', () => {
    renderDialog(sampleFind);
    expect(screen.getByDisplayValue('2024-05-10')).toBeInTheDocument();
  });

  it('does not render a dialog when find is null', () => {
    renderDialog(null);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('calls onOpenChange(false) when Cancel is clicked', () => {
    renderDialog(sampleFind);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls update_find via mutation and closes dialog on success', async () => {
    const invokeCallArgs: unknown[] = [];
    invokeHandlers['update_find'] = (args: unknown) => {
      invokeCallArgs.push(args);
      return { ...sampleFind, species_name: 'New name' };
    };

    renderDialog(sampleFind);

    // Change species name
    const speciesInput = screen.getByDisplayValue('Amanita muscaria');
    fireEvent.change(speciesInput, { target: { value: 'New name' } });

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    expect(invokeCallArgs.length).toBe(1);
  });

  it('shows error alert on mutation failure and keeps dialog open', async () => {
    invokeHandlers['update_find'] = () => {
      throw new Error('DB error');
    };

    renderDialog(sampleFind);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // Dialog stays open — onOpenChange NOT called with false
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('prefills empty location fields from newly selected photo EXIF', async () => {
    vi.mocked(openDialog).mockResolvedValue(['/photos/with-gps.jpg']);
    invokeHandlers['parse_exif'] = (_args: unknown) => ({ date: null, lat: 45.1234, lng: 13.9876 });
    const noLocationFind = { ...sampleFind, country: '', region: '', lat: null, lng: null };

    renderDialog(noLocationFind);
    fireEvent.click(screen.getByRole('button', { name: /add photos to this find/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('45.1234')).toBeInTheDocument();
      expect(screen.getByDisplayValue('13.9876')).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('Croatia')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Istria')).toBeInTheDocument();
  });
});
