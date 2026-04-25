#!/usr/bin/env node
/**
 * Bumps the patch version in package.json and src-tauri/Cargo.toml + tauri.conf.json,
 * then stages the changed files so the bump lands in the current commit.
 * Run as a git pre-commit hook.
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

// --- Cargo.toml (replace version = "x.y.z" in [package] section) ---
const cargoPath = path.join(root, 'src-tauri', 'Cargo.toml');
let cargo = fs.readFileSync(cargoPath, 'utf8');
cargo = cargo.replace(
  /^(version\s*=\s*)"[^"]*"/m,
  `$1"${newVersion}"`
);
fs.writeFileSync(cargoPath, cargo);

// Stage the three files
execSync(`git add "${pkgPath}" "${tauriConfPath}" "${cargoPath}"`);

console.log(`[bump-version] → v${newVersion}`);
