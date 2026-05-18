import React, { useMemo, useState } from 'react';
import { compareSpeciesNames, renderSpeciesName } from '@/lib/speciesName';
import { Loader2, BarChart3, Download, FileText, Compass, CalendarDays, ChevronDown, ChevronUp, ListChecks, MapPin, Sprout } from 'lucide-react';
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
import { useFinds, useSpeciesProfiles } from '@/hooks/useFinds';
import { useAppStore } from '@/stores/appStore';
import { exportToCsv } from '@/lib/exportCsv';
import { buildSeasonalityInsights, buildSpeciesSpotHint } from '@/lib/insights';
import { HistoricalComparison } from '@/components/stats/HistoricalComparison';
import { buildHistoricalComparison } from '@/lib/historicalComparison';
import { useT } from '@/i18n/index';
import { formatDisplayDate } from '@/lib/dateFormat';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderMarkedText(text: string): React.ReactNode {
  const normalized = text
    .replace(/\*\*(\[\[species:.*?\]\])\*\*/g, '$1')
    .replace(/\*(\[\[species:.*?\]\])\*/g, '$1');
  const parts = normalized.split(/(\[\[species:.*?\]\])/g).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith('[[species:') && part.endsWith(']]')) {
      return (
        <span key={i} className="font-serif text-[0.92rem] font-bold italic text-foreground">
          {renderSpeciesName(part.slice(10, -2))}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
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

function formatShortDate(date: string | null | undefined, locale: string): string {
  if (!date) return '--';
  if (locale === 'hr-HR') {
    return formatDisplayDate(date, 'hr');
  }
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(parsed);
}

function locationLabel(find: { country?: string; region?: string; location_note?: string }): string {
  return [find.location_note, find.region, find.country].filter(Boolean).join(' / ');
}

function formatObservedCount(find: {
  observed_count?: number | null;
  observed_count_min?: number | null;
  observed_count_max?: number | null;
}): string | null {
  if (find.observed_count_min != null || find.observed_count_max != null) {
    if (find.observed_count_min != null && find.observed_count_max != null && find.observed_count_min !== find.observed_count_max) {
      return `${find.observed_count_min}-${find.observed_count_max}`;
    }
    return String(find.observed_count_min ?? find.observed_count_max);
  }
  if (find.observed_count != null) return String(find.observed_count);
  return null;
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
  const { data: speciesProfiles } = useSpeciesProfiles();
  const storagePath = useAppStore((s) => s.storagePath);
  const lang = useAppStore((s) => s.language);
  const locale = lang === 'hr' ? 'hr-HR' : 'en-US';

  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfStage, setPdfStage] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [fieldOutingsExpanded, setFieldOutingsExpanded] = useState(false);
  const [expandedOutingDates, setExpandedOutingDates] = useState<Set<string>>(() => new Set());
  const topSpotsFormatted = useMemo(() => {
    if (!topSpots) return [];
    return topSpots.map((s) => {
      const spotFinds = finds?.filter(
        (f) => f.country === s.country && f.region === s.region && f.location_note === s.location_note,
      ) ?? [];
      const species = [...new Set(spotFinds.map((f) => f.species_name))].sort(compareSpeciesNames);
      return {
        label: `${s.country} / ${s.region}${s.location_note ? ' / ' + s.location_note : ''}`,
        count: species.length,
        countLabel: t('stats.speciesCount', { species: species.length }),
        species,
      };
    });
  }, [topSpots, finds, t]);

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
        count: species.length,
        countLabel: t('stats.speciesCount', { species: species.length }),
        species,
      };
    });
  }, [bestMonths, finds, locale, t]);
  const totalPhotos = useMemo(
    () => finds?.reduce((sum, find) => sum + find.photos.length, 0) ?? 0,
    [finds],
  );
  const mostActiveMonthSummary = useMemo(() => {
    const activeMonth = statsCards?.most_active_month;
    if (!activeMonth) return null;
    const monthFinds = (finds ?? []).filter((find) => find.date_found?.startsWith(activeMonth));
    const speciesCount = new Set(monthFinds.map((find) => find.species_name).filter(Boolean)).size;
    return t('stats.findSpeciesCount', { finds: monthFinds.length, species: speciesCount });
  }, [finds, statsCards?.most_active_month, t]);
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
  const fieldOutings = useMemo(() => {
    const byDate = new Map<string, {
      date: string;
      count: number;
      locations: Set<string>;
      species: Set<string>;
      finds: NonNullable<typeof finds>;
    }>();
    for (const find of finds ?? []) {
      if (!find.date_found) continue;
      const bucket = byDate.get(find.date_found) ?? {
        date: find.date_found,
        count: 0,
        locations: new Set<string>(),
        species: new Set<string>(),
        finds: [],
      };
      bucket.count += 1;
      const loc = locationLabel(find);
      if (loc) bucket.locations.add(loc);
      if (find.species_name) bucket.species.add(find.species_name);
      bucket.finds.push(find);
      byDate.set(find.date_found, bucket);
    }
    return Array.from(byDate.values()).map((outing) => {
      const locationMap = new Map<string, { label: string; count: number; species: Set<string> }>();
      const speciesMap = new Map<string, { name: string; count: number; locations: Set<string> }>();

      for (const find of outing.finds) {
        const loc = locationLabel(find) || t('stats.noLocation');
        const locationEntry = locationMap.get(loc) ?? { label: loc, count: 0, species: new Set<string>() };
        locationEntry.count += 1;
        if (find.species_name) locationEntry.species.add(find.species_name);
        locationMap.set(loc, locationEntry);

        const speciesName = find.species_name || t('findCard.unnamed');
        const speciesEntry = speciesMap.get(speciesName) ?? { name: speciesName, count: 0, locations: new Set<string>() };
        speciesEntry.count += 1;
        speciesEntry.locations.add(loc);
        speciesMap.set(speciesName, speciesEntry);
      }

      return {
        ...outing,
        locationDetails: Array.from(locationMap.values())
          .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'hr', { sensitivity: 'base' })),
        speciesDetails: Array.from(speciesMap.values())
          .sort((a, b) => b.count - a.count || compareSpeciesNames(a.name, b.name)),
      };
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [finds, t]);
  const firstOuting = fieldOutings[fieldOutings.length - 1] ?? null;
  const visibleFieldOutings = fieldOutingsExpanded ? fieldOutings : fieldOutings.slice(0, 8);

  const toggleOutingDetails = (date: string) => {
    setExpandedOutingDates((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const handleExportCsv = async () => {
    if (!finds || finds.length === 0) return;
    setExportError(null);
    try {
      const path = await exportToCsv(finds);
      if (path) {
        setStatusMessage(t('stats.csvSaved', { path }));
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch {
      setExportError(t('stats.csvExportFailed'));
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
        setStatusMessage(t('stats.pdfSaved', { path }));
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[PDF export error]', err);
      setExportError(t('stats.pdfExportFailed', { message: msg }));
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
        setStatusMessage(t('stats.smokePdfSaved', { path }));
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[PDF smoke-test export error]', err);
      setExportError(t('stats.smokePdfFailed', { message: msg }));
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
          <div className="grid grid-cols-5 gap-6">
            <StatCard label={t('stats.totalPhotos')} value={totalPhotos} index={0} />
            <StatCard label={t('stats.uniqueSpecies')} value={statsCards.unique_species} index={1} />
            <StatCard label={t('stats.locationsVisited')} value={statsCards.locations_visited} index={2} />
            <StatCard
              label={t('stats.mostActiveMonth')}
              value={formatMonth(statsCards.most_active_month, locale)}
              index={3}
              sublabel={statsCards.most_active_month ? mostActiveMonthSummary ?? undefined : t('stats.noDataYet')}
            />
            <StatCard
              label={t('stats.firstOuting')}
              value={firstOuting ? formatShortDate(firstOuting.date, locale) : '--'}
              index={4}
              sublabel={firstOuting ? t('stats.totalOutings', { count: fieldOutings.length }) : t('stats.noDataYet')}
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
                speciesProfiles={speciesProfiles}
              />
            </div>
            <div className="flex-1">
              <RankedList
                title={t('stats.bestMonths')}
                items={bestMonthsFormatted}
                emptyMessage={t('stats.bestMonthsEmpty')}
                speciesProfiles={speciesProfiles}
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
                    <p className="text-sm font-semibold text-primary">{renderMarkedText(insight.title)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{renderMarkedText(insight.body)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hint reminder */}
          {speciesSpotHint && (
            <Alert className="border-primary/35 bg-primary/8">
              <Compass className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm">{renderMarkedText(speciesSpotHint)}</AlertDescription>
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
                    finds={finds ?? []}
                    speciesProfile={speciesProfiles?.find((profile) => profile.species_name === s.species_name) ?? null}
                  />
                ))}
              </div>
            </div>
          )}

          {fieldOutings.length > 0 && (
            <div>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-base font-bold uppercase tracking-[0.12em] text-foreground">
                  {t('stats.fieldOutings')}
                </h3>
                {fieldOutings.length > 8 && (
                  <button
                    type="button"
                    onClick={() => setFieldOutingsExpanded((value) => !value)}
                    className="text-xs text-primary/70 transition-colors hover:text-primary"
                  >
                    {fieldOutingsExpanded ? t('stats.showLess') : t('stats.showAll', { count: fieldOutings.length })}
                  </button>
                )}
              </div>
              <div className="grid gap-2">
                {visibleFieldOutings.map((outing, idx) => {
                  const locations = Array.from(outing.locations);
                  const isOutingOpen = expandedOutingDates.has(outing.date);
                  return (
                    <div
                      key={outing.date}
                      className="stagger-item overflow-hidden rounded-sm border border-border/70 bg-card shadow-sm transition-colors hover:border-primary/35"
                      style={{ animationDelay: `${Math.min(idx * 30, 240)}ms` }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleOutingDetails(outing.date)}
                        className="flex w-full items-start gap-3 px-3 py-2.5 text-left"
                      >
                        <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <p className="font-mono text-sm font-semibold text-foreground">
                              {formatShortDate(outing.date, locale)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t('stats.outingSummary', {
                                finds: outing.count,
                                species: outing.species.size,
                                locations: locations.length,
                              })}
                            </p>
                          </div>
                          {locations.length > 0 && (
                            <p className="mt-1 truncate text-xs text-muted-foreground/75" title={locations.join(' · ')}>
                              {locations.join(' · ')}
                            </p>
                          )}
                        </div>
                        {isOutingOpen ? (
                          <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                      </button>

                      {isOutingOpen && (
                        <div className="border-t border-border/60 bg-muted/35 px-3 py-3">
                          <div className="grid gap-3 lg:grid-cols-3">
                            <div className="rounded-sm border border-border/60 bg-card/70 p-2.5">
                              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5 text-primary" />
                                {t('stats.outingLocations')}
                              </div>
                              <div className="space-y-1.5">
                                {outing.locationDetails.map((loc) => (
                                  <div key={loc.label} className="flex items-start justify-between gap-2 text-xs">
                                    <span className="min-w-0 truncate text-foreground" title={loc.label}>{loc.label}</span>
                                    <span className="shrink-0 font-mono text-muted-foreground">
                                      {t('stats.outingLocationCount', { finds: loc.count, species: loc.species.size })}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-sm border border-border/60 bg-card/70 p-2.5">
                              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                                <Sprout className="h-3.5 w-3.5 text-primary" />
                                {t('stats.outingSpecies')}
                              </div>
                              <div className="space-y-1.5">
                                {outing.speciesDetails.map((species) => (
                                  <div key={species.name} className="flex items-start justify-between gap-2 text-xs">
                                    <span className="min-w-0 truncate font-serif italic text-foreground" title={species.name}>
                                      {renderSpeciesName(species.name)}
                                    </span>
                                    <span className="shrink-0 font-mono text-muted-foreground">
                                      {t('stats.outingFindCount', { finds: species.count })}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-sm border border-border/60 bg-card/70 p-2.5">
                              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                                <ListChecks className="h-3.5 w-3.5 text-primary" />
                                {t('stats.outingFinds')}
                              </div>
                              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                                {outing.finds.map((find) => {
                                  const observed = formatObservedCount(find);
                                  const loc = locationLabel(find) || t('stats.noLocation');
                                  return (
                                    <div key={find.id} className="border-b border-border/50 pb-1.5 last:border-b-0 last:pb-0">
                                      <div className="flex items-baseline justify-between gap-2">
                                        <span className="min-w-0 truncate font-serif text-xs font-semibold italic text-foreground" title={find.species_name}>
                                          {find.species_name ? renderSpeciesName(find.species_name) : t('findCard.unnamed')}
                                        </span>
                                        {observed && (
                                          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                                            {observed} {t('findCard.countUnit')}
                                          </span>
                                        )}
                                      </div>
                                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80" title={loc}>{loc}</p>
                                      {find.notes.trim() && (
                                        <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                                          {find.notes.trim()}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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
