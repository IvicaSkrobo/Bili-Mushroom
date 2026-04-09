import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../test/tauri-mocks';
import Database from '@tauri-apps/plugin-sql';
import { DatabaseInitError, initializeDatabase, verifyWalMode } from './db';

describe('db', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the module-level instances cache between tests
    vi.resetModules();
  });

  it('initializeDatabase throws DatabaseInitError when Database.load rejects', async () => {
    vi.mocked(Database.load).mockRejectedValueOnce(new Error('cannot open db'));
    await expect(initializeDatabase('/bad/path')).rejects.toThrow(DatabaseInitError);
  });

  it('initializeDatabase DatabaseInitError message contains Failed to open database', async () => {
    vi.mocked(Database.load).mockRejectedValueOnce(new Error('cannot open db'));
    await expect(initializeDatabase('/bad/path3')).rejects.toThrow('Failed to open database');
  });

  it('initializeDatabase calls db.execute with PRAGMA journal_mode=WAL after load', async () => {
    const mockDb = {
      execute: vi.fn().mockResolvedValue({ rowsAffected: 0, lastInsertId: 0 }),
      select: vi.fn().mockResolvedValue([{ journal_mode: 'wal' }]),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(Database.load).mockResolvedValueOnce(mockDb as any);
    await initializeDatabase('/good/path');
    expect(mockDb.execute).toHaveBeenCalledWith('PRAGMA journal_mode=WAL', []);
  });

  it('initializeDatabase throws DatabaseInitError if verifyWalMode returns false', async () => {
    const mockDb = {
      execute: vi.fn().mockResolvedValue({ rowsAffected: 0, lastInsertId: 0 }),
      select: vi.fn().mockResolvedValue([{ journal_mode: 'delete' }]),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(Database.load).mockResolvedValueOnce(mockDb as any);
    await expect(initializeDatabase('/wal-fails')).rejects.toThrow('WAL mode could not be enabled');
  });

  it('verifyWalMode returns true when journal_mode is wal', async () => {
    const mockDb = {
      execute: vi.fn(),
      select: vi.fn().mockResolvedValue([{ journal_mode: 'wal' }]),
      close: vi.fn(),
    };
    const result = await verifyWalMode(mockDb as any);
    expect(result).toBe(true);
  });

  it('verifyWalMode returns false when journal_mode is not wal', async () => {
    const mockDb = {
      execute: vi.fn(),
      select: vi.fn().mockResolvedValue([{ journal_mode: 'delete' }]),
      close: vi.fn(),
    };
    const result = await verifyWalMode(mockDb as any);
    expect(result).toBe(false);
  });

  it('verifyWalMode returns false for empty result set', async () => {
    const mockDb = {
      execute: vi.fn(),
      select: vi.fn().mockResolvedValue([]),
      close: vi.fn(),
    };
    const result = await verifyWalMode(mockDb as any);
    expect(result).toBe(false);
  });
});
