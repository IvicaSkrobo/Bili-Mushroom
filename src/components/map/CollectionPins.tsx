import { useState, useCallback, useEffect, useMemo, useRef, type MouseEvent } from 'react';
import L from 'leaflet';
import { Marker, Popup, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { BookOpen, ChevronLeft, ChevronRight, LayoutList, ZoomIn } from 'lucide-react';
import type { Find, SpeciesProfile } from '@/lib/finds';
import type { Zone } from '@/lib/zones';
import { resolvePhotoSrc } from '@/lib/photoSrc';
import { useSpeciesNotes, useSpeciesProfiles } from '@/hooks/useFinds';
import { useAppStore } from '@/stores/appStore';
import { SpeciesMetadataBadges } from '@/components/species/SpeciesMetadataBadges';
import { renderSpeciesName, plainSpeciesName, normalizeCommonName } from '@/lib/speciesName';
import { tFindsCount } from '@/i18n/index';

export const LABEL_ZOOM_THRESHOLD = 13;

interface SpeciesEntry {
  name: string;   // stable species_name from DB
  finds: Find[];
}

interface LocationGroup {
  key: string;           // coordKey(lat, lng)
  lat: number;
  lng: number;
  species: SpeciesEntry[];
  labelText: string;     // HTML for pin label
  suppressLabel: boolean;
}

function collectionIcon(labelText: string, showLabel: boolean, isSatellite: boolean): L.DivIcon {
  const classes = [
    'bili-collection-marker',
    isSatellite ? 'bili-collection-marker--satellite' : '',
    !showLabel ? 'bili-collection-marker--hidden-label' : '',
  ].filter(Boolean).join(' ');

  return L.divIcon({
    html: `<div class="bili-pin-dot"></div><div class="bili-pin-label">${labelText}</div>`,
    className: classes,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -14],
  });
}

const collectionIconCache = new Map<string, L.DivIcon>();

function getCollectionIcon(labelText: string, showLabel: boolean, isSatellite: boolean): L.DivIcon {
  const cacheKey = `${labelText}|${showLabel ? 'l' : 'd'}|${isSatellite ? 's' : 'n'}`;
  const cached = collectionIconCache.get(cacheKey);
  if (cached) return cached;
  const created = collectionIcon(labelText, showLabel, isSatellite);
  collectionIconCache.set(cacheKey, created);
  return created;
}

