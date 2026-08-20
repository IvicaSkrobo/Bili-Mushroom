#!/usr/bin/env node
/**
 * Reproducible `cargo test` for this project on Windows.
 *
 * Why this exists: the Rust unit-test executable carries no application manifest,
 * so Windows resolves comctl32.dll to the System32 v5.82 build. That build does not
 * export TaskDialogIndirect or RemoveWindowSubclass, which the Tauri dependency
 * chain imports, and the process aborts at load with STATUS_ENTRYPOINT_NOT_FOUND
 * (0xc0000139) before a single test runs. The app binary is unaffected because
 * tauri-build gives it a manifest that binds the Common-Controls v6 side-by-side
 * assembly.
 *
 * Adding /MANIFEST:EMBED through .cargo/config.toml would apply to every target,
 * including the release app that already embeds its own manifest, so instead this
 * script builds the test binaries, stamps the v6 manifest into each one with
 * mt.exe, and then runs them.
 *
 * Usage:
 *   npm run test:rust                 # whole lib suite
 *   npm run test:rust -- collection   # only tests matching "collection"
 *
 * On non-Windows platforms it just forwards to `cargo test`.
 */
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const manifestDir = path.join(root, 'src-tauri');
const forwarded = process.argv.slice(2);

if (process.platform !== 'win32') {
  const result = spawnSync('cargo', ['test', '--lib', ...forwarded], {
    cwd: manifestDir,
    stdio: 'inherit',
  });
  process.exit(result.status ?? 1);
}

const COMCTL6_MANIFEST = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <dependency>
    <dependentAssembly>
      <assemblyIdentity type="win32" name="Microsoft.Windows.Common-Controls" version="6.0.0.0" processorArchitecture="amd64" publicKeyToken="6595b64144ccf1df" language="*" />
    </dependentAssembly>
  </dependency>
</assembly>
`;

/** Newest mt.exe from the installed Windows SDKs, or null. */
function findMt() {
  const roots = [
    'C:\\Program Files (x86)\\Windows Kits\\10\\bin',
    'C:\\Program Files\\Windows Kits\\10\\bin',
  ];
  const candidates = [];
  for (const binRoot of roots) {
    if (!fs.existsSync(binRoot)) continue;
    for (const version of fs.readdirSync(binRoot)) {
      for (const arch of ['x64', 'x86']) {
        const candidate = path.join(binRoot, version, arch, 'mt.exe');
        if (fs.existsSync(candidate)) candidates.push(candidate);
      }
    }
  }
  candidates.sort();
  return candidates.length ? candidates[candidates.length - 1] : null;
}

// Build the test binaries and ask cargo where it put them.
const build = spawnSync(
  'cargo',
  ['test', '--lib', '--no-run', '--message-format=json-render-diagnostics'],
  { cwd: manifestDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);
if (build.stderr) process.stderr.write(build.stderr);
if (build.status !== 0) process.exit(build.status ?? 1);

const executables = [];
for (const line of build.stdout.split('\n')) {
  if (!line.startsWith('{')) continue;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    continue;
  }
  if (message.reason === 'compiler-artifact' && message.profile?.test && message.executable) {
    executables.push(message.executable);
  }
}

if (executables.length === 0) {
  console.error('[rust-test] cargo reported no test executables to run.');
  process.exit(1);
}

const mt = findMt();
if (mt) {
  const manifestPath = path.join(path.dirname(executables[0]), 'comctl6.manifest');
  fs.writeFileSync(manifestPath, COMCTL6_MANIFEST, 'utf8');
  for (const executable of executables) {
    const stamp = spawnSync(mt, ['-nologo', '-manifest', manifestPath, `-outputresource:${executable};#1`], {
      encoding: 'utf8',
    });
    if (stamp.status !== 0) {
      console.error(`[rust-test] mt.exe failed for ${path.basename(executable)}:`);
      process.stderr.write(stamp.stderr || stamp.stdout || '');
      process.exit(stamp.status ?? 1);
    }
  }
} else {
  console.warn(
    '[rust-test] mt.exe not found (install the Windows SDK). Running the tests unpatched — ' +
      'expect STATUS_ENTRYPOINT_NOT_FOUND (0xc0000139) at process start.',
  );
}

let failed = 0;
for (const executable of executables) {
  const run = spawnSync(executable, forwarded, { stdio: 'inherit' });
  if (run.status !== 0) failed = run.status ?? 1;
}
process.exit(failed);
