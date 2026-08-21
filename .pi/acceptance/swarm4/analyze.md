# Acceptance Report — 2026-08-18 (swarm 4, analyze tickets #14/#15)

**Verdict:** ACCEPTED
**Boot:** OK — dev server already running at http://localhost:5183/test-coding-chess-advanced-2/ (HTTP 200). Real Vite dev server, no mocks. Stockfish WASM served at `/stockfish/stockfish.wasm.js` (HTTP 200); engine loaded in-browser (analysis completed with sane accuracy, see step 2).
**Pages visited:** Home → Analyze
**Features exercised end-to-end:** PGN load → analysis run to completion → scrub to ply 1 (1.e4) → scrub to ply 19 (10.Nxb5)

## Method

For each step of the user-story script (`.pi/acceptance/swarm4/stories/analyze-14-15.md`):
1. Performed the user action via Playwright (chromium headless, 1440×900).
2. Screenshot → `.pi/acceptance/swarm4/screenshots/analyze-step<N>.png`.
3. Dispatched ONE vision-checker subagent (Qwen3.5-397B, fresh context) with THIS step's VISIBLE/SPATIAL expectations, asking PRESENT/ABSENT/DIFFERENT per expectation.
4. Ran a DOM `getBoundingClientRect` containment probe for every SPATIAL line (the arrow SVG vs the board rect; the badge span vs the move-list rect).
5. Cross-referenced: a step passes only when vision confirms appearance AND DOM confirms containment.

DOM probe data saved to `.pi/acceptance/swarm4/dom-probes.json`.

## Per-step evidence

### Step 1 — Load the game
**Action:** Pasted the Opera Game PGN; clicked "Load PGN".
**Vision:** All 4 expectations PRESENT — board at standard start position (32 pieces on correct squares); move list populated (21 moves, counter 0/21, moves 1–7 visible); "Unknown opening" displayed; no error banner. Move list in right-side panel beside the board, no overlap.
**DOM probe:** `moveListExists: true`, `boardExists: true`, `rowCount: 21`, movesText = "1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+", `errorVisible: false`.
**SPATIAL (move list beside board):** move-list rect x:756 (right of board right-edge x:744) — confirmed beside board. PASS.
**Result:** PASS

### Step 2 — Analysis runs to completion
**Action:** Waited for analysis to finish (≤40s).
**Vision:** All 4 expectations PRESENT — eval bar filled with both white/black portions (not empty, not stuck); classification badges (?! yellow/gold) visible next to moves; accuracy display "White accuracy: 86.2% Black accuracy: 77.4%" visible; no "Analyzing…" indicator.
**DOM probe:** Progress signal confirmed during run ("Analyzing… 0/21" → "Analyzing… 19/21" over ~26s), then `analyzingVisible: false`, `accVisible: true`, accText = "White accuracy: 86.2%\nBlack accuracy: 77.4%". Badge glyphs captured: 3.Bg4 ?!, 4.Bxf3 ?!, 6.Nf6 ?!, 7.Qe7 ?!, 8.Nc3 ?!, 9.Bg5 !, 9...b5 ?!, 10.Nxb5 !!, 10...cxb5 ?. `evalBarExists: true`, evalBar rect x:152,y:327,w:24,h:560.
**Analysis completes on a real PGN:** PASS (21-ply real game finished in ~26s, not hung).
**Result:** PASS

### Step 3 — Scrub to ply 1 (1.e4)
**Action:** Clicked move 1 row (`[data-ply="1"]`).
**Vision:** Arrow PRESENT on board grid (e2→e4), correct region (ON the 8x8 board grid, not nav/move-list/input). 1.e4 has no inaccuracy/?!/?/?? badge (PRESENT — correct). **Eval bar reported DIFFERENT** — vision said "-0.18 (Black advantage)".
**DOM probe:** `svgPresent: true`. board rect {x:184,y:327,w:560,h:560,right:744,bottom:887}. svg rect {x:184,y:327,w:560,h:560,right:744,bottom:887}. **`svgContainedInBoard: true`** — arrow SVG exactly equals board rect, fully contained. Scrubber "1 / 21". row1Text "1. e4", row1BadgeText "" (no badge).
**Eval-bar follow-up probe:** the eval bar's text label reads **+0.16** (White advantage), NOT -0.18. The vision-checker's "-0.18 (Black advantage)" was a **hallucinated misread** of the "+0.16" label. DOM text label is authoritative: eval = +0.16, a small White advantage, matching the script's "~+0.2". Eval expectation SATISFIED.
**SPATIAL (arrow inside board):** `svgContainedInBoard: true` — PASS. This is the critical check the prior swarm missed; here it PASSES.
**Result:** PASS (arrow containment confirmed by DOM; eval "DIFFERENT" was a vision hallucination refuted by the DOM text label = +0.16).

