import { create } from 'zustand';
import type { Lang } from '@/i18n/index';

export type Tab = 'collection' | 'species' | 'map' | 'stats';
export type Theme = 'light' | 'dark';
export type MapLayer = 'Satellite' | 'Topo' | 'Street';

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
  return 'light';
}

function loadMapLayer(): MapLayer {
  try {
    const v = localStorage.getItem('bili_map_layer');
    if (v === 'Satellite' || v === 'Topo' || v === 'Street') return v;
  } catch { /* ignore */ }
  return 'Satellite';
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
  setActiveTab: (activeTab) => set({ activeTab }),
  setStoragePath: (storagePath) => set({ storagePath }),
  setDbReady: (dbReady) => set({ dbReady }),
  setDbError: (dbError) => set({ dbError }),
  setPendingScan: (pendingScan) => set({ pendingScan }),
  setEditingFindId: (editingFindId) => set({ editingFindId }),
  setSelectedCollectionSpecies: (selectedCollectionSpecies) => set({ selectedCollectionSpecies }),
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
