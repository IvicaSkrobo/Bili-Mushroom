import { useState } from 'react';
import { Settings as SettingsIcon, Sun, Moon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useAppStore, type Tab } from '@/stores/appStore';
import CollectionTab from '@/tabs/CollectionTab';
import MapTab from '@/tabs/MapTab';
import StatsTab from '@/tabs/StatsTab';
import { SettingsDialog } from '@/components/dialogs/SettingsDialog';
import { useT } from '@/i18n/index';

const TAB_VALUES: Tab[] = ['collection', 'map', 'stats'];
const TAB_KEYS: Record<Tab, string> = {
  collection: 'nav.collection',
  map: 'nav.map',
  stats: 'nav.stats',
};

export function AppShell() {
  const t = useT();
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="relative flex h-screen w-screen flex-col bg-background">
      {/* Header */}
      <header className="relative flex h-16 flex-shrink-0 items-center justify-between border-b border-border/70 bg-card/55 px-6 backdrop-blur-md">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-3xl font-semibold italic text-primary tracking-[0.02em] leading-none">Bili</span>
          <span className="text-[10px] font-semibold tracking-[0.35em] uppercase text-foreground/65">Mushroom</span>
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

        <TabsContent value="collection" className="flex-1 min-h-0 overflow-auto"><CollectionTab /></TabsContent>
        <TabsContent value="map" className="flex-1 min-h-0"><MapTab /></TabsContent>
<TabsContent value="stats" className="flex-1 min-h-0"><StatsTab /></TabsContent>
      </Tabs>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
