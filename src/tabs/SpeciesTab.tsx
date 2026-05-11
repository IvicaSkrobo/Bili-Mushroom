import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Calendar, Camera, Info, MapPin, Pencil, Search, Star } from 'lucide-react';
import { EmptyState } from '@/components/layout/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useFinds, useSpeciesNotes, useSpeciesProfiles, useUpsertSpeciesProfile } from '@/hooks/useFinds';
import { useAppStore } from '@/stores/appStore';
import { useT } from '@/i18n/index';
import { isInternalLibraryName } from '@/lib/internalEntries';
import type { Find, FindPhoto } from '@/lib/finds';
import { resolvePhotoSrc } from '@/lib/photoSrc';
import { EdibilitySelectBadge, ThreatStatusSelectBadge, DistributionSelectBadge } from '@/components/species/StatusSelectBadge';
import { PhotoLightbox } from '@/components/finds/PhotoLightbox';
import { renderSpeciesName, plainSpeciesName } from '@/lib/speciesName';

interface DateSummary {
  date: string;
  recordedFinds: number;
  observedCountLabel: string | null;
}

interface YearSummary {
  year: string;
  recordedFinds: number;
  observedCountLabel: string | null;
}

interface SpeciesJournal {
  speciesName: string;
  finds: Find[];
  allPhotos: Array<{ photo: FindPhoto; find: Find }>;
  heroPhotoPath: string | null;
  heroPhotoId: number | null;
  recordedFinds: number;
  observedCountTotalLabel: string | null;
  observedCountKnown: boolean;
  favoriteCount: number;
  daysRecorded: number;
  firstRecorded: string | null;
  lastRecorded: string | null;
  strongestYear: string | null;
  strongestYearCount: number;
  bestMonth: number | null;
  seasonStartMonth: number | null;
  seasonEndMonth: number | null;
  topSpotLabel: string | null;
  topSpotCount: number;
  topSpotObservedCountLabel: string | null;
  topSpotFavoriteCount: number;
  topSpotLastRecorded: string | null;
  dateSummaries: DateSummary[];
  yearSummaries: YearSummary[];
}

function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const tag of tags) {
    const value = tag.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(value);
  }
  return cleaned;
}

function formatDate(date: string | null, locale: string): string {
  if (!date) return '--';
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed);
}

function formatMonth(month: number | null, locale: string): string | null {
  if (!month) return null;
  return new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2024, month - 1, 1));
}

function monthsBetweenDates(earlier: Date, later: Date): number {
  const yearDiff = later.getFullYear() - earlier.getFullYear();
  const monthDiff = later.getMonth() - earlier.getMonth();
  return yearDiff * 12 + monthDiff;
}

function getObservedRange(find: Pick<Find, 'observed_count' | 'observed_count_min' | 'observed_count_max'>) {
  const min = find.observed_count_min ?? find.observed_count;
  const max = find.observed_count_max ?? find.observed_count_min ?? find.observed_count;
  if (min == null && max == null) return null;
  const low = min ?? max!;
  const high = max ?? min!;
  return { min: Math.min(low, high), max: Math.max(low, high) };
}

function formatObservedRange(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  const low = min ?? max!;
  const high = max ?? min!;
  return low === high ? String(low) : `${low}-${high}`;
}

function buildWhenToLookCopy(
  journal: SpeciesJournal,
  locale: string,
  t: ReturnType<typeof useT>,
  today: Date,
): string {
  if (!journal.bestMonth || !journal.seasonStartMonth || !journal.seasonEndMonth) {
    return t('species.whenToLookEmpty');
  }

  const parts: string[] = [];
  const bestMonth = formatMonth(journal.bestMonth, locale) ?? '--';
  const seasonStart = formatMonth(journal.seasonStartMonth, locale) ?? '--';
  const seasonEnd = formatMonth(journal.seasonEndMonth, locale) ?? '--';

  if (journal.seasonStartMonth === journal.seasonEndMonth) {
    parts.push(t('species.whenToLookSingleMonth', { month: bestMonth }));
  } else {
    parts.push(t('species.whenToLookRange', {
      month: bestMonth,
      start: seasonStart,
      end: seasonEnd,
    }));
  }

  if (journal.lastRecorded) {
    parts.push(t('species.whenToLookLastRecorded', { date: formatDate(journal.lastRecorded, locale) }));

    const lastRecordedDate = new Date(`${journal.lastRecorded}T00:00:00`);
    if (!Number.isNaN(lastRecordedDate.getTime())) {
      const monthsSinceLastSeen = monthsBetweenDates(lastRecordedDate, today);
      if (monthsSinceLastSeen >= 12) {
        parts.push(t('species.whenToLookStale', { date: formatDate(journal.lastRecorded, locale) }));
      }
    }
  }

  if (journal.strongestYear && journal.strongestYearCount > 1) {
    parts.push(t('species.whenToLookStrongestYear', {
      year: journal.strongestYear,
      count: journal.strongestYearCount,
    }));
  }

  return parts.join(' ');
}

