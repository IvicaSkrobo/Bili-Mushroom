# CLAUDE.local.md — Local Overrides

This file is gitignored and contains local methodology overrides that apply only to this machine/session. Do not commit.

---

## Global Methodology

### Frontend Design Skill — Mandatory for UI/UX Work

The `frontend-design` skill is installed at `.claude/skills/frontend-design/SKILL.md`.

**Always invoke the `frontend-design` skill before implementing or modifying any UI component, page layout, visual styling, or UX flow.** This includes:

- New components or screens
- Changes to existing component appearance (colors, spacing, typography, layout)
- Any GSD phase that involves frontend or UI work (e.g. phases tagged `ui`, `frontend`, `design`, `ux`)
- UX flows where the interaction pattern or visual feedback is being designed or revised

**How to apply:**
- When using `/gsd-ui-phase`, the frontend-design skill is the primary design reference — commit to a bold, intentional aesthetic direction before writing any code.
- When using `/gsd-plan-phase` or `/gsd-execute-phase` for a UI phase, load the skill and follow its design thinking section before touching any component files.
- For ad-hoc UI tasks (`/gsd-quick`, `/gsd-fast`), still run the skill mentally: pick a tonal direction, choose distinctive typography, avoid generic AI defaults.

**What the skill enforces:**
- No Inter/Roboto/Arial/system fonts — choose characterful display + body pairings
- No purple gradients on white — commit to a cohesive, context-specific palette
- Motion: prioritize one well-orchestrated staggered reveal over scattered micro-interactions
- Layouts: asymmetry, overlap, and grid-breaking elements over predictable grids
- Every design should feel hand-crafted for Bili Mushroom (forager audience, Croatian context, organic/nature aesthetic)