function CollectionPopup({
  locationGroup,
  storagePath,
  onStartLocalPolygonForFind,
  onStartRegionPolygonForFind,
  zones,
  speciesNotesByName,
  speciesProfilesByName,
}: {
  locationGroup: LocationGroup;
  storagePath: string;
  onStartLocalPolygonForFind: (find: Find) => void;
  onStartRegionPolygonForFind: (find: Find) => void;
  zones: Zone[];
  speciesNotesByName: Map<string, string>;
  speciesProfilesByName: Map<string, SpeciesProfile>;
}) {
  const map = useMap();
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const setSelectedCollectionSpecies = useAppStore((s) => s.setSelectedCollectionSpecies);
  const setPendingSpeciesSelection = useAppStore((s) => s.setPendingSpeciesSelection);
  const lang = useAppStore((s) => s.language);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const previousButtonRef = useRef<HTMLButtonElement | null>(null);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  // Navigate by species_name (stable DB key) rather than array index so
  // a refetch mid-session never silently shifts the carousel to the wrong species.
  const [selectedSpeciesName, setSelectedSpeciesName] = useState<string | null>(null);
  const speciesRef = useRef(locationGroup.species);
  speciesRef.current = locationGroup.species;

  useEffect(() => { setSelectedSpeciesName(null); }, [locationGroup.key]);

  useEffect(() => {
    if (!popupRef.current) return;
    L.DomEvent.disableScrollPropagation(popupRef.current);
  }, []);

  const currentIdx = selectedSpeciesName != null
    ? locationGroup.species.findIndex((s) => s.name === selectedSpeciesName)
    : 0;
  const safeIdx = currentIdx < 0 ? 0 : currentIdx;
  const currentSpecies = locationGroup.species[safeIdx] ?? locationGroup.species[0];
  if (!currentSpecies) return null;

  const speciesProfile = speciesProfilesByName.get(currentSpecies.name);
  const commonName = normalizeCommonName(speciesProfile?.common_name, currentSpecies.name);
  const speciesNote = speciesNotesByName.get(currentSpecies.name);

  const representativeFind =
    currentSpecies.finds.find((f) => f.photos.some((p) => p.is_primary)) ??
    currentSpecies.finds[0] ??
    null;
  const representativePhoto =
    representativeFind?.photos.find((p) => p.is_primary) ??
    representativeFind?.photos[0] ??
    null;
  const photoSrc = representativePhoto && storagePath
    ? resolvePhotoSrc(storagePath, representativePhoto.photo_path)
    : null;
  const hasPhoto = photoSrc != null;

  const mostRecentFind = [...currentSpecies.finds].sort((a, b) => {
    if (!a.date_found && !b.date_found) return 0;
    if (!a.date_found) return 1;
    if (!b.date_found) return -1;
    return b.date_found.localeCompare(a.date_found);
  })[0] ?? null;

  const firstFind = currentSpecies.finds[0] ?? null;
  const existingLocalPolygon = firstFind
    ? zones.find((z) => z.zone_type === 'local' && z.geometry_type === 'polygon' && z.source_find_id === firstFind.id) ?? null
    : null;
  const existingRegionPolygon = firstFind
    ? zones.find((z) => z.zone_type === 'region' && z.geometry_type === 'polygon' && z.species_name === currentSpecies.name) ?? null
    : null;

  const displayNote = speciesNote?.trim() || mostRecentFind?.notes?.trim() || null;
  const multiSpecies = locationGroup.species.length > 1;

  const stopPopupButtonEvent = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    L.DomEvent.stopPropagation(event.nativeEvent);
  };

  useEffect(() => {
    const previousButton = previousButtonRef.current;
    const nextButton = nextButtonRef.current;
    if (!previousButton || !nextButton || !multiSpecies) return;
    const stopNativeEvent = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      L.DomEvent.stopPropagation(event);
    };
    const goPrevious = (event: Event) => {
      stopNativeEvent(event);
      setSelectedSpeciesName((currentName) => {
        const species = speciesRef.current;
        const idx = currentName != null ? species.findIndex((s) => s.name === currentName) : 0;
        const safe = idx < 0 ? 0 : idx;
        return species[(safe - 1 + species.length) % species.length]?.name ?? null;
      });
    };
    const goNext = (event: Event) => {
      stopNativeEvent(event);
      setSelectedSpeciesName((currentName) => {
        const species = speciesRef.current;
        const idx = currentName != null ? species.findIndex((s) => s.name === currentName) : 0;
        const safe = idx < 0 ? 0 : idx;
        return species[(safe + 1) % species.length]?.name ?? null;
      });
    };
    previousButton.addEventListener('pointerdown', goPrevious);
    previousButton.addEventListener('click', stopNativeEvent);
    nextButton.addEventListener('pointerdown', goNext);
    nextButton.addEventListener('click', stopNativeEvent);
    return () => {
      previousButton.removeEventListener('pointerdown', goPrevious);
      previousButton.removeEventListener('click', stopNativeEvent);
      nextButton.removeEventListener('pointerdown', goNext);
      nextButton.removeEventListener('click', stopNativeEvent);
    };
  }, [multiSpecies]);

  return (
    <div ref={popupRef} className="relative w-[248px] overflow-visible font-sans">
      {multiSpecies && (
        <>
          <button
            ref={previousButtonRef}
            type="button"
            aria-label="Previous species"
            onMouseDown={stopPopupButtonEvent}
            onClick={stopPopupButtonEvent}
            className="absolute -left-8 top-[74px] z-[20] flex h-11 w-7 -translate-y-1/2 items-center justify-center rounded-l-md border border-border/50 bg-background/95 text-foreground shadow-sm transition-colors hover:bg-secondary hover:text-primary"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            ref={nextButtonRef}
            type="button"
            aria-label="Next species"
            onMouseDown={stopPopupButtonEvent}
            onClick={stopPopupButtonEvent}
            className="absolute -right-8 top-[74px] z-[20] flex h-11 w-7 -translate-y-1/2 items-center justify-center rounded-r-md border border-border/50 bg-background/95 text-foreground shadow-sm transition-colors hover:bg-secondary hover:text-primary"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}

      <div className="overflow-hidden rounded-lg bg-background shadow-xl ring-1 ring-border/30">
        <div className="relative h-[148px] w-full select-none">
          {hasPhoto ? (
            <img
              src={photoSrc}
              alt=""
              className="relative z-[1] h-full w-full bg-black object-contain"
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full items-end bg-gradient-to-br from-[oklch(0.16_0.02_135)] to-[oklch(0.10_0.01_135)] p-3" />
          )}
          <div className="absolute inset-0 z-[2] bg-gradient-to-t from-black/95 via-black/50 to-black/5" />

          {multiSpecies && (
            <div className="absolute right-2 top-2 z-[3]">
              <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium tracking-wide text-white/90 backdrop-blur-sm">
                {safeIdx + 1} / {locationGroup.species.length}
              </span>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 z-[3] px-2.5 pb-1 pt-1">
            <p className="font-serif text-[13px] font-bold italic leading-snug text-white [text-shadow:0_1px_6px_rgba(0,0,0,1),0_0_20px_rgba(0,0,0,0.8)]">
              {renderSpeciesName(currentSpecies.name)}
            </p>
            {commonName && (
              <p className="mt-0.5 text-[11px] italic leading-tight text-white/80 [text-shadow:0_1px_4px_rgba(0,0,0,1)]">
                {commonName}
              </p>
            )}
            {mostRecentFind?.date_found && (
              <p className="mt-0.5 text-[10px] leading-tight text-white/65 [text-shadow:0_1px_4px_rgba(0,0,0,1)]">
                {mostRecentFind.date_found}
              </p>
            )}
          </div>
        </div>

        {/* Fixed-height content zone so the card never resizes between species */}
        <div className="flex h-[168px] flex-col">
          {/* Variable zone: count, badges, notes — overflow hidden, no scrollbar */}
          <div className="flex flex-1 flex-col gap-1 overflow-hidden px-2.5 py-1.5">
            <p className="text-[11px] font-medium text-muted-foreground/80">
              {tFindsCount(currentSpecies.finds.length, lang)}
            </p>
            <SpeciesMetadataBadges speciesProfile={speciesProfile} hideUnknown={true} iconOnly={true} />
            {displayNote && (
              <p className="line-clamp-3 text-[11px] leading-relaxed text-foreground/65">
                {displayNote}
              </p>
            )}
          </div>

          {/* Pinned action rows — always at the bottom */}
          <div className="px-2.5">
            <div className="flex items-center justify-between border-t border-border/25 py-1.5">
              <button
                type="button"
                onClick={() => map.flyTo([locationGroup.lat, locationGroup.lng], Math.max(map.getZoom(), 16))}
                className="flex items-center gap-1 text-[11px] text-primary/65 transition-colors hover:text-primary"
              >
                <ZoomIn className="h-3 w-3" />
                Zoom
              </button>
              {firstFind?.lat != null && firstFind.lng != null && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); L.DomEvent.stopPropagation(e.nativeEvent); map.closePopup(); onStartLocalPolygonForFind(firstFind); }}
                    className="rounded border border-[#D4512A]/45 bg-[#D4512A]/10 px-2 py-0.5 text-[10px] font-semibold text-foreground transition-colors hover:bg-[#D4512A]/22"
                  >
                    {existingLocalPolygon ? 'Edit local' : 'Draw local'}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); L.DomEvent.stopPropagation(e.nativeEvent); map.closePopup(); onStartRegionPolygonForFind(firstFind); }}
                    className="rounded border border-primary/45 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-foreground transition-colors hover:bg-primary/22"
                  >
                    {existingRegionPolygon ? 'Edit region' : 'Draw region'}
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 border-t border-border/20 py-1.5 pb-2">
              <button
                type="button"
                onClick={() => { setPendingSpeciesSelection(currentSpecies.name); setActiveTab('species'); }}
                className="flex items-center gap-1 text-[11px] text-muted-foreground/70 transition-colors hover:text-primary"
              >
                <BookOpen className="h-3 w-3" />
                Vrsta
              </button>
              <button
                type="button"
                onClick={() => { setSelectedCollectionSpecies(currentSpecies.name); setActiveTab('collection'); }}
                className="flex items-center gap-1 text-[11px] text-muted-foreground/70 transition-colors hover:text-primary"
              >
                <LayoutList className="h-3 w-3" />
                Zbirka
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const OVERLAP_PX = 40;

