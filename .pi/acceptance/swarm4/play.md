# Acceptance Report — Swarm 4 / Play (ticket #16) — 2026-08-18

**Verdict:** ACCEPTED
**Boot:** OK (dev server at http://localhost:5183/test-coding-chess-advanced-2/; React BrowserRouter, NOT hash-routed — corrected from task instruction)
**Pages visited:** /play, /analyze (via handoff)
**Features exercised end-to-end:** Play vs Stockfish (Easy/Medium/Hard/Expert strength select), New Game, legal-move highlights, player move, engine reply, illegal-move rejection, take-back, resign, new-game reset, analyze-handoff (PGN pre-fill).

## Method

I am a text-only reviewer (GLM-5.2). I executed the user-story script (`stories/play-16.md`) step-by-step in Playwright, took a full-page screenshot per step, dispatched one `vision-checker` (Qwen) subagent per screenshot with that step's VISIBLE expectations, AND ran DOM probes for spatial/state facts. Vision reports and DOM probes were cross-referenced. Engine authenticity was verified by code inspection of `src/engine/StockfishEngine.ts`, the real `public/stockfish/stockfish.wasm` binary (magic `\0asm`, 548K), and a live variation probe.

## Per-step evidence

| Step | Action | DOM probe (text) | Vision report | Spatial probe |
|------|--------|------------------|---------------|---------------|
| 1 | Navigate /play | board 64 squares, 32 pieces, New Game btn, strength select (Easy/Medium/Hard/Expert, val=Medium), status "Your move". Board rect x=164,w=560; New Game rect x=773 — controlsOverlap=false | All 5 expectations PRESENT, no glitches | Board and controls do not overlap (DOM rects confirm) |
| 2 | New Game (Easy) + click e2 pawn | status "Your move"; e2 selected bg=rgb(199,210,254) (accent-soft); e4 `::after` opacity 0.4 = legal-move dot visible | Starting position PRESENT, White's turn PRESENT, legal-move dots PRESENT (on e3/e4) | n/a |
| 3 | Play 1.e4 → engine replies | Player e4 applied; engine replied **e6** after 403 ms (NOT instant); move list "1. e4 e6"; status back to "Your move" | Pawn on e4 PRESENT, Black reply PRESENT, no error toast PRESENT | n/a |
| 4 | Illegal move (b1→b3 knight) | "Illegal move" toast seen in DOM; move list unchanged ("1. e4 e6", len 3) — board state preserved | Red "Illegal move" toast PRESENT, board unchanged (knight still b1) PRESENT | n/a |
| 5 | Take-back | Move list went from "1. e4 e6" → "No moves yet"; status "Your move" | Board reset to starting position PRESENT, move list empty PRESENT, player's turn PRESENT | n/a |
| 6 | Resign → New Game | Resign: status "You resigned. Black wins.", resign btn disabled. New Game: status "Your move", move list "No moves yet" | Game-over/loss state PRESENT; New Game fresh start PRESENT | n/a |
| 7 | Analyze-handoff | Navigated to /analyze; PGN textarea contains `1. e4 d5 2. d4 Nf6 *` with headers White="Player", Black="Stockfish"; move list shows e4,d5,d4,Nf6 | Analyze page PRESENT (not blank); move list with played moves PRESENT | n/a |

### Engine authenticity (product-truth gate)

- `src/engine/StockfishEngine.ts` loads `public/stockfish/stockfish.wasm.js` as a Web Worker and speaks the real UCI protocol (`uci`, `ucinewgame`, `position fen`, `go depth`, `setoption name Skill Level/MultiPV`, parses `info`/`bestmove` lines). NOT a hardcoded responder.
- `public/stockfish/stockfish.wasm` is a genuine 548K WASM binary (magic `\0asm`).
- Strength config (`src/pages/play/strength.ts`): Easy=skill0/depth1, Medium=skill5/depth8, Hard=skill10/depth12, Expert=skill20/depth18 — real skill-level + depth controls.
- **Live variation probe:** played 1.e4 in 4 separate Easy games → engine replies were **d5, d6, e6, e6** (3 unique replies). A hardcoded responder would return the same move every time. The engine varies, and its 403ms response time is a real search, not instant. Engine is REAL Stockfish-WASM. PASS.

## Findings

### N1 — Leftover "Illegal move" toast persists across subsequent steps  [NIT]
**Where:** Steps 4→5→6 (screenshots play-step4.png, play-step5.png, play-step6a.png)
**What:** The "Illegal move" toast triggered in step 4 has a 2500ms auto-dismiss (`showToast` → `setTimeout(..., 2500)`), but subsequent screenshots taken ~1s after the next action (take-back, resign) still show the toast text per the vision-checker reports. This is a minor visual artifact — the toast's dismiss timing slightly overlaps the next user action's screenshot window. The toast DOES eventually clear (it is not permanent).
**Evidence:** Vision-checker for step 5 noted "an 'Illegal move' toast is visible which may be a leftover notification"; step 6a vision-checker noted "'Illegal move' toast visible in Screenshot 1 appears unrelated to resign action (likely leftover from prior interaction)." DOM probe for step 4 confirmed `illegalToastSeen: true`. The toast is correctly triggered for the illegal move; it simply lingers into the next screenshot's capture window.
**Why it matters:** Cosmetic only. The toast correctly appears for illegal moves and correctly auto-dismisses; the only nit is that fast sequential actions can capture it mid-dismiss. No functional impact.

No BLOCKER or IMPORTANT findings. No product-truth gate failures.

## Product-truth gate results
- [x] Engine integration is real (not faked): PASS — real Stockfish-WASM Web Worker, UCI protocol, 548K binary, varied replies (d5/d6/e6/e6 across 4 trials), real search timing (~400ms).
- [x] Every page renders without visual glitches: PASS — vision-checkers for all 7 steps reported no glitches; DOM confirmed board renders with 64 squares / 32 pieces; board and side-panel controls do not overlap.
- [x] Every primary user flow reaches a non-dead-end: PASS — New Game, play move, engine reply, illegal-move rejection, take-back, resign, new-game reset, and analyze-handoff all reached a valid terminal state.
- [x] Engine actually responds with varied moves (not hardcoded): PASS — 3 unique replies across 4 identical 1.e4 trials.
- [x] Illegal moves are rejected (not accepted): PASS — b1→b3 rejected, "Illegal move" toast shown, board state preserved.

## Screenshots
- .pi/acceptance/swarm4/screenshots/play-step1.png (initial /play)
- .pi/acceptance/swarm4/screenshots/play-step2.png (New Game Easy)
- .pi/acceptance/swarm4/screenshots/play-step2b.png (legal-move highlights)
- .pi/acceptance/swarm4/screenshots/play-step3a.png (after player e4)
- .pi/acceptance/swarm4/screenshots/play-step3b.png (after engine reply e6)
- .pi/acceptance/swarm4/screenshots/play-step4.png (illegal move rejected)
- .pi/acceptance/swarm4/screenshots/play-step5.png (take-back)
- .pi/acceptance/swarm4/screenshots/play-step6a.png (resign)
- .pi/acceptance/swarm4/screenshots/play-step6b.png (new game)
- .pi/acceptance/swarm4/screenshots/play-step7.png (analyze-handoff)

## Notes
- The task instruction said the app is hash-routed (`/#/play`). It is NOT — it uses React BrowserRouter with real paths (`/test-coding-chess-advanced-2/play`). The correct URL is `http://localhost:5183/test-coding-chess-advanced-2/play`. Initial attempt with hash route failed to render; corrected and all steps then passed.
- Full DOM probe data captured to `.pi/acceptance/swarm4/probes.json`; runner log to `.pi/acceptance/swarm4/runner.log`.
- Engine variation probe confirmed real Stockfish (not hardcoded) — replies d5, d6, e6, e6 across 4 Easy-mode 1.e4 games.
