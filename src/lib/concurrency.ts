/**
 * Runs a task over a list with a bounded number in flight.
 *
 * `Promise.all(items.map(task))` starts everything at once. For a Tauri command that is
 * not free: each call lands on the Rust blocking pool with its own SQLite connection, so
 * selecting five hundred finds and deleting them started five hundred threads that then
 * queued up behind SQLite's single writer anyway. Bounding it keeps the pipeline full
 * without the pile-up.
 *
 * The first rejection is propagated and no further work is started, so a failure part way
 * through a destructive batch stops rather than racing ahead. Tasks already in flight are
 * left to finish — they cannot be cancelled once the command is running.
 */
export async function runWithLimit<T>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<unknown>,
): Promise<void> {
  if (items.length === 0) return;
  const inFlight = Math.max(1, Math.min(limit, items.length));

  let next = 0;
  let failure: unknown;
  let failed = false;

  async function worker(): Promise<void> {
    while (!failed) {
      const index = next++;
      if (index >= items.length) return;
      try {
        await task(items[index], index);
      } catch (error) {
        if (!failed) {
          failed = true;
          failure = error;
        }
        return;
      }
    }
  }

  await Promise.all(Array.from({ length: inFlight }, () => worker()));
  if (failed) throw failure;
}

/**
 * Like {@link runWithLimit}, but keeps each task's result, in input order.
 *
 * Same reason to bound it: reading a folder listing or parsing EXIF is a Tauri command
 * that lands on the Rust blocking pool and touches the disk, so a folder of two thousand
 * loose photos should not become two thousand concurrent file reads.
 */
export async function mapWithLimit<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  await runWithLimit(items, limit, async (item, index) => {
    results[index] = await task(item, index);
  });
  return results;
}

/**
 * How many library commands to keep in flight for a bulk action.
 *
 * SQLite serialises writes, so more than a handful buys nothing and costs threads and
 * open connections. Small enough to stay polite, large enough to hide per-call overhead.
 */
export const BULK_COMMAND_CONCURRENCY = 4;

/**
 * How many EXIF reads to keep in flight while scanning a folder.
 *
 * Higher than the write bound because these are independent reads with no shared lock,
 * but still bounded: each one decodes a file, and the scan runs on first import when the
 * folder can hold thousands of photos.
 */
export const EXIF_SCAN_CONCURRENCY = 8;
