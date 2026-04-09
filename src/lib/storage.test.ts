import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../test/tauri-mocks';
import { loadStoragePath, pickAndSaveStoragePath, clearStoragePath } from './storage';
import { load as loadStore } from '@tauri-apps/plugin-store';
import { open as openDialog } from '@tauri-apps/plugin-dialog';

describe('storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loadStoragePath returns null when store is empty', async () => {
    const fakeStore = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(loadStore).mockResolvedValue(fakeStore as any);
    const result = await loadStoragePath();
    expect(result).toBeNull();
    expect(fakeStore.get).toHaveBeenCalledWith('storageFolderPath');
  });

  it('loadStoragePath returns value after pickAndSaveStoragePath', async () => {
    const fakeStore = {
      get: vi.fn().mockResolvedValue('/my/mushrooms'),
      set: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(loadStore).mockResolvedValue(fakeStore as any);
    const result = await loadStoragePath();
    expect(result).toBe('/my/mushrooms');
  });

  it('pickAndSaveStoragePath returns null when dialog cancelled', async () => {
    const fakeStore = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(loadStore).mockResolvedValue(fakeStore as any);
    vi.mocked(openDialog).mockResolvedValue(null as any);
    const result = await pickAndSaveStoragePath();
    expect(result).toBeNull();
    expect(fakeStore.set).not.toHaveBeenCalled();
    expect(fakeStore.save).not.toHaveBeenCalled();
  });

  it('pickAndSaveStoragePath calls store.save() after setting', async () => {
    const fakeStore = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(loadStore).mockResolvedValue(fakeStore as any);
    vi.mocked(openDialog).mockResolvedValue('/chosen/folder' as any);
    const result = await pickAndSaveStoragePath();
    expect(result).toBe('/chosen/folder');
    expect(fakeStore.set).toHaveBeenCalledWith('storageFolderPath', '/chosen/folder');
    expect(fakeStore.save).toHaveBeenCalled();
  });

  it('clearStoragePath deletes key and calls save', async () => {
    const fakeStore = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(loadStore).mockResolvedValue(fakeStore as any);
    await clearStoragePath();
    expect(fakeStore.delete).toHaveBeenCalledWith('storageFolderPath');
    expect(fakeStore.save).toHaveBeenCalled();
  });
});
