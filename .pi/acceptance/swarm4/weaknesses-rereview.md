# Acceptance Report — Re-Review Swarm 4 Weaknesses Fixes (2026-08-21)

**Verdict:** ACCEPTED
**Boot:** OK — dev server already running at http://localhost:5183/test-coding-chess-advanced-2/ (Vite, BrowserRouter basename = base). Stockfish classic Worker loaded; no COOP/COEP needed for this engine path. No mocked engine / stubbed server.
**Pages visited:** /weaknesses, /puzzles?set=indian-game-spielmann-indian-variation
**Features exercised end-to-end:** My Weaknesses real-data analysis (hikaru, 50 games) → Recommendations + Openings table + Overview/Endgame stats; Train→ link → Puzzles themed-mode handoff.

## Prior findings — re-review verdict

### B1 [was BLOCKER] — Openings showed 'Unknown' — **FIXED**
**Where:** /weaknesses, Openings table after analyzing hikaru's real chess.com games.
**What (claimed):** `getOpening()` now resolves from ECOUrl slug → ECO code → 'Unknown' (previously read only the `Opening` PGN header, which chess.com pubapi PGNs omit).
**Verification:**
- Source (read-only): `src/weaknesses/analysis.ts` `getOpening()` (lines ~49–64) — resolution order is `Opening` header → `parseEcoUrlName(ECOUrl)` → `ECO` code → `'Unknown'`. `parseEcoUrlName()` strips `/openings/` slug + `...` move-list suffix, hyphens→spaces, title-cases. Confirmed matches the claim.
- Live DOM probe (`.pi/acceptance/swarm4/rereview-dump.json` → `b1openings`): analyzed 50 real games for `hikaru`; the Openings table rendered **42 rows**; `unknownCount: 0`. Every row shows a real opening name derived from ECOUrl, e.g. "Indian Game Knights Variation" (A46), "Sicilian Defense Taimanov Bastrikov Variation" (B48), "Indian Game Spielmann Indian Variation" (A46), "Caro Kann Defense Gurgenidze System 4.H3 Bg7" (B15), "Catalan Opening Closed Traditional Variation 9.B3" (E09), "Indian Game" (A45). No row is the literal "Unknown".
- Vision-checker (step2, run ced1a5f8): "All opening names in the table are specific chess opening names … Zero instances of 'Unknown' found." Step3 (run 8648e578) corroborates: "Openings table shows real chess opening names."
**Why it matters:** Users now see real opening names (the whole point of the Weaknesses report) instead of a wall of "Unknown".
**Verdict:** FIXED — PASS.

### I1 [was IMPORTANT] — Train→ link → ?set=<slug> matched no lichess tag → plain puzzles (silent dead-end) — **FIXED**
**Where:** /puzzles?set=indian-game-spielmann-indian-variation (a slug produced by `slugifyOpening("Indian Game Spielmann Indian Variation")`).
**What (claimed):** `PuzzlesPage` falls back to themed openings mode (no specific opening selected) when the slug matches no lichess opening tag, instead of landing on plain mode.
**Verification:**
- Source (read-only): `src/pages/PuzzlesPage.tsx` lines ~314–374 — the `useEffect` consuming `?set=` does: exact/prefix match against `index.openings`; on no match it calls `setMode('themed'); setThemeType('opening'); setSelectedTheme(null)`. Confirmed matches the claim. (It also clears the param via `setSearchParams({}, {replace:true})`.)
- Live DOM probe (`.pi/acceptance/swarm4/i1-probe.json`): navigated to `/puzzles?set=indian-game-spielmann-indian-variation`; after consumption `finalSearch: ""`, `hasEndgameSetsHeader: true`, `hasOpeningSetsHeader: true`. The "ENDGAME SETS"/"OPENING SETS" picker groups are rendered **only** when `mode === 'themed'` (conditional render at line ~604), so their presence is decisive proof of themed mode — not plain.
- Vision-checker (step4, run e260438a): "Themed Sets button active/purple", ENDGAME SETS + OPENING SETS pickers PRESENT, opening chips (Alekhine, Caro-Kann, French…) visible, "themed pickers are primary".
**Why it matters:** The "Train →" intent now lands the user on a useful opening-practice view instead of a silent dead-end on plain puzzles.
**Verdict:** FIXED — PASS.

