import { Loader2, BarChart3 } from 'lucide-react';
import { EmptyState } from '@/components/layout/EmptyState';
import { StatCard } from '@/components/stats/StatCard';
import { RankedList } from '@/components/stats/RankedList';
import { SeasonalCalendar } from '@/components/stats/SeasonalCalendar';
import { SpeciesStatRow } from '@/components/stats/SpeciesStatRow';
import {
  useStatsCards,
  useTopSpots,
  useBestMonths,
  useCalendar,
  useSpeciesStats,
} from '@/hooks/useStats';
import type { TopSpot, BestMonth } from '@/lib/stats';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMonth(ym: string | null): string {
  if (!ym) return '--';
  const [yearStr, monthStr] = ym.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (isNaN(year) || isNaN(month)) return '--';
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1),
  );
}

function formatTopSpots(spots: TopSpot[] | undefined): { label: string; count: number }[] {
  if (!spots) return [];
  return spots.map((s) => ({
    label: `${s.country} / ${s.region}${s.location_note ? ' / ' + s.location_note : ''}`,
    count: s.count,
  }));
}

function formatBestMonths(months: BestMonth[] | undefined): { label: string; count: number }[] {
  if (!months) return [];
  return months.map((s) => ({
    label: new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2024, s.month_num - 1)),
    count: s.count,
  }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StatsTab() {
  const { data: statsCards, isLoading: statsLoading } = useStatsCards();
  const { data: topSpots } = useTopSpots();
  const { data: bestMonths } = useBestMonths();
  const { data: calendar } = useCalendar();
  const { data: speciesStats } = useSpeciesStats();

  // Loading state
  if (statsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Empty state: no finds yet
  if (!statsCards || statsCards.total_finds === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        heading="Your story starts with one find"
        body="Import your first mushroom photo to see your foraging stats here."
      />
    );
  }

  const topSpotsFormatted = formatTopSpots(topSpots);
  const bestMonthsFormatted = formatBestMonths(bestMonths);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="animate-fade-up px-6 pt-12 pb-8 space-y-8">
        {/* Page heading */}
        <h1 className="font-serif text-4xl font-bold italic text-primary">Your Foraging Story</h1>

        {/* Stat cards: 4-column grid */}
        <div className="grid grid-cols-4 gap-6">
          <StatCard label="TOTAL FINDS" value={statsCards.total_finds} index={0} />
          <StatCard label="UNIQUE SPECIES" value={statsCards.unique_species} index={1} />
          <StatCard label="LOCATIONS VISITED" value={statsCards.locations_visited} index={2} />
          <StatCard
            label="MOST ACTIVE MONTH"
            value={formatMonth(statsCards.most_active_month)}
            index={3}
            sublabel={statsCards.most_active_month ? undefined : 'No data yet'}
          />
        </div>

        {/* Divider */}
        <div className="border-b border-border" />

        {/* Ranked lists: 2-column flex */}
        <div className="flex gap-4">
          <div className="flex-1">
            <RankedList
              title="Top Spots"
              items={topSpotsFormatted}
              emptyMessage="Start foraging to see your favourite spots appear here."
            />
          </div>
          <div className="flex-1">
            <RankedList
              title="Best Months"
              items={bestMonthsFormatted}
              emptyMessage="Your most active months will appear here as you record more finds."
            />
          </div>
        </div>

        {/* Divider */}
        <div className="border-b border-border" />

        {/* Seasonal calendar */}
        {calendar && <SeasonalCalendar entries={calendar} />}

        {/* Divider */}
        <div className="border-b border-border" />

        {/* Per-species section */}
        {speciesStats && speciesStats.length > 0 && (
          <div>
            <h3 className="text-base font-bold uppercase tracking-[0.12em] text-foreground mb-4">
              Your Species
            </h3>
            <div className="space-y-2">
              {speciesStats.map((s, idx) => (
                <SpeciesStatRow
                  key={s.species_name}
                  stat={s}
                  rank={idx + 1}
                  index={idx}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
