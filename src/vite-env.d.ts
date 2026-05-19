/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_BUG_REPORT_ENDPOINT?: string;
}
