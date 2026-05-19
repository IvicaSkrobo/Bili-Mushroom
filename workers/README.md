# Gljivobook Bug Report Worker

Free first version of the no-account bug report flow. No screenshots are uploaded in this version.

## Flow

1. Gljivobook app submits a text bug report to a Cloudflare Worker.
2. The Worker keeps the GitHub token as a Cloudflare secret.
3. The Worker creates a GitHub issue in `IvicaSkrobo/Bili-Mushroom`.

Users do not need a GitHub account.

## GitHub Token

Create a fine-grained GitHub token:

- Repository access: `IvicaSkrobo/Bili-Mushroom` only
- Permissions: `Issues` -> `Read and write`
- Expiration: choose a date you are comfortable renewing

Do not commit this token anywhere.

## Cloudflare Worker Settings

Secrets:

- `GITHUB_TOKEN`: the fine-grained GitHub token

Variables:

- `GITHUB_OWNER`: `IvicaSkrobo`
- `GITHUB_REPO`: `Bili-Mushroom`
- `GITHUB_LABELS`: `bug,app-report`
- `ALLOWED_ORIGINS`: optional comma-separated list. Leave empty for the first app-only version.

## Deploy

Use the Cloudflare dashboard or Wrangler. With Wrangler:

```powershell
cd D:\ClaudeProjects\Bili-Mushroom\workers
copy wrangler.toml.example wrangler.toml
npx wrangler login
npx wrangler secret put GITHUB_TOKEN
npx wrangler deploy
```

The deploy output gives a URL like:

```text
https://gljivobook-bug-report.YOUR-SUBDOMAIN.workers.dev
```

## Test The Worker

Health check:

```powershell
Invoke-RestMethod "https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev"
```

Submit a test report:

```powershell
Invoke-RestMethod "https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"title":"Test bug report","description":"Testing the Gljivobook bug report worker from PowerShell.","steps":"1. Send test","contact":"","language":"hr","theme":"dark","source":"app","appVersion":"test","userAgent":"PowerShell","platform":"Windows","reportedAt":"2026-05-19T00:00:00Z"}'
```

You should get `{ "ok": true, "issueUrl": "..." }` and a GitHub issue should appear.

## Connect App Releases

Set this repository variable in GitHub:

- Settings -> Secrets and variables -> Actions -> Variables
- Add `VITE_BUG_REPORT_ENDPOINT`
- Value: the Worker URL

The Windows release workflow passes that variable into the Tauri build. The Tauri CSP already allows `https://*.workers.dev`.

For local testing:

```powershell
$env:VITE_BUG_REPORT_ENDPOINT="https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev"
npm.cmd run tauri dev
```
