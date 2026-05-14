import React, { useMemo, useState } from 'react';
import { compareSpeciesNames } from '@/lib/speciesName';
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
import { buildSeasonalityInsights, buildSpeciesSpotHint } from '@/lib/insights';
import { HistoricalComparison } from '@/components/stats/HistoricalComparison';
import { buildHistoricalComparison } from '@/lib/historicalComparison';
import { useT } from '@/i18n/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderBold(text: string): React.ReactNode {
  const parts = text.split('**');
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
  );
}

function formatMonth(ym: string | null, locale: string): string {
  if (!ym) return '--';
  const [yearStr, monthStr] = ym.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (isNaN(year) || isNaN(month)) return '--';
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1),
  );
}


// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StatsTab() {
  const t = useT();
  const showDebugPdf = import.meta.env.DEV;
  const { data: statsCards, isLoading: statsLoading } = useStatsCards();
  const { data: topSpots } = useTopSpots();
  const { data: bestMonths } = useBestMonths();
  const { data: calendar } = useCalendar();
  const { data: speciesStats } = useSpeciesStats();
  const { data: finds } = useFinds();
  const storagePath = useAppStore((s) => s.storagePath);
  const lang = useAppStore((s) => s.language);
  const locale = lang === 'hr' ? 'hr-HR' : 'en-US';

  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfStage, setPdfStage] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const topSpotsFormatted = useMemo(() => {
    if (!topSpots) return [];
    return topSpots.map((s) => {
      const spotFinds = finds?.filter(
        (f) => f.country === s.country && f.region === s.region && f.location_note === s.location_note,
      ) ?? [];
      const species = [...new Set(spotFinds.map((f) => f.species_name))].sort(compareSpeciesNames);
      return {
        label: `${s.country} / ${s.region}${s.location_note ? ' / ' + s.location_note : ''}`,
        count: s.count,
        species,
      };
    });
  }, [topSpots, finds]);

  const bestMonthsFormatted = useMemo(() => {
    if (!bestMonths) return [];
    return bestMonths.map((s) => {
      const monthFinds = finds?.filter((f) => {
        if (!f.date_found) return false;
        return new Date(f.date_found).getMonth() + 1 === s.month_num;
      }) ?? [];
      const species = [...new Set(monthFinds.map((f) => f.species_name))].sort(compareSpeciesNames);
      return {
        label: new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2024, s.month_num - 1)),
        count: s.count,
        species,
      };
    });
  }, [bestMonths, finds, locale]);
  const totalPhotos = useMemo(
    () => finds?.reduce((sum, find) => sum + find.photos.length, 0) ?? 0,
    [finds],
  );
  const seasonalityInsights = useMemo(
    () => buildSeasonalityInsights(bestMonths, speciesStats, locale, t),
    [bestMonths, speciesStats, locale],
  );
  const speciesSpotHint = useMemo(
    () => buildSpeciesSpotHint(speciesStats, topSpots, locale, t),
    [speciesStats, topSpots, locale],
  );
  const historicalComparison = useMemo(
    () => (calendar ? buildHistoricalComparison(calendar) : null),
    [calendar],
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
      const path = await generateAndSavePdf(finds, storagePath, (msg) => {
        setPdfStage(msg);
      });
      if (path) {
        setStatusMessage(`PDF saved to ${path}`);
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[PDF export error]', err);
      setExportError(`PDF export failed: ${msg}`);
      setTimeout(() => setExportError(null), 15000);
    } finally {
      setPdfExporting(false);
      setPdfStage('');
    }
  };

  const handleExportPdfSmokeTest = async () => {
    if (!finds || finds.length === 0 || !storagePath) return;
    setPdfExporting(true);
    setExportError(null);
    try {
      const { generateAndSavePdf } = await import('@/lib/exportPdf');
      const path = await generateAndSavePdf(
        finds,
        storagePath,
        (msg) => {
          setPdfStage(msg);
        },
        { smokeTest: true },
      );
      if (path) {
        setStatusMessage(`Smoke-test PDF saved to ${path}`);
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[PDF smoke-test export error]', err);
      setExportError(`Smoke-test PDF failed: ${msg}`);
      setTimeout(() => setExportError(null), 15000);
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
        heading={t('stats.emptyHeading')}
        body={t('stats.emptyBody')}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="animate-fade-up px-6 pt-12 pb-8 space-y-8">
          {/* Page heading */}
          <h1 className="font-serif text-5xl font-semibold italic text-primary tracking-[0.01em]">{t('stats.pageTitle')}</h1>

          {/* Stat cards: 4-column grid */}
          <div className="grid grid-cols-4 gap-6">
            <StatCard label={t('stats.totalPhotos')} value={totalPhotos} index={0} />
            <StatCard label={t('stats.uniqueSpecies')} value={statsCards.unique_species} index={1} />
            <StatCard label={t('stats.locationsVisited')} value={statsCards.locations_visited} index={2} />
            <StatCard
              label={t('stats.mostActiveMonth')}
              value={formatMonth(statsCards.most_active_month, locale)}
              index={3}
              sublabel={statsCards.most_active_month ? undefined : t('stats.noDataYet')}
            />
          </div>

          {/* Divider */}
          <div className="border-b border-border" />

          {/* Historical weekly/monthly comparison */}
          {historicalComparison && (
            <div>
              <h3 className="text-base font-bold uppercase tracking-[0.12em] text-foreground mb-4">
                {t('stats.thisTimePastYears')}
              </h3>
              <HistoricalComparison data={historicalComparison} />
            </div>
          )}

          {/* Divider */}
          <div className="border-b border-border" />

          {/* Ranked lists: 2-column flex */}
          <div className="flex gap-4">
            <div className="flex-1">
              <RankedList
                title={t('stats.topSpots')}
                items={topSpotsFormatted}
                emptyMessage={t('stats.topSpotsEmpty')}
                pageSize={10}
              />
            </div>
            <div className="flex-1">
              <RankedList
                title={t('stats.bestMonths')}
                items={bestMonthsFormatted}
                emptyMessage={t('stats.bestMonthsEmpty')}
              />
            </div>
          </div>

          {/* Seasonal Insights */}
          {seasonalityInsights.length > 0 && (
            <div>
              <h3 className="text-base font-bold uppercase tracking-[0.12em] text-foreground mb-4">
                {t('stats.seasonalInsights')}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {seasonalityInsights.map((insight) => (
                  <div key={insight.title} className="rounded-lg border border-border/70 bg-card/60 p-4">
                    <p className="text-sm font-semibold text-primary">{renderBold(insight.title)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{renderBold(insight.body)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hint reminder */}
          {speciesSpotHint && (
            <Alert className="border-primary/35 bg-primary/8">
              <Compass className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm">{renderBold(speciesSpotHint)}</AlertDescription>
            </Alert>
          )}

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
                {t('stats.yourSpecies')}
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
            <span>{t('stats.exportHint')}</span>
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

        {showDebugPdf ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdfSmokeTest}
            disabled={pdfExporting || !finds || finds.length === 0}
            className="text-sm"
          >
            <FileText className="h-4 w-4 mr-1.5" />
            Quick PDF
          </Button>
        ) : null}

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
