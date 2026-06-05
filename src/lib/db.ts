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
 * Migrations run inside the Rust open_db() call. Use a dedicated lightweight
 * command here so startup does not block on loading the user's collection.
 *
 * Throws DatabaseInitError when the Rust command fails (e.g. storage path
 * is unreadable, disk full, corrupt DB file).
 */
export async function initializeDatabase(storageFolderPath: string): Promise<void> {
  try {
    await invoke('initialize_database', { storagePath: storageFolderPath });
  } catch (err) {
    throw new DatabaseInitError('Failed to initialise database', err);
  }
}

export async function cleanupInternalRecords(storageFolderPath: string): Promise<number> {
  return invoke<number>('cleanup_internal_records', { storagePath: storageFolderPath });
}
