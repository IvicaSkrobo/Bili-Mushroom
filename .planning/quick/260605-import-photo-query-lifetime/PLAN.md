# Quick Fix: Import Photo Query Lifetime

## Goal
Fix the Rust compile error that prevents `npm run tauri dev` from launching.

## Scope
- Keep the SQL behavior unchanged.
- Avoid touching unrelated dirty files.
- Re-run a Rust compile check or app launch after the fix.
