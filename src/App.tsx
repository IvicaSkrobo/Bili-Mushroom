import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const setInstallStatus = useAppStore((s) => s.setInstallStatus);
  const availableUpdate = useAppStore((s) => s.availableUpdate);
  const updateConfirmPending = useAppStore((s) => s.updateConfirmPending);
  const setUpdateConfirmPending = useAppStore((s) => s.setUpdateConfirmPending);
  const [confirmUpdate, setConfirmUpdate] = useState<{ version: string } | null>(null);

  useEffect(() => {
    if (updateConfirmPending && availableUpdate) {
      setConfirmUpdate({ version: availableUpdate.version });
      setUpdateConfirmPending(false);
    }
  }, [updateConfirmPending, availableUpdate, setUpdateConfirmPending]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const currentVersionRef = useRef<string>('');

  async function runInstallUpdate() {
    setInstallingUpdate(true);
    setInstallStatus('Checking for update…');
    try {
      const { listen } = await import('@tauri-apps/api/event');
      const unlisten = await listen<{ downloaded: number; total: number | null; status: string }>(
        'update-progress',
        ({ payload }) => {
          if (payload.status === 'installing') {
            setInstallStatus('Installing… do not close the app');
          } else if (payload.total) {
            const pct = Math.round((payload.downloaded / payload.total) * 100);
            setInstallStatus(`Downloading update… ${pct}%`);
          } else {
            setInstallStatus('Downloading update…');
          }
        },
      );
      const installed = await invoke<boolean>('install_app_update');
      unlisten();
      if (installed) {
        setInstallStatus('Update installed — restarting…');
        setAvailableUpdate(null);
        toast.success('Update installed. The app will restart.');
      } else {
        setInstallStatus(null);
        toast('No newer update found.');
        setAvailableUpdate(null);
      }
    } catch (error) {
      const msg = String((error as Error)?.message ?? error);
      console.error('[updater] install failed:', msg);
      setInstallStatus(`Update failed: ${msg}`);
      // no auto-dismiss — user must click ✕ on the banner
    } finally {
      setInstallingUpdate(false);
    }
  }

  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return;

    let cancelled = false;

    getVersion().then((v) => { currentVersionRef.current = v; });

    invoke<import('@/stores/appStore').AvailableUpdate | null>('check_app_update')
      .then((update) => {
        if (cancelled || !update) return;
        setAvailableUpdate(update);

        const current = currentVersionRef.current;
        const fromLabel = current ? `v${current} → ` : '';

        toast('Update available', {
          description: `${fromLabel}v${update.version} is ready to install.`,
          duration: 20000,
          action: {
            label: 'Update',
            onClick: () => setConfirmUpdate({ version: update.version }),
          },
          cancel: {
            label: 'Not now',
            onClick: () => {},
          },
        });
      })
      .catch((err) => {
        const msg = String((err as Error)?.message ?? err);
        console.error('[updater] startup check failed:', msg);
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
          <Toaster richColors position="top-right" />
        </>
      )}
      <AlertDialog open={!!confirmUpdate} onOpenChange={(o) => { if (!o) setConfirmUpdate(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update to v{confirmUpdate?.version}?</AlertDialogTitle>
            <AlertDialogDescription>
              The app will download and install the update, then restart automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmUpdate(null); runInstallUpdate(); }}>
              Update now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </QueryClientProvider>
  );
}
