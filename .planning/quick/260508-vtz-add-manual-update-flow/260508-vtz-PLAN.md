---
phase: quick
plan: 260508-vtz
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/dialogs/SettingsDialog.tsx
autonomous: true
requirements: [manual-update-flow]

must_haves:
  truths:
    - "User sees current app version in Settings"
    - "User can click 'Check for updates' and see checking state"
    - "If update found, user sees version and 'Update now' button"
    - "If no update, user sees 'Up to date' confirmation"
    - "If error, user sees the error message (not silent fail)"
    - "'Update now' shows installing state then restart notice on success"
    - "Store's availableUpdate (from startup auto-check) pre-populates available state on dialog open"
  artifacts:
    - path: "src/components/dialogs/SettingsDialog.tsx"
      provides: "Manual update check UI in version section"
      contains: "checkStatus"
  key_links:
    - from: "SettingsDialog.tsx checkStatus=checking"
      to: "invoke('check_app_update')"
      via: "handleCheckForUpdates"
    - from: "SettingsDialog.tsx checkStatus=installing"
      to: "invoke('install_app_update')"
      via: "handleInstallUpdate"
---

<objective>
Expand the version row in SettingsDialog (currently lines 135-138) into a full manual update UI panel.

Purpose: Users need to check for and install updates without restarting the app; the startup auto-check is silent/toast-only. This gives them control.
Output: SettingsDialog version section with check/install flow, status feedback, and Forest Codex aesthetic.
</objective>

<execution_context>
@/Users/ivicaskrobo/Documents/GitHub/Bili-Mushroom/.planning/quick/260508-vtz-add-manual-update-flow/260508-vtz-PLAN.md
</execution_context>

<context>
@/Users/ivicaskrobo/Documents/GitHub/Bili-Mushroom/src/components/dialogs/SettingsDialog.tsx
@/Users/ivicaskrobo/Documents/GitHub/Bili-Mushroom/src/stores/appStore.ts

<interfaces>
<!-- From src/stores/appStore.ts -->
```typescript
export interface AvailableUpdate {
  version: string;
  notes: string;
  pub_date: string;
}

// Relevant store slices:
availableUpdate: AvailableUpdate | null   // set by startup auto-check in App.tsx
installingUpdate: boolean
setAvailableUpdate: (update: AvailableUpdate | null) => void
setInstallingUpdate: (installing: boolean) => void
```

