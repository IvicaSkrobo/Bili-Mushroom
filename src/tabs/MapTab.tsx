import { useState, useMemo, useEffect } from 'react';
import { FindsMap } from '@/components/map/FindsMap';
import { SpeciesFilterPanel } from '@/components/map/SpeciesFilterPanel';
import { ZoneModeControl } from '@/components/map/ZoneModeControl';
import { useAppStore } from '@/stores/appStore';
import { useFinds } from '@/hooks/useFinds';
import { useUpsertZone, useZones } from '@/hooks/useZones';
import { isInternalLibraryName } from '@/lib/internalEntries';
import { distanceMeters, type ZoneType, type ZoneViewMode } from '@/lib/zones';
import type { Zone } from '@/lib/zones';
import type { Find } from '@/lib/finds';

export default function MapTab() {
  const storagePath = useAppStore((s) => s.storagePath);
  const { data: finds } = useFinds();
  const { data: zones } = useZones();
  const upsertZone = useUpsertZone();
  const [selectedSpecies, setSelectedSpecies] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [zoneMode, setZoneMode] = useState<ZoneViewMode>('pins');
  const [activeSpecies, setActiveSpecies] = useState<string | null>(null);
  const [activeZoneId, setActiveZoneId] = useState<number | null>(null);
  const [zoneControlsCollapsed, setZoneControlsCollapsed] = useState(false);

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

  const visibleSpecies = useMemo(
    () => new Set(filteredFinds.map((find) => find.species_name)),
    [filteredFinds],
  );

  const filteredZones = useMemo(
    () => (zones ?? []).filter((zone) => visibleSpecies.has(zone.species_name)),
    [zones, visibleSpecies],
  );

  const regionTargetSpecies = useMemo(() => {
    if (activeSpecies && visibleSpecies.has(activeSpecies)) return activeSpecies;
    const species = Array.from(visibleSpecies);
    return species.length === 1 ? species[0] : null;
  }, [activeSpecies, visibleSpecies]);

  const existingRegionZone = useMemo(() => {
    if (!regionTargetSpecies) return null;
    return (zones ?? []).find(
      (zone) =>
        zone.species_name === regionTargetSpecies &&
        zone.zone_type === 'region' &&
        zone.geometry_type === 'circle',
    ) ?? null;
  }, [zones, regionTargetSpecies]);

  function handleToggle(name: string) {
    setSelectedSpecies((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      setActiveSpecies(name);
      return next;
    });
  }

  function handleSelectAll() {
    setSelectedSpecies(new Set());
    setActiveSpecies(null);
  }

  function findZoneForFind(find: Find, zoneType: ZoneType) {
    return (zones ?? []).find((zone) => {
      if (zone.zone_type !== zoneType || zone.species_name !== find.species_name) return false;
      if (zoneType === 'region') return true;
      return zone.source_find_id === find.id;
    }) ?? null;
  }

  async function handleCreateZoneForFind(find: Find, zoneType: ZoneType) {
    if (find.lat == null || find.lng == null) return;
    setActiveSpecies(find.species_name);
    const existingZone = findZoneForFind(find, zoneType);
    if (existingZone) {
      setZoneMode(zoneType);
      setActiveZoneId(existingZone.id);
      return;
    }
    const zone = await upsertZone.mutateAsync({
      species_name: find.species_name,
      zone_type: zoneType,
      name: `${find.species_name.split(',')[0]} ${zoneType}`,
      geometry_type: 'circle',
      center_lat: find.lat,
      center_lng: find.lng,
      radius_meters: zoneType === 'local' ? 50 : 500,
      polygon_json: null,
      source_find_id: find.id,
      notes: '',
    });
    setZoneMode(zoneType);
    setActiveZoneId(zone.id);
  }

  async function handleCreateRegionZone() {
    if (!regionTargetSpecies) return;
    if (existingRegionZone) {
      setZoneMode('region');
      setActiveZoneId(existingRegionZone.id);
      return;
    }
    const locatableFinds = filteredFinds.filter(
      (find): find is Find & { lat: number; lng: number } =>
        find.species_name === regionTargetSpecies && find.lat != null && find.lng != null,
    );
    if (locatableFinds.length === 0) return;

    const centerLat = locatableFinds.reduce((sum, find) => sum + find.lat, 0) / locatableFinds.length;
    const centerLng = locatableFinds.reduce((sum, find) => sum + find.lng, 0) / locatableFinds.length;
    const furthest = locatableFinds.reduce(
      (max, find) => Math.max(max, distanceMeters(centerLat, centerLng, find.lat, find.lng)),
      0,
    );

    const zone = await upsertZone.mutateAsync({
      species_name: regionTargetSpecies,
      zone_type: 'region',
      name: `${regionTargetSpecies.split(',')[0]} region`,
      geometry_type: 'circle',
      center_lat: centerLat,
      center_lng: centerLng,
      radius_meters: Math.max(500, Math.ceil(furthest + 100)),
      polygon_json: null,
      source_find_id: locatableFinds.length === 1 ? locatableFinds[0].id : null,
      notes: '',
    });
    setZoneMode('region');
    setActiveZoneId(zone.id);
  }

  function handleZoneSaved(zone: Zone) {
    setZoneMode((current) => (current === 'all' ? current : zone.zone_type));
    setActiveSpecies(zone.species_name);
    setActiveZoneId(zone.id);
  }

  function handleZoneTypeSelected(zone: Zone, zoneType: ZoneType) {
    setZoneMode((current) => (current === 'all' ? current : zoneType));
    setActiveSpecies(zone.species_name);
    if (zone.zone_type === zoneType) {
      setActiveZoneId(zone.id);
      return;
    }

    const siblingZones = (zones ?? []).filter(
      (candidate) =>
        candidate.zone_type === zoneType &&
        candidate.species_name === zone.species_name,
    );
    const matchingZone =
      siblingZones.find((candidate) => zone.source_find_id != null && candidate.source_find_id === zone.source_find_id) ??
      (siblingZones.length === 1 ? siblingZones[0] : null);
    if (matchingZone) {
      setActiveZoneId(matchingZone.id);
    }
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
      <FindsMap
        finds={filteredFinds}
        zones={filteredZones}
        zoneMode={zoneMode}
        onCreateZoneForFind={handleCreateZoneForFind}
        onSelectSpecies={setActiveSpecies}
        activeZoneId={activeZoneId}
        onEditZone={(zone) => {
          setActiveZoneId(zone?.id ?? null);
          if (zone) {
            setActiveSpecies(zone.species_name);
          }
        }}
        onZoneSaved={handleZoneSaved}
        onZoneTypeSelected={handleZoneTypeSelected}
      />
      <ZoneModeControl
        mode={zoneMode}
        visibleFinds={filteredFinds}
        activeSpecies={regionTargetSpecies}
        hasRegionZone={existingRegionZone != null}
        onModeChange={setZoneMode}
        onCreateRegion={handleCreateRegionZone}
        creatingRegion={upsertZone.isPending}
        collapsed={zoneControlsCollapsed}
        onCollapsedChange={setZoneControlsCollapsed}
      />
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
