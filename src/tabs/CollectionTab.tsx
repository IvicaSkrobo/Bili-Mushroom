import { useState, useMemo, useEffect, useRef } from 'react';
import { GalleryHorizontal, Plus, ChevronDown, ChevronRight, FolderOpen, Search, X, CheckSquare, Pencil, Star, SquarePen, Trash2, BookOpen, Map as MapIcon, CalendarDays } from 'lucide-react';
import { EmptyState } from '@/components/layout/EmptyState';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { ImportDialog } from '@/components/import/ImportDialog';
import { CreateFindDialog } from '@/components/finds/CreateFindDialog';
import { FindCard } from '@/components/finds/FindCard';
import { PhotoLightbox, type LightboxPhoto } from '@/components/finds/PhotoLightbox';
import { EditFindDialog } from '@/components/finds/EditFindDialog';
import { FolderEditDialog } from '@/components/finds/FolderEditDialog';
import { DeleteFindDialog } from '@/components/finds/DeleteFindDialog';
import { BulkDeleteDialog } from '@/components/finds/BulkDeleteDialog';
import { SpeciesMetadataBadges } from '@/components/species/SpeciesMetadataBadges';
import { useFinds, useSpeciesNotes, useSpeciesProfiles, useUpsertSpeciesNote, useUpsertSpeciesProfile, useBulkRenameSpecies, useSetFindFavorite, useDeleteFindPhoto } from '@/hooks/useFinds';
import { useAppStore } from '@/stores/appStore';
import { useT, tFindsCount } from '@/i18n/index';
import type { Find, SpeciesProfile } from '@/lib/finds';
import { openSpeciesFolder, SUPPORTED_EXTENSIONS } from '@/lib/finds';
import { isInternalLibraryName } from '@/lib/internalEntries';
import { resolvePhotoSrc } from '@/lib/photoSrc';
import { renderSpeciesName, plainSpeciesName, normalizeCommonName, compareSpeciesNames } from '@/lib/speciesName';
import { formatDisplayDate } from '@/lib/dateFormat';

function normalizeDateQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function dateVariants(isoDate: string): string[] {
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return [isoDate.toLowerCase()];
  const dayNumber = String(Number(day));
  const monthNumber = String(Number(month));
  return [
    isoDate,
    `${year}${month}${day}`,
    `${day}.${month}.${year}`,
    `${day}${month}${year}`,
    `${dayNumber}.${monthNumber}.${year}`,
    `${dayNumber}${monthNumber}${year}`,
    `${day}.${month}`,
    `${dayNumber}.${monthNumber}`,
    `${month}.${year}`,
    `${monthNumber}.${year}`,
    year,
    month,
    monthNumber,
    day,
    dayNumber,
  ].map(normalizeDateQuery);
}

function matchesSmartDate(isoDate: string, query: string): boolean {
  const q = normalizeDateQuery(query);
  if (!q) return true;
  const compactQuery = q.replace(/[./-]/g, '');
  return dateVariants(isoDate).some((variant) => {
    const compactVariant = variant.replace(/[./-]/g, '');
    return variant.startsWith(q) || compactVariant.startsWith(compactQuery);
  });
}

