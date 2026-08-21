import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SettingsDialog } from './SettingsDialog';
import { formatMb } from '@/lib/tileCache';
import { invokeHandlers } from '@/test/tauri-mocks';

// vi.mock is hoisted — cannot reference outer variables in factory
vi.mock('@/lib/tileCache', async () => {
  const actual = await vi.importActual<typeof import('@/lib/tileCache')>('@/lib/tileCache');
  return {
    ...actual,
    getTileCacheStats: vi.fn().mockResolvedValue({ sizeBytes: 44040192, tileCount: 5 }),
    getCacheMaxBytes: vi.fn().mockResolvedValue(500 * 1024 * 1024),
    setCacheMax: vi.fn().mockResolvedValue(undefined),
    clearTileCache: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock appStore
vi.mock('@/stores/appStore', () => ({
  useAppStore: (selector: (s: {
    storagePath: string;
    setStoragePath: () => void;
    setDbReady: () => void;
    setDbError: () => void;
    setPendingScan: () => void;
    language: string;
    setLanguage: () => void;
    theme: string;
    setTheme: () => void;
  }) => unknown) =>
    selector({
      storagePath: '/tmp/storage',
      setStoragePath: vi.fn(),
      setDbReady: vi.fn(),
      setDbError: vi.fn(),
      setPendingScan: vi.fn(),
      language: 'en',
      setLanguage: vi.fn(),
      theme: 'dark',
      setTheme: vi.fn(),
    }),
}));

// Mock storage lib
vi.mock('@/lib/storage', () => ({
  pickAndSaveStoragePath: vi.fn().mockResolvedValue('/tmp/storage'),
  clearStoragePath: vi.fn().mockResolvedValue(undefined),
}));

// Mock i18n
vi.mock('@/i18n/index', () => ({
  useT: () => (key: string, vars?: Record<string, string | number>) => {
    if (key === 'settings.cacheUsage') return `${vars?.used} of ${vars?.limit}`;
    if (key === 'settings.cacheUsagePercent') return `Map cache ${vars?.percent}% used`;
    if (key === 'settings.fileCount') return `${vars?.count} files`;
    if (key === 'settings.copyCount') return `${vars?.count} copies`;
    return key;
  },
}));

// Mock Tabs so all tab panels render unconditionally in jsdom
// (Radix Presence does not mount inactive panels in jsdom)
vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('SettingsDialog', () => {
  let tileCacheMock: typeof import('@/lib/tileCache');

  function renderDialog(client?: QueryClient) {
    const queryClient = client ?? new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <SettingsDialog open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>,
    );
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    tileCacheMock = await import('@/lib/tileCache');
    vi.mocked(tileCacheMock.getTileCacheStats).mockResolvedValue({ sizeBytes: 44040192, tileCount: 5 });
    vi.mocked(tileCacheMock.getCacheMaxBytes).mockResolvedValue(500 * 1024 * 1024);
    vi.mocked(tileCacheMock.setCacheMax).mockResolvedValue(undefined);
    vi.mocked(tileCacheMock.clearTileCache).mockResolvedValue(undefined);
    invokeHandlers.get_library_storage_stats = vi.fn().mockReturnValue({
      database_bytes: 6 * 1024 * 1024,
      thumbnail_cache_bytes: 42 * 1024 * 1024,
      thumbnail_count: 1234,
      backup_bytes: 84 * 1024 * 1024,
      backup_count: 2,
    });
    invokeHandlers.open_library_backups_folder = vi.fn().mockReturnValue(undefined);
  });

  // This suite renders i18n keys rather than translations, so assertions name the key.
  async function runCleanReferences(client?: QueryClient) {
    renderDialog(client);
    // The cleanup lives under the Advanced tab.
    fireEvent.click(await screen.findByText('settings.tabAdvanced'));
    // The button opens a confirmation; the last one performs it.
    const buttons = await screen.findAllByText('settings.cleanMissingButton');
    fireEvent.click(buttons[0]);
    const confirm = await screen.findAllByText('settings.cleanMissingButton');
    // The confirm click starts an async command whose result lands after the click
    // returns; without act the state update happens outside React's knowledge.
    await act(async () => {
      fireEvent.click(confirm[confirm.length - 1]);
    });
  }

  it('reports removed references after a clean run', async () => {
    invokeHandlers.prune_missing_photos = vi.fn().mockReturnValue({
      removed: 3,
      affected_finds: 2,
      blocked: [],
      backup_path: 'backups/before-prune.db',
    });

    await runCleanReferences();

    await waitFor(() => {
      expect(screen.getByText('settings.cleanMissingRemoved')).toBeInTheDocument();
    });
    expect(screen.queryByText('settings.cleanMissingBlocked')).toBeNull();
  });

  it('says nothing was removed when a path could not be confirmed missing', async () => {
    // An offline drive makes every photo look missing, so the cleanup refuses to run and
    // has to say why rather than reporting a reassuring "0 removed".
    invokeHandlers.prune_missing_photos = vi.fn().mockReturnValue({
      removed: 0,
      affected_finds: 0,
      blocked: [{ item: 'Boletus edulis/2024-05-10_001.jpg', error: 'it could not be reached' }],
      backup_path: null,
    });

    await runCleanReferences();

    await waitFor(() => {
      expect(screen.getByText('settings.cleanMissingBlocked')).toBeInTheDocument();
    });
    expect(screen.queryByText('settings.cleanMissingNone')).toBeNull();
    expect(screen.queryByText('settings.cleanMissingRemoved')).toBeNull();
  });

  it('refreshes the statistics after removing references', async () => {
    // Photo counts feed the statistics, so an open Statistics tab would otherwise keep
    // showing photos the cleanup has just forgotten.
    invokeHandlers.prune_missing_photos = vi.fn().mockReturnValue({
      removed: 2,
      affected_finds: 1,
      blocked: [],
      backup_path: null,
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    await runCleanReferences(client);

    await waitFor(() => {
      expect(screen.getByText('settings.cleanMissingRemoved')).toBeInTheDocument();
    });
    const invalidated = invalidate.mock.calls.map(([arg]) => (arg as { queryKey: unknown[] }).queryKey[0]);
    for (const key of ['finds', 'stats_cards', 'stats_finds', 'top_spots', 'best_months', 'calendar', 'species_stats']) {
      expect(invalidated).toContain(key);
    }
  });

  it('explains a failed cleanup instead of closing silently', async () => {
    // A failed backup or transaction leaves the library untouched, but saying nothing
    // would look identical to a clean run that found nothing.
    invokeHandlers.prune_missing_photos = vi.fn().mockImplementation(() => {
      throw new Error('backup failed');
    });

    await runCleanReferences();

    await waitFor(() => {
      expect(screen.getByText('settings.cleanMissingFailed')).toBeInTheDocument();
    });
    expect(screen.queryByText('settings.cleanMissingNone')).toBeNull();
    expect(screen.queryByText('settings.cleanMissingRemoved')).toBeNull();
  });

  it('displays the Map Cache section heading', async () => {
    renderDialog();
    expect(screen.getByText('settings.mapCache')).toBeTruthy();
    await screen.findByTestId('tile-cache-size');
  });

  it('shows used cache and configured limit after mount', async () => {
    renderDialog();
    await waitFor(() => {
      const el = screen.getByTestId('tile-cache-size');
      expect(el.textContent).toBe('42 MB of 500 MB');
    });
  });

  it('stores a changed limit and refreshes usage so immediate eviction is visible', async () => {
    renderDialog();
    const input = await screen.findByLabelText('settings.maxCacheSize');
    fireEvent.change(input, { target: { value: '750' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(tileCacheMock.setCacheMax).toHaveBeenCalledWith(750 * 1024 * 1024);
      expect(vi.mocked(tileCacheMock.getTileCacheStats).mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('explains automatic cleanup only when cache is near the limit', async () => {
    vi.mocked(tileCacheMock.getTileCacheStats).mockResolvedValue({
      sizeBytes: 475 * 1024 * 1024,
      tileCount: 5000,
    });
    renderDialog();

    expect(await screen.findByText('settings.cacheNearLimit')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '95');
  });

  it('opens confirm dialog when Clear tile cache clicked', async () => {
    renderDialog();
    fireEvent.click(screen.getByText('settings.clearCache'));
    await waitFor(() => {
      expect(screen.getByText('settings.clearCacheTitle')).toBeTruthy();
    });
  });

  it('calls clearTileCache on confirm and refetches stats', async () => {
    renderDialog();
    fireEvent.click(screen.getByText('settings.clearCache'));
    await waitFor(() => {
      expect(screen.getByText('settings.clearCacheConfirm')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('settings.clearCacheConfirm'));
    await waitFor(() => {
      expect(tileCacheMock.clearTileCache).toHaveBeenCalledWith('/tmp/storage');
      expect(vi.mocked(tileCacheMock.getTileCacheStats).mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('formatMb rounds 44040192 bytes to "42 MB"', () => {
    expect(formatMb(44040192)).toBe('42 MB');
  });

  it('shows database, thumbnail cache, and backup usage without counting original photos', async () => {
    renderDialog();

    expect(await screen.findByTestId('library-database-size')).toHaveTextContent('6.0 MB');
    expect(screen.getByTestId('library-thumbnail-size')).toHaveTextContent('42 MB');
    expect(screen.getByTestId('library-thumbnail-size')).toHaveTextContent('1234');
    expect(screen.getByTestId('library-backup-size')).toHaveTextContent('84 MB');
    expect(screen.getByTestId('library-backup-size')).toHaveTextContent('2');
  });

  it('opens the dedicated backup folder from the storage panel', async () => {
    renderDialog();
    fireEvent.click(await screen.findByText('settings.openBackupFolder'));

    await waitFor(() => {
      expect(invokeHandlers.open_library_backups_folder).toHaveBeenCalledWith({
        storagePath: '/tmp/storage',
      });
    });
  });
});
