import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Toaster } from 'sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAppStore } from '@/stores/appStore';
import { loadStoragePath } from '@/lib/storage';
import { initializeDatabase } from '@/lib/db';
import { FirstRunDialog } from '@/components/dialogs/FirstRunDialog';
import { MigrationErrorDialog } from '@/components/dialogs/MigrationErrorDialog';
import { AutoImportDialog } from '@/components/dialogs/AutoImportDialog';
import { AppShell } from '@/components/layout/AppShell';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  const storagePath = useAppStore((s) => s.storagePath);
  const dbReady = useAppStore((s) => s.dbReady);
  const dbError = useAppStore((s) => s.dbError);
  const setStoragePath = useAppStore((s) => s.setStoragePath);
  const setDbReady = useAppStore((s) => s.setDbReady);
  const setDbError = useAppStore((s) => s.setDbError);
  const theme = useAppStore((s) => s.theme);
  const pendingScan = useAppStore((s) => s.pendingScan);
  const setPendingScan = useAppStore((s) => s.setPendingScan);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Load persisted path on mount
  useEffect(() => {
    let cancelled = false;
    loadStoragePath().then((path) => {
      if (cancelled) return;
      if (path) setStoragePath(path);
    }).catch((err) => {
      if (!cancelled) setDbError(String(err?.message ?? err));
    });
    return () => { cancelled = true; };
  }, [setStoragePath, setDbError]);

  // Initialize DB whenever storagePath becomes available
  useEffect(() => {
    if (!storagePath) return;
    let cancelled = false;
    initializeDatabase(storagePath)
      .then(() => { if (!cancelled) setDbReady(true); })
      .catch((err) => {
        if (!cancelled) setDbError(String(err?.message ?? err));
      });
    return () => { cancelled = true; };
  }, [storagePath, setDbReady, setDbError]);

  function handleQuit() {
    getCurrentWindow().close();
  }

  if (dbError) {
    return <MigrationErrorDialog errorMessage={dbError} onQuit={handleQuit} />;
  }

  if (!storagePath) {
    return (
      <FirstRunDialog
        onFolderSelected={(path) => {
          setPendingScan(true);
          setStoragePath(path);
        }}
      />
    );
  }

  if (!dbReady) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      {pendingScan ? (
        <AutoImportDialog storagePath={storagePath} onDone={() => setPendingScan(false)} />
      ) : (
        <>
          <AppShell />
          <Toaster richColors />
        </>
      )}
    </QueryClientProvider>
  );
}
