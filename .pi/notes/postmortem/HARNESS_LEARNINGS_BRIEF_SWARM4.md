# Harness Learnings Brief — Swarm 4 Post-Analysis

> **Date:** 2026-08-21
> **Scope:** Analysis of all swarm 4 agent logs, transcripts, and artifacts
> after the first successful end-to-end run under the new harness (user-story
> scripts + two-tier vision + DOM containment probes + absolute text-only
> rule). This document captures learnings, implemented fixes, and
> suggested improvements.

## 1. What worked (validated by the logs)

### 1.1 The two-tier vision architecture is reliable
- **0 4-image-cap hits** across 21 vision-checker runs. The architecture
  (GLM-5.2 orchestrator dispatches Qwen vision-checkers, 1 image per fresh
  conversation) completely eliminated the 422 "at most 4 images" crash that
  plagued earlier swarms.
- **0 nesting-depth blocks.** `maxSubagentDepth: 2` (acceptance-reviewer at
  depth 1, vision-checker at depth 2) is the correct setting.
- **21 vision-checker runs completed cleanly.** Each read 1 screenshot and
  returned a detailed text report.

### 1.2 The absolute text-only rule held
- **0 reviewers read a screenshot directly.** All 6 acceptance-reviewers
  (GLM-5.2, text-only) dispatched vision-checker subagents for every
  screenshot. None tried to `read` a `.png` file themselves.
- **0 read-only violations.** No reviewer edited any `src/` file. All writes
  went to `.pi/acceptance/`.
- The hammered-down "THE FIRST RULE" section at the top of
  `acceptance-reviewer.md` worked.

### 1.3 The user-story script caught a real bug the old harness missed
- The Weaknesses reviewer caught the "Unknown" openings bug (B1) because the
  story script's Step 2 explicitly required "opening names … NOT a hardcoded
  fixture." The reviewer cross-referenced the vision report (which
  independently flagged "Unknown") against a DOM probe (30/30 rows showed
  "Unknown") and a code probe (root cause in `getOpening()`).
- This is the validation that the new harness (F25/F26) actually improved
  detection, not just paperwork.

### 1.4 The arrow-bleed fix held and was verified by DOM probe
- The visual-home reviewer's containment probe confirmed
  `svg rect == board rect` (both 164,365,560×560), `contained: true`.
- The analyze reviewer independently confirmed `svgContainedInBoard: true`.
- The bug that escaped the prior swarm (arrows across the viewport) did NOT
  recur, and the mandatory containment probe would have caught it if it had.

### 1.5 Parallel swarm coordination worked
- 5 reviewers dispatched in parallel, all completed within ~23 minutes.
- No capacity-limit hits (max 11 spawns by any reviewer, cap is 32).
- No async-deadlock issues (the prior swarms' paused-run capacity problem
  was already fixed by raising `maxActiveAsyncRunsPerSession` to 8).

## 2. What didn't work (gaps found in the logs)

### 2.1 [GAP] Only 2 of 6 reviewers ran containment probes
- The harness mandates DOM `getBoundingClientRect` containment probes for
  every SPATIAL expectation. In practice:
  - **analyze:** 2 probes (ran them, reported `svgContainedInBoard: true`)
  - **visual-home:** 1 probe (ran it, reported `contained: true`)
  - **play, puzzles, weaknesses, weaknesses-rereview:** 0 probes
- Partly explained: the puzzles and weaknesses stories had 0 SPATIAL
  expectations (only VISIBLE). But the play story had 1 SPATIAL line and the
  reviewer skipped it.
