# Acceptance Report — Play Page (Vision Re-Review)

**Date:** 2026-08-21
**Reviewer:** acceptance-reviewer (GLM-5.2, text-only) + parent-dispatched vision-checkers (Qwen)
**Verdict:** REQUEST-CHANGES
**Boot:** OK — dev server at http://localhost:5183/test-coding-chess-advanced-2 returned HTTP 200; real Vite dev server (not mocked).
**Pages visited:** `/play`, `/analyze` (via "Analyze this game" handoff)
**Features exercised end-to-end:** New game, difficulty switching (Easy/Expert), side selection (White/Black), move input, engine response, take-back, resign, legal-move highlights, illegal-move attempt, Analyze handoff.

## Method & a critical caveat on the vision evidence

I am GLM-5.2, a text-only model, and I ran at subagent depth 1 (max=1), so I could not dispatch `vision-checker` children myself (every dispatch failed: "Nested subagent call blocked (depth=1, max=1)"). The parent supervisor instead ran 4 vision-checkers against my screenshots and relayed their text reports.

**One vision report was incorrect and I overrode it with DOM evidence.** The vision-checker reported that screenshot `08-analyze-handoff.png` showed the PGN textarea "filled with '1. e4 e5 2. ...'". A direct DOM re-probe (`analyze-handoff-recheck.mjs`) proves this is a **misread of the textarea's placeholder**: the `<textarea data-testid="pgn-input">` has `value === ""` (length 0) and `placeholder === "1. e4 e5 2. ..."`. The vision model read the placeholder text as the field's content. The substantive question — "did the game load?" — is answered YES (move list shows `1.e4d5`, board populated, analysis ran), but the textarea itself is genuinely empty. This is recorded below as I1, not B6.

This episode is itself the kind of "vision lies about the product truth" defect the hostile-reviewer persona exists to catch; I relied on the authoritative DOM probe (element `.value` + computed `placeholder`) over a loose visual read.

## Driver script
- `.pi/acceptance/swarm2/play-vision-review.mjs` — Playwright driver; 8 screenshots + `report.json`.
- `.pi/acceptance/swarm2/analyze-handoff-recheck.mjs` — focused re-probe of the Analyze handoff textarea vs move list.

## Screenshots (`.pi/acceptance/swarm2/screenshots/play-vision/`)
- `01-white-easy-e4-reply.png` — White vs Easy after 1.e4 d5
- `02-expert-e4-reply.png` — Expert after 1.e4 c5
- `03-play-black-engine-first.png` — Black side, engine moved 1.d3
- `04-takeback.png` — after take-back (board reset)
- `05-resign.png` — "You resigned. Black wins."
- `06-legal-highlights.png` — b1 knight selected, a3/c3 dots
- `07-illegal-move.png` — illegal e2→d3 attempt (no toast)
- `08-analyze-handoff.png` — Analyze page after handoff
- `08b-analyze-handoff-recheck.png` — re-probe screenshot

## Findings

### B1 — No visible feedback for illegal click-to-move  [BLOCKER]
**Where:** Play page, illegal move attempt (e2 pawn → d3, a non-capturing diagonal pawn move).
**What:** When a user selects a piece and clicks an illegal destination square, there is **no feedback whatsoever** — no toast, no banner, no red highlight, no shake, and no sound. The `showToast('Illegal move')` code in `PlayPage.handleMove` (PlayPage.tsx:311) is effectively **dead code for click-to-move**: `ChessBoard.handleSquareClick` (ChessBoard.tsx:234-284) only calls `onMove(uci)` when the destination is in `legalTargets` (the set of legal moves for the selected piece). When the user clicks an illegal square, the handler falls through to the "select another piece / deselect" branch and `onMove` is never invoked, so `handleMove`'s `showToast('Illegal move')` branch is unreachable. Only the drag path (`else playIllegalSound()` at ChessBoard.tsx:260,336) plays a sound for an illegal drop — and even that shows no toast.
**Evidence:**
- DOM scan after e2→d3 click: `toastCandidates: []` — no element anywhere contains "illegal"/"invalid"/"cannot"/"not legal"/"not allowed".
- Vision-checker on `07-illegal-move.png` (parent relay): "BLOCKER CONFIRMED: NO visible error feedback for illegal move. No toast, no popup, no notification, no red highlighting, no shake animation."
- Code: PlayPage.tsx:311 `showToast('Illegal move')` is only reached if `onMove` returns false; ChessBoard.tsx:247 `if (legalTargets.has(sq))` gates every `onMove` call, so illegal clicks never reach it.
**Why it matters:** A user who misclicks an illegal square sees the piece stay put with no explanation. They cannot tell whether the move was illegal, the app is lagging, or their click didn't register. This is a core feedback gap that makes the game feel broken to a hostile/skeptical user.

