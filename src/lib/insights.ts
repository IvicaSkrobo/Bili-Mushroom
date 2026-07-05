import type { SpeciesStatSummary, TopSpot } from '@/lib/stats';

type Translator = (key: string, vars?: Record<string, string | number>) => string;

function markedSpeciesName(name: string): string {
  return `[[species:${name}]]`;
}

function localMonthName(monthNum: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2024, monthNum - 1));
}

function extractMonthNum(ym: string | null): number | null {
  if (!ym) return null;
  const [, monthStr] = ym.split('-');
  const month = parseInt(monthStr, 10);
  return Number.isNaN(month) ? null : month;
}

export function buildSpeciesSpotHint(
  speciesStats: SpeciesStatSummary[] | undefined,
  topSpots: TopSpot[] | undefined,
  locale: string,
  t: Translator,
  today: Date = new Date(),
): string | null {
  if (!speciesStats || speciesStats.length === 0) return null;

  const nowMonth = today.getMonth() + 1;
  const targetMonths = new Set([nowMonth, nowMonth === 12 ? 1 : nowMonth + 1]);

  const candidate = speciesStats
    .filter((s) => {
      const month = extractMonthNum(s.best_month);
      return month !== null && targetMonths.has(month) && s.locations.length > 0;
    })
    .sort((a, b) => b.find_count - a.find_count)[0];

  if (!candidate) return null;

  const matchingSpot = topSpots?.find((spot) =>
    candidate.locations.some((loc) =>
      loc.country === spot.country
      && loc.region === spot.region
      && loc.location_note === spot.location_note,
    ));

  const preferred = matchingSpot ?? {
    ...candidate.locations[0],
    count: 0,
  };

  const month = extractMonthNum(candidate.best_month);
  if (!month) return null;

  const locationParts = [preferred.country, preferred.region, preferred.location_note].filter(Boolean);

  return t('stats.spotHint', {
    species: markedSpeciesName(candidate.species_name),
    month: localMonthName(month, locale),
    location: locationParts.join(' / '),
  });
}
