# Visual Swarm Blindness — Root Cause Investigation

## The bug the swarm missed

The chess board's arrow overlay SVG (`[data-testid="board-arrows"]`) used
`position: absolute; inset: 0; width: 100%; height: 100%` to overlay the
board. But `BoardGrid` (its parent) had **no `position: relative`**, so
`inset: 0` resolved against the **nearest positioned ancestor — the
viewport**. The SVG rendered at 1280×900 (full page) instead of 560×560
(board), drawing arrows across the navigation bar, the input panel, and
the move list — anywhere their viewBox coordinates landed when stretched
2.3× horizontally and 1.6× vertically.

**7 of 11 analyze screenshots had arrow pixels bleeding into the move list
panel.** The user saw it in one glance. The entire acceptance swarm — two
rounds of review, 20 vision-checker runs, a re-review — **never flagged it.**

## How the swarm was structured

```
Parent (orchestrator / supervisor)
 └─ acceptance-reviewer (depth 1, GLM-5.2 text-only)
     └─ vision-checker (depth 2, Qwen vision) ← 1 screenshot per fresh conversation
```

The two-tier architecture was specifically designed to work around Qwen's
4-image-per-conversation cap: GLM-5.2 orchestrators drive Playwright and
dispatch Qwen vision-checkers (1 image each, fresh conversation).

## Root cause — three independent failures stacked

### Failure 1: Nesting depth cap killed the vision-checkers (swarm 2, first attempt)

The `cf7a39a8` acceptance-reviewer (which wrote the final `analyze.md`)
dispatched 4 vision-checkers. **ALL 4 FAILED**:

> `Nested subagent call blocked (depth=1, max=1). You are running at the
> maximum subagent nesting depth.`

At that time `maxSubagentDepth` was still 1. The acceptance-reviewer was at
depth 1, so its children (vision-checkers) couldn't spawn at depth 2. The
orchestrator received only "failed" status for all 4 — **it never got any
vision data at all.**

The orchestrator's own log: *"All four vision-checker subagents failed.
I cannot dispatch vision-checks from my nesting level. Let me report this
and adapt."*

### Failure 2: The orchestrator compensated by asking the supervisor — and got hallucinated vision

Unable to run its own vision-checkers, the orchestrator messaged the
supervisor (the parent agent — me, an earlier session) asking for vision
reports. The supervisor dispatched parent-level vision-checkers
(`a71a9a1d`, `d79cb664`, `6afe2462`) which DID run successfully.

But their reports hallucinated the arrow's position:

