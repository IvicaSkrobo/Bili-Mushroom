import { create } from 'zustand';

export type Tab = 'collection' | 'map' | 'species' | 'browse' | 'stats';

export interface AppState {
  activeTab: Tab;
  storagePath: string | null;
  dbReady: boolean;
  dbError: string | null;
  setActiveTab: (tab: Tab) => void;
  setStoragePath: (path: string) => void;
  setDbReady: (ready: boolean) => void;
  setDbError: (error: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'collection',
  storagePath: null,
  dbReady: false,
  dbError: null,
  setActiveTab: (activeTab) => set({ activeTab }),
  setStoragePath: (storagePath) => set({ storagePath }),
  setDbReady: (dbReady) => set({ dbReady }),
  setDbError: (dbError) => set({ dbError }),
}));
