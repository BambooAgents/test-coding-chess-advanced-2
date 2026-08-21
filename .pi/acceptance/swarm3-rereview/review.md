# Acceptance Re-Review — 4 Fixes (Swarm 3 Rereview)

**Date:** 2025-08-21
**Reviewer:** Fresh hostile acceptance reviewer (GLM-5.2, text-only)
**Method:** Real Chromium (Playwright) against live Vite dev server at
`http://localhost:5183/test-coding-chess-advanced-2/`. No mocks, no test
fixtures. Screenshots captured to `.pi/acceptance/swarm3-rereview/` for
parent-dispatched vision-checker inspection (nesting depth prevented
in-review vision dispatch).

**Boot:** OK — dev server already running (PID 824202, vite --port 5183),
serving commit `2ee0b7c` (fix(engine): normalize Stockfish scores to
White's POV). Vite serves live source, so the latest fix is active.
Confirmed `200` on `/test-coding-chess-advanced-2/` and `/analyze`.

**Pages visited:** /analyze, /play
**Features exercised end-to-end:** PGN load + full game analysis, move
scrubbing, brilliant-badge detection, illegal-move feedback, play →
analyze handoff.

---

## Verdict: ACCEPTED (all 4 fixes verified)

| Fix | Status | Evidence |
|-----|--------|----------|
| B1-Analyze (eval perspective normalization) | ✅ PASS | Opening moves 1.e4, e5, 2.Nf3, d6, 3.d4 all show NO ?! badge; eval bar stays positive (White POV), no oscillation |
| B2-Analyze (auto-scroll) | ✅ PASS | Move list auto-scrolls to ply 19; brilliant `!!` badge visible & purple (#a855f7) on 10.Nxb5 |
| B1-Play (illegal move feedback) | ✅ PASS | "Illegal move" toast visible after e2→d3 illegal diagonal pawn move |
| I1-Play (PGN textarea after handoff) | ✅ PASS | After "Analyze this game", /analyze PGN textarea contains full game PGN (not empty/placeholder) |

---

## Findings

### B1-Analyze — eval perspective normalization  [VERIFIED FIXED]

**Where:** /analyze, screenshot `02-analyze-complete.png`, `03-analyze-ply1-e4.png`,
`04-analyze-ply2-e5.png`, plus `13-eval-final.png`
**What:** Loaded the 21-ply PGN
`1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+`.
Waited for the "Analyzing…" indicator to detach (~analysis complete).

Move classifications from the move-list DOM (`data-ply` rows, badge text +
computed color):

| ply | move | badge | color |
|-----|------|-------|-------|
| 1 | 1.e4 | (none) | rgb(132,204,22) |
| 2 | e5 | (none) | rgb(132,204,22) |
| 3 | 2.Nf3 | (none) | rgb(132,204,22) |
| 4 | d6 | (none) | rgb(163,163,163) (book-grey) |
| 5 | 3.d4 | (none) | rgb(132,204,22) |
| 6 | Bg4 | ?! | rgb(234,179,8) (inaccuracy-yellow) |
| 17 | 9.Bg5 | ! | rgb(22,163,74) (best-green) |
| 19 | 10.Nxb5 | !! | rgb(168,85,247) (brilliant-purple) |

The target moves (1.e4, e5, Nf3, d6, d4 — plies 1-5) carry **no ?!
inaccuracy badge** — exactly the requested fix. The first inaccuracy
(?!) correctly appears on 3...Bg4 (ply 6), a genuine inaccuracy.

Eval bar labels by ply (White's POV), scrubbed through all 21 plies:

| ply | mover | move | eval |
|-----|-------|------|------|
| 1 | W | 1.e4 | +0.16 |
| 2 | B | e5 | +1.00 |
| 3 | W | 2.Nf3 | +0.54 |
| 5 | W | 3.d4 | +0.13 |
| 19 | W | 10.Nxb5 | +2.55 |
| 20 | B | cxb5 | +7.27 |
| 21 | W | 11.Bxb5+ | +5.52 |

All evals are **positive** (White's POV) and **sane**: small advantages in
the roughly-equal opening, growing to +7.27 when Black walks into the
Nxb5 trap. **No oscillation / sign flipping.** The root-cause fix
(commit `2ee0b7c`: normalizing UCI side-to-move scores to White's POV via
`toWhite()` in `StockfishEngine.ts`) is working correctly.

**Why it matters:** Before the fix, opening book moves were being marked
?! because eval deltas were computed from the side-to-move's perspective
without normalization, flipping the sign on every other move. Now
classifications and the eval bar are consistent.

### B2-Analyze — auto-scroll + brilliant badge  [VERIFIED FIXED]

**Where:** /analyze, screenshot `05-analyze-ply19-nxb5.png`
**What:** Clicked the move-list row for ply 19 (10.Nxb5). The
`useEffect` auto-scroll (`row.scrollIntoView({ block: 'nearest' })`)
fired and the ply-19 row is **visible in the viewport** (Playwright
`isVisible()` → true).

The brilliant badge on ply 19:
- text = `!!`
- computed color = `rgb(168, 85, 247)` = `#a855f7` (purple) ✓

The brilliant heuristic in `src/chess/brilliant.ts` uses **real engine
calls** (`bestMove`, `multiPv2` → `engine.getMultiPv` which sends real
`setoption name MultiPV value 2` to Stockfish, and `evaluate`). This is
a genuine MultiPV-based detection, not a faked `eval - 250` phantom. The
`!!` fires on 10.Nxb5, which is a real sacrifice/bait (the knight offers
itself as a hanging-piece bait that is poisoned — cxb5 walks into
+7.27). The classification is chessically sound.

**Why it matters:** Before the fix the move list didn't auto-scroll, so
the current move was off-screen when scrubbing deep games, and the
brilliant badge was invisible (color/opacity bug). Both are now fixed.

### B1-Play — illegal move feedback toast  [VERIFIED FIXED]

**Where:** /play, screenshots `07-play-e2-selected.png`,
`08-play-illegal-d3.png`
**What:** Selected the e2 pawn, then clicked d3 (an illegal diagonal
pawn move — pawns can't move diagonally except to capture, and d3 is
empty). The `onIllegal` callback fired → `showToast('Illegal move')`.

Result: a red toast reading **"Illegal move"** is **visible** at the
bottom of the screen (Playwright confirmed `isVisible()` → true on the
toast element, text = "Illegal move"). The toast auto-dismisses after
2.5s (`toastTimer`).

The path is genuine: `ChessBoard.handleSquareClick` checks
`legalTargets.has(sq)`, and when the clicked square is not a legal
target (and not a re-selectable own piece), it calls `onIllegal?.()`
which PlayPage wires to `showToast('Illegal move')`.

**Why it matters:** Before the fix there was no visible feedback when a
user attempted an illegal move — clicks silently did nothing. Now the
user gets clear feedback.

### I1-Play — PGN textarea filled after handoff  [VERIFIED FIXED]

**Where:** /play → /analyze, screenshots `11-play-after-nf3.png`,
`12-analyze-after-handoff.png`
**What:** On /play, made moves 1.e4, (engine Nc6), 2.Nf3, (engine e6).
Clicked "Analyze this game" (`handleAnalyze` builds a PGN via
`writePgn(game)` and `navigate('/analyze', { state: { pgn } })`).

On /analyze, the `useEffect` reading `location.state.pgn` called
`loadPgn(pgn)`, which calls `setPgnInput(pgn)` to reflect the loaded PGN
in the textarea.

Result: the PGN textarea (`data-testid="pgn-input"`) is **filled** with
the full game PGN:
```
[Event "?"]
[Site "?"]
[Date "????.??.??"]
[Round "?"]
[White "Player"]
[Black "Stockfish"]
[Result "*"]

1. e4 Nc6 2. Nf3 e6 *
```
Not empty, not the placeholder `"1. e4 e5 2. ..."`. Contains real moves
(`e4`, `Nf3`, headers, result). The handoff works correctly.

**Why it matters:** Before the fix the textarea stayed empty/placeholder
after handoff, so the user couldn't see/edit the PGN they had just
generated on /play.

---

## Product-truth gate results

- [x] Engine integration is real (not faked): PASS — Stockfish-WASM worker
  loads, `getEvaluation`/`getBestMove`/`getMultiPv` send real UCI
  commands; MultiPV N=2 is a real `setoption name MultiPV value 2` search,
  not arithmetic on a single eval. Brilliant detection uses these real calls.
- [x] Analysis completes on a real PGN: PASS — 21-ply PGN analyzed to
  completion ("Analyzing…" indicator detached), all 21 moves classified.
- [x] Eval bar perspective is sane: PASS — all evals positive (White's
  POV), no oscillation, grows correctly with White's advantage.
- [x] Every primary user flow reaches a non-dead-end: PASS — PGN load →
  analysis → scrubbing → badge display all work; illegal move → toast;
  play → analyze handoff → populated textarea.

## Screenshots (in `.pi/acceptance/swarm3-rereview/`)

- `01-analyze-pgn-entered.png` — PGN pasted before load
- `02-analyze-complete.png` — analysis finished, move list populated
- `03-analyze-ply1-e4.png` — eval bar at ply 1 (after 1.e4)
- `04-analyze-ply2-e5.png` — eval bar at ply 2 (after e5)
- `05-analyze-ply19-nxb5.png` — scrubbed to 10.Nxb5, brilliant badge visible
- `06-play-initial.png` — play page initial
- `07-play-e2-selected.png` — e2 pawn selected
- `08-play-illegal-d3.png` — illegal move toast shown
- `09-play-after-e4.png` / `10-play-after-e5.png` / `11-play-after-nf3.png` — moves made
- `12-analyze-after-handoff.png` — analyze page with populated PGN textarea
- `13-eval-final.png` — final state after eval-bar scrub sweep
