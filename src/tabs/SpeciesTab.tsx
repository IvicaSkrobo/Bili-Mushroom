import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Calendar, Camera, FolderOpen, GalleryHorizontal, Map as MapIcon, MapPin, Pencil, Plus, Repeat2, Search, Star, X } from 'lucide-react';
import { EmptyState } from '@/components/layout/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useInfiniteCollectionFolders, useInfiniteSpeciesFinds, useSpeciesFinds, useSpeciesNotes, useUpsertSpeciesNote, useSpeciesProfiles, useUpsertSpeciesProfile, useSpeciesRecipes, useUpsertSpeciesRecipe, useDeleteSpeciesRecipe } from '@/hooks/useFinds';
import { useAppStore } from '@/stores/appStore';
import { useT } from '@/i18n/index';
import { isInternalLibraryName } from '@/lib/internalEntries';
import type { Find, FindPhoto, SpeciesFolderSummary } from '@/lib/finds';
import { openSpeciesFolder } from '@/lib/finds';
import { resolvePhotoSrc } from '@/lib/photoSrc';
import { EdibilitySelectBadge, ThreatStatusSelectBadge, DistributionSelectBadge } from '@/components/species/StatusSelectBadge';
import { PhotoLightbox, type LightboxPhoto } from '@/components/finds/PhotoLightbox';
import { EditFindDialog } from '@/components/finds/EditFindDialog';
import { renderSpeciesName, plainSpeciesName, normalizeCommonName, compareSpeciesNames } from '@/lib/speciesName';
import { formatDisplayDate } from '@/lib/dateFormat';

const SPECIES_FOLDER_PAGE_SIZE = 500;
const SPECIES_DETAIL_PAGE_SIZE = 200;

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
  fruitingBodyAverageLabel: string | null;
  fruitingBodyTotalLabel: string | null;
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
  if (locale === 'hr-HR') return formatDisplayDate(date, 'hr');
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed);
}

function formatMonth(month: number | null, locale: string): string | null {
  if (!month) return null;
  return new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2024, month - 1, 1));
}


function getObservedRange(find: Pick<Find, 'observed_count' | 'observed_count_min' | 'observed_count_max'>) {
  const min = find.observed_count_min ?? find.observed_count;
  const max = find.observed_count_max ?? find.observed_count_min ?? find.observed_count;
  if (min == null && max == null) return null;
  const low = min ?? max!;
  const high = max ?? min!;
  return { min: Math.min(low, high), max: Math.max(low, high) };
}


function formatRoundedRange(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  const low = Math.round(min ?? max!);
  const high = Math.round(max ?? min!);
  return low === high ? String(low) : `${low}-${high}`;
}

