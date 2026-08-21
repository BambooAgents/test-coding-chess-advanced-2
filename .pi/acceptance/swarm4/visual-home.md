# Acceptance Report — Visual / Home (swarm 4) — 2026-08-21

**Reviewer:** acceptance-reviewer (GLM-5.2, text-only) + vision-checker (Qwen3.5) subagents + DOM containment probes.
**Story:** `.pi/acceptance/swarm4/stories/visual-home.md` — cross-cutting visual shell (nav, routing, no element bleeding across the page), with the critical arrow-bleed regression check.

**Verdict:** ACCEPTED
**Boot:** OK — dev server already running at http://localhost:5183/test-coding-chess-advanced-2/ (HTTP 200). Stockfish-WASM present in `public/stockfish/` and confirmed to load + complete a real analysis in-browser.
**Pages visited:** `/` (Home), `/play`, `/analyze`, `/puzzles`, `/weaknesses`
**Features exercised end-to-end:** nav rendering, hash→path routing via NavLink, active-route highlighting, PGN load, Stockfish analysis run-to-completion (badges + eval bar + accuracy), board best-move arrow, eval bar, move list with classification badges, invalid-PGN error, play-page overlay scan.

> NOTE on routing: the task description said the app is "hash-routed (`#/play`)", but the app actually uses **BrowserRouter (path-based)** routing (`react-router-dom` `BrowserRouter` with `basename`). Navigating to `#/analyze` leaves the app on Home. All testing was therefore performed by clicking the real nav links (the genuine user action), which is what the user-story script step 2 actually specifies.

## Method (per acceptance-reviewer contract)
- I am text-only (GLM-5.2). I never read a screenshot. For every visual step I (a) drove Playwright, (b) took a full-page screenshot, (c) dispatched a `vision-checker` subagent with that step's VISIBLE expectations, and (d) ran a `getBoundingClientRect` DOM containment probe for every SPATIAL line. A step passes only when vision confirms appearance AND the DOM probe confirms containment.
- Each screenshot got its own fresh vision-checker subagent (1 image each) to avoid the 4-image cap.
- Vision transcripts are truncated to ~1067 chars in the stored result; the per-step verdicts below quote the captured vision-checker output and are cross-referenced against the DOM probes (which are authoritative for spatial claims).

## Per-step evidence

### Step 1 — Home page  ✅ PASS
- **Action:** navigated to `/`.
- **Vision (visual-step1.png):** "Home/landing page renders correctly with all expected navigation links, proper active state highlighting, and no visible glitches… Nav links visible: Home, Play, Analyze, Puzzles, My Weaknesses (all 5 expected links present). Active state: Home link has a light/white background highlight… No overlapping, clipped… elements."
- **DOM probe (step1-nav):** `nav` exists; header rect (0,0,1400×70), main rect (100,70,1200×854), `mainHasContent: true`. All 5 links present with correct hrefs; Home `active: true`, others `active: false`. ✓
- **Expectation check:** nav links PRESENT, no broken images/overlap/clipping PRESENT (vision: no glitches), active highlight for current route PRESENT. ✓

### Step 2 — Nav routing  ✅ PASS
- **Action:** clicked each nav link in turn (Play, Analyze, Puzzles, My Weaknesses).
- **Vision (visual-step2-1-Play … visual-step2-4-MyWeaknesses):**
  - Play: "Play page renders correctly… Play (active/highlighted in light purple)… no overlapping or clipped elements."
  - Analyze: "Analyze page rendered correctly… 'Analyze' has a light/white background highlight… no overlapping or clipped elements."
  - Puzzles: "Puzzles page fully rendered… 'Puzzles' highlighted with light blue/white background indicating active state."
  - My Weaknesses: "My Weaknesses page fully rendered with proper navigation highlighting… No overlapping, clipped, or cut-off elements."
- **DOM probe (step2-routing):** each click navigated to the correct route with the active link set: Play→`/play`, Analyze→`/analyze`, Puzzles→`/puzzles`, My Weaknesses→`/weaknesses`. No blank pages (bodyLen > 0 for all). ✓
- **Expectation check:** each click navigates (URL changes) PRESENT, active highlight follows the current page PRESENT, no blank/broken page PRESENT. ✓

