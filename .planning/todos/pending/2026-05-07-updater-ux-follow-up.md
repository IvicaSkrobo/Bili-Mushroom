# Pending Todo: Updater UX follow-up

Date: 2026-05-07
Status: pending
Type: research/backlog

## Why this was added

The app now has a working updater foundation, visible version badge, and a top-level update CTA when a newer release exists. The next UX pass should make update discovery more resilient for users who keep the app open for long periods.

## Confirmed current state

- App version is visible in the top header.
  - `src/components/layout/AppShell.tsx`
- A visible `Update` button appears in the header when startup update check finds a newer release.
  - `src/components/layout/AppShell.tsx`
  - `src/App.tsx`
- Update availability is checked on app startup.
  - `src/App.tsx`
- There is no manual "Check for updates" action yet.
- There is no periodic background re-check while the app stays open.

## Backlog item A: Manual "Check for updates"

### User value

- Lets users verify updates on demand without restarting the app
- Useful after hearing "a new build is out" while already inside the app
- Reduces ambiguity when the app has been open for hours

### Minimal scope

- Add a `Check for updates` action in one or both places:
  - Settings dialog
  - top header version/update area
- Reuse the same updater backend commands already added for startup check/install
- Show clear result states:
  - update available
  - already up to date
  - updater not configured / temporary failure

## Backlog item B: Periodic background update check

### User value

- Users can keep the app open and still learn about new releases
- Better fit for a desktop app than relying only on startup checks

### Recommended scope

- Add a lightweight background update check every few hours
- Good starting interval:
  - every 3-4 hours
- Only run the check when:
  - app is open
  - updater is configured
- Avoid noisy UX:
  - do not stack repeated toasts for the same version
  - keep one stable header CTA once an update is known

### Safe implementation note

- Persist or memoize the last version already announced in the current session
- Prefer interval-based checks or foreground/focus checks over aggressive polling
- Keep the manual `Check for updates` button even after background polling is added

## Suggested order

1. Add manual `Check for updates`
2. Add session-safe background re-check every few hours
3. Optionally add release notes popover/detail view in the header version area