function parseCompleteDateQuery(query: string): string | null {
  const q = normalizeDateQuery(query);
  let match = q.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const [, year, month, day] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  match = q.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  match = q.match(/^(\d{1,2})(\d{1,2})(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}

function matchesSmartMonth(isoDate: string, query: string): boolean {
  const q = normalizeDateQuery(query);
  if (!q) return true;
  const [year, month] = isoDate.split('-');
  if (!year || !month) return false;
  const monthNumber = String(Number(month));
  const variants = [
    `${year}-${month}`,
    `${year}${month}`,
    `${month}.${year}`,
    `${monthNumber}.${year}`,
    month,
    monthNumber,
    year,
  ].map(normalizeDateQuery);
  const compactQuery = q.replace(/[./-]/g, '');
  return variants.some((variant) => variant.startsWith(q) || variant.replace(/[./-]/g, '').startsWith(compactQuery));
}

interface DatePartsInputProps {
  value: string;
  onChange: (value: string) => void;
  includeDay?: boolean;
  ariaLabel: string;
  className?: string;
}

function splitDateParts(value: string, includeDay: boolean): string[] {
  const parts = value.trim().split(/\D+/).filter(Boolean);
  if (includeDay) return [parts[0] ?? '', parts[1] ?? '', parts[2] ?? ''];
  return [parts[0] ?? '', parts[1] ?? ''];
}

function joinDateParts(parts: string[]): string {
  return parts.filter(Boolean).join(' ');
}

function DatePartsInput({ value, onChange, includeDay = true, ariaLabel, className = '' }: DatePartsInputProps) {
  const parts = splitDateParts(value, includeDay);
  const placeholders = includeDay ? ['dd', 'mm', 'yyyy'] : ['mm', 'yyyy'];
  const widths = includeDay ? ['w-7', 'w-7', 'w-11'] : ['w-7', 'w-11'];
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const updatePart = (index: number, nextValue: string) => {
    const next = [...parts];
    next[index] = nextValue.replace(/\D/g, '').slice(0, index === parts.length - 1 ? 4 : 2);
    const monthIndex = includeDay ? 1 : 0;
    const dayIndex = includeDay ? 0 : -1;
    const numericValue = Number.parseInt(next[index], 10);

    if (index === dayIndex && next[index].length === 2 && (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 31)) {
      next[index] = '';
      onChange(joinDateParts(next));
      refs.current[index]?.focus();
      return;
    }

    if (index === monthIndex && next[index].length === 2 && (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 12)) {
      next[index] = '';
      onChange(joinDateParts(next));
      refs.current[index]?.focus();
      return;
    }

    onChange(joinDateParts(next));
    if (index < parts.length - 1 && next[index].length === 2) {
      refs.current[index + 1]?.focus();
      refs.current[index + 1]?.select();
    }
  };

  return (
    <div className={`flex h-7 items-center gap-0.5 rounded bg-background/35 px-1 ${className}`} aria-label={ariaLabel}>
      {placeholders.map((placeholder, index) => (
        <input
          key={placeholder}
          ref={(node) => { refs.current[index] = node; }}
          type="text"
          inputMode="numeric"
          value={parts[index] ?? ''}
          onChange={(e) => updatePart(index, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !(parts[index] ?? '') && index > 0) {
              refs.current[index - 1]?.focus();
              refs.current[index - 1]?.select();
            }
          }}
          placeholder={placeholder}
          aria-label={`${ariaLabel} ${placeholder}`}
          className={`${widths[index]} bg-transparent text-center text-xs text-foreground outline-none placeholder:text-muted-foreground/45`}
        />
      ))}
    </div>
  );
}

export default function CollectionTab() {
  const t = useT();
  const lang = useAppStore((s) => s.language);
  const storagePath = useAppStore((s) => s.storagePath);
  const photoAssetVersion = useAppStore((s) => s.photoAssetVersion);
  const editingFindId = useAppStore((s) => s.editingFindId);
  const setEditingFindId = useAppStore((s) => s.setEditingFindId);
  const selectedCollectionSpecies = useAppStore((s) => s.selectedCollectionSpecies);
  const setSelectedCollectionSpecies = useAppStore((s) => s.setSelectedCollectionSpecies);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const setPendingSpeciesSelection = useAppStore((s) => s.setPendingSpeciesSelection);
  const setPendingMapCenter = useAppStore((s) => s.setPendingMapCenter);
  const setPendingMapSpeciesFilter = useAppStore((s) => s.setPendingMapSpeciesFilter);
  const { data: finds, isLoading, isError, error } = useFinds();
  const { data: speciesNotesData } = useSpeciesNotes();
  const { data: speciesProfiles } = useSpeciesProfiles();
  const upsertNote = useUpsertSpeciesNote();
  const upsertSpeciesProfile = useUpsertSpeciesProfile();
  const setFindFavorite = useSetFindFavorite();
  const deletePhotoMutation = useDeleteFindPhoto();

  const [importOpen, setImportOpen] = useState(false);
  const [createFindOpen, setCreateFindOpen] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const importMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editing, setEditing] = useState<Find | null>(null);
  const [deleting, setDeleting] = useState<Find | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [focusedSpeciesFilter, setFocusedSpeciesFilter] = useState<string | null>(null);
  const [dateFilterMode, setDateFilterMode] = useState<'exact' | 'range' | 'month' | 'year'>('exact');
  const [dateSearch, setDateSearch] = useState('');
  const [dateSearchEnd, setDateSearchEnd] = useState('');
  const [monthSearch, setMonthSearch] = useState('');
  const [yearSearch, setYearSearch] = useState('');
  const [jumpTargetSpecies, setJumpTargetSpecies] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const [folderEditing, setFolderEditing] = useState<string | null>(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState('');
  const [moveDropdownOpen, setMoveDropdownOpen] = useState(false);
  const [moveHighlight, setMoveHighlight] = useState(0);
  const bulkRename = useBulkRenameSpecies();

  const [expandedFinds, setExpandedFinds] = useState<Set<number>>(new Set());
  const toggleFindExpand = (id: number) => {
    setExpandedFinds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxPhotos, setLightboxPhotos] = useState<LightboxPhoto[]>([]);
  const [lightboxFallbackFind, setLightboxFallbackFind] = useState<Find | null>(null);
  const [lightboxSpeciesName, setLightboxSpeciesName] = useState<string | null>(null);

  const openLightbox = (speciesFinds: Find[], findId: number, photoIndex: number) => {
    const fallbackFind = speciesFinds.find((f) => f.id === findId) ?? null;
    const targetPhoto = fallbackFind?.photos[photoIndex];
    if (!targetPhoto) {
      setLightboxPhotos([]);
      setLightboxIndex(0);
      setLightboxFallbackFind(fallbackFind);
      setLightboxSpeciesName(fallbackFind?.species_name ?? speciesFinds[0]?.species_name ?? null);
      setLightboxOpen(true);
      return;
    }

    const seen = new Set<string>();
    const flat: LightboxPhoto[] = [];
    for (const f of speciesFinds) {
      for (const p of f.photos) {
        const ext = p.photo_path.slice(p.photo_path.lastIndexOf('.')).toLowerCase();
        if (!SUPPORTED_EXTENSIONS.includes(ext as (typeof SUPPORTED_EXTENSIONS)[number])) continue;
        if (seen.has(p.photo_path)) continue;
        seen.add(p.photo_path);
        flat.push({ photo: p, find: f });
      }
    }
    // Find the global index matching the clicked find + photoIndex (in deduplicated list)
    const foundIndex = flat.findIndex(
      (entry) => entry.find.id === findId && entry.photo === targetPhoto,
    );
    const globalIndex = foundIndex >= 0 ? foundIndex : 0;
    setLightboxPhotos(flat);
    setLightboxIndex(globalIndex);
    setLightboxFallbackFind(fallbackFind);
    setLightboxSpeciesName(fallbackFind?.species_name ?? speciesFinds[0]?.species_name ?? null);
    setLightboxOpen(true);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const enterSelectMode = () => {
    setSelectMode(true);
    setSelectedIds(new Set());
    setMoveTarget('');
  };

  const enterSelectModeWith = (id: number) => {
    setSelectMode(true);
    setSelectedIds(new Set([id]));
    setMoveTarget('');
  };

  const cancelSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setMoveTarget('');
    setMoveDropdownOpen(false);
  };

  const handleBulkMoveSuccess = () => {
    setImportMsg(t('collection.movedToast', { n: selectedIds.size, name: moveTarget }));
    if (importMsgTimer.current) clearTimeout(importMsgTimer.current);
    importMsgTimer.current = setTimeout(() => setImportMsg(null), 4000);
    cancelSelectMode();
  };

  const handleBulkMove = () => {
    if (!moveTarget.trim() || selectedIds.size === 0) return;
    bulkRename.mutate(
      { findIds: Array.from(selectedIds), newSpeciesName: moveTarget.trim() },
      { onSuccess: handleBulkMoveSuccess },
    );
  };

  const handleBulkDeleteSuccess = () => {
    setImportMsg(t('collection.deletedToast', { n: selectedIds.size }));
    if (importMsgTimer.current) clearTimeout(importMsgTimer.current);
    importMsgTimer.current = setTimeout(() => setImportMsg(null), 4000);
    cancelSelectMode();
  };

  useEffect(() => {
    if (!speciesNotesData) return;
    setNoteDrafts((prev) => {
      const next = { ...prev };
      for (const sn of speciesNotesData) {
        next[sn.species_name] = sn.notes;
      }
      return next;
    });
  }, [speciesNotesData]);

  // Map popup "Edit find" round-trip: when editingFindId is set from the map tab,
  // find the record and open EditFindDialog, then clear the store value.
  useEffect(() => {
    if (!editingFindId || !finds) return;
    const target = finds.find((f) => f.id === editingFindId);
    if (target) {
      setEditing(target);
    }
    setEditingFindId(null);
  }, [editingFindId, finds, setEditingFindId]);

  const allGroups = useMemo(() => {
    const map = new Map<string, Find[]>();
    for (const f of finds ?? []) {
      const key = f.species_name || '(unnamed)';
      if (isInternalLibraryName(key)) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    return Array.from(map.entries()).sort((a, b) => compareSpeciesNames(a[0], b[0]));
  }, [finds]);

  const groups = useMemo(
    () => favoritesOnly
      ? allGroups
        .map(([name, speciesFinds]) => [name, speciesFinds.filter((find) => find.is_favorite)] as [string, Find[]])
        .filter(([, speciesFinds]) => speciesFinds.length > 0)
      : allGroups,
    [allGroups, favoritesOnly],
  );

  useEffect(() => {
    if (!selectedCollectionSpecies || allGroups.length === 0) return;

    const rawTarget = selectedCollectionSpecies.trim();
    const plainTarget = plainSpeciesName(rawTarget).toLowerCase();
    const resolvedSpecies = allGroups.find(([name]) => name === rawTarget)?.[0]
      ?? allGroups.find(([name]) => plainSpeciesName(name).toLowerCase() === plainTarget)?.[0]
      ?? allGroups.find(([name]) => plainTarget.startsWith(plainSpeciesName(name).toLowerCase()))?.[0]
      ?? rawTarget;

    setExpanded(new Set([resolvedSpecies]));
    setExpandedFinds(new Set());
    setFocusedSpeciesFilter(resolvedSpecies);
    setSearch(plainSpeciesName(resolvedSpecies));
    setDateSearch('');
    setDateSearchEnd('');
    setMonthSearch('');
    setYearSearch('');
    setFavoritesOnly(false);
    setSelectMode(false);
    setSelectedIds(new Set());
    setMoveTarget('');
    setMoveDropdownOpen(false);
    setJumpTargetSpecies(resolvedSpecies);
    setSelectedCollectionSpecies(null);

    const timer = window.setTimeout(() => setJumpTargetSpecies(null), 2200);
    return () => window.clearTimeout(timer);
  }, [allGroups, selectedCollectionSpecies, setSelectedCollectionSpecies]);

  const speciesFilteredGroups = useMemo(() => {
    if (focusedSpeciesFilter) {
      const plainFocused = plainSpeciesName(focusedSpeciesFilter).toLowerCase();
      return groups.filter(([name]) => (
        name === focusedSpeciesFilter ||
        plainSpeciesName(name).toLowerCase() === plainFocused
      ));
    }
    if (!search.trim()) return groups;
    const q = plainSpeciesName(search).trim().toLowerCase();
    return groups.filter(([name]) => plainSpeciesName(name).toLowerCase().startsWith(q));
  }, [focusedSpeciesFilter, groups, search]);
  const filteredGroups = useMemo(() => {
    const matchesDateFilter = (find: Find) => {
      if (!find.date_found) return false;
      if (dateFilterMode === 'exact') return matchesSmartDate(find.date_found, dateSearch);
      if (dateFilterMode === 'range') {
        if (!dateSearch && !dateSearchEnd) return true;
        const start = parseCompleteDateQuery(dateSearch);
        const end = parseCompleteDateQuery(dateSearchEnd);
        if (start && find.date_found < start) return false;
        if (end && find.date_found > end) return false;
        if (!start && dateSearch && !matchesSmartDate(find.date_found, dateSearch)) return false;
        if (!end && dateSearchEnd && !matchesSmartDate(find.date_found, dateSearchEnd)) return false;
        return true;
      }
      if (dateFilterMode === 'month') return matchesSmartMonth(find.date_found, monthSearch);
      return yearSearch.trim() ? find.date_found.startsWith(yearSearch.trim()) : true;
    };
    const hasDateFilter =
      (dateFilterMode === 'exact' && dateSearch) ||
      (dateFilterMode === 'range' && (dateSearch || dateSearchEnd)) ||
      (dateFilterMode === 'month' && monthSearch) ||
      (dateFilterMode === 'year' && yearSearch.trim());
    if (!hasDateFilter) return speciesFilteredGroups;
    return speciesFilteredGroups
      .map(([name, speciesFinds]) => [name, speciesFinds.filter(matchesDateFilter)] as [string, Find[]])
      .filter(([, speciesFinds]) => speciesFinds.length > 0);
  }, [dateFilterMode, dateSearch, dateSearchEnd, monthSearch, speciesFilteredGroups, yearSearch]);

  const speciesNames = useMemo(
    () => groups.map(([name]) => name).filter((n) => n !== '(unnamed)'),
    [groups],
  );
  const filteredSpecies = useMemo(() => {
    if (!moveTarget.trim()) return speciesNames;
    const q = moveTarget.trim().toLowerCase();
    return speciesNames.filter((n) => plainSpeciesName(n).toLowerCase().startsWith(q));
  }, [speciesNames, moveTarget]);

  const isSearching = search.trim().length > 0;
  const isDateSearching =
    (dateFilterMode === 'exact' && dateSearch.length > 0) ||
    (dateFilterMode === 'range' && (dateSearch.length > 0 || dateSearchEnd.length > 0)) ||
    (dateFilterMode === 'month' && monthSearch.length > 0) ||
    (dateFilterMode === 'year' && yearSearch.trim().length > 0);
  const clearDateSearch = () => {
    setDateSearch('');
    setDateSearchEnd('');
    setMonthSearch('');
    setYearSearch('');
  };
  const dateSearchLabel =
    dateFilterMode === 'month' ? monthSearch :
      dateFilterMode === 'year' ? yearSearch :
        dateFilterMode === 'range' ? [dateSearch, dateSearchEnd].filter(Boolean).join(' - ') :
          dateSearch;
  const favoriteCount = useMemo(
    () => (finds ?? []).filter((find) => find.is_favorite && !isInternalLibraryName(find.species_name)).length,
    [finds],
  );

  const speciesProfilesByName = useMemo(() => {
    const m = new Map<string, SpeciesProfile>();
    speciesProfiles?.forEach((p) => m.set(p.species_name, p));
    return m;
  }, [speciesProfiles]);

  const handleFolderSave = async (
    newName: string,
    edibility: string | null,
    threatStatus: string | null,
    distribution: string | null,
    commonName: string | null,
    note: string | null,
    synonyms: string[],
    otherNames: string[],
  ) => {
    if (!folderEditing) return;
    const existingProfile = speciesProfilesByName.get(folderEditing);
    await upsertSpeciesProfile.mutateAsync({
      speciesName: newName,
      commonName,
      coverPhotoId: existingProfile?.cover_photo_id ?? null,
      tags: existingProfile?.tags ?? [],
      edibility,
      threatStatus,
      distribution,
      edibilityNote: existingProfile?.edibility_note ?? null,
      synonyms,
      otherNames,
      fruitingBodyCountOverride: existingProfile?.fruiting_body_count_override ?? null,
      description: existingProfile?.description ?? null,
    });
    await upsertNote.mutateAsync({ speciesName: newName, notes: note ?? '' });
  };

  const toggleExpand = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleImportComplete = (imported: number, skipped: number) => {
    if (importMsgTimer.current) clearTimeout(importMsgTimer.current);
    setImportMsg(
      t('collection.importSummary', { finds: imported, photos: imported }) +
      (skipped > 0 ? t('collection.skipped', { n: skipped }) : ''),
    );
    importMsgTimer.current = setTimeout(() => setImportMsg(null), 5000);
  };

  const handleNoteSave = (speciesName: string) => {
    const notes = noteDrafts[speciesName] ?? '';
    upsertNote.mutate({ speciesName, notes });
  };

  const handleSetSpeciesCover = (photo: LightboxPhoto) => {
    const speciesName = lightboxSpeciesName ?? photo.find.species_name;
    if (!speciesName) return;
    const existingProfile = speciesProfiles?.find((entry) => entry.species_name === speciesName);
    upsertSpeciesProfile.mutate({
      speciesName,
      commonName: existingProfile?.common_name ?? null,
      coverPhotoId: photo.photo.id,
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
  };

  const handleOpenSpeciesFolder = async (speciesName: string) => {
    if (!storagePath) return;
    try {
      await openSpeciesFolder(storagePath, speciesName);
    } catch (error) {
      setImportMsg(String(error));
      if (importMsgTimer.current) clearTimeout(importMsgTimer.current);
      importMsgTimer.current = setTimeout(() => setImportMsg(null), 5000);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border/60">
        {selectMode ? (
          <>
            <span className="flex-1 text-sm text-muted-foreground">
              {selectedIds.size > 0
                ? tFindsCount(selectedIds.size, lang)
                : t('collection.selectHint')}
            </span>
            <Button variant="ghost" size="sm" onClick={cancelSelectMode} className="flex-shrink-0">
              {t('collection.cancelSelect')}
            </Button>
          </>
        ) : (
          <>
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setFocusedSpeciesFilter(null);
                  setSearch(e.target.value);
                }}
                placeholder={t('species.search')}
                className="w-full h-9 rounded-md border border-border bg-input pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40 transition-colors"
              />
              {isSearching && (
                <button
                  type="button"
                  onClick={() => {
                    setFocusedSpeciesFilter(null);
                    setSearch('');
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Toast message */}
            {importMsg && (
              <span className="text-xs font-medium text-primary whitespace-nowrap">{importMsg}</span>
            )}
            <div className="flex flex-shrink-0 items-center gap-1 rounded-md border border-border bg-input px-1 py-1">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={dateFilterMode}
                onChange={(e) => {
                  setDateFilterMode(e.target.value as 'exact' | 'range' | 'month' | 'year');
                  clearDateSearch();
                }}
                aria-label={t('collection.dateSearchMode')}
                className="h-7 rounded bg-transparent px-1 text-[11px] text-muted-foreground outline-none"
              >
                <option value="exact">{t('collection.dateModeExact')}</option>
                <option value="range">{t('collection.dateModeRange')}</option>
                <option value="month">{t('collection.dateModeMonth')}</option>
                <option value="year">{t('collection.dateModeYear')}</option>
              </select>
              {dateFilterMode === 'exact' && (
                <DatePartsInput
                  value={dateSearch}
                  onChange={setDateSearch}
                  aria-label={t('collection.dateSearch')}
                />
              )}
              {dateFilterMode === 'range' && (
                <>
                  <DatePartsInput
                    value={dateSearch}
                    onChange={setDateSearch}
                    aria-label={t('collection.dateSearchFrom')}
                  />
                  <span className="text-muted-foreground/50">-</span>
                  <DatePartsInput
                    value={dateSearchEnd}
                    onChange={setDateSearchEnd}
                    aria-label={t('collection.dateSearchTo')}
                  />
                </>
              )}
              {dateFilterMode === 'month' && (
                <DatePartsInput
                  value={monthSearch}
                  onChange={setMonthSearch}
                  includeDay={false}
                  aria-label={t('collection.monthSearch')}
                />
              )}
              {dateFilterMode === 'year' && (
                <input
                  type="text"
                  value={yearSearch}
                  onChange={(e) => setYearSearch(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="2026"
                  aria-label={t('collection.yearSearch')}
                  className="h-7 w-16 rounded bg-transparent px-1 text-xs text-foreground outline-none"
                />
              )}
              {isDateSearching && (
                <button
                  type="button"
                  onClick={clearDateSearch}
                  className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={t('collection.clearDateSearch')}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={enterSelectMode} className="gap-1.5 flex-shrink-0 text-muted-foreground hover:text-foreground">
              <CheckSquare className="h-3.5 w-3.5" />
              {t('collection.selectFinds')}
            </Button>
            <Button
              variant={favoritesOnly ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFavoritesOnly((prev) => !prev)}
              className={`gap-1.5 flex-shrink-0 ${favoritesOnly ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Star className={`h-3.5 w-3.5 ${favoritesOnly ? 'fill-primary' : ''}`} />
              {t('collection.favoritesFilter', { n: favoriteCount })}
            </Button>
            <Button
              onClick={() => setCreateFindOpen(true)}
              size="sm"
              variant="outline"
              className="gap-1.5 flex-shrink-0"
            >
              <SquarePen className="h-3.5 w-3.5" />
              {t('collection.newFind')}
            </Button>
            <Button onClick={() => setImportOpen(true)} size="sm" className="gap-1.5 flex-shrink-0">
              <Plus className="h-3.5 w-3.5" />
              {t('collection.importBtn')}
            </Button>
          </>
        )}
      </div>

      {/* Bulk action bar — visible in select mode when items are selected */}
      {selectMode && selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/60 bg-card/40">
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              value={moveTarget}
              onChange={(e) => { setMoveTarget(e.target.value); setMoveDropdownOpen(true); setMoveHighlight(0); }}
              onFocus={() => setMoveDropdownOpen(true)}
              onBlur={() => setTimeout(() => setMoveDropdownOpen(false), 150)}
              onKeyDown={(e) => {
                const visible = filteredSpecies.slice(0, 8);
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setMoveHighlight((h) => Math.min(h + 1, visible.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setMoveHighlight((h) => Math.max(h - 1, 0));
                } else if ((e.key === 'Enter' || e.key === 'Tab') && moveDropdownOpen && visible.length > 0) {
                  e.preventDefault();
                  setMoveTarget(visible[moveHighlight]);
                  setMoveDropdownOpen(false);
                } else if (e.key === 'Enter' && !moveDropdownOpen) {
                  handleBulkMove();
                } else if (e.key === 'Escape') {
                  setMoveDropdownOpen(false);
                }
              }}
              placeholder={t('collection.moveTargetPlaceholder')}
              className="h-8 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40 transition-colors"
            />
            {moveDropdownOpen && filteredSpecies.length > 0 && (
              <div className="absolute z-50 w-full top-full mt-0.5 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                {filteredSpecies.slice(0, 8).map((name, i) => (
                  <button
                    key={name}
                    type="button"
                    className={`w-full text-left px-3 py-1.5 text-sm font-serif transition-colors ${i === moveHighlight ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setMoveTarget(name);
                      setMoveDropdownOpen(false);
                    }}
                    onMouseEnter={() => setMoveHighlight(i)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleBulkMove}
            disabled={!moveTarget.trim() || bulkRename.isPending}
            className="flex-shrink-0 whitespace-nowrap"
          >
            {t('collection.bulkMoveBtn', { n: selectedIds.size })}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setBulkDeleteOpen(true)}
            className="flex-shrink-0 whitespace-nowrap"
          >
            {t('collection.deleteSelected', { n: selectedIds.size })}
          </Button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 pb-10 space-y-2">
        {isLoading && (
          <p className="text-sm text-muted-foreground px-1">{t('collection.loading')}</p>
        )}
        {isError && (
          <Alert variant="destructive">
            <AlertDescription>{String(error)}</AlertDescription>
          </Alert>
        )}
        {!isLoading && !isError && groups.length === 0 && (
          <EmptyState
            icon={GalleryHorizontal}
            heading={t('collection.empty.heading')}
            body={t('collection.empty.body')}
          />
        )}
        {!isLoading && !isError && (isSearching || isDateSearching) && filteredGroups.length === 0 && (
          <p className="text-sm text-muted-foreground px-1 pt-4 text-center">
            {t('collection.noResults', { search: dateSearchLabel || search })}
          </p>
        )}
        {!isLoading && !isError && favoritesOnly && filteredGroups.length === 0 && !isSearching && !isDateSearching && (
          <p className="text-sm text-muted-foreground px-1 pt-4 text-center">
            {t('collection.noFavorites')}
          </p>
        )}

        {/* Species folders */}
        {filteredGroups.map(([speciesName, speciesFinds], idx) => {
          const isOpen = isDateSearching || expanded.has(speciesName);
          const profile = speciesProfilesByName.get(speciesName) ?? null;
          const commonName = normalizeCommonName(profile?.common_name, speciesName);
          const coverPhotoId = profile?.cover_photo_id ?? null;
          const representativePhoto = speciesFinds
            .flatMap((find) => find.photos)
            .find((photo) => photo.id === coverPhotoId) ?? speciesFinds[0]?.photos[0] ?? null;
          const primaryPhoto = representativePhoto;
          const thumbSrc = primaryPhoto
            ? resolvePhotoSrc(storagePath!, primaryPhoto.photo_path, photoAssetVersion)
            : null;
          const isJumpTarget = speciesName === jumpTargetSpecies;
          const speciesFavoriteCount = speciesFinds.filter((find) => find.is_favorite).length;

          const repFind = representativePhoto
            ? speciesFinds.find((f) => f.photos.some((p) => p.id === representativePhoto.id)) ?? null
            : null;
          const repPhotoIdx = repFind
            ? repFind.photos.findIndex((p) => p.id === representativePhoto?.id)
            : 0;

          return (
            <div
              key={speciesName}
              className={`stagger-item overflow-hidden rounded-sm border bg-card ${
                isJumpTarget
                  ? 'border-primary border-l-[3px] ring-1 ring-primary/30'
                  : isOpen
                    ? 'border-primary/60 border-l-[3px]'
                    : 'border-border/70'
              }`}
              style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
            >
              {/* Folder header */}
              <div className={`group relative flex w-full items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-accent/60 ${isOpen ? 'bg-accent/20' : ''}`}>
                {/* Thumbnail — separate button opens lightbox */}
                {thumbSrc ? (
                  <button
                    type="button"
                    className="flex-shrink-0 overflow-hidden rounded-sm h-11 w-11 focus:outline-none focus:ring-2 focus:ring-ring/40"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (repFind) openLightbox(speciesFinds, repFind.id, repPhotoIdx >= 0 ? repPhotoIdx : 0);
                    }}
                    title={t('collection.openPhoto')}
                  >
                    <img
                      src={thumbSrc}
                      alt={speciesName}
                      className="h-11 w-11 object-cover transition-transform duration-150 hover:scale-110"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  </button>
                ) : (
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-sm bg-muted">
                    <FolderOpen className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                )}

                  <button
                    type="button"
                    className="flex flex-1 min-w-0 items-center gap-3 text-left"
                  onClick={() => !isDateSearching && toggleExpand(speciesName)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-serif text-base font-semibold leading-tight truncate text-foreground" title={plainSpeciesName(speciesName)}>
                        {renderSpeciesName(speciesName)}
                      </p>
                      {speciesFavoriteCount > 0 && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600"
                          title={t('species.favoriteCountLabel', { count: speciesFavoriteCount })}
                        >
                          <Star className="h-3 w-3 fill-current" />
                          <span>{speciesFavoriteCount}</span>
                        </span>
                      )}
                    </div>
                    {commonName && (
                      <p className="mt-0.5 truncate text-sm font-bold text-foreground/80 dark:text-secondary" title={commonName}>
                        {commonName}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {tFindsCount(speciesFinds.length, lang)}
                      {' · '}
                      {(() => { const n = speciesFinds.flatMap(f => f.photos).length; return `${n} ${n === 1 ? t('collection.photoUnit.one') : t('collection.photoUnit.many')}`; })()}
                    </p>
                    <div className="mt-1">
                      <SpeciesMetadataBadges
                        speciesProfile={speciesProfilesByName.get(speciesName)}
                        size="md"
                        hideUnknown={false}
                      />
                    </div>
                    {(() => {
                      const profile = speciesProfilesByName.get(speciesName);
                      const otherNames = profile?.other_names ?? [];
                      const synonyms = profile?.synonyms ?? [];
                      const hasNames = otherNames.length > 0 || synonyms.length > 0;
                      if (!hasNames) return null;
                      const title = [
                        synonyms.length ? `${t('species.synonyms')}: ${synonyms.join(' · ')}` : '',
                        otherNames.length ? `${t('species.otherNames')}: ${otherNames.join(' · ')}` : '',
                      ].filter(Boolean).join(' | ');
                      return (
                        <div className="mt-0.5 flex min-w-0 flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground/65" title={title}>
                          {synonyms.length > 0 && (
                            <span className="min-w-0 truncate">
                              <span className="font-semibold text-muted-foreground/80">{t('species.synonyms')}:</span>{' '}
                              <span className="italic">{synonyms.join(', ')}</span>
                            </span>
                          )}
                          {otherNames.length > 0 && (
                            <span className="min-w-0 truncate">
                              <span className="font-semibold text-muted-foreground/80">{t('species.otherNames')}:</span>{' '}
                              {otherNames.join(', ')}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </button>

                <div className="flex shrink-0 items-end gap-1.5 opacity-75 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    className="flex min-w-10 flex-col items-center gap-0.5 rounded px-1 py-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus:text-primary"
                    onClick={(e) => { e.stopPropagation(); setPendingSpeciesSelection(speciesName); setActiveTab('species'); }}
                    title={t('collection.viewSpecies')}
                    aria-label={t('collection.viewSpecies')}
                  >
                    <span className="text-[10px] font-medium leading-none">{t('collection.actionSpecies')}</span>
                    <BookOpen className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="flex min-w-10 flex-col items-center gap-0.5 rounded px-1 py-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus:text-primary"
                    onClick={(e) => { e.stopPropagation(); setFolderEditing(speciesName); }}
                    title={t('collection.editFolder')}
                    aria-label={t('collection.editFolder')}
                  >
                    <span className="text-[10px] font-medium leading-none">{t('collection.actionEdit')}</span>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="flex min-w-10 flex-col items-center gap-0.5 rounded px-1 py-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus:text-primary"
                    onClick={(e) => { e.stopPropagation(); handleOpenSpeciesFolder(speciesName); }}
                    title={t('folder.openFolder')}
                    aria-label={t('folder.openFolder')}
                  >
                    <span className="text-[10px] font-medium leading-none">{t('collection.actionFolder')}</span>
                    <FolderOpen className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="flex min-w-10 flex-col items-center gap-0.5 rounded px-1 py-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus:text-primary"
                    onClick={(e) => { e.stopPropagation(); setPendingMapSpeciesFilter(speciesName); setActiveTab('map'); }}
                    title={t('collection.viewOnMap')}
                    aria-label={t('collection.viewOnMap')}
                  >
                    <span className="text-[10px] font-medium leading-none">{t('collection.actionMap')}</span>
                    <MapIcon className="h-3.5 w-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  className="flex-shrink-0"
                  onClick={() => !isDateSearching && toggleExpand(speciesName)}
                  tabIndex={-1}
                  disabled={isDateSearching}
                >
                  {isOpen
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground/50" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
                </button>
              </div>

              {/* Folder body */}
              {isOpen && (
                <div className="border-t border-border/60 bg-muted/[0.07] px-4 pb-4 pt-4 space-y-3">
                  <textarea
                    placeholder={t('collection.folderNotes')}
                    rows={3}
                    value={noteDrafts[speciesName] ?? ''}
                    onChange={(e) =>
                      setNoteDrafts((prev) => ({ ...prev, [speciesName]: e.target.value }))
                    }
                    onBlur={() => handleNoteSave(speciesName)}
                    className="w-full resize-none rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
                  />
                  {/* Synonyms and other names — compact inline pills, no section headers */}
                  {(() => {
                    const profile = speciesProfilesByName.get(speciesName);
                    const otherNames = profile?.other_names ?? [];
                    const synonyms = profile?.synonyms ?? [];
                    if (otherNames.length === 0 && synonyms.length === 0) return null;
                    return (
                      <div className="space-y-1">
                        {synonyms.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              {t('species.synonyms')}:
                            </span>
                            {synonyms.map((name) => (
                              <span key={name} className="inline-flex items-center rounded border border-border/60 bg-muted/50 px-1.5 py-px text-[10px] italic text-foreground/70">
                                {name}
                              </span>
                            ))}
                          </div>
                        )}
                        {otherNames.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              {t('species.otherNames')}:
                            </span>
                            {otherNames.map((name) => (
                              <span key={name} className="inline-flex items-center rounded border border-border/60 bg-muted/50 px-1.5 py-px text-[10px] text-foreground/70">
                                {name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Per-find collapsible rows */}
                  <div className="flex items-center gap-2 pt-1">
                    <div className="h-px flex-1 bg-border/40" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/45">
                      {t('collection.findsSection')}
                    </span>
                    <div className="h-px flex-1 bg-border/40" />
                  </div>
                  <div className="flex flex-col gap-2">
                    {speciesFinds.map((f, idx) => {
                      const isExpanded = expandedFinds.has(f.id);
                      const firstPhoto = f.photos[0];
                      const rowThumbSrc = firstPhoto ? resolvePhotoSrc(storagePath!, firstPhoto.photo_path, photoAssetVersion) : null;
                      return (
                        <div
                          key={f.id}
                          className={`group/findrow overflow-hidden rounded border bg-card shadow-sm transition-colors ${
                            selectMode && selectedIds.has(f.id)
                              ? 'border-primary/60 bg-primary/8'
                              : 'border-border/50 hover:border-border/80'
                          }`}
                        >
                          {/* Find header row */}
                          <div
                            className={`flex items-center gap-2.5 px-3 py-2 transition-colors cursor-pointer ${
                              selectMode && selectedIds.has(f.id)
                                ? 'bg-primary/10'
                                : 'hover:bg-accent/30'
                            }`}
                            onClick={() => {
                              if (selectMode) {
                                toggleSelect(f.id);
                              } else {
                                openLightbox(speciesFinds, f.id, 0);
                              }
                            }}
                          >
                            {/* Thumbnail */}
                            {rowThumbSrc ? (
                              <img
                                src={rowThumbSrc}
                                alt=""
                                className="h-9 w-9 flex-shrink-0 rounded-sm object-cover"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : (
                              <div className="h-9 w-9 flex-shrink-0 rounded-sm bg-muted" />
                            )}

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground/90 truncate">
                                <span className="font-mono text-[10px] text-muted-foreground/45 mr-1 select-none">{idx + 1}.</span>
                                {f.date_found ? formatDisplayDate(f.date_found, lang) : t('collection.noDate')}
                                {f.location_note && (
                                  <span className="text-muted-foreground"> · {f.location_note}</span>
                                )}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                {f.photos.length} {f.photos.length === 1 ? t('collection.photoUnit.one') : t('collection.photoUnit.many')}
                                {f.is_favorite && <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />}
                              </p>
                              <div className="mt-0.5">
                                <SpeciesMetadataBadges
                                  speciesProfile={speciesProfilesByName.get(f.species_name)}
                                  size="sm"
                                  hideUnknown={true}
                                />
                              </div>
                            </div>

                            {/* Actions — visible on hover */}
                            <div className="flex items-center gap-0.5 opacity-40 group-hover/findrow:opacity-100 focus-within:opacity-100 transition-opacity">
                              {f.lat != null && f.lng != null && (
                                <button
                                  type="button"
                                  className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
                                  onClick={(e) => { e.stopPropagation(); setPendingMapCenter({ lat: f.lat!, lng: f.lng!, zoom: 16 }); setActiveTab('map'); }}
                                  title={t('collection.viewOnMap')}
                                >
                                  <MapIcon className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
                                onClick={(e) => { e.stopPropagation(); setEditing(f); }}
                                title={t('findCard.edit')}
                              >
                                <SquarePen className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
                                onClick={(e) => { e.stopPropagation(); setDeleting(f); }}
                                title={t('collection.deleteFind')}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {/* Expand chevron */}
                            {f.photos.length > 0 && (
                              <button
                                type="button"
                                className="rounded p-1 text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent/50 transition-colors flex-shrink-0"
                                onClick={(e) => { e.stopPropagation(); toggleFindExpand(f.id); }}
                                title={isExpanded ? t('collection.hidePhotos') : t('collection.showPhotos')}
                              >
                                <ChevronDown
                                  className={`h-3.5 w-3.5 transition-transform duration-150 ${isExpanded ? '' : '-rotate-90'}`}
                                />
                              </button>
                            )}
                          </div>

                          {/* Photo grid — collapsible */}
                          {isExpanded && f.photos.length > 0 && (
                            <div className="grid grid-cols-8 gap-1 border-t border-border/30 px-3 pb-3 pt-2 sm:grid-cols-10">
                              {f.photos.map((photo, photoIdx) => (
                                <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-sm bg-muted flex items-center justify-center">
                                  <GalleryHorizontal className="h-4 w-4 text-muted-foreground/20 pointer-events-none" />
                                  <button
                                    type="button"
                                    className="absolute inset-0 w-full h-full"
                                    onClick={() => openLightbox(speciesFinds, f.id, photoIdx)}
                                  >
                                    <img
                                      src={resolvePhotoSrc(storagePath!, photo.photo_path, photoAssetVersion)}
                                      alt=""
                                      className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-105"
                                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                    />
                                  </button>
                                  <button
                                    type="button"
                                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded p-0.5 text-white hover:bg-black/80 z-10"
                                    onClick={(e) => { e.stopPropagation(); setEditing(f); }}
                                    title={t('collection.editFind')}
                                  >
                                    <SquarePen className="h-3 w-3" />
                                  </button>
                                  {selectMode && (
                                    <div
                                      className={`absolute inset-0 flex items-center justify-center transition-colors z-10 ${selectedIds.has(f.id) ? 'bg-primary/40' : 'bg-black/0 group-hover:bg-black/20'}`}
                                      onClick={(e) => { e.stopPropagation(); toggleSelect(f.id); }}
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImportComplete={handleImportComplete}
      />
      <EditFindDialog
        find={editing}
        onOpenChange={(open) => !open && setEditing(null)}
      />
      <FolderEditDialog
        speciesName={folderEditing}
        finds={folderEditing ? (filteredGroups.find(([name]) => name === folderEditing)?.[1] ?? groups.find(([name]) => name === folderEditing)?.[1] ?? []) : []}
        onOpenChange={(open) => !open && setFolderEditing(null)}
        speciesProfile={folderEditing ? speciesProfilesByName.get(folderEditing) : undefined}
        speciesNote={folderEditing ? (speciesNotesData?.find((n) => n.species_name === folderEditing)?.notes ?? '') : ''}
        onSave={handleFolderSave}
      />
      <DeleteFindDialog
        find={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
      <BulkDeleteDialog
        count={selectedIds.size}
        findIds={Array.from(selectedIds)}
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onSuccess={handleBulkDeleteSuccess}
      />
      <PhotoLightbox
        open={lightboxOpen}
        onOpenChange={(open) => {
          setLightboxOpen(open);
          if (!open) {
            setLightboxSpeciesName(null);
            setLightboxFallbackFind(null);
          }
        }}
        photos={lightboxPhotos}
        fallbackFind={lightboxFallbackFind}
        currentIndex={lightboxIndex}
        onIndexChange={setLightboxIndex}
        storagePath={storagePath!}
        onEditFind={(find) => setEditing(find)}
        onDeletePhoto={(lbp, permanentDelete) => {
          deletePhotoMutation.mutate(
            { photoId: lbp.photo.id, deleteFile: true, permanentDelete },
            { onSuccess: () => setLightboxPhotos((prev) => prev.filter((p) => p.photo.id !== lbp.photo.id)) },
          );
        }}
        onSetAsSpeciesCover={handleSetSpeciesCover}
        isCurrentSpeciesCover={(entry) => {
          const speciesName = lightboxSpeciesName ?? entry.find.species_name;
          const profile = speciesProfiles?.find((item) => item.species_name === speciesName);
          return profile?.cover_photo_id === entry.photo.id;
        }}
        speciesProfile={
          lightboxSpeciesName
            ? speciesProfilesByName.get(lightboxSpeciesName)
            : lightboxPhotos[lightboxIndex]?.find?.species_name
              ? speciesProfilesByName.get(lightboxPhotos[lightboxIndex].find.species_name)
              : lightboxFallbackFind?.species_name
                ? speciesProfilesByName.get(lightboxFallbackFind.species_name)
                : undefined
        }
      />
      <CreateFindDialog open={createFindOpen} onOpenChange={setCreateFindOpen} />
    </div>
  );
}
