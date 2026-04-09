import { useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAppStore, type Tab } from '@/stores/appStore';
import CollectionTab from '@/tabs/CollectionTab';
import MapTab from '@/tabs/MapTab';
import SpeciesTab from '@/tabs/SpeciesTab';
import BrowseTab from '@/tabs/BrowseTab';
import StatsTab from '@/tabs/StatsTab';
import { SettingsDialog } from '@/components/dialogs/SettingsDialog';

const TABS: { value: Tab; label: string }[] = [
  { value: 'collection', label: 'Collection' },
  { value: 'map', label: 'Map' },
  { value: 'species', label: 'Species' },
  { value: 'browse', label: 'Browse' },
  { value: 'stats', label: 'Stats' },
];

export function AppShell() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen flex-col bg-background">
      <div className="flex h-12 items-center justify-between border-b px-4">
        <span className="text-sm font-medium">Bili Mushroom</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </div>
      <Separator />
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as Tab)}
        className="flex flex-1 flex-col"
      >
        <TabsList className="h-11 w-full justify-start rounded-none border-b bg-muted/30 px-4">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="text-xs font-medium">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="collection" className="flex-1"><CollectionTab /></TabsContent>
        <TabsContent value="map" className="flex-1"><MapTab /></TabsContent>
        <TabsContent value="species" className="flex-1"><SpeciesTab /></TabsContent>
        <TabsContent value="browse" className="flex-1"><BrowseTab /></TabsContent>
        <TabsContent value="stats" className="flex-1"><StatsTab /></TabsContent>
      </Tabs>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
