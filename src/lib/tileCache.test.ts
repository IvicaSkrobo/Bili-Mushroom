import { describe, it, expect } from 'vitest';
import { formatMb } from './tileCache';

describe('formatMb', () => {
  it('returns "0 MB" for 0 bytes', () => {
    expect(formatMb(0)).toBe('0 MB');
  });

  it('returns "1 MB" for 1024*1024 bytes', () => {
    expect(formatMb(1024 * 1024)).toBe('1 MB');
  });

  it('returns "42 MB" for 44040192 bytes', () => {
    expect(formatMb(44040192)).toBe('42 MB');
  });

  it('returns "0 MB" for negative bytes', () => {
    expect(formatMb(-1)).toBe('0 MB');
  });

  it('returns "0 MB" for NaN', () => {
    expect(formatMb(NaN)).toBe('0 MB');
  });
});
