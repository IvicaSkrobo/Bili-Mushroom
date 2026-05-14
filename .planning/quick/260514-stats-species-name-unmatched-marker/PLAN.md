# Plan

## Objective
Prevent broken species-name markup from leaking raw asterisks into stats, especially historical comparison chips.

## Steps
1. Inspect shared species-name renderer and historical comparison usage.
2. Update parser/plain-text helper to tolerate unmatched `*` markers.
3. Add focused tests for author strings like `Coprinellus micaceus *(Bull.) Vilgalys`.
4. Run build/test verification.
