# Consolidated Acceptance Findings — 2026-08-21

Hostile acceptance-reviewer swarm (5 parallel reviewers) attacked the app.

## Verdicts
- **Play page**: ACCEPTED — real Stockfish, no blockers (3 nits)
- **Puzzles**: BLOCKED — 100% synthetic data
- **Analyze**: BLOCKED — hangs on real games, faked multiPv2
- **Weaknesses**: PASS (real) but slow — chess.com import works, live update works, real recommendations
- **Visual/UX**: needs targeted review after fixes

## BLOCKERS (must fix)

### B1: Puzzle bundle is 100% synthetic
**Evidence**: 2380/2380 entries have `sample-` IDs. Only 14 distinct FENs across entire dataset. 17 templates × 140 copies = 2380. `curate-puzzles.cjs` has `curateFromCsv()` that is NEVER called — `main()` deliberately throws to force `generateSamplePuzzles()` fallback. Types claim "Lichess puzzle database (CC0)" but it's fabricated. Several "puzzles" are literally the starting position (`sample-e1`: `e2e4 e7e5`).
**Fix**: Download a real curated subset (~2000) of the lichess CC0 puzzle database. Preserve themes (for opening/endgame themed sets). Replace `src/data/puzzles.json`. Make `curate-puzzles.cjs` actually download+curate (or commit a pre-curated JSON of real puzzles).

### B2: Analyze hangs on real games
**Evidence**: Immortal Game (45 plies) analysis stuck at "Analyzing… 44/45" for 150s, never completed. Root cause: brilliant detection on the last move (checkmate) runs extra depth-12 engine calls (`bestMove` + `multiPv2` + `evaluate`) on complex positions. Combined with depth-12 sequential evals (90 evals for 45 plies), it's too slow.
**Fix**: (a) Skip brilliant detection when `isCheckmate` is true on the resulting position (already partially there but the check may be wrong). (b) Lower depth for the eval-after pass or make depth configurable. (c) Add a progress signal / cancel button so the user isn't stuck. (d) Consider async/parallel evals.

### B3: multiPv2 is faked
**Evidence**: `src/pages/AnalyzePage.tsx` `multiPv2` returns `pv2 = position eval - 250`. Comment explicitly admits this. `StockfishEngine.ts` has NO MultiPV support — only `getEvaluation` + `getBestMove`.
**Fix**: Add real `getMultiPv(fen, depth, n)` to StockfishEngine that sends `setoption name MultiPV value N` and parses `info depth ... multipv 1/2 ... pv ...` lines. Update the adapter to use it.

### B4: Mate scores not parsed
**Evidence**: `StockfishEngine.getEvaluation` regex `score cp (-?\d+)` doesn't match `score mate N`. Checkmate positions return `score: undefined, mate: undefined`. The eval of a mate position returns a bogus centipawn score instead of mate.
**Fix**: Parse both `score cp N` and `score mate N` in `getEvaluation`. Return `{ cp, mate }` where mate is the plies-to-mate.

### B5: Puzzle solution not visible as moves
**Evidence**: "Show Solution" reveals "Next Move →" / "Retry" buttons but the solution moves aren't shown as text/moves. User can't see what the solution was.
**Fix**: Display the full solution line (UCI → SAN) when "Show Solution" is clicked.

## IMPORTANT

### I1: chess.js 1.4.0 is old
Canonical PGNs (Opera, Immortal) work. Complex modern PGNs with abbreviations may fail. Consider upgrading to chess.js 1.4.x latest or a newer fork. Not blocking (paste-PGN works for standard games).

### I2: No COOP/COEP headers
Stockfish WASM loads fine without them (classic worker, no SharedArrayBuffer dependency). NOT a blocker.

## NITS (Play page — accepted)
- N1: "Illegal move" toast unreachable in normal click flow
- N2: Take-back from 2-ply state rewinds to start
- N3: Resign has no confirm dialog

## PASS (no action needed)
- Play page: real Stockfish, real strength mapping, all flows work
- chess.com import (Analyze + Weaknesses): hits real `api.chess.com/pub/player/...`, works
- Weaknesses: real fetch, real analysis, real recommendations (slow but functional)
