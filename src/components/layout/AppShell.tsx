import { Suspense, lazy, useState } from 'react';
import { Settings as SettingsIcon, Sun, Moon } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useAppStore, type Tab } from '@/stores/appStore';
import { useT } from '@/i18n/index';
import { APP_VERSION } from '@/lib/appMeta';

const CollectionTab = lazy(() => import('@/tabs/CollectionTab'));
const SpeciesTab = lazy(() => import('@/tabs/SpeciesTab'));
const MapTab = lazy(() => import('@/tabs/MapTab'));
const StatsTab = lazy(() => import('@/tabs/StatsTab'));
const SettingsDialog = lazy(() =>
  import('@/components/dialogs/SettingsDialog').then((m) => ({ default: m.SettingsDialog })),
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  async function handleCheckVersion() {
    if (!('__TAURI_INTERNALS__' in window)) return;
    if (availableUpdate) { setUpdateConfirmPending(true); return; }
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    try {
      const update = await invoke<import('@/stores/appStore').AvailableUpdate | null>('check_app_update');
      if (update) {
        setAvailableUpdate(update);
      } else {
        toast('You\'re up to date.');
      }
    } catch (err) {
      toast.error(String((err as Error)?.message ?? err));
    } finally {
      setCheckingUpdate(false);
    }
  }

  return (
    <div className="relative flex h-screen w-screen flex-col bg-background">
      {/* Header */}
      <header className="relative flex h-16 flex-shrink-0 items-center justify-between border-b border-border/70 bg-card/55 px-6 backdrop-blur-md">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-3xl font-semibold italic text-primary tracking-[0.02em] leading-none">Bili</span>
          <span className="text-[10px] font-semibold tracking-[0.35em] uppercase text-foreground/65">Mushroom</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 md:flex">
            <button
              type="button"
              onClick={handleCheckVersion}
              title={availableUpdate ? `Update available: v${availableUpdate.version} — open Settings to install` : 'Click to check for updates'}
              className="relative rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-foreground/80 hover:border-primary/50 hover:text-primary transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
              disabled={checkingUpdate}
            >
              {checkingUpdate ? '…' : `v${APP_VERSION}`}
              {availableUpdate && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary shadow-sm" />
              )}
            </button>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-border/70 bg-background/35 px-1.5 py-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
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

        <TabsContent value="collection" className="flex-1 min-h-0 overflow-auto">
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
    </div>
  );
}
