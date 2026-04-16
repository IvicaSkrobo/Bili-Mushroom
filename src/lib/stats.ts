import { invoke } from '@tauri-apps/api/core';

// ---------------------------------------------------------------------------
// Domain types — mirror Rust structs from stats.rs (snake_case serde output)
// ---------------------------------------------------------------------------

export interface StatsCards {
  total_finds: number;
  unique_species: number;
  locations_visited: number;
  most_active_month: string | null; // "YYYY-MM" format
}

export interface TopSpot {
  country: string;
  region: string;
  location_note: string;
  count: number;
}

export interface BestMonth {
  month_num: number; // 1-12
  count: number;
}

export interface CalendarEntry {
  month: number; // 1-12
  species_name: string;
  date_found: string;
  location_note: string;
}

export interface SpeciesLocation {
  country: string;
  region: string;
  location_note: string;
}

export interface SpeciesStatSummary {
  species_name: string;
  find_count: number;
  first_find: string;
  best_month: string | null; // "YYYY-MM" format
  locations: SpeciesLocation[];
}

// ---------------------------------------------------------------------------
// Query key constants
// ---------------------------------------------------------------------------

export const STATS_QUERY_KEY = 'stats_cards' as const;
export const TOP_SPOTS_QUERY_KEY = 'top_spots' as const;
export const BEST_MONTHS_QUERY_KEY = 'best_months' as const;
export const CALENDAR_QUERY_KEY = 'calendar' as const;
export const SPECIES_STATS_QUERY_KEY = 'species_stats' as const;

// ---------------------------------------------------------------------------
// IPC wrappers
// ---------------------------------------------------------------------------

export async function getStatsCards(storagePath: string): Promise<StatsCards> {
  return invoke<StatsCards>('get_stats_cards', { storagePath });
}

export async function getTopSpots(storagePath: string): Promise<TopSpot[]> {
  return invoke<TopSpot[]>('get_top_spots', { storagePath });
}

export async function getBestMonths(storagePath: string): Promise<BestMonth[]> {
  return invoke<BestMonth[]>('get_best_months', { storagePath });
}

export async function getCalendar(storagePath: string): Promise<CalendarEntry[]> {
  return invoke<CalendarEntry[]>('get_calendar', { storagePath });
}

export async function getSpeciesStats(storagePath: string): Promise<SpeciesStatSummary[]> {
  return invoke<SpeciesStatSummary[]>('get_species_stats', { storagePath });
}

export async function readPhotosAsBase64(
  storagePath: string,
  photoPaths: string[],
): Promise<string[]> {
  return invoke<string[]>('read_photos_as_base64', { storagePath, photoPaths });
}
