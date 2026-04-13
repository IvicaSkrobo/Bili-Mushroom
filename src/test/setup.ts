// Required for react-leaflet MapContainer to mount in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import '@testing-library/jest-dom/vitest';
import { vi, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import './tauri-mocks';

beforeEach(() => {
  cleanup();
});
