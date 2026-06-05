import { load } from '@tauri-apps/plugin-store';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

const STORE_FILE = 'preferences.json';
const STORAGE_PATH_KEY = 'storageFolderPath';
const STORAGE_PATH_CACHE_KEY = 'bili.storageFolderPath';

async function getStore() {
  return load(STORE_FILE, { autoSave: false });
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
}

export async function loadStoragePath(): Promise<string | null> {
  const startedAt = performance.now();
  const cached = window.localStorage.getItem(STORAGE_PATH_CACHE_KEY);
  if (cached) {
    console.info(`[startup] storage path from localStorage in ${Math.round(performance.now() - startedAt)}ms`);
    return cached;
  }

  try {
    const rustStartedAt = performance.now();
    const saved = await withTimeout(
      invoke<string | null>('load_saved_storage_path'),
      1_000,
      'direct Rust preferences read',
    );
    if (saved) {
      window.localStorage.setItem(STORAGE_PATH_CACHE_KEY, saved);
      console.info(`[startup] storage path from Rust preferences in ${Math.round(performance.now() - rustStartedAt)}ms`);
      return saved;
    }
  } catch (err) {
    console.warn('[startup] direct Rust preferences read failed, falling back to plugin store', err);
    // Fall through to the plugin store. This keeps tests/browser shims and
    // older app states working if the direct Rust read is unavailable.
  }

  const storeStartedAt = performance.now();
  try {
    const store = await withTimeout(getStore(), 2_000, 'plugin store load');
    const value = await withTimeout(store.get<string>(STORAGE_PATH_KEY), 2_000, 'plugin store get');
    if (value) window.localStorage.setItem(STORAGE_PATH_CACHE_KEY, value);
    console.info(`[startup] storage path from plugin store in ${Math.round(performance.now() - storeStartedAt)}ms`);
    return value ?? null;
  } catch (err) {
    console.warn('[startup] plugin store storage path read failed', err);
    return null;
  }
}

export async function pickAndSaveStoragePath(): Promise<string | null> {
  const folder = await open({ directory: true, multiple: false });
  if (!folder || typeof folder !== 'string') return null;
  const store = await getStore();
  await store.set(STORAGE_PATH_KEY, folder);
  await store.save();
  window.localStorage.setItem(STORAGE_PATH_CACHE_KEY, folder);
  return folder;
}

export async function clearStoragePath(): Promise<void> {
  const store = await getStore();
  await store.delete(STORAGE_PATH_KEY);
  await store.save();
  window.localStorage.removeItem(STORAGE_PATH_CACHE_KEY);
}
