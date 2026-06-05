import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import '@testing-library/jest-dom';
import '../../test/tauri-mocks';
import { invokeHandlers, emitMockEvent, listenCallbacks } from '../../test/tauri-mocks';
import { ImportDialog } from './ImportDialog';
import type { ImportSummary, Find } from '@/lib/finds';

// Mock dialog plugin
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

// Mock fs plugin
vi.mock('@tauri-apps/plugin-fs', () => ({
  readDir: vi.fn().mockResolvedValue([]),
  remove: vi.fn().mockResolvedValue(undefined),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  Toaster: () => null,
}));

// Seed the appStore with a storage path and language so useT and ImportDialog work
vi.mock('@/stores/appStore', () => ({
  useAppStore: vi.fn((selector: (s: { storagePath: string | null; language: string }) => unknown) =>
    selector({ storagePath: '/test-storage', language: 'en' }),
  ),
}));

// SpeciesNameEditor is contenteditable — render a plain input for test assertions
vi.mock('@/components/finds/SpeciesNameEditor', () => ({
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

// Mock LocationPickerMap to avoid leaflet/jsdom issues
vi.mock('@/components/map/LocationPickerMap', () => ({
  LocationPickerMap: ({
    open,
    onConfirm,
  }: {
    open: boolean;
    onConfirm: (lat: number, lng: number) => void;
  }) => (
    open ? (
      <button type="button" onClick={() => onConfirm(45.123456, 13.654321)}>
        Mock Confirm Location
      </button>
    ) : null
  ),
}));

// Mock EditFindDialog to avoid complex dependency chain
vi.mock('@/components/finds/EditFindDialog', () => ({
  EditFindDialog: vi.fn(({ find }: { find: Find | null }) => {
    if (!find) return null;
    return <div data-testid="edit-find-dialog">{find.species_name}</div>;
  }),
}));

const { open: mockOpen } = await import('@tauri-apps/plugin-dialog');
const { readDir: mockReadDir } = await import('@tauri-apps/plugin-fs');
const geocoding = await import('@/lib/geocoding');

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function Wrapper({ children }: { children: ReactNode }) {
  const qc = makeQueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const sampleSummary: ImportSummary = {
  imported: [
    {
      id: 1,
      original_filename: 'shroom.jpg',
      species_name: 'Amanita muscaria',
      date_found: '2024-05-10',
      country: 'Croatia',
      region: 'Istria',
      location_note: '',
      lat: 45.1,
      lng: 13.9,
      notes: '',
      created_at: '2024-05-10T14:00:00Z',
      photos: [],
    },
  ],
  skipped: [],
  delete_failures: [],
};

function renderDialog(open = true, onOpenChange = vi.fn()) {
  return render(
    <Wrapper>
      <ImportDialog open={open} onOpenChange={onOpenChange} />
    </Wrapper>,
  );
}

function getSpeciesInput(): HTMLInputElement {
  return screen.getByPlaceholderText(/Coprinellus|Mushroom name/i) as HTMLInputElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // Reset invoke handlers to safe defaults
  invokeHandlers['parse_exif'] = () => ({ date: '2024-05-10', lat: 45.1, lng: 13.9 });
  invokeHandlers['import_find'] = () => sampleSummary;
  invokeHandlers['get_finds'] = () => [];
  invokeHandlers['get_species_notes'] = () => [];
  // Clear listen callbacks
  Object.keys(listenCallbacks).forEach((k) => delete listenCallbacks[k]);
  vi.spyOn(geocoding, 'reverseGeocode').mockResolvedValue({ country: 'Croatia', region: 'Istria' });
});

describe('ImportDialog', () => {
  it('renders Pick Photos and Pick Folder buttons when open', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: /Pick Photos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pick Folder/i })).toBeInTheDocument();
  });

  it('Import All button is disabled initially (no pending items)', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: /Import All/i })).toBeDisabled();
  });

  it('clicking Pick Photos calls dialog.open with multiple+filters', async () => {
    vi.mocked(mockOpen).mockResolvedValueOnce(['/photos/shroom.jpg']);
    renderDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Pick Photos/i }));
    });

    expect(mockOpen).toHaveBeenCalledWith(
      expect.objectContaining({ multiple: true, filters: expect.any(Array) }),
    );
  });

  it('after picking files, shows photo thumbnail and Clear All button', async () => {
    vi.mocked(mockOpen).mockResolvedValueOnce(['/photos/shroom.jpg']);
    renderDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Pick Photos/i }));
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Clear All/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Remove photo/i })).toBeInTheDocument();
    });
  });

  it('shows Clear All when queue is non-empty and clears pending items on click', async () => {
    vi.mocked(mockOpen).mockResolvedValueOnce(['/photos/shroom.jpg']);
    renderDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Pick Photos/i }));
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Clear All/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Remove photo/i })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Clear All/i }));
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Clear All/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Remove photo/i })).not.toBeInTheDocument();
    });
  });

  it('preserves draft when closed without pressing Cancel', async () => {
    vi.mocked(mockOpen).mockResolvedValueOnce(['/photos/shroom.jpg']);
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <Wrapper>
        <ImportDialog open={true} onOpenChange={onOpenChange} />
      </Wrapper>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Pick Photos/i }));
    });
    await waitFor(() => screen.getByRole('button', { name: /Remove photo/i }));
    fireEvent.change(getSpeciesInput(), { target: { value: 'Amanita muscaria' } });

    rerender(
      <Wrapper>
        <ImportDialog open={false} onOpenChange={onOpenChange} />
      </Wrapper>,
    );
    rerender(
      <Wrapper>
        <ImportDialog open={true} onOpenChange={onOpenChange} />
      </Wrapper>,
    );

    expect(screen.getByDisplayValue('Amanita muscaria')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remove photo/i })).toBeInTheDocument();
  });

  it('clears draft when Cancel is clicked', async () => {
    vi.mocked(mockOpen).mockResolvedValueOnce(['/photos/shroom.jpg']);
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <Wrapper>
        <ImportDialog open={true} onOpenChange={onOpenChange} />
      </Wrapper>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Pick Photos/i }));
    });
    await waitFor(() => screen.getByRole('button', { name: /Remove photo/i }));
    fireEvent.change(getSpeciesInput(), { target: { value: 'Amanita muscaria' } });

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender(
      <Wrapper>
        <ImportDialog open={false} onOpenChange={onOpenChange} />
      </Wrapper>,
    );
    rerender(
      <Wrapper>
        <ImportDialog open={true} onOpenChange={onOpenChange} />
      </Wrapper>,
    );

    expect(screen.queryByDisplayValue('Amanita muscaria')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove photo/i })).not.toBeInTheDocument();
  });

  it('EXIF lat/lng pre-fill shows coordinates next to the map pin button', async () => {
    vi.mocked(mockOpen).mockResolvedValueOnce(['/photos/gps.jpg']);
    invokeHandlers['parse_exif'] = () => ({ date: '2024-05-10', lat: 45.1, lng: 13.9 });
    renderDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Pick Photos/i }));
    });

    // Coordinates shown in a span adjacent to the map pin button
    await waitFor(() => {
      expect(screen.getByText(/45\.100/)).toBeInTheDocument();
    });
  });

  it('Import All is disabled when species name is empty after picking photos', async () => {
    invokeHandlers['parse_exif'] = () => ({ date: '2024-05-10', lat: null, lng: null });
    vi.mocked(mockOpen).mockResolvedValueOnce(['/photos/nodate.jpg']);
    renderDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Pick Photos/i }));
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Remove photo/i })).toBeInTheDocument();
    });
    // Species name is empty so Import All should be disabled
    expect(screen.getByRole('button', { name: /Import All/i })).toBeDisabled();
  });

  it('Confirm location saves coordinates, reverse geocodes, and closes the picker', async () => {
    vi.mocked(mockOpen).mockResolvedValueOnce(['/photos/gps.jpg']);
    invokeHandlers['parse_exif'] = () => ({ date: '2024-05-10', lat: null, lng: null });
    renderDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Pick Photos/i }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Pick on map/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Pick on map/i }));
    expect(screen.getByRole('button', { name: /Mock Confirm Location/i })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Mock Confirm Location/i }));
    });

    await waitFor(() => {
      expect(geocoding.reverseGeocode).toHaveBeenCalledWith(45.123456, 13.654321, 'en');
      expect(screen.queryByRole('button', { name: /Mock Confirm Location/i })).not.toBeInTheDocument();
      expect(screen.getByDisplayValue('Croatia')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Istria')).toBeInTheDocument();
      expect(screen.getByText(/45\.1235, 13\.6543/)).toBeInTheDocument();
    });
  });

  it('clicking Import All invokes import_find with storagePath and payloads', async () => {
    vi.mocked(mockOpen).mockResolvedValueOnce(['/photos/shroom.jpg']);
    invokeHandlers['parse_exif'] = () => ({ date: '2024-05-10', lat: null, lng: null });
    const { invoke } = await import('@tauri-apps/api/core');
    renderDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Pick Photos/i }));
    });
    await waitFor(() => screen.getByRole('button', { name: /Remove photo/i }));

    // Fill species name so Import All is enabled
    fireEvent.change(getSpeciesInput(), { target: { value: 'Boletus edulis' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Import All/i }));
    });

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        'import_find',
        expect.objectContaining({ storagePath: '/test-storage', deleteSource: true }),
      );
    });
  });

  it('saves the import note on the find payload, separate from the species note', async () => {
    vi.mocked(mockOpen).mockResolvedValueOnce(['/photos/shroom.jpg']);
    invokeHandlers['parse_exif'] = () => ({ date: '2024-05-10', lat: null, lng: null });
    const { invoke } = await import('@tauri-apps/api/core');
    renderDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Pick Photos/i }));
    });
    await waitFor(() => screen.getByRole('button', { name: /Remove photo/i }));

    fireEvent.change(screen.getByPlaceholderText(/Coprinellus/i), { target: { value: 'Boletus edulis' } });
    fireEvent.change(screen.getByLabelText(/Find note/i), { target: { value: 'Found under the old oak.' } });
    fireEvent.change(screen.getByLabelText(/Species note/i), { target: { value: 'Usually fruits after rain.' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Import All/i }));
    });

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        'import_find',
        expect.objectContaining({
          payloads: [
            expect.objectContaining({
              species_name: 'Boletus edulis',
              notes: 'Found under the old oak.',
            }),
          ],
        }),
      );
      expect(invoke).toHaveBeenCalledWith(
        'upsert_species_note',
        expect.objectContaining({
          speciesName: 'Boletus edulis',
          notes: 'Usually fruits after rain.',
        }),
      );
    });
  });

  it('on successful import opens PostImportReviewDialog instead of closing immediately', async () => {
    vi.mocked(mockOpen).mockResolvedValueOnce(['/photos/shroom.jpg']);
    invokeHandlers['parse_exif'] = () => ({ date: '2024-05-10', lat: null, lng: null });
    invokeHandlers['import_find'] = () => sampleSummary;
    const onOpenChange = vi.fn();
    render(
      <Wrapper>
        <ImportDialog open={true} onOpenChange={onOpenChange} />
      </Wrapper>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Pick Photos/i }));
    });
    await waitFor(() => screen.getByRole('button', { name: /Remove photo/i }));

    // Fill species name so Import All is enabled
    fireEvent.change(getSpeciesInput(), { target: { value: 'Amanita muscaria' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Import All/i }));
    });

    await waitFor(() => {
      // PostImportReviewDialog should open — "Done" button is unique to the review dialog
      expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument();
    });
    // onOpenChange should NOT have been called yet
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('on import error shows Alert and does NOT call onOpenChange', async () => {
    vi.mocked(mockOpen).mockResolvedValueOnce(['/photos/shroom.jpg']);
    invokeHandlers['parse_exif'] = () => ({ date: '2024-05-10', lat: null, lng: null });
    invokeHandlers['import_find'] = () => { throw 'DB write error'; };
    const onOpenChange = vi.fn();
    render(
      <Wrapper>
        <ImportDialog open={true} onOpenChange={onOpenChange} />
      </Wrapper>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Pick Photos/i }));
    });
    await waitFor(() => screen.getByRole('button', { name: /Remove photo/i }));

    // Fill species name
    fireEvent.change(getSpeciesInput(), { target: { value: 'Boletus edulis' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Import All/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('DB write error')).toBeInTheDocument();
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('clicking Pick Folder calls dialog.open with directory:true', async () => {
    vi.mocked(mockOpen).mockResolvedValueOnce('/some/folder');
    vi.mocked(mockReadDir).mockResolvedValueOnce([]);
    renderDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Pick Folder/i }));
    });

    expect(mockOpen).toHaveBeenCalledWith(expect.objectContaining({ directory: true }));
  });

  it('folder picker filters files by SUPPORTED_EXTENSIONS', async () => {
    vi.mocked(mockOpen).mockResolvedValueOnce('/some/folder');
    vi.mocked(mockReadDir).mockResolvedValueOnce([
      { name: 'a.jpg', isFile: true, isDirectory: false, isSymlink: false },
      { name: 'readme.txt', isFile: true, isDirectory: false, isSymlink: false },
      { name: 'b.png', isFile: true, isDirectory: false, isSymlink: false },
    ] as Parameters<typeof mockReadDir>[0] extends string ? Awaited<ReturnType<typeof mockReadDir>> : never);
    invokeHandlers['parse_exif'] = () => ({ date: '2024-05-10', lat: null, lng: null });
    renderDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Pick Folder/i }));
    });

    await waitFor(() => {
      // Use the per-thumbnail remove buttons as a proxy for photo count
      // Only jpg and png should be imported (txt filtered out)
      const removeButtons = screen.getAllByRole('button', { name: /Remove photo/i });
      expect(removeButtons).toHaveLength(2);
    });
  });

  it('editing the shared species name input updates the value', async () => {
    vi.mocked(mockOpen).mockResolvedValueOnce(['/photos/shroom.jpg']);
    invokeHandlers['parse_exif'] = () => ({ date: '2024-05-10', lat: null, lng: null });
    renderDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Pick Photos/i }));
    });
    await waitFor(() => screen.getByRole('button', { name: /Remove photo/i }));

    const speciesInput = getSpeciesInput();
    fireEvent.change(speciesInput, { target: { value: 'Boletus edulis' } });
    expect(speciesInput.value).toBe('Boletus edulis');
  });

  it('shows progress bar during import with current/total/filename', async () => {
    vi.mocked(mockOpen).mockResolvedValueOnce(['/photos/shroom.jpg']);
    invokeHandlers['parse_exif'] = () => ({ date: '2024-05-10', lat: null, lng: null });

    // Make import_find hang until we emit progress
    let resolveImport!: (v: ImportSummary) => void;
    invokeHandlers['import_find'] = () =>
      new Promise<ImportSummary>((res) => { resolveImport = res; });

    renderDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Pick Photos/i }));
    });
    await waitFor(() => screen.getByRole('button', { name: /Remove photo/i }));

    // Fill species name so Import All is enabled
    fireEvent.change(getSpeciesInput(), { target: { value: 'Boletus edulis' } });

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Import All/i }));
    });

    await act(async () => {
      emitMockEvent('import-progress', { current: 1, total: 1, filename: 'shroom.jpg' });
    });

    await waitFor(() => {
      expect(screen.getByText(/1\/1/)).toBeInTheDocument();
    });

    // Resolve the import to clean up
    await act(async () => {
      resolveImport(sampleSummary);
    });
  });
});
