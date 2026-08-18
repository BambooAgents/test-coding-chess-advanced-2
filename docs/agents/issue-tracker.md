# Issue tracker: Local Markdown

Issues, decision maps, and implementation tickets for this repository live as Markdown under `.scratch/`.

## Conventions

- One effort per directory: `.scratch/<effort-slug>/`.
- A settled implementation spec/PRD is `.scratch/<effort-slug>/PRD.md` when one is useful.
- Implementation issues are `.scratch/<effort-slug>/issues/<NN>-<slug>.md`, numbered from `01`.
- Keep `Status:` near the top of each issue and append discussion/history under `## Comments` when useful.
- Use `Blocked by: NN, NN` for dependency edges. A ticket is unblocked when every blocker is resolved.
- Treat open, unblocked, unclaimed tickets as the frontier.

## Wayfinding operations

- Map: `.scratch/<effort>/map.md`.
- Child ticket: `.scratch/<effort>/issues/NN-<slug>.md` with `Type:` (`research`, `prototype`, `grilling`, `task`) and `Status:`.
- Claim: set `Status: claimed` before work.
- Resolve: append `## Answer`, set `Status: resolved`, and add a gist/link to the map's Decisions-so-far.
- Do not resolve more than one Wayfinder decision ticket in a single child session.

## Implementation tickets

Prefer tracer-bullet vertical capabilities that can be demonstrated independently. Avoid splitting ordinary feature work into frontend/backend/test layers when an end-to-end slice is possible.
