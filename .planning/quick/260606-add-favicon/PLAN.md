# Plan: add favicon

## Goal
Stop dev server `/favicon.ico` 404 by serving the existing Gljivobook icon as a web favicon.

## Steps
- [x] Copy existing Tauri `.ico` into Vite public assets.
- [x] Add favicon link to `index.html`.
- [x] Run a quick build check.

## Result
- `/favicon.ico` is served from Vite `public/`.
- Production build copies it into `dist/favicon.ico`.
