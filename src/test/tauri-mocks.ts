import { vi } from 'vitest';

vi.mock('@tauri-apps/plugin-store', () => ({
  load: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn().mockResolvedValue('/tmp/test-mushroom-library'),
}));

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: {
    load: vi.fn().mockResolvedValue({
      execute: vi.fn().mockResolvedValue({ rowsAffected: 0, lastInsertId: 0 }),
      select: vi.fn().mockResolvedValue([{ journal_mode: 'wal' }]),
      close: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

// ---------------------------------------------------------------------------
// @tauri-apps/api/core mock — invoke dispatch table
// Tests can override individual handlers by mutating invokeHandlers.
// ---------------------------------------------------------------------------

export const invokeHandlers: Record<string, (...args: unknown[]) => unknown> = {
  parse_exif: (_args: unknown) => ({ date: null, lat: null, lng: null }),
  import_find: (_args: unknown) => ({ imported: [], skipped: [] }),
  get_finds: (_args: unknown) => [],
  update_find: (_args: unknown) => ({
    id: 1,
    original_filename: 'shroom.jpg',
    species_name: 'Amanita muscaria',
    date_found: '2024-05-10',
    country: 'Croatia',
    region: 'Istria',
    lat: 45.1,
    lng: 13.9,
    notes: 'Found near oak tree',
    created_at: '2024-05-10T14:00:00Z',
    photos: [],
  }),
  delete_find: (_args: unknown) => undefined,
  get_find_photos: (_args: unknown) => [],
};

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (cmd: string, args?: unknown) => {
    const handler = invokeHandlers[cmd];
    if (!handler) {
      throw new Error(`No mock handler for invoke command: ${cmd}`);
    }
    return handler(args);
  }),
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
}));

// ---------------------------------------------------------------------------
// @tauri-apps/api/event mock — listen / emit
// ---------------------------------------------------------------------------

export type ListenCallback<T> = (event: { payload: T }) => void;
export const listenCallbacks: Record<string, ListenCallback<unknown>[]> = {};

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (eventName: string, cb: ListenCallback<unknown>) => {
    if (!listenCallbacks[eventName]) listenCallbacks[eventName] = [];
    listenCallbacks[eventName].push(cb);
    // Return unlisten function
    return vi.fn(() => {
      listenCallbacks[eventName] = (listenCallbacks[eventName] || []).filter(
        (fn) => fn !== cb,
      );
    });
  }),
}));

/** Helper: emit a mocked Tauri event to all registered listeners. */
export function emitMockEvent<T>(eventName: string, payload: T): void {
  const callbacks = listenCallbacks[eventName] || [];
  callbacks.forEach((cb) => cb({ payload }));
}

// ---------------------------------------------------------------------------
// @tauri-apps/plugin-fs mock
// ---------------------------------------------------------------------------
vi.mock('@tauri-apps/plugin-fs', () => ({
  readDir: vi.fn().mockResolvedValue([]),
}));