- **Root cause:** the §5 instruction was descriptive ("mandatory for every
  visual element") but not enforced as a hard gate. A reviewer could skip it
  and still write a report.
- **Fix applied:** rewrote §5 to explicitly say "A step with a SPATIAL
  expectation that does not include a containment-probe result is NOT
  verified — report it as NOT_RUN." This makes the skip visible in the
  report rather than silent.

### 2.2 [GAP] Vision-checkers returned freeform text, not structured verdicts
- The acceptance-reviewer passes VISIBLE EXPECTATIONS to each vision-checker
  and asks for PRESENT/ABSENT/DIFFERENT per expectation. But the
  vision-checker agent def didn't tell the vision model to respond in that
  format — it asked for "exhaustive description."
- Result: **20 of 21 vision-checkers returned freeform descriptions** with
  no per-expectation verdict. The reviewers had to manually cross-reference
  the freeform text against the script expectations (error-prone,
  non-deterministic).
- **Fix applied:** added an explicit output format to `vision-checker.md`:
  if the task includes VISIBLE EXPECTATIONS, the vision-checker MUST respond
  per-expectation as `EXPECTATION: ... VERDICT: PRESENT|ABSENT|DIFFERENT
  DETAIL: ...`. This makes the cross-reference mechanical.

### 2.3 [GAP] Discovery tax — reviewers waste 1–8 min before first vision-checker
- Time to first vision-checker dispatch per reviewer:
  - play: 142s, analyze: 153s, weaknesses: 65s (reasonable)
  - puzzles: 473s (8 min), visual-home: 437s (7 min) (excessive)
- The puzzles and visual-home reviewers spent 7–8 minutes discovering the
  environment: `ls`, `cat package.json`, `p-browser --help`, `playwright
  --help`, reading source files, finding testids. The weaknesses reviewer
  spent 39 of 62 bash calls (63%) on p-browser/playwright discovery.
- This is a "cold start" problem — every fresh-context reviewer rediscovers
  the same environment facts independently.
- **Suggested fix:** add an "environment briefing" section to the
  acceptance-reviewer task (or a shared `.pi/acceptance/ENVIRONMENT.md`)
  that pre-states: the dev server URL, the routing mode (BrowserRouter vs
  hash), the browser tool (`p-browser` vs `npx playwright`), the testid
  inventory, and the data-file locations. Reviewers read one file instead of
  rediscovering. (Not yet implemented — see open questions.)

### 2.4 [GAP] Playwright `cli` element-ID selectors are fragile
- The weaknesses reviewer used `playwright cli fill e18 "hikaru"` —
  element IDs like `e18`, `e22`, `e438` are auto-generated and shift between
  runs/builds. When they shift, the command fails and the reviewer has to
  re-discover the selector.
- The other reviewers wrote node scripts using robust selectors
  (`input[placeholder*="hikaru"]`, `button:has-text("Analyze")`), which are
  stable.
- **Suggested fix:** the acceptance-reviewer agent def should recommend
  writing a single node Playwright script (with CSS/text selectors) per
  story rather than issuing many `playwright cli` one-shots with element
  IDs. The node-script approach was used by play, analyze, visual-home and
  was more reliable. (Not yet implemented.)

### 2.5 [GAP] Artifact sprawl — reviewers leave probe scripts in the tree
- 6 reviewers left behind: 17 `.mjs` scripts, 10 `.json` probe dumps, 48
  screenshots, 5.7MB total in `.pi/acceptance/swarm4/`.
- 36 untracked files polluted `git status`. These got swept into the commit
  because `git add .pi/acceptance/swarm4/` grabbed everything.
- **Suggested fix:** reviewers should write all scratch scripts/probes to a
  single throwaway subdir (e.g. `.pi/acceptance/swarm4/scratch/`) that can
  be gitignored, keeping only the final `.md` reports and `stories/` in the
  tracked tree. (Not yet implemented.)

### 2.6 [GAP] The `--accent` color clash made pixel probes unreliable
- The arrow color (`#4f46e5`) is the same as the UI `--accent` color
  (`--accent: #4f46e5`). Pixel-level probes for "indigo pixels outside the
  board" matched buttons, nav tabs, and links too — producing false
  positives that required region-specific filtering.
- This is not a bug per se, but it made the manual pixel-probe investigation
  (during the vision-blindness diagnosis) harder than it needed to be.
- **Suggested fix:** the arrow color should be distinct from any UI accent
  color (e.g. a dedicated `--arrow: #6366f1` or a contrasting hue). This
  would make future pixel-level diagnostics trivial. Low priority — the
  DOM containment probe is the authoritative spatial check and doesn't
  depend on color. (Not yet implemented — product, not harness.)

## 3. Implemented fixes (this analysis)

### 3.1 vision-checker structured output (fix 2.2)
`vision-checker.md` now requires per-expectation `VERDICT: PRESENT|ABSENT|
DIFFERENT` output when the task includes VISIBLE EXPECTATIONS. This makes
the cross-reference mechanical instead of interpretive.

### 3.2 Containment-probe enforcement (fix 2.1)
`acceptance-reviewer.md` §5 now explicitly states a step with a SPATIAL
expectation and no containment-probe result is NOT_RUN, not silently
passed. The skip is now visible in the report.

## 4. Suggested improvements (not yet implemented)

### 4.1 Environment briefing file (fix 2.3)
Create `.pi/acceptance/ENVIRONMENT.md` (or embed in the reviewer task) with:
- Dev server URL and routing mode
- The browser tool to use (`p-browser` path or `npx playwright`)
- The testid inventory (`grep -rn "data-testid" src/` output)
- Data file locations (`src/data/puzzles.json`, etc.)
- The PGN to use for analyze
Reviewers read one file instead of spending 5–8 min rediscovering.

### 4.2 Single-script-per-story pattern (fix 2.4)
Update `acceptance-reviewer.md` to recommend writing ONE node Playwright
script per story (with CSS/text selectors) that drives the whole story and
emits structured JSON per step, rather than issuing many `playwright cli`
one-shots with fragile element IDs. The node-script approach was used by 3
of 6 reviewers and was more reliable and faster.

### 4.3 Scratch-dir convention (fix 2.5)
Add `.pi/acceptance/swarm*/scratch/` to `.gitignore` and instruct reviewers
to write probe scripts/probes there, keeping only final `.md` reports and
`stories/` in the tracked tree.

### 4.4 Structured-report schema for reviewers
The vision-checker now outputs structured per-expectation verdicts, but the
reviewer's final report is still freeform markdown. A structured schema
(per-step: {action, screenshot, vision_verdicts, dom_probe, pass/fail})
would make consolidating 5 reviewer reports into a final verdict
mechanical. Currently the orchestrator (me) reads 5 markdown files and
manually extracts verdicts.

### 4.5 Testid convention enforcement
Several reviewers spent time finding testids. The app should have a
complete testid inventory (every interactive element + every visual element
with a spatial constraint has a `data-testid`). The chess board, arrow SVG,
eval bar, move list, and badges all need testids. Most exist, but the
reviewer had to grep to find them. A documented inventory in
`docs/agents/testids.md` would eliminate this.

## 5. Open questions

### 5.1 Should the orchestrator auto-generate the environment briefing?
The discovery tax (2.3) is the biggest efficiency leak. Should the
orchestrator generate `.pi/acceptance/ENVIRONMENT.md` automatically before
dispatching the swarm (by running `grep -rn "data-testid" src/`, checking
the dev server, detecting the router mode)? Or should it be a static doc
maintained by the developer? Auto-generation is more robust to code
changes but adds orchestrator complexity.

### 5.2 Should reviewers share a single browser session?
Currently each reviewer opens its own Playwright browser. For a 5-reviewer
swarm, that's 5 chromium processes. Could reviewers share a single browser
session (different tabs/pages)? This would reduce memory but complicate
isolation (one reviewer's navigation could affect another's). Probably not
worth it — the isolation is more valuable than the memory savings.

### 5.3 Is the vision-checker's freeform detail still useful?
With the new structured PRESENT/ABSENT/DIFFERENT output, the vision-checker
also emits a freeform detail report. Is the freeform detail still
necessary, or does it just add tokens? The freeform detail caught the
"Unknown" openings bug (the vision-checker described "all openings show
Unknown" in freeform even though the task didn't list "opening names" as
an expectation in early runs). Keeping both is probably right — structured
for the contract, freeform for serendipitous discovery.

### 5.4 How to handle chess.com API rate limits in acceptance?
The weaknesses reviewer hit the real chess.com pubapi for 50 games
(hikaru) + 20 games (magnuscarlsen) = 70 games. This worked, but a larger
review or a rate-limited window could fail. Should the acceptance harness
cache chess.com responses (e.g. a fixture recorded from a real call) for
reviewers to use, with a flag that says "this is a real recording, not a
synthetic fixture"? This would make the review deterministic without
compromising the "real data" gate. Tension: the whole point of the
real-data gate is that it's NOT a fixture.

### 5.5 Should the containment probe be a reusable helper?
Each reviewer wrote its own `getBoundingClientRect` containment probe from
scratch. A shared helper (`.pi/acceptance/probes/containment.mjs` exporting
`probeContainment(page, childSelector, parentSelector)`) would reduce
duplication and ensure consistent reporting. Low priority — the probes are
3–5 lines.

## 6. Metrics summary

| Metric | Value |
|--------|-------|
| Reviewers dispatched | 6 (5 initial + 1 re-review) |
| Vision-checkers spawned | 21 |
| 4-image-cap hits | 0 |
| Nesting-depth blocks | 0 |
| Text-only rule violations | 0 |
| Read-only violations | 0 |
| Containment probes run | 3 (by 2 of 6 reviewers) |
| Total wall clock (parallel wave) | ~23 min |
| Discovery tax (avg time to first VC) | ~240s (4 of 6 over 140s) |
| Artifacts left behind | 17 .mjs, 10 .json, 48 screenshots, 5.7MB |
| Real bugs caught | 1 (B1 Unknown openings) + 2 downstream (I1, N1) |
| False positives | 0 (the new harness eliminated the prior swarms' DOM-probe false positives) |

## 7. Conclusion

The new harness (F25/F26) works. The first full run under it caught a real
product-truth bug the old harness missed, the arrow-bleed spatial bug did
NOT recur, the two-tier vision architecture was reliable (0 cap hits, 0
blocks), and the absolute text-only rule held across all reviewers. The
remaining gaps are efficiency issues (discovery tax, artifact sprawl) and
enforcement issues (containment-probe skip, freeform vision output), both
addressed in this analysis with two fixes applied and four suggestions
documented.
