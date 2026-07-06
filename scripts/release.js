#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const pkgPath = path.join(root, 'package.json');
const pkgLockPath = path.join(root, 'package-lock.json');
const tauriConfPath = path.join(root, 'src-tauri', 'tauri.conf.json');
const cargoTomlPath = path.join(root, 'src-tauri', 'Cargo.toml');
const cargoLockPath = path.join(root, 'src-tauri', 'Cargo.lock');
const websiteReleasePath = path.join(root, 'website', 'src', 'siteData.ts');

const VERSION_FILES = [pkgPath, pkgLockPath, tauriConfPath, cargoTomlPath, cargoLockPath, websiteReleasePath];

function run(cmd, options = {}) {
  execSync(cmd, {
    cwd: root,
    stdio: 'inherit',
    ...options,
  });
}

function runCapture(cmd) {
  return execSync(cmd, {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  }).trim();
}

function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Unsupported version format: ${version}`);
  }
  return match.slice(1).map(Number);
}

function bumpVersion(currentVersion, releaseType) {
  const [major, minor, patch] = parseVersion(currentVersion);
  if (releaseType === 'major') return `${major + 1}.0.0`;
  if (releaseType === 'minor') return `${major}.${minor + 1}.0`;
  if (releaseType === 'patch') return `${major}.${minor}.${patch + 1}`;
  if (/^\d+\.\d+\.\d+$/.test(releaseType)) return releaseType;
  throw new Error(`Expected patch, minor, major, or x.y.z. Got: ${releaseType}`);
}

function writeJson(filePath, updater) {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  updater(parsed);
  fs.writeFileSync(filePath, `${JSON.stringify(parsed, null, 2)}\n`);
}

function replaceVersionInText(filePath, pattern, nextVersion) {
  const source = fs.readFileSync(filePath, 'utf8');
  const updated = source.replace(pattern, `$1${nextVersion}$3`);
  if (updated === source) {
    throw new Error(`Failed to update version in ${path.relative(root, filePath)}`);
  }
  fs.writeFileSync(filePath, updated);
}

function ensureCleanWorktree() {
  const status = runCapture('git status --short');
  if (status) {
    throw new Error('Worktree must be clean before running release automation.');
  }
}

function ensureTagAbsent(tagName) {
  const existing = runCapture(`git tag --list ${tagName}`);
  if (existing) {
    throw new Error(`Git tag ${tagName} already exists.`);
  }
}

function syncVersions(nextVersion) {
  writeJson(pkgPath, (pkg) => {
    pkg.version = nextVersion;
  });

  writeJson(pkgLockPath, (lock) => {
    lock.version = nextVersion;
    if (lock.packages?.['']) {
      lock.packages[''].version = nextVersion;
    }
  });

  writeJson(tauriConfPath, (tauriConf) => {
    tauriConf.version = nextVersion;
  });

  replaceVersionInText(
    cargoTomlPath,
    /^(version\s*=\s*")([^"]+)(")$/m,
    nextVersion,
  );

  replaceVersionInText(
    cargoLockPath,
    /(\[\[package\]\]\r?\nname = "gljivobook"\r?\nversion = ")([^"]+)(")/m,
    nextVersion,
  );

  if (fs.existsSync(websiteReleasePath)) {
    replaceVersionInText(
      websiteReleasePath,
      /(version:\s*'v)([^']+)(')/m,
      nextVersion,
    );
  }
}

function printUsage() {
  console.log('Usage: npm run release -- <patch|minor|major|x.y.z> [--push]');
  console.log('Example: npm run release -- patch --push');
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const push = args.includes('--push');
  const releaseType = args.find((arg) => !arg.startsWith('--'));
  if (!releaseType) {
    printUsage();
    process.exit(1);
  }

  ensureCleanWorktree();

  const currentVersion = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
  const nextVersion = bumpVersion(currentVersion, releaseType);
  const tagName = `v${nextVersion}`;

  if (nextVersion === currentVersion) {
    throw new Error(`Version is already ${nextVersion}`);
  }

  ensureTagAbsent(tagName);

  console.log(`[release] ${currentVersion} -> ${nextVersion}`);
  syncVersions(nextVersion);

  run('npm run version:check');
  run('npm run build');
  run('cargo check --manifest-path src-tauri/Cargo.toml --offline');

  run(`git add "${pkgPath}" "${pkgLockPath}" "${tauriConfPath}" "${cargoTomlPath}" "${cargoLockPath}" "${websiteReleasePath}"`);
  run(`git commit --no-verify -m "Release v${nextVersion}"`);
  run(`git tag -a ${tagName} -m "Release ${tagName}"`);

  if (push) {
    run('git push');
    run(`git push origin ${tagName}`);
    console.log(`[release] Pushed commit and tag ${tagName}`);
  } else {
    console.log(`[release] Created commit and tag ${tagName}. Push when ready: git push && git push origin ${tagName}`);
  }
}

try {
  main();
} catch (error) {
  console.error(`[release] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
