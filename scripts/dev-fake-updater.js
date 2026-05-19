#!/usr/bin/env node
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const allowedModes = new Set(['available', 'none', 'timeout', 'error', 'install-success', 'install-error']);
const mode = process.argv[2] || 'available';

if (!allowedModes.has(mode)) {
  console.error(`Unknown fake updater mode: ${mode}`);
  console.error(`Allowed modes: ${Array.from(allowedModes).join(', ')}`);
  process.exit(1);
}

const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const child = spawn(command, ['run', 'tauri', 'dev'], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_FAKE_APP_VERSION: process.env.VITE_FAKE_APP_VERSION || '0.2.7',
    VITE_FAKE_UPDATE_MODE: mode,
    VITE_FAKE_UPDATE_VERSION: process.env.VITE_FAKE_UPDATE_VERSION || pkg.version,
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
