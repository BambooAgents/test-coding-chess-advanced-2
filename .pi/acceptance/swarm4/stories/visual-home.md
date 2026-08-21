# User-Story Script — Visual / Home (cross-cutting visual gate)

This story checks the visual shell shared by all pages: nav, layout,
routing, no element bleeding across the page.

## Inputs
- URLs: `/`, `/play`, `/analyze`, `/puzzles`, `/weaknesses`

## Steps

### Step 1 — Home page
**Action:** Navigate to `/`.
**VISIBLE:**
- A landing/home screen renders with nav links: Home, Play, Analyze,
  Puzzles, My Weaknesses.
- No broken images, no overlapping text, no clipped content.
- Active/highlight state for the current route.

### Step 2 — Nav routing
**Action:** Click each nav link in turn.
**VISIBLE:**
- Each click navigates to the corresponding route (URL changes).
- The active highlight follows the current page.
- No page is blank or broken.

### Step 3 — No element bleeds across the page
**Action:** On /analyze, load a game, run analysis, scrub to a ply that
shows a best-move arrow.
**VISIBLE:**
- The best-move arrow is ON the chess board only.
- The arrow does NOT extend into the nav bar, the move list panel, or
  across the page background.
- No SVG/overlay element spans the full viewport.
**SPATIAL:** the arrow SVG's `getBoundingClientRect` is contained inside
the board's `getBoundingClientRect` (DOM containment probe REQUIRED).
**BLOCKER if:** any indigo/purple arrow pixels appear outside the board
rect (in nav, move list, or page background).

### Step 4 — Eval bar containment
**Action:** On /analyze with a loaded game.
**VISIBLE:**
- The eval bar is a thin vertical bar immediately beside the board.
- It fills proportionally to the eval (not stuck at 0, not full-page).
**SPATIAL:** the eval bar element is adjacent to / inside the board's
column, not floating elsewhere on the page.

### Step 5 — Move list containment
**Action:** On /analyze with a loaded game.
**VISIBLE:**
- The move list is in its right-side panel.
- Badges (??, ‼, ?!, ?, ?) sit next to their moves, inside the move list.
- No badge or move text overlaps the board or spills outside the panel.
**SPATIAL:** move-list badges are inside the move-list container rect.

### Step 6 — Toasts / overlays stay in viewport
**Action:** Trigger an illegal move (play page) or an error (empty PGN
analyze).
**VISIBLE:**
- Any toast/error appears within the viewport, near the relevant area.
- The toast does not cover the whole page or render off-screen.
**SPATIAL:** toast rect is within the viewport rect.

## Notes for reviewer
- This is the cross-cutting visual-integrity story. Every other page
  story ALSO has its own SPATIAL lines; this one is the global check.
- For every SPATIAL line, run a `getBoundingClientRect` containment probe.
  Vision hallucinates positions; the DOM probe is authoritative.
- The arrow-bleed bug specifically: verify indigo pixels appear ONLY
  within the board rect on the post-fix build.