function computeCrowded(map: L.Map, groups: LocationGroup[]): Set<string> {
  const crowded = new Set<string>();
  const points = groups.map((g) => ({
    key: g.key,
    pt: map.latLngToLayerPoint([g.lat, g.lng]),
  }));
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[i].pt.x - points[j].pt.x;
      const dy = points[i].pt.y - points[j].pt.y;
      if (Math.sqrt(dx * dx + dy * dy) < OVERLAP_PX) {
        crowded.add(points[i].key);
        crowded.add(points[j].key);
      }
    }
  }
  return crowded;
}

function CollectionPinsInner({
  groups,
  onStartLocalPolygonForFind,
  onStartRegionPolygonForFind,
  onSelectSpecies,
  zones,
}: {
  groups: LocationGroup[];
  onStartLocalPolygonForFind: (find: Find) => void;
  onStartRegionPolygonForFind: (find: Find) => void;
  onSelectSpecies: (speciesName: string) => void;
  zones: Zone[];
}) {
  const map = useMap();
  const [crowded, setCrowded] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(() => map.getZoom());
  const { data: speciesNotesData } = useSpeciesNotes();
  const { data: speciesProfilesRaw } = useSpeciesProfiles();
  const storagePath = useAppStore((s) => s.storagePath) ?? '';
  const isSatellite = useAppStore((s) => s.mapLayer === 'Satellite');

  const speciesNotesByName = useMemo(() => {
    const notes = new Map<string, string>();
    for (const entry of speciesNotesData ?? []) notes.set(entry.species_name, entry.notes);
    return notes;
  }, [speciesNotesData]);

  const speciesProfilesByName = useMemo(() => {
    const m = new Map<string, SpeciesProfile>();
    speciesProfilesRaw?.forEach((p) => m.set(p.species_name, p));
    return m;
  }, [speciesProfilesRaw]);

  const update = useCallback(() => { setCrowded(computeCrowded(map, groups)); }, [map, groups]);
  useEffect(() => { update(); }, [update]);
  useMapEvents({
    zoomend: () => { update(); setZoom(map.getZoom()); },
    moveend: update,
  });

  return (
    <>
      {groups.map((g) => {
        const showLabel = zoom >= LABEL_ZOOM_THRESHOLD && !crowded.has(g.key) && !g.suppressLabel;
        const groupZones = zones.filter((z) => g.species.some((s) => z.species_name === s.name));
        return (
          <CollectionMarker
            key={`loc-${g.key}`}
            group={g}
            showLabel={showLabel}
            isSatellite={isSatellite}
            groupZones={groupZones}
            storagePath={storagePath}
            onStartLocalPolygonForFind={onStartLocalPolygonForFind}
            onStartRegionPolygonForFind={onStartRegionPolygonForFind}
            onSelectSpecies={onSelectSpecies}
            speciesNotesByName={speciesNotesByName}
            speciesProfilesByName={speciesProfilesByName}
          />
        );
      })}
    </>
  );
}

