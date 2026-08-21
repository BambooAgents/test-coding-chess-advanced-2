# User-Story Script — Play (ticket #16)

## Inputs
- URL: `/play`

## Steps

### Step 1 — Initial Play page
**Action:** Navigate to /play.
**VISIBLE:**
- A chess board renders (8x8 grid, pieces visible).
- A "New Game" button or game-start control is present.
- A strength/difficulty selector (e.g. Easy/Medium/Hard or ELO) is visible.
- The side-to-move indicator works.
**SPATIAL:** the board is centered or in its column; no overlap with controls.

### Step 2 — Start a game vs Easy engine
**Action:** Click "New Game" (Easy / low strength).
**VISIBLE:**
- Board resets to starting position.
- It's White's turn (or the chosen side).
- A legal-move highlight appears on click of a piece.
**DOM:** FEN is the starting position.

### Step 3 — Make a legal move; engine responds
**Action:** Play 1.e4 (click e2 pawn, click e4).
**VISIBLE:**
- The pawn moves to e4.
- Within ~3s the engine makes a Black response move (a piece moves).
- No error toast.
**BLOCKER if:** engine never responds, or responds instantly (hardcoded move).

### Step 4 — Illegal move is rejected
**Action:** Try to move a piece illegally (e.g. move a pawn backwards, or move e2-e5).
**VISIBLE:**
- The move is rejected (piece snaps back, or a red "Illegal move" toast appears).
- The board state is unchanged.
**BLOCKER if:** illegal moves are accepted.

### Step 5 — Take-back
**Action:** Click take-back / undo.
**VISIBLE:**
- The last move (yours and/or engine's) is retracted.
- It's your move again.
**DOM:** move count decremented.

### Step 6 — Resign + New Game
**Action:** Click "Resign", then "New Game".
**VISIBLE:**
- Resign shows a game-over / loss state.
- New Game resets to a fresh start.

### Step 7 — Analyze-handoff
**Action:** After a few moves, click "Analyze this game" (or similar).
**VISIBLE:** navigates to /analyze with the played game's PGN pre-filled; the
move list shows the moves you played.
**DOM:** the PGN textarea (or URL `?pgn=`) contains the played moves.
**BLOCKER if:** handoff is empty or navigates to a blank analyze page.

## Notes for reviewer
- Screenshot each step → `.pi/acceptance/swarm4/screenshots/play-step< n>.png`.
- Dispatch one vision-checker per screenshot with this step's VISIBLE expectations.
- Engine-response timing: use DOM to confirm FEN changes after engine move (text task).
- Cross-reference vision + DOM. Engine MUST be real Stockfish-WASM, not a hardcoded responder.
