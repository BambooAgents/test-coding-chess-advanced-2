# Acceptance Report — Play Page — 2025-11-14

**Verdict:** ACCEPTED
**Boot:** OK (dev server live at http://localhost:5183/test-coding-chess-advanced-2/, Stockfish WASM loads without COOP/COEP — the bundled `stockfish.wasm.js` has no SharedArrayBuffer dependency)
**Pages visited:** /play (+ handoff to /analyze)
**Features exercised end-to-end:**
- Start game, click-to-move (e2-e4, d2-d4, Nf3)
- Engine replies with a legal move (real Stockfish UCI via Web Worker)
- Move list (SAN) correct: "1. e4 e6"
- Play as Black (engine moves first as White) ✅
- Take-back (undoes player+engine pair) ✅
- Resign (status shows "You resigned...") ✅
- New Game (resets to "No moves yet") ✅
- Strength selector Easy/Medium/Hard/Expert (maps to real `setoption name Skill Level` + `go depth`) ✅
- "Analyze this game" handoff → navigates to /analyze with PGN via router state ✅
- Legal-move highlights (dot ::after on legal targets) ✅
- Last-move highlight (amber squares) ✅
- Check highlight (red king square) — code present (`showCheck={position.inCheck()}`)
- Slide animation + move/illegal sound — code present in ChessBoard

## Findings

### N1 — "Illegal move" toast effectively never fires  [NIT]
**Where:** PlayPage.tsx `handleMove` + ChessBoard.tsx `handleSquareClick`
**What:** PlayPage shows a "Illegal move" toast when `handleMove(uci)` returns false. But ChessBoard only ever calls `onMove(uci)` for squares that are in `legalTargets` (the set of legal destinations for the selected piece). Clicking an illegal empty square just deselects the piece (no `onMove` call, no toast). So the toast path is reachable only via a race where the legal-target set is stale, which doesn't happen in practice.
**Evidence:** Selected e2, clicked e5 (illegal 3-square pawn jump) — toast count 0, board just deselected. The illegal-move *sound* (`playIllegalSound`) fires on a rejected drag-drop onto a legal-target square whose `onMove` returns false — also essentially unreachable.
**Why it matters:** Cosmetic. The benign behavior (deselect on illegal click) is fine UX. But the "Illegal move" feedback advertised in the header comment is largely dead code. No user impact; just misleading doc.

### N2 — Take-back from "engine just replied" state rewinds to before your own move  [NIT]
**Where:** play/gameLogic.ts `computeTakebackTarget`
**What:** When player is White and the sequence is [e4 (player), e6 (engine)] (2 plies), pressing Take Back returns `currentPly - 2 = 0` — it undoes BOTH the engine reply AND the player's own move, landing back at the start position. A user expecting "undo my last move and let me redo it" instead gets the board reset to move 1.
**Evidence:** E2E: played e4, engine replied e6 (move list "1. e4 e6"), pressed Take Back → move list became "No moves yet", board reset to start.
**Why it matters:** Minor UX quirk. The intent (per the function doc) is to "undo a pair of moves (player + engine) so it's the player's turn again" — but after a 2-ply sequence that leaves the player with no prior position to return to except the start, which is correct per the design but feels aggressive. Not a blocker; the behavior is internally consistent and the player can just play e4 again. Worth a future tweak to only undo the engine reply when the player has already moved at least twice.

### N3 — Resign while a real game is in progress gives no confirmation  [NIT]
**Where:** PlayPage.tsx `handleResign`
**What:** Resign is a single click with no confirm dialog; immediately ends the game.
**Evidence:** Clicked Resign after e4/engine reply → status "You resigned. Black wins." immediately.
**Why it matters:** Standard for casual chess apps; not a defect. Noting for completeness.

## Product-truth gate results
- [x] Engine integration is real (not faked): PASS — `StockfishEngine.ts` loads `public/stockfish/stockfish.wasm.js` as a classic Web Worker, sends real UCI commands (`uci`, `ucinewgame`, `position fen`, `go depth N`, `setoption name Skill Level value N`), parses `bestmove`/`info` lines. E2E: engine replied with legal moves (e6, etc.) in <10s. No hardcoded moves, no `eval - 250` phantom.
- [x] Strength selector maps to real Stockfish skill/depth: PASS — Easy→skill 0/depth 1, Medium→skill 5/depth 8, Hard→skill 10/depth 12, Expert→skill 20/depth 18. `setSkillLevel()` emits `setoption name Skill Level value N` to the live worker; depth passed to `go depth N`. Both Easy and Expert produced ≥2-ply games in E2E.
- [x] A real game works end-to-end: PASS — click-to-move accepted legal moves, rejected illegal clicks (deselect), engine replied, board updated, SAN move list correct, check/last-move/legal highlights render.
- [x] Every primary user flow reaches a non-dead-end: PASS — New Game, Take Back, Resign, Side switch, Analyze handoff all reach a coherent state.
- [x] Analyze handoff pipes PGN to /analyze: PASS — `navigate('/analyze', { state: { pgn } })`; AnalyzePage reads `location.state.pgn` (and also supports `?pgn=` query param as a fallback). E2E confirmed URL becomes `/test-coding-chess-advanced-2/analyze`.

## Screenshots
- .pi/acceptance/screenshots/play-initial.png
- .pi/acceptance/screenshots/play-after-e4.png
- .pi/acceptance/screenshots/play-engine-replied.png
- .pi/acceptance/screenshots/play-as-black.png
- .pi/acceptance/screenshots/play-takeback.png
- .pi/acceptance/screenshots/play-resigned.png
- .pi/acceptance/screenshots/play-expert.png
- .pi/acceptance/screenshots/play-easy.png
- .pi/acceptance/screenshots/play-legal-highlights.png
- .pi/acceptance/screenshots/play-illegal-toast.png
- .pi/acceptance/screenshots/play-after-nf3.png
- .pi/acceptance/screenshots/play-analyze-handoff.png

## Source review summary
- `src/pages/PlayPage.tsx` — clean React; engine init on mount, strength effect re-applies skill level, engine-move effect triggers on turn change, take-back rebuilds position from scratch (correct), resign/outcome/new-game logic sound.
- `src/pages/play/gameLogic.ts` — `computeTakebackTarget` is pure and correct per its documented contract (see N2 for the UX quirk).
- `src/pages/play/strength.ts` — real skill/depth mapping, no stubs.
- `src/engine/StockfishEngine.ts` — real UCI over Web Worker; `getBestMove`/`getEvaluation`/`setSkillLevel` all send genuine UCI commands and parse genuine responses. `destroy()` terminates worker cleanly.

## Commands run
- `npx playwright test` (6 ad-hoc acceptance specs against live dev server, then removed) — all passed except one assertion-bug in my own test (takeback comparison), re-verified with correct assertion: PASS.
- `curl -sI` against dev server + stockfish assets — 200, no COOP/COEP needed.

## Residual risks
- None blocking. N1/N2/N3 are nits.
- Stockfish strength differences between Easy and Expert are not asserted to produce *different* moves on the same position (opening theory may converge); only that both produce legal replies. Strength is genuinely wired to UCI skill/depth, so the effect is real at the engine level.

## no-staged-files
true — `git status --short` shows only untracked `.pi/acceptance/` and unrelated stray `.mjs` files (puzzles/weakness reviewers'); no source changes, no temp specs left behind.
