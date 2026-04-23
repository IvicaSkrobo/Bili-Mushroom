import { describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
}));

import { resolvePhotoAbsolutePath, resolvePhotoSrc } from './photoSrc';

describe('photoSrc', () => {
  it('joins storage and relative photo paths with forward slashes', () => {
    expect(resolvePhotoAbsolutePath('C:\\Users\\Ivo\\Bili', 'Croatia\\Istria\\photo.jpg')).toBe(
      'C:/Users/Ivo/Bili/Croatia/Istria/photo.jpg',
    );
  });

  it('preserves already-absolute photo paths', () => {
    expect(resolvePhotoAbsolutePath('C:\\Users\\Ivo\\Bili', 'D:\\Library\\photo.jpg')).toBe(
      'D:/Library/photo.jpg',
    );
  });

  it('builds asset URLs from normalized absolute paths', () => {
    expect(resolvePhotoSrc('C:\\Users\\Ivo\\Bili\\', '\\Croatia\\Istria\\photo.jpg')).toBe(
      'asset://localhost/C:/Users/Ivo/Bili/Croatia/Istria/photo.jpg',
    );
  });
});
