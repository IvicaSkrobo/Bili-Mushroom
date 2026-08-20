import { memo, useEffect, useMemo, useState } from 'react';
import { FlaskConical, FolderOpen, Printer, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useT } from '@/i18n/index';
import { useAppStore } from '@/stores/appStore';
import { usePhotoThumbnailSrc } from '@/hooks/usePhotoThumbnail';
import { renderSpeciesName, plainSpeciesName } from '@/lib/speciesName';
import { formatDisplayDate } from '@/lib/dateFormat';
import { openSampleFolder, type Sample } from '@/lib/samples';
import { exportSampleLabels } from '@/lib/exportSampleLabels';
import {
  useDeleteSample,
  useSamples,
  useSyncSampleFolder,
  useUpdateSample,
} from '@/hooks/useSamples';

const PRESERVATION_OPTIONS = ['', 'dried', 'ethanol', 'frozen', 'exsiccatum'] as const;

const SampleThumbnail = memo(function SampleThumbnail({
  photoPath,
  className,
}: {
  photoPath: string | null | undefined;
  className: string;
}) {
  const src = usePhotoThumbnailSrc(photoPath, 256);
  if (!src) return null;
  return <img src={src} alt="" className={className} loading="lazy" decoding="async" />;
});

export default function SamplesTab() {
  const t = useT();
  const lang = useAppStore((s) => s.language);
  const storagePath = useAppStore((s) => s.storagePath);
  const samplesQuery = useSamples();
  const updateSample = useUpdateSample();
  const deleteSample = useDeleteSample();
  const syncFolder = useSyncSampleFolder();

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [exportingLabels, setExportingLabels] = useState(false);
  const [labelsSavedPath, setLabelsSavedPath] = useState<string | null>(null);

  const samples = useMemo(() => samplesQuery.data ?? [], [samplesQuery.data]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return samples;
    return samples.filter((sample) =>
      [
        sample.label,
        plainSpeciesName(sample.species_name),
        sample.location_note,
        sample.storage_location ?? '',
        sample.determiner ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [samples, search]);

  // Group by year so the register reads like an accession book.
  const byYear = useMemo(() => {
    const groups = new Map<number, Sample[]>();
    for (const sample of filtered) {
      const list = groups.get(sample.sample_year) ?? [];
      list.push(sample);
      groups.set(sample.sample_year, list);
    }
    return [...groups.entries()].sort((a, b) => b[0] - a[0]);
  }, [filtered]);

  const selected = useMemo(
    () => filtered.find((sample) => sample.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  const [draft, setDraft] = useState<Sample | null>(null);
  useEffect(() => {
    setDraft(selected ? { ...selected } : null);
    setConfirmingDelete(false);
    setActionError(null);
  }, [selected?.id]);

  const saveDraft = (next: Sample) => {
    setDraft(next);
    updateSample.mutate({
      id: next.id,
      preservation: next.preservation?.trim() || null,
      storage_location: next.storage_location?.trim() || null,
      condition: next.condition?.trim() || null,
      spore_print: next.spore_print,
      dna_sample: next.dna_sample,
      dried_at: next.dried_at?.trim() || null,
      dry_weight: next.dry_weight?.trim() || null,
      loaned_to: next.loaned_to?.trim() || null,
      loaned_at: next.loaned_at?.trim() || null,
      notes: next.notes?.trim() || null,
    });
  };

  // Prints whatever the list currently shows, so the search box doubles as the filter
  // for which labels you need.
  const handleExportLabels = async () => {
    if (filtered.length === 0) return;
    setExportingLabels(true);
    setActionError(null);
    setLabelsSavedPath(null);
    try {
      const path = await exportSampleLabels(filtered, {
        title: t('samples.labelsTitle'),
        determiner: t('samples.labelDet'),
        finder: t('samples.labelLeg'),
        storage: t('samples.storageLocation'),
        preservation: t('samples.preservation'),
        defaultFileName: 'etikete-uzorci.pdf',
      });
      if (path) setLabelsSavedPath(path);
    } catch (error) {
      setActionError(String(error));
    } finally {
      setExportingLabels(false);
    }
  };

  const handleOpenFolder = async () => {
    if (!storagePath || !selected) return;
    setActionError(null);
    try {
      await openSampleFolder(storagePath, selected.id);
    } catch (error) {
      setActionError(String(error));
    }
  };

  if (samplesQuery.isLoading) {
    return <p className="px-6 py-6 text-sm text-muted-foreground">{t('samples.loading')}</p>;
  }

  if (samples.length === 0) {
    return (
      <div className="animate-fade-up px-6 py-10">
        <Card className="mx-auto max-w-xl">
          <CardContent className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <FlaskConical className="h-8 w-8 text-primary/60" />
            <h2 className="font-serif text-2xl font-semibold text-foreground">{t('samples.emptyTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('samples.emptyHelp')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 animate-fade-up">
      {/* Register list */}
      <aside className="flex w-[320px] shrink-0 flex-col border-r border-border/60">
        <div className="border-b border-border/50 px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('samples.search')}
              className="h-9 pl-8"
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
              {t('samples.count', { n: filtered.length })}
            </p>
            <button
              type="button"
              onClick={handleExportLabels}
              disabled={exportingLabels || filtered.length === 0}
              title={t('samples.labelsHelp')}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-input px-2 py-1 text-[11px] text-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50"
            >
              <Printer className="h-3.5 w-3.5" />
              {exportingLabels ? t('samples.labelsWorking') : t('samples.labels')}
            </button>
          </div>
          {labelsSavedPath && (
            <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground/70" title={labelsSavedPath}>
              {labelsSavedPath}
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {byYear.map(([year, list]) => (
            <div key={year}>
              <p className="sticky top-0 z-10 bg-card/90 px-4 py-1.5 font-mono text-[11px] font-semibold text-muted-foreground backdrop-blur-sm">
                {year}
              </p>
              {list.map((sample, index) => {
                const isActive = selected?.id === sample.id;
                return (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => setSelectedId(sample.id)}
                    style={{ animationDelay: `${Math.min(index, 12) * 20}ms` }}
                    className={[
                      'stagger-item group flex w-full items-center gap-3 border-l-2 px-4 py-2.5 text-left transition-colors',
                      isActive
                        ? 'border-primary bg-primary/5'
                        : 'border-transparent hover:border-primary/40 hover:bg-accent/40',
                    ].join(' ')}
                  >
                    <span className="w-12 shrink-0 font-mono text-xs font-semibold text-primary">
                      {sample.sample_no}/{sample.sample_year}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-serif text-sm italic text-foreground">
                        {renderSpeciesName(sample.species_name)}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {formatDisplayDate(sample.date_found, lang)}
                        {sample.location_note ? ` · ${sample.location_note}` : ''}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </aside>

      {/* Detail */}
      <main className="min-h-0 flex-1 overflow-y-auto">
        {draft && selected && (
          <div className="space-y-5 px-6 py-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  {selected.sample_no}/{selected.sample_year}
                </p>
                <h2 className="font-serif text-3xl font-semibold text-foreground">
                  {renderSpeciesName(selected.species_name)}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDisplayDate(selected.date_found, lang)}
                  {selected.location_note ? ` · ${selected.location_note}` : ''}
                  {selected.determiner ? ` · det. ${selected.determiner}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleOpenFolder}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-input px-2.5 py-1.5 text-xs text-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  <FolderOpen className="h-3.5 w-3.5" /> {t('samples.openFolder')}
                </button>
                <button
                  type="button"
                  onClick={() => syncFolder.mutate(selected.id)}
                  disabled={syncFolder.isPending}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-input px-2.5 py-1.5 text-xs text-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> {t('samples.syncFolder')}
                </button>
                {confirmingDelete ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="max-w-[22rem] text-right text-[11px] leading-snug text-muted-foreground">
                      {t('samples.removeExplain')}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        deleteSample.mutate({ sampleId: selected.id, deleteFolder: false });
                        setConfirmingDelete(false);
                        setSelectedId(null);
                      }}
                      className="rounded-md border border-destructive/50 px-2.5 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10"
                    >
                      {t('samples.confirmRemove')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      className="rounded-md border border-border/70 px-2 py-1.5 text-xs text-muted-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-input px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> {t('samples.remove')}
                  </button>
                )}
              </div>
            </div>

            {actionError && <p className="text-xs text-destructive">{actionError}</p>}

            {selected.photo_paths.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selected.photo_paths.map((path) => (
                  <SampleThumbnail
                    key={path}
                    photoPath={path}
                    className="h-24 w-24 rounded-md bg-black object-contain"
                  />
                ))}
              </div>
            )}

            <Card className="gap-0 py-5">
              <CardContent className="grid gap-4 px-5 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                    {t('samples.preservation')}
                  </label>
                  <select
                    value={draft.preservation ?? ''}
                    onChange={(e) => saveDraft({ ...draft, preservation: e.target.value || null })}
                    className="mt-1 h-9 w-full rounded-md border border-border bg-input px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                  >
                    {PRESERVATION_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option ? t(`samples.preservation.${option}`) : t('samples.preservationNone')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                    {t('samples.storageLocation')}
                  </label>
                  <Input
                    value={draft.storage_location ?? ''}
                    onChange={(e) => setDraft({ ...draft, storage_location: e.target.value })}
                    onBlur={() => saveDraft(draft)}
                    placeholder={t('samples.storageLocationPlaceholder')}
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                    {t('samples.condition')}
                  </label>
                  <Input
                    value={draft.condition ?? ''}
                    onChange={(e) => setDraft({ ...draft, condition: e.target.value })}
                    onBlur={() => saveDraft(draft)}
                    placeholder={t('samples.conditionPlaceholder')}
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                    {t('samples.driedAt')}
                  </label>
                  <Input
                    type="date"
                    value={draft.dried_at ?? ''}
                    onChange={(e) => saveDraft({ ...draft, dried_at: e.target.value || null })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                    {t('samples.dryWeight')}
                  </label>
                  <Input
                    value={draft.dry_weight ?? ''}
                    onChange={(e) => setDraft({ ...draft, dry_weight: e.target.value })}
                    onBlur={() => saveDraft(draft)}
                    placeholder={t('samples.dryWeightPlaceholder')}
                    className="mt-1"
                  />
                </div>

                <div className="flex items-end gap-4">
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={draft.spore_print}
                      onChange={(e) => saveDraft({ ...draft, spore_print: e.target.checked })}
                      className="h-4 w-4 accent-primary"
                    />
                    {t('samples.sporePrint')}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={draft.dna_sample}
                      onChange={(e) => saveDraft({ ...draft, dna_sample: e.target.checked })}
                      className="h-4 w-4 accent-primary"
                    />
                    {t('samples.dnaSample')}
                  </label>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                    {t('samples.loanedTo')}
                  </label>
                  <Input
                    value={draft.loaned_to ?? ''}
                    onChange={(e) => setDraft({ ...draft, loaned_to: e.target.value })}
                    onBlur={() => saveDraft(draft)}
                    placeholder={t('samples.loanedToPlaceholder')}
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                    {t('samples.loanedAt')}
                  </label>
                  <Input
                    type="date"
                    value={draft.loaned_at ?? ''}
                    onChange={(e) => saveDraft({ ...draft, loaned_at: e.target.value || null })}
                    className="mt-1"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                    {t('samples.notes')}
                  </label>
                  <textarea
                    value={draft.notes ?? ''}
                    onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                    onBlur={() => saveDraft(draft)}
                    rows={3}
                    placeholder={t('samples.notesPlaceholder')}
                    className="mt-1 w-full resize-none rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
                  />
                </div>
              </CardContent>
            </Card>

            {selected.folder_path && (
              <p className="font-mono text-[11px] text-muted-foreground/70">{selected.folder_path}</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