### I1 — Analyze handoff: PGN textarea left empty (placeholder shown) while the game loads  [IMPORTANT]
**Where:** Analyze page reached via Play page "Analyze this game" button (PlayPage `handleAnalyze` → `navigate('/analyze', { state: { pgn } })`).
**What:** The handoff **functionally works** — the game loads, the board populates, the move list renders `1.e4 e5`/`1.e4 d5`, navigation shows "0 / 2", and analysis runs. **However the "Paste PGN" `<textarea>` is left empty** (it shows its placeholder "1. e4 e5 2. ..."). `AnalyzePage.loadPgn` (AnalyzePage.tsx:265-282) sets `game`/`analysis`/`currentPly` but never calls `setPgnInput(pgn)`, so the textarea `value={pgnInput}` stays `''`.
**Evidence:**
- DOM re-probe (`analyze-handoff-recheck.mjs`): the only `<textarea>` on the page is `[data-testid="pgn-input"]` with `value: ""`, `valueLen: 0`, `placeholder: "1. e4 e5 2. ..."`, visible (rect 72,139,320×80). The move-list element `[data-testid="move-list"]` text is `"1.e4d5"` (game loaded). Navigation shows `0 / 2`.
- Code: AnalyzePage.tsx:227 `useState('')` for `pgnInput`; loadPgn (265-282) has no `setPgnInput` call; textarea bound at 388-393 with `value={pgnInput}`.
- Vision-checker (parent relay) misread the placeholder as content; overridden by the authoritative DOM probe (see Method caveat).
**Why it matters:** A user who just played a game clicks "Analyze this game", sees the board+analysis populate, but the "Paste PGN" field looks empty. They may conclude the handoff failed and re-paste, or be confused about what PGN is being analyzed. Not a hard break (analysis works), but a real UX defect and a misleading visual. The prior review's BLOCKER ("PGN not transferred") was too strong — the PGN *is* transferred and loaded — but the empty textarea is a genuine defect worth fixing (one line: `setPgnInput(pgn)` in loadPgn, or surface the loaded PGN read-only).

### N1 — Zero-height text-bearing elements  [NIT]
**Where:** Play page general layout.
**What:** 2 DOM elements have `textContent.trim().length > 0` but `clientHeight === 0` (hidden labels or icon glyphs).
**Evidence:** DOM sweep in the prior review; low impact, no visible glitch per vision-checker on the board/controls.
**Why it matters:** Cosmetic; likely sr-only or icon labels. Non-blocking.

## Product-truth gate results
- [x] Engine integration is real (not faked): PASS — Easy replied `1. e4 d5` instantly; Expert replied `1. e4 c5` (a real Sicilian, depth-18 Stockfish) within ~12s. Different moves at different depths confirm a real UCI engine, not a hardcoded reply.
- [x] Play-as-Black flips the board: PASS — engine moved first (`1. d3`); DOM geometry confirms flip: a8 at (654,651) bottom-right, h1 at (164,161) top-left. Black perspective correct.
- [x] Take-back reverts the board and move list: PASS — move list went from `1. e4 e6` to `No moves yet`, status `Your move`.
- [x] Resign produces a result indicator: PASS — status `You resigned. Black wins.` Vision confirms visible result text.
- [x] Legal-move highlights render: PASS — `::after` on a3/c3 has `opacity: 0.4`, `background rgba(0,0,0,0.25)`, 21px circle; d2/e4/b1 `::after` opacity 0 (not legal). Vision confirms visible dots. Highlights are dark/black translucent dots.
- [x] Board legibility / pieces rendering: PASS — vision-checker on `01-white-easy-e4-reply.png`: "Board fully legible, all pieces rendering correctly. Sidebar panels rendering cleanly. No visual glitches." Pieces are SVG images from `public/pieces/` (CBurnett set) loaded via `<img>`.
- [x] Analyze handoff loads the game: PASS — game, board, move list, and analysis all populate after handoff (move list `1.e4d5`, nav `0/2`).
- [ ] Illegal-move feedback visible to the user: FAIL — no toast, no sound, no visual indicator for illegal click-to-move (B1).
- [~] PGN textarea reflects the handed-off game: PARTIAL — game loads but the "Paste PGN" textarea is empty (placeholder shown) (I1). Not a transfer failure, but a visible mismatch.

## Summary
- **Findings:** 1 BLOCKER (B1), 1 IMPORTANT (I1), 1 NIT (N1).
- **Verdict:** REQUEST-CHANGES.
- The Play page is largely functional and visually sound: real Stockfish replies, board flips for Black, take-back/resign work, legal highlights render, and the Analyze handoff actually loads and analyzes the game. Two real defects remain: (1) zero feedback on illegal click-to-move (the toast path is dead code), and (2) the Analyze PGN textarea is left empty after handoff despite the game loading.

## Recommended fixes (for the writer; I am read-only to src/)
1. B1: Make illegal click-to-move surface feedback. Either (a) call `onMove(uci)` from ChessBoard for *any* click on a non-selected, non-own-piece square so `handleMove`'s `showToast('Illegal move')` fires, or (b) emit an `onIllegal()` callback from ChessBoard that PlayPage wires to `showToast`, and play the illegal sound on that path too (currently only drag plays it).
2. I1: In `AnalyzePage.loadPgn`, add `setPgnInput(pgn)` so the "Paste PGN" textarea reflects the loaded game (and so a user can edit/re-load it). One-line fix.
3. N1: Optional — audit the 2 zero-height text elements (likely sr-only labels; leave if intentional).
