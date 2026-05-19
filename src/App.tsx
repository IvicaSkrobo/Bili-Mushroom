import { useEffect, useRef, useState, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { Toaster } from 'sonner';
import { toast } from 'sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookOpen, Loader2, Sprout } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { loadStoragePath } from '@/lib/storage';
import { initializeDatabase, DatabaseInitError } from '@/lib/db';
import { FirstRunDialog } from '@/components/dialogs/FirstRunDialog';
import { MigrationErrorDialog } from '@/components/dialogs/MigrationErrorDialog';
import { AutoImportDialog } from '@/components/dialogs/AutoImportDialog';
import { AppShell } from '@/components/layout/AppShell';
import { APP_VERSION } from '@/lib/appMeta';
import { checkDevUpdateMock, installDevUpdateMock } from '@/lib/devUpdater';
import { useT } from '@/i18n/index';
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

function StartupScreen({ stage, children }: { stage: string; children?: ReactNode }) {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 opacity-70">
        <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-primary/35 to-transparent" />
        <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-secondary/30 to-transparent" />
        <div className="absolute inset-x-0 top-[38%] h-px bg-border/45" />
      </div>

      <div className="relative flex h-full items-center justify-center px-6">
        <div className="w-full max-w-[24rem] animate-fade-up text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-md border border-primary/35 bg-card/90 shadow-sm">
            <BookOpen className="h-8 w-8 text-primary" strokeWidth={1.6} />
          </div>

          <div className="space-y-2">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.28em] text-muted-foreground">
              Personal mycology journal
            </p>
            <h1 className="font-serif text-4xl font-semibold italic leading-none text-foreground">
              Gljivobook
            </h1>
          </div>

          <div className="mt-8 rounded-md border border-border/80 bg-card/75 px-4 py-3 shadow-sm backdrop-blur">
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>{stage}</span>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/2 animate-startup-progress rounded-full bg-primary/80" />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Sprout className="h-3.5 w-3.5 text-secondary" strokeWidth={1.8} />
            <span>Lokalna zbirka, lokalne fotografije</span>
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}

export default function App() {
  const t = useT();
  const storagePath = useAppStore((s) => s.storagePath);
  const dbReady = useAppStore((s) => s.dbReady);
  const dbError = useAppStore((s) => s.dbError);
  const setStoragePath = useAppStore((s) => s.setStoragePath);
  const setDbReady = useAppStore((s) => s.setDbReady);
  const setDbError = useAppStore((s) => s.setDbError);
  const theme = useAppStore((s) => s.theme);
  const language = useAppStore((s) => s.language);
  const pendingScan = useAppStore((s) => s.pendingScan);
  const setPendingScan = useAppStore((s) => s.setPendingScan);
  const setAvailableUpdate = useAppStore((s) => s.setAvailableUpdate);
  const setInstallingUpdate = useAppStore((s) => s.setInstallingUpdate);
  const setInstallStatus = useAppStore((s) => s.setInstallStatus);
  const availableUpdate = useAppStore((s) => s.availableUpdate);
  const updateConfirmPending = useAppStore((s) => s.updateConfirmPending);
  const setUpdateConfirmPending = useAppStore((s) => s.setUpdateConfirmPending);
  const [confirmUpdate, setConfirmUpdate] = useState<{ version: string } | null>(null);
  const [storagePathLoaded, setStoragePathLoaded] = useState(false);
  const [startupHoldDone, setStartupHoldDone] = useState(false);
  const isHr = language === 'hr';

  useEffect(() => {
    const timer = window.setTimeout(() => setStartupHoldDone(true), 750);
    return () => window.clearTimeout(timer);
  }, []);

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
      const fakeInstalled = await installDevUpdateMock(setInstallStatus);
      if (fakeInstalled !== undefined) {
        if (fakeInstalled) {
          setInstallStatus('Fake update installed — restart skipped in dev mode');
          setAvailableUpdate(null);
          toast.success('Fake update installed. Restart is skipped in dev mode.');
        } else {
          setInstallStatus(null);
          toast('No newer update found.');
          setAvailableUpdate(null);
        }
        return;
      }

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

    const checkUpdate = async () => {
      const devUpdate = await checkDevUpdateMock();
      return devUpdate !== undefined
        ? devUpdate
        : invoke<import('@/stores/appStore').AvailableUpdate | null>('check_app_update');
    };

    checkUpdate()
      .then((update) => {
        if (cancelled || !update) return;
        setAvailableUpdate(update);

        const current = import.meta.env.DEV ? APP_VERSION : currentVersionRef.current;
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
  }, [setAvailableUpdate]);

  // Load persisted path on mount
  useEffect(() => {
    let cancelled = false;
    if (!('__TAURI_INTERNALS__' in window)) {
      setDbError('Gljivobook must be run inside the Tauri desktop app. The localhost browser view cannot access the local database bridge.');
      setStoragePathLoaded(true);
      return () => { cancelled = true; };
    }

    loadStoragePath().then((path) => {
      if (cancelled) return;
      if (path) setStoragePath(path);
      setStoragePathLoaded(true);
    }).catch((err) => {
      if (!cancelled) {
        setDbError(String(err?.message ?? err));
        setStoragePathLoaded(true);
      }
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

  if (!storagePathLoaded) {
    return (
      <StartupScreen stage={isHr ? 'Otvaram lokalnu zbirku...' : 'Opening local library...'} />
    );
  }

  if (!startupHoldDone) {
    return (
      <StartupScreen stage={isHr ? 'Pripremam aplikaciju...' : 'Preparing app...'} />
    );
  }

  if (!storagePath) {
    return (
      <StartupScreen stage={isHr ? 'Odaberi mapu za svoju zbirku' : 'Choose your collection folder'}>
        <FirstRunDialog
          onFolderSelected={(path) => {
            setPendingScan(true);
            setStoragePath(path);
          }}
        />
      </StartupScreen>
    );
  }

  if (!dbReady) {
    return (
      <StartupScreen stage={isHr ? 'Provjeravam bazu i migracije...' : 'Checking database and migrations...'} />
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      {pendingScan ? (
        <StartupScreen stage={isHr ? 'Tražim nove fotografije...' : 'Scanning for new photos...'}>
          <AutoImportDialog storagePath={storagePath} onDone={() => setPendingScan(false)} />
        </StartupScreen>
      ) : (
        <>
          <AppShell />
          <Toaster richColors position="top-right" />
        </>
      )}
      <AlertDialog open={!!confirmUpdate} onOpenChange={(o) => { if (!o) setConfirmUpdate(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('app.updateConfirmTitle', { version: confirmUpdate?.version ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('app.updateConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('app.updateConfirmCancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmUpdate(null); runInstallUpdate(); }}>
              {t('app.updateConfirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </QueryClientProvider>
  );
}