<!-- From src/App.tsx (Tauri guard pattern) -->
```typescript
if (!('__TAURI_INTERNALS__' in window)) return;
invoke<AvailableUpdate | null>('check_app_update')
invoke<boolean>('install_app_update')
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace version row with manual update panel in SettingsDialog</name>
  <files>src/components/dialogs/SettingsDialog.tsx</files>
  <action>
Replace lines 135-138 (the simple version row) with an expanded version + update section. Keep the outer `pt-2 border-t` container but grow it into a full panel.

**Local state to add (inside the component function, near existing `useState` calls):**
```typescript
type CheckStatus = 'idle' | 'checking' | 'up-to-date' | 'available' | 'installing' | 'done' | 'error';
const [checkStatus, setCheckStatus] = useState<CheckStatus>('idle');
const [checkError, setCheckError] = useState<string | null>(null);
const [localUpdate, setLocalUpdate] = useState<import('@/stores/appStore').AvailableUpdate | null>(null);
```

**Store selectors to add (near existing store selectors at top of component):**
```typescript
const availableUpdate = useAppStore((s) => s.availableUpdate);
const setInstallingUpdate = useAppStore((s) => s.setInstallingUpdate);
```

**Pre-populate from store on dialog open** — add to the existing `useEffect` that runs when `open` changes:
```typescript
if (availableUpdate) {
  setLocalUpdate(availableUpdate);
  setCheckStatus('available');
}
```
(Inside the `if (!open) return;` guard, after `getTileCacheStats` call.)

**Handler: handleCheckForUpdates**
```typescript
async function handleCheckForUpdates() {
  if (!('__TAURI_INTERNALS__' in window)) return;
  setCheckStatus('checking');
  setCheckError(null);
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const update = await invoke<import('@/stores/appStore').AvailableUpdate | null>('check_app_update');
    if (update) {
      setLocalUpdate(update);
      setCheckStatus('available');
    } else {
      setCheckStatus('up-to-date');
    }
  } catch (err) {
    setCheckError(String((err as Error)?.message ?? err));
    setCheckStatus('error');
  }
}
```

**Handler: handleInstallUpdate**
```typescript
async function handleInstallUpdate() {
  if (!('__TAURI_INTERNALS__' in window)) return;
  setCheckStatus('installing');
  setInstallingUpdate(true);
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const ok = await invoke<boolean>('install_app_update');
    setInstallingUpdate(false);
    if (ok) {
      setCheckStatus('done');
    } else {
      setCheckError('Update download failed.');
      setCheckStatus('error');
    }
  } catch (err) {
    setInstallingUpdate(false);
    setCheckError(String((err as Error)?.message ?? err));
    setCheckStatus('error');
  }
}
```

**Replace lines 135-138** with this JSX section:
```tsx
<div className="pt-2 border-t">
  <div className="flex items-center justify-between mb-2">
    <span className="text-xs text-muted-foreground">Bili Mushroom</span>
    <span className="text-xs text-muted-foreground font-mono">v{__APP_VERSION__}</span>
  </div>

  {/* Status row */}
  {checkStatus === 'up-to-date' && (
    <p className="text-xs text-muted-foreground mb-2">Up to date.</p>
  )}
  {checkStatus === 'available' && localUpdate && (
    <p className="text-xs mb-2" style={{ color: 'var(--color-primary)' }}>
      Update available: v{localUpdate.version}
    </p>
  )}
  {checkStatus === 'done' && (
    <p className="text-xs mb-2" style={{ color: 'var(--color-primary)' }}>
      Update started. The app will restart.
    </p>
  )}
  {checkStatus === 'error' && checkError && (
    <p className="text-xs text-destructive mb-2">{checkError}</p>
  )}

  {/* Action buttons */}
  <div className="flex gap-2">
    <Button
      variant="secondary"
      size="sm"
      onClick={handleCheckForUpdates}
      disabled={checkStatus === 'checking' || checkStatus === 'installing' || checkStatus === 'done'}
    >
      {checkStatus === 'checking' ? 'Checking…' : 'Check for updates'}
    </Button>

    {(checkStatus === 'available') && localUpdate && (
      <Button
        variant="default"
        size="sm"
        onClick={handleInstallUpdate}
        disabled={checkStatus === 'installing'}
      >
        {checkStatus === 'installing' ? 'Installing…' : 'Update now'}
      </Button>
    )}
  </div>
</div>
```

**Aesthetic notes (Forest Codex):**
- Use `var(--color-primary)` (amber) for positive update status text — no green.
- Use `text-destructive` for error text.
- Buttons use existing `variant="secondary"` and `variant="default"` — no custom colors needed.
- No spinner component needed; text label change ("Checking…" / "Installing…") is sufficient.

Do NOT add i18n keys for this task — English strings inline are fine for now (same pattern as the Map Cache section already in the dialog).
  </action>
  <verify>
    <automated>cd /Users/ivicaskrobo/Documents/GitHub/Bili-Mushroom && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - TypeScript compiles with no errors in SettingsDialog.tsx
    - Version row replaced with expanded panel: version label + check button visible
    - If availableUpdate is set in store when dialog opens, "Update available: vX.X.X" and "Update now" button are pre-shown
    - "Check for updates" disabled during checking/installing/done states
    - "Update now" button only visible when checkStatus === 'available'
    - Error text visible in red when check or install fails
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes (no type errors)
2. Open Settings in dev mode (non-Tauri): "Check for updates" button visible; clicking it does nothing (Tauri guard fires early return)
3. In Tauri dev build: clicking "Check for updates" shows "Checking…" briefly, then resolves to "Up to date" or "Update available: vX.X.X"
4. If update available: "Update now" button appears; clicking shows "Installing…" then "Update started. The app will restart."
5. If invoke throws: error message renders below the button (not silent)
</verification>

<success_criteria>
- SettingsDialog version section has manual update check UI with all states: idle, checking, up-to-date, available, installing, done, error
- Store's availableUpdate pre-populates the available state on dialog open
- No silent failures — every error shown to user
- Forest Codex aesthetic maintained (amber primary for success states, destructive for errors)
</success_criteria>

<output>
After completion, create `.planning/quick/260508-vtz-add-manual-update-flow/260508-vtz-SUMMARY.md`
</output>
