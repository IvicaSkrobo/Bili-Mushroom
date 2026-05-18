import type { BestMonth, SpeciesStatSummary, TopSpot } from '@/lib/stats';

export interface SeasonalityInsight {
  title: string;
  body: string;
}

type Translator = (key: string, vars?: Record<string, string | number>) => string;

function localMonthName(monthNum: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2024, monthNum - 1));
}

function extractMonthNum(ym: string | null): number | null {
  if (!ym) return null;
  const [, monthStr] = ym.split('-');
  const month = parseInt(monthStr, 10);
  return Number.isNaN(month) ? null : month;
}

export function buildSeasonalityInsights(
  bestMonths: BestMonth[] | undefined,
  speciesStats: SpeciesStatSummary[] | undefined,
  locale: string,
  t: Translator,
): SeasonalityInsight[] {
  if (!bestMonths || bestMonths.length === 0 || !speciesStats || speciesStats.length === 0) return [];

  const topMonths = bestMonths.slice(0, 2);
  const insights: SeasonalityInsight[] = [];

  for (const month of topMonths) {
    const monthLabel = localMonthName(month.month_num, locale);
    const species = speciesStats
      .filter((s) => extractMonthNum(s.best_month) === month.month_num)
      .sort((a, b) => b.find_count - a.find_count)
      .slice(0, 2)
      .map((s) => s.species_name);

    insights.push({
      title: t('stats.insightStrong', { month: monthLabel }),
      body: species.length > 0
        ? t('stats.insightMostActive', { species: species.join(' · ') })
        : t('stats.insightLogged', { count: month.count, month: monthLabel }),
    });
  }

  return insights;
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
    species: candidate.species_name,
    month: localMonthName(month, locale),
    location: locationParts.join(' / '),
  });
}
