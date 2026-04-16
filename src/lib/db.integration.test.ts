/**
 * A5 Integration Smoke Test — Finds Table Reachability
 *
 * PURPOSE
 * -------
 * This file documents the manual end-to-end verification path for Architecture
 * Risk A5 (migration key mismatch causing the finds table to be missing at
 * runtime). The AUTHORITATIVE guard for A5 is the Rust unit test in
 * `src-tauri/src/commands/import.rs` (`test_migration_regression`) which runs
 * both migration scripts against a real on-disk SQLite DB in a tempdir and
 * asserts the finds table exists.
 *
 * This TypeScript integration test is a SUPPLEMENTARY check that an end-to-end
 * developer can run when they want confidence that the JS-side Database.load()
 * connection string reaches the same DB file that the Rust commands use.
 *
 * HOW TO RUN
 * ----------
 * Set TAURI_INTEGRATION=1 and point TAURI_DB_PATH to an absolute path of an
 * existing bili-mushroom.db that has been initialised by a real Tauri launch:
 *
 *   TAURI_INTEGRATION=1 TAURI_DB_PATH=/Users/you/Library/.../bili-mushroom.db \
 *     npm test -- --run src/lib/db.integration.test.ts
 *
 * If the env vars are absent the entire describe block is skipped — no output
 * is emitted on the standard CI run.
 */

import { describe, it, expect } from 'vitest';

const INTEGRATION = !!process.env.TAURI_INTEGRATION;

describe.skipIf(!INTEGRATION)('A5 — finds table reachable via JS Database.load', () => {
  it('finds table exists in the real DB', async () => {
    const dbPath = process.env.TAURI_DB_PATH;
    expect(
      dbPath,
      'Set TAURI_DB_PATH to the absolute path of a real bili-mushroom.db',
    ).toBeTruthy();

    // Dynamic import so the mock infrastructure does not get in the way on
    // normal Vitest runs (the module references @tauri-apps/plugin-sql which is
    // mocked in tauri-mocks.ts for unit tests).
    const pluginName = '@tauri-apps/plugin-sql';
    const { default: Database } = await import(/* @vite-ignore */ pluginName);
    const db: Awaited<ReturnType<typeof Database.load>> = await Database.load(
      `sqlite:${dbPath!}`,
    );

    const rows = await db.select<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='finds'",
      [],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('finds');

    await db.close();
  });
});
