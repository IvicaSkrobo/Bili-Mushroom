import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Toaster } from 'sonner';
import { toast } from 'sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAppStore } from '@/stores/appStore';
import { loadStoragePath } from '@/lib/storage';
import { initializeDatabase, DatabaseInitError } from '@/lib/db';
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
  const setAvailableUpdate = useAppStore((s) => s.setAvailableUpdate);
  const setInstallingUpdate = useAppStore((s) => s.setInstallingUpdate);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return;

    let cancelled = false;
    invoke<import('@/stores/appStore').AvailableUpdate | null>('check_app_update')
      .then((update) => {
        if (cancelled || !update) return;
        setAvailableUpdate(update);

        toast('Update available', {
          description: `Version ${update.version} is ready to install.${update.notes ? ` ${update.notes}` : ''}`,
          duration: 20000,
          action: {
            label: 'Update',
            onClick: async () => {
              setInstallingUpdate(true);
              const loadingToast = toast.loading('Installing update…');
              try {
                const installed = await invoke<boolean>('install_app_update');
                toast.dismiss(loadingToast);
                if (installed) {
                  setAvailableUpdate(null);
                  toast.success('Update started. The app will close if the installer needs to continue.');
                } else {
                  toast('No newer update found.');
                  setAvailableUpdate(null);
                }
              } catch (error) {
                toast.dismiss(loadingToast);
                toast.error(String(error));
              } finally {
                setInstallingUpdate(false);
              }
            },
          },
        });
      })
      .catch(() => {
        // Updater is optional for local/dev builds, so silent failure keeps startup clean.
        setAvailableUpdate(null);
      });

    return () => {
      cancelled = true;
    };
  }, [setAvailableUpdate, setInstallingUpdate]);

  // Load persisted path on mount
  useEffect(() => {
    let cancelled = false;
    if (!('__TAURI_INTERNALS__' in window)) {
      setDbError('Bili Mushroom must be run inside the Tauri desktop app. The localhost browser view cannot access the local database bridge.');
      return () => { cancelled = true; };
    }

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
        if (!cancelled) {
          // Preserve root cause — DatabaseInitError wraps the Rust error in .cause
          const cause = (err as DatabaseInitError)?.cause;
          const detail = cause != null ? `\n\nCause: ${String(cause)}` : '';
          setDbError(`${String(err?.message ?? err)}${detail}`);
        }
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
