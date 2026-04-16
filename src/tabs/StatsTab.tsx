import { useMemo, useState } from 'react';
import { Loader2, BarChart3, Download, FileText, Compass } from 'lucide-react';
import { EmptyState } from '@/components/layout/EmptyState';
import { StatCard } from '@/components/stats/StatCard';
import { RankedList } from '@/components/stats/RankedList';
import { SeasonalCalendar } from '@/components/stats/SeasonalCalendar';
import { SpeciesStatRow } from '@/components/stats/SpeciesStatRow';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  useStatsCards,
  useTopSpots,
  useBestMonths,
  useCalendar,
  useSpeciesStats,
} from '@/hooks/useStats';
import { useFinds } from '@/hooks/useFinds';
import { useAppStore } from '@/stores/appStore';
import { exportToCsv } from '@/lib/exportCsv';
import type { TopSpot, BestMonth } from '@/lib/stats';
import { buildSeasonalityInsights, buildSpeciesSpotHint } from '@/lib/insights';

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
  const { data: finds } = useFinds();
  const storagePath = useAppStore((s) => s.storagePath);

  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfStage, setPdfStage] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const topSpotsFormatted = useMemo(() => formatTopSpots(topSpots), [topSpots]);
  const bestMonthsFormatted = useMemo(() => formatBestMonths(bestMonths), [bestMonths]);
  const seasonalityInsights = useMemo(
    () => buildSeasonalityInsights(bestMonths, speciesStats),
    [bestMonths, speciesStats],
  );
  const speciesSpotHint = useMemo(
    () => buildSpeciesSpotHint(speciesStats, topSpots),
    [speciesStats, topSpots],
  );

  const handleExportCsv = async () => {
    if (!finds || finds.length === 0) return;
    setExportError(null);
    try {
      const path = await exportToCsv(finds);
      if (path) {
        setStatusMessage(`CSV saved to ${path}`);
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch {
      setExportError('CSV export failed. Try again.');
      setTimeout(() => setExportError(null), 5000);
    }
  };

  const handleExportPdf = async () => {
    if (!finds || finds.length === 0 || !storagePath) return;
    setPdfExporting(true);
    setExportError(null);
    try {
      const { generateAndSavePdf } = await import('@/lib/exportPdf');
      const path = await generateAndSavePdf(finds, storagePath, (stage) => {
        setPdfStage(
          stage === 'photos'
            ? 'Loading photos...'
            : stage === 'rendering'
              ? 'Generating PDF...'
              : 'Saving...',
        );
      });
      if (path) {
        setStatusMessage(`PDF saved to ${path}`);
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch {
      setExportError('PDF export failed. Try again.');
      setTimeout(() => setExportError(null), 5000);
    } finally {
      setPdfExporting(false);
      setPdfStage('');
    }
  };

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

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="animate-fade-up px-6 pt-12 pb-8 space-y-8">
          {/* Page heading */}
          <h1 className="font-serif text-5xl font-semibold italic text-primary tracking-[0.01em]">Your Foraging Story</h1>

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

          {/* Seasonal Insights */}
          {seasonalityInsights.length > 0 && (
            <div>
              <h3 className="text-base font-bold uppercase tracking-[0.12em] text-foreground mb-4">
                Seasonal Insights
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {seasonalityInsights.map((insight) => (
                  <div key={insight.title} className="rounded-lg border border-border/70 bg-card/60 p-4">
                    <p className="text-sm font-semibold text-primary">{insight.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{insight.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hint reminder */}
          {speciesSpotHint && (
            <Alert className="border-primary/35 bg-primary/8">
              <Compass className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm">{speciesSpotHint}</AlertDescription>
            </Alert>
          )}

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

      {/* Export action bar — sticky footer per UI-SPEC R-03 */}
      <div className="border-t border-border/70 bg-card/60 backdrop-blur-md px-6 py-4 flex items-center justify-end gap-3 shrink-0">
        {/* Status / error messages */}
        <div className="flex-1 text-xs text-muted-foreground">
          {statusMessage && !exportError && !pdfExporting && (
            <span className="animate-fade-up">{statusMessage}</span>
          )}
          {exportError && <span className="text-destructive">{exportError}</span>}
          {pdfExporting && <span>{pdfStage}</span>}
          {!statusMessage && !exportError && !pdfExporting && (
            <span>Export your full collection</span>
          )}
        </div>

        {/* CSV export button — outline variant */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          disabled={pdfExporting || !finds || finds.length === 0}
          className="text-sm"
        >
          <Download className="h-4 w-4 mr-1.5" />
          Export CSV
        </Button>

        {/* PDF export button — primary/amber variant */}
        <Button
          size="sm"
          onClick={handleExportPdf}
          disabled={pdfExporting || !finds || finds.length === 0}
          className="text-sm"
        >
          {pdfExporting ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <FileText className="h-4 w-4 mr-1.5" />
          )}
          {pdfExporting ? 'Generating PDF...' : 'Export PDF'}
        </Button>
      </div>
    </div>
  );
}
