import { invoke } from '@tauri-apps/api/core';

// ---------------------------------------------------------------------------
// Domain types — mirror the Rust structs from Plan 01
// ---------------------------------------------------------------------------

export interface ExifData {
  date: string | null; // ISO YYYY-MM-DD
  lat: number | null;
  lng: number | null;
}

export interface FindPhoto {
  id: number;
  find_id: number;
  photo_path: string;   // relative to storagePath
  is_primary: boolean;
}

export interface ImportPayload {
  source_path: string;
  original_filename: string;
  species_name: string;
  date_found: string; // ISO YYYY-MM-DD
  country: string;
  region: string;
  location_note: string;
  lat: number | null;
  lng: number | null;
  notes: string;
  additional_photos: string[];  // Mode A: extra source paths for same find
}

export interface Find {
  id: number;
  original_filename: string;
  species_name: string;
  date_found: string;
  country: string;
  region: string;
  location_note: string;
  lat: number | null;
  lng: number | null;
  notes: string;
  created_at: string;
  photos: FindPhoto[];
}

export interface ImportSummary {
  imported: Find[];
  skipped: string[];
}

export interface ImportProgress {
  current: number;
  total: number;
  filename: string;
}

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

export const SUPPORTED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.heif',
] as const;

/** Returns true if the file is a HEIC/HEIF image that WebView2 cannot render. */
export function isHeic(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return ext === '.heic' || ext === '.heif';
}

// ---------------------------------------------------------------------------
// Rust command wrappers
// ---------------------------------------------------------------------------

/**
 * Calls the Rust `parse_exif` command.
 * Returns { date, lat, lng } — all fields may be null when EXIF is absent.
 */
export async function parseExif(path: string): Promise<ExifData> {
  return invoke<ExifData>('parse_exif', { path });
}

/**
 * Calls the Rust `import_find` command.
 * Copies files into StorageRoot, inserts DB rows, emits import-progress events.
 */
export async function importFind(
  storagePath: string,
  payloads: ImportPayload[],
): Promise<ImportSummary> {
  return invoke<ImportSummary>('import_find', { storagePath, payloads });
}

/**
 * Calls the Rust `get_finds` command.
 * Returns all find records ordered by date_found DESC, id DESC.
 */
export async function getFinds(storagePath: string): Promise<Find[]> {
  return invoke<Find[]>('get_finds', { storagePath });
}

// ---------------------------------------------------------------------------
// Update find
// ---------------------------------------------------------------------------

export interface UpdateFindPayload {
  id: number;
  species_name: string;
  date_found: string;
  country: string;
  region: string;
  location_note: string;
  lat: number | null;
  lng: number | null;
  notes: string;
}

/**
 * Calls the Rust `update_find` command.
 * Updates DB columns only — does NOT move the file on disk.
 */
export async function updateFind(storagePath: string, payload: UpdateFindPayload): Promise<Find> {
  return invoke<Find>('update_find', { storagePath, payload });
}

/**
 * Calls the Rust `delete_find` command.
 * Removes DB record(s) and optionally moves photo files to system trash.
 */
export async function deleteFind(
  storagePath: string,
  findId: number,
  deleteFiles: boolean,
): Promise<void> {
  return invoke<void>('delete_find', { storagePath, findId, deleteFiles });
}

/**
 * Calls the Rust `get_find_photos` command.
 * Returns photos for a specific find ordered by is_primary DESC, id ASC.
 */
export async function getFindPhotos(
  storagePath: string,
  findId: number,
): Promise<FindPhoto[]> {
  return invoke<FindPhoto[]>('get_find_photos', { storagePath, findId });
}

/** Shared query key for TanStack Query — import/edit hooks both reference this. */
export const FINDS_QUERY_KEY = 'finds' as const;

// ---------------------------------------------------------------------------
// Species notes (folder-level notes in collection view)
// ---------------------------------------------------------------------------

export interface SpeciesNote {
  species_name: string;
  notes: string;
}

export async function getSpeciesNotes(storagePath: string): Promise<SpeciesNote[]> {
  return invoke<SpeciesNote[]>('get_species_notes', { storagePath });
}

export async function upsertSpeciesNote(
  storagePath: string,
  speciesName: string,
  notes: string,
): Promise<void> {
  return invoke<void>('upsert_species_note', { storagePath, speciesName, notes });
}

export const SPECIES_NOTES_QUERY_KEY = 'species_notes' as const;
