# Consolidated Acceptance Findings — Swarm 2/3 Final

**Date:** 2026-08-21
**Method:** Hostile acceptance review swarm with two-tier vision architecture
(GLM-5.2 orchestrators + Qwen vision-checker subagents, 1 image per fresh conversation)

## Final Verdict: ACCEPTED

All 5 pages pass acceptance. All BLOCKERs and IMPORTANTs from the hostile
review swarm have been fixed and independently re-reviewed.

## Page Verdicts

| Page | Verdict | BLOCKER | IMPORTANT | NIT |
|------|---------|--------|-----------|-----|
| Puzzles | ACCEPTED | 0 | 0 | 0 |
| Weaknesses | ACCEPTED | 0 | 0 | 0 |
| Play | ACCEPTED (after fixes) | 0 | 0 | 1 |
| Analyze | ACCEPTED (after fixes) | 0 | 0 | 1 |
| Visual/Home | ACCEPTED | 0 | 0 | 3 |

## Fixes Applied (commit `b805168` + `2ee0b7c`)

### B1-Analyze: Opening moves marked ?! inaccuracy [FIXED]
**Root cause:** Stockfish UCI returns scores from the side-to-move's
perspective, not White's. After 1.e4 (Black to move), a score of -16
(Black 16cp worse) was treated as White being 16cp worse, producing
evalAfter=-0.16 from White's POV — wrong direction. This caused:
- evalBefore/evalAfter deltas to oscillate wildly
- top opening moves (1.e4, e5, Nf3, d6, d4) marked ?! inaccuracy
- book detection (cpLoss ≤ 20) to fail on eval-mismatch

**Fix:** In `getEvaluation`, `getBestMove`, and `getMultiPv`, detect the
active color from FEN field 2 and negate the score when Black is to move.
All evals now return White's POV consistently. Also bumped
evaluate/evaluateAfter to depth 15 (spec §4.1) with matching depths.

**Verified:** 1.e4-e5-Nf3-d6-d4 classify as book/best (no badge), eval bar
labels sane (+0.16, +1, +0.54...). Vision confirmed badges correct.

### B2-Analyze: Move list doesn't auto-scroll [FIXED]
**Root cause:** MoveList panel (max-height 360px, overflow-y: auto) had
no scroll-to-current-ply logic. At ply 19/21, only moves 1-7 visible.

**Fix:** Added `data-ply` attribute to each MoveRow, a `moveListRef` on
the MoveList, and a `useEffect` that calls `scrollIntoView({ block: 'nearest' })`
on the current ply's row when `currentPly` changes.

**Verified:** At ply 19, move list scrolled (scrollTop 142), brilliant !!
badge on move 10 visible. Vision confirmed purple #a855f7 badge visible.

### B1-Play: Illegal move toast unreachable [FIXED]
**Root cause:** `ChessBoard.handleSquareClick` only calls `onMove` when the
destination is in `legalTargets`. Illegal clicks fall through to deselect,
never reaching `handleMove`'s `showToast('Illegal move')` — dead code.

**Fix:** Added `onIllegal?: () => void` callback to ChessBoard. Invoked
when clicking a non-legal-target square while a piece is selected (click
path) and on illegal drag-drops. PlayPage wires it to `showToast('Illegal move')`.

**Verified:** Illegal e2→d3 click shows red "Illegal move" toast.
Vision confirmed toast visible at bottom of screen.

### I1-Play: PGN textarea empty after handoff [FIXED]
**Root cause:** `AnalyzePage.loadPgn` set game/analysis/currentPly but never
called `setPgnInput(pgn)`, so the textarea stayed empty showing placeholder.

**Fix:** Added `setPgnInput(pgn)` in `loadPgn`.

**Verified:** After "Analyze this game" handoff, PGN textarea contains full
game PGN with headers and moves.

## Swarm Reports
- `.pi/acceptance/swarm2/puzzles.md` — ACCEPTED
- `.pi/acceptance/swarm2/weaknesses.md` — ACCEPTED
- `.pi/acceptance/swarm2/play.md` — REQUEST-CHANGES (B6 later false positive)
- `.pi/acceptance/swarm2/play-vision.md` — REQUEST-CHANGES (B1, I1 confirmed)
- `.pi/acceptance/swarm2/analyze.md` — REQUEST-CHANGES (B1, B2 confirmed)
- `.pi/acceptance/swarm2/visual-home.md` — ACCEPTED
- `.pi/acceptance/swarm3-rereview/review.md` — ACCEPTED (all 4 fixes verified)

## Independent Re-Review (swarm3-rereview)
Fresh hostile reviewer booted app from scratch, exercised all 4 fixes
with real Chromium + Playwright. All 4 PASS. Vision-checkers confirmed
brilliant badge visible purple, illegal toast visible red.
