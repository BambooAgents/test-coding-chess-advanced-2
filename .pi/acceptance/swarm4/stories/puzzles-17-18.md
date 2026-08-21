# User-Story Script — Puzzles (tickets #17, #18)

## Inputs
- URL: `/puzzles`

## Steps

### Step 1 — Plain puzzle loads
**Action:** Navigate to /puzzles (plain mode default).
**VISIBLE:**
- A non-starting chess position on the board (tactical mid-game, not 1.e4 e5).
- The side-to-move indicator shows whose turn it is.
- A puzzle rating is displayed.
- No "sample-*" or "test-*" IDs visible.
**DOM:** the loaded puzzle's FEN is NOT the starting position
(`rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`).
**BLOCKER if:** position is the starting position — that's synthetic data.

### Step 2 — Make the correct first move
**Action:** Play the puzzle's first solution move.
**VISIBLE:**
- The piece moves; the move is accepted (no "wrong" toast).
- A "Correct" / "Keep going" signal appears, OR the puzzle advances.
**BLOCKER if:** the correct tactical move is rejected.

### Step 3 — Solve to completion
**Action:** Play remaining solution moves.
**VISIBLE:**
- The puzzle completes with a "Solved" / "Success" state.
- Next puzzle loads automatically or via a button.
**DOM:** puzzle index advances (different FEN).

### Step 4 — Themed set
**Action:** Select a themed set (e.g. "Endgame" or "Pin").
**VISIBLE:**
- Themed puzzles load; the position is a real tactical position matching the theme.
- Theme label visible.
**DOM:** loaded FEN is non-starting.

### Step 5 — Puzzle Rush mode
**Action:** Start Puzzle Rush.
**VISIBLE:**
- A timer is displayed.
- Puzzles stream; correct moves advance, wrong moves cost time or lives.
- Timer counts down (live, not static).
**BLOCKER if:** timer never decrements, or no life/time counter exists.

### Step 6 — Death-Match mode
**Action:** Start Death-Match.
**VISIBLE:**
- A life counter (e.g. ❤ x N) is displayed.
- Wrong move costs a life; lives decrement visibly.
- At 0 lives, game over state appears.
**BLOCKER if:** lives never decrement, or no game-over on 0 lives.

## Notes for reviewer
- Screenshot each step → `.pi/acceptance/swarm4/screenshots/puzzles-step< n>.png`.
- Dispatch one vision-checker per screenshot with this step's VISIBLE expectations.
- For "non-starting position" checks, read the FEN from the DOM (text task, no vision needed).
- Cross-reference: step passes only when vision confirms appearance AND DOM confirms the data check.
