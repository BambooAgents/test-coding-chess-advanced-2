# Acceptance Report — Play Page Review

**Date:** 2024-12-19
**Verdict:** REQUEST-CHANGES
**Boot:** OK (dev server running at http://localhost:5183/test-coding-chess-advanced-2)
**Pages visited:** /play, /analyze (via handoff)
**Features exercised end-to-end:** New game, difficulty switching, side selection, move input, engine response, take-back, resign, analyze handoff

## Findings

### B6 — PGN textarea empty after Analyze handoff  [BLOCKER]
**Where:** Analyze page, accessed via "Analyze this game" button on Play page
**What:** When clicking "Analyze this game" after playing moves, the Analyze page loads but the PGN textarea is empty. The game state is not being transferred.
**Evidence:** 
- Played 1. e4 e5 on Play page
- Clicked "Analyze this game" button
- URL changed to `/analyze` correctly
- PGN textarea found but `inputValue()` returned empty string (length: 0)
- PlayPage.tsx line 232-247: `handleAnalyze` builds PGN via `writePgn(game)` and calls `navigate('/analyze', { state: { pgn } })`
- Likely the AnalyzePage is not reading `location.state.pgn`
**Why it matters:** The "Analyze this game" feature is completely broken. Users cannot analyze games they just played, which is a core workflow.

### I3 — Illegal move toast not visible  [IMPORTANT]
**Where:** Play page, when attempting an illegal move (e2-d3)
**What:** When attempting an illegal move (pawn moving diagonally without capture), no feedback is shown to the user. The Toast component exists in PlayPage.tsx but is not displaying.
**Evidence:**
- Clicked e2 square, then d3 square (illegal pawn move)
- Searched all div elements for text containing "Illegal"
- No element found with "Illegal" text
- PlayPage.tsx line 145: `showToast('Illegal move')` is called when `onMove` returns false
- PlayPage.tsx line 207: Toast component rendered with `$show={toast !== ''}`
- Possible issue: Toast may be rendering but not visible, or toast state not updating
**Why it matters:** Users receive no feedback when their move is rejected, making the game confusing and frustrating.

### N1 — Two zero-height elements detected  [NIT]
**Where:** Play page general layout
**What:** Visual quality check found 2 elements with text content but zero height.
**Evidence:** DOM inspection found 2 elements with `textContent.trim().length > 0` but `height === 0`
**Why it matters:** Minor visual glitch, may be hidden labels or icons. Low impact.

## Product-truth gate results

- [x] Engine integration is real (not faked): PASS — Easy (depth=1) replied instantly with e6/d5/e5, Expert (depth=18) replied within 15s with c5
- [x] Every primary user flow reaches a non-dead-end: PASS — New game, take-back, resign all work correctly
- [x] Board renders correctly for both sides: PASS — Board visible as White and Black, pieces render (4 piece images detected)
- [x] Legal move highlights work: PASS — ::after pseudo-element visible with opacity 0.4 on legal destinations (a3, c3 when knight at b1 selected)
- [ ] Analyze handoff transfers PGN: FAIL — PGN textarea empty after navigation
- [ ] Illegal move feedback visible: FAIL — No toast shown

## Screenshots
(Not captured — DOM-only inspection per task requirements)

## Test Execution Details

**Script:** `.pi/acceptance/swarm2/play-review.mjs`
**Test results:**
1. Start game as White vs Easy, make e4, engine replies: PASS (1. e4 e6)
2. Expert difficulty engine plays: PASS (1. e4 c5 within 15s)
3. Play as Black, engine moves first: PASS (status: "Stockfish is thinking...")
4. Take-back reverts board and move list: PASS (move list cleared, e2 has white pawn)
5. Resign ends game with result: PASS (status: "You resigned. Black wins.")
6. New game after resign resets state: PASS (status: "Your move", move list empty)
7. Legal move highlights via ::after pseudo-element: PASS (opacity 0.4, rgba(0,0,0,0.25), 21px circle)
8. Illegal move feedback: FAIL (no toast found)
9. Analyze handoff with PGN: FAIL (textarea empty)
10. Visual quality (invisible text, zero-height, off-screen): PASS (0 invisible, 2 zero-height, 0 off-screen)

## Summary

**Total findings:** 2 (1 BLOCKER, 1 IMPORTANT, 1 NIT)

**Verdict:** REQUEST-CHANGES

The Play page is mostly functional but has one critical blocker: the "Analyze this game" handoff does not transfer the PGN to the Analyze page. This breaks a core user workflow. Additionally, the illegal move feedback toast is not displaying, leaving users without feedback when they attempt invalid moves.

**Recommended fixes:**
1. Fix AnalyzePage to read PGN from `location.state.pgn` (react-router state)
2. Debug Toast component visibility on PlayPage (check z-index, positioning, or state update timing)
