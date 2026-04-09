import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import '@testing-library/jest-dom';
import '../../test/tauri-mocks';
import { invokeHandlers, emitMockEvent, listenCallbacks } from '../../test/tauri-mocks';
import { ImportDialog } from './ImportDialog';
import type { ImportSummary } from '@/lib/finds';

// Mock dialog plugin
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

// Mock fs plugin
vi.mock('@tauri-apps/plugin-fs', () => ({
  readDir: vi.fn().mockResolvedValue([]),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  Toaster: () => null,
}));

// Seed the appStore with a storage path so ImportDialog can call importFind
vi.mock('@/stores/appStore', () => ({
  useAppStore: vi.fn((selector: (s: { storagePath: string | null }) => unknown) =>
    selector({ storagePath: '/test-storage' }),
  ),
}));

const { open: mockOpen } = await import('@tauri-apps/plugin-dialog');
const { readDir: mockReadDir } = await import('@tauri-apps/plugin-fs');
const { toast } = await import('sonner');

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
      photo_path: 'Croatia/Istria/2024-05-10/Amanita_muscaria_2024-05-10_001.jpg',
      original_filename: 'shroom.jpg',
      species_name: '',
      date_found: '2024-05-10',
      country: '',
      region: '',
      lat: 45.1,
      lng: 13.9,
      notes: '',
      created_at: '2024-05-10T14:00:00Z',
    },
  ],
  skipped: [],
};

function renderDialog(open = true, onOpenChange = vi.fn()) {
  return render(
    <Wrapper>
      <ImportDialog open={open} onOpenChange={onOpenChange} />
    </Wrapper>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset invoke handlers to safe defaults
  invokeHandlers['parse_exif'] = () => ({ date: '2024-05-10', lat: 45.1, lng: 13.9 });
  invokeHandlers['import_find'] = () => sampleSummary;
  // Clear listen callbacks
  Object.keys(listenCallbacks).forEach((k) => delete listenCallbacks[k]);
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

  it('after picking files, renders one FindPreviewCard per selected file', async () => {
    vi.mocked(mockOpen).mockResolvedValueOnce(['/photos/shroom.jpg']);
    renderDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Pick Photos/i }));
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Species name')).toBeInTheDocument();
    });
  });

  it('EXIF date and lat/lng pre-fill the preview card', async () => {
    vi.mocked(mockOpen).mockResolvedValueOnce(['/photos/gps.jpg']);
    invokeHandlers['parse_exif'] = () => ({ date: '2024-05-10', lat: 45.1, lng: 13.9 });
    renderDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Pick Photos/i }));
    });

    await waitFor(() => {
      const latInput = screen.getByPlaceholderText('Latitude') as HTMLInputElement;
      expect(latInput.value).toBe('45.1');
    });
  });

  it('Import All is disabled when a card has an empty date_found', async () => {
    invokeHandlers['parse_exif'] = () => ({ date: null, lat: null, lng: null });
    vi.mocked(mockOpen).mockResolvedValueOnce(['/photos/nodate.jpg']);
    renderDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Pick Photos/i }));
    });

    await waitFor(() => screen.getByPlaceholderText('Species name'));
    expect(screen.getByRole('button', { name: /Import All/i })).toBeDisabled();
  });

  it('clicking Import All invokes import_find with storagePath and payloads', async () => {
    vi.mocked(mockOpen).mockResolvedValueOnce(['/photos/shroom.jpg']);
    invokeHandlers['parse_exif'] = () => ({ date: '2024-05-10', lat: null, lng: null });
    const { invoke } = await import('@tauri-apps/api/core');
    renderDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Pick Photos/i }));
    });
    await waitFor(() => screen.getByPlaceholderText('Species name'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Import All/i }));
    });

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        'import_find',
        expect.objectContaining({ storagePath: '/test-storage' }),
      );
    });
  });

  it('on successful import shows success toast and calls onOpenChange(false)', async () => {
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
    await waitFor(() => screen.getByPlaceholderText('Species name'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Import All/i }));
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Imported 1'));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
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
    await waitFor(() => screen.getByPlaceholderText('Species name'));

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
      const cards = screen.getAllByPlaceholderText('Species name');
      // Only jpg and png should be imported (txt filtered out)
      expect(cards).toHaveLength(2);
    });
  });

  it('editing a card species_name propagates state back (state lives in dialog)', async () => {
    vi.mocked(mockOpen).mockResolvedValueOnce(['/photos/shroom.jpg']);
    invokeHandlers['parse_exif'] = () => ({ date: '2024-05-10', lat: null, lng: null });
    renderDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Pick Photos/i }));
    });
    await waitFor(() => screen.getByPlaceholderText('Species name'));

    const speciesInput = screen.getByPlaceholderText('Species name') as HTMLInputElement;
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
    await waitFor(() => screen.getByPlaceholderText('Species name'));

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
