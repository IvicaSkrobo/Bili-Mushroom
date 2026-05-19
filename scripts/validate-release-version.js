#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function matchVersion(relativePath, pattern) {
  const match = readText(relativePath).match(pattern);
  if (!match) throw new Error(`Could not read version from ${relativePath}`);
  return match[1];
}

function majorMinor(version) {
  const match = version.match(/^(\d+\.\d+)\./);
  if (!match) throw new Error(`Could not read major/minor from version ${version}`);
  return match[1];
}

function assertSame(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${label} version mismatch: expected ${expected}, got ${actual}`);
  }
}

function assertSameMajorMinor(label, actual, expected) {
  const actualMinor = majorMinor(actual);
  const expectedMinor = majorMinor(expected);
  if (actualMinor !== expectedMinor) {
    throw new Error(`${label} major/minor mismatch: expected ${expectedMinor}.x, got ${actualMinor}.x`);
  }
}

const packageVersion = readJson('package.json').version;
if (!/^\d+\.\d+\.\d+$/.test(packageVersion)) {
  throw new Error(`package.json version must be x.y.z, got ${packageVersion}`);
}

const packageLock = readJson('package-lock.json');
const tauriConf = readJson('src-tauri/tauri.conf.json');
const cargoTomlVersion = matchVersion('src-tauri/Cargo.toml', /^version\s*=\s*"([^"]+)"/m);
const cargoLockVersion = matchVersion(
  'src-tauri/Cargo.lock',
  /\[\[package\]\]\s+name = "gljivobook"\s+version = "([^"]+)"/m,
);
const websiteFallbackVersion = matchVersion('website/src/siteData.ts', /version:\s*'v([^']+)'/m);
const cargoTauriVersion = matchVersion(
  'src-tauri/Cargo.lock',
  /\[\[package\]\]\s+name = "tauri"\s+version = "([^"]+)"/m,
);
const npmApiVersion = packageLock.packages?.['node_modules/@tauri-apps/api']?.version;
const npmCliVersion = packageLock.packages?.['node_modules/@tauri-apps/cli']?.version;
if (!npmApiVersion) throw new Error('Could not read @tauri-apps/api version from package-lock.json');
if (!npmCliVersion) throw new Error('Could not read @tauri-apps/cli version from package-lock.json');

assertSame('package-lock root', packageLock.version, packageVersion);
assertSame('package-lock packages[""]', packageLock.packages?.['']?.version, packageVersion);
assertSame('tauri.conf.json', tauriConf.version, packageVersion);
assertSame('Cargo.toml', cargoTomlVersion, packageVersion);
assertSame('Cargo.lock', cargoLockVersion, packageVersion);
assertSame('website fallback', websiteFallbackVersion, packageVersion);

for (const [name, entry] of Object.entries(packageLock.packages ?? {})) {
  if (name.endsWith('node_modules/@tauri-apps/api')) {
    assertSameMajorMinor(`package-lock ${name}`, entry.version, npmApiVersion);
  }
}

assertSameMajorMinor('@tauri-apps/api vs Rust tauri', npmApiVersion, cargoTauriVersion);
assertSameMajorMinor('@tauri-apps/cli vs Rust tauri', npmCliVersion, cargoTauriVersion);

const tagName = process.env.GITHUB_REF_NAME || process.env.RELEASE_TAG || '';
if (tagName) {
  assertSame('git tag', tagName, `v${packageVersion}`);
}

console.log(`[version] ok: v${packageVersion}; Tauri ${majorMinor(cargoTauriVersion)}.x`);
