import { create } from 'zustand';
import type { Lang } from '@/i18n/index';

export type Tab = 'collection' | 'species' | 'map' | 'stats';
export type Theme = 'light' | 'dark';
export type MapLayer = 'Satellite' | 'Topo' | 'Street';

export interface AvailableUpdate {
  version: string;
  notes: string | null;
  pub_date: string | null;
}

export interface AppState {
  activeTab: Tab;
  storagePath: string | null;
  dbReady: boolean;
  dbError: string | null;
  language: Lang;
  theme: Theme;
  mapLayer: MapLayer;
  pendingScan: boolean;
  editingFindId: number | null;
  selectedCollectionSpecies: string | null;
  availableUpdate: AvailableUpdate | null;
  installingUpdate: boolean;
  setActiveTab: (tab: Tab) => void;
  setStoragePath: (path: string | null) => void;
  setDbReady: (ready: boolean) => void;
  setDbError: (error: string | null) => void;
  setLanguage: (lang: Lang) => void;
  setTheme: (theme: Theme) => void;
  setMapLayer: (layer: MapLayer) => void;
  setPendingScan: (v: boolean) => void;
  setEditingFindId: (id: number | null) => void;
  setSelectedCollectionSpecies: (species: string | null) => void;
  setAvailableUpdate: (update: AvailableUpdate | null) => void;
  setInstallingUpdate: (installing: boolean) => void;
}

function loadLang(): Lang {
  try {
    const v = localStorage.getItem('bili_lang');
    if (v === 'en' || v === 'hr') return v;
  } catch { /* ignore */ }
  return 'hr';
}

function loadTheme(): Theme {
  try {
    const v = localStorage.getItem('bili_theme');
    if (v === 'light' || v === 'dark') return v;
  } catch { /* ignore */ }
  return 'dark';
}

function loadMapLayer(): MapLayer {
  try {
    const v = localStorage.getItem('bili_map_layer');
    if (v === 'Satellite' || v === 'Topo' || v === 'Street') return v;
  } catch { /* ignore */ }
  return 'Satellite';
}

// ---------------------------------------------------------------------------
// Map viewport persistence — not in Zustand, no subscribers needed
// ---------------------------------------------------------------------------

export interface PersistedMapViewport {
  lat: number;
  lng: number;
  zoom: number;
}

/** Max zoom to restore on relaunch — keeps the area in context, not overly tight. */
const MAX_RESTORE_ZOOM = 14;

export function loadMapViewport(): PersistedMapViewport | null {
  try {
    const raw = localStorage.getItem('bili_map_viewport');
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v.lat !== 'number' || typeof v.lng !== 'number' || typeof v.zoom !== 'number') return null;
    return { lat: v.lat, lng: v.lng, zoom: Math.min(v.zoom, MAX_RESTORE_ZOOM) };
  } catch { return null; }
}

export function saveMapViewport(lat: number, lng: number, zoom: number): void {
  try {
    localStorage.setItem('bili_map_viewport', JSON.stringify({ lat, lng, zoom }));
  } catch { /* ignore */ }
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'collection',
  storagePath: null,
  dbReady: false,
  dbError: null,
  language: loadLang(),
  theme: loadTheme(),
  mapLayer: loadMapLayer(),
  pendingScan: false,
  editingFindId: null,
  selectedCollectionSpecies: null,
  availableUpdate: null,
  installingUpdate: false,
  setActiveTab: (activeTab) => set({ activeTab }),
  setStoragePath: (storagePath) => set({ storagePath }),
  setDbReady: (dbReady) => set({ dbReady }),
  setDbError: (dbError) => set({ dbError }),
  setPendingScan: (pendingScan) => set({ pendingScan }),
  setEditingFindId: (editingFindId) => set({ editingFindId }),
  setSelectedCollectionSpecies: (selectedCollectionSpecies) => set({ selectedCollectionSpecies }),
  setAvailableUpdate: (availableUpdate) => set({ availableUpdate }),
  setInstallingUpdate: (installingUpdate) => set({ installingUpdate }),
  setLanguage: (language) => {
    try { localStorage.setItem('bili_lang', language); } catch { /* ignore */ }
    set({ language });
  },
  setTheme: (theme) => {
    try { localStorage.setItem('bili_theme', theme); } catch { /* ignore */ }
    set({ theme });
  },
  setMapLayer: (mapLayer) => {
    try { localStorage.setItem('bili_map_layer', mapLayer); } catch { /* ignore */ }
    set({ mapLayer });
  },
}));
