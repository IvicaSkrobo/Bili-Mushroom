import { describe, expect, it } from 'vitest';
import { formatStorageBytes } from './libraryStorage';

describe('formatStorageBytes', () => {
  it('keeps small databases visible instead of rounding them to zero', () => {
    expect(formatStorageBytes(512 * 1024)).toBe('< 1 MB');
    expect(formatStorageBytes(6 * 1024 * 1024)).toBe('6.0 MB');
  });

  it('switches to gigabytes for genuinely large storage totals', () => {
    expect(formatStorageBytes(1536 * 1024 * 1024)).toBe('1.5 GB');
  });
});
