import { describe, expect, it } from 'vitest';
import { buildSeasonalityInsights, buildSpeciesSpotHint } from '@/lib/insights';

const t = (key: string, vars?: Record<string, string | number>) => {
  const templates: Record<string, string> = {
    'stats.insightStrong': '{month} is historically strong',
    'stats.insightMostActive': 'Most active species: {species}.',
    'stats.insightLogged': 'You logged {count} finds in {month}.',
    'stats.spotHint': 'Hint: {species} peaks around {month} — try {location}.',
  };
  return Object.entries(vars ?? {}).reduce(
    (text, [name, value]) => text.replace(`{${name}}`, String(value)),
    templates[key] ?? key,
  );
};

describe('buildSeasonalityInsights', () => {
  it('returns top month insight cards with species', () => {
    const insights = buildSeasonalityInsights(
      [
        { month_num: 9, count: 12 },
        { month_num: 10, count: 9 },
      ],
      [
        { species_name: 'Boletus *edulis*', find_count: 6, first_find: '2025-09-01', best_month: '2025-09', locations: [] },
        { species_name: 'Cantharellus', find_count: 4, first_find: '2025-09-03', best_month: '2025-09', locations: [] },
      ],
      'en-US',
      t,
      new Date('2025-09-15'),
    );

    expect(insights).toHaveLength(2);
    expect(insights[0].title).toMatch(/September/);
    expect(insights[0].body).toContain('[[species:Boletus *edulis*]]');
    expect(insights[0].body).toContain('[[species:Cantharellus]]');
  });

  it('limits insight cards to the current and next month', () => {
    const insights = buildSeasonalityInsights(
      [
        { month_num: 5, count: 30 },
        { month_num: 6, count: 8 },
        { month_num: 7, count: 6 },
      ],
      [
        { species_name: 'Agaricus campestris', find_count: 10, first_find: '2025-05-01', best_month: '2025-05', locations: [] },
        { species_name: 'Cantharellus cibarius', find_count: 5, first_find: '2025-06-01', best_month: '2025-06', locations: [] },
        { species_name: 'Boletus edulis', find_count: 4, first_find: '2025-07-01', best_month: '2025-07', locations: [] },
      ],
      'en-US',
      t,
      new Date('2026-06-05'),
    );

    expect(insights).toHaveLength(2);
    expect(insights[0].title).toMatch(/June/);
    expect(insights[1].title).toMatch(/July/);
  });

  it('wraps next month from December to January', () => {
    const insights = buildSeasonalityInsights(
      [
        { month_num: 1, count: 4 },
        { month_num: 12, count: 7 },
      ],
      [
        { species_name: 'Pleurotus ostreatus', find_count: 5, first_find: '2025-12-01', best_month: '2025-12', locations: [] },
        { species_name: 'Flammulina velutipes', find_count: 3, first_find: '2025-01-01', best_month: '2025-01', locations: [] },
      ],
      'en-US',
      t,
      new Date('2026-12-10'),
    );

    expect(insights).toHaveLength(2);
    expect(insights[0].title).toMatch(/December/);
    expect(insights[1].title).toMatch(/January/);
  });
});

describe('buildSpeciesSpotHint', () => {
  it('returns a hint for current/next month species and location', () => {
    const hint = buildSpeciesSpotHint(
      [
        {
          species_name: 'Morchella *esculenta*',
          find_count: 5,
          first_find: '2025-04-01',
          best_month: '2025-04',
          locations: [{ country: 'Croatia', region: 'Istria', location_note: 'oak grove' }],
        },
      ],
      [{ country: 'Croatia', region: 'Istria', location_note: 'oak grove', count: 3 }],
      'en-US',
      t,
      new Date('2026-04-16'),
    );

    expect(hint).toContain('[[species:Morchella *esculenta*]]');
    expect(hint).toContain('Croatia / Istria / oak grove');
  });
});