### Step 3 — No element bleeds across the page (CRITICAL arrow-bleed check)  ✅ PASS
- **Action:** on /analyze, loaded a 35-half-move Ruy Lopez PGN, ran analysis, scrubbed to ply 1 (1.e4) so the best-move arrow renders.
- **Vision (visual-step3-arrow.png):** "A purple/indigo best-move arrow is visible on the board showing the e2→e4 pawn move… No overlapping, clipped, or off-screen elements detected." Arrow reported ON the board only.
- **DOM containment probe (step3-arrow-containment) — THE CRITICAL ONE:**
  - `board-arrows` SVG rect: `{x:164, y:365, w:560, h:560, right:724, bottom:925}`
  - `chess-board` rect:   `{x:164, y:365, w:560, h:560, right:724, bottom:925}`
  - **`contained: true`** — the SVG is exactly coextensive with the board, fully contained.
- **Viewport-overlay probe (step3-viewport-overlays):** only ONE `<svg>` on the page (`data-testid="board-arrows"`); `spansFullViewport: false`; `anyFullViewportSvg: false`. No SVG/overlay spans the full viewport.
- **Expectation check:** arrow ON the board only — PRESENT (vision + DOM `contained:true`). Arrow does NOT extend into nav/move-list/background — PRESENT (no full-viewport SVG). **The arrow-bleed bug is FIXED** (`BoardGrid` has `position: relative`, constraining the absolute `inset:0` arrow SVG to the board). ✓

### Step 4 — Eval bar containment  ✅ PASS
- **Action:** on /analyze with a loaded game.
- **Vision (visual-step4-evalbar.png):** "eval bar visible and functional… eval bar visible on left edge of board (partially filled, mostly white)… no overlapping, clipped, or cut-off elements."
- **DOM probe (step4-evalbar-containment):** eval bar rect `{x:132, y:365, w:24, h:560, right:156}`; board rect `{x:164, y:365, w:560}`; `adjacentLeft: true` (eb.right 156 ≈ board.x 164, gap 8px), `adjacent: true`. Eval fill child height = 313.69px out of 560 (proportional fill, not stuck at 0/empty). The eval bar extends slightly below the 900px viewport because the full page is taller than the viewport (scrollable page), but it is horizontally within the page and immediately adjacent to the board — no bleed.
- **Expectation check:** thin vertical bar beside the board PRESENT, fills proportionally PRESENT, adjacent to board's column PRESENT. ✓

### Step 5 — Move list containment  ✅ PASS
- **Action:** on /analyze with a loaded + analyzed game; scrolled the move list to move 14 (ply 27) so classification badges are in the visible scroll frame.
- **Vision (visual-step5-movelist-badges.png):** "Move list panel displays classification badges correctly… No overlapping, clipped, or cut-off elements visible… Nothing appears off-screen or overflowing… Purple arrow overlay on board from b2→b4 (correctly positioned on the board grid)."
- **DOM probe (step5-badges-visible):** move-list rect `{x:736, y:338, w:280, h:360, right:1016}`, board rect `{x:164, y:296, w:560, right:724}`. `overlapBoard: false` (move list is right of the board, no overlap). 7 visible badges (glyphs `?!`, `??`), all `inColumn: true` (x within 736–1016) and all within the move-list y-range (338–698). Move list is a proper scroll container (`overflow-y: auto`, `max-height: 360px`).
- **Style probe (step5-movelist-style):** `overflow-y: auto`, `max-height: 360px`; 35 move rows; `overlapBoardX: false`; `badgesInColumn: true`.
- **Expectation check:** move list in right-side panel PRESENT, badges next to moves inside the panel PRESENT, no badge/move overlaps the board or spills outside the panel PRESENT. (The earlier ply-1 screenshot showed no badges only because the classified moves 9–15 were below the visible scroll frame — a scroll position, not a defect; the badges-visible screenshot confirms badges render correctly.) ✓