function buildBestSpotCopy(journal: SpeciesJournal, locale: string, t: ReturnType<typeof useT>): string {
  if (!journal.topSpotLabel) {
    return t('species.bestSpotEmpty');
  }

  const parts = [
    t('species.bestSpotHint', {
      spot: journal.topSpotLabel,
      count: journal.topSpotCount,
    }),
  ];

  if (journal.topSpotObservedCountLabel != null) {
    parts.push(t('species.bestSpotObserved', { count: journal.topSpotObservedCountLabel }));
  }

  if (journal.topSpotFavoriteCount > 0) {
    parts.push(t('species.bestSpotFavorite', { count: journal.topSpotFavoriteCount }));
  }

  if (journal.topSpotLastRecorded) {
    parts.push(t('species.bestSpotLastRecorded', { date: formatDate(journal.topSpotLastRecorded, locale) }));
  }

  return parts.join(' ');
}

function buildSpeciesJournal(speciesName: string, finds: Find[], coverPhotoId: number | null): SpeciesJournal {
  const sortedFinds = [...finds].sort((a, b) => {
    const dateCmp = b.date_found.localeCompare(a.date_found);
    return dateCmp !== 0 ? dateCmp : b.id - a.id;
  });

  const allPhotos = sortedFinds.flatMap((find) => find.photos.map((photo) => ({ photo, find })));
  const heroPhotoEntry = allPhotos.find((entry) => entry.photo.id === coverPhotoId) ?? allPhotos[0] ?? null;
  const heroPhotoPath = heroPhotoEntry?.photo.photo_path ?? null;
  const heroPhotoId = heroPhotoEntry?.photo.id ?? null;

  const uniqueDates = new Set(sortedFinds.map((find) => find.date_found));

  const monthCounts = new Map<number, number>();
  const spotCounts = new Map<string, {
    label: string;
    count: number;
    observedMidpointSum: number;
    observedWithCount: number;
    favoriteCount: number;
    lastRecorded: string | null;
  }>();
  const dateCounts = new Map<string, { recordedFinds: number; observedMidpointSum: number; observedWithCount: number; observedKnown: boolean }>();
  const yearCounts = new Map<string, { recordedFinds: number; observedMidpointSum: number; observedWithCount: number; observedKnown: boolean }>();

  let observedMidpointSum = 0;
  let observedWithCount = 0;
  let observedCountKnown = false;
  let favoriteCount = 0;

  for (const find of sortedFinds) {
    const month = Number.parseInt(find.date_found.slice(5, 7), 10);
    monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);

    const spotLabel = [find.country, find.region, find.location_note].filter(Boolean).join(' / ');
    if (spotLabel) {
      const existingSpot = spotCounts.get(spotLabel) ?? {
        label: spotLabel,
        count: 0,
        observedMidpointSum: 0,
        observedWithCount: 0,
        favoriteCount: 0,
        lastRecorded: null,
      };
      const observedRange = getObservedRange(find);
      const midpoint = observedRange != null ? (observedRange.min + observedRange.max) / 2 : null;
      spotCounts.set(spotLabel, {
        label: spotLabel,
        count: existingSpot.count + 1,
        observedMidpointSum: existingSpot.observedMidpointSum + (midpoint ?? 0),
        observedWithCount: existingSpot.observedWithCount + (midpoint != null ? 1 : 0),
        favoriteCount: existingSpot.favoriteCount + (find.is_favorite ? 1 : 0),
        lastRecorded: existingSpot.lastRecorded && existingSpot.lastRecorded > find.date_found
          ? existingSpot.lastRecorded
          : find.date_found,
      });
    }

    if (find.is_favorite) {
      favoriteCount += 1;
    }

    const currentDate = dateCounts.get(find.date_found) ?? {
      recordedFinds: 0,
      observedMidpointSum: 0,
      observedWithCount: 0,
      observedKnown: false,
    };
    currentDate.recordedFinds += 1;
    const observedRange = getObservedRange(find);
    const midpoint = observedRange != null ? (observedRange.min + observedRange.max) / 2 : null;
    if (midpoint != null) {
      currentDate.observedMidpointSum += midpoint;
      currentDate.observedWithCount += 1;
      currentDate.observedKnown = true;
      observedMidpointSum += midpoint;
      observedWithCount += 1;
      observedCountKnown = true;
    }
    dateCounts.set(find.date_found, currentDate);

    const year = find.date_found.slice(0, 4);
    const currentYear = yearCounts.get(year) ?? {
      recordedFinds: 0,
      observedMidpointSum: 0,
      observedWithCount: 0,
      observedKnown: false,
    };
    currentYear.recordedFinds += 1;
    if (midpoint != null) {
      currentYear.observedMidpointSum += midpoint;
      currentYear.observedWithCount += 1;
      currentYear.observedKnown = true;
    }
    yearCounts.set(year, currentYear);
  }

  const bestMonth = Array.from(monthCounts.entries()).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
  const seasonMonths = Array.from(monthCounts.keys()).sort((a, b) => a - b);
  const topSpot = Array.from(spotCounts.values()).sort((a, b) =>
    b.favoriteCount - a.favoriteCount ||
    b.observedMidpointSum - a.observedMidpointSum ||
    b.count - a.count ||
    (b.lastRecorded ?? '').localeCompare(a.lastRecorded ?? '') ||
    a.label.localeCompare(b.label))[0] ?? null;

  const dateSummaries = Array.from(dateCounts.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 8)
    .map(([date, summary]) => ({
      date,
      recordedFinds: summary.recordedFinds,
      observedCountLabel: summary.observedKnown
        ? String(Math.round(summary.observedMidpointSum / summary.observedWithCount))
        : null,
    }));

  const yearSummaries = Array.from(yearCounts.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, summary]) => ({
      year,
      recordedFinds: summary.recordedFinds,
      observedCountLabel: summary.observedKnown
        ? String(Math.round(summary.observedMidpointSum / summary.observedWithCount))
        : null,
    }));

  const strongestYearEntry = [...yearSummaries]
    .sort((a, b) => b.recordedFinds - a.recordedFinds || b.year.localeCompare(a.year))[0] ?? null;

  return {
    speciesName,
    finds: sortedFinds,
    allPhotos,
    heroPhotoPath,
    heroPhotoId,
    recordedFinds: sortedFinds.length,
    observedCountTotalLabel: observedCountKnown
      ? String(Math.round(observedMidpointSum / observedWithCount))
      : null,
    observedCountKnown,
    favoriteCount,
    daysRecorded: uniqueDates.size,
    firstRecorded: sortedFinds[sortedFinds.length - 1]?.date_found ?? null,
    lastRecorded: sortedFinds[0]?.date_found ?? null,
    strongestYear: strongestYearEntry?.year ?? null,
    strongestYearCount: strongestYearEntry?.recordedFinds ?? 0,
    bestMonth,
    seasonStartMonth: seasonMonths[0] ?? null,
    seasonEndMonth: seasonMonths[seasonMonths.length - 1] ?? null,
    topSpotLabel: topSpot?.label ?? null,
    topSpotCount: topSpot?.count ?? 0,
    topSpotObservedCountLabel: (topSpot && topSpot.observedWithCount > 0)
      ? String(Math.round(topSpot.observedMidpointSum / topSpot.observedWithCount))
      : null,
    topSpotFavoriteCount: topSpot?.favoriteCount ?? 0,
    topSpotLastRecorded: topSpot?.lastRecorded ?? null,
    dateSummaries,
    yearSummaries,
  };
}

