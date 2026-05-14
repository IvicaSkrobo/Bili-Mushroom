# PLAN - 260514-dark-startup-flash

Date: 2026-05-14
Mode: /gsd-quick

## Objective

Prevent the Windows/Tauri startup white flash by making the earliest window, HTML, body, and root paint dark before React applies the persisted theme.

## Scope

- `index.html`
- `src/index.css`
- `src-tauri/tauri.conf.json`

## Verification

- `npm.cmd run build`
