import { describe, expect, it } from 'vitest';
import { buildSeasonalityInsights, buildSpeciesSpotHint } from '@/lib/insights';

describe('buildSeasonalityInsights', () => {
  it('returns top month insight cards with species', () => {
    const insights = buildSeasonalityInsights(
      [
        { month_num: 9, count: 12 },
        { month_num: 10, count: 9 },
      ],
      [
        { species_name: 'Boletus', find_count: 6, first_find: '2025-09-01', best_month: '2025-09', locations: [] },
        { species_name: 'Cantharellus', find_count: 4, first_find: '2025-09-03', best_month: '2025-09', locations: [] },
      ],
    );

    expect(insights).toHaveLength(2);
    expect(insights[0].title).toMatch(/September/);
    expect(insights[0].body).toContain('Boletus');
  });
});

describe('buildSpeciesSpotHint', () => {
  it('returns a hint for current/next month species and location', () => {
    const hint = buildSpeciesSpotHint(
      [
        {
          species_name: 'Morchella',
          find_count: 5,
          first_find: '2025-04-01',
          best_month: '2025-04',
          locations: [{ country: 'Croatia', region: 'Istria', location_note: 'oak grove' }],
        },
      ],
      [{ country: 'Croatia', region: 'Istria', location_note: 'oak grove', count: 3 }],
      new Date('2026-04-16'),
    );

    expect(hint).toContain('Morchella');
    expect(hint).toContain('Croatia / Istria / oak grove');
  });
});