export default function SpeciesTab() {
  const t = useT();
  const lang = useAppStore((s) => s.language);
  const storagePath = useAppStore((s) => s.storagePath);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const setSelectedCollectionSpecies = useAppStore((s) => s.setSelectedCollectionSpecies);
  const { data: finds, isLoading, isError, error } = useFinds();
  const { data: speciesNotes } = useSpeciesNotes();
  const { data: speciesProfiles } = useSpeciesProfiles();
  const upsertSpeciesProfile = useUpsertSpeciesProfile();
  const [search, setSearch] = useState('');
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const locale = lang === 'hr' ? 'hr-HR' : 'en-US';
  const today = new Date();

  const speciesJournals = useMemo(() => {
    const grouped = new Map<string, Find[]>();
    for (const find of finds ?? []) {
      if (!find.species_name || isInternalLibraryName(find.species_name)) continue;
      if (!grouped.has(find.species_name)) grouped.set(find.species_name, []);
      grouped.get(find.species_name)!.push(find);
    }

    return Array.from(grouped.entries())
      .map(([speciesName, speciesFinds]) => {
        const profile = speciesProfiles?.find((entry) => entry.species_name === speciesName);
        return buildSpeciesJournal(speciesName, speciesFinds, profile?.cover_photo_id ?? null);
      })
      .sort((a, b) => a.speciesName.localeCompare(b.speciesName));
  }, [finds, speciesProfiles]);

  const filteredSpecies = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return speciesJournals;
    return speciesJournals.filter((entry) => entry.speciesName.toLowerCase().includes(query));
  }, [search, speciesJournals]);

  useEffect(() => {
    if (filteredSpecies.length === 0) {
      setSelectedSpecies(null);
      return;
    }
    const stillVisible = filteredSpecies.some((entry) => entry.speciesName === selectedSpecies);
    if (!stillVisible) {
      setSelectedSpecies(filteredSpecies[0].speciesName);
    }
  }, [filteredSpecies, selectedSpecies]);

  const selectedJournal = filteredSpecies.find((entry) => entry.speciesName === selectedSpecies) ?? filteredSpecies[0] ?? null;
  const selectedNote = speciesNotes?.find((note) => note.species_name === selectedJournal?.speciesName)?.notes ?? '';
  const selectedProfile = speciesProfiles?.find((entry) => entry.species_name === selectedJournal?.speciesName) ?? null;
  const selectedTags = selectedProfile?.tags ?? [];

  const [edibilityNoteInput, setEdibilityNoteInput] = useState(selectedProfile?.edibility_note ?? '');
  const [edibilityInput, setEdibilityInput] = useState(selectedProfile?.edibility ?? 'unknown');
  const [threatStatusInput, setThreatStatusInput] = useState(selectedProfile?.threat_status ?? 'unknown');
  const [distributionInput, setDistributionInput] = useState(selectedProfile?.distribution ?? 'unknown');

  useEffect(() => {
    setTagInput('');
    setEdibilityNoteInput(selectedProfile?.edibility_note ?? '');
    setEdibilityInput(selectedProfile?.edibility ?? 'unknown');
    setThreatStatusInput(selectedProfile?.threat_status ?? 'unknown');
    setDistributionInput(selectedProfile?.distribution ?? 'unknown');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJournal?.speciesName]);

  const InfoHint = ({ text }: { text: string }) => (
    <span
      className="inline-flex text-muted-foreground/80"
      title={text}
      aria-label={text}
    >
      <Info className="h-3.5 w-3.5" />
    </span>
  );

  const handleSelectCover = (speciesName: string, photoId: number) => {
    const existingProfile = speciesProfiles?.find((entry) => entry.species_name === speciesName);
    upsertSpeciesProfile.mutate({
      speciesName,
      coverPhotoId: photoId,
      tags: existingProfile?.tags ?? [],
      edibility: existingProfile?.edibility ?? null,
      protectedStatus: existingProfile?.protected_status ?? null,
      edibilityNote: existingProfile?.edibility_note ?? null,
    });
    setCoverPickerOpen(false);
  };

  const handleAddTag = () => {
    if (!selectedJournal) return;
    const nextTags = normalizeTags([...selectedTags, tagInput]);
    if (nextTags.length === selectedTags.length) {
      setTagInput('');
      return;
    }
    upsertSpeciesProfile.mutate({
      speciesName: selectedJournal.speciesName,
      coverPhotoId: selectedJournal.heroPhotoId,
      tags: nextTags,
      edibility: edibilityInput === 'unknown' ? null : edibilityInput,
      threatStatus: threatStatusInput === 'unknown' ? null : threatStatusInput,
      distribution: distributionInput === 'unknown' ? null : distributionInput,
      edibilityNote: edibilityNoteInput.trim() || null,
    });
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!selectedJournal) return;
    upsertSpeciesProfile.mutate({
      speciesName: selectedJournal.speciesName,
      coverPhotoId: selectedJournal.heroPhotoId,
      tags: selectedTags.filter((tag) => tag !== tagToRemove),
      edibility: edibilityInput === 'unknown' ? null : edibilityInput,
      threatStatus: threatStatusInput === 'unknown' ? null : threatStatusInput,
      distribution: distributionInput === 'unknown' ? null : distributionInput,
      edibilityNote: edibilityNoteInput.trim() || null,
    });
  };

  const handleSaveEdibilityNote = () => {
    if (!selectedJournal) return;
    upsertSpeciesProfile.mutate({
      speciesName: selectedJournal.speciesName,
      coverPhotoId: selectedJournal.heroPhotoId,
      tags: selectedTags,
      edibility: edibilityInput === 'unknown' ? null : edibilityInput,
      threatStatus: threatStatusInput === 'unknown' ? null : threatStatusInput,
      distribution: distributionInput === 'unknown' ? null : distributionInput,
      edibilityNote: edibilityNoteInput.trim() || null,
    });
  };

  const handleSaveMetadataStatus = (
    newEdibility: string,
    newThreatStatus: string,
    newDistribution: string,
  ) => {
    if (!selectedJournal) return;
    upsertSpeciesProfile.mutate({
      speciesName: selectedJournal.speciesName,
      coverPhotoId: selectedJournal.heroPhotoId,
      tags: selectedTags,
      edibility: newEdibility === 'unknown' ? null : newEdibility,
      threatStatus: newThreatStatus === 'unknown' ? null : newThreatStatus,
      distribution: newDistribution === 'unknown' ? null : newDistribution,
      edibilityNote: edibilityNoteInput.trim() || null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t('species.loading')}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-sm text-destructive">
        {String(error)}
      </div>
    );
  }

  if (!speciesJournals.length) {
    return (
      <EmptyState
        icon={BookOpen}
        heading={t('species.empty.heading')}
        body={t('species.empty.body')}
      />
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border/60 px-6 py-4">
        <h1 className="font-serif text-4xl font-semibold italic text-primary">{t('species.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('species.subtitle')}</p>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <aside className="border-b border-border/60 bg-card/30 lg:w-[320px] lg:flex-shrink-0 lg:border-b-0 lg:border-r">
          <div className="p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('species.search')}
                className="h-10 w-full rounded-md border border-border bg-input pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
          </div>

          <div className="overflow-y-auto px-3 pb-24 lg:h-[calc(100vh-13rem)]">
            {filteredSpecies.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                {t('species.noResults')}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSpecies.map((entry) => {
                  const thumbSrc = entry.heroPhotoPath && storagePath
                    ? resolvePhotoSrc(storagePath, entry.heroPhotoPath)
                    : null;
                  const isActive = entry.speciesName === selectedJournal?.speciesName;

                  return (
                    <button
                      key={entry.speciesName}
                      type="button"
                      onClick={() => setSelectedSpecies(entry.speciesName)}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                        isActive
                          ? 'border-primary/60 bg-primary/8'
                          : 'border-border/70 bg-background hover:bg-accent/60'
                      }`}
                    >
                      {thumbSrc ? (
                        <img src={thumbSrc} alt={entry.speciesName} className="h-12 w-12 rounded-md object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
                          <Camera className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-serif text-base font-semibold text-foreground" title={plainSpeciesName(entry.speciesName)}>{renderSpeciesName(entry.speciesName)}</p>
                          {entry.favoriteCount > 0 && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600"
                              title={t('species.favoriteCountLabel', { count: entry.favoriteCount })}
                            >
                              <Star className="h-3 w-3 fill-current" />
                              <span>{entry.favoriteCount}</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t('species.recordedFindsLabel', { count: entry.recordedFinds })}
                        </p>
                        <p className="text-[11px] text-muted-foreground/80">
                          {t('species.lastRecordedShort', { date: formatDate(entry.lastRecorded, locale) })}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto">
          {selectedJournal && (
            <div className="space-y-6 px-6 py-6">
              <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
                <Card className="gap-0 self-start overflow-hidden py-0">
                  {selectedJournal.heroPhotoPath && storagePath ? (
                    <div className="group relative block w-full">
                      <button
                        type="button"
                        onClick={() => {
                          const heroIdx = selectedJournal.allPhotos.findIndex((e) => e.photo.id === selectedJournal.heroPhotoId);
                          openLightbox(heroIdx >= 0 ? heroIdx : 0);
                        }}
                        className="block w-full text-left"
                        aria-label={t('species.viewPhoto')}
                      >
                        <img
                          src={resolvePhotoSrc(storagePath, selectedJournal.heroPhotoPath)}
                          alt={selectedJournal.speciesName}
                          className="aspect-[5/4] max-h-[320px] w-full object-cover lg:max-h-[280px] xl:max-h-[320px] cursor-zoom-in"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCoverPickerOpen(true)}
                        className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-background/40 bg-background/78 text-foreground shadow-sm transition-colors hover:bg-background hover:text-primary"
                        aria-label={t('species.editCover')}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCoverPickerOpen(true)}
                      className="group relative flex aspect-[5/4] max-h-[320px] w-full items-center justify-center bg-muted text-muted-foreground lg:max-h-[280px] xl:max-h-[320px]"
                      aria-label={t('species.editCover')}
                    >
                      <Camera className="h-8 w-8" />
                      <span className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-background/40 bg-background/78 text-foreground shadow-sm transition-colors group-hover:bg-background group-hover:text-primary">
                        <Pencil className="h-4 w-4" />
                      </span>
                    </button>
                  )}
                  <CardContent className="space-y-3 px-5 py-5">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-serif text-3xl font-semibold text-foreground">{renderSpeciesName(selectedJournal.speciesName)}</h2>
                        {selectedJournal.favoriteCount > 0 && (
                          <Badge variant="outline" className="gap-1 border-amber-500/35 bg-amber-500/10 text-amber-600">
                            <Star className="h-3.5 w-3.5 fill-current" />
                            {t('species.favoriteCountLabel', { count: selectedJournal.favoriteCount })}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{t('species.coverHint')}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedCollectionSpecies(selectedJournal.speciesName);
                          setActiveTab('collection');
                        }}
                      >
                        {t('species.viewCollection')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Card className="gap-0 py-4">
                      <CardContent className="space-y-1 px-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <span>{t('species.recordedFinds')}</span>
                            <InfoHint text={t('species.recordedFindsHelp')} />
                          </span>
                        </p>
                        <p className="text-2xl font-semibold text-foreground">{selectedJournal.recordedFinds}</p>
                      </CardContent>
                    </Card>
                    <Card className="gap-0 py-4">
                      <CardContent className="space-y-1 px-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <span>{t('species.observedCount')}</span>
                            <InfoHint text={t('species.observedCountHelp')} />
                          </span>
                        </p>
                        <p className="text-2xl font-semibold text-foreground">
                          {selectedJournal.observedCountKnown ? selectedJournal.observedCountTotalLabel : '--'}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="gap-0 py-4">
                      <CardContent className="space-y-1 px-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          {t('species.daysRecorded')}
                        </p>
                        <p className="text-2xl font-semibold text-foreground">{selectedJournal.daysRecorded}</p>
                      </CardContent>
                    </Card>
                    <Card className="gap-0 py-4">
                      <CardContent className="space-y-1 px-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          {t('species.bestMonth')}
                        </p>
                        <p className="text-xl font-semibold text-foreground">
                          {selectedJournal.bestMonth ? formatMonth(selectedJournal.bestMonth, locale) : '--'}
                        </p>
                      </CardContent>
                    </Card>
                  </section>

                  <Card className="gap-0 py-5">
                    <CardContent className="space-y-3 px-5">
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground">
                          {t('species.fieldJournal')}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {selectedNote.trim() || t('species.noJournalNote')}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <EdibilitySelectBadge
                            value={edibilityInput}
                            onChange={(v) => {
                              setEdibilityInput(v);
                              handleSaveMetadataStatus(v, threatStatusInput, distributionInput);
                            }}
                          />
                          <ThreatStatusSelectBadge
                            value={threatStatusInput}
                            onChange={(v) => {
                              setThreatStatusInput(v);
                              handleSaveMetadataStatus(edibilityInput, v, distributionInput);
                            }}
                          />
                          <DistributionSelectBadge
                            value={distributionInput}
                            onChange={(v) => {
                              setDistributionInput(v);
                              handleSaveMetadataStatus(edibilityInput, threatStatusInput, v);
                            }}
                          />
                        </div>
                        {['edible', 'edible_raw', 'conditionally_edible'].includes(edibilityInput) && (
                          <div className="mt-3 space-y-1.5">
                            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground/70">
                              {t('edit.edibilityNote')}
                            </p>
                            <textarea
                              value={edibilityNoteInput}
                              onChange={(e) => setEdibilityNoteInput(e.target.value)}
                              onBlur={handleSaveEdibilityNote}
                              rows={3}
                              placeholder={t('edit.edibilityNotePlaceholder')}
                              className="w-full resize-none rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
                            />
                            <p className="text-[11px] text-muted-foreground/50">{t('edit.edibilityNoteHelp')}</p>
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant="outline">{t('species.recordedFindsLabel', { count: selectedJournal.recordedFinds })}</Badge>
                          {selectedJournal.observedCountTotalLabel != null && (
                            <Badge variant="outline">{t('species.observedCountLabel', { count: selectedJournal.observedCountTotalLabel })}</Badge>
                          )}
                          {selectedJournal.favoriteCount > 0 && (
                            <Badge variant="outline" className="gap-1 border-amber-500/35 bg-amber-500/10 text-amber-600">
                              <Star className="h-3.5 w-3.5 fill-current" />
                              {t('species.favoriteCountLabel', { count: selectedJournal.favoriteCount })}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="space-y-3 border-t border-border/50 pt-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-foreground">{t('species.tags')}</p>
                          {upsertSpeciesProfile.isPending && (
                            <span className="text-xs text-muted-foreground">{t('species.savingTags')}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selectedTags.length > 0 ? selectedTags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => handleRemoveTag(tag)}
                              className="inline-flex"
                              title={t('species.removeTag')}
                              aria-label={`${t('species.removeTag')} ${tag}`}
                            >
                              <Badge variant="outline" className="cursor-pointer hover:border-primary/60 hover:text-primary">
                                {tag} ×
                              </Badge>
                            </button>
                          )) : (
                            <p className="text-sm text-muted-foreground">{t('species.noTags')}</p>
                          )}
                        </div>
                      </div>
                      <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                        <div>
                          <p className="font-medium text-foreground">{t('species.firstRecorded')}</p>
                          <p>{formatDate(selectedJournal.firstRecorded, locale)}</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{t('species.lastRecorded')}</p>
                          <p>{formatDate(selectedJournal.lastRecorded, locale)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <Card className="gap-0 py-5">
                      <CardContent className="space-y-3 px-5">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-primary" />
                          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground">
                            {t('species.whenToLook')}
                          </h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {buildWhenToLookCopy(selectedJournal, locale, t, today)}
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="gap-0 py-5">
                      <CardContent className="space-y-3 px-5">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground">
                            {t('species.bestSpot')}
                          </h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {buildBestSpotCopy(selectedJournal, locale, t)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <Card className="gap-0 py-5">
                      <CardContent className="space-y-4 px-5">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground">
                          {t('species.datesFound')}
                        </h3>
                        <div className="space-y-3">
                          {selectedJournal.dateSummaries.map((entry) => (
                            <div
                              key={entry.date}
                              className="flex items-start justify-between gap-3 border-b border-border/50 pb-3 last:border-b-0 last:pb-0"
                            >
                              <div>
                                <p className="font-medium text-foreground">{formatDate(entry.date, locale)}</p>
                                <p className="text-sm text-muted-foreground">
                                  {t('species.recordedFindsLabel', { count: entry.recordedFinds })}
                                </p>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {entry.observedCountLabel != null
                                  ? t('species.observedCountLabel', { count: entry.observedCountLabel })
                                  : t('species.observedMissing')}
                              </p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="gap-0 py-5">
                      <CardContent className="space-y-4 px-5">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground">
                          {t('species.yearOverYear')}
                        </h3>
                        <div className="space-y-3">
                          {(() => {
                            const maxYearCount = Math.max(...selectedJournal.yearSummaries.map((entry) => entry.recordedFinds), 1);
                            return selectedJournal.yearSummaries.map((entry) => (
                              <div
                                key={entry.year}
                                className="space-y-2 border-b border-border/50 pb-3 last:border-b-0 last:pb-0"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <p className="font-medium text-foreground">{entry.year}</p>
                                  <div className="text-right text-sm text-muted-foreground">
                                    <p>{t('species.recordedFindsLabel', { count: entry.recordedFinds })}</p>
                                    {entry.observedCountLabel != null && (
                                      <p>{t('species.observedCountLabel', { count: entry.observedCountLabel })}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className="h-full rounded-full bg-primary/75"
                                    style={{ width: `${Math.max((entry.recordedFinds / maxYearCount) * 100, 12)}%` }}
                                  />
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Finds list */}
                  <Card className="gap-0 py-5">
                    <CardContent className="space-y-3 px-5">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground">
                        {t('species.recordedFinds')}
                      </h3>
                      <div className="space-y-2">
                        {selectedJournal.finds.map((find) => {
                          const primaryPhoto = find.photos.find((p) => p.is_primary) ?? find.photos[0] ?? null;
                          const photoIdx = primaryPhoto
                            ? selectedJournal.allPhotos.findIndex((e) => e.photo.id === primaryPhoto.id)
                            : -1;
                          const thumbSrc = primaryPhoto && storagePath
                            ? resolvePhotoSrc(storagePath, primaryPhoto.photo_path)
                            : null;
                          const obsMin = find.observed_count_min ?? find.observed_count;
                          const obsMax = find.observed_count_max ?? find.observed_count_min ?? find.observed_count;
                          const obsDisplay = obsMin != null
                            ? (obsMin === obsMax ? String(obsMin) : `${obsMin}–${obsMax}`)
                            : null;
                          const locationParts = [find.location_note, find.region, find.country].filter(Boolean);

                          return (
                            <button
                              key={find.id}
                              type="button"
                              onClick={() => photoIdx >= 0 ? openLightbox(photoIdx) : undefined}
                              className="group flex w-full items-center gap-3 rounded-md border border-border/40 bg-card/40 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                            >
                              {/* Thumbnail */}
                              <div className="h-12 w-12 shrink-0 overflow-hidden rounded border border-border/30 bg-muted/40">
                                {thumbSrc ? (
                                  <img src={thumbSrc} alt="" className="h-full w-full object-cover" draggable={false} />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-muted-foreground/30">
                                    <Camera className="h-5 w-5" />
                                  </div>
                                )}
                              </div>

                              {/* Info */}
                              <div className="min-w-0 flex-1">
                                <p className="font-mono text-sm font-medium text-foreground">
                                  {formatDate(find.date_found, locale)}
                                </p>
                                {locationParts.length > 0 && (
                                  <p className="truncate text-xs text-muted-foreground/70">
                                    {locationParts.join(' · ')}
                                  </p>
                                )}
                                {find.photos.length > 1 && (
                                  <p className="text-[11px] text-muted-foreground/50">{find.photos.length} foto</p>
                                )}
                              </div>

                              {/* Observed count */}
                              {obsDisplay && (
                                <span className="shrink-0 font-mono text-lg font-semibold text-primary/80">
                                  {obsDisplay}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <Dialog open={coverPickerOpen} onOpenChange={setCoverPickerOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('species.chooseCover')}</DialogTitle>
            <DialogDescription>
              {selectedJournal ? t('species.chooseCoverHelp', { name: selectedJournal.speciesName }) : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto pr-1">
            {selectedJournal && selectedJournal.allPhotos.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {selectedJournal.allPhotos.map(({ photo, find }) => {
                  const thumbSrc = storagePath
                    ? resolvePhotoSrc(storagePath, photo.photo_path)
                    : '';
                  const isActive = selectedJournal.heroPhotoId === photo.id;

                  return (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => handleSelectCover(selectedJournal.speciesName, photo.id)}
                      className={`overflow-hidden rounded-lg border text-left transition-colors ${
                        isActive
                          ? 'border-primary ring-1 ring-primary/60'
                          : 'border-border/70 hover:border-primary/50'
                      }`}
                    >
                      <img src={thumbSrc} alt={find.date_found} className="aspect-square w-full object-cover" />
                      <div className="space-y-1 px-3 py-2">
                        <p className="text-sm font-medium text-foreground">{formatDate(find.date_found, locale)}</p>
                        {find.location_note && (
                          <p className="truncate text-xs text-muted-foreground">{find.location_note}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                {t('species.noCoverOptions')}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {selectedJournal && (
        <PhotoLightbox
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
          photos={selectedJournal.allPhotos}
          currentIndex={lightboxIndex}
          onIndexChange={setLightboxIndex}
          storagePath={storagePath!}
          onSetAsSpeciesCover={(entry) => handleSelectCover(selectedJournal.speciesName, entry.photo.id)}
          isCurrentSpeciesCover={(entry) => entry.photo.id === selectedJournal.heroPhotoId}
          speciesProfile={selectedProfile ?? undefined}
        />
      )}
    </div>
  );
}
