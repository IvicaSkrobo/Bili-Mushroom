import { describe, it, expect, vi } from 'vitest';
import { runWithLimit } from './concurrency';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('runWithLimit', () => {
  it('processes every item', async () => {
    const seen: number[] = [];
    await runWithLimit([1, 2, 3, 4, 5], 2, async (item) => {
      seen.push(item);
    });
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('never exceeds the limit, which is the whole point', async () => {
    let running = 0;
    let peak = 0;
    const gates = Array.from({ length: 6 }, () => deferred());

    const done = runWithLimit(gates, 2, async (gate) => {
      running += 1;
      peak = Math.max(peak, running);
      await gate.promise;
      running -= 1;
    });

    // Let the first batch start, then release the gates one at a time.
    await Promise.resolve();
    expect(peak).toBe(2);
    for (const gate of gates) {
      gate.resolve();
      await Promise.resolve();
      await Promise.resolve();
    }
    await done;
    expect(peak).toBe(2);
  });

  it('stops starting work once a task fails, and reports that failure', async () => {
    const started: number[] = [];
    const task = vi.fn(async (item: number) => {
      started.push(item);
      if (item === 2) throw new Error('delete failed');
    });

    await expect(runWithLimit([1, 2, 3, 4, 5, 6, 7, 8], 1, task)).rejects.toThrow('delete failed');
    // With one worker, nothing after the failure should have been attempted.
    expect(started).toEqual([1, 2]);
  });

  it('handles an empty list and a limit larger than the list', async () => {
    const task = vi.fn(async () => {});
    await runWithLimit([], 4, task);
    expect(task).not.toHaveBeenCalled();

    await runWithLimit([1, 2], 99, task);
    expect(task).toHaveBeenCalledTimes(2);
  });
});
