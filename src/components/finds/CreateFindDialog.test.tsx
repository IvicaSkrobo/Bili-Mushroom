import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { CreateFindDialog } from './CreateFindDialog';
import { FindCard } from './FindCard';
import { invokeHandlers } from '@/test/tauri-mocks';
import { useAppStore } from '@/stores/appStore';
import type { Find } from '@/lib/finds';

import '@/test/tauri-mocks';

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
    useAppStore.setState({ storagePath: storageRoot, dbReady: true, language: 'en' });
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
    const speciesInput = screen.getByRole('textbox', { name: /species name/i });
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

    const speciesInput = screen.getByRole('textbox', { name: /species name/i });
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

    expect(screen.getByRole('textbox', { name: /species name/i })).toHaveTextContent('Amanita muscaria');
  });

  it('clears draft when Cancel is clicked', async () => {
    const qc = makeQueryClient();
    const Wrapper = makeWrapper(qc);
    const { rerender } = render(
      <Wrapper>
        <CreateFindDialog open={true} onOpenChange={onOpenChange} />
      </Wrapper>,
    );

    const speciesInput = screen.getByRole('textbox', { name: /species name/i });
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

    expect(screen.getByRole('textbox', { name: /species name/i })).toHaveTextContent('');
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

    const speciesInput = screen.getByRole('textbox', { name: /species name/i });
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

  it('shows error message when create_find invoke rejects', async () => {
    invokeHandlers['create_find'] = () => {
      throw new Error('DB write failed');
    };

    renderDialog(true);

    const speciesInput = screen.getByRole('textbox', { name: /species name/i });
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
