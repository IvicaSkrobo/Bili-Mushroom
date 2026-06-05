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

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: vi.fn().mockResolvedValue('0.0.0-test'),
}));

function summarizeMockFinds(finds: Array<Record<string, any>>) {
  const bySpecies = new Map<string, Array<Record<string, any>>>();
  for (const find of finds) {
    const name = String(find.species_name ?? '(unnamed)');
    bySpecies.set(name, [...(bySpecies.get(name) ?? []), find]);
  }
  return Array.from(bySpecies.entries()).map(([species_name, speciesFinds]) => ({
    species_name,
    find_count: speciesFinds.length,
    photo_count: speciesFinds.reduce((sum, find) => sum + (find.photo_count ?? find.photos?.length ?? 0), 0),
    favorite_count: speciesFinds.filter((find) => find.is_favorite).length,
    latest_date: speciesFinds.map((find) => find.date_found).filter(Boolean).sort().at(-1) ?? null,
    representative_find: speciesFinds[0] ?? null,
  }));
}

// ---------------------------------------------------------------------------
// @tauri-apps/api/core mock — invoke dispatch table
// Tests can override individual handlers by mutating invokeHandlers.
// ---------------------------------------------------------------------------

export const invokeHandlers: Record<string, (...args: unknown[]) => unknown> = {
  parse_exif: (_args: unknown) => ({ date: null, lat: null, lng: null }),
  load_saved_storage_path: (_args: unknown) => null,
  initialize_database: (_args: unknown) => undefined,
  import_find: (_args: unknown) => ({ imported: [], skipped: [] }),
  get_finds: (_args: unknown) => [],
  get_collection_folders: (args: unknown) => summarizeMockFinds(invokeHandlers.get_finds(args) as Array<Record<string, any>>),
  get_species_finds: (args: unknown) => {
    const speciesName = (args as { speciesName?: string })?.speciesName;
    return (invokeHandlers.get_finds(args) as Array<Record<string, any>>)
      .filter((find) => !speciesName || find.species_name === speciesName);
  },
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
  get_photo_thumbnail: (args: unknown) => {
    const payload = args as { photoPath?: string };
    return payload.photoPath ?? '';
  },
  get_species_notes: (_args: unknown) => [],
  get_species_profiles: (_args: unknown) => [],
  upsert_species_note: (_args: unknown) => undefined,
  upsert_species_profile: (_args: unknown) => undefined,
  bulk_rename_species: (_args: unknown) => undefined,
  rename_species_folder: (_args: unknown) => undefined,
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
  create_find: (_args: unknown) => ({
    id: 99,
    original_filename: '',
    species_name: 'Boletus edulis',
    date_found: '2026-05-08',
    country: 'Croatia',
    region: 'Istria',
    location_note: '',
    lat: null,
    lng: null,
    notes: '',
    observed_count: null,
    observed_count_min: null,
    observed_count_max: null,
    is_favorite: false,
    created_at: '2026-05-08T10:00:00Z',
    photos: [],
  }),
  delete_find_photo: (_args: unknown) => ({
    id: 1,
    original_filename: 'shroom.jpg',
    species_name: 'Amanita muscaria',
    date_found: '2024-05-10',
    country: 'Croatia',
    region: 'Istria',
    location_note: '',
    lat: 45.1,
    lng: 13.9,
    notes: '',
    observed_count: null,
    observed_count_min: null,
    observed_count_max: null,
    is_favorite: false,
    created_at: '2024-05-10T14:00:00Z',
    photos: [],
  }),
  bulk_delete_find_photos: (_args: unknown) => ({
    id: 1,
    original_filename: 'shroom.jpg',
    species_name: 'Amanita muscaria',
    date_found: '2024-05-10',
    country: 'Croatia',
    region: 'Istria',
    location_note: '',
    lat: 45.1,
    lng: 13.9,
    notes: '',
    observed_count: null,
    observed_count_min: null,
    observed_count_max: null,
    is_favorite: false,
    created_at: '2024-05-10T14:00:00Z',
    photos: [],
  }),
  add_find_photos: (_args: unknown) => ({
    id: 1,
    original_filename: 'shroom.jpg',
    species_name: 'Amanita muscaria',
    date_found: '2024-05-10',
    country: 'Croatia',
    region: 'Istria',
    location_note: '',
    lat: 45.1,
    lng: 13.9,
    notes: '',
    observed_count: null,
    observed_count_min: null,
    observed_count_max: null,
    is_favorite: false,
    created_at: '2024-05-10T14:00:00Z',
    photos: [],
  }),
  cleanup_internal_records: (_args: unknown) => 0,
  audit_photo_library: (_args: unknown) => ({
    db_photo_rows: 0,
    db_distinct_photo_paths: 0,
    filesystem_images: 0,
    missing_db_photo_paths: [],
    orphan_filesystem_images: [],
    duplicate_photo_paths: [],
  }),
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
  check_app_update: async (_args: unknown) => null,
  install_app_update: async (_args: unknown) => false,
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
