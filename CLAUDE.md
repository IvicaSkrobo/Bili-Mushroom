<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.

## Project Workflow

### Memory Folder Instructions

At the start of every session, read the /memory folder, starting with handoff.md.

At the end of every session, update memory/handoff.md with what was done and what is next.

When a feature is fully complete and merged, clear current-task.md and move the summary to progress.md.

Never delete decisions.md entries; only add to them.

### Project Structure

The project structure follows standard Tauri 2.x conventions. The frontend code is located in `src-tauri/src/commands`, while the Rust backend code is located in `src-tauri/src/lib`.

### Dependencies

The project uses the following dependencies:

* Tauri 2.x
* React 18+
* Rust (for backend development)

### Architecture

The architecture follows standard Tauri 2.x patterns. The frontend communicates with the backend via IPC, while the backend interacts with the SQLite database.

<!-- GSD:profile-end -->
