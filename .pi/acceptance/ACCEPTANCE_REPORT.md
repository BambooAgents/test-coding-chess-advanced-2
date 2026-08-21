# Acceptance Report — 2026-08-20

**Verdict:** REJECTED
**Boot:** OK (dev server already running on :5183; `npm ci` clean; real Stockfish-WASM served from `public/stockfish/`)
**Pages visited:** Home (`/`), Play (`/play`), Analyze (`/analyze`), Puzzles (`/puzzles`), Weaknesses (`/weaknesses`), plus puzzle sub-modes (Plain / Themed Sets / Rush / Death Match) and the `?pgn=` URL handoff.
**Features exercised end-to-end:** PGN paste analysis (Immortal Game, 45 plies), chess.com username import on Analyze (real `hikaru` games), chess.com import on Weaknesses (real report rendered), Play vs engine (e4 → engine replied Nc6), puzzle Show Solution, all puzzle modes loaded, `?pgn=` URL handoff.

## Findings

### B1 — Puzzle bundle is 100% synthetic placeholder data, shipped as a "curated bundle"  [BLOCKER]
**Where:** `src/data/puzzles.json`, consumed by `src/puzzles/data.ts`; Puzzles page (`/puzzles`); screenshot `puzzles.png`.
**What:** All 2,380 puzzles have `sample-*` IDs (e.g. `sample-e1-0`, `sample-m4-0`). 280 of them use the **starting-position FEN** `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1` presented as a "tactic." Solution lengths are only 2–4 plies (distribution: 2 plies=560, 3 plies=1680, 4 plies=140). Themes are a tiny fixed set (`opening`, `endgame`, `rookEndgame`, `pawnEndgame`, `fork`, `pin`, `mateIn2`, `middlegame`) repeated mechanically across rating bands. Ratings are suspiciously round/evenly-banded (750, 850, 950 … 2250). The first puzzle the user sees is "Black to move" rated 850, theme `opening` / `Sicilian_Defense` — i.e. it's "play e5" from near the start position, not a tactic.
**Evidence:** Direct inspection of `src/data/puzzles.json`:
```
Total puzzles: 2380
sample-* IDs: 2380   (non-sample: 0)
puzzles with starting-position FEN: 280
move-length distribution: {2: 560, 3: 1680, 4: 140}
```
The loader (`src/puzzles/loader.ts`) is written for the **Lichess CSV format** (fields `PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,OpeningTags,GameUrl`), but the bundled JSON contains **none** of the Lichess sourcing fields — no `gameUrl`, no `popularity`, no `nbPlays`, no `ratingDeviation`. The data was clearly generated, not parsed from real Lichess puzzles. The Puzzles page text confirms: "Puzzle # 1 / 2380", themes "opening / Sicilian_Defense", rating 850 — a starting-position "tactic."
**Why it matters:** The entire Puzzles feature (Plain, Themed Sets, Rush, Death Match) trains users on synthetic non-tactics. A user solving "puzzles" is just playing opening moves from the start position. This is the exact product-quality escape the acceptance gate exists to catch.

### B2 — Engine MultiPV is faked (`pv2 = eval − 250`); Brilliant (??) detection is effectively non-functional  [BLOCKER]
**Where:** `src/pages/AnalyzePage.tsx` `realEngine()` adapter; `src/engine/StockfishEngine.ts`; screenshot `analyze-immortal.png`.
**What:** The `multiPv2()` method does **not** send `setoption name MultiPV value 2` and does **not** parse ≥2 `info` lines. It is hardcoded arithmetic on a single eval:
```ts
async multiPv2(fen) {
  const result = await engine.getEvaluation(fen, 12)
  const pv1 = { cp: result.score, ... }
  const pv2 = result.score !== undefined
    ? { cp: result.score - 250, depth: result.depth }   // ← phantom second line
    : { cp: -250, depth: result.depth }
  return { pv1, pv2 }
}
```
The code comment even admits it: *"MultiPV N=2 is approximated: pv1 = position eval, pv2 = position eval - 250cp... Full MultiPV would need a second engine option."* `StockfishEngine` has no MultiPV support at all (no `setoption name MultiPV`).
Consequence: the "only-move" margin in `brilliant.ts` is always `moverSign * (pv1Cp − (pv1Cp − 250))` = ±250 ≥ 150 threshold, so the only-move mechanism is effectively a constant. The Brilliant badge **never fires** on a real game: analysis of the Immortal Game (Anderssen–Kieseritzky 1851, which contains several famous brilliancies) produced **0 `!!` badges across all 45 moves**. (`!!` count: 0; `??` count: 9.)
**Evidence:** Source inspection + live analysis run. `analyze-immortal.png`; console: `brilliant (!!) count: 0`.
**Why it matters:** Brilliant detection is a headline feature ("Analysis & Training"). Shipping a hardcoded `eval − 250` phantom as "MultiPV" is the precise fakeable artifact the registry warns about. The feature is not just inaccurate — it produces no output at all on a game that should trigger it.

