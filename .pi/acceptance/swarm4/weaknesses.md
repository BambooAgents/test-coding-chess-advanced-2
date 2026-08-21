# Acceptance Report — Swarm 4, My Weaknesses (ticket #19) — 2026-08-21

**Verdict:** REQUEST-CHANGES
**Boot:** OK (dev server already running at http://localhost:5183/test-coding-chess-advanced-2/, HTTP 200, app loads with real Stockfish WASM from /stockfish/)
**Pages visited:** /weaknesses (BrowserRouter route, not hash-routed — the task's "hash-routed" note was incorrect; the real route is `/test-coding-chess-advanced-2/weaknesses`)
**Features exercised end-to-end:**
- Weaknesses page initial render (Step 1)
- Real chess.com pubapi fetch + real Stockfish analysis for "hikaru" (50 games) (Steps 2–3)
- Username change to "magnuscarlsen" (20 games) — live report update (Step 4)
- Real-api gate: verified two different usernames produce different reports

## Method
- Executed the user-story script at `.pi/acceptance/swarm4/stories/weaknesses-19.md` step by step in Playwright (via `./node_modules/.bin/playwright cli`).
- One full-page screenshot per step → `.pi/acceptance/swarm4/screenshots/weaknesses-step<N>.png`.
- One vision-checker subagent (Qwen) per screenshot, fresh conversation each, with the step's VISIBLE expectations. Reports collected as text (I am GLM-5.2, text-only — I did not read the screenshots).
- DOM probes (snapshot + `eval`) for content/spatial/real-data checks.
- Network probe (`requests`) to confirm real pubapi.chess.com calls.

## Findings

### B1 — Opening names are ALL "Unknown"; the report never resolves opening names from real chess.com data  [BLOCKER]
**Where:** /weaknesses, Openings table + Recommendations — Steps 2 & 3.
Screenshots: weaknesses-step2.png, weaknesses-step3.png, weaknesses-step4.png
**What:** Every row in the Openings table shows the literal text `Unknown` in the "Opening" column for every game, for every username. The Recommendations section likewise emits a card titled `Reduce blunders in Unknown` with body `Your blunder rate is 10% in the Unknown. Practice tactical puzzles from this opening.` The opening NAME is never displayed — only the ECO code (A46, B06, C28, …) is shown.
**Evidence:**
- DOM probe (hikaru, 50 games): the Openings table has 30 rows; every row's first cell is literally `Unknown` (e.g. `["Unknown","A46","played","2",...]`, `["Unknown","B06","faced","5",...]`). DOM eval captured full table text.
- DOM probe (magnuscarlsen, 20 games): same — `["Unknown","A40","faced","2",...]`, etc. 19 rows, all `Unknown`.
- DOM text of a recommendation card: `Reduce blunders in Unknown … Your blunder rate is 10% in the Unknown. Practice tactical puzzles from this opening.` — the placeholder `Unknown` leaks into the human-facing recommendation copy.
- Code probe: `src/weaknesses/analysis.ts:37-38` `getOpening()` returns `game.headers.Opening || game.headers.opening || 'Unknown'`. `src/chess/pgn.ts` parses headers via chess.js `chess.header()`.
- Real chess.com PGN inspection (`curl https://api.chess.com/pub/player/hikaru/games/2026/08`): the PGN headers include `[ECO "A46"]` and `[ECOUrl "https://www.chess.com/openings/Indian-Game-Spielmann-Indian-Variation...4.Nxd4-d5-5.Bg2-e5"]` but **NO `[Opening ...]` header**. chess.com pubapi does not emit an `Opening` PGN header; the human-readable opening name is encoded only in the `ECOUrl` header (as a URL slug).
- Therefore `getOpening()` always falls through to `'Unknown'` for chess.com games. The opening name IS present in the data (in `ECOUrl`) but the code never reads it.
- Vision-checker reports for steps 2, 3, and 4 all independently flagged "All opening names display as 'Unknown'" (each called it a NIT/residual-risk because it could not tell from pixels alone whether the data was missing or the code was broken). My code+DOM probe confirms it is a code defect, not a data limitation.
**Why it matters:** The script Step 2 requires "The report shows real game-derived content: **opening names**, loss categories, or weakness themes — NOT a hardcoded fixture." Step 3 requires "**The content reflects real games (e.g. openings Hikaru actually plays)**, not a static template." A user opening "My Weaknesses" sees a table where every opening is `Unknown` and a recommendation `Reduce blunders in Unknown` — the opening-name dimension of the weakness report is non-functional and the recommendation copy is broken English. This is a core product-truth failure for the opening-analysis feature.
**Fix direction (for the writer, not prescriptive):** resolve the opening name from the `ECOUrl` header (slug → human name) or from an ECO→name map, falling back to the ECO code; never surface the literal `Unknown` in the Openings table or in recommendation titles/descriptions.

### I1 — "Reduce blunders in Unknown" Train link (`?set=unknown`) is a UX dead-end  [IMPORTANT]
**Where:** /weaknesses → Recommendations → "Reduce blunders in Unknown" card "Train →" link → /puzzles?set=unknown (Step 3).
**What:** The recommendation card generated for the `Unknown` "opening" links to `/puzzles?set=unknown`. In `src/pages/PuzzlesPage.tsx:317-347`, the `?set=` consumer special-cases `endgame*`, `opening`, `middlegame`, and otherwise tries to match the slug against `index.openings`. `unknown` matches no opening, so the `else` branch runs `setSearchParams({}, {replace:true})` and selects no theme — the user lands on the plain puzzles view with no indication their "Train this opening" intent was honored. This is a consequence of B1 (the `Unknown` placeholder) but is itself a dead-end: a user who clicks "Train →" expecting to drill the flagged opening gets dumped into generic puzzles.
**Evidence:** Code probe of `PuzzlesPage.tsx` `useEffect` for `?set=`: the `else` branch only sets mode/theme if `match` is found; `unknown` produces no match, so nothing is selected and the param is cleared. (Not navigated live to avoid broadening scope, but the routing logic is unambiguous.)
**Why it matters:** A "Train →" button that silently does nothing is a UX dead-end (a §4 defect class). Once B1 is fixed so the recommendation names a real opening, the slug will match and this resolves naturally; until then it is a broken affordance.

### N1 — styled-components "unknown prop `severity`" console warning  [NIT]
**Where:** /weaknesses — all steps; browser console.
**What:** `RecCard` is declared `styled.div<{ severity: string }>` and uses `$p.severity` via a transient prop, but the component is rendered as `<RecCard severity={rec.severity}>` (non-transient `severity` prop), so styled-components warns: `it looks like an unknown prop "severity" is being sent through to the DOM`. (Similarly `SeverityBadge` uses `$severity` correctly but `RecCard` does not.)
**Evidence:** Console probe (`playwright cli console`): 1 warning — `styled-components: it looks like an unknown prop "severity" is being sent through to the DOM…`. `src/pages/WeaknessesPage.tsx` `RecCard` styled component uses `${($p) => $p.severity === ...}` but the JSX passes `severity={rec.severity}` (no `$` prefix), and `RecTitle`/badge also intermix transient and non-transient usage.
**Why it matters:** Cosmetic; no user-visible impact, but the prop leaks to the DOM and spams the console. One-line fix (prefix the prop with `$`).

## Per-step evidence (vision + DOM cross-reference)

### Step 1 — Initial Weaknesses page  [PASS]
- **Action:** navigated to `/test-coding-chess-advanced-2/weaknesses`.
- **DOM probe:** heading "My Weaknesses"; subtitle paragraph; username textbox (`placeholder: e.g. hikaru`); "Games to Analyze" combobox (20/50/100, 50 selected); "Analyze" button. Nav bar present with Home/Play/Analyze/Puzzles/My Weaknesses (active).
- **Vision report (weaknesses-step1.png):** username input PRESENT; "Analyze" button PRESENT; page not empty/broken (heading + subtitle + nav) PRESENT. No glitches. All expectations PRESENT.
- **Verdict:** PASS.

### Step 2 — Load real games (hikaru)  [PASS on real-data gate; BLOCKER on opening-names — see B1]
- **Action:** filled username "hikaru", clicked "Analyze".
- **Network probe:** `GET https://api.chess.com/pub/player/hikaru/games/archives => [200]` and `GET https://api.chess.com/pub/player/hikaru/games/2026/08 => [200]` — REAL pubapi, not a fixture.
- **DOM probe (mid-analysis):** button text `Analyzing...` (disabled) with spinner; paragraph `Analyzing game 6 of 50...` (later `12 of 50`); progress bar rendering; Recommendations/Overview/Openings/Endgame sections streaming in. Average Accuracy, Won/Lost from Winning, Went Wrong Early counts present and changing.
- **Vision report (weaknesses-step2.png):** loading signal PRESENT (progress bar ~24%, "Analyzing game 12 of 50...", spinner on button); report rendering PRESENT (Recommendations/Overview/Openings/Endgame visible); real game-derived content PRESENT (ECO codes A46/B15/A43/B06…, loss categories, weakness themes with counts). Flagged "Unknown" opening names as a NIT (confirmed by me as BLOCKER B1).
- **Verdict:** loading + real-data + report-rendering expectations PASS. "opening names" expectation FAIL (B1).

### Step 3 — Weakness recommendations render (hikaru, complete)  [PASS on structure; BLOCKER on opening-name content — see B1]
- **Action:** waited for completion → "Analysis complete: 50 games analyzed".
- **DOM probe:** Recommendations: "Reduce endgame blunders" (HIGH), "Convert winning positions" (HIGH), "Improve opening play" (HIGH), "Reduce blunders in Unknown" (MEDIUM) — each with "Train →" link. Overview: 50 games, 67.2% avg accuracy, 24 won-from-losing, 5 lost-from-winning, 3 advantage-then-lost, 37 went-wrong-early. Openings table: 30 rows, columns Opening/ECO/Type/Games/W/L/D/Blunder %/Accuracy, ECO codes A46,B06,A04,C28,B01,B07,B48,D04,B15,A43,B52,B43,A48,B08,A34,E61,A00,C00,B02,E17,E09,B13,B27,A15,A40,D11,B22,B23,D00,A45 — but **every Opening cell is `Unknown`**. Endgame: 11 endgame games, 4 endgame blunders, 0 lost drawn, 0 lost rook, 88.8% endgame accuracy.
- **Vision report (weaknesses-step3.png):** recommendations with severity labels PRESENT; "Train →" links PRESENT; Overview stat cards PRESENT; Openings table with all columns PRESENT; Endgame section PRESENT; real ECO codes PRESENT. Flagged "Unknown" opening names (NIT → confirmed BLOCKER B1) and "Reduce blunders in Unknown" card (→ I1).
- **Verdict:** structural expectations PASS. "content reflects real games (openings Hikaru actually plays)" expectation FAIL — openings are not named (B1).

### Step 4 — Live update on username change (magnuscarlsen)  [PASS]
- **Action:** changed username to "magnuscarlsen", set Games to 20, clicked "Analyze".
- **Network probe:** `GET https://api.chess.com/pub/player/magnuscarlsen/games/archives => [200]` and `GET https://api.chess.com/pub/player/magnuscarlsen/games/2026/08 => [200]` — different real username, different real endpoint.
- **DOM probe (complete):** "Analysis complete: 20 games analyzed". Overview: 20 games (vs hikaru's 50), 69.5% accuracy (vs 67.2%), 11 won-from-losing (vs 24), 2 lost-from-winning (vs 5), 1 advantage-then-lost (vs 3), 14 went-wrong-early (vs 37). Openings ECO set: A40,E04,C11,A01,C00,E00,C20,C50,B20,A43,A04,B10,E43,A13,A41,D02,B21,B90,E21 — distinct from hikaru's set (A46,B06,A04,C28,B01,…). Recommendations differ: magnus has "Reduce endgame blunders" LOW (2 blunders) vs hikaru HIGH (4 blunders); magnus "Improve opening play" 14 games vs hikaru 37.
- **Vision report (weaknesses-step4.png):** report content CHANGED from hikaru PRESENT (20 vs 50 games, different ECOs, different stats); not identical to hardcoded template PRESENT (dynamic magnuscarlsen-specific data); Recommendations/Overview/Openings/Endgame PRESENT. No glitches. (Again noted "Unknown" opening names — B1.)
- **Verdict:** PASS — reports vary by username; real-data gate satisfied.

## Product-truth gate results
- [x] chess.com import hits the REAL pubapi (not a fixture): PASS — network probe shows `GET https://api.chess.com/pub/player/hikaru/games/archives => [200]` and `…/magnuscarlsen/games/archives => [200]`, plus the monthly archive fetches; two different usernames produce different real game sets (different ECO codes, different game counts, different stats).
- [x] Engine integration is real (not faked): PASS — `StockfishEngine` loads `public/stockfish/stockfish.wasm.js` as a Worker, speaks UCI (`uci`/`uciok`/`position fen`/`go depth`/`bestmove`/`setoption MultiPV`); analysis ran depth-6 evals across 50 real games and produced per-game classifications, accuracy, turning points. Real compute, not arithmetic on a single eval.
- [x] Analysis completes on real input: PASS — hikaru 50/50 games analyzed in ~70s with a live "Analyzing game N of 50" progress signal; magnuscarlsen 20/20 in ~30s. No hang >60s without progress.
- [x] Every page renders without visual glitches: PASS (for /weaknesses) — vision-checker reports across all 4 steps found no overlapping/clipped/broken-layout/illegible-contrast issues; only the "Unknown" text content (B1) and the console warning (N1).
- [x] Every primary user flow reaches a non-dead-end: PARTIAL FAIL — the "Reduce blunders in Unknown → Train" flow is a dead-end (I1); the main analyze flow itself reaches a complete, useful report.

## Summary
- 1 BLOCKER (B1 — opening names never resolved; "Unknown" everywhere in table + recommendations).
- 1 IMPORTANT (I1 — `?set=unknown` Train link is a dead-end, downstream of B1).
- 1 NIT (N1 — styled-components `severity` prop warning).
- Real-data gate (the key product-truth gate for this ticket): PASS — real pubapi, real per-username variation, real Stockfish analysis.

Verdict: REQUEST-CHANGES — the chess.com integration and engine are genuinely real and the report varies by username, but the opening-name dimension of the weakness report is non-functional (B1), which violates Steps 2 & 3's "opening names / reflects real games openings" expectations.

## Screenshots
- .pi/acceptance/swarm4/screenshots/weaknesses-step1.png  (initial page)
- .pi/acceptance/swarm4/screenshots/weaknesses-step2.png  (hikaru mid-analysis, game 12/50)
- .pi/acceptance/swarm4/screenshots/weaknesses-step3.png  (hikaru complete, 50 games)
- .pi/acceptance/swarm4/screenshots/weaknesses-step4.png  (magnuscarlsen complete, 20 games)
