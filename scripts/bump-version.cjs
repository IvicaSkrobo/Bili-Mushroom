#!/usr/bin/env node
/**
 * Bumps the patch version in package.json, package-lock.json,
 * src-tauri/tauri.conf.json, src-tauri/Cargo.toml, src-tauri/Cargo.lock, and
 * the website release fallback, then stages the changed files so the bump is
 * included in the current commit.
 * Invoked automatically by the git pre-commit hook.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');

// --- package.json ---
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const [major, minor, patch] = pkg.version.split('.').map(Number);
const newVersion = `${major}.${minor}.${patch + 1}`;
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// --- tauri.conf.json ---
const tauriConfPath = path.join(root, 'src-tauri', 'tauri.conf.json');
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
tauriConf.version = newVersion;
fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');

// --- package-lock.json ---
const packageLockPath = path.join(root, 'package-lock.json');
if (fs.existsSync(packageLockPath)) {
  const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
  packageLock.version = newVersion;
  if (packageLock.packages?.['']) {
    packageLock.packages[''].version = newVersion;
  }
  fs.writeFileSync(packageLockPath, JSON.stringify(packageLock, null, 2) + '\n');
}

// --- Cargo.toml (only the [package] version line) ---
const cargoPath = path.join(root, 'src-tauri', 'Cargo.toml');
let cargo = fs.readFileSync(cargoPath, 'utf8');
cargo = cargo.replace(
  /^(version\s*=\s*)"[^"]*"/m,
  `$1"${newVersion}"`,
);
fs.writeFileSync(cargoPath, cargo);

// --- Cargo.lock (only this package's lock entry) ---
const cargoLockPath = path.join(root, 'src-tauri', 'Cargo.lock');
if (fs.existsSync(cargoLockPath)) {
  let cargoLock = fs.readFileSync(cargoLockPath, 'utf8');
  cargoLock = cargoLock.replace(
    /(name = "gljivobook"\r?\nversion = )"[^"]+"/,
    `$1"${newVersion}"`,
  );
  fs.writeFileSync(cargoLockPath, cargoLock);
}

// --- Website fallback release version ---
const websiteReleasePath = path.join(root, 'website', 'src', 'siteData.ts');
if (fs.existsSync(websiteReleasePath)) {
  let websiteRelease = fs.readFileSync(websiteReleasePath, 'utf8');
  websiteRelease = websiteRelease.replace(
    /(version:\s*')v[^']+(')/,
    `$1v${newVersion}$2`,
  );
  fs.writeFileSync(websiteReleasePath, websiteRelease);
}

// Stage version files so the bump is part of the commit
const pathsToStage = [pkgPath, packageLockPath, tauriConfPath, cargoPath, cargoLockPath, websiteReleasePath]
  .filter((filePath) => fs.existsSync(filePath))
  .map((filePath) => `"${filePath}"`)
  .join(' ');
execSync(`git add ${pathsToStage}`);

console.log(`[bump-version] bumped to v${newVersion}`);
