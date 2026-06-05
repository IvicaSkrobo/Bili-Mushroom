import { useEffect, useState } from 'react';
import { SpeciesNameEditor } from './SpeciesNameEditor';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRenameSpeciesFolder } from '@/hooks/useFinds';
import { useAppStore } from '@/stores/appStore';
import { openSpeciesFolder } from '@/lib/finds';
import { FolderOpen, X, Plus } from 'lucide-react';
import type { Find, SpeciesProfile } from '@/lib/finds';
import { EdibilitySelectBadge, ThreatStatusSelectBadge, DistributionSelectBadge } from '@/components/species/StatusSelectBadge';
import { useT } from '@/i18n/index';

interface FolderEditDialogProps {
  speciesName: string | null; // null = closed
  finds: Find[];
  onOpenChange: (open: boolean) => void;
  speciesProfile?: SpeciesProfile | null;
  speciesNote?: string;
  onSave?: (
    newName: string,
    edibility: string | null,
    threatStatus: string | null,
    distribution: string | null,
    commonName: string | null,
    note: string | null,
    synonyms: string[],
    otherNames: string[],
  ) => void | Promise<void>;
}

export function FolderEditDialog({ speciesName, onOpenChange, speciesProfile, speciesNote, onSave }: FolderEditDialogProps) {
  const storagePath = useAppStore((s) => s.storagePath);
  const t = useT();
  const renameFolder = useRenameSpeciesFolder();

  const [speciesNameInput, setSpeciesNameInput] = useState('');
  const [commonNameInput, setCommonNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [openingFolder, setOpeningFolder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edibility, setEdibility] = useState<string>('unknown');
  const [threatStatus, setThreatStatus] = useState<string>('unknown');
  const [distribution, setDistribution] = useState<string>('unknown');
  const [note, setNote] = useState<string>('');
  const [synonyms, setSynonyms] = useState<string[]>([]);
  const [otherNames, setOtherNames] = useState<string[]>([]);
  const [synonymInput, setSynonymInput] = useState('');
  const [otherNameInput, setOtherNameInput] = useState('');

  // Sync state when dialog opens
  useEffect(() => {
    if (speciesName !== null) {
      setSpeciesNameInput(speciesName);
      setCommonNameInput(speciesProfile?.common_name ?? '');
      setError(null);
      setEdibility(speciesProfile?.edibility ?? 'unknown');
      setThreatStatus(speciesProfile?.threat_status ?? 'unknown');
      setDistribution(speciesProfile?.distribution ?? 'unknown');
      setNote(speciesNote ?? '');
      setSynonyms(speciesProfile?.synonyms ?? []);
      setOtherNames(speciesProfile?.other_names ?? []);
      setSynonymInput('');
      setOtherNameInput('');
    }
  }, [speciesName, speciesProfile]);

  async function handleSave() {
    if (!storagePath || speciesName === null) return;
    setSaving(true);
    setError(null);
    try {
      // Step 1: Rename species if changed
      if (speciesNameInput.trim() !== speciesName && speciesNameInput.trim() !== '') {
        await new Promise<void>((resolve, reject) => {
          renameFolder.mutate(
            { oldSpeciesName: speciesName, newSpeciesName: speciesNameInput.trim() },
            { onSuccess: () => resolve(), onError: (e) => reject(e) },
          );
        });
      }

      await onSave?.(
        speciesNameInput.trim() || speciesName!,
        edibility === 'unknown' ? null : edibility,
        threatStatus === 'unknown' ? null : threatStatus,
        distribution === 'unknown' ? null : distribution,
        commonNameInput.trim() || null,
        note.trim() || null,
        synonyms,
        otherNames,
      );
      onOpenChange(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleOpenFolder() {
    if (!storagePath || speciesName === null) return;
    setError(null);
    setOpeningFolder(true);
    try {
      await openSpeciesFolder(storagePath, speciesName);
    } catch (e) {
      setError(String(e));
    } finally {
      setOpeningFolder(false);
    }
  }

  return (
    <Dialog open={speciesName !== null} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[82vh] !w-[min(600px,calc(100vw-2rem))] !max-w-none flex-col overflow-hidden p-0">
          <div className="shrink-0 border-b border-border/60 px-5 py-3">
            <DialogHeader>
              <DialogTitle>{t('folder.title')}</DialogTitle>
              <DialogDescription>
                {t('folder.description')}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="text-sm font-medium">{t('folder.latinName')}</label>
                </div>
                <SpeciesNameEditor
                  value={speciesNameInput}
                  onChange={setSpeciesNameInput}
                  placeholder={t('edit.latinNamePlaceholder')}
                />
              </div>

              <div>
                <label className="text-sm font-medium">{t('folder.commonName')}</label>
                <Input
                  value={commonNameInput}
                  onChange={(e) => setCommonNameInput(e.target.value)}
                  placeholder={t('edit.commonNamePlaceholder')}
                />
              </div>

              <div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenFolder}
                  disabled={!storagePath || openingFolder}
                  className="flex items-center gap-1"
                >
                  <FolderOpen className="h-4 w-4" />
                  {openingFolder ? t('folder.openingFolder') : t('folder.openFolder')}
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <EdibilitySelectBadge value={edibility} onChange={setEdibility} />
                <ThreatStatusSelectBadge value={threatStatus} onChange={setThreatStatus} />
                <DistributionSelectBadge value={distribution} onChange={setDistribution} />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">{t('species.fieldJournal')}</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder={t('species.noJournalNote')}
                  className="w-full resize-none rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>

              {/* Synonyms */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t('folder.synonyms')}</label>
                <div className="flex gap-1.5">
                  <input
                    value={synonymInput}
                    onChange={(e) => setSynonymInput(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ',') && synonymInput.trim()) {
                        e.preventDefault();
                        const val = synonymInput.trim().replace(/,$/, '');
                        if (val && !synonyms.includes(val)) setSynonyms((prev) => [...prev, val]);
                        setSynonymInput('');
                      }
                    }}
                    placeholder={t('folder.synonymsPlaceholder')}
                    className="flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm font-medium text-foreground placeholder:text-muted-foreground/55 focus:outline-none focus:ring-2 focus:ring-ring/40"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = synonymInput.trim();
                      if (val && !synonyms.includes(val)) setSynonyms((prev) => [...prev, val]);
                      setSynonymInput('');
                    }}
                    disabled={!synonymInput.trim()}
                    className="rounded-md border border-border bg-input px-2.5 py-2 text-sm text-muted-foreground hover:text-primary hover:bg-accent disabled:opacity-40 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {synonyms.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {synonyms.map((s) => (
                      <span key={s} className="inline-flex items-center gap-1.5 rounded-md border border-primary/25 bg-primary/8 px-2.5 py-1 text-sm font-medium text-foreground shadow-sm">
                        <span className="italic">{s}</span>
                        <button type="button" onClick={() => setSynonyms((prev) => prev.filter((x) => x !== s))} className="text-muted-foreground hover:text-destructive transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Other names */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t('folder.otherNames')}</label>
                <div className="flex gap-1.5">
                  <input
                    value={otherNameInput}
                    onChange={(e) => setOtherNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ',') && otherNameInput.trim()) {
                        e.preventDefault();
                        const val = otherNameInput.trim().replace(/,$/, '');
                        if (val && !otherNames.includes(val)) setOtherNames((prev) => [...prev, val]);
                        setOtherNameInput('');
                      }
                    }}
                    placeholder={t('folder.otherNamesPlaceholder')}
                    className="flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm font-medium text-foreground placeholder:text-muted-foreground/55 focus:outline-none focus:ring-2 focus:ring-ring/40"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = otherNameInput.trim();
                      if (val && !otherNames.includes(val)) setOtherNames((prev) => [...prev, val]);
                      setOtherNameInput('');
                    }}
                    disabled={!otherNameInput.trim()}
                    className="rounded-md border border-border bg-input px-2.5 py-2 text-sm text-muted-foreground hover:text-primary hover:bg-accent disabled:opacity-40 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {otherNames.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {otherNames.map((n) => (
                      <span key={n} className="inline-flex items-center gap-1.5 rounded-md border border-secondary/30 bg-secondary/10 px-2.5 py-1 text-sm font-medium text-foreground shadow-sm">
                        {n}
                        <button type="button" onClick={() => setOtherNames((prev) => prev.filter((x) => x !== n))} className="text-muted-foreground hover:text-destructive transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-border/60 px-5 py-3">
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                {t('folder.cancel')}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? t('folder.saving') : t('folder.save')}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
    </Dialog>
  );
}
