# User-Story Script — My Weaknesses (ticket #19)

## Inputs
- URL: `/weaknesses`
- A REAL chess.com username known to have public games (e.g. "hikaru").

## Steps

### Step 1 — Initial Weaknesses page
**Action:** Navigate to /weaknesses.
**VISIBLE:**
- A chess.com username input field is present.
- A "Load games" / "Analyze" button is present.
- The page is not empty/broken.

### Step 2 — Load real games
**Action:** Type "hikaru" into the username field; click Load.
**VISIBLE:**
- A loading/progress signal appears (spinner or "Fetching…").
- Within ~20s a report renders (not an empty page).
- The report shows real game-derived content: opening names, loss
  categories, or weakness themes — NOT a hardcoded fixture.
**DOM:** at least one game title / date / opening appears in the DOM text.
**BLOCKER if:** the report is empty, errors out, or shows hardcoded
  placeholder content regardless of username.

### Step 3 — Weakness recommendations render
**Action:** Read the report.
**VISIBLE:**
- A list of weakness areas (e.g. "Endgames", "Tactical mistakes in X
  opening") with counts or severity.
- Recommendations or links to practice the weak areas.
- The content reflects real games (e.g. openings Hikaru actually plays),
  not a static template.

### Step 4 — Live update on username change
**Action:** Change username to another real player (e.g. "magnuscarlsen")
and reload.
**VISIBLE:**
- The report content CHANGES (different openings / different game count).
- Not identical to the previous username's report.
**BLOCKER if:** report is identical regardless of username (hardcoded fixture).

## Notes for reviewer
- Screenshot each step → `.pi/acceptance/swarm4/screenshots/weaknesses-step< n>.png`.
- Dispatch one vision-checker per screenshot.
- The chess.com pubapi call is real (network task — check it hits pubapi.chess.com, not a fixture).
- Cross-reference: report content must vary by username (real data), verified via DOM text.
