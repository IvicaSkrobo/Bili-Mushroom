import type { AvailableUpdate } from '@/stores/appStore';
import { REAL_APP_VERSION } from '@/lib/appMeta';

type DevUpdateMode = 'available' | 'none' | 'timeout' | 'error' | 'install-success' | 'install-error';

const DEV_UPDATE_MODES = new Set<DevUpdateMode>([
  'available',
  'none',
  'timeout',
  'error',
  'install-success',
  'install-error',
]);

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getDevUpdateMode(): DevUpdateMode | null {
  if (!import.meta.env.DEV) return null;
  const mode = import.meta.env.VITE_FAKE_UPDATE_MODE?.trim() as DevUpdateMode | undefined;
  return mode && DEV_UPDATE_MODES.has(mode) ? mode : null;
}

function fakeAvailableUpdate(): AvailableUpdate {
  return {
    version: import.meta.env.VITE_FAKE_UPDATE_VERSION?.trim() || REAL_APP_VERSION,
    notes: 'Local updater test. This update is simulated and does not download a release.',
    pub_date: new Date().toISOString(),
  };
}

export async function checkDevUpdateMock(): Promise<AvailableUpdate | null | undefined> {
  const mode = getDevUpdateMode();
  if (!mode) return undefined;

  await delay(450);

  if (mode === 'none') return null;
  if (mode === 'timeout') throw new Error('UPDATE_CHECK_TIMEOUT');
  if (mode === 'error') throw new Error('DEV_UPDATE_CHECK_FAILED');

  return fakeAvailableUpdate();
}

export async function installDevUpdateMock(
  setInstallStatus: (status: string | null) => void,
): Promise<boolean | undefined> {
  const mode = getDevUpdateMode();
  if (!mode) return undefined;

  setInstallStatus('Checking fake update...');
  await delay(350);

  if (mode === 'install-error') {
    setInstallStatus('Downloading fake update... 42%');
    await delay(350);
    throw new Error('DEV_UPDATE_INSTALL_FAILED');
  }

  setInstallStatus('Downloading fake update... 35%');
  await delay(300);
  setInstallStatus('Downloading fake update... 100%');
  await delay(300);
  setInstallStatus('Installing fake update...');
  await delay(300);

  return true;
}
