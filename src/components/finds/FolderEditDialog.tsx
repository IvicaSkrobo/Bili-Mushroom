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
import { useUpdateFind, useBulkRenameSpecies } from '@/hooks/useFinds';
import { useAppStore } from '@/stores/appStore';
import { openSpeciesFolder } from '@/lib/finds';
import { reverseGeocode } from '@/lib/geocoding';
import { LocationPickerMap } from '@/components/map/LocationPickerMap';
import { FolderOpen, MapPin, X, Plus } from 'lucide-react';
import type { Find, SpeciesProfile } from '@/lib/finds';
import { EdibilitySelectBadge, ThreatStatusSelectBadge, DistributionSelectBadge } from '@/components/species/StatusSelectBadge';
import { useT } from '@/i18n/index';

interface FolderEditDialogProps {
  speciesName: string | null; // null = closed
  finds: Find[];
  onOpenChange: (open: boolean) => void;
  speciesProfile?: SpeciesProfile | null;
  onSave?: (
    newName: string,
    edibility: string | null,
    threatStatus: string | null,
    distribution: string | null,
    edibilityNote: string | null,
    synonyms: string[],
    otherNames: string[],
  ) => void | Promise<void>;
}

export function FolderEditDialog({ speciesName, finds, onOpenChange, speciesProfile, onSave }: FolderEditDialogProps) {
  const storagePath = useAppStore((s) => s.storagePath);
  const lang = useAppStore((s) => s.language);
  const t = useT();
  const updateFind = useUpdateFind();
  const bulkRename = useBulkRenameSpecies();

  const [speciesNameInput, setSpeciesNameInput] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [pickedLat, setPickedLat] = useState<number | null>(null);
  const [pickedLng, setPickedLng] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openingFolder, setOpeningFolder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edibility, setEdibility] = useState<string>('unknown');
  const [threatStatus, setThreatStatus] = useState<string>('unknown');
  const [distribution, setDistribution] = useState<string>('unknown');
  const [edibilityNote, setEdibilityNote] = useState<string>('');
  const [synonyms, setSynonyms] = useState<string[]>([]);
  const [otherNames, setOtherNames] = useState<string[]>([]);
  const [synonymInput, setSynonymInput] = useState('');
  const [otherNameInput, setOtherNameInput] = useState('');

  // Sync state when dialog opens
  useEffect(() => {
    if (speciesName !== null) {
      setSpeciesNameInput(speciesName);
      setCountry('');
      setRegion('');
      setOverwriteExisting(false);
      setPickedLat(null);
      setPickedLng(null);
      setError(null);
      setEdibility(speciesProfile?.edibility ?? 'unknown');
      setThreatStatus(speciesProfile?.threat_status ?? 'unknown');
      setDistribution(speciesProfile?.distribution ?? 'unknown');
      setEdibilityNote(speciesProfile?.edibility_note ?? '');
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
          bulkRename.mutate(
            { findIds: finds.map((f) => f.id), newSpeciesName: speciesNameInput.trim() },
            { onSuccess: () => resolve(), onError: (e) => reject(e) },
          );
        });
      }

      // Step 2: Update location fields (country, region, and/or lat/lng)
      const hasLocationUpdate = country || region || (pickedLat !== null && pickedLng !== null);
      if (hasLocationUpdate) {
        const updates = finds.filter((f) => {
          if (overwriteExisting) return true;
          const needsCountry = country && !f.country;
          const needsRegion = region && !f.region;
          const needsLatLng = pickedLat !== null && (f.lat === null || f.lng === null);
          return needsCountry || needsRegion || needsLatLng;
        });

        await Promise.all(
          updates.map((f) =>
            updateFind.mutateAsync({
              id: f.id,
              species_name: speciesNameInput.trim() || f.species_name,
              date_found: f.date_found,
              country: country ? (overwriteExisting ? country : country || f.country) : f.country,
              region: region ? (overwriteExisting ? region : region || f.region) : f.region,
              location_note: f.location_note,
              lat: pickedLat !== null ? pickedLat : f.lat,
              lng: pickedLng !== null ? pickedLng : f.lng,
              notes: f.notes,
              observed_count: f.observed_count,
              observed_count_min: f.observed_count_min,
              observed_count_max: f.observed_count_max,
              edibility_note: f.edibility_note,
            }),
          ),
        );
      }

      await onSave?.(
        speciesNameInput.trim() || speciesName!,
        edibility === 'unknown' ? null : edibility,
        threatStatus === 'unknown' ? null : threatStatus,
        distribution === 'unknown' ? null : distribution,
        edibilityNote.trim() || null,
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
      await openSpeciesFolder(storagePath, speciesNameInput.trim() || speciesName);
    } catch (e) {
      setError(String(e));
    } finally {
      setOpeningFolder(false);
    }
  }

  const isEdible = ['edible', 'edible_raw', 'conditionally_edible'].includes(edibility);

  return (
    <>
      <Dialog open={speciesName !== null} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('folder.title')}</DialogTitle>
            <DialogDescription>
              {t('folder.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="text-sm font-medium">{t('folder.speciesName')}</label>
              </div>
              <SpeciesNameEditor
                value={speciesNameInput}
                onChange={setSpeciesNameInput}
                placeholder={t('folder.speciesName')}
              />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPickerOpen(true)}
                  className="flex items-center gap-1"
                >
                  <MapPin className="h-4 w-4" />
                  {pickedLat !== null ? t('folder.changeLocation') : t('folder.pickOnMap')}
                </Button>
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
              {pickedLat !== null && (
                <p className="mt-0.5 text-xs text-muted-foreground pl-1">
                  {pickedLat.toFixed(4)}, {pickedLng!.toFixed(4)}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium">{t('edit.country')}</label>
                <Input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder={t('edit.country')}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('edit.region')}</label>
                <Input
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder={t('edit.region')}
                />
              </div>
            </div>

            {(country || region || pickedLat !== null) && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="overwrite-existing"
                  checked={overwriteExisting}
                  onChange={(e) => setOverwriteExisting(e.target.checked)}
                  className="h-4 w-4 rounded border border-border bg-input accent-primary cursor-pointer"
                />
                <label
                  htmlFor="overwrite-existing"
                  className="text-sm text-muted-foreground cursor-pointer select-none"
                >
                  {t('folder.overwriteLabel')}
                </label>
              </div>
            )}

            {(country || region || pickedLat !== null) && !overwriteExisting && (
              <p className="text-xs text-muted-foreground/70">
                {t('folder.overwriteHint', { n: finds.length })}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <EdibilitySelectBadge value={edibility} onChange={setEdibility} />
              <ThreatStatusSelectBadge value={threatStatus} onChange={setThreatStatus} />
              <DistributionSelectBadge value={distribution} onChange={setDistribution} />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">{t('edit.edibilityNote')}</label>
              <textarea
                value={edibilityNote}
                onChange={(e) => setEdibilityNote(e.target.value)}
                rows={3}
                placeholder={t('edit.edibilityNotePlaceholder')}
                className="w-full resize-none rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
              <p className="text-[11px] text-muted-foreground/50">{t('edit.edibilityNoteHelp')}</p>
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
                  className="flex-1 rounded-md border border-border bg-input px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
                <button
                  type="button"
                  onClick={() => {
                    const val = synonymInput.trim();
                    if (val && !synonyms.includes(val)) setSynonyms((prev) => [...prev, val]);
                    setSynonymInput('');
                  }}
                  disabled={!synonymInput.trim()}
                  className="rounded-md border border-border bg-input px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {synonyms.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {synonyms.map((s) => (
                    <span key={s} className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-xs text-foreground/80">
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
                  className="flex-1 rounded-md border border-border bg-input px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
                <button
                  type="button"
                  onClick={() => {
                    const val = otherNameInput.trim();
                    if (val && !otherNames.includes(val)) setOtherNames((prev) => [...prev, val]);
                    setOtherNameInput('');
                  }}
                  disabled={!otherNameInput.trim()}
                  className="rounded-md border border-border bg-input px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {otherNames.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {otherNames.map((n) => (
                    <span key={n} className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-xs text-foreground/80">
                      {n}
                      <button type="button" onClick={() => setOtherNames((prev) => prev.filter((x) => x !== n))} className="text-muted-foreground hover:text-destructive transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {t('folder.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t('folder.saving') : t('folder.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LocationPickerMap
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        initialLatLng={null}
        onConfirm={async (lat, lng) => {
          setPickerOpen(false);
          setPickedLat(lat);
          setPickedLng(lng);
          const geo = await reverseGeocode(lat, lng, lang);
          if (geo.country) setCountry(geo.country);
          if (geo.region) setRegion(geo.region);
        }}
      />
    </>
  );
}
