import { useState, useMemo } from 'react';
import { FindsMap } from '@/components/map/FindsMap';
import { SpeciesFilterPanel } from '@/components/map/SpeciesFilterPanel';
import { useAppStore } from '@/stores/appStore';
import { useFinds } from '@/hooks/useFinds';

export default function MapTab() {
  const storagePath = useAppStore((s) => s.storagePath);
  const { data: finds } = useFinds();
  const [selectedSpecies, setSelectedSpecies] = useState<Set<string>>(new Set());

  const allSpecies = useMemo(() => {
    const names = new Set<string>();
    for (const f of finds ?? []) names.add(f.species_name);
    return Array.from(names).sort();
  }, [finds]);

  const filteredFinds = useMemo(() => {
    if (selectedSpecies.size === 0) return finds ?? [];
    return (finds ?? []).filter((f) => selectedSpecies.has(f.species_name));
  }, [finds, selectedSpecies]);

  function handleToggle(name: string) {
    setSelectedSpecies((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  function handleSelectAll() {
    setSelectedSpecies(new Set());
  }

  if (!storagePath) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        Select a storage folder to see your map.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <FindsMap finds={filteredFinds} storagePath={storagePath} />
      <SpeciesFilterPanel
        allSpecies={allSpecies}
        selected={selectedSpecies}
        onToggle={handleToggle}
        onSelectAll={handleSelectAll}
      />
    </div>
  );
}
