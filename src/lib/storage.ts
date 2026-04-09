import { load } from '@tauri-apps/plugin-store';
import { open } from '@tauri-apps/plugin-dialog';

const STORE_FILE = 'preferences.json';
const STORAGE_PATH_KEY = 'storageFolderPath';

async function getStore() {
  return load(STORE_FILE, { autoSave: false });
}

export async function loadStoragePath(): Promise<string | null> {
  const store = await getStore();
  const value = await store.get<string>(STORAGE_PATH_KEY);
  return value ?? null;
}

export async function pickAndSaveStoragePath(): Promise<string | null> {
  const folder = await open({ directory: true, multiple: false });
  if (!folder || typeof folder !== 'string') return null;
  const store = await getStore();
  await store.set(STORAGE_PATH_KEY, folder);
  await store.save();
  return folder;
}

export async function clearStoragePath(): Promise<void> {
  const store = await getStore();
  await store.delete(STORAGE_PATH_KEY);
  await store.save();
}
