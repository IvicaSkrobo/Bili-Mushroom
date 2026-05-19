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

function assertSame(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${label} version mismatch: expected ${expected}, got ${actual}`);
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

assertSame('package-lock root', packageLock.version, packageVersion);
assertSame('package-lock packages[""]', packageLock.packages?.['']?.version, packageVersion);
assertSame('tauri.conf.json', tauriConf.version, packageVersion);
assertSame('Cargo.toml', cargoTomlVersion, packageVersion);
assertSame('Cargo.lock', cargoLockVersion, packageVersion);

const tagName = process.env.GITHUB_REF_NAME || process.env.RELEASE_TAG || '';
if (tagName) {
  assertSame('git tag', tagName, `v${packageVersion}`);
}

console.log(`[version] ok: v${packageVersion}`);
