import { describe, expect, it } from 'vitest';
import {
  isFindInsideZone,
  parsePolygonJson,
  pointInPolygon,
  stringifyPolygon,
  summarizeZone,
  type Zone,
} from './zones';
import type { Find } from './finds';

const polygonPoints: [number, number][] = [
  [45.0, 15.0],
  [45.0, 15.2],
  [45.2, 15.2],
  [45.2, 15.0],
];

const polygonZone: Zone = {
  id: 7,
  species_name: 'Boletus edulis, Vrganj',
  zone_type: 'region',
  name: 'Vrganj ridge',
  geometry_type: 'polygon',
  center_lat: null,
  center_lng: null,
  radius_meters: null,
  polygon_json: stringifyPolygon(polygonPoints),
  source_find_id: null,
  notes: '',
  created_at: '2026-05-06T00:00:00Z',
  updated_at: '2026-05-06T00:00:00Z',
};

const insideFind: Find = {
  id: 1,
  species_name: 'Boletus edulis, Vrganj',
  date_found: '2026-05-01',
  country: 'Croatia',
  region: 'Gorski kotar',
  location_note: '',
  lat: 45.1,
  lng: 15.1,
  notes: '',
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
  photos: [],
  is_favorite: false,
};

describe('zones polygon helpers', () => {
  it('parses stored polygon json into leaflet-ready coordinates', () => {
    expect(parsePolygonJson(polygonZone.polygon_json)).toEqual(polygonPoints);
  });

  it('detects points inside a polygon', () => {
    expect(pointInPolygon(45.1, 15.1, polygonPoints)).toBe(true);
    expect(pointInPolygon(45.3, 15.1, polygonPoints)).toBe(false);
  });

  it('treats polygon zones as valid zone membership checks', () => {
    expect(isFindInsideZone(insideFind, polygonZone)).toBe(true);
    expect(
      isFindInsideZone(
        { ...insideFind, id: 2, lat: 45.3, lng: 15.1 },
        polygonZone,
      ),
    ).toBe(false);
  });

  it('summarizes only same-species finds that fall inside the polygon', () => {
    const summary = summarizeZone(polygonZone, [
      insideFind,
      { ...insideFind, id: 2, date_found: '2026-05-03', lat: 45.15, lng: 15.18 },
      { ...insideFind, id: 3, date_found: '2026-05-02', lat: 45.3, lng: 15.1 },
      { ...insideFind, id: 4, species_name: 'Cantharellus cibarius, Lisičica' },
    ]);

    expect(summary.finds.map((find) => find.id)).toEqual([1, 2]);
    expect(summary.firstFound).toBe('2026-05-01');
    expect(summary.lastFound).toBe('2026-05-03');
  });
});
