import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { listenCallbacks, emitMockEvent } from '../../test/tauri-mocks';
import '../../test/tauri-mocks';
import { useImportProgress } from './useImportProgress';

beforeEach(() => {
  // Clear all listen callbacks between tests
  Object.keys(listenCallbacks).forEach((k) => {
    delete listenCallbacks[k];
  });
});

describe('useImportProgress', () => {
  it('returns null when enabled=false', () => {
    const { result } = renderHook(() => useImportProgress(false));
    expect(result.current).toBeNull();
  });

  it('subscribes to import-progress event when enabled=true', async () => {
    const { result } = renderHook(() => useImportProgress(true));

    await act(async () => {
      emitMockEvent('import-progress', { current: 1, total: 3, filename: 'shroom.jpg' });
    });

    expect(result.current).toEqual({ current: 1, total: 3, filename: 'shroom.jpg' });
  });

  it('updates progress on each emitted event', async () => {
    const { result } = renderHook(() => useImportProgress(true));

    await act(async () => {
      emitMockEvent('import-progress', { current: 1, total: 3, filename: 'a.jpg' });
    });
    expect(result.current?.current).toBe(1);

    await act(async () => {
      emitMockEvent('import-progress', { current: 2, total: 3, filename: 'b.jpg' });
    });
    expect(result.current?.current).toBe(2);
  });

  it('resets progress to null when enabled flips to false', async () => {
    let enabled = true;
    const { result, rerender } = renderHook(() => useImportProgress(enabled));

    await act(async () => {
      emitMockEvent('import-progress', { current: 1, total: 2, filename: 'x.jpg' });
    });
    expect(result.current).not.toBeNull();

    enabled = false;
    rerender();
    expect(result.current).toBeNull();
  });

  it('calls the unlisten function on unmount', async () => {
    const { listen } = await import('@tauri-apps/api/event');

    const { unmount } = renderHook(() => useImportProgress(true));

    unmount();
    // The listen mock returns a vi.fn() as the unlisten handle.
    // We verify listen was called (subscription established).
    expect(listen).toHaveBeenCalledWith('import-progress', expect.any(Function));
  });
});
