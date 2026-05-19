import { Suspense, lazy, useState } from 'react';
import { Bug, Globe2, Settings as SettingsIcon, Sun, Moon, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useAppStore, type Tab } from '@/stores/appStore';
import { useT } from '@/i18n/index';
import { APP_VERSION } from '@/lib/appMeta';
import { checkDevUpdateMock } from '@/lib/devUpdater';
import { WEBSITE_URL } from '@/lib/externalLinks';
import { openExternalUrl } from '@/lib/openExternal';

const CollectionTab = lazy(() => import('@/tabs/CollectionTab'));
const SpeciesTab = lazy(() => import('@/tabs/SpeciesTab'));
const MapTab = lazy(() => import('@/tabs/MapTab'));
const StatsTab = lazy(() => import('@/tabs/StatsTab'));
const SettingsDialog = lazy(() =>
  import('@/components/dialogs/SettingsDialog').then((m) => ({ default: m.SettingsDialog })),
);
const ReportBugDialog = lazy(() =>
  import('@/components/dialogs/ReportBugDialog').then((m) => ({ default: m.ReportBugDialog })),
);

const TAB_VALUES: Tab[] = ['collection', 'species', 'map', 'stats'];
const TAB_KEYS: Record<Tab, string> = {
  collection: 'nav.collection',
  species: 'nav.species',
  map: 'nav.map',
  stats: 'nav.stats',
};

