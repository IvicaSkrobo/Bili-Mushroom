import { useState, useMemo, useEffect } from 'react';
import { FindsMap } from '@/components/map/FindsMap';
import { SpeciesFilterPanel } from '@/components/map/SpeciesFilterPanel';
import { useAppStore } from '@/stores/appStore';
import { useFinds } from '@/hooks/useFinds';
import { isInternalLibraryName } from '@/lib/internalEntries';

export default function MapTab() {
  const storagePath = useAppStore((s) => s.storagePath);
  const { data: finds } = useFinds();
  const [selectedSpecies, setSelectedSpecies] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);

  // Space toggles filter panel when map tab is active
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setFilterOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const allSpecies = useMemo(() => {
    const names = new Set<string>();
    for (const f of finds ?? []) {
      if (isInternalLibraryName(f.species_name)) continue;
      names.add(f.species_name);
    }
    return Array.from(names).sort();
  }, [finds]);

  const filteredFinds = useMemo(() => {
    const visibleFinds = (finds ?? []).filter((f) => !isInternalLibraryName(f.species_name));
    if (selectedSpecies.size === 0) return visibleFinds;
    return visibleFinds.filter((f) => selectedSpecies.has(f.species_name));
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
      <FindsMap finds={filteredFinds} />
      <SpeciesFilterPanel
        allSpecies={allSpecies}
        selected={selectedSpecies}
        open={filterOpen}
        onOpenChange={setFilterOpen}
        onToggle={handleToggle}
        onSelectAll={handleSelectAll}
      />
    </div>
  );
}
