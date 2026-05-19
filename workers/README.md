# Gljivobook Bug Report Worker

Free first version of the no-account bug report flow.

Flow:

1. Gljivobook app submits a text bug report to a Cloudflare Worker.
2. The Worker stores the GitHub token as a secret.
3. The Worker creates a GitHub issue in `IvicaSkrobo/Bili-Mushroom`.

No screenshots are uploaded in this version.

## Required Cloudflare Worker Settings

Secrets:

- `GITHUB_TOKEN`: fine-grained GitHub token with Issues read/write access for this repository only.

Variables:

- `GITHUB_OWNER`: `IvicaSkrobo`
- `GITHUB_REPO`: `Bili-Mushroom`
- `GITHUB_LABELS`: `bug,app-report`

After deploy, build the app with:

```bash
set VITE_BUG_REPORT_ENDPOINT=https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev
npm run build
```

For PowerShell:

```powershell
$env:VITE_BUG_REPORT_ENDPOINT="https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev"
npm run build
```

The Tauri CSP already allows `https://*.workers.dev`.
