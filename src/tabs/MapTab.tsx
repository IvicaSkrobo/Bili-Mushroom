import { FindsMap } from '@/components/map/FindsMap';
import { useAppStore } from '@/stores/appStore';
import { useFinds } from '@/hooks/useFinds';

export default function MapTab() {
  const storagePath = useAppStore((s) => s.storagePath);
  const { data: finds } = useFinds();

  if (!storagePath) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        Select a storage folder to see your map.
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <FindsMap finds={finds ?? []} storagePath={storagePath} />
    </div>
  );
}
