import { useState, useMemo, useEffect, useRef } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { GalleryHorizontal, Plus, ChevronDown, ChevronRight, FolderOpen, Search, X, CheckSquare, Pencil, Star } from 'lucide-react';
import { EmptyState } from '@/components/layout/EmptyState';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { ImportDialog } from '@/components/import/ImportDialog';
import { FindCard } from '@/components/finds/FindCard';
import { PhotoLightbox, type LightboxPhoto } from '@/components/finds/PhotoLightbox';
import { EditFindDialog } from '@/components/finds/EditFindDialog';
import { FolderEditDialog } from '@/components/finds/FolderEditDialog';
import { DeleteFindDialog } from '@/components/finds/DeleteFindDialog';
import { BulkDeleteDialog } from '@/components/finds/BulkDeleteDialog';
import { useFinds, useSpeciesNotes, useSpeciesProfiles, useUpsertSpeciesNote, useUpsertSpeciesProfile, useBulkRenameSpecies, useSetFindFavorite } from '@/hooks/useFinds';
import { useAppStore } from '@/stores/appStore';
import { useT, tFindsCount } from '@/i18n/index';
import type { Find } from '@/lib/finds';
import { isInternalLibraryName } from '@/lib/internalEntries';

export default function CollectionTab() {
  const t = useT();
  const lang = useAppStore((s) => s.language);
  const storagePath = useAppStore((s) => s.storagePath);
  const editingFindId = useAppStore((s) => s.editingFindId);
  const setEditingFindId = useAppStore((s) => s.setEditingFindId);
  const selectedCollectionSpecies = useAppStore((s) => s.selectedCollectionSpecies);
  const setSelectedCollectionSpecies = useAppStore((s) => s.setSelectedCollectionSpecies);
  const { data: finds, isLoading, isError, error } = useFinds();
  const { data: speciesNotesData } = useSpeciesNotes();
  const { data: speciesProfiles } = useSpeciesProfiles();
  const upsertNote = useUpsertSpeciesNote();
  const upsertSpeciesProfile = useUpsertSpeciesProfile();
  const setFindFavorite = useSetFindFavorite();

  const [importOpen, setImportOpen] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const importMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editing, setEditing] = useState<Find | null>(null);
  const [deleting, setDeleting] = useState<Find | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
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

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxPhotos, setLightboxPhotos] = useState<LightboxPhoto[]>([]);
  const [lightboxSpeciesName, setLightboxSpeciesName] = useState<string | null>(null);

  const openLightbox = (speciesFinds: Find[], findId: number, photoIndex: number) => {
    const flat: LightboxPhoto[] = [];
    for (const f of speciesFinds) {
      for (const p of f.photos) {
        flat.push({ photo: p, find: f });
      }
    }
    // Find the global index matching the clicked find + photoIndex
    let globalIndex = 0;
    let counted = 0;
    for (const f of speciesFinds) {
      for (let pi = 0; pi < f.photos.length; pi++) {
        if (f.id === findId && pi === photoIndex) {
          globalIndex = counted;
        }
        counted++;
      }
    }
    setLightboxPhotos(flat);
    setLightboxIndex(globalIndex);
    setLightboxSpeciesName(speciesFinds[0]?.species_name ?? null);
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
        if (!(sn.species_name in next)) {
          next[sn.species_name] = sn.notes;
        }
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

  useEffect(() => {
    if (!selectedCollectionSpecies) return;
    setExpanded((prev) => {
      if (prev.has(selectedCollectionSpecies)) return prev;
      const next = new Set(prev);
      next.add(selectedCollectionSpecies);
      return next;
    });
    setSearch(selectedCollectionSpecies);
    setSelectedCollectionSpecies(null);
  }, [selectedCollectionSpecies, setSelectedCollectionSpecies]);

  const groups = useMemo(() => {
    const map = new Map<string, Find[]>();
    for (const f of finds ?? []) {
      const key = f.species_name || '(unnamed)';
      if (isInternalLibraryName(key)) continue;
      if (favoritesOnly && !f.is_favorite) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [favoritesOnly, finds]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.trim().toLowerCase();
    return groups.filter(([name]) => name.toLowerCase().includes(q));
  }, [groups, search]);

  const speciesNames = useMemo(
    () => groups.map(([name]) => name).filter((n) => n !== '(unnamed)'),
    [groups],
  );
  const filteredSpecies = useMemo(() => {
    if (!moveTarget.trim()) return speciesNames;
    const q = moveTarget.trim().toLowerCase();
    return speciesNames.filter((n) => n.toLowerCase().includes(q));
  }, [speciesNames, moveTarget]);

  const isSearching = search.trim().length > 0;
  const favoriteCount = useMemo(
    () => (finds ?? []).filter((find) => find.is_favorite && !isInternalLibraryName(find.species_name)).length,
    [finds],
  );

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
    const existingTags = speciesProfiles?.find((entry) => entry.species_name === speciesName)?.tags ?? [];
    upsertSpeciesProfile.mutate({
      speciesName,
      coverPhotoId: photo.photo.id,
      tags: existingTags,
    });
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
                : (lang === 'hr' ? 'Odaberi nalaze…' : 'Select finds…')}
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
                onChange={(e) => setSearch(e.target.value)}
                placeholder={lang === 'hr' ? 'Pretraži vrste…' : 'Search species…'}
                className="w-full h-9 rounded-md border border-border bg-input pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/40 transition-colors"
              />
              {isSearching && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
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
      <div className="flex-1 overflow-auto p-4 space-y-2">
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
        {!isLoading && !isError && isSearching && filteredGroups.length === 0 && (
          <p className="text-sm text-muted-foreground px-1 pt-4 text-center">
            {lang === 'hr' ? `Nema rezultata za "${search}"` : `No results for "${search}"`}
          </p>
        )}
        {!isLoading && !isError && favoritesOnly && filteredGroups.length === 0 && !isSearching && (
          <p className="text-sm text-muted-foreground px-1 pt-4 text-center">
            {t('collection.noFavorites')}
          </p>
        )}

        {/* Species folders */}
        {filteredGroups.map(([speciesName, speciesFinds], idx) => {
          // When searching: always show expanded. When not: use accordion.
          const isOpen = isSearching || expanded.has(speciesName);
          const profile = speciesProfiles?.find((entry) => entry.species_name === speciesName) ?? null;
          const coverPhotoId = profile?.cover_photo_id ?? null;
          const representativePhoto = speciesFinds
            .flatMap((find) => find.photos)
            .find((photo) => photo.id === coverPhotoId) ?? speciesFinds[0]?.photos[0] ?? null;
          const primaryPhoto = representativePhoto;
          const thumbSrc = primaryPhoto
            ? convertFileSrc(`${storagePath}/${primaryPhoto.photo_path}`)
            : null;
          const isJumpTarget = speciesName === selectedCollectionSpecies;
          const speciesFavoriteCount = speciesFinds.filter((find) => find.is_favorite).length;

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
                <button
                  type="button"
                  className="flex flex-1 min-w-0 items-center gap-3 text-left"
                  onClick={() => !isSearching && toggleExpand(speciesName)}
                >
                  {thumbSrc ? (
                    <img
                      src={thumbSrc}
                      alt={speciesName}
                      className="h-11 w-11 flex-shrink-0 rounded-sm object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-sm bg-muted">
                      <FolderOpen className="h-5 w-5 text-muted-foreground/40" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-serif text-base font-semibold leading-tight truncate text-foreground">
                        {speciesName}
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
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {tFindsCount(speciesFinds.length, lang)}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground hover:bg-accent focus:opacity-100"
                  onClick={(e) => { e.stopPropagation(); setFolderEditing(speciesName); }}
                  title="Edit folder"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>

                {!isSearching && (
                  <button
                    type="button"
                    className="flex-shrink-0"
                    onClick={() => toggleExpand(speciesName)}
                    tabIndex={-1}
                  >
                    {isOpen
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground/50" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
                  </button>
                )}
              </div>

              {/* Folder body */}
              {isOpen && (
                <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-3">
                  <Textarea
                    placeholder={t('collection.folderNotes', { name: speciesName })}
                    rows={2}
                    value={noteDrafts[speciesName] ?? ''}
                    onChange={(e) =>
                      setNoteDrafts((prev) => ({ ...prev, [speciesName]: e.target.value }))
                    }
                    onBlur={() => handleNoteSave(speciesName)}
                    className="text-sm placeholder:text-muted-foreground/40"
                  />
                  <div className="flex flex-col gap-1.5">
                    {speciesFinds.map((f) => (
                      <FindCard
                        key={f.id}
                        find={f}
                        storagePath={storagePath!}
                        onEdit={() => setEditing(f)}
                        onDelete={() => setDeleting(f)}
                        onToggleFavorite={(find) =>
                          setFindFavorite.mutate({ findId: find.id, isFavorite: !find.is_favorite })
                        }
                        selectMode={selectMode}
                        isSelected={selectedIds.has(f.id)}
                        onToggleSelect={toggleSelect}
                        onLongPress={enterSelectModeWith}
                        onPhotoClick={(findId, photoIdx) => openLightbox(speciesFinds, findId, photoIdx)}
                      />
                    ))}
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
          if (!open) setLightboxSpeciesName(null);
        }}
        photos={lightboxPhotos}
        currentIndex={lightboxIndex}
        onIndexChange={setLightboxIndex}
        storagePath={storagePath!}
        onSetAsSpeciesCover={handleSetSpeciesCover}
        isCurrentSpeciesCover={(entry) => {
          const speciesName = lightboxSpeciesName ?? entry.find.species_name;
          const profile = speciesProfiles?.find((item) => item.species_name === speciesName);
          return profile?.cover_photo_id === entry.photo.id;
        }}
      />
    </div>
  );
}
