import Database from '@tauri-apps/plugin-sql';

export class DatabaseInitError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'DatabaseInitError';
  }
}

const instances = new Map<string, Database>();

function buildConnectionString(storageFolderPath: string): string {
  const normalized = storageFolderPath.replace(/\\/g, '/').replace(/\/$/, '');
  return `sqlite:${normalized}/bili-mushroom.db`;
}

export async function getDatabase(storageFolderPath: string): Promise<Database> {
  const cs = buildConnectionString(storageFolderPath);
  const cached = instances.get(cs);
  if (cached) return cached;
  try {
    const db = await Database.load(cs);
    instances.set(cs, db);
    return db;
  } catch (err) {
    throw new DatabaseInitError('Failed to open database', err);
  }
}

export async function verifyWalMode(db: Database): Promise<boolean> {
  const rows = await db.select<{ journal_mode: string }[]>('PRAGMA journal_mode', []);
  if (!Array.isArray(rows) || rows.length === 0) return false;
  return String(rows[0].journal_mode).toLowerCase() === 'wal';
}

export async function initializeDatabase(storageFolderPath: string): Promise<void> {
  const db = await getDatabase(storageFolderPath);
  try {
    // Pitfall 1 safeguard: run PRAGMA outside the migration transaction
    await db.execute('PRAGMA journal_mode=WAL', []);
  } catch (err) {
    throw new DatabaseInitError('Failed to set WAL mode', err);
  }
  const walActive = await verifyWalMode(db);
  if (!walActive) {
    throw new DatabaseInitError('WAL mode could not be enabled');
  }
}