function CollectionMarker({
  group: g,
  showLabel,
  isSatellite,
  groupZones,
  storagePath,
  onStartLocalPolygonForFind,
  onStartRegionPolygonForFind,
  onSelectSpecies,
  speciesNotesByName,
  speciesProfilesByName,
}: {
  group: LocationGroup;
  showLabel: boolean;
  isSatellite: boolean;
  groupZones: Zone[];
  storagePath: string;
  onStartLocalPolygonForFind: (find: Find) => void;
  onStartRegionPolygonForFind: (find: Find) => void;
  onSelectSpecies: (name: string) => void;
  speciesNotesByName: Map<string, string>;
  speciesProfilesByName: Map<string, SpeciesProfile>;
}) {
  const [popupOpen, setPopupOpen] = useState(false);

  return (
    <Marker
      position={[g.lat, g.lng]}
      icon={getCollectionIcon(g.labelText, showLabel, isSatellite)}
      eventHandlers={{
        click: () => onSelectSpecies(g.species[0]?.name ?? ''),
        popupopen: () => setPopupOpen(true),
        popupclose: () => setPopupOpen(false),
      }}
    >
      {g.species.length > 1 && !popupOpen && (
        <Tooltip direction="top" offset={[0, -10]} opacity={1} className="bili-species-tooltip">
          <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: '12px', lineHeight: '1.6' }}>
            {g.species.map((s) => (
              <div key={s.name}>{plainSpeciesName(s.name)}</div>
            ))}
          </div>
        </Tooltip>
      )}
      <Popup minWidth={248} autoPan={false}>
        <CollectionPopup
          locationGroup={g}
          storagePath={storagePath}
          onStartLocalPolygonForFind={onStartLocalPolygonForFind}
          onStartRegionPolygonForFind={onStartRegionPolygonForFind}
          zones={groupZones}
          speciesNotesByName={speciesNotesByName}
          speciesProfilesByName={speciesProfilesByName}
        />
      </Popup>
    </Marker>
  );
}