export function AppShell() {
  const t = useT();
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const availableUpdate = useAppStore((s) => s.availableUpdate);
  const setAvailableUpdate = useAppStore((s) => s.setAvailableUpdate);
  const setUpdateConfirmPending = useAppStore((s) => s.setUpdateConfirmPending);
  const installingUpdate = useAppStore((s) => s.installingUpdate);
  const installStatus = useAppStore((s) => s.installStatus);
  const setInstallStatus = useAppStore((s) => s.setInstallStatus);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportBugOpen, setReportBugOpen] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [checkLabel, setCheckLabel] = useState<string | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  async function handleCheckVersion() {
    if (!('__TAURI_INTERNALS__' in window)) return;
    if (availableUpdate) { setUpdateConfirmPending(true); return; }
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    setCheckError(null);
    setCheckLabel(t('app.checkingUpdate'));
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('UPDATE_CHECK_TIMEOUT')), 45000),
    );
    try {
      const devUpdate = await checkDevUpdateMock();
      const update = devUpdate !== undefined
        ? devUpdate
        : await Promise.race([
            invoke<import('@/stores/appStore').AvailableUpdate | null>('check_app_update'),
            timeout,
          ]);
      if (update) {
        setAvailableUpdate(update);
        setUpdateConfirmPending(true);
        setCheckLabel(null);
      } else {
        setCheckLabel(t('app.upToDate'));
        setTimeout(() => setCheckLabel(null), 3000);
      }
    } catch (err) {
      const msg = String((err as Error)?.message ?? err);
      console.error('[updater] manual check failed:', msg);
      setCheckLabel(null);
      setCheckError(msg === 'UPDATE_CHECK_TIMEOUT' ? t('app.updateTimeout') : t('app.updateCheckFailed'));
    } finally {
      setCheckingUpdate(false);
    }
  }

  async function handleOpenWebsite() {
    try {
      await openExternalUrl(WEBSITE_URL);
    } catch (err) {
      console.error('[external-link] failed to open website:', err);
      toast.error(t('app.openWebsiteFailed'));
    }
  }

  return (
    <div className="relative flex h-screen w-screen flex-col bg-background">
      {/* Header */}
      <header className="relative flex h-16 flex-shrink-0 items-center justify-between border-b border-border/70 bg-card/55 px-6 backdrop-blur-md">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-3xl font-semibold italic text-primary tracking-[0.02em] leading-none">Gljivo</span>
          <span className="text-[10px] font-semibold tracking-[0.35em] uppercase text-foreground/65">book</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 md:flex">
            <button
              type="button"
              onClick={handleCheckVersion}
              title={availableUpdate ? t('app.updateTitle', { version: availableUpdate.version }) : t('app.checkTitle')}
              className="relative rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-foreground/80 hover:border-primary/50 hover:text-primary transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
              disabled={checkingUpdate}
            >
              {`v${APP_VERSION}`}
              {availableUpdate && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary shadow-sm" />
              )}
            </button>
            {checkLabel && (
              <span className="text-[10px] text-muted-foreground/70 animate-pulse">
                {checkLabel}
              </span>
            )}
            {checkError && (
              <span className="flex items-center gap-1 rounded border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive">
                {checkError}
                <button type="button" onClick={() => setCheckError(null)} className="ml-0.5 opacity-60 hover:opacity-100">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-border/70 bg-background/35 px-1.5 py-1">
            <button
              type="button"
              onClick={handleOpenWebsite}
              aria-label={t('app.openWebsite')}
              title={t('app.openWebsite')}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary/10 hover:text-secondary"
            >
              <Globe2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setReportBugOpen(true)}
              aria-label={t('settings.reportBugTitle')}
              title={t('settings.reportBugTitle')}
              className="inline-flex h-11 min-w-[54px] flex-col items-center justify-center gap-0.5 rounded-full px-2 text-destructive/85 transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Bug className="h-4 w-4" />
              <span className="text-[8px] font-bold uppercase leading-none tracking-[0.12em]">{t('app.reportBugShort')}</span>
            </button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('app.toggleTheme')}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('nav.settings')}
              onClick={() => setSettingsOpen(true)}
              className="rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <SettingsIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Update progress / error banner */}
      {installStatus && (
        <div className={`flex items-center justify-center gap-2 border-b px-4 py-2 text-xs font-medium ${
          installStatus.startsWith('Update failed')
            ? 'border-destructive/30 bg-destructive/10 text-destructive'
            : 'border-primary/30 bg-primary/10 text-primary'
        }`}>
          {installingUpdate && (
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          )}
          <span className="flex-1 text-center">{installStatus}</span>
          {!installingUpdate && (
            <button type="button" onClick={() => setInstallStatus(null)} className="opacity-60 hover:opacity-100">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as Tab)}
        className="flex flex-1 flex-col min-h-0"
      >
        <TabsList
          variant="line"
          className="h-11 w-full flex-shrink-0 justify-start rounded-none border-b border-border/70 bg-card/25 px-6 gap-0 backdrop-blur-sm"
        >
          {TAB_VALUES.map((value) => (
            <TabsTrigger
              key={value}
              value={value}
              className="h-11 rounded-none border-0 px-5 text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground hover:text-foreground/80 data-[state=active]:text-primary data-[state=active]:bg-transparent transition-colors"
            >
              {t(TAB_KEYS[value])}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="collection" forceMount className="flex-1 min-h-0 overflow-auto data-[state=inactive]:hidden">
          <Suspense fallback={<div className="h-full w-full animate-pulse bg-card/20" />}>
            <CollectionTab />
          </Suspense>
        </TabsContent>
        <TabsContent value="species" className="flex-1 min-h-0 overflow-auto">
          <Suspense fallback={<div className="h-full w-full animate-pulse bg-card/20" />}>
            <SpeciesTab />
          </Suspense>
        </TabsContent>
        <TabsContent value="map" className="flex-1 min-h-0">
          <Suspense fallback={<div className="h-full w-full animate-pulse bg-card/20" />}>
            <MapTab />
          </Suspense>
        </TabsContent>
        <TabsContent value="stats" className="flex-1 min-h-0">
          <Suspense fallback={<div className="h-full w-full animate-pulse bg-card/20" />}>
            <StatsTab />
          </Suspense>
        </TabsContent>
      </Tabs>

      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
        </Suspense>
      )}
      {reportBugOpen && (
        <Suspense fallback={null}>
          <ReportBugDialog open={reportBugOpen} onOpenChange={setReportBugOpen} />
        </Suspense>
      )}
    </div>
  );
}