| Run | Screenshot | What it reported | Reality |
|-----|-----------|------------------|---------|
| a71a9a1d | analyze-brilliant-ply19.png | "a thick purple arrow is drawn on the board, from f7 toward d5" | arrow was in nav area (y:28-248) |
| d79cb664 | analyze-complete-ply21.png | "purple arrow from c6 to e5 (last move indicator)" | arrow bled across page |
| 6afe2462 | analyze-e4-inaccuracy-ply1.png | (didn't mention arrow position — focused on badge) | arrow bled into move list (65 px) |

The supervisor relayed these to the orchestrator as:

> *"No other visual glitches — layout clean, no overlapping."*

The orchestrator then wrote `analyze.md` with: *"best-move arrows render
on the board"* — **basing its visual verdict entirely on hallucinated
vision reports it didn't know were hallucinated.**

### Failure 3: The vision-checker prompt doesn't ask the right question

The `vision-checker.md` agent def asks:

> *"Are there any arrows drawn on the board? What color/direction?"*

This is a **leading question** — it assumes the arrow IS on the board. The
model sees indigo pixels somewhere, assumes they're the board arrow,
invents plausible from/to squares ("f7 toward d5", "c6 to e5"), and reports
"no glitches." It never asks: *"Is any visual element drawn OUTSIDE the
area where it belongs?"*

When I re-ran vision-checkers today with an explicit prompt — *"is there
any arrow drawn somewhere OTHER than the chess board?"* — the results
split:

| Run | Screenshot | Prompt | Found bleed? |
|-----|-----------|--------|-------------|
| baba109f | analyze-scrub-ply6.png | explicit "outside the board?" | **YES** — "large purple arrow from nav bar to move list" |
| bd748da2 | analyze-scrub-ply6.png | default | **YES** — "BLOCKER: Arrow originates from navigation tab" |
| 4c0b960c | analyze-brilliant-ply19.png | explicit "exactly where?" | **NO** — "correctly drawn ON the board, e5 to d4" (hallucination) |
| 309b7ab8 | swarm3/05-analyze-ply19.png | explicit | **NO** — "entirely contained WITHIN the board" (hallucination) |

**Same model, same screenshot, contradictory results.** The vision model
is unreliable for spatial-positioning verification — it sometimes catches
the bleed, sometimes hallucinates it away. The default prompt biases
toward "the arrow is on the board."

## The deeper pattern: DOM-only review can't catch spatial bugs

The orchestrator's DOM probe checked `arrowCount` (number of SVG children)
and reported "arrows render." But it never checked:

```js
const arrowSvg = document.querySelector('[data-testid="board-arrows"]')
const board = document.querySelector('[data-testid="chess-board"]')
arrowSvg.getBoundingClientRect()  // {x:0, y:0, width:1280, height:900} ← FULL VIEWPORT
board.getBoundingClientRect()      // {x:104, y:327, width:560, height:560}
// No comparison. No "is the SVG inside the board?" check.
```

A 3-line DOM cross-check would have caught this instantly. But the
orchestrator treated "SVG exists and has children" as "arrows render
correctly" — a **presence check masquerading as a correctness check**.

This is the same failure mode as F24 (visual review blindness): the
reviewer confirms the element exists but never verifies it's in the
right place / the right color / actually visible.

## Why this matters for the harness

The swarm has **three layers of defense** against visual bugs, and all
three failed independently:

1. **Vision-checkers** — hallucinated arrow position (prompt bias +
   model unreliability)
2. **Orchestrator DOM probes** — checked presence, not spatial
   correctness
3. **Supervisor relay** — passed along hallucinated reports without
   independent verification

Any ONE of these catching the bug would have surfaced it. The bug survived
because all three had the same blind spot: **they all checked "does an
arrow exist?" and none checked "is the arrow where it should be?"**

## Required harness fixes

### Fix A: Vision-checker prompt must ask about spatial displacement explicitly

Current (leading question):
> "Are there any arrows drawn on the board? What color/direction?"

Required (neutral + adversarial):
> "For EACH arrow, line, or marking you see in the image: specify EXACTLY
> which region it appears in (on the chess board, on the move list panel,
> on the navigation bar, overlapping multiple regions). An arrow that
> belongs on the board but appears anywhere else is a BLOCKER. Do not
> assume an arrow is on the board just because you see indigo pixels —
> verify its position against the board's visible grid."

### Fix B: Orchestrator DOM probes must verify spatial containment, not just presence

For every visual element, the DOM probe should check:
```js
const el = document.querySelector(selector)
const container = document.querySelector(parentSelector)
const elRect = el.getBoundingClientRect()
const containerRect = container.getBoundingClientRect()
const isContained =
  elRect.x >= containerRect.x &&
  elRect.y >= containerRect.y &&
  elRect.right <= containerRect.right &&
  elRect.bottom <= containerRect.bottom
// Report isContained = false as a BLOCKER
```

This is a text/DOM task — the orchestrator (GLM-5.2) can do this
reliably. It doesn't need vision.

### Fix C: Orchestrator must not write a visual verdict when vision-checkers fail

When `cf7a39a8` got 4/4 vision-checker failures, it should have STOPPED
and reported "vision verification unavailable — cannot provide visual
verdict." Instead it adapted by asking the supervisor, got
hallucinated data, and wrote a confident "arrows render on the board"
verdict. The acceptance contract must require: **no visual verdict
without successful vision confirmation.**

### Fix D: Multi-screenshot consistency check

The orchestrator took screenshots at plies 3, 6, 9, 11, 19, 21. The arrow
was in a different (wrong) position in each. A consistency check — "does
the arrow appear in the same relative board region across plies?" —
would flag the chaotic displacement. Currently each screenshot is
reviewed in isolation with no cross-screenshot reasoning.

## Summary

The arrow bleed bug survived because:

1. **Depth cap** killed the first wave of vision-checkers (mechanical failure)
2. **Supervisor relay** passed along hallucinated vision reports (the
   vision model said "on the board" when it wasn't)
3. **Leading prompt** biased the vision model toward assuming arrows are
   on the board
4. **DOM presence-check** confirmed the SVG exists but never verified
   spatial containment
5. **No cross-screenshot reasoning** — each screenshot reviewed in
   isolation, missing the chaotic displacement pattern

The vision model is unreliable for spatial verification. The harness must
not treat vision-checker "no glitch" reports as ground truth — and must
use DOM spatial-containment checks (which the text orchestrator CAN do
reliably) as the primary spatial-correctness gate, with vision as
subjective confirmation only.
