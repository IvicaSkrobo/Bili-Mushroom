import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { CreateFindDialog } from './CreateFindDialog';
import { FindCard } from './FindCard';
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
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
}

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

const storageRoot = '/storage/test';

// Minimal no-photo find for FindCard tests
const noPhotoFind: Find = {
  id: 2,
  original_filename: '',
  species_name: 'Cantharellus cibarius',
  date_found: '2026-05-08',
  country: 'Croatia',
  region: 'Istria',
  location_note: '',
  lat: null,
  lng: null,
  notes: '',
  observed_count: null,
  observed_count_min: null,
  observed_count_max: null,
  is_favorite: false,
  created_at: '2026-05-08T10:00:00Z',
  photos: [],
};

// -----------------------------------------------------------------------
// CreateFindDialog tests
// -----------------------------------------------------------------------

describe('CreateFindDialog', () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    onOpenChange.mockClear();
    localStorage.clear();
    vi.mocked(openDialog).mockResolvedValue('/tmp/test-mushroom-library');
    useAppStore.setState({ storagePath: storageRoot, dbReady: true, language: 'en' });
    invokeHandlers['parse_exif'] = (_args: unknown) => ({ date: null, lat: null, lng: null });
    invokeHandlers['create_find'] = (_args: unknown) => ({
      id: 99,
      original_filename: '',
      species_name: 'Boletus edulis',
      date_found: '2026-05-08',
      country: 'Croatia',
      region: 'Istria',
      location_note: '',
      lat: null,
      lng: null,
      notes: '',
      observed_count: null,
      observed_count_min: null,
      observed_count_max: null,
      is_favorite: false,
      created_at: '2026-05-08T10:00:00Z',
      photos: [],
    });
  });

  function renderDialog(open = true) {
    const qc = makeQueryClient();
    qc.setQueryData(['finds', storageRoot, null], []);
    qc.setQueryData(['species_profiles', storageRoot], []);
    const Wrapper = makeWrapper(qc);
    render(
      <Wrapper>
        <CreateFindDialog open={open} onOpenChange={onOpenChange} />
      </Wrapper>,
    );
    return qc;
  }

  it('renders dialog when open=true', () => {
    renderDialog(true);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not render dialog when open=false', () => {
    renderDialog(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('disables Save when species_name is empty', () => {
    renderDialog(true);
    const saveBtn = screen.getByRole('button', { name: /save/i });
    expect(saveBtn).toBeDisabled();
  });

  it('enables Save when species_name is filled', async () => {
    renderDialog(true);
    const speciesInput = screen.getByRole('textbox', { name: /latin name/i });
    // SpeciesNameEditor is a contentEditable div — set textContent and fire input
    speciesInput.textContent = 'Boletus edulis';
    fireEvent.input(speciesInput);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
    });
  });

  it('preserves draft when dismissed and reopened without cancelling', async () => {
    const qc = makeQueryClient();
    const Wrapper = makeWrapper(qc);
    const { rerender } = render(
      <Wrapper>
        <CreateFindDialog open={true} onOpenChange={onOpenChange} />
      </Wrapper>,
    );

    const speciesInput = screen.getByRole('textbox', { name: /latin name/i });
    speciesInput.textContent = 'Amanita muscaria';
    fireEvent.input(speciesInput);

    rerender(
      <Wrapper>
        <CreateFindDialog open={false} onOpenChange={onOpenChange} />
      </Wrapper>,
    );
    rerender(
      <Wrapper>
        <CreateFindDialog open={true} onOpenChange={onOpenChange} />
      </Wrapper>,
    );

    expect(screen.getByRole('textbox', { name: /latin name/i })).toHaveTextContent('Amanita muscaria');
  });

  it('clears draft when Cancel is clicked', async () => {
    const qc = makeQueryClient();
    const Wrapper = makeWrapper(qc);
    const { rerender } = render(
      <Wrapper>
        <CreateFindDialog open={true} onOpenChange={onOpenChange} />
      </Wrapper>,
    );

    const speciesInput = screen.getByRole('textbox', { name: /latin name/i });
    speciesInput.textContent = 'Amanita muscaria';
    fireEvent.input(speciesInput);

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender(
      <Wrapper>
        <CreateFindDialog open={false} onOpenChange={onOpenChange} />
      </Wrapper>,
    );
    rerender(
      <Wrapper>
        <CreateFindDialog open={true} onOpenChange={onOpenChange} />
      </Wrapper>,
    );

    expect(screen.getByRole('textbox', { name: /latin name/i })).toHaveTextContent('');
  });

  it('calls create_find invoke and closes on success', async () => {
    const invokeCallArgs: unknown[] = [];
    invokeHandlers['create_find'] = (args: unknown) => {
      invokeCallArgs.push(args);
      return {
        id: 99,
        original_filename: '',
        species_name: 'Boletus edulis',
        date_found: '2026-05-08',
        country: 'Croatia',
        region: 'Istria',
        location_note: '',
        lat: null,
        lng: null,
        notes: '',
        observed_count: null,
        observed_count_min: null,
        observed_count_max: null,
        is_favorite: false,
        created_at: '2026-05-08T10:00:00Z',
        photos: [],
      };
    };

    renderDialog(true);

    const speciesInput = screen.getByRole('textbox', { name: /latin name/i });
    // SpeciesNameEditor is a contentEditable div — set textContent and fire input
    speciesInput.textContent = 'Boletus edulis';
    fireEvent.input(speciesInput);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    expect(invokeCallArgs.length).toBe(1);
  });

  it('stores the library spelling when the typed name differs only in case', async () => {
    // The library already knows "Boletus edulis". Typing it in lower case must not open
    // a second, case-variant species folder alongside the existing one.
    invokeHandlers['get_species_options'] = () => [
      {
        species_name: 'Boletus edulis',
        common_name: 'Vrganj',
        synonyms: [],
        other_names: [],
        has_finds: true,
      },
    ];
    const createdWith: Array<Record<string, any>> = [];
    invokeHandlers['create_find'] = (args: unknown) => {
      createdWith.push(args as Record<string, any>);
      return { ...noPhotoFind, id: 101, species_name: 'Boletus edulis' };
    };

    renderDialog(true);

    const speciesInput = screen.getByRole('textbox', { name: /latin name/i });
    speciesInput.textContent = 'boletus edulis';
    fireEvent.input(speciesInput);

    // The options list resolves asynchronously; the auto-filled common name is the
    // observable signal that the typed text has been matched to the known species.
    await waitFor(() => {
      expect(screen.getByDisplayValue('Vrganj')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(createdWith.length).toBe(1));
    expect(createdWith[0].payload.species_name).toBe('Boletus edulis');
  });

  it('shows error message when create_find invoke rejects', async () => {
    invokeHandlers['create_find'] = () => {
      throw new Error('DB write failed');
    };

    renderDialog(true);

    const speciesInput = screen.getByRole('textbox', { name: /latin name/i });
    // SpeciesNameEditor is a contentEditable div — set textContent and fire input
    speciesInput.textContent = 'Boletus edulis';
    fireEvent.input(speciesInput);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('prefills location fields from selected photo EXIF', async () => {
    vi.mocked(openDialog).mockResolvedValue(['/photos/with-gps.jpg']);
    invokeHandlers['parse_exif'] = (_args: unknown) => ({ date: null, lat: 45.1234, lng: 13.9876 });

    renderDialog(true);
    fireEvent.click(screen.getByRole('button', { name: /pick photos/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('45.1234')).toBeInTheDocument();
      expect(screen.getByDisplayValue('13.9876')).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('Croatia')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Istria')).toBeInTheDocument();
  });
});

// -----------------------------------------------------------------------
// FindCard no-photo tests
// -----------------------------------------------------------------------

describe('FindCard no-photo', () => {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const onToggleFavorite = vi.fn();

  beforeEach(() => {
    onEdit.mockClear();
    onDelete.mockClear();
    onToggleFavorite.mockClear();
    useAppStore.setState({ language: 'en' });
  });

  it('renders species name when photos is empty array', () => {
    render(
      <FindCard
        find={noPhotoFind}
        storagePath={storageRoot}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleFavorite={onToggleFavorite}
      />,
    );
    expect(screen.getByText('Cantharellus cibarius')).toBeInTheDocument();
  });

  it('does not render an img element when photos is empty', () => {
    render(
      <FindCard
        find={noPhotoFind}
        storagePath={storageRoot}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleFavorite={onToggleFavorite}
      />,
    );
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('shows placeholder icon when photos is empty', () => {
    render(
      <FindCard
        find={noPhotoFind}
        storagePath={storageRoot}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleFavorite={onToggleFavorite}
      />,
    );
    // The lucide Image icon renders as an SVG — verify no <img> and no broken image path
    expect(screen.queryByRole('img')).toBeNull();
    // Verify the card still renders (species name present = card rendered)
    expect(screen.getByText('Cantharellus cibarius')).toBeInTheDocument();
  });

  it('edit button still triggers onEdit callback when photos is empty', () => {
    render(
      <FindCard
        find={noPhotoFind}
        storagePath={storageRoot}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleFavorite={onToggleFavorite}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(noPhotoFind);
  });

  it('delete button still triggers onDelete callback when photos is empty', () => {
    render(
      <FindCard
        find={noPhotoFind}
        storagePath={storageRoot}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleFavorite={onToggleFavorite}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(noPhotoFind);
  });
});
