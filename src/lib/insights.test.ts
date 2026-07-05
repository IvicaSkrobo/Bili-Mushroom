import { describe, expect, it } from 'vitest';
import { buildSpeciesSpotHint } from '@/lib/insights';

const t = (key: string, vars?: Record<string, string | number>) => {
  const templates: Record<string, string> = {
    'stats.spotHint': 'Hint: {species} peaks around {month} — try {location}.',
  };
  return Object.entries(vars ?? {}).reduce(
    (text, [name, value]) => text.replace(`{${name}}`, String(value)),
    templates[key] ?? key,
  );
};

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
