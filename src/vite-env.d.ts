/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_BUG_REPORT_ENDPOINT?: string;
  readonly VITE_FAKE_APP_VERSION?: string;
  readonly VITE_FAKE_UPDATE_MODE?: string;
  readonly VITE_FAKE_UPDATE_VERSION?: string;
}
