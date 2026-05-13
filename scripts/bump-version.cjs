#!/usr/bin/env node
/**
 * Bumps the patch version in package.json, src-tauri/tauri.conf.json,
 * and src-tauri/Cargo.toml, then stages the changed files so the bump
 * is included in the current commit.
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

// --- Cargo.toml (only the [package] version line) ---
const cargoPath = path.join(root, 'src-tauri', 'Cargo.toml');
let cargo = fs.readFileSync(cargoPath, 'utf8');
cargo = cargo.replace(
  /^(version\s*=\s*)"[^"]*"/m,
  `$1"${newVersion}"`,
);
fs.writeFileSync(cargoPath, cargo);

// Stage the three files so the bump is part of the commit
execSync(`git add "${pkgPath}" "${tauriConfPath}" "${cargoPath}"`);

console.log(`[bump-version] bumped to v${newVersion}`);
