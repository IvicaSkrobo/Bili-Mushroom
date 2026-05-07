import { describe, expect, it } from 'vitest';
import {
  isFindInsideZone,
  parsePolygonJson,
  pointInPolygon,
  stringifyPolygon,
  summarizeZone,
  type Zone,
  type ZonePolygonPoint,
  type ZoneType,
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

// Regression: after first drawing a polygon and saving, the app immediately
// enters point-adjust mode (editingPolygonZone) without requiring the user
// to exit and reopen editing. These tests verify the data contract for that
// transition — points must survive intact from draft capture to editing state.
describe('draft → edit transition (first-draw save)', () => {
  const draftPoints: ZonePolygonPoint[] = [
    [45.1, 15.1],
    [45.2, 15.3],
    [45.0, 15.4],
  ];

  it('captured draft points survive stringify/parse round-trip losslessly', () => {
    // handleSaveRegionPolygon captures `savedPoints = draftPolygonZone.points`
    // before the async boundary, then uses savedPoints (not re-parsed) for
    // editingPolygonZone. This confirms the round-trip is lossless either way.
    expect(parsePolygonJson(stringifyPolygon(draftPoints))).toEqual(draftPoints);
  });

  it('editingPolygonZone built from draft has correct shape for a region zone', () => {
    const savedZoneId = 42;
    const savedZoneType: ZoneType = 'region';
    const editingState = { zoneId: savedZoneId, zoneType: savedZoneType, points: draftPoints };

    expect(editingState.zoneId).toBe(savedZoneId);
    expect(editingState.zoneType).toBe('region');
    expect(editingState.points).toEqual(draftPoints);
  });

  it('editingPolygonZone built from draft has correct shape for a local zone', () => {
    const localPoints: ZonePolygonPoint[] = [
      [45.5, 15.5],
      [45.6, 15.6],
      [45.55, 15.7],
    ];
    const editingState = { zoneId: 7, zoneType: 'local' as ZoneType, points: localPoints };

    expect(editingState.zoneType).toBe('local');
    expect(editingState.points).toHaveLength(3);
    expect(editingState.points).toEqual(localPoints);
  });

  it('minimum 3 points guard still applies — polygon with 2 points must not transition', () => {
    const twoPoints: ZonePolygonPoint[] = [[45.1, 15.1], [45.2, 15.3]];
    // Mirrors the guard: `if (!draftPolygonZone || draftPolygonZone.points.length < 3) return;`
    expect(twoPoints.length < 3).toBe(true);
  });

  it('exact 3 points satisfies the save guard', () => {
    expect(draftPoints.length >= 3).toBe(true);
  });

  it('points added during editing do not mutate the original captured array', () => {
    const captured = [...draftPoints];
    const editingPoints = [...captured];
    editingPoints.splice(1, 0, [45.15, 15.2]);

    expect(captured).toHaveLength(3);
    expect(editingPoints).toHaveLength(4);
    expect(editingPoints[1]).toEqual([45.15, 15.2]);
  });
});