export function CollectionPins({
  finds,
  zones = [],
  onStartLocalPolygonForFind = () => undefined,
  onStartRegionPolygonForFind = () => undefined,
  onSelectSpecies = () => undefined,
}: {
  finds: Find[];
  zones?: Zone[];
  onStartLocalPolygonForFind?: (find: Find) => void;
  onStartRegionPolygonForFind?: (find: Find) => void;
  onSelectSpecies?: (speciesName: string) => void;
}) {
  const groups = useMemo(() => locationGroupsFromFinds(finds), [finds]);
  return (
    <CollectionPinsInner
      groups={groups}
      onStartLocalPolygonForFind={onStartLocalPolygonForFind}
      onStartRegionPolygonForFind={onStartRegionPolygonForFind}
      onSelectSpecies={onSelectSpecies}
      zones={zones}
    />
  );
}

function coordKey(lat: number, lng: number): string {
  return `${lat},${lng}`;
}

/**
 * Converts raw species name format to HTML for pin labels.
 * "Boletus *edulis*" → "Boletus <span style='font-weight:400'>edulis</span>"
 * HTML-escapes the name before processing so user input can't inject tags.
 */
function rawToLabelHtml(raw: string): string {
  const escaped = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.replace(/\*(.*?)\*/g, (_m, word) => `<span style="font-weight:400">${word}</span>`);
}

/**
 * Groups finds into one LocationGroup per exact coordinate pair.
 * Finds with identical lat/lng share a pin; genuinely different coordinates
 * produce separate pins. When the picker adopts an existing pin's coordinates
 * the new find is guaranteed to join that group.
 */
export function locationGroupsFromFinds(finds: Find[]): LocationGroup[] {
  const byLocation = new Map<string, { lat: number; lng: number; bySpecies: Map<string, Find[]> }>();

  for (const f of finds) {
    if (f.lat == null || f.lng == null) continue;
    const locKey = coordKey(f.lat, f.lng);
    if (!byLocation.has(locKey)) {
      byLocation.set(locKey, { lat: f.lat, lng: f.lng, bySpecies: new Map() });
    }
    const loc = byLocation.get(locKey)!;
    if (!loc.bySpecies.has(f.species_name)) loc.bySpecies.set(f.species_name, []);
    loc.bySpecies.get(f.species_name)!.push(f);
  }

  const result: LocationGroup[] = [];
  for (const [locKey, { lat, lng, bySpecies }] of byLocation) {
    const species: SpeciesEntry[] = Array.from(bySpecies.entries()).map(([name, finds]) => ({ name, finds }));
    const labelText = species.length === 1
      ? rawToLabelHtml(plainSpeciesName(species[0].name).trim())
      : `${species.length} species`;
    result.push({ key: locKey, lat, lng, species, labelText, suppressLabel: false });
  }

  return result;
}
