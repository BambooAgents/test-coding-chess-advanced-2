# User-Story Script — Analyze (tickets #14, #15)

> Authored by the orchestrator from the ticket requirements, not the
> worker's claims. The acceptance reviewer executes this step by step,
> cross-referencing vision-checker reports and DOM containment probes
> against each VISIBLE/SPATIAL expectation. ABSENT or DIFFERENT is a
> finding.

## Inputs

- **PGN:** the Opera Game (1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3
  dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+) — a
  real 21-ply game, not a test fixture.
- **URL:** `/analyze`

## Steps

### Step 1 — Load the game
**Action:** Paste the Opera Game PGN into the PGN box; click "Load PGN".
**VISIBLE:**
- The board updates to the game's start position (standard start).
- The move list populates with all 21 moves in pairs (1.e4 e5 … 11.Bxb5+).
- The opening name displays ("Unknown opening" is acceptable for this PGN).
- No error banner appears.
**SPATIAL:** the move list is in the right-side panel, beside the board.

### Step 2 — Analysis runs to completion
**Action:** Wait for the analysis to finish (≤40s).
**VISIBLE:**
- An "Analyzing… N/21" progress signal appears while running.
- On completion, the eval bar fills proportionally (not stuck at 0).
- Classification badges appear next to moves in the move list.
**DOM:** `accuracy` testid appears with White and Black accuracy percentages.
**BLOCKER if:** analysis hangs >60s with no progress, or never completes.

### Step 3 — Scrub to ply 1 (1.e4)
**Action:** Click the ▶ scrubber once (or click move 1 in the list).
**VISIBLE:**
- An indigo (#4f46e5) best-move arrow on the board from e2 to e4.
- A BOOK (grey #a3a3a3) badge OR no badge next to 1.e4 — 1.e4 is a top
  opening move and must NOT be marked ?!/? /??.
- The eval bar shows a small White advantage (~+0.2).
**SPATIAL:** the arrow SVG is contained inside the chess-board rect (DOM
containment probe required — vision alone is insufficient).
**BLOCKER if:** 1.e4 has a yellow ?! (inaccuracy) badge — it is a top move.

### Step 4 — Scrub to ply 19 (10.Nxb5)
**Action:** Scrub forward to ply 19.
**VISIBLE:**
- A purple (#a855f7) BRILLIANT (‼) badge next to 10.Nxb5 in the move list.
- The move list auto-scrolls so move 10 is visible in the panel.
- An indigo arrow on the board showing the knight's move (d4→b5).
**SPATIAL:**
- The brilliant badge span is inside the move-list rect.
- The arrow SVG is inside the board rect.
**BLOCKER if:** the brilliant badge is missing, off-screen (no auto-scroll),
or the arrow renders outside the board.

## Notes for the reviewer

- For each step, screenshot to `.pi/acceptance/swarm2/screenshots/analyze-step< n>.png`.
- Dispatch one vision-checker per screenshot with THIS step's VISIBLE/SPATIAL
  expectations, asking it to report PRESENT/ABSENT/DIFFERENT per expectation.
- For every SPATIAL line, also run a `getBoundingClientRect` containment probe
  and require `contained === true`. Vision hallucinates positions; the DOM
  probe is authoritative for spatial containment.
- Cross-reference: a step passes only when vision confirms appearance AND
  the DOM probe confirms containment.
