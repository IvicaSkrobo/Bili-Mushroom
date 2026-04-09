import '@testing-library/jest-dom/vitest';
import { vi, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import './tauri-mocks';

beforeEach(() => {
  cleanup();
});
