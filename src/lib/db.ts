import { invoke } from '@tauri-apps/api/core';

export class DatabaseInitError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'DatabaseInitError';
  }
}

/**
 * Eagerly initialise the database for the given storage folder.
 *
 * Migrations now run inside the Rust open_db() call, so there is nothing
 * the frontend needs to do except trigger an IPC round-trip that causes
 * open_db() to execute. get_finds is the lightest read command available.
 *
 * Throws DatabaseInitError when the Rust command fails (e.g. storage path
 * is unreadable, disk full, corrupt DB file).
 */
export async function initializeDatabase(storageFolderPath: string): Promise<void> {
  try {
    await invoke('get_finds', { storagePath: storageFolderPath });
    await invoke('cleanup_internal_records', { storagePath: storageFolderPath });
  } catch (err) {
    throw new DatabaseInitError('Failed to initialise database', err);
  }
}
