#!/usr/bin/env node
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const fakeVersion = process.env.VITE_FAKE_APP_VERSION || process.argv[2] || '0.2.7';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gljivobook-real-updater-'));
const configPath = path.join(tempDir, 'tauri.fake-old.conf.json');

fs.writeFileSync(
  configPath,
  `${JSON.stringify(
    {
      version: fakeVersion,
    },
    null,
    2,
  )}\n`,
);

console.log(`[real-updater-test] Running app as v${fakeVersion}; GitHub latest is expected to be v${pkg.version}.`);
console.log('[real-updater-test] This uses the real Tauri updater endpoint and real release signature.');

const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const env = Object.fromEntries(
  Object.entries({
    ...process.env,
    VITE_FAKE_APP_VERSION: fakeVersion,
    VITE_FAKE_UPDATE_MODE: '',
    VITE_FAKE_UPDATE_VERSION: '',
  }).filter((entry) => typeof entry[1] === 'string'),
);

const child = spawn(command, ['run', 'tauri', '--', 'dev', '--config', configPath], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env,
});

child.on('exit', (code, signal) => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