function monthsBetweenDates(earlier: Date, later: Date): number {
  const yearDiff = later.getFullYear() - earlier.getFullYear();
  const monthDiff = later.getMonth() - earlier.getMonth();
  return yearDiff * 12 + monthDiff;
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
  const heroPhotoId = coverPhotoId ?? heroPhotoEntry?.photo.id ?? null;

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
  let observedMinSum = 0;
  let observedMaxSum = 0;
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
      observedMinSum += observedRange!.min;
      observedMaxSum += observedRange!.max;
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
    fruitingBodyAverageLabel: observedCountKnown
      ? formatRoundedRange(observedMinSum / observedWithCount, observedMaxSum / observedWithCount)
      : null,
    fruitingBodyTotalLabel: observedCountKnown
      ? formatRoundedRange(observedMinSum, observedMaxSum)
      : null,
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

function buildSpeciesJournalPreview(summary: SpeciesFolderSummary, coverPhotoId: number | null): SpeciesJournal {
  const representativeFind = summary.representative_find;
  const representativePhoto = representativeFind?.photos.find((photo) => photo.id === coverPhotoId)
    ?? representativeFind?.photos[0]
    ?? null;

  return {
    speciesName: summary.species_name,
    finds: representativeFind ? [representativeFind] : [],
    allPhotos: representativePhoto && representativeFind ? [{ photo: representativePhoto, find: representativeFind }] : [],
    heroPhotoPath: representativePhoto?.photo_path ?? null,
    heroPhotoId: representativePhoto?.id ?? coverPhotoId,
    recordedFinds: summary.find_count,
    observedCountTotalLabel: null,
    observedCountKnown: false,
    fruitingBodyAverageLabel: null,
    fruitingBodyTotalLabel: null,
    favoriteCount: summary.favorite_count,
    daysRecorded: 0,
    firstRecorded: null,
    lastRecorded: summary.latest_date,
    strongestYear: null,
    strongestYearCount: 0,
    bestMonth: summary.latest_date ? Number.parseInt(summary.latest_date.slice(5, 7), 10) : null,
    seasonStartMonth: null,
    seasonEndMonth: null,
    topSpotLabel: representativeFind ? [representativeFind.country, representativeFind.region, representativeFind.location_note].filter(Boolean).join(' / ') || null : null,
    topSpotCount: 0,
    topSpotObservedCountLabel: null,
    topSpotFavoriteCount: 0,
    topSpotLastRecorded: summary.latest_date,
    dateSummaries: [],
    yearSummaries: summary.latest_date ? [{
      year: summary.latest_date.slice(0, 4),
      recordedFinds: summary.find_count,
      observedCountLabel: null,
    }] : [],
  };
}

function hasOpenModalLayer(): boolean {
  return Boolean(document.querySelector(
    '[data-slot="dialog-content"][data-state="open"], [data-slot="alert-dialog-content"][data-state="open"]',
  ));
}

function releaseStaleModalScrollLock() {
  if (typeof document === 'undefined' || hasOpenModalLayer()) return;

  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
  document.body.style.pointerEvents = '';
  document.body.removeAttribute('data-scroll-locked');
}

export default function SpeciesTab() {
  const t = useT();
  const lang = useAppStore((s) => s.language);
  const storagePath = useAppStore((s) => s.storagePath);
  const photoAssetVersion = useAppStore((s) => s.photoAssetVersion);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const setSelectedCollectionSpecies = useAppStore((s) => s.setSelectedCollectionSpecies);
  const pendingSpeciesSelection = useAppStore((s) => s.pendingSpeciesSelection);
  const setPendingSpeciesSelection = useAppStore((s) => s.setPendingSpeciesSelection);
  const setPendingMapCenter = useAppStore((s) => s.setPendingMapCenter);
  const setPendingMapSpeciesFilter = useAppStore((s) => s.setPendingMapSpeciesFilter);
  const {
    data: folderPages,
    isLoading,
    isError,
    error,
    fetchNextPage: fetchNextSpeciesFolderPage,
    hasNextPage: hasNextSpeciesFolderPage,
    isFetchingNextPage: isFetchingNextSpeciesFolderPage,
  } = useInfiniteCollectionFolders(undefined, SPECIES_FOLDER_PAGE_SIZE);
  const { data: speciesNotes } = useSpeciesNotes();
  const upsertSpeciesNote = useUpsertSpeciesNote();
  const { data: speciesProfiles } = useSpeciesProfiles();
  const { data: speciesRecipes } = useSpeciesRecipes();
  const upsertSpeciesProfile = useUpsertSpeciesProfile();
  const upsertSpeciesRecipe = useUpsertSpeciesRecipe();
  const deleteSpeciesRecipe = useDeleteSpeciesRecipe();
  const [search, setSearch] = useState('');
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxPhotosOverride, setLightboxPhotosOverride] = useState<LightboxPhoto[] | null>(null);
  const [lightboxFallbackFind, setLightboxFallbackFind] = useState<Find | null>(null);
  const [editingFind, setEditingFind] = useState<Find | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'finds' | 'recipes' | 'description'>('overview');

  const folderSummaries = useMemo(() => folderPages?.pages.flat() ?? [], [folderPages]);
  const speciesProfilesByName = useMemo(
    () => new Map((speciesProfiles ?? []).map((profile) => [profile.species_name, profile])),
    [speciesProfiles],
  );

  const speciesPreviews = useMemo(() => folderSummaries
    .filter((summary) => !isInternalLibraryName(summary.species_name))
    .map((summary) => buildSpeciesJournalPreview(
      summary,
      speciesProfilesByName.get(summary.species_name)?.cover_photo_id ?? null,
    ))
    .sort((a, b) => compareSpeciesNames(a.speciesName, b.speciesName)), [folderSummaries, speciesProfilesByName]);

  const openLightbox = (index: number, fallbackFind: Find | null = null) => {
    setLightboxPhotosOverride(fallbackFind && fallbackFind.photos.length === 0 ? [] : null);
    setLightboxFallbackFind(fallbackFind);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const locale = lang === 'hr' ? 'hr-HR' : 'en-US';
  const today = new Date();

  const filteredSpecies = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return speciesPreviews;
    return speciesPreviews.filter((entry) => plainSpeciesName(entry.speciesName).toLowerCase().startsWith(query));
  }, [search, speciesPreviews]);

  const selectedPreview = filteredSpecies.find((entry) => entry.speciesName === selectedSpecies) ?? filteredSpecies[0] ?? null;
  const {
    data: selectedFindPages,
    fetchNextPage: fetchNextSelectedFindPage,
    hasNextPage: hasNextSelectedFindPage,
    isFetchingNextPage: isFetchingNextSelectedFindPage,
  } = useInfiniteSpeciesFinds(selectedPreview?.speciesName ?? null, undefined, SPECIES_DETAIL_PAGE_SIZE);
  const selectedFinds = useMemo(() => selectedFindPages?.pages.flat() ?? [], [selectedFindPages]);
  const selectedJournal = useMemo(() => {
    if (!selectedPreview) return null;
    if (selectedFinds.length === 0) return selectedPreview;
    return buildSpeciesJournal(
      selectedPreview.speciesName,
      selectedFinds,
      speciesProfilesByName.get(selectedPreview.speciesName)?.cover_photo_id ?? null,
    );
  }, [selectedFinds, selectedPreview, speciesProfilesByName]);
  const coverPickerFindsQuery = useSpeciesFinds(
    selectedJournal?.speciesName ?? null,
    { photosMode: 'all', limit: 2000, offset: 0 },
    coverPickerOpen,
  );
  const coverPickerPhotos = useMemo(
    () => (coverPickerFindsQuery.data ?? []).flatMap((find) => find.photos.map((photo) => ({ photo, find }))),
    [coverPickerFindsQuery.data],
  );

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

  useEffect(() => {
    if (!hasNextSpeciesFolderPage || isFetchingNextSpeciesFolderPage) return;
    void fetchNextSpeciesFolderPage();
  }, [fetchNextSpeciesFolderPage, hasNextSpeciesFolderPage, isFetchingNextSpeciesFolderPage]);

  useEffect(() => {
    if (!hasNextSelectedFindPage || isFetchingNextSelectedFindPage) return;
    void fetchNextSelectedFindPage();
  }, [fetchNextSelectedFindPage, hasNextSelectedFindPage, isFetchingNextSelectedFindPage]);

  useEffect(() => {
    if (!pendingSpeciesSelection || speciesPreviews.length === 0) return;
    const target = pendingSpeciesSelection.trim();
    const plainTarget = plainSpeciesName(target).toLowerCase();
    const match = speciesPreviews.find((entry) => entry.speciesName === target)
      ?? speciesPreviews.find((entry) => plainSpeciesName(entry.speciesName).toLowerCase() === plainTarget)
      ?? null;
    setSearch('');
    if (match) setSelectedSpecies(match.speciesName);
    setPendingSpeciesSelection(null);
  }, [pendingSpeciesSelection, speciesPreviews, setPendingSpeciesSelection]);

  const selectedNote = speciesNotes?.find((note) => note.species_name === selectedJournal?.speciesName)?.notes ?? '';
  const selectedProfile = selectedJournal ? speciesProfilesByName.get(selectedJournal.speciesName) ?? null : null;
  const currentCoverPhotoId = selectedProfile?.cover_photo_id ?? selectedJournal?.heroPhotoId ?? null;
  const coverPhotoEntry = coverPickerPhotos.find((entry) => entry.photo.id === currentCoverPhotoId) ?? null;
  const selectedHeroPhotoPath = coverPhotoEntry?.photo.photo_path ?? selectedJournal?.heroPhotoPath ?? null;
  const selectedLightboxPhotos = lightboxPhotosOverride
    ?? (coverPickerPhotos.length > 0 ? coverPickerPhotos : selectedJournal?.allPhotos ?? []);
  const selectedTags = selectedProfile?.tags ?? [];

  const [noteInput, setNoteInput] = useState(selectedNote);
  const [speciesDescriptionInput, setSpeciesDescriptionInput] = useState(selectedProfile?.description ?? selectedProfile?.edibility_note ?? '');
  const [edibilityInput, setEdibilityInput] = useState(selectedProfile?.edibility ?? 'unknown');
  const [threatStatusInput, setThreatStatusInput] = useState(selectedProfile?.threat_status ?? 'unknown');
  const [distributionInput, setDistributionInput] = useState(selectedProfile?.distribution ?? 'unknown');
  const [synonymsInput, setSynonymsInput] = useState('');
  const [fruitingBodyCountInput, setFruitingBodyCountInput] = useState(selectedProfile?.fruiting_body_count_override ?? '');
  const [isEditingFruitingBodyCount, setIsEditingFruitingBodyCount] = useState(false);
  const [showFruitingBodyTotal, setShowFruitingBodyTotal] = useState(false);
  const [newRecipeTitle, setNewRecipeTitle] = useState('');
  const [newRecipeNotes, setNewRecipeNotes] = useState('');
  const [recipeDrafts, setRecipeDrafts] = useState<Record<number, { title: string; notes: string }>>({});
  const [folderOpenError, setFolderOpenError] = useState<string | null>(null);

  useEffect(() => {
    setNoteInput(selectedNote);
    setSpeciesDescriptionInput(selectedProfile?.description ?? selectedProfile?.edibility_note ?? '');
    setEdibilityInput(selectedProfile?.edibility ?? 'unknown');
    setThreatStatusInput(selectedProfile?.threat_status ?? 'unknown');
    setDistributionInput(selectedProfile?.distribution ?? 'unknown');
    setFruitingBodyCountInput(selectedProfile?.fruiting_body_count_override ?? '');
    setIsEditingFruitingBodyCount(false);
    setShowFruitingBodyTotal(false);
    setSynonymsInput('');
    setNewRecipeTitle('');
    setNewRecipeNotes('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJournal?.speciesName]);

  // Keep noteInput in sync when the query updates from an external write (e.g. CollectionTab save).
  useEffect(() => {
    setNoteInput(selectedNote);
  }, [selectedNote]);

  // Radix Dialog can occasionally leave body scroll/pointer locks behind in Tauri WebView.
  useEffect(() => {
    if (coverPickerOpen || lightboxOpen || editingFind) return;

    const frame = window.requestAnimationFrame(() => {
      window.setTimeout(releaseStaleModalScrollLock, 80);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [coverPickerOpen, lightboxOpen, editingFind]);

  useEffect(() => () => {
    window.setTimeout(releaseStaleModalScrollLock, 80);
  }, []);

  const InfoHint = ({ text }: { text: string }) => (
    <InfoTooltip text={text} className="text-muted-foreground/80" />
  );

  const selectedSynonyms = selectedProfile?.synonyms ?? [];
  const selectedOtherNames = selectedProfile?.other_names ?? [];
  const selectedCommonName = normalizeCommonName(selectedProfile?.common_name, selectedJournal?.speciesName);
  const selectedFruitingBodyCountOverride = selectedProfile?.fruiting_body_count_override ?? null;
  const selectedRecipes = useMemo(
    () => (speciesRecipes ?? []).filter((recipe) => recipe.species_name === selectedJournal?.speciesName),
    [speciesRecipes, selectedJournal?.speciesName],
  );

  useEffect(() => {
    setRecipeDrafts(Object.fromEntries(selectedRecipes.map((recipe) => [
      recipe.id,
      { title: recipe.title, notes: recipe.notes },
    ])));
  }, [selectedRecipes]);

  const profileDescription = speciesDescriptionInput.trim() || null;
  const legacyEdibilityNote = selectedProfile?.edibility_note ?? null;

  const handleSaveFruitingBodyCountOverride = (value = fruitingBodyCountInput) => {
    if (!selectedJournal) return;
    const normalized = value.trim() || null;
    const computedAverage = selectedJournal.fruitingBodyAverageLabel?.trim() || null;
    const hasExistingOverride = Boolean(selectedFruitingBodyCountOverride?.trim());
    if (!hasExistingOverride && normalized === computedAverage) {
      setFruitingBodyCountInput('');
      return;
    }
    setFruitingBodyCountInput(normalized ?? '');
    upsertSpeciesProfile.mutate({
      speciesName: selectedJournal.speciesName,
      coverPhotoId: currentCoverPhotoId,
      tags: selectedTags,
      edibility: edibilityInput === 'unknown' ? null : edibilityInput,
      threatStatus: threatStatusInput === 'unknown' ? null : threatStatusInput,
      distribution: distributionInput === 'unknown' ? null : distributionInput,
      edibilityNote: legacyEdibilityNote,
      synonyms: selectedSynonyms,
      otherNames: selectedOtherNames,
      fruitingBodyCountOverride: normalized,
      description: profileDescription,
    });
  };

  const handleSelectCover = (speciesName: string, photoId: number) => {
    const existingProfile = speciesProfiles?.find((entry) => entry.species_name === speciesName);
    upsertSpeciesProfile.mutate({
      speciesName,
      coverPhotoId: photoId,
      tags: existingProfile?.tags ?? [],
      edibility: existingProfile?.edibility ?? null,
      threatStatus: existingProfile?.threat_status ?? null,
      distribution: existingProfile?.distribution ?? null,
      edibilityNote: existingProfile?.edibility_note ?? null,
      synonyms: existingProfile?.synonyms ?? [],
      otherNames: existingProfile?.other_names ?? [],
      fruitingBodyCountOverride: existingProfile?.fruiting_body_count_override ?? null,
      description: existingProfile?.description ?? existingProfile?.edibility_note ?? null,
    });
    setCoverPickerOpen(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!selectedJournal) return;
    upsertSpeciesProfile.mutate({
      speciesName: selectedJournal.speciesName,
      coverPhotoId: currentCoverPhotoId,
      tags: selectedTags.filter((tag) => tag !== tagToRemove),
      edibility: edibilityInput === 'unknown' ? null : edibilityInput,
      threatStatus: threatStatusInput === 'unknown' ? null : threatStatusInput,
      distribution: distributionInput === 'unknown' ? null : distributionInput,
      edibilityNote: legacyEdibilityNote,
      synonyms: selectedSynonyms,
      otherNames: selectedOtherNames,
      fruitingBodyCountOverride: selectedFruitingBodyCountOverride,
      description: profileDescription,
    });
  };

  const handleSaveSpeciesDescription = () => {
    if (!selectedJournal) return;
    upsertSpeciesProfile.mutate({
      speciesName: selectedJournal.speciesName,
      coverPhotoId: currentCoverPhotoId,
      tags: selectedTags,
      edibility: edibilityInput === 'unknown' ? null : edibilityInput,
      threatStatus: threatStatusInput === 'unknown' ? null : threatStatusInput,
      distribution: distributionInput === 'unknown' ? null : distributionInput,
      edibilityNote: legacyEdibilityNote,
      synonyms: selectedSynonyms,
      otherNames: selectedOtherNames,
      fruitingBodyCountOverride: selectedFruitingBodyCountOverride,
      description: profileDescription,
    });
  };

  const handleOpenSpeciesFolder = async () => {
    if (!storagePath || !selectedJournal) return;
    setFolderOpenError(null);
    try {
      await openSpeciesFolder(storagePath, selectedJournal.speciesName);
    } catch (error) {
      setFolderOpenError(String(error));
      window.setTimeout(() => setFolderOpenError(null), 5000);
    }
  };

  const handleSaveMetadataStatus = (
    newEdibility: string,
    newThreatStatus: string,
    newDistribution: string,
  ) => {
    if (!selectedJournal) return;
    upsertSpeciesProfile.mutate({
      speciesName: selectedJournal.speciesName,
      coverPhotoId: currentCoverPhotoId,
      tags: selectedTags,
      edibility: newEdibility === 'unknown' ? null : newEdibility,
      threatStatus: newThreatStatus === 'unknown' ? null : newThreatStatus,
      distribution: newDistribution === 'unknown' ? null : newDistribution,
      edibilityNote: legacyEdibilityNote,
      synonyms: selectedSynonyms,
      otherNames: selectedOtherNames,
      fruitingBodyCountOverride: selectedFruitingBodyCountOverride,
      description: profileDescription,
    });
  };

  const handleAddSynonym = (value: string) => {
    if (!selectedJournal || !value.trim() || selectedSynonyms.includes(value.trim())) return;
    const updated = [...selectedSynonyms, value.trim()];
    upsertSpeciesProfile.mutate({
      speciesName: selectedJournal.speciesName,
      coverPhotoId: currentCoverPhotoId,
      tags: selectedTags,
      edibility: edibilityInput === 'unknown' ? null : edibilityInput,
      threatStatus: threatStatusInput === 'unknown' ? null : threatStatusInput,
      distribution: distributionInput === 'unknown' ? null : distributionInput,
      edibilityNote: legacyEdibilityNote,
      synonyms: updated,
      otherNames: selectedOtherNames,
      fruitingBodyCountOverride: selectedFruitingBodyCountOverride,
      description: profileDescription,
    });
    setSynonymsInput('');
  };

  const handleRemoveSynonym = (value: string) => {
    if (!selectedJournal) return;
    upsertSpeciesProfile.mutate({
      speciesName: selectedJournal.speciesName,
      coverPhotoId: currentCoverPhotoId,
      tags: selectedTags,
      edibility: edibilityInput === 'unknown' ? null : edibilityInput,
      threatStatus: threatStatusInput === 'unknown' ? null : threatStatusInput,
      distribution: distributionInput === 'unknown' ? null : distributionInput,
      edibilityNote: legacyEdibilityNote,
      synonyms: selectedSynonyms.filter((s) => s !== value),
      otherNames: selectedOtherNames,
      fruitingBodyCountOverride: selectedFruitingBodyCountOverride,
      description: profileDescription,
    });
  };

  const handleAddRecipe = () => {
    if (!selectedJournal || (!newRecipeTitle.trim() && !newRecipeNotes.trim())) return;
    upsertSpeciesRecipe.mutate({
      id: null,
      speciesName: selectedJournal.speciesName,
      title: newRecipeTitle.trim() || t('species.recipeUntitled'),
      notes: newRecipeNotes.trim(),
    }, {
      onSuccess: () => {
        setNewRecipeTitle('');
        setNewRecipeNotes('');
      },
    });
  };

  const handleSaveRecipe = (id: number) => {
    const existing = selectedRecipes.find((recipe) => recipe.id === id);
    const draft = recipeDrafts[id];
    if (!existing || !draft) return;
    const title = draft.title.trim() || t('species.recipeUntitled');
    const notes = draft.notes.trim();
    if (title === existing.title && notes === existing.notes) return;
    upsertSpeciesRecipe.mutate({
      id,
      speciesName: existing.species_name,
      title,
      notes,
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

  if (!speciesPreviews.length) {
    return (
      <EmptyState
        icon={BookOpen}
        heading={t('species.empty.heading')}
        body={t('species.empty.body')}
      />
    );
  }

  const defaultFruitingBodyLabel = selectedJournal?.fruitingBodyAverageLabel ?? null;
  const isCustomFruitingBodyCount = Boolean(selectedFruitingBodyCountOverride?.trim());
  const hasComputedFruitingBodyCount = Boolean(selectedJournal?.fruitingBodyAverageLabel || selectedJournal?.fruitingBodyTotalLabel);
  const fruitingBodyDisplayValue = isEditingFruitingBodyCount
    ? fruitingBodyCountInput
    : isCustomFruitingBodyCount
      ? fruitingBodyCountInput
      : defaultFruitingBodyLabel ?? '';
  const fruitingBodyCardIsTotal = showFruitingBodyTotal && Boolean(selectedJournal?.fruitingBodyTotalLabel);
  const fruitingBodyCardLabel = fruitingBodyCardIsTotal
    ? t('species.fruitingBodyTotal')
    : t('species.fruitingBodyCount');
  const fruitingBodyCardHint = fruitingBodyCardIsTotal
    ? t('species.fruitingBodyTotalHelp')
    : t('species.fruitingBodyCountHelp');
  const fruitingBodyModeLabel = fruitingBodyCardIsTotal
    ? t('species.fruitingBodyCountTotal')
    : isCustomFruitingBodyCount
      ? t('species.fruitingBodyCountCustom')
      : t('species.fruitingBodyCountAverage');

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
                className="h-10 w-full rounded-md border border-border bg-input pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
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
                    ? resolvePhotoSrc(storagePath, entry.heroPhotoPath, photoAssetVersion)
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
                        <img src={thumbSrc} alt={entry.speciesName} className="h-12 w-12 rounded-md bg-black object-contain" />
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
                  {selectedHeroPhotoPath && storagePath ? (
                    <div className="group relative block w-full">
                      <button
                        type="button"
                        onClick={() => {
                          const heroIdx = selectedLightboxPhotos.findIndex((e) => e.photo.id === currentCoverPhotoId);
                          openLightbox(heroIdx >= 0 ? heroIdx : 0);
                        }}
                        className="block w-full text-left"
                        aria-label={t('species.viewPhoto')}
                      >
                        <img
                          src={resolvePhotoSrc(storagePath, selectedHeroPhotoPath, photoAssetVersion)}
                          alt={selectedJournal.speciesName}
                          className="aspect-[5/4] max-h-[320px] w-full bg-black object-contain lg:max-h-[280px] xl:max-h-[320px] cursor-zoom-in"
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
                      {selectedCommonName && (
                        <p className="mt-1 text-base font-bold text-foreground/80 dark:text-foreground/80">{selectedCommonName}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedCollectionSpecies(selectedJournal.speciesName);
                          setActiveTab('collection');
                      }}
                    >
                      <GalleryHorizontal className="h-4 w-4 mr-1.5" />
                      {t('species.viewCollection')}
                    </Button>
                      <Button
                        variant="outline"
                        onClick={handleOpenSpeciesFolder}
                        disabled={!storagePath}
                      >
                        <FolderOpen className="h-4 w-4 mr-1.5" />
                        {t('folder.openFolder')}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setPendingMapSpeciesFilter(selectedJournal.speciesName);
                          setActiveTab('map');
                        }}
                      >
                        <MapIcon className="h-4 w-4 mr-1.5" />
                        {t('map.viewOnMap')}
                      </Button>
                    </div>
                    {folderOpenError && (
                      <p className="mt-2 text-xs text-destructive">{folderOpenError}</p>
                    )}
                  </CardContent>
                </Card>

                <div>
                  {/* Detail tab strip */}
                  <div className="mb-6 flex border-b border-border/50">
                    {(['overview', 'finds', 'recipes', 'description'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setDetailTab(tab)}
                        className={[
                          'flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors -mb-px',
                          detailTab === tab
                            ? 'border-primary text-foreground'
                            : 'border-transparent text-muted-foreground hover:text-foreground',
                        ].join(' ')}
                      >
                        {tab === 'overview' ? t('species.tabOverview')
                          : tab === 'finds' ? t('species.tabFinds')
                          : tab === 'recipes' ? t('species.tabRecipes')
                          : t('species.tabDescription')}
                        {tab === 'finds' && (
                          <span className="rounded-full bg-muted px-1.5 text-[10px] font-mono font-normal text-muted-foreground">
                            {selectedJournal.recordedFinds}
                          </span>
                        )}
                        {tab === 'recipes' && selectedRecipes.length > 0 && (
                          <span className="rounded-full bg-muted px-1.5 text-[10px] font-mono font-normal text-muted-foreground">
                            {selectedRecipes.length}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Overview tab */}
                  {detailTab === 'overview' && (
                    <div className="space-y-6">
                      <Card className="gap-0 py-5">
                        <CardContent className="space-y-3 px-5">
                          <div>
                            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground">
                              {t('species.fieldJournal')}
                            </h3>
                            <textarea
                              value={noteInput}
                              onChange={(e) => setNoteInput(e.target.value)}
                              onBlur={() => {
                                if (!selectedJournal) return;
                                upsertSpeciesNote.mutate({ speciesName: selectedJournal.speciesName, notes: noteInput });
                              }}
                              rows={3}
                              placeholder={t('species.noJournalNote')}
                              className="mt-1 w-full resize-none rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
                            />
                            <div className="mt-3 space-y-1.5">
                              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground/70">{t('species.otherNames')}</p>
                              {selectedOtherNames.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 rounded-md border border-secondary/20 bg-secondary/5 p-1.5">
                                  {selectedOtherNames.map((n) => (
                                    <span key={n} className="inline-flex max-w-full items-center rounded border border-secondary/25 bg-background/45 px-2 py-0.5 text-xs font-medium text-foreground">
                                      <span className="min-w-0 truncate" title={n}>{n}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
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
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Badge variant="outline">{t('species.recordedFindsLabel', { count: selectedJournal.recordedFinds })}</Badge>
                              {selectedJournal.favoriteCount > 0 && (
                                <Badge variant="outline" className="gap-1 border-amber-500/35 bg-amber-500/10 text-amber-600">
                                  <Star className="h-3.5 w-3.5 fill-current" />
                                  {t('species.favoriteCountLabel', { count: selectedJournal.favoriteCount })}
                                </Badge>
                              )}
                              {selectedTags.map((tag) => (
                                <Badge key={tag} variant="outline" className="gap-1.5 border-secondary/30 bg-secondary/10 text-secondary-foreground">
                                  <span>{tag}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTag(tag)}
                                    className="-mr-0.5 inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary/20 hover:text-foreground"
                                    aria-label={t('species.removeTag', { tag })}
                                  >
                                    {'×'}
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <section className="grid gap-4 md:grid-cols-3">
                        <Card className="gap-0 py-4">
                          <CardContent className="space-y-1 px-5">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                <span className="inline-flex items-center gap-1.5">
                                  <span>{fruitingBodyCardLabel}</span>
                                  <InfoHint text={fruitingBodyCardHint} />
                                </span>
                              </p>
                              {selectedJournal && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (selectedJournal.fruitingBodyTotalLabel) {
                                      setShowFruitingBodyTotal((v) => !v);
                                    }
                                  }}
                                  disabled={!selectedJournal.fruitingBodyTotalLabel}
                                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border/70 bg-background/70 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                                  title={showFruitingBodyTotal ? t('species.showAverage') : t('species.showTotal')}
                                  aria-label={showFruitingBodyTotal ? t('species.showAverage') : t('species.showTotal')}
                                >
                                  <Repeat2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            {fruitingBodyCardIsTotal ? (
                              <p className="min-h-9 break-words font-mono text-xl font-semibold leading-tight text-foreground">
                                {selectedJournal.fruitingBodyTotalLabel}
                              </p>
                            ) : (
                              <input
                                value={fruitingBodyDisplayValue}
                                onChange={(e) => setFruitingBodyCountInput(e.target.value)}
                                onFocus={(e) => {
                                  setIsEditingFruitingBodyCount(true);
                                  if (!isCustomFruitingBodyCount) {
                                    setFruitingBodyCountInput(defaultFruitingBodyLabel ?? '');
                                  }
                                  const input = e.currentTarget;
                                  window.requestAnimationFrame(() => input.select());
                                }}
                                onBlur={() => {
                                  setIsEditingFruitingBodyCount(false);
                                  handleSaveFruitingBodyCountOverride();
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.currentTarget.blur();
                                  }
                                }}
                                placeholder={hasComputedFruitingBodyCount ? undefined : t('species.fruitingBodyCountPlaceholder')}
                                className="min-h-9 w-full rounded border border-border/60 bg-input px-2 py-1 font-mono text-xl font-semibold leading-tight text-foreground placeholder:text-muted-foreground/35 focus:outline-none focus:ring-1 focus:ring-ring/50"
                              />
                            )}
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground/70">
                              <span>{fruitingBodyModeLabel}</span>
                              {!fruitingBodyCardIsTotal && isCustomFruitingBodyCount && (
                                <button
                                  type="button"
                                  onClick={() => handleSaveFruitingBodyCountOverride('')}
                                  className="text-muted-foreground transition-colors hover:text-primary"
                                >
                                  {t('species.resetAverage')}
                                </button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
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
                              {t('species.bestMonth')}
                            </p>
                            <p className="text-xl font-semibold text-foreground">
                              {selectedJournal.bestMonth ? formatMonth(selectedJournal.bestMonth, locale) : '--'}
                            </p>
                          </CardContent>
                        </Card>
                      </section>

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
                  )}

                  {/* Finds tab */}
                  {detailTab === 'finds' && (
                    <Card className="gap-0 py-5">
                      <CardContent className="px-5">
                        <div className="max-h-[calc(100vh-20rem)] space-y-2 overflow-y-auto pr-1">
                          {selectedJournal.finds.map((find) => {
                            const primaryPhoto = find.photos.find((p) => p.is_primary) ?? find.photos[0] ?? null;
                            const photoIdx = primaryPhoto
                              ? selectedLightboxPhotos.findIndex((e) => e.photo.id === primaryPhoto.id)
                              : -1;
                            const thumbSrc = primaryPhoto && storagePath
                              ? resolvePhotoSrc(storagePath, primaryPhoto.photo_path, photoAssetVersion)
                              : null;
                            const obsMin = find.observed_count_min ?? find.observed_count;
                            const obsMax = find.observed_count_max ?? find.observed_count_min ?? find.observed_count;
                            const obsDisplay = obsMin != null
                              ? (obsMin === obsMax ? String(obsMin) : `${obsMin}–${obsMax}`)
                              : null;
                            const locationParts = [find.location_note, find.region, find.country].filter(Boolean);

                            return (
                              <div
                                key={find.id}
                                className="group flex w-full items-center gap-3 rounded-md border border-border/40 bg-card/40 px-3 py-2 transition-colors hover:border-primary/40 hover:bg-primary/5"
                              >
                                <button
                                  type="button"
                                  onClick={() => openLightbox(photoIdx >= 0 ? photoIdx : 0, find)}
                                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                >
                                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded border border-border/30 bg-muted/40">
                                    {thumbSrc ? (
                                      <img src={thumbSrc} alt="" className="h-full w-full object-contain" draggable={false} />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-muted-foreground/30">
                                        <Camera className="h-5 w-5" />
                                      </div>
                                    )}
                                  </div>
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
                                  {obsDisplay && (
                                    <span className="shrink-0 font-mono text-lg font-semibold text-primary/80">
                                      {obsDisplay}
                                    </span>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingFind(find)}
                                  className="shrink-0 rounded p-1 text-muted-foreground/40 opacity-40 transition-all hover:text-primary group-hover:opacity-100 focus:opacity-100"
                                  title={t('collection.editFind')}
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                {find.lat != null && find.lng != null && (
                                  <button
                                    type="button"
                                    onClick={() => { setPendingMapCenter({ lat: find.lat!, lng: find.lng!, zoom: 16 }); setActiveTab('map'); }}
                                    className="shrink-0 rounded p-1 text-muted-foreground/40 opacity-40 transition-all hover:text-primary group-hover:opacity-100 focus:opacity-100"
                                    title={t('map.viewOnMap')}
                                  >
                                    <MapIcon className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Recipes tab */}
                  {detailTab === 'recipes' && (
                    <Card className="gap-0 border-border/45 bg-card/25 py-4">
                      <CardContent className="space-y-3 px-5">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            {t('species.recipes')}
                          </h3>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleAddRecipe}
                            disabled={!newRecipeTitle.trim() && !newRecipeNotes.trim()}
                            className="h-8 gap-1.5 text-muted-foreground hover:text-primary"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            {t('species.addRecipe')}
                          </Button>
                        </div>
                        <div className="grid gap-2">
                          <input
                            value={newRecipeTitle}
                            onChange={(e) => setNewRecipeTitle(e.target.value)}
                            placeholder={t('species.recipeTitlePlaceholder')}
                            className="rounded-md border border-border/60 bg-background/45 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring/40"
                          />
                          <textarea
                            value={newRecipeNotes}
                            onChange={(e) => setNewRecipeNotes(e.target.value)}
                            rows={3}
                            placeholder={t('species.recipeNotesPlaceholder')}
                            className="w-full resize-none rounded-md border border-border/60 bg-background/45 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring/40"
                          />
                        </div>
                        {selectedRecipes.length > 0 ? (
                          <div className="max-h-[calc(100vh-26rem)] space-y-2 overflow-y-auto pr-1">
                            {selectedRecipes.map((recipe) => {
                              const draft = recipeDrafts[recipe.id] ?? { title: recipe.title, notes: recipe.notes };
                              return (
                                <div key={recipe.id} className="rounded-md border border-border/45 bg-background/35 p-3">
                                  <div className="flex items-start gap-2">
                                    <div className="grid min-w-0 flex-1 gap-2">
                                      <input
                                        value={draft.title}
                                        onChange={(e) => setRecipeDrafts((prev) => ({
                                          ...prev,
                                          [recipe.id]: { ...draft, title: e.target.value },
                                        }))}
                                        onBlur={() => handleSaveRecipe(recipe.id)}
                                        className="rounded border border-border/50 bg-background/50 px-2 py-1 text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring/40"
                                      />
                                      <textarea
                                        value={draft.notes}
                                        onChange={(e) => setRecipeDrafts((prev) => ({
                                          ...prev,
                                          [recipe.id]: { ...draft, notes: e.target.value },
                                        }))}
                                        onBlur={() => handleSaveRecipe(recipe.id)}
                                        rows={3}
                                        className="w-full resize-none rounded border border-border/50 bg-background/50 px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring/40"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => deleteSpeciesRecipe.mutate(recipe.id)}
                                      className="mt-1 text-muted-foreground transition-colors hover:text-destructive"
                                      aria-label={t('species.deleteRecipe')}
                                      title={t('species.deleteRecipe')}
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">{t('species.noRecipes')}</p>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Description tab */}
                  {detailTab === 'description' && (
                    <Card className="gap-0 py-5">
                      <CardContent className="space-y-4 px-5">
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground/70">{t('species.synonyms')}</p>
                            <div className="flex gap-1">
                              <input
                                value={synonymsInput}
                                onChange={(e) => setSynonymsInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); handleAddSynonym(synonymsInput.replace(/,$/, '')); } }}
                                placeholder={t('species.synonymsPlaceholder')}
                                className="min-w-0 flex-1 rounded border border-border/70 bg-input px-2.5 py-1 text-sm font-medium text-foreground placeholder:text-muted-foreground/55 focus:outline-none focus:ring-1 focus:ring-ring/40"
                              />
                              <button type="button" onClick={() => handleAddSynonym(synonymsInput)} disabled={!synonymsInput.trim()} className="rounded border border-border/70 bg-input px-2 py-1 text-muted-foreground transition-colors hover:text-primary disabled:opacity-40">
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {selectedSynonyms.length > 0 && (
                            <div className="rounded-md border border-border/70 bg-card/35 p-1.5">
                              <div>
                                {selectedSynonyms.length > 0 && (
                                  <div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {selectedSynonyms.map((s) => (
                                        <span key={s} className="inline-flex max-w-full items-center gap-1.5 rounded border border-primary/20 bg-primary/6 px-2 py-0.5 text-xs text-foreground">
                                          <span className="min-w-0 truncate font-serif italic" title={s}>{s}</span>
                                          <button type="button" onClick={() => handleRemoveSynonym(s)} className="shrink-0 text-muted-foreground transition-colors hover:text-destructive" aria-label={`Remove ${s}`}>
                                            <X className="h-3 w-3" />
                                          </button>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          {t('species.tabDescription')}
                        </h3>
                        <textarea
                          value={speciesDescriptionInput}
                          onChange={(e) => {
                            setSpeciesDescriptionInput(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = `${e.target.scrollHeight}px`;
                          }}
                          onBlur={handleSaveSpeciesDescription}
                          ref={(el) => {
                            if (el) {
                              el.style.height = 'auto';
                              el.style.height = `${el.scrollHeight}px`;
                            }
                          }}
                          rows={4}
                          placeholder={t('edit.speciesDescriptionPlaceholder')}
                          className="w-full resize-none overflow-hidden rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
                        />
                      </CardContent>
                    </Card>
                  )}
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
            {coverPickerOpen && coverPickerFindsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">{t('species.loading')}</p>
            ) : selectedJournal && (coverPickerPhotos.length > 0 || selectedJournal.allPhotos.length > 0) ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {(coverPickerPhotos.length > 0 ? coverPickerPhotos : selectedJournal.allPhotos).map(({ photo, find }) => {
                  const thumbSrc = storagePath
                    ? resolvePhotoSrc(storagePath, photo.photo_path, photoAssetVersion)
                    : '';
                  const isActive = currentCoverPhotoId === photo.id;

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
                      <img src={thumbSrc} alt={find.date_found} className="aspect-square w-full bg-black object-contain" />
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
          onOpenChange={(open) => {
            setLightboxOpen(open);
            if (!open) {
              setLightboxFallbackFind(null);
              setLightboxPhotosOverride(null);
            }
          }}
          photos={selectedLightboxPhotos}
          fallbackFind={lightboxFallbackFind}
          currentIndex={lightboxIndex}
          onIndexChange={setLightboxIndex}
          storagePath={storagePath!}
          onSetAsSpeciesCover={(entry) => handleSelectCover(selectedJournal.speciesName, entry.photo.id)}
          isCurrentSpeciesCover={(entry) => entry.photo.id === currentCoverPhotoId}
          onEditFind={(find) => setEditingFind(find)}
          speciesProfile={selectedProfile ?? undefined}
        />
      )}

      <EditFindDialog
        find={editingFind}
        onOpenChange={(open) => { if (!open) setEditingFind(null); }}
      />
    </div>
  );
}

