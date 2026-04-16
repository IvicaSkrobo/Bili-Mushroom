import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/stores/appStore';
import {
  getStatsCards,
  getTopSpots,
  getBestMonths,
  getCalendar,
  getSpeciesStats,
  STATS_QUERY_KEY,
  TOP_SPOTS_QUERY_KEY,
  BEST_MONTHS_QUERY_KEY,
  CALENDAR_QUERY_KEY,
  SPECIES_STATS_QUERY_KEY,
  type StatsCards,
  type TopSpot,
  type BestMonth,
  type CalendarEntry,
  type SpeciesStatSummary,
} from '@/lib/stats';

export function useStatsCards() {
  const storagePath = useAppStore((s) => s.storagePath);
  return useQuery<StatsCards>({
    queryKey: [STATS_QUERY_KEY, storagePath],
    queryFn: () => getStatsCards(storagePath!),
    enabled: !!storagePath,
  });
}

export function useTopSpots() {
  const storagePath = useAppStore((s) => s.storagePath);
  return useQuery<TopSpot[]>({
    queryKey: [TOP_SPOTS_QUERY_KEY, storagePath],
    queryFn: () => getTopSpots(storagePath!),
    enabled: !!storagePath,
  });
}

export function useBestMonths() {
  const storagePath = useAppStore((s) => s.storagePath);
  return useQuery<BestMonth[]>({
    queryKey: [BEST_MONTHS_QUERY_KEY, storagePath],
    queryFn: () => getBestMonths(storagePath!),
    enabled: !!storagePath,
  });
}

export function useCalendar() {
  const storagePath = useAppStore((s) => s.storagePath);
  return useQuery<CalendarEntry[]>({
    queryKey: [CALENDAR_QUERY_KEY, storagePath],
    queryFn: () => getCalendar(storagePath!),
    enabled: !!storagePath,
  });
}

export function useSpeciesStats() {
  const storagePath = useAppStore((s) => s.storagePath);
  return useQuery<SpeciesStatSummary[]>({
    queryKey: [SPECIES_STATS_QUERY_KEY, storagePath],
    queryFn: () => getSpeciesStats(storagePath!),
    enabled: !!storagePath,
  });
}
