import { create } from 'zustand';
import type { Lang } from '@/i18n/index';

export type Tab = 'collection' | 'map' | 'species' | 'browse' | 'stats';
export type Theme = 'light' | 'dark';

export interface AppState {
  activeTab: Tab;
  storagePath: string | null;
  dbReady: boolean;
  dbError: string | null;
  language: Lang;
  theme: Theme;
  setActiveTab: (tab: Tab) => void;
  setStoragePath: (path: string) => void;
  setDbReady: (ready: boolean) => void;
  setDbError: (error: string | null) => void;
  setLanguage: (lang: Lang) => void;
  setTheme: (theme: Theme) => void;
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

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'collection',
  storagePath: null,
  dbReady: false,
  dbError: null,
  language: loadLang(),
  theme: loadTheme(),
  setActiveTab: (activeTab) => set({ activeTab }),
  setStoragePath: (storagePath) => set({ storagePath }),
  setDbReady: (dbReady) => set({ dbReady }),
  setDbError: (dbError) => set({ dbError }),
  setLanguage: (language) => {
    try { localStorage.setItem('bili_lang', language); } catch { /* ignore */ }
    set({ language });
  },
  setTheme: (theme) => {
    try { localStorage.setItem('bili_theme', theme); } catch { /* ignore */ }
    set({ theme });
  },
}));
