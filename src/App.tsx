import { useEffect } from 'react';
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

  if (dbError) {
    return (
      <MigrationErrorDialog
        errorMessage={dbError}
        onReset={() => {
          setDbError(null);
          setStoragePath(null);
          setDbReady(false);
          setPendingScan(false);
        }}
      />
    );
  }

  if (!storagePath) {
    return (
      <div className="h-screen w-screen bg-background">
        <FirstRunDialog
          onFolderSelected={(path) => {
            setPendingScan(true);
            setStoragePath(path);
          }}
        />
      </div>
    );
  }

  if (!dbReady) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      {pendingScan ? (
        <div className="h-screen w-screen bg-background">
          <AutoImportDialog storagePath={storagePath} onDone={() => setPendingScan(false)} />
        </div>
      ) : (
        <>
          <AppShell />
          <Toaster richColors />
        </>
      )}
    </QueryClientProvider>
  );
}
