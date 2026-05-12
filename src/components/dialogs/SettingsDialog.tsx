import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '@/stores/appStore';
import { pickAndSaveStoragePath, clearStoragePath } from '@/lib/storage';
import { useT } from '@/i18n/index';
import type { Lang } from '@/i18n/index';
import { getTileCacheStats, clearTileCache, getCacheMaxBytes, setCacheMax, formatMb, type TileCacheStats } from '@/lib/tileCache';
import { APP_VERSION } from '@/lib/appMeta';

export interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const t = useT();
  const storagePath = useAppStore((s) => s.storagePath);
  const setStoragePath = useAppStore((s) => s.setStoragePath);
  const setDbReady = useAppStore((s) => s.setDbReady);
  const setDbError = useAppStore((s) => s.setDbError);
  const setPendingScan = useAppStore((s) => s.setPendingScan);
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const [picking, setPicking] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [pruneConfirmOpen, setPruneConfirmOpen] = useState(false);
  const [pruning, setPruning] = useState(false);
  const [pruneResult, setPruneResult] = useState<number | null>(null);
  const [stats, setStats] = useState<TileCacheStats>({ sizeBytes: 0, tileCount: 0 });
  const [cacheMaxMb, setCacheMaxMb] = useState<string>('200');

  useEffect(() => {
    if (!open) return;
    getTileCacheStats().then(setStats).catch(() => {});
    getCacheMaxBytes().then((b) => setCacheMaxMb(String(Math.round(b / (1024 * 1024))))).catch(() => {});
  }, [open]);

  function handleCacheMaxBlur() {
    const mb = parseInt(cacheMaxMb, 10);
    if (!Number.isFinite(mb) || mb < 50) {
      setCacheMaxMb('50');
      setCacheMax(50 * 1024 * 1024).catch(() => {});
    } else {
      setCacheMax(mb * 1024 * 1024).catch(() => {});
    }
  }

  async function handleClear() {
    await clearTileCache(storagePath);
    const fresh = await getTileCacheStats();
    setStats(fresh);
  }

  async function handlePruneMissing() {
    if (!storagePath) return;
    setPruning(true);
    setPruneResult(null);
    try {
      const removed = await invoke<number>('prune_missing_photos', { storagePath });
      setPruneResult(removed);
      setPruneConfirmOpen(false);
    } finally {
      setPruning(false);
    }
  }

  async function handleReset() {
    await clearStoragePath();
    setStoragePath(null);
    setDbReady(false);
    setDbError(null);
    setPendingScan(false);
    onOpenChange(false);
  }

  async function handleChangeFolder() {
    setPicking(true);
    try {
      const folder = await pickAndSaveStoragePath();
      if (!folder) return;
      setPendingScan(true);
      setDbReady(false);
      setStoragePath(folder); // triggers App.tsx effect → initializeDatabase → setDbReady(true)
      onOpenChange(false);
    } catch (err) {
      setPendingScan(false);
      setDbError(String((err as Error)?.message ?? err));
    } finally {
      setPicking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('settings.title')}</DialogTitle>
          <DialogDescription>
            Manage library location, language, theme, and cached map data.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general">
          <TabsList variant="default" className="w-full">
            <TabsTrigger value="general">{t('settings.tabGeneral')}</TabsTrigger>
            <TabsTrigger value="map">{t('settings.tabMap')}</TabsTrigger>
            <TabsTrigger value="advanced">{t('settings.tabAdvanced')}</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-3 pt-3">
            <div className="text-xs font-medium text-muted-foreground">{t('settings.libraryLocation')}</div>
            <div className="rounded-md bg-muted px-3 py-2 font-mono text-sm">
              {storagePath ?? t('settings.notSet')}
            </div>
            <Button variant="secondary" onClick={handleChangeFolder} disabled={picking}>
              {picking ? t('settings.choosing') : t('settings.changeFolder')}
            </Button>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>{t('settings.changeFolderHint')}</AlertDescription>
            </Alert>

            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">{t('settings.language')}</div>
              <div className="flex gap-2">
                {(['hr', 'en'] as Lang[]).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLanguage(lang)}
                    className={`px-3 py-1.5 rounded text-sm border transition-colors ${
                      language === lang
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-accent border-border'
                    }`}
                  >
                    {lang === 'hr' ? t('settings.langHr') : t('settings.langEn')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">{t('settings.theme')}</div>
              <div className="flex gap-2">
                {(['light', 'dark'] as const).map((th) => (
                  <button
                    key={th}
                    type="button"
                    onClick={() => setTheme(th)}
                    className={`px-3 py-1.5 rounded text-sm border transition-colors ${
                      theme === th
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-accent border-border'
                    }`}
                  >
                    {th === 'light' ? t('settings.themeLight') : t('settings.themeDark')}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">Bili Mushroom</span>
              <span className="text-xs text-muted-foreground font-mono">v{APP_VERSION}</span>
            </div>
          </TabsContent>

          <TabsContent value="map" className="space-y-3 pt-3">
            <h3 className="text-sm font-medium">{t('settings.mapCache')}</h3>
            <div className="flex items-center justify-between">
              <Label>{t('settings.tileCacheSize')}</Label>
              <span className="text-sm text-muted-foreground" data-testid="tile-cache-size">
                {formatMb(stats.sizeBytes)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="max-cache-size">{t('settings.maxCacheSize')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="max-cache-size"
                  className="w-20 text-right"
                  type="number"
                  min={50}
                  value={cacheMaxMb}
                  onChange={(e) => setCacheMaxMb(e.target.value)}
                  onBlur={handleCacheMaxBlur}
                />
                <span className="text-sm text-muted-foreground">MB</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground/60">{t('settings.maxCacheHint')}</p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-fit">
                  {t('settings.clearCache')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('settings.clearCacheTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('settings.clearCacheWarning')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('settings.clearCacheCancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClear}>{t('settings.clearCacheConfirm')}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 pt-3">
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Clean missing photo references</div>
              <p className="text-xs text-muted-foreground/60 mb-2">
                Scans the database for photo entries whose files no longer exist on disk and removes only those database references.
              </p>
              <div className="flex items-center gap-3">
                <AlertDialog open={pruneConfirmOpen} onOpenChange={setPruneConfirmOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={pruning || !storagePath}
                    >
                      {pruning ? 'Scanning...' : 'Clean references'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clean missing photo references?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will not delete photo files. It only removes database entries for files the app cannot find right now. Use it only after you have checked that the selected library folder is correct.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('delete.cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={handlePruneMissing}>
                        {pruning ? 'Scanning...' : 'Clean references'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                {pruneResult !== null && (
                  <span className="text-xs text-muted-foreground">
                    {pruneResult === 0 ? 'No missing references found.' : `Removed ${pruneResult} missing reference${pruneResult === 1 ? '' : 's'}.`}
                  </span>
                )}
              </div>
            </div>

            <div className="border-t border-border/40 pt-3">
              <div className="text-xs font-medium text-muted-foreground mb-2">{t('settings.resetSection')}</div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setResetConfirmOpen(true)}
              >
                {t('settings.resetBtn')}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>

      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.resetTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('settings.resetWarning')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('delete.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>{t('settings.resetConfirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