### N1 [was NIT] — RecCard leaked non-transient `severity` prop to DOM (styled-components console warnings) — **FIXED**
**Where:** /weaknesses Recommendations section; `RecCard` styled component.
**What (claimed):** prop prefixed with `$` (transient), so it no longer reaches the DOM.
**Verification:**
- Source (read-only): `src/pages/WeaknessesPage.tsx` line 204 — `const RecCard = styled.div<{ $severity: string }>`. Line 446 usage: `<RecCard key={i} $severity={rec.severity}>`. Confirmed the prop is now transient (`$` prefix); it will not be forwarded to the rendered `<div>`.
- Live console capture (`.pi/acceptance/swarm4/rereview-dump.json` → `n1console`): during the full 50-game analysis run + report render, total console messages = 3, `severityWarnings: []`, `styledComponentsWarnings: []`, `pageErrors: []`. Zero `severity` warnings, zero styled-components "unknown prop" warnings.
**Why it matters:** Clean console; no transient-prop leak to the DOM.
**Verdict:** FIXED — PASS.

## New findings from this re-review

None. No BLOCKER, no IMPORTANT, no NIT found during the re-review walk. The report renders cleanly with real data, the Train→ handoff lands on themed mode, and the console is clean.

## Product-truth gate results
- [x] Puzzle/weakness data is real (not synthetic): PASS — real chess.com pubapi games for `hikaru` (50 games analyzed via Stockfish; openings/endgame stats are game-derived, e.g. "Bishops Opening Berlin Vienna Hybrid Variation 4" with 6 games, accuracy 66.1%). Verified via DOM, not self-attestation.
- [x] Engine integration is real (not faked): PASS — analysis ran the real Stockfish WASM worker (public/stockfish/stockfish.wasm.js loaded as a classic Worker); analysis took real time and produced per-game evals feeding real accuracy/blunder numbers. No hardcoded evals.
- [x] Analysis completes on a real PGN/username: PASS — "Analysis complete: 50 games analyzed" appeared; report fully rendered (Recommendations + Overview + Openings table + Endgame stats).
- [x] Every page renders without visual glitches: PASS — vision-checkers for all 4 screenshots reported PRESENT for all expectations and "no visual glitches / no overlapping / no clipped text".
- [x] Every primary user flow reaches a non-dead-end: PASS — Weaknesses report → Train→ → Puzzles themed mode (the prior I1 dead-end is gone).

## Notes on method (text-only reviewer)
- I am GLM-5.2, text-only. I did NOT read screenshots directly. Each of the 4 screenshots was inspected by a fresh `vision-checker` subagent (Qwen3.5-397B), one image per subagent (runs 8648e578, ced1a5f8, b27839e8, e260438a). Their text reports are cross-referenced above.
- For the spatial/mode-determination claim (I1: themed vs plain), vision alone was insufficient — the decisive evidence is a DOM probe: the ENDGAME SETS / OPENING SETS picker groups are conditionally rendered only when `mode === 'themed'` (`src/pages/PuzzlesPage.tsx` line ~604); their presence in the DOM after consuming `?set=indian-game-spielmann-indian-variation` proves themed mode without relying on a vision model's "active button" reading.
- For B1 (no "Unknown" rows) the decisive evidence is the DOM probe reading the Openings table cells directly (`unknownCount: 0` over 42 rows), not the vision reading of pixel text.
- For N1 the decisive evidence is the captured console output during the full run (zero severity/styled-components warnings), plus the source confirming the `$severity` transient prop.

## Screenshots
- .pi/acceptance/swarm4/screenshots/weaknesses-rereview-step1.png — initial /weaknesses
- .pi/acceptance/swarm4/screenshots/weaknesses-rereview-step2-pre.png — username entered, pre-Analyze
- .pi/acceptance/swarm4/screenshots/weaknesses-rereview-step2.png — analysis complete, report rendered
- .pi/acceptance/swarm4/screenshots/weaknesses-rereview-step3.png — recommendations + openings table
- .pi/acceptance/swarm4/screenshots/weaknesses-rereview-step4.png — /puzzles?set=… → themed mode

## Artifacts
- .pi/acceptance/swarm4/rereview.mjs — Playwright driver
- .pi/acceptance/swarm4/rereview-dump.json — DOM/console dump (step1/2/3, b1openings, n1console, i1puzzles, i1mode)
- .pi/acceptance/swarm4/rereview-console.json — full console message log
- .pi/acceptance/swarm4/i1-probe.mjs / i1-probe.json — decisive I1 themed-mode probe
