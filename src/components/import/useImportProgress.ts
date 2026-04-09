import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { ImportProgress } from '@/lib/finds';

/**
 * Subscribes to the Tauri `import-progress` event while `enabled` is true.
 * Returns the latest ImportProgress payload, or null when not importing.
 * Cleans up the listener on unmount or when `enabled` becomes false.
 */
export function useImportProgress(enabled: boolean): ImportProgress | null {
  const [progress, setProgress] = useState<ImportProgress | null>(null);

  useEffect(() => {
    if (!enabled) {
      setProgress(null);
      return;
    }

    const unlistenPromise = listen<ImportProgress>('import-progress', (event) => {
      setProgress(event.payload);
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [enabled]);

  return progress;
}
