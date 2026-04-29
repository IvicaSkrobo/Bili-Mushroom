import { invoke } from '@tauri-apps/api/core';
import type { Find } from './finds';

export type ZoneType = 'local' | 'region';
export type ZoneGeometryType = 'circle' | 'polygon';
export type ZoneViewMode = 'pins' | 'local' | 'region' | 'all';

export interface Zone {
  id: number;
  species_name: string;
  zone_type: ZoneType;
  name: string;
  geometry_type: ZoneGeometryType;
  center_lat: number | null;
  center_lng: number | null;
  radius_meters: number | null;
  polygon_json: string | null;
  source_find_id: number | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface UpsertZonePayload {
  id?: number;
  species_name: string;
  zone_type: ZoneType;
  name: string;
  geometry_type: ZoneGeometryType;
  center_lat: number | null;
  center_lng: number | null;
  radius_meters: number | null;
  polygon_json: string | null;
  source_find_id: number | null;
  notes: string;
}

export interface ZoneSummary {
  finds: Find[];
  firstFound: string | null;
  lastFound: string | null;
}

export const ZONES_QUERY_KEY = 'zones' as const;

export async function getZones(storagePath: string): Promise<Zone[]> {
  return invoke<Zone[]>('get_zones', { storagePath });
}

export async function upsertZone(
  storagePath: string,
  payload: UpsertZonePayload,
): Promise<Zone> {
  return invoke<Zone>('upsert_zone', { storagePath, payload });
}

export async function deleteZone(storagePath: string, zoneId: number): Promise<void> {
  return invoke<void>('delete_zone', { storagePath, zoneId });
}

export function pointInCircle(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
): boolean {
  return distanceMeters(lat, lng, centerLat, centerLng) <= radiusMeters;
}

export function distanceMeters(
  latA: number,
  lngA: number,
  latB: number,
  lngB: number,
): number {
  const earthRadiusMeters = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(latB - latA);
  const dLng = toRad(lngB - lngA);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(latA)) *
      Math.cos(toRad(latB)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function summarizeZone(zone: Zone, finds: Find[]): ZoneSummary {
  const zoneFinds = finds
    .filter((find) => find.species_name === zone.species_name)
    .filter((find) => find.lat != null && find.lng != null)
    .filter((find) => isFindInsideZone(find, zone))
    .sort((a, b) => a.date_found.localeCompare(b.date_found));

  return {
    finds: zoneFinds,
    firstFound: zoneFinds[0]?.date_found ?? null,
    lastFound: zoneFinds[zoneFinds.length - 1]?.date_found ?? null,
  };
}

export function isFindInsideZone(find: Find, zone: Zone): boolean {
  if (find.lat == null || find.lng == null) return false;
  if (zone.geometry_type === 'circle') {
    if (zone.center_lat == null || zone.center_lng == null || zone.radius_meters == null) {
      return false;
    }
    return pointInCircle(
      find.lat,
      find.lng,
      zone.center_lat,
      zone.center_lng,
      zone.radius_meters,
    );
  }
  return false;
}

export function visibleZonesForMode(zones: Zone[], mode: ZoneViewMode): Zone[] {
  if (mode === 'pins') return [];
  if (mode === 'all') return zones;
  return zones.filter((zone) => zone.zone_type === mode);
}

export function formatRadius(radiusMeters: number | null): string {
  if (radiusMeters == null) return '';
  if (radiusMeters >= 1000) return `${(radiusMeters / 1000).toFixed(1)} km`;
  return `${Math.round(radiusMeters)} m`;
}