### Step 6 — Toasts / overlays stay in viewport  ✅ PASS
- **Action:** entered an invalid PGN ("invalid pgn garbage 1. z9 z9") and clicked "Load PGN" on /analyze.
- **Vision (visual-step6-error.png):** "Error text visible: 'No moves found in PGN.' appears directly below the 'Load PGN' button. Format: inline text, NOT a toast/popup. No overlapping or clipped elements visible. Everything fits within viewport."
- **DOM probe (step6-error-containment):** error element rect `{x:132, y:261, w:1136, h:21}`, text "No moves found in PGN.", `withinViewport: true`. Inline alert (`role="alert"`), not a full-page overlay.
- **Play-page overlay scan (step6b-play-overlays):** `fixedCount: 0` — no full-viewport fixed overlays/modals on the Play page.
- **Vision (visual-step6b-play.png):** "Play page renders correctly showing a new game vs computer in initial position with no overlays, modals, or toasts covering the page."
- **Expectation check:** error/toast appears within viewport near the relevant area PRESENT, does not cover the whole page or render off-screen PRESENT. ✓

## Findings

### (none)

No BLOCKER, IMPORTANT, or NIT findings. All six script steps pass: vision confirms the expected appearance for each step, and the DOM containment probes confirm every spatial expectation (arrow contained in board, eval bar adjacent to board, move list right of board with badges in-column, error within viewport, no full-viewport overlays).

## Product-truth gate results
- [x] Puzzle data is real (not synthetic): N/A for this story (visual-home does not exercise puzzle data). NOT_RUN — no puzzle data touched by this script.
- [x] Engine integration is real (not faked): PASS — Stockfish-WASM (`public/stockfish/stockfish.wasm.js` + `stockfish.wasm`) loaded as a Web Worker; analysis ran on a real 35-half-move Ruy Lopez PGN and completed with real classification badges (?!, ??), a proportionally-filled eval bar (313/560px), and accuracy ("White accuracy: 83.6%"). Not a hardcoded/stub result.
- [x] Analysis completes on a real PGN: PASS — analysis finished within the 90s budget; the "Analyzing…" indicator cleared and badges/eval/accuracy populated.
- [x] Every page renders without visual glitches: PASS — vision confirmed no overlapping, clipped, or off-screen elements on Home, Play, Analyze, Puzzles, My Weaknesses.
- [x] Every primary user flow reaches a non-dead-end: PASS — nav routing reaches all 5 pages; PGN load → analysis → scrub → arrow/badges/eval all functional; invalid PGN shows a recoverable inline error.

## Screenshots (swarm 4)
- .pi/acceptance/swarm4/screenshots/visual-step1.png
- .pi/acceptance/swarm4/screenshots/visual-step2-1-Play.png
- .pi/acceptance/swarm4/screenshots/visual-step2-2-Analyze.png
- .pi/acceptance/swarm4/screenshots/visual-step2-3-Puzzles.png
- .pi/acceptance/swarm4/screenshots/visual-step2-4-MyWeaknesses.png
- .pi/acceptance/swarm4/screenshots/visual-step3-arrow.png  (CRITICAL: arrow contained in board)
- .pi/acceptance/swarm4/screenshots/visual-step4-evalbar.png
- .pi/acceptance/swarm4/screenshots/visual-step5-movelist-badges.png
- .pi/acceptance/swarm4/screenshots/visual-step6-error.png
- .pi/acceptance/swarm4/screenshots/visual-step6b-play.png

## DOM probe artifacts
- .pi/acceptance/swarm4/probes/step1-nav.json
- .pi/acceptance/swarm4/probes/step2-routing.json
- .pi/acceptance/swarm4/probes/step3-arrow-containment.json  (contained: true)
- .pi/acceptance/swarm4/probes/step3-viewport-overlays.json  (anyFullViewportSvg: false)
- .pi/acceptance/swarm4/probes/step4-evalbar-containment.json  (adjacent: true)
- .pi/acceptance/swarm4/probes/step5-badges-visible.json  (overlapBoard: false, 7 badges in-column)
- .pi/acceptance/swarm4/probes/step5-movelist-style.json  (overflow-y: auto)
- .pi/acceptance/swarm4/probes/step6-error-containment.json  (withinViewport: true)
- .pi/acceptance/swarm4/probes/step6b-play-overlays.json  (fixedCount: 0)
