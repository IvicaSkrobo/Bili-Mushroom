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
  save: vi.fn().mockResolvedValue('/tmp/bili-export.csv'),
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
    location_note: '',
    observed_count: null,
    is_favorite: false,
    created_at: '2024-05-10T14:00:00Z',
    photos: [],
  }),
  delete_find: (_args: unknown) => undefined,
  move_find_files: (_args: unknown) => undefined,
  get_find_photos: (_args: unknown) => [],
  get_species_notes: (_args: unknown) => [],
  get_species_profiles: (_args: unknown) => [],
  upsert_species_note: (_args: unknown) => undefined,
  upsert_species_profile: (_args: unknown) => undefined,
  bulk_rename_species: (_args: unknown) => undefined,
  set_find_favorite: (_args: unknown) => ({
    id: 1,
    original_filename: 'shroom.jpg',
    species_name: 'Amanita muscaria',
    date_found: '2024-05-10',
    country: 'Croatia',
    region: 'Istria',
    lat: 45.1,
    lng: 13.9,
    notes: 'Found near oak tree',
    location_note: '',
    observed_count: null,
    is_favorite: true,
    created_at: '2024-05-10T14:00:00Z',
    photos: [],
  }),
  cleanup_internal_records: (_args: unknown) => 0,
  quit_app: (_args: unknown) => undefined,
  fetch_tile: async (_args: { url: string }) => {
    // 1x1 transparent PNG data URI for tests
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=';
  },
  get_tile_cache_stats: async () => ({
    size_bytes: 0,
    tile_count: 0,
  }),
  clear_tile_cache: async (_args: { storagePath?: string | null }) => undefined,
  set_cache_max: async (_args: { maxBytes: number }) => undefined,
  get_cache_max_bytes: async () => 200 * 1024 * 1024,
  get_zones: (_args: unknown) => [],
  upsert_zone: (args: unknown) => {
    const payload = (args as { payload: Record<string, unknown> }).payload;
    return {
      id: payload.id ?? 1,
      ...payload,
      created_at: '2026-04-29T12:00:00Z',
      updated_at: '2026-04-29T12:00:00Z',
    };
  },
  delete_zone: (_args: unknown) => undefined,
  get_stats_cards: (_args: unknown) => ({
    total_finds: 0, unique_species: 0, locations_visited: 0, most_active_month: null,
  }),
  get_top_spots: (_args: unknown) => [],
  get_best_months: (_args: unknown) => [],
  get_calendar: (_args: unknown) => [],
  get_species_stats: (_args: unknown) => [],
  read_photos_as_base64: (_args: unknown) => [],
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
  remove: vi.fn().mockResolvedValue(undefined),
  writeTextFile: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));
