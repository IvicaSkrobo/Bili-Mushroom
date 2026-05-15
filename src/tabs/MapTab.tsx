import { useState, useMemo, useEffect } from 'react';
import { FindsMap } from '@/components/map/FindsMap';
import { SpeciesFilterPanel } from '@/components/map/SpeciesFilterPanel';
import { ZoneModeControl } from '@/components/map/ZoneModeControl';
import { useAppStore } from '@/stores/appStore';
import { useFinds } from '@/hooks/useFinds';
import { useUpsertZone, useZones } from '@/hooks/useZones';
import { isInternalLibraryName } from '@/lib/internalEntries';
import {
  distanceMeters,
  parsePolygonJson,
  stringifyPolygon,
  type PolygonEditorMode,
  type PolygonEditorState,
  type ZonePolygonPoint,
  type ZoneType,
  type ZoneViewMode,
} from '@/lib/zones';
import type { Zone } from '@/lib/zones';
import type { Find } from '@/lib/finds';
import { compareSpeciesNames, plainSpeciesName } from '@/lib/speciesName';
import { useT } from '@/i18n/index';
import { X } from 'lucide-react';

export default function MapTab() {
  const t = useT();
  const storagePath = useAppStore((s) => s.storagePath);
  const lang = useAppStore((s) => s.language);
  const pendingMapSpeciesFilter = useAppStore((s) => s.pendingMapSpeciesFilter);
  const setPendingMapSpeciesFilter = useAppStore((s) => s.setPendingMapSpeciesFilter);
  const { data: finds } = useFinds();
  const { data: zones } = useZones();
  const upsertZone = useUpsertZone();
  const [selectedSpecies, setSelectedSpecies] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [zoneMode, setZoneMode] = useState<ZoneViewMode>('pins');
  const [activeSpecies, setActiveSpecies] = useState<string | null>(null);
  const [activeZoneId, setActiveZoneId] = useState<number | null>(null);
  const [zoneControlsCollapsed, setZoneControlsCollapsed] = useState(false);
  const [polygonEditor, setPolygonEditor] = useState<PolygonEditorState | null>(null);
  const [localTargetFind, setLocalTargetFind] = useState<Find | null>(null);
  const [regionTargetFind, setRegionTargetFind] = useState<Find | null>(null);
  const [fitBoundsTrigger, setFitBoundsTrigger] = useState(0);
  const polygonEditorActive = polygonEditor != null;

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

  useEffect(() => {
    if (!polygonEditorActive) return;
    setFilterOpen(false);
    setZoneControlsCollapsed(true);
  }, [polygonEditorActive]);

  // Consume a species filter arriving from another tab (Collection / Species).
  // Sets selectedSpecies to that one species and triggers a bounds fit.
  useEffect(() => {
    if (!pendingMapSpeciesFilter) return;
    setSelectedSpecies(new Set([pendingMapSpeciesFilter]));
    setFitBoundsTrigger((n) => n + 1);
    setPendingMapSpeciesFilter(null);
  }, [pendingMapSpeciesFilter, setPendingMapSpeciesFilter]);

  // Keyboard shortcuts active while polygon editor is open
  useEffect(() => {
    if (!polygonEditorActive) return;
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'm' || e.key === 'M') {
        setPolygonEditor((prev) => (prev ? { ...prev, mode: 'move' } : prev));
      } else if (e.key === 'n' || e.key === 'N') {
        setPolygonEditor((prev) => (prev ? { ...prev, mode: 'add' } : prev));
      } else if (
        (e.key === 'Backspace' || e.key === 'Delete') &&
        !e.metaKey && !e.ctrlKey && !e.altKey
      ) {
        setPolygonEditor((prev) => {
          if (!prev || prev.selectedPointIndex == null || prev.points.length <= 3) return prev;
          const nextPoints = prev.points.filter((_, i) => i !== prev.selectedPointIndex!);
          const nextIdx = (prev.selectedPointIndex ?? 0) <= 0 ? 0 : (prev.selectedPointIndex ?? 0) - 1;
          return { ...prev, points: nextPoints, selectedPointIndex: nextIdx };
        });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [polygonEditorActive]);

  const allSpecies = useMemo(() => {
    const names = new Set<string>();
    for (const f of finds ?? []) {
      if (isInternalLibraryName(f.species_name)) continue;
      names.add(f.species_name);
    }
    return Array.from(names).sort(compareSpeciesNames);
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
    if (selectedSpecies.size === 1) {
      const [only] = Array.from(selectedSpecies);
      return visibleSpecies.has(only) ? only : null;
    }
    return null;
  }, [activeSpecies, selectedSpecies, visibleSpecies]);

  const existingRegionZone = useMemo(() => {
    if (!regionTargetSpecies) return null;
    return (zones ?? []).find(
      (zone) =>
        zone.species_name === regionTargetSpecies &&
        zone.zone_type === 'region' &&
        zone.geometry_type === 'circle',
    ) ?? null;
  }, [zones, regionTargetSpecies]);

  const existingRegionPolygon = useMemo(() => {
    if (!regionTargetSpecies) return null;
    return (zones ?? []).find(
      (zone) =>
        zone.species_name === regionTargetSpecies &&
        zone.zone_type === 'region' &&
        zone.geometry_type === 'polygon',
    ) ?? null;
  }, [zones, regionTargetSpecies]);

  const activeZone = useMemo(
    () => (activeZoneId == null ? null : (zones ?? []).find((zone) => zone.id === activeZoneId) ?? null),
    [zones, activeZoneId],
  );
  const existingLocalCircle = useMemo(() => {
    if (!localTargetFind) return null;
    return (zones ?? []).find(
      (zone) =>
        zone.zone_type === 'local' &&
        zone.geometry_type === 'circle' &&
        zone.source_find_id === localTargetFind.id,
    ) ?? null;
  }, [zones, localTargetFind]);
  const existingLocalPolygon = useMemo(() => {
    if (!localTargetFind) return null;
    return (zones ?? []).find(
      (zone) =>
        zone.zone_type === 'local' &&
        zone.geometry_type === 'polygon' &&
        zone.source_find_id === localTargetFind.id,
    ) ?? null;
  }, [zones, localTargetFind]);

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

  function handleClearLocalTarget() {
    setLocalTargetFind(null);
    if (zoneMode === 'local') {
      setActiveZoneId(null);
    }
  }

  function handleClearRegionTarget() {
    setActiveSpecies(null);
    setRegionTargetFind(null);
    if (zoneMode === 'region') {
      setActiveZoneId(null);
    }
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
    if (zoneType === 'local') {
      handleStartLocalPolygonForFind(find);
      return;
    }
    handleStartRegionPolygonForFind(find);
  }

  async function handleCreateLocalCircle() {
    if (!localTargetFind || localTargetFind.lat == null || localTargetFind.lng == null) return;
    if (existingLocalCircle) {
      setZoneMode('local');
      setActiveSpecies(localTargetFind.species_name);
      setActiveZoneId(existingLocalCircle.id);
      return;
    }

    const zone = await upsertZone.mutateAsync({
      species_name: localTargetFind.species_name,
      zone_type: 'local',
      name: `${plainSpeciesName(localTargetFind.species_name)} local`,
      geometry_type: 'circle',
      center_lat: localTargetFind.lat,
      center_lng: localTargetFind.lng,
      radius_meters: 60,
      polygon_json: null,
      source_find_id: localTargetFind.id,
      notes: '',
    });
    setZoneMode('local');
    setActiveSpecies(zone.species_name);
    setActiveZoneId(zone.id);
  }

  async function createRegionZoneForSpecies(speciesName: string, preferredSourceFindId: number | null = null) {
    const locatableFinds = (finds ?? []).filter(
      (find): find is Find & { lat: number; lng: number } =>
        find.species_name === speciesName && find.lat != null && find.lng != null,
    );
    if (locatableFinds.length === 0) return null;

    const existingZone = (zones ?? []).find(
      (zone) =>
        zone.species_name === speciesName &&
        zone.zone_type === 'region' &&
        zone.geometry_type === 'circle',
    ) ?? null;
    if (existingZone) {
      setZoneMode('region');
      setActiveSpecies(speciesName);
      setActiveZoneId(existingZone.id);
      return existingZone;
    }

    const centerLat = locatableFinds.reduce((sum, find) => sum + find.lat, 0) / locatableFinds.length;
    const centerLng = locatableFinds.reduce((sum, find) => sum + find.lng, 0) / locatableFinds.length;
    const furthest = locatableFinds.reduce(
      (max, find) => Math.max(max, distanceMeters(centerLat, centerLng, find.lat, find.lng)),
      0,
    );
    const sourceFindId =
      locatableFinds.find((find) => find.id === preferredSourceFindId)?.id ??
      (locatableFinds.length === 1 ? locatableFinds[0].id : null);

    const zone = await upsertZone.mutateAsync({
      species_name: speciesName,
      zone_type: 'region',
      name: `${plainSpeciesName(speciesName)} region`,
      geometry_type: 'circle',
      center_lat: centerLat,
      center_lng: centerLng,
      radius_meters: Math.max(500, Math.ceil(furthest + 100)),
      polygon_json: null,
      source_find_id: sourceFindId,
      notes: '',
    });
    setZoneMode('region');
    setActiveSpecies(speciesName);
    setActiveZoneId(zone.id);
    return zone;
  }

  async function handleCreateRegionZone() {
    if (!regionTargetSpecies) return;
    await createRegionZoneForSpecies(regionTargetSpecies);
  }

  function openPolygonEditor(opts: {
    zoneType: ZoneType;
    zoneId: number | null;
    speciesName: string;
    sourceFindId: number | null;
    name: string;
    notes: string;
    points: ZonePolygonPoint[];
    initialMode: PolygonEditorMode;
  }) {
    setPolygonEditor({
      zoneType: opts.zoneType,
      zoneId: opts.zoneId,
      speciesName: opts.speciesName,
      sourceFindId: opts.sourceFindId,
      name: opts.name,
      notes: opts.notes,
      points: opts.points,
      mode: opts.initialMode,
      selectedPointIndex: null,
    });
  }

  function handleStartRegionPolygon() {
    if (!regionTargetSpecies) return;
    setZoneMode('region');
    setActiveSpecies(regionTargetSpecies);
    setActiveZoneId(existingRegionPolygon?.id ?? null);
    openPolygonEditor({
      zoneType: 'region',
      zoneId: existingRegionPolygon?.id ?? null,
      speciesName: regionTargetSpecies,
      sourceFindId: null,
      name: existingRegionPolygon?.name ?? `${plainSpeciesName(regionTargetSpecies)} region`,
      notes: existingRegionPolygon?.notes ?? '',
      points: existingRegionPolygon ? parsePolygonJson(existingRegionPolygon.polygon_json) : [],
      initialMode: existingRegionPolygon ? 'move' : 'add',
    });
  }

  function handleStartRegionPolygonForFind(find: Find) {
    if (find.lat == null || find.lng == null) return;
    setRegionTargetFind(find);
    setZoneMode('region');
    setActiveSpecies(find.species_name);
    const polygonZone = (zones ?? []).find(
      (zone) =>
        zone.zone_type === 'region' &&
        zone.geometry_type === 'polygon' &&
        zone.species_name === find.species_name,
    ) ?? null;
    setActiveZoneId(polygonZone?.id ?? null);
    openPolygonEditor({
      zoneType: 'region',
      zoneId: polygonZone?.id ?? null,
      speciesName: find.species_name,
      sourceFindId: null,
      name: polygonZone?.name ?? `${plainSpeciesName(find.species_name)} region`,
      notes: polygonZone?.notes ?? '',
      points: polygonZone ? parsePolygonJson(polygonZone.polygon_json) : [],
      initialMode: polygonZone ? 'move' : 'add',
    });
  }

  function handleStartLocalPolygonForFind(find: Find) {
    if (find.lat == null || find.lng == null) return;
    setZoneMode('local');
    setActiveSpecies(find.species_name);
    const localPolygon = (zones ?? []).find(
      (zone) =>
        zone.zone_type === 'local' &&
        zone.geometry_type === 'polygon' &&
        zone.source_find_id === find.id,
    ) ?? null;
    setActiveZoneId(localPolygon?.id ?? null);
    openPolygonEditor({
      zoneType: 'local',
      zoneId: localPolygon?.id ?? null,
      speciesName: find.species_name,
      sourceFindId: find.id,
      name: localPolygon?.name ?? `${plainSpeciesName(find.species_name)} local`,
      notes: localPolygon?.notes ?? '',
      points: localPolygon ? parsePolygonJson(localPolygon.polygon_json) : [],
      initialMode: localPolygon ? 'move' : 'add',
    });
  }

  function handlePolygonAddPoint(point: ZonePolygonPoint) {
    setPolygonEditor((prev) => prev ? { ...prev, points: [...prev.points, point] } : prev);
  }

  function handlePolygonUndo() {
    setPolygonEditor((prev) => prev ? { ...prev, points: prev.points.slice(0, -1) } : prev);
  }

  function handlePolygonMovePoint(index: number, point: ZonePolygonPoint) {
    setPolygonEditor((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        selectedPointIndex: index,
        points: prev.points.map((existing, i) => (i === index ? point : existing)),
      };
    });
  }

  function handlePolygonSelectPoint(index: number) {
    setPolygonEditor((prev) => prev ? { ...prev, selectedPointIndex: index } : prev);
  }

  function handlePolygonDeletePoint() {
    setPolygonEditor((prev) => {
      if (!prev || prev.selectedPointIndex == null || prev.points.length <= 3) return prev;
      const nextPoints = prev.points.filter((_, i) => i !== prev.selectedPointIndex!);
      const nextIdx = prev.selectedPointIndex <= 0 ? 0 : prev.selectedPointIndex - 1;
      return { ...prev, points: nextPoints, selectedPointIndex: nextIdx };
    });
  }

  function handlePolygonInsertPoint(edgeStartIndex: number, point: ZonePolygonPoint) {
    setPolygonEditor((prev) => {
      if (!prev) return prev;
      const nextPoints = [...prev.points];
      nextPoints.splice(edgeStartIndex + 1, 0, point);
      return { ...prev, points: nextPoints, selectedPointIndex: edgeStartIndex + 1 };
    });
  }

  function handlePolygonSetMode(mode: PolygonEditorMode) {
    setPolygonEditor((prev) => prev ? { ...prev, mode } : prev);
  }

  function handlePolygonCancel() {
    setPolygonEditor(null);
  }

  async function handlePolygonSave() {
    if (!polygonEditor || polygonEditor.points.length < 3) return;
    const savedZone = await upsertZone.mutateAsync({
      id: polygonEditor.zoneId ?? undefined,
      species_name: polygonEditor.speciesName,
      zone_type: polygonEditor.zoneType,
      name: polygonEditor.name,
      geometry_type: 'polygon',
      center_lat: null,
      center_lng: null,
      radius_meters: null,
      polygon_json: stringifyPolygon(polygonEditor.points),
      source_find_id: polygonEditor.sourceFindId,
      notes: polygonEditor.notes,
    });
    setPolygonEditor(null);
    setZoneMode(savedZone.zone_type === 'local' ? 'local' : 'region');
    setActiveSpecies(savedZone.species_name);
    setActiveZoneId(savedZone.id);
  }

  function handlePickLocalTargetFind(find: Find) {
    if (find.lat == null || find.lng == null) return;
    setZoneMode('local');
    setActiveSpecies(find.species_name);
    setLocalTargetFind(find);
    setActiveZoneId(findZoneForFind(find, 'local')?.id ?? null);
  }

  function handlePickRegionTargetFind(find: Find) {
    if (find.lat == null || find.lng == null) return;
    setZoneMode('region');
    setActiveSpecies(find.species_name);
    setRegionTargetFind(find);
    setActiveZoneId(findZoneForFind(find, 'region')?.id ?? null);
  }

  function handleStartPolygonPointEdit() {
    if (!activeZone || activeZone.geometry_type !== 'polygon') return;
    openPolygonEditor({
      zoneType: activeZone.zone_type,
      zoneId: activeZone.id,
      speciesName: activeZone.species_name,
      sourceFindId: activeZone.source_find_id,
      name: activeZone.name,
      notes: activeZone.notes,
      points: parsePolygonJson(activeZone.polygon_json),
      initialMode: 'move',
    });
  }

  function handleZoneSaved(zone: Zone) {
    setZoneMode((current) => (current === 'all' ? current : zone.zone_type));
    setActiveSpecies(zone.species_name);
    setActiveZoneId(zone.id);
    if (zone.geometry_type === 'polygon') {
      setPolygonEditor(null);
    }
  }

  async function handleZoneTypeSelected(zone: Zone, zoneType: ZoneType) {
    setZoneMode((current) => (current === 'all' ? current : zoneType));
    setActiveSpecies(zone.species_name);
    const siblingZones = (zones ?? []).filter(
      (candidate) =>
        candidate.zone_type === zoneType &&
        candidate.species_name === zone.species_name,
    );

    if (zoneType === 'local') {
      const targetFind =
        (finds ?? []).find((find) => find.id === zone.source_find_id) ??
        (localTargetFind?.species_name === zone.species_name ? localTargetFind : null) ??
        ((siblingZones.length === 1 && siblingZones[0].source_find_id != null)
          ? (finds ?? []).find((find) => find.id === siblingZones[0].source_find_id) ?? null
          : null);
      setLocalTargetFind(targetFind);
    }

    if (zone.zone_type === zoneType) {
      setActiveZoneId(zone.id);
      return;
    }

    const matchingZone =
      siblingZones.find(
        (candidate) =>
          zoneType === 'local' &&
          localTargetFind != null &&
          candidate.source_find_id === localTargetFind.id,
      ) ??
      siblingZones.find((candidate) => zone.source_find_id != null && candidate.source_find_id === zone.source_find_id) ??
      (zoneType === 'local' && siblingZones.length > 0 ? siblingZones[0] : null) ??
      (siblingZones.length === 1 ? siblingZones[0] : null);
    if (matchingZone) {
      setActiveZoneId(matchingZone.id);
      return;
    }

    if (zoneType === 'local') {
      const targetFind =
        (finds ?? []).find((find) => find.id === zone.source_find_id) ??
        (finds ?? []).find((find) => find.species_name === zone.species_name && find.lat != null && find.lng != null) ??
        null;

      if (!targetFind) {
        window.alert(t('map.zoneNoFindLocal'));
        setActiveZoneId(zone.id);
        return;
      }

      const shouldCreate = window.confirm(t('map.zoneCreateLocal', { name: plainSpeciesName(zone.species_name) }));
      if (!shouldCreate) {
        setActiveZoneId(zone.id);
        return;
      }

      setLocalTargetFind(targetFind);
      await handleCreateZoneForFind(targetFind, 'local');
      return;
    }

    const shouldCreate = window.confirm(t('map.zoneCreateRegion', { name: plainSpeciesName(zone.species_name) }));
    if (!shouldCreate) {
      setActiveZoneId(zone.id);
      return;
    }

    const targetFind =
      (finds ?? []).find((find) => find.id === zone.source_find_id) ??
      (finds ?? []).find((find) => find.species_name === zone.species_name && find.lat != null && find.lng != null) ??
      null;
    if (!targetFind) {
      window.alert(t('map.zoneNoFindRegion'));
      setActiveZoneId(zone.id);
      return;
    }
    handleStartRegionPolygonForFind(targetFind);
  }

  if (!storagePath) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        {t('map.noStorage')}
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
        onPickLocalTargetFind={handlePickLocalTargetFind}
        onPickRegionTargetFind={handlePickRegionTargetFind}
        onStartLocalPolygonForFind={handleStartLocalPolygonForFind}
        onStartRegionPolygonForFind={handleStartRegionPolygonForFind}
        polygonEditorActive={polygonEditorActive}
        polygonEditorMode={polygonEditor?.mode ?? 'add'}
        polygonEditorPoints={polygonEditor?.points ?? []}
        polygonEditorZoneName={polygonEditor?.name ?? null}
        polygonEditorZoneType={polygonEditor?.zoneType ?? null}
        polygonEditorSelectedPoint={polygonEditor?.selectedPointIndex ?? null}
        onPolygonEditorAddPoint={handlePolygonAddPoint}
        onPolygonEditorMovePoint={handlePolygonMovePoint}
        onPolygonEditorSelectPoint={handlePolygonSelectPoint}
        onPolygonEditorInsertPoint={handlePolygonInsertPoint}
        onPolygonEditorSetMode={handlePolygonSetMode}
        onPolygonEditorUndo={handlePolygonUndo}
        onPolygonEditorDelete={handlePolygonDeletePoint}
        onPolygonEditorCancel={handlePolygonCancel}
        onPolygonEditorSave={handlePolygonSave}
        onStartPolygonEdit={handleStartPolygonPointEdit}
        onSelectSpecies={setActiveSpecies}
        activeZoneId={activeZoneId}
        onEditZone={(zone) => {
          setActiveZoneId(zone?.id ?? null);
          if (zone) setActiveSpecies(zone.species_name);
          if (zone?.id !== polygonEditor?.zoneId) setPolygonEditor(null);
        }}
        onZoneSaved={handleZoneSaved}
        onZoneTypeSelected={handleZoneTypeSelected}
        focusMode={polygonEditorActive}
        fitBoundsTrigger={fitBoundsTrigger}
        drawTargetFind={
          polygonEditor?.zoneType === 'local'
            ? localTargetFind
            : polygonEditor?.zoneType === 'region'
              ? regionTargetFind
              : null
        }
        drawTargetZoneType={polygonEditor?.zoneType ?? null}
      />
      {!polygonEditorActive && (
        <ZoneModeControl
          mode={zoneMode}
          visibleFinds={filteredFinds}
          activeSpecies={regionTargetSpecies}
          localTargetFind={localTargetFind}
          hasLocalCircle={existingLocalCircle != null}
          hasLocalPolygon={existingLocalPolygon != null}
          hasRegionZone={existingRegionZone != null}
          hasRegionPolygon={existingRegionPolygon != null}
          onClearLocalTarget={handleClearLocalTarget}
          onClearRegionTarget={handleClearRegionTarget}
          onCreateLocalCircle={handleCreateLocalCircle}
          onStartLocalPolygon={() => {
            if (localTargetFind) handleStartLocalPolygonForFind(localTargetFind);
          }}
          onModeChange={setZoneMode}
          onCreateRegion={handleCreateRegionZone}
          onStartRegionPolygon={() => {
            if (regionTargetFind) handleStartRegionPolygonForFind(regionTargetFind);
            else handleStartRegionPolygon();
          }}
          creatingRegion={upsertZone.isPending}
          collapsed={zoneControlsCollapsed}
          onCollapsedChange={setZoneControlsCollapsed}
        />
      )}
      {!polygonEditorActive && (
        <SpeciesFilterPanel
          allSpecies={allSpecies}
          selected={selectedSpecies}
          open={filterOpen}
          onOpenChange={setFilterOpen}
          onToggle={handleToggle}
          onSelectAll={handleSelectAll}
        />
      )}

      {/* Active species filter indicator — shown when exactly one species is selected */}
      {selectedSpecies.size === 1 && !polygonEditorActive && (() => {
        const name = [...selectedSpecies][0];
        return (
          <div className="pointer-events-none absolute inset-x-0 bottom-16 z-[1001] flex justify-center px-4">
            <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-primary/40 bg-card/95 px-3.5 py-1.5 shadow-lg backdrop-blur-sm">
              <span className="text-xs text-muted-foreground">
                {t('map.filterLabel')}
              </span>
              <span className="font-serif text-sm font-semibold italic text-foreground">
                {plainSpeciesName(name)}
              </span>
              <button
                type="button"
                onClick={handleSelectAll}
                title={t('map.clearFilter')}
                className="ml-0.5 rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