### B3 — Analysis hangs forever on any game that ends in checkmate  [BLOCKER]
**Where:** `src/analyze/engine.ts` + `src/engine/StockfishEngine.ts`; screenshot `analyze-immortal.png`.
**What:** Analyzing the Immortal Game (45 plies, ends 23.Be7#) progresses to "Analyzing… 44/45" in ~16s and then **hangs indefinitely** — waited 110s+, the progress indicator never disappears, no final accuracy/badge update. Root cause: `StockfishEngine.getEvaluation()` sends `go depth 12` and only resolves when it receives a `bestmove` line. When the position is **checkmate**, this Stockfish-WASM build emits **no `bestmove`** (there are no legal moves), so the Promise **never resolves**. Confirmed directly:
```
getEvaluation(mateFen, 12) → ms:30001, error:"TIMEOUT 30s"
```
(fool's-mate FEN `rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3`). `analyzeGame` calls `engine.evaluate(fenAfter)` for the final move, so any game ending in `#` hangs the whole analysis. Additionally `getEvaluation`'s parser only matches `score cp (-?\d+)` — it never parses `score mate`, so mate scores are silently dropped (the mate position eval returned `score:-1070` instead of mate).
**Evidence:** `hang2.mjs` run: progress reaches 44/45 at t=16s, then no further progress for >110s. `matehang.mjs`: evaluating a true mate position times out at 30s with no `bestmove`.
**Why it matters:** Checkmate endings are extremely common (every decisive game). The core Analyze feature appears to work but never completes for a huge fraction of real games, leaving the user staring at "Analyzing… N/N" forever with no recovery — a hard UX dead-end with no error and no finish.

### I1 — Analysis of a real PGN can silently fail to parse (chess.js 1.4.0 rejects some legal PGNs)  [IMPORTANT]
**Where:** `src/chess/pgn.ts` (uses `chess.js` ^1.4.0); Analyze page.
**What:** Pasting a real 41-move PGN (Kasparov–Topalov 1999) produced "No moves found in PGN." chess.js 1.4.0 (`loadPgn`) is an old release with known PGN-parsing limitations; it threw `Invalid move in PGN: Bh3` on a legal sequence. A normal Ruy Lopez and the Immortal Game parsed fine, so this is intermittent — the user gets no useful error and no recovery beyond "try a different PGN."
**Evidence:** `node -e` repro: `loadPgn threw: Invalid move in PGN: Bh3`; Analyze page showed `analyze-error text: No moves found in PGN.` for that PGN.
**Why it matters:** Pasting a real PGN from chess.com/Lichess is the primary Analyze input. An old parser rejecting legitimate master games undermines the core flow. Upgrading `chess.js` (current is 1.4.0; newer releases fix PGN parsing) would address this.

### I2 — Mate scores are dropped by the engine parser; eval bar / accuracy treat mate positions as large cp  [IMPORTANT]
**Where:** `src/engine/StockfishEngine.ts` (`score cp (-?\d+)` regex only).
**What:** `getEvaluation` parses only `score cp (-?\d+)` and ignores `score mate N`. Mate is never surfaced as `result.mate`. The eval bar and accuracy therefore never see true mate scores; a mating sequence is represented as a large/erratic centipawn swing (e.g. the mate position returned `score:-1070` instead of `mate`). Combined with B3, engine output for decisive positions is unreliable.
**Evidence:** `hang.mjs`: the post-mate FEN eval returned `{score:-1070, mate:undefined}` (should be mate).
**Why it matters:** Eval-bar fidelity and accuracy % are headline analysis outputs; silently losing mate information makes both misleading on tactical/mating games.

### N1 — Puzzles "Show Solution" reveals no solution moves in the move text  [NIT]
**Where:** Puzzles page; screenshot `puzzles-solution.png`.
**What:** Clicking "Show Solution" exposes "Next Move →" / "Retry" buttons but the solution line/moves are not shown in the page text (the board may animate, but as static text the solution is invisible). For a "find the best move" trainer, the user expects to see the solution PV.
**Evidence:** After clicking Show Solution, body text was identical to before plus only "Next Move → / Retry"; no solution moves rendered.
**Why it matters:** Minor UX gap in the puzzle trainer (lower priority given B1 makes the whole pool synthetic).

## Product-truth gate results
- [x] Puzzle data is real (not synthetic): **FAIL** — 100% `sample-*` IDs, 280 starting-position FENs, 2–4 ply "tactics," no Lichess sourcing fields (`gameUrl`/`popularity`/`nbPlays`) despite a Lichess-CSV-shaped loader. (B1)
- [x] Engine integration is real (not faked): **FAIL** — `multiPv2` returns `eval − 250` (hardcoded phantom), not a real MultiPV UCI call; `StockfishEngine` never sends `setoption name MultiPV`. (B2)
- [x] Analysis completes on a real PGN: **FAIL** — hangs forever at 44/45 on the Immortal Game (ends in checkmate); mate-position eval never returns a `bestmove`. (B3)
- [x] Every page renders without visual glitches: **PASS** — automated overlap/offscreen/clipping scan found 0 issues across all 5 pages; no console errors on any page.
- [x] Every primary user flow reaches a non-dead-end: **FAIL** — Analyze of any mate-ending game dead-ends on an infinite "Analyzing… N/N" with no error and no finish (B3); some real PGNs dead-end with "No moves found in PGN." (I1).
- [x] Annotations sane: **FAIL** — Brilliant (??) never fires on a game with famous brilliancies (0/45 on the Immortal), consistent with the faked MultiPV. (B2)

## Product-truth gate results (real-input evidence)
- chess.com import (Analyze): **PASS** — real `hikaru` games fetched from `api.chess.com/pub/player/hikaru/games/archives` (verified live, HTTP 200); an 81-move game loaded and began analyzing.
- chess.com import (Weaknesses): **PASS** — real `hikaru` games fetched; a progressive report rendered (openings table, 61.7% avg accuracy, recommendations) within seconds.
- Engine responds in Play: **PASS** — 1.e4 → engine replied `Nc6` on the Play page.
- `?pgn=` URL handoff: **PASS** — navigating to `/analyze?pgn=...` auto-loaded the game and rendered the move list.
- Stockfish-WASM loads in-browser: **PASS** — `uciok` received, engine answers `go depth` for non-mate positions (Play + Analyze both produce moves).

## Screenshots
- .pi/acceptance/screenshots/home.png
- .pi/acceptance/screenshots/play.png
- .pi/acceptance/screenshots/play-after-move2.png
- .pi/acceptance/screenshots/play-final.png
- .pi/acceptance/screenshots/analyze-empty.png
- .pi/acceptance/screenshots/analyze-immortal.png
- .pi/acceptance/screenshots/analyze-chesscom.png
- .pi/acceptance/screenshots/analyze-url-handoff.png
- .pi/acceptance/screenshots/puzzles.png
- .pi/acceptance/screenshots/puzzles-solution.png
- .pi/acceptance/screenshots/puzzles-themed-sets.png
- .pi/acceptance/screenshots/puzzles-rush.png
- .pi/acceptance/screenshots/puzzles-death-match.png
- .pi/acceptance/screenshots/weaknesses.png
- .pi/acceptance/screenshots/weaknesses-report.png
