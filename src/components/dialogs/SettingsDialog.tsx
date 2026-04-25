import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAppStore } from '@/stores/appStore';
import { pickAndSaveStoragePath, clearStoragePath } from '@/lib/storage';
import { useT } from '@/i18n/index';
import type { Lang } from '@/i18n/index';
import { getTileCacheStats, clearTileCache, formatMb, type TileCacheStats } from '@/lib/tileCache';

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
  const [stats, setStats] = useState<TileCacheStats>({ sizeBytes: 0, tileCount: 0 });

  useEffect(() => {
    if (!open) return;
    getTileCacheStats().then(setStats).catch(() => {});
  }, [open]);

  async function handleClear() {
    await clearTileCache(storagePath);
    const fresh = await getTileCacheStats();
    setStats(fresh);
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
        </DialogHeader>
        <div className="space-y-3">
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

          <div className="pt-2 border-t">
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

          <div className="pt-2 border-t">
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

          <div className="pt-2 border-t flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Bili Mushroom</span>
            <span className="text-xs text-muted-foreground font-mono">v{__APP_VERSION__}</span>
          </div>

          <div className="pt-2 border-t">
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-medium">Map Cache</h3>
              <div className="flex items-center justify-between">
                <Label>Tile cache size</Label>
                <span className="text-sm text-muted-foreground" data-testid="tile-cache-size">
                  {formatMb(stats.sizeBytes)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="max-cache-size">Max cache size</Label>
                <div className="flex items-center gap-2">
                  <Input id="max-cache-size" className="w-20" value="200" readOnly />
                  <span className="text-sm text-muted-foreground">MB</span>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-fit">
                    Clear tile cache
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear tile cache?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will delete all cached map tiles. Areas you've previously viewed will need to reload when you're next online.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClear}>Clear cache</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </section>
          </div>

          <div className="pt-2 border-t">
            <div className="text-xs font-medium text-muted-foreground mb-2">{t('settings.resetSection')}</div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setResetConfirmOpen(true)}
            >
              {t('settings.resetBtn')}
            </Button>
          </div>
        </div>
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
