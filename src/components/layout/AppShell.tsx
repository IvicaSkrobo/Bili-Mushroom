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
    <div className="flex h-screen w-screen flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border px-6">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-2xl font-bold italic text-primary tracking-tight">Bili</span>
          <span className="text-[10px] font-medium tracking-[0.3em] uppercase text-muted-foreground">Mushroom</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('nav.settings')}
            onClick={() => setSettingsOpen(true)}
            className="text-muted-foreground hover:text-foreground"
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
          className="h-10 w-full flex-shrink-0 justify-start rounded-none border-b border-border bg-transparent px-6 gap-0"
        >
          {TAB_VALUES.map((value) => (
            <TabsTrigger
              key={value}
              value={value}
              className="h-10 rounded-none border-0 px-4 text-[10px] font-medium tracking-[0.18em] uppercase text-muted-foreground hover:text-foreground/70 data-[state=active]:text-primary data-[state=active]:bg-transparent transition-colors"
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
