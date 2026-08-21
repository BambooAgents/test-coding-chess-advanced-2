# Acceptance Report — Analyze Page — 2026-08-21

**Verdict:** REQUEST-CHANGES
**Boot:** OK (dev server at http://localhost:5183/test-coding-chess-advanced-2/analyze responded 200; Stockfish WASM worker loaded; analysis ran in-browser)
**Pages visited:** /analyze
**Features exercised end-to-end:** Paste-PGN input → Load PGN → real Stockfish analysis to completion (21 plies, ~8s) → eval bar fill per ply → move-list badges (4 colors) → brilliant badge on 10.Nxb5 → scrubber navigation through plies 1/3/6/9/11/19/21 → DOM verification of eval bar height, arrow SVG, badge colors, accuracy %

## Summary

The Analyze page **boots and works end-to-end**: a real 21-ply PGN is parsed, real Stockfish WASM analysis runs to completion in ~8s, the eval bar fills proportionally, best-move arrows render on the board, the move list shows all 21 moves with classification badges across 4 colors, the brilliant (`!!`, purple) badge fires on a genuinely brilliant move (10.Nxb5 knight sac), and accuracy % is computed. The engine integration is **real** (real UCI `setoption name MultiPV value 2`, real `go depth N`, real `bestmove` parsing — not an `eval − 250` phantom or hardcoded move).

However, two **BLOCKERs** block acceptance:

1. **Obvious wrong annotations**: 1.e4, 1...e5, 2.Nf3, 2...d6, 3.d4 are all marked `?!` (inaccuracy, yellow). 1.e4 and 1...e5 are objectively top opening moves. This fails the "Badges match obvious human judgement" product-truth gate. Root cause: the analyze page uses **depth 8** for `evaluateAfter`, which the project's own spec (`docs/spec/annotation-thresholds.md` §4.1) says is too shallow for individual game annotations (it recommends depth 15–20). Depth-8 noise returns `evalAfter = -0.71` for the position after 1.e4 (should be ~+0.2 for White), which defeats book detection (cpLoss ≤ 20) and falls through to inaccuracy. The spec §7.6 explicitly says "After 1.e4 e5 2.Nf3 ... Nc6 → BOOK".

2. **Move list does not auto-scroll to the current ply.** When scrubbing to ply 19/21, only moves 1–7 remain visible in the scroll panel. The brilliant `!!` badge on move 10 (Nxb5) is scrolled out of view. A user scrubbing through a game cannot see the classification of the move they are viewing — a UX dead-end for the move-list's primary purpose.

## Findings

### B1 — Opening moves (1.e4, e5, Nf3, d6, d4) marked "??" inaccuracy — obvious wrong annotation  [BLOCKER]
**Where:** Analyze page, /analyze, after loading `1.e4 e5 2.Nf3 d6 3.d4 Bg4 ...` and completing analysis. Screenshot: `.pi/acceptance/swarm2/screenshots/analyze-e4-inaccuracy-ply1.png`.
**What:** The first five moves of the game (1.e4, 1...e5, 2.Nf3, 2...d6, 3.d4) are all classified as `?!` (inaccuracy, yellow `rgb(234, 179, 8)`). 1.e4 and 1...e5 are objectively among the best opening moves and should be `Book` or `Best`, never an inaccuracy. This is an obvious wrong annotation that any chess player would notice.
**Evidence:**
- DOM probe (`move-classifications-complete.json`): moves 1–5 badge text = `?!`, color = `rgb(234, 179, 8)` (yellow inaccuracy).
- Vision-checker report on `analyze-e4-inaccuracy-ply1.png`: "1.e4 has a yellow/gold ?! (inaccuracy) badge ... 1...e5, 2.Nf3, 2...d6, 3.d4 all have ?! badges too. These are all top opening moves incorrectly marked as inaccuracies."
- Root cause confirmed in source: `AnalyzePage.tsx` `realEngine.evaluateAfter` calls `engine.getEvaluation(fen, 8)` (depth 8). The eval bar label after 1.e4 reads `-0.71` (DOM: `label="-0.71"`), meaning "Black is better after 1.e4" — wrong direction; should be ~+0.2 for White. This depth-8 noise makes `bestCpValue - playedCpValue` exceed the book-detection threshold (`BOOK_CP_LOSS = 20`), so `classifyMove` falls through to `inaccuracy`.
- Spec `docs/spec/annotation-thresholds.md` §4.1 recommends depth 15–20 for the analyze page ("At depth 15, eval is reliable enough for classification"); §4.2 reserves depth 8–10 for weak-spot aggregate stats only. §7.6 explicitly classifies "After 1.e4 e5 2.Nf3 ... Nc6" as `BOOK`.
**Why it matters:** A user analyzing a game sees their perfectly normal opening moves flagged as inaccuracies, which undermines trust in every other annotation on the page. It is the exact "obvious wrong annotation" defect the acceptance gate exists to catch.

### B2 — Move list does not auto-scroll to current ply; brilliant badge scrolled out of view  [BLOCKER]
**Where:** Analyze page, /analyze, scrubber at ply 19/21. Screenshots: `.pi/acceptance/swarm2/screenshots/analyze-brilliant-ply19.png`, `.pi/acceptance/swarm2/screenshots/analyze-complete-ply21.png`.
**What:** The move-list panel (`[data-testid="move-list"]`, `max-height: 360px; overflow-y: auto`) does not scroll to keep the currently-selected move visible. When the scrubber is at ply 19 (or 21), the panel still shows only moves 1–7. The brilliant `!!` badge on move 10 (10.Nxb5 — the headline tactical move of the game) is below the visible viewport and cannot be seen without manually scrolling the panel.
**Evidence:**
- Vision-checker report on `analyze-brilliant-ply19.png`: "Move list shows ONLY moves 1-7. Move 10.Nxb5 (the brilliant move) is SCROLLED OUT OF VIEW. The navigation shows '19 / 21' but the move list panel did not auto-scroll to the current ply. The brilliant !! badge cannot be seen because it's on move 10, which is below the visible viewport."
- Vision-checker report on `analyze-complete-ply21.png`: "Move list: shows moves 1-7 only (same scroll issue — 21/21 but only first 7 visible)."
- DOM: scrubber text reads `19 / 21` while the move-list scrollTop is 0 (no scroll).
**Why it matters:** The move list's primary job is to show the classification of the move the user is currently viewing. With 21 moves in a 360px panel, the selected move is routinely off-screen. The brilliant badge — the most exciting output of the analysis — is invisible at the exact moment a user would scrub to it. This is a UX dead-end for the move list.

### I1 — Eval labels oscillate wildly in the opening (depth-8 evalAfter noise)  [IMPORTANT]
**Where:** Analyze page, eval bar labels, plies 1–5. Screenshot: `.pi/acceptance/swarm2/screenshots/analyze-e4-inaccuracy-ply1.png`.
**What:** The eval bar label after 1.e4 reads `-0.71`, after 1...e5 reads `+1.27`, after 2.Nf3 reads `-0.87`, after 2...d6 reads `+1.69`. In a roughly equal opening these should all be within ~±0.3. The ±1.7 swing is depth-8 noise, not real evaluation.
**Evidence:** DOM `eval-per-ply-complete.json`: ply1=-0.71, ply2=+1.27, ply3=-0.87, ply4=+1.69, ply5=-0.22.
**Why it matters:** The eval bar is the most-watched element on the analyze page. Wildly oscillating, wrong-direction evals in the opening erode user trust and feed the B1 misclassification. Same root cause as B1 (depth-8 evalAfter).

### N1 — Best-move arrow shows the last-played move, not the engine's best move  [NIT]
**Where:** Analyze page, board arrows at every ply. Screenshot: `.pi/acceptance/swarm2/screenshots/analyze-brilliant-ply19.png`.
**What:** The indigo (`#4f46e5`) arrow rendered on the board is the last-played move (e.g. f1→b5 for 11.Bxb5+), not the engine's recommended best move for the current position. The component comment in `AnalyzePage.tsx` acknowledges this: "A true on-demand best-move arrow would require an engine call per scrub; deferred to a refinement."
**Evidence:** DOM `arrow-probe.mjs`: at ply 11 the arrow goes from `x1=5.5 y1=7.5` (f1) to `x2=2.69 y2=4.69` (b5) — i.e. the bishop's last move, matching `game.moves[10]` (Bxb5+), not an on-demand engine bestmove.
**Why it matters:** Minor — the arrow still helps follow the game, but a user expecting "what should I play here?" gets "what was just played." Documented as deferred, so NIT not blocker.

## Product-truth gate results
- [x] **Real data (not synthetic):** PASS — the PGN is user-supplied (real game); no bundled puzzle/lesson data involved on this page.
- [x] **Engine integration is real (not faked):** PASS — `StockfishEngine.getMultiPv` sends `setoption name MultiPV value 2` and parses ≥2 `info` lines (src/engine/StockfishEngine.ts:373); `getBestMove` sends `go depth N` and parses `bestmove` (src/engine/StockfishEngine.ts:214). The `multiPv2` adapter does NOT return `{pv1: eval, pv2: eval-250}`. Brilliant detection uses these real calls. Stockfish WASM loaded in-browser and produced real evals (analysis completed in ~8s, no SharedArrayBuffer/COOP-COEP needed).
- [x] **Analysis completes on a real PGN:** PASS — a real 21-ply PGN analyzed to completion in ~8s with eval bar, accuracy %, and badges. (No hang; the page's progressive `Analyzing… N/21` status updated correctly.)
- [x] **Every page renders without visual glitches:** PASS — vision-checker reports: layout clean, no overlapping or clipped elements, no transparent/invisible text, badge colors all correct and visible (yellow/orange/red/purple), board legible with check highlight.
- [ ] **Every primary user flow reaches a non-dead-end:** PARTIAL — paste-PGN → analysis → scrub works, but the move-list auto-scroll failure (B2) dead-ends the move-list's core purpose, and the wrong opening annotations (B1) mislead the user.
- [ ] **Annotations sane (badges match obvious human judgement):** FAIL — 1.e4 / e5 / Nf3 / d6 / d4 marked `?!` (inaccuracy) on objectively top opening moves. (The brilliant `!!` on 10.Nxb5 and the `??` on 10...cxb5 are sane.) This FAIL is a BLOCKER (B1).

## Required product-truth gates — final status
- Real data: **PASS**
- Real engine integration: **PASS**
- Analysis completes on real PGN: **PASS**
- Every page renders without visual glitches: **PASS**
- Every flow reaches a non-dead-end: **FAIL** (B2 — move-list auto-scroll)
- Annotations sane: **FAIL** (B1 — opening moves marked inaccuracy)

## Screenshots
- `.pi/acceptance/swarm2/screenshots/analyze-loaded.png` — initial loaded state (analysis in progress)
- `.pi/acceptance/swarm2/screenshots/analyze-e4-inaccuracy-ply1.png` — ply 1, shows yellow ?! on 1.e4 (B1)
- `.pi/acceptance/swarm2/screenshots/analyze-brilliant-ply19.png` — ply 19, shows move list stuck at moves 1–7 (B2); brilliant !! on move 10 off-screen
- `.pi/acceptance/swarm2/screenshots/analyze-complete-ply21.png` — ply 21, final position, same scroll issue
- `.pi/acceptance/swarm2/screenshots/analyze-scrub-ply3.png` — ply 3
- `.pi/acceptance/swarm2/screenshots/analyze-scrub-ply6.png` — ply 6
- `.pi/acceptance/swarm2/screenshots/analyze-scrub-ply9.png` — ply 9
- `.pi/acceptance/swarm2/screenshots/analyze-scrub-ply11.png` — ply 11

## DOM evidence artifacts
- `.pi/acceptance/swarm2/analyze-dom-results.json` — initial DOM probe
- `.pi/acceptance/swarm2/move-classifications-complete.json` — all 21 move classifications + accuracy (post-completion)
- `.pi/acceptance/swarm2/eval-per-ply-complete.json` — eval bar label + fill height per ply (post-completion)
- `.pi/acceptance/swarm2/analysis-timeline.json` — analysis progress over time (0→5→11→18→21 in ~8s)

## Verdict: REQUEST-CHANGES

Finding counts: **2 BLOCKER, 1 IMPORTANT, 1 NIT**.

The product fundamentally works (real engine, real analysis, real brilliant detection, correct badge colors, clean layout), but cannot be accepted until:
- **B1** is fixed: increase `evaluateAfter` depth from 8 to ≥15 (per spec §4.1) so opening moves classify as Book/Best instead of inaccuracy; and/or add opening-book / eval-match book detection robust to shallow eval.
- **B2** is fixed: auto-scroll the move-list panel to keep `currentPly`'s row in view (e.g. `scrollIntoView` on the current `MoveRow`).
