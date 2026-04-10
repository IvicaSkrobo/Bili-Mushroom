import { useState, useMemo, useEffect, useRef } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { GalleryHorizontal, Plus, ChevronDown, ChevronRight, FolderOpen, Search, X } from 'lucide-react';
import { EmptyState } from '@/components/layout/EmptyState';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { ImportDialog } from '@/components/import/ImportDialog';
import { FindCard } from '@/components/finds/FindCard';
import { EditFindDialog } from '@/components/finds/EditFindDialog';
import { DeleteFindDialog } from '@/components/finds/DeleteFindDialog';
import { useFinds, useSpeciesNotes, useUpsertSpeciesNote } from '@/hooks/useFinds';
import { useAppStore } from '@/stores/appStore';
import { useT, tFindsCount } from '@/i18n/index';
import type { Find } from '@/lib/finds';

export default function CollectionTab() {
  const t = useT();
  const lang = useAppStore((s) => s.language);
  const storagePath = useAppStore((s) => s.storagePath);
  const { data: finds, isLoading, isError, error } = useFinds();
  const { data: speciesNotesData } = useSpeciesNotes();
  const upsertNote = useUpsertSpeciesNote();

  const [importOpen, setImportOpen] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const importMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editing, setEditing] = useState<Find | null>(null);
  const [deleting, setDeleting] = useState<Find | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

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

  const groups = useMemo(() => {
    const map = new Map<string, Find[]>();
    for (const f of finds ?? []) {
      const key = f.species_name || '(unnamed)';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [finds]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.trim().toLowerCase();
    return groups.filter(([name]) => name.toLowerCase().includes(q));
  }, [groups, search]);

  const isSearching = search.trim().length > 0;

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
    setImportMsg(t('collection.imported', { n: imported }) + (skipped > 0 ? t('collection.skipped', { n: skipped }) : ''));
    importMsgTimer.current = setTimeout(() => setImportMsg(null), 5000);
  };

  const handleNoteSave = (speciesName: string) => {
    const notes = noteDrafts[speciesName] ?? '';
    upsertNote.mutate({ speciesName, notes });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border/60">
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

        {/* Import button + message */}
        {importMsg && (
          <span className="text-xs font-medium text-primary whitespace-nowrap">{importMsg}</span>
        )}
        <Button onClick={() => setImportOpen(true)} size="sm" className="gap-1.5 flex-shrink-0">
          <Plus className="h-3.5 w-3.5" />
          {t('collection.importBtn')}
        </Button>
      </div>

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

        {/* Species folders */}
        {filteredGroups.map(([speciesName, speciesFinds], idx) => {
          // When searching: always show expanded. When not: use accordion.
          const isOpen = isSearching || expanded.has(speciesName);
          const primaryPhoto = speciesFinds[0]?.photos[0] ?? null;
          const thumbSrc = primaryPhoto
            ? convertFileSrc(`${storagePath}/${primaryPhoto.photo_path}`)
            : null;

          return (
            <div
              key={speciesName}
              className="stagger-item overflow-hidden rounded-sm border border-border/70 bg-card"
              style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
            >
              {/* Folder header */}
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-accent/60"
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
                  <p className="font-serif text-base font-semibold leading-tight truncate text-foreground">
                    {speciesName}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {tFindsCount(speciesFinds.length, lang)}
                  </p>
                </div>

                {!isSearching && (
                  isOpen
                    ? <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground/50" />
                    : <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground/50" />
                )}
              </button>

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
      <DeleteFindDialog
        find={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
    </div>
  );
}
