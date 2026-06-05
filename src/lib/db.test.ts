import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../test/tauri-mocks';
import { invokeHandlers } from '../test/tauri-mocks';
import { DatabaseInitError, initializeDatabase } from './db';

describe('db', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializeDatabase resolves when initialize_database invoke succeeds', async () => {
    invokeHandlers['initialize_database'] = (_args: unknown) => undefined;
    await expect(initializeDatabase('/some/path')).resolves.toBeUndefined();
  });

  it('initializeDatabase throws DatabaseInitError when invoke rejects', async () => {
    invokeHandlers['initialize_database'] = (_args: unknown) => {
      throw new Error('open_db failed');
    };
    await expect(initializeDatabase('/bad/path')).rejects.toThrow(DatabaseInitError);
  });

  it('initializeDatabase error message contains Failed to initialise database', async () => {
    invokeHandlers['initialize_database'] = (_args: unknown) => {
      throw new Error('disk error');
    };
    await expect(initializeDatabase('/bad/path2')).rejects.toThrow(
      'Failed to initialise database',
    );
  });

  it('initializeDatabase passes storagePath as the storagePath arg to invoke', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    invokeHandlers['initialize_database'] = (_args: unknown) => undefined;
    await initializeDatabase('/my/lib');
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('initialize_database', {
      storagePath: '/my/lib',
    });
  });
});