### Step 4 — Scrub to ply 19 (10.Nxb5)
**Action:** Clicked move row `[data-ply="19"]`.
**Vision:** All 3 expectations PRESENT — purple BRILLIANT "!!" badge next to 10.Nxb5 in move list; move list auto-scrolled so move 10 is highlighted/centered and visible; indigo arrow correctly positioned ON the chess board 8x8 grid (d4→b5), no spatial displacement.
**DOM probe:** `svgPresent: true`. board rect {x:184,y:327,w:560,h:560,right:744,bottom:887}. svg rect {x:184,y:327,w:560,h:560,right:744,bottom:887}. **`svgContainedInBoard: true`**. move-list rect {x:756,y:369,w:280,h:360}. row19 rect {x:757,y:653,w:278,h:25}. **`badgeContainedInMoveList: true`**, **`row19VisibleInMoveListViewport: true`** (auto-scroll confirmed). row19Text "10. Nxb5 !!", row19BadgeText "!!".
**SPATIAL:** arrow SVG inside board rect — PASS. Brilliant badge span inside move-list rect — PASS.
**Result:** PASS

## Findings

No BLOCKER, IMPORTANT, or NIT findings. All script steps pass on both vision appearance and DOM containment.

## Note on the prior-swarm arrow-bleed regression

The prior swarm MISSED a critical arrow-bleed bug (arrows rendering across the page into the move list). This swarm specifically re-checked the spatial containment with a DOM `getBoundingClientRect` probe at both arrow-rendering steps (3 and 4). At both steps the `board-arrows` SVG bounding rect exactly equals the `chess-board` bounding rect (x:184, y:327, w:560, h:560), and `svgContainedInBoard === true`. The arrow-bleed bug is **fixed** — the arrow is contained inside the board, not bleeding into the nav/move-list/input regions.

## Product-truth gate results
- [x] Puzzle data is real (not synthetic): N/A — Analyze ticket #14/#15 does not ship puzzle data; the PGN input is the real Opera Game (a real 21-ply game), not a test fixture.
- [x] Engine integration is real (not faked): PASS — `StockfishEngine.getMultiPv` sends real `setoption name MultiPV value N` and parses real `info depth X multipv 1/2 ... score cp N ... pv ...` + `bestmove` UCI lines (`src/engine/StockfishEngine.ts:300-390`). `getBestMove` sends `go depth N`. stockfish.wasm.js served HTTP 200; analysis completed in-browser on the real PGN with sane accuracy (86.2%/77.4%).
- [x] Analysis completes on a real PGN: PASS — 21-ply Opera Game analyzed in ~26s with progress signal and accuracy percentages, not hung.
- [x] Every page renders without visual glitches: PASS (Analyze page, per the script). Vision reports no overlap/clipping/broken layout/illegible contrast on any step.
- [x] Every primary user flow reaches a non-dead-end: PASS — PGN load → analysis → scrub → badges/arrows/eval all reach a complete result; no dead-ends.
- [x] Annotations sane: PASS — 10.Nxb5 = BRILLIANT !! (the famous knight sac), 10...cxb5 = ? (taking the poisoned piece), 9.Bg5 = ! (the pin), 9...b5 = ?! (allowing the sac). Matches known human judgement for the Opera Game. 1.e4 has NO bad-move badge (correct — it is a top opening move).

## Screenshots
- .pi/acceptance/swarm4/screenshots/analyze-step1.png
- .pi/acceptance/swarm4/screenshots/analyze-step2.png
- .pi/acceptance/swarm4/screenshots/analyze-step3.png
- .pi/acceptance/swarm4/screenshots/analyze-step4.png

## Artifacts
- DOM probe data: .pi/acceptance/swarm4/dom-probes.json
- Playwright script: .pi/acceptance/swarm4/run.mjs
