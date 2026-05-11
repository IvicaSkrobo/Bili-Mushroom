import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { SettingsDialog } from './SettingsDialog';
import { formatMb } from '@/lib/tileCache';

// vi.mock is hoisted — cannot reference outer variables in factory
vi.mock('@/lib/tileCache', async () => {
  const actual = await vi.importActual<typeof import('@/lib/tileCache')>('@/lib/tileCache');
  return {
    ...actual,
    getTileCacheStats: vi.fn().mockResolvedValue({ sizeBytes: 44040192, tileCount: 5 }),
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
  useT: () => (key: string) => key,
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

  beforeEach(async () => {
    vi.clearAllMocks();
    tileCacheMock = await import('@/lib/tileCache');
    vi.mocked(tileCacheMock.getTileCacheStats).mockResolvedValue({ sizeBytes: 44040192, tileCount: 5 });
    vi.mocked(tileCacheMock.clearTileCache).mockResolvedValue(undefined);
  });

  it('displays the Map Cache section heading', () => {
    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText('settings.mapCache')).toBeTruthy();
  });

  it('shows formatted cache size after mount', async () => {
    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
    await waitFor(() => {
      const el = screen.getByTestId('tile-cache-size');
      expect(el.textContent).toBe('42 MB');
    });
  });

  it('opens confirm dialog when Clear tile cache clicked', async () => {
    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('settings.clearCache'));
    await waitFor(() => {
      expect(screen.getByText('settings.clearCacheTitle')).toBeTruthy();
    });
  });

  it('calls clearTileCache on confirm and refetches stats', async () => {
    render(<SettingsDialog open={true} onOpenChange={vi.fn()} />);
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
});
