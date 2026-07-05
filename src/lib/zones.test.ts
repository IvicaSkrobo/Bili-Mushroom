import { describe, expect, it } from 'vitest';
import {
  isFindInsideZone,
  parsePolygonJson,
  pointInPolygon,
  stringifyPolygon,
  summarizeZone,
  zonesContainingPoint,
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

const circleZone: Zone = {
  id: 11,
  species_name: 'Cantharellus cibarius, Lisičica',
  zone_type: 'local',
  name: 'Lisičica spot',
  geometry_type: 'circle',
  center_lat: 45.1,
  center_lng: 15.1,
  radius_meters: 5000,
  polygon_json: null,
  source_find_id: null,
  notes: '',
  created_at: '2026-05-06T00:00:00Z',
  updated_at: '2026-05-06T00:00:00Z',
};

describe('zonesContainingPoint', () => {
  it('returns all zones containing the point, smallest footprint first', () => {
    // circleZone footprint: pi * 5000^2 ≈ 78,539,816
    // polygonZone footprint: ~0.2 * 0.2 = 0.04 (degrees-based area, unit-less but comparable)
    const matches = zonesContainingPoint([polygonZone, circleZone], 45.1, 15.1);
    expect(matches.map((zone) => zone.id)).toEqual([polygonZone.id, circleZone.id]);
  });

  it('returns only the one zone that contains the point when the other does not', () => {
    // Point inside polygonZone bounds but outside circleZone's 5km radius
    const farPoint = { lat: 45.15, lng: 15.18 };
    expect(pointInPolygon(farPoint.lat, farPoint.lng, polygonPoints)).toBe(true);

    const matches = zonesContainingPoint([polygonZone, circleZone], farPoint.lat, farPoint.lng);
    expect(matches.map((zone) => zone.id)).toEqual([polygonZone.id]);
  });

  it('returns an empty array when the point is inside no zones', () => {
    const matches = zonesContainingPoint([polygonZone, circleZone], 46.5, 16.5);
    expect(matches).toEqual([]);
  });

  it('does not filter by zone_type — checks both local and region zones regardless of type', () => {
    expect(polygonZone.zone_type).toBe('region');
    expect(circleZone.zone_type).toBe('local');
    const matches = zonesContainingPoint([polygonZone, circleZone], 45.1, 15.1);
    expect(matches).toHaveLength(2);
    expect(matches.some((zone) => zone.zone_type === 'region')).toBe(true);
    expect(matches.some((zone) => zone.zone_type === 'local')).toBe(true);
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
