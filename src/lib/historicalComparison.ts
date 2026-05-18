import type { CalendarEntry } from './stats';
import { compareSpeciesNames } from './speciesName';

export interface YearBucket {
  year: number;
  findCount: number;
  species: string[]; // distinct Latin names, sorted
}

export interface HistoricalPeriodData {
  weekNum: number; // ISO week number 1-53
  monthNum: number; // 1-12
  byWeek: YearBucket[]; // previous years with finds in this ISO week
  byMonth: YearBucket[]; // previous years with finds in this month
}

/** ISO week number (1-53) for a given date. */
export function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Groups CalendarEntry records into per-year buckets for the current ISO week
 * and current calendar month. Entries from the current year are excluded so
 * only historical comparisons are shown.
 */
export function buildHistoricalComparison(
  entries: CalendarEntry[],
  today: Date = new Date(),
): HistoricalPeriodData {
  const currentYear = today.getFullYear();
  const currentWeek = getISOWeek(today);
  const currentMonth = today.getMonth() + 1;

  const weekByYear = new Map<number, { count: number; species: Set<string> }>();
  const monthByYear = new Map<number, { count: number; species: Set<string> }>();

  for (const entry of entries) {
    if (!entry.date_found) continue;
    const entryDate = new Date(entry.date_found);
    if (isNaN(entryDate.getTime())) continue;
    const year = entryDate.getFullYear();
    if (year >= currentYear) continue; // exclude current year

    const entryMonth = entryDate.getMonth() + 1;
    const entryWeek = getISOWeek(entryDate);
    const latinName = entry.species_name.trim();

    if (entryWeek === currentWeek) {
      if (!weekByYear.has(year)) weekByYear.set(year, { count: 0, species: new Set() });
      const b = weekByYear.get(year)!;
      b.count++;
      b.species.add(latinName);
    }

    if (entryMonth === currentMonth) {
      if (!monthByYear.has(year)) monthByYear.set(year, { count: 0, species: new Set() });
      const b = monthByYear.get(year)!;
      b.count++;
      b.species.add(latinName);
    }
  }

  const toSortedBuckets = (
    map: Map<number, { count: number; species: Set<string> }>,
  ): YearBucket[] =>
    Array.from(map.entries())
      .map(([year, data]) => ({
        year,
        findCount: data.count,
        species: Array.from(data.species).sort(compareSpeciesNames),
      }))
      .sort((a, b) => b.year - a.year); // most recent first

  return {
    weekNum: currentWeek,
    monthNum: currentMonth,
    byWeek: toSortedBuckets(weekByYear),
    byMonth: toSortedBuckets(monthByYear),
  };
}
