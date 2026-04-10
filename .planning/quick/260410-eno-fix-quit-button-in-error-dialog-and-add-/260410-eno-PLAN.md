---
phase: quick
plan: 260410-eno
type: execute
wave: 1
depends_on: []
files_modified:
  - src/App.tsx
  - src/components/import/ImportDialog.tsx
autonomous: true
must_haves:
  truths:
    - "Clicking Quit in the error dialog closes the application"
    - "Clear All button appears when import queue has items"
    - "Clicking Clear All removes all pending items from the import queue"
  artifacts:
    - path: "src/App.tsx"
      provides: "Working quit handler using Tauri window API"
    - path: "src/components/import/ImportDialog.tsx"
      provides: "Clear All button in import picker"
  key_links:
    - from: "src/App.tsx handleQuit"
      to: "@tauri-apps/api/window getCurrentWindow().close()"
      via: "Tauri IPC window close"
---

<objective>
Fix two small UX issues: (1) the Quit button in the startup error dialog does nothing — make it actually close the app, and (2) add a Clear All button to the import photo picker to reset the queue.

Purpose: Both are usability papercuts identified during Phase 02.1 testing.
Output: Two modified files with working quit and clear-all functionality.
</objective>

<execution_context>
@.claude/get-shit-done/workflows/execute-plan.md
@.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/App.tsx
@src/components/import/ImportDialog.tsx
@src/components/dialogs/MigrationErrorDialog.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix Quit button in error dialog to close the app</name>
  <files>src/App.tsx</files>
  <action>
In src/App.tsx, the `handleQuit` function currently calls `window.close()` which does not work in Tauri.

Replace it with the Tauri window close API:

1. Add import: `import { getCurrentWindow } from '@tauri-apps/api/window';`
2. Change `handleQuit` to:
   ```ts
   function handleQuit() {
     getCurrentWindow().close();
   }
   ```

This uses the already-installed `@tauri-apps/api` package (v2.10.1). No new dependencies needed. `getCurrentWindow().close()` sends a close request through Tauri IPC which properly exits the app.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>handleQuit calls getCurrentWindow().close() instead of window.close(). TypeScript compiles without errors.</done>
</task>

<task type="auto">
  <name>Task 2: Add Clear All button to import photo picker</name>
  <files>src/components/import/ImportDialog.tsx</files>
  <action>
In ImportDialog.tsx, add a "Clear All" button that resets the pending queue.

1. In the picker buttons area (the `div` with `className="flex gap-2"` around line 149), add a Clear All button after the existing Pick Photos and Pick Folder buttons:
   ```tsx
   {pending.length > 0 && (
     <Button
       variant="ghost"
       onClick={() => setPending([])}
       disabled={importing}
       className="ml-auto text-destructive"
     >
       Clear All
     </Button>
   )}
   ```

2. The button should:
   - Only appear when there are pending items (`pending.length > 0`)
   - Be disabled during import (`importing`)
   - Use `variant="ghost"` with `text-destructive` class for a subtle but clear destructive action style
   - Be pushed to the right with `ml-auto` to visually separate it from the add buttons
   - Simply call `setPending([])` on click — no confirmation needed for clearing a pre-import queue
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Clear All button renders when queue is non-empty, clears all pending items on click, disabled during import. TypeScript compiles without errors.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with no errors
2. Manual: trigger a DB error (e.g., corrupt DB path) and verify Quit button closes the app
3. Manual: add several photos to import queue, click Clear All, queue empties
</verification>

<success_criteria>
- Quit button in error dialog closes the Tauri window/app
- Clear All button appears only when import queue has items
- Clear All empties the entire queue in one click
- No TypeScript compilation errors
</success_criteria>

<output>
No summary file needed for quick plans.
</output>
