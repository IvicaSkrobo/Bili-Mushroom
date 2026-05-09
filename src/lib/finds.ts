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
  observed_count: number | null;
  observed_count_min: number | null;
  observed_count_max: number | null;
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
  observed_count: number | null;
  observed_count_min: number | null;
  observed_count_max: number | null;
  is_favorite: boolean;
  created_at: string;
  photos: FindPhoto[];
}

export interface ImportSummary {
  imported: Find[];
  skipped: string[];
  /** Paths that could not be deleted from source after import (e.g. file locked by WebView2). */
  delete_failures: string[];
}

export interface ImportProgress {
  current: number;
  total: number;
  filename: string;
}

export interface SpeciesProfile {
  species_name: string;
  cover_photo_id: number | null;
  tags: string[];
  edibility?: string | null;
  protected_status?: string | null;
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
  '.svg',
  '.tiff',
  '.tif',
  '.bmp',
  '.avif',
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
  deleteSource = false,
): Promise<ImportSummary> {
  return invoke<ImportSummary>('import_find', { storagePath, payloads, deleteSource });
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
  observed_count: number | null;
  observed_count_min: number | null;
  observed_count_max: number | null;
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
export const SPECIES_PROFILES_QUERY_KEY = 'species_profiles' as const;

export async function getSpeciesProfiles(storagePath: string): Promise<SpeciesProfile[]> {
  return invoke<SpeciesProfile[]>('get_species_profiles', { storagePath });
}

export async function upsertSpeciesProfile(
  storagePath: string,
  speciesName: string,
  coverPhotoId: number | null,
  tags: string[],
  edibility?: string | null,
  protectedStatus?: string | null,
): Promise<void> {
  return invoke<void>('upsert_species_profile', {
    storagePath,
    speciesName,
    coverPhotoId,
    tags,
    edibility: edibility ?? null,
    protectedStatus: protectedStatus ?? null,
  });
}

/**
 * Calls the Rust `bulk_rename_species` command.
 * Updates species_name for all given find IDs atomically.
 */
/**
 * Calls the Rust `move_find_files` command.
 * Moves photo files to destFolder on disk, then removes the DB record.
 */
export async function moveFindToFolder(
  storagePath: string,
  findId: number,
  destFolder: string,
): Promise<void> {
  return invoke<void>('move_find_files', { storagePath, findId, destFolder });
}

export async function openFindFolder(
  storagePath: string,
  findId: number,
  scope: 'species' | 'photo' = 'species',
): Promise<void> {
  return invoke<void>('open_find_folder', { storagePath, findId, scope });
}

export async function openSpeciesFolder(
  storagePath: string,
  speciesName: string,
): Promise<void> {
  return invoke<void>('open_species_folder', { storagePath, speciesName });
}

export async function bulkRenameSpecies(
  storagePath: string,
  findIds: number[],
  newSpeciesName: string,
): Promise<void> {
  return invoke<void>('bulk_rename_species', { storagePath, findIds, newSpeciesName });
}

export async function setFindFavorite(
  storagePath: string,
  findId: number,
  isFavorite: boolean,
): Promise<Find> {
  return invoke<Find>('set_find_favorite', { storagePath, findId, isFavorite });
}

// ---------------------------------------------------------------------------
// Create find (no photos)
// ---------------------------------------------------------------------------

export interface CreateFindPayload {
  species_name: string;
  date_found: string;
  country: string;
  region: string;
  location_note: string;
  lat: number | null;
  lng: number | null;
  notes: string;
  observed_count: number | null;
  observed_count_min: number | null;
  observed_count_max: number | null;
}

/**
 * Calls the Rust `create_find` command.
 * Inserts a find record with zero photos. Returns the new FindRecord.
 */
export async function createFind(
  storagePath: string,
  payload: CreateFindPayload,
): Promise<Find> {
  return invoke<Find>('create_find', { storagePath, payload });
}

/**
 * Calls the Rust `add_find_photos` command.
 * Copies source photos into the find's existing species folder and inserts DB rows.
 * Always sets is_primary = false. Primary photo remains unchanged.
 */
export async function addFindPhotos(
  storagePath: string,
  findId: number,
  sourcePaths: string[],
): Promise<Find> {
  return invoke<Find>('add_find_photos', { storagePath, findId, sourcePaths });
}

/**
 * Calls the Rust `delete_find_photo` command.
 * Deletes a single photo by ID. If the photo was primary and others remain,
 * the lowest-id remaining photo is promoted to primary.
 * Deleting the last photo leaves the find intact with photos: [].
 */
export async function deleteFindPhoto(
  storagePath: string,
  photoId: number,
  deleteFile: boolean,
): Promise<Find> {
  return invoke<Find>('delete_find_photo', { storagePath, photoId, deleteFile });
}

/**
 * Calls the Rust `bulk_delete_find_photos` command.
 * Deletes multiple photos by ID in a single call.
 */
export async function bulkDeleteFindPhotos(
  storagePath: string,
  photoIds: number[],
  deleteFiles: boolean,
): Promise<Find> {
  return invoke<Find>('bulk_delete_find_photos', { storagePath, photoIds, deleteFiles });
}
