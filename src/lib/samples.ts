import { invoke } from '@tauri-apps/api/core';

/**
 * A specimen register entry. The sample points at a find -- species, date, location and
 * photos stay owned by the find and are read back through the join, so editing the find
 * updates the sample too.
 */
export interface Sample {
  id: number;
  find_id: number;
  species_name: string;
  sample_year: number;
  sample_no: number;
  /** Display label, e.g. "Boletus edulis 1/2026". */
  label: string;
  folder_path: string | null;
  preservation: string | null;
  storage_location: string | null;
  condition: string | null;
  spore_print: boolean;
  dna_sample: boolean;
  dried_at: string | null;
  dry_weight: string | null;
  loaned_to: string | null;
  loaned_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  date_found: string;
  country: string;
  region: string;
  location_note: string;
  lat: number | null;
  lng: number | null;
  determiner: string | null;
  finder: string | null;
  weather: string | null;
  find_notes: string;
  photo_paths: string[];
}

export interface SampleUpdatePayload {
  id: number;
  preservation: string | null;
  storage_location: string | null;
  condition: string | null;
  spore_print: boolean;
  dna_sample: boolean;
  dried_at: string | null;
  dry_weight: string | null;
  loaned_to: string | null;
  loaned_at: string | null;
  notes: string | null;
}

export const SAMPLES_QUERY_KEY = 'samples' as const;

export async function getSamples(storagePath: string): Promise<Sample[]> {
  return invoke<Sample[]>('get_samples', { storagePath });
}

export async function getSampleForFind(storagePath: string, findId: number): Promise<Sample | null> {
  return invoke<Sample | null>('get_sample_for_find', { storagePath, findId });
}

/** Idempotent: a find that is already registered keeps its number. */
export async function createSampleForFind(storagePath: string, findId: number): Promise<Sample> {
  return invoke<Sample>('create_sample_for_find', { storagePath, findId });
}

export async function updateSample(storagePath: string, payload: SampleUpdatePayload): Promise<Sample> {
  return invoke<Sample>('update_sample', { storagePath, payload });
}

export async function deleteSample(storagePath: string, sampleId: number, deleteFolder: boolean): Promise<void> {
  return invoke<void>('delete_sample', { storagePath, sampleId, deleteFolder });
}

export async function syncSampleFolder(storagePath: string, sampleId: number): Promise<Sample> {
  return invoke<Sample>('sync_sample_folder', { storagePath, sampleId });
}

export async function openSampleFolder(storagePath: string, sampleId: number): Promise<void> {
  return invoke<void>('open_sample_folder', { storagePath, sampleId });
}
