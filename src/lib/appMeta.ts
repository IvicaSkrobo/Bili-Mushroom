import packageJson from '../../package.json';

export const REAL_APP_VERSION = packageJson.version;

export const APP_VERSION =
  import.meta.env.DEV && import.meta.env.VITE_FAKE_APP_VERSION?.trim()
    ? import.meta.env.VITE_FAKE_APP_VERSION.trim()
    : REAL_APP_VERSION;

