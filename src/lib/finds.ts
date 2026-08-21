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
  common_name?: string | null;
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
  edibility_note: string | null;
  weather?: string | null;
  determiner?: string | null;
  finder?: string | null;
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
  edibility_note: string | null;
  weather?: string | null;
  determiner?: string | null;
  finder?: string | null;
  photo_count?: number;
  photos: FindPhoto[];
}

export interface FindSearchFilters {
  speciesQuery?: string;
  locationQuery?: string;
  favoritesOnly?: boolean;
  dateStart?: string;
  dateEnd?: string;
  datePrefix?: string;
  dateDayMonth?: string;
  photosMode?: 'all' | 'primary' | 'count' | 'none';
  limit?: number;
  offset?: number;
}

export interface SpeciesFolderSummary {
  species_name: string;
  find_count: number;
  photo_count: number;
  favorite_count: number;
  latest_date: string | null;
  representative_find: Find | null;
}

export function getFindPhotoCount(find: Pick<Find, 'photos' | 'photo_count'>): number {
  return find.photo_count ?? find.photos.length;
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

export interface DuplicatePhotoPath {
  photo_path: string;
  count: number;
  find_ids: number[];
}

export interface PhotoLibraryAudit {
  db_photo_rows: number;
  db_distinct_photo_paths: number;
  filesystem_images: number;
  missing_db_photo_paths: string[];
  orphan_filesystem_images: string[];
  duplicate_photo_paths: DuplicatePhotoPath[];
}

export interface DuplicatePhotoCleanupSummary {
  deleted_rows: number;
  affected_find_ids: number[];
  backup_path: string | null;
}

export interface SpeciesProfile {
  species_name: string;
  common_name?: string | null;
  cover_photo_id: number | null;
  tags: string[];
  edibility?: string | null;
  threat_status?: string | null;
  distribution?: string | null;
  edibility_note?: string | null;
  description?: string | null;
  habitat?: string | null;
  synonyms?: string[];
  other_names?: string[];
  fruiting_body_count_override?: string | null;
}

export type SpeciesProfileSummary = Pick<
  SpeciesProfile,
  'species_name' | 'common_name' | 'cover_photo_id' | 'tags' | 'edibility' | 'threat_status' | 'distribution'
>;

export interface SpeciesRecipe {
  id: number;
  species_name: string;
  title: string;
  notes: string;
  created_at: string;
  updated_at: string;
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
export async function getFinds(storagePath: string, filters?: FindSearchFilters): Promise<Find[]> {
  return invoke<Find[]>('get_finds', filters ? { storagePath, filters } : { storagePath });
}

export async function getFindLocations(storagePath: string): Promise<string[]> {
  return invoke<string[]>('get_find_locations', { storagePath });
}

/**
 * One species the user can pick, from finds and profiles alike. Deliberately small:
 * enough to suggest, match and label a species, with no description, habitat or find
 * rows. Fetch the full profile with getSpeciesProfile once a species is chosen.
 */
export interface SpeciesOption {
  species_name: string;
  common_name: string | null;
  synonyms: string[];
  other_names: string[];
  has_finds: boolean;
}

export async function getSpeciesOptions(storagePath: string): Promise<SpeciesOption[]> {
  return invoke<SpeciesOption[]>('get_species_options', { storagePath });
}

/**
 * A partial edit to a species profile: every field left out stays exactly as stored.
 *
 * Use this from screens that own only part of the profile — the find and import
 * dialogs edit the common name and description, while tags, cover, edibility and
 * habitat belong to the species editor. `upsertSpeciesProfile` replaces the whole row
 * and is for that editor.
 */
export interface SpeciesProfilePatch {
  commonName?: string;
  description?: string;
  edibility?: string;
  threatStatus?: string;
  distribution?: string;
  habitat?: string;
  edibilityNote?: string;
  coverPhotoId?: number;
  tags?: string[];
}

export async function patchSpeciesProfile(
  storagePath: string,
  speciesName: string,
  patch: SpeciesProfilePatch,
): Promise<void> {
  return invoke<void>('patch_species_profile', { storagePath, speciesName, patch });
}

/**
 * One pin's worth of data for the map: coordinates, the species label, the date and the
 * single photo the popup shows. Deliberately not a `Find` — the map never renders
 * filenames, country, region, location notes, counts, favourites, weather or determiner,
 * and loading them for every pin was the map's whole cost.
 */
export interface MapPoint {
  id: number;
  species_name: string;
  date_found: string;
  lat: number;
  lng: number;
  notes: string;
  /** Copied onto a new find when the location picker reuses an existing pin. */
  location_note: string;
  photos: FindPhoto[];
}

export async function getMapPoints(storagePath: string): Promise<MapPoint[]> {
  return invoke<MapPoint[]>('get_map_points', { storagePath });
}

export async function getCollectionFolders(
  storagePath: string,
  filters?: FindSearchFilters,
): Promise<SpeciesFolderSummary[]> {
  return invoke<SpeciesFolderSummary[]>('get_collection_folders', filters ? { storagePath, filters } : { storagePath });
}

export async function getSpeciesFinds(
  storagePath: string,
  speciesName: string,
  filters?: FindSearchFilters,
): Promise<Find[]> {
  return invoke<Find[]>('get_species_finds', filters ? { storagePath, speciesName, filters } : { storagePath, speciesName });
}

// ---------------------------------------------------------------------------
// Update find
// ---------------------------------------------------------------------------

export interface UpdateFindPayload {
  id: number;
  species_name: string;
  common_name?: string | null;
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
  edibility_note: string | null;
  weather?: string | null;
  determiner?: string | null;
  finder?: string | null;
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
  deleteSampleFolder = false,
): Promise<void> {
  return invoke<void>('delete_find', { storagePath, findId, deleteFiles, deleteSampleFolder });
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

export async function getSpeciesNote(storagePath: string, speciesName: string): Promise<SpeciesNote | null> {
  return invoke<SpeciesNote | null>('get_species_note', { storagePath, speciesName });
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
export const SPECIES_RECIPES_QUERY_KEY = 'species_recipes' as const;

export async function getSpeciesProfiles(storagePath: string): Promise<SpeciesProfile[]> {
  return invoke<SpeciesProfile[]>('get_species_profiles', { storagePath });
}

export async function getSpeciesProfileSummaries(storagePath: string): Promise<SpeciesProfileSummary[]> {
  return invoke<SpeciesProfileSummary[]>('get_species_profile_summaries', { storagePath });
}

export async function getSpeciesProfile(storagePath: string, speciesName: string): Promise<SpeciesProfile | null> {
  return invoke<SpeciesProfile | null>('get_species_profile', { storagePath, speciesName });
}

export async function upsertSpeciesProfile(
  storagePath: string,
  speciesName: string,
  commonName: string | null | undefined,
  coverPhotoId: number | null,
  tags: string[],
  edibility?: string | null,
  threatStatus?: string | null,
  distribution?: string | null,
  edibilityNote?: string | null,
  synonyms?: string[],
  otherNames?: string[],
  fruitingBodyCountOverride?: string | null,
  description?: string | null,
  habitat?: string | null,
): Promise<void> {
  return invoke<void>('upsert_species_profile', {
    storagePath,
    speciesName,
    commonName: commonName?.trim() || null,
    coverPhotoId,
    tags,
    edibility: edibility ?? null,
    threatStatus: threatStatus ?? null,
    distribution: distribution ?? null,
    edibilityNote: edibilityNote ?? null,
    synonyms: synonyms ?? [],
    otherNames: otherNames ?? [],
    fruitingBodyCountOverride: fruitingBodyCountOverride ?? null,
    description: description ?? null,
    habitat: habitat ?? null,
  });
}

export async function getSpeciesRecipes(storagePath: string): Promise<SpeciesRecipe[]> {
  return invoke<SpeciesRecipe[]>('get_species_recipes', { storagePath });
}

export async function getSpeciesRecipesForSpecies(
  storagePath: string,
  speciesName: string,
): Promise<SpeciesRecipe[]> {
  return invoke<SpeciesRecipe[]>('get_species_recipes_for_species', { storagePath, speciesName });
}

export async function upsertSpeciesRecipe(
  storagePath: string,
  id: number | null,
  speciesName: string,
  title: string,
  notes: string,
): Promise<SpeciesRecipe> {
  return invoke<SpeciesRecipe>('upsert_species_recipe', {
    storagePath,
    id,
    speciesName,
    title,
    notes,
  });
}

export async function deleteSpeciesRecipe(storagePath: string, id: number): Promise<void> {
  return invoke<void>('delete_species_recipe', { storagePath, id });
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

/**
 * Deletes many finds in one command. One IPC round trip, one connection, one
 * transaction — the per-find call is for a single row, not for a selection.
 */
export async function bulkDeleteFinds(
  storagePath: string,
  findIds: number[],
  deleteFiles: boolean,
  deleteSampleFolder = false,
): Promise<void> {
  return invoke<void>('bulk_delete_finds', {
    storagePath,
    findIds,
    deleteFiles,
    deleteSampleFolder,
  });
}

export async function bulkMoveFindsToFolder(
  storagePath: string,
  findIds: number[],
  destFolder: string,
): Promise<void> {
  return invoke<void>('bulk_move_finds_to_folder', { storagePath, findIds, destFolder });
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

export async function renameSpeciesFolder(
  storagePath: string,
  oldSpeciesName: string,
  newSpeciesName: string,
): Promise<void> {
  return invoke<void>('rename_species_folder', { storagePath, oldSpeciesName, newSpeciesName });
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
  common_name?: string | null;
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
  edibility_note: string | null;
  weather?: string | null;
  determiner?: string | null;
  finder?: string | null;
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
  permanentDelete = false,
): Promise<Find> {
  return invoke<Find>('delete_find_photo', { storagePath, photoId, deleteFile, permanentDelete });
}

/**
 * Calls the Rust `bulk_delete_find_photos` command.
 * Deletes multiple photos by ID in a single call.
 */
export async function bulkDeleteFindPhotos(
  storagePath: string,
  photoIds: number[],
  deleteFiles: boolean,
  permanentDelete = false,
): Promise<Find> {
  return invoke<Find>('bulk_delete_find_photos', { storagePath, photoIds, deleteFiles, permanentDelete });
}

export interface PhotoCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function editFindPhotoImage(
  storagePath: string,
  photoId: number,
  rotateDegrees = 0,
  crop?: PhotoCropRect | null,
): Promise<void> {
  return invoke<void>('edit_find_photo_image', {
    storagePath,
    photoId,
    rotateDegrees,
    crop: crop ?? null,
  });
}

export async function editSourcePhotoImage(
  sourcePath: string,
  rotateDegrees = 0,
  crop?: PhotoCropRect | null,
): Promise<string> {
  return invoke<string>('edit_source_photo_image', {
    sourcePath,
    rotateDegrees,
    crop: crop ?? null,
  });
}

export async function auditPhotoLibrary(storagePath: string): Promise<PhotoLibraryAudit> {
  return invoke<PhotoLibraryAudit>('audit_photo_library', { storagePath });
}

export async function cleanupDuplicatePhotoRows(storagePath: string): Promise<DuplicatePhotoCleanupSummary> {
  return invoke<DuplicatePhotoCleanupSummary>('cleanup_duplicate_photo_rows', { storagePath });
}
