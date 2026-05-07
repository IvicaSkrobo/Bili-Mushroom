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
  type ZonePolygonPoint,
  type ZoneType,
  type ZoneViewMode,
} from '@/lib/zones';
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
  const [draftPolygonZone, setDraftPolygonZone] = useState<{
    zoneType: ZoneType;
    zoneId: number | null;
    speciesName: string;
    sourceFindId: number | null;
    name: string;
    notes: string;
    points: ZonePolygonPoint[];
  } | null>(null);
  const [editingPolygonZone, setEditingPolygonZone] = useState<{
    zoneId: number;
    zoneType: ZoneType;
    points: ZonePolygonPoint[];
  } | null>(null);
  const [selectedEditPointIndex, setSelectedEditPointIndex] = useState<number | null>(null);
  const [localTargetFind, setLocalTargetFind] = useState<Find | null>(null);
  const [regionTargetFind, setRegionTargetFind] = useState<Find | null>(null);
  const shapeEditFocus = editingPolygonZone != null;
  const drawFocus = draftPolygonZone != null;

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
    if (!shapeEditFocus) return;
    setFilterOpen(false);
    setZoneControlsCollapsed(true);
  }, [shapeEditFocus]);

  useEffect(() => {
    if (!drawFocus) return;
    setFilterOpen(false);
    setZoneControlsCollapsed(true);
  }, [drawFocus]);

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
      name: `${localTargetFind.species_name.split(',')[0]} local`,
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
      name: `${speciesName.split(',')[0]} region`,
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

  function handleStartRegionPolygon() {
    if (!regionTargetSpecies) return;
    setEditingPolygonZone(null);
    setSelectedEditPointIndex(null);
    setZoneMode('region');
    setActiveSpecies(regionTargetSpecies);
    setActiveZoneId(existingRegionPolygon?.id ?? null);
    setDraftPolygonZone({
      zoneType: 'region',
      zoneId: existingRegionPolygon?.id ?? null,
      speciesName: regionTargetSpecies,
      sourceFindId: null,
      name: existingRegionPolygon?.name ?? `${regionTargetSpecies.split(',')[0]} region`,
      notes: existingRegionPolygon?.notes ?? '',
      points: existingRegionPolygon ? parsePolygonJson(existingRegionPolygon.polygon_json) : [],
    });
  }

  function handleStartRegionPolygonForFind(find: Find) {
    if (find.lat == null || find.lng == null) return;
    setRegionTargetFind(find);
    setSelectedEditPointIndex(null);
    setZoneMode('region');
    setActiveSpecies(find.species_name);
    const polygonZone = (zones ?? []).find(
      (zone) =>
        zone.zone_type === 'region' &&
        zone.geometry_type === 'polygon' &&
        zone.species_name === find.species_name,
    ) ?? null;
    setActiveZoneId(polygonZone?.id ?? null);

    if (polygonZone) {
      // Existing polygon → open edit mode directly (no draft, no accidental point add)
      setDraftPolygonZone(null);
      setEditingPolygonZone({
        zoneId: polygonZone.id,
        zoneType: 'region',
        points: parsePolygonJson(polygonZone.polygon_json),
      });
    } else {
      // No polygon yet → enter draft/draw mode
      setEditingPolygonZone(null);
      setDraftPolygonZone({
        zoneType: 'region',
        zoneId: null,
        speciesName: find.species_name,
        sourceFindId: null,
        name: `${find.species_name.split(',')[0]} region`,
        notes: '',
        points: [],
      });
    }
  }

  function handleAddRegionPolygonPoint(point: ZonePolygonPoint) {
    setDraftPolygonZone((current) => {
      if (!current) return current;
      return {
        ...current,
        points: [...current.points, point],
      };
    });
  }

  function handleUndoRegionPolygonPoint() {
    setDraftPolygonZone((current) => {
      if (!current) return current;
      return {
        ...current,
        points: current.points.slice(0, -1),
      };
    });
  }

  function handleCancelRegionPolygon() {
    setDraftPolygonZone(null);
  }

  async function handleSaveRegionPolygon() {
    if (!draftPolygonZone || draftPolygonZone.points.length < 3) return;
    // Capture points before the async boundary so they survive state clearing below.
    const savedPoints = draftPolygonZone.points;
    const savedZone = await upsertZone.mutateAsync({
      id: draftPolygonZone.zoneId ?? undefined,
      species_name: draftPolygonZone.speciesName,
      zone_type: draftPolygonZone.zoneType,
      name: draftPolygonZone.name,
      geometry_type: 'polygon',
      center_lat: null,
      center_lng: null,
      radius_meters: null,
      polygon_json: stringifyPolygon(draftPolygonZone.points),
      source_find_id: draftPolygonZone.sourceFindId,
      notes: draftPolygonZone.notes,
    });
    setDraftPolygonZone(null);
    setZoneMode(savedZone.zone_type === 'local' ? 'local' : 'region');
    setActiveSpecies(savedZone.species_name);
    setActiveZoneId(savedZone.id);
    // Immediately enter point-adjust mode so the user can refine the shape
    // without having to exit and reopen editing.
    setSelectedEditPointIndex(null);
    setEditingPolygonZone({
      zoneId: savedZone.id,
      zoneType: savedZone.zone_type,
      points: savedPoints,
    });
  }

  function handleStartLocalPolygonForFind(find: Find) {
    if (find.lat == null || find.lng == null) return;
    setSelectedEditPointIndex(null);
    setZoneMode('local');
    setActiveSpecies(find.species_name);
    const existingLocalPolygon = (zones ?? []).find(
      (zone) =>
        zone.zone_type === 'local' &&
        zone.geometry_type === 'polygon' &&
        zone.source_find_id === find.id,
    ) ?? null;
    setActiveZoneId(existingLocalPolygon?.id ?? null);

    if (existingLocalPolygon) {
      // Existing polygon → open edit mode directly (no draft, no accidental point add)
      setDraftPolygonZone(null);
      setEditingPolygonZone({
        zoneId: existingLocalPolygon.id,
        zoneType: 'local',
        points: parsePolygonJson(existingLocalPolygon.polygon_json),
      });
    } else {
      // No polygon yet → enter draft/draw mode
      setEditingPolygonZone(null);
      setDraftPolygonZone({
        zoneType: 'local',
        zoneId: null,
        speciesName: find.species_name,
        sourceFindId: find.id,
        name: `${find.species_name.split(',')[0]} local`,
        notes: '',
        points: [],
      });
    }
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
    setDraftPolygonZone(null);
    setSelectedEditPointIndex(null);
    setEditingPolygonZone({
      zoneId: activeZone.id,
      zoneType: activeZone.zone_type,
      points: parsePolygonJson(activeZone.polygon_json),
    });
  }

  function handleMovePolygonPoint(index: number, point: ZonePolygonPoint) {
    setSelectedEditPointIndex(index);
    setEditingPolygonZone((current) => {
      if (!current) return current;
      return {
        ...current,
        points: current.points.map((existing, existingIndex) =>
          existingIndex === index ? point : existing,
        ),
      };
    });
  }

  function handleSelectPolygonPoint(index: number) {
    setSelectedEditPointIndex(index);
  }

  function handleDeletePolygonPoint() {
    setEditingPolygonZone((current) => {
      if (!current || selectedEditPointIndex == null || current.points.length <= 3) return current;
      const nextPoints = current.points.filter((_, index) => index !== selectedEditPointIndex);
      return {
        ...current,
        points: nextPoints,
      };
    });
    setSelectedEditPointIndex((current) => {
      if (current == null) return null;
      return current <= 0 ? 0 : current - 1;
    });
  }

  function handleInsertPolygonPoint(edgeStartIndex: number, point: ZonePolygonPoint) {
    setEditingPolygonZone((current) => {
      if (!current) return current;
      const nextPoints = [...current.points];
      nextPoints.splice(edgeStartIndex + 1, 0, point);
      return {
        ...current,
        points: nextPoints,
      };
    });
    setSelectedEditPointIndex(edgeStartIndex + 1);
  }

  function handleCancelPolygonPointEdit() {
    setEditingPolygonZone(null);
    setSelectedEditPointIndex(null);
  }

  async function handleSavePolygonPointEdit() {
    if (!editingPolygonZone || editingPolygonZone.points.length < 3) return;
    const zone = (zones ?? []).find((candidate) => candidate.id === editingPolygonZone.zoneId);
    if (!zone) return;
    const savedZone = await upsertZone.mutateAsync({
      id: zone.id,
      species_name: zone.species_name,
      zone_type: zone.zone_type,
      name: zone.name,
      geometry_type: 'polygon',
      center_lat: null,
      center_lng: null,
      radius_meters: null,
      polygon_json: stringifyPolygon(editingPolygonZone.points),
      source_find_id: zone.source_find_id,
      notes: zone.notes,
    });
    setEditingPolygonZone(null);
    setSelectedEditPointIndex(null);
    setActiveZoneId(savedZone.id);
  }

  function handleZoneSaved(zone: Zone) {
    setZoneMode((current) => (current === 'all' ? current : zone.zone_type));
    setActiveSpecies(zone.species_name);
    setActiveZoneId(zone.id);
    if (zone.geometry_type === 'polygon') {
      setDraftPolygonZone(null);
      setEditingPolygonZone(null);
      setSelectedEditPointIndex(null);
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
        window.alert('No mapped find is available to create a local zone for this species yet.');
        setActiveZoneId(zone.id);
        return;
      }

      const shouldCreate = window.confirm(`No local zone exists yet for ${zone.species_name.split(',')[0]}. Create one now?`);
      if (!shouldCreate) {
        setActiveZoneId(zone.id);
        return;
      }

      setLocalTargetFind(targetFind);
      await handleCreateZoneForFind(targetFind, 'local');
      return;
    }

    const shouldCreate = window.confirm(`No region zone exists yet for ${zone.species_name.split(',')[0]}. Create one now?`);
    if (!shouldCreate) {
      setActiveZoneId(zone.id);
      return;
    }

    const targetFind =
      (finds ?? []).find((find) => find.id === zone.source_find_id) ??
      (finds ?? []).find((find) => find.species_name === zone.species_name && find.lat != null && find.lng != null) ??
      null;
    if (!targetFind) {
      window.alert('No mapped finds are available to create a region zone for this species yet.');
      setActiveZoneId(zone.id);
      return;
    }
    handleStartRegionPolygonForFind(targetFind);
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
        onPickLocalTargetFind={handlePickLocalTargetFind}
        onPickRegionTargetFind={handlePickRegionTargetFind}
        onStartLocalPolygonForFind={handleStartLocalPolygonForFind}
        onStartRegionPolygonForFind={handleStartRegionPolygonForFind}
        polygonDraftActive={draftPolygonZone != null}
        polygonDraftPoints={draftPolygonZone?.points ?? []}
        onPolygonDraftPointAdd={handleAddRegionPolygonPoint}
        polygonDraftZoneName={draftPolygonZone?.name ?? null}
        polygonDraftZoneType={draftPolygonZone?.zoneType ?? null}
        onPolygonDraftSave={handleSaveRegionPolygon}
        onPolygonDraftCancel={handleCancelRegionPolygon}
        onPolygonDraftUndo={handleUndoRegionPolygonPoint}
        polygonEditActive={editingPolygonZone != null}
        polygonEditPoints={editingPolygonZone?.points ?? []}
        onPolygonEditPointMove={handleMovePolygonPoint}
        onPolygonEditPointSelect={handleSelectPolygonPoint}
        onPolygonEditPointInsert={handleInsertPolygonPoint}
        selectedPolygonEditPointIndex={selectedEditPointIndex}
        onPolygonEditPointDelete={handleDeletePolygonPoint}
        onStartPolygonEdit={handleStartPolygonPointEdit}
        onCancelPolygonEdit={handleCancelPolygonPointEdit}
        onSavePolygonEdit={handleSavePolygonPointEdit}
        polygonEditZoneName={activeZone?.name ?? null}
        polygonEditZoneType={editingPolygonZone?.zoneType ?? activeZone?.zone_type ?? null}
        onSelectSpecies={setActiveSpecies}
        activeZoneId={activeZoneId}
        onEditZone={(zone) => {
          setActiveZoneId(zone?.id ?? null);
          if (zone) {
            setActiveSpecies(zone.species_name);
          }
          if (zone?.id !== editingPolygonZone?.zoneId) {
            setEditingPolygonZone(null);
            setSelectedEditPointIndex(null);
          }
        }}
        onZoneSaved={handleZoneSaved}
        onZoneTypeSelected={handleZoneTypeSelected}
        focusMode={drawFocus || shapeEditFocus}
        drawTargetFind={
          draftPolygonZone?.zoneType === 'local'
            ? localTargetFind
            : draftPolygonZone?.zoneType === 'region'
              ? regionTargetFind
              : null
        }
        drawTargetZoneType={draftPolygonZone?.zoneType ?? null}
      />
      {!drawFocus && (
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
          onSaveRegionPolygon={handleSaveRegionPolygon}
          onUndoRegionPolygon={handleUndoRegionPolygonPoint}
          onCancelRegionPolygon={handleCancelRegionPolygon}
          creatingRegion={upsertZone.isPending}
          drawingRegionPolygon={draftPolygonZone?.zoneType === 'region'}
          regionPolygonPointCount={draftPolygonZone?.zoneType === 'region' ? draftPolygonZone.points.length : 0}
          collapsed={zoneControlsCollapsed}
          onCollapsedChange={setZoneControlsCollapsed}
        />
      )}
      {!drawFocus && (
        <SpeciesFilterPanel
          allSpecies={allSpecies}
          selected={selectedSpecies}
          open={filterOpen}
          onOpenChange={setFilterOpen}
          onToggle={handleToggle}
          onSelectAll={handleSelectAll}
        />
      )}
    </div>
  );
}
