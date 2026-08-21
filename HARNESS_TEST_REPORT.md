# Harness Test Report — test-coding-chess-advanced-2

**Primary goal:** Test the autonomous agent coding harness end-to-end — multiple branches, multiple sub-agents (with sub-sub-agents), multiple reviews, all orchestrated via the GitHub issue tracker + branches, running fully autonomously (unattended/overnight). The chess product is the vehicle; the harness test is the primary deliverable.

This file is a running log. Final synthesis at the end.

## Running log of harness issues / flags

(append as discovered; each entry: time, area, issue, impact, workaround)

### F1 — wayfinder skill not in available_skills list
- **Area:** skill discovery / skill manifest
- **Issue:** The `wayfinder` skill exists at `shared/skills/coding/mattpocock/v1.1.0/wayfinder/SKILL.md` and is referenced by the mattpocock skill set, but it does not appear in the session's `<available_skills>` manifest. Only `code-review`, `codebase-design`, `diagnosing-bugs`, `domain-modeling`, `grilling`, `prototype`, `research`, `resolving-merge-conflicts`, `tdd`, `playwright-cli`, `pi-subagents`, `autonomous-coding` were advertised.
- **Impact:** The model cannot know wayfinder exists except by filesystem discovery; user had to name it. If a user said "plan this big thing" without naming wayfinder, the model would never reach it.
- **Workaround:** Read the SKILL.md directly from disk. Works fine manually.
- **Suggestion:** Add `wayfinder` to the skill manifest (it's in the same v1.1.0 set as the other Matt Pocock skills that *are* listed). Likely an oversight in skill registration.

### F2 — wayfinder chart-the-map is HITL-first, conflicts with AFK autonomous mode
- **Area:** wayfinder skill design vs. autonomous-coding mode
- **Issue:** Wayfinder "Chart the map" step 1 mandates a `/grilling` + `/domain-modeling` HITL session to pin the destination; grilling is explicitly HITL ("the agent never stands in for the human's side of it"). The user is AFK and wants the run to proceed autonomously overnight.
- **Impact:** Strict wayfinder would block here. The two policies conflict for an unattended run.
- **Workaround:** Per the project AGENTS.md autonomy policy ("Make sensible reversible implementation/product decisions and continue. Ask only for consequential product choices"), I made the destination/scoping decisions myself (building a chess app is reversible/non-consequential) and recorded them in the map, flagging them as agent-decided-pending-human-review.
- **Suggestion:** Wayfinder could define an explicit "autonomous charting" mode where the agent makes and records reversible scoping decisions when no human is present, instead of blocking. Or the harness could auto-resolve HITL wayfinder tickets to a sensible default with a "pending human" marker.

### F3 — destination made autonomously (recorded for human review)
- **Decision:** Build a web-based "advanced chess" application. Tech stack: Vite + React + TypeScript, with the chess engine and AI opponent implemented in TypeScript (shared language with UI for reliability). Tests: Vitest (engine/AI logic), Playwright (UI). See the wayfinder map issue for the full destination and feature set.
- **Reversibility:** High — greenfield, no existing code to break; stack can be swapped early.
- **Human review requested:** Confirm stack + feature set when back. Non-blocking.

## What went well
(to fill at end)

## What didn't go well
(to fill at end)

## Bugs in the system
(to fill at end)

## Suggested improvements to the agentic coding architecture / autonomous-coding skill
(to fill at end)

---

## F23 — Acceptance-gate fix loop (2026-08-21)

After the harness acceptance-reviewer gate was added, a hostile-reviewer swarm found 4 BLOCKERs that all previous gates (tsc/eslint/vitest/playwright + code review) had missed. The fix loop then demonstrated the gate working as designed.

### What the hostile swarm found (all BLOCKERs, all missed by prior gates)
- **B1**: Puzzle bundle 100% synthetic (17 templates × 140 copies, all `sample-*` IDs, starting-position FENs). Shipped as "real lichess CC0." tsc/eslint/260 vitest/build all green.
- **B2**: `multiPv2` faked (returns `eval - 250` phantom; code comment admitted it). Brilliant badge never fired. 260 vitest green.
- **B3**: Analysis hangs forever on any game ending in checkmate (Stockfish sends `info depth 0 score mate 0` and NO `bestmove` line; `getEvaluation` waited forever). 32 playwright green.
- **B5**: "Show Solution" showed buttons but not the solution moves.

### The fix loop (hostile review → fix workers → independent re-review)
1. Spawned 5 parallel acceptance-reviewer children (fresh, hostile, different attack surfaces).
2. Consolidated findings into 5 BLOCKERs.
3. Dispatched 3 parallel fix workers (worktree isolation, one writer each). All 3 succeeded (tsc/eslint/vitest/build green).
4. A 4th fix was needed after I discovered the real B3 root cause (Stockfish sends no `bestmove` on checkmate) via a direct browser debug test. Dispatched a targeted worker.
5. Re-ran independent hostile acceptance reviewer (fresh context) — **ACCEPTED**, all 4 BLOCKERs verified fixed with product-truth evidence.

### What the gate caught that prior gates missed
- **Fake data**: the puzzle bundle passed all type/lint/test gates because the fake data matched the schema. Only a hostile reviewer that checked the actual IDs/FENs/themes caught it.
- **Faked engine integration**: the `eval - 250` phantom passed all tests because the adapter interface was satisfied. Only a reviewer that read the implementation and checked for real UCI commands caught it.
- **Edge-case hang**: the checkmate hang passed 32 playwright tests because none of them tested a game ending in checkmate. Only a reviewer that tested a real complete game caught it.
- **Missing UX**: the invisible solution passed because the buttons rendered. Only a reviewer that clicked "Show Solution" and checked what was displayed caught it.

### Harness bugs observed during the fix loop
- **Worktree branch loss (recurring)**: 2 of 4 fix workers committed in their worktrees, but the worktree branches were discarded after completion (the commits became dangling). I recovered them via `git fsck --lost-found` for 2, but 1 was lost entirely and had to be re-derived from the session transcript + the fix re-applied. This is Bug 4 (detached-HEAD worktree push no-op) from HARNESS_FIX_PROMPT.md, recurring.
- **`acceptance-reviewer` agent not visible in async workflow children**: the agent def lived on the orchestrator's branch but not the children's checkout. Fixed by committing the agent def onto the integration branch.
- **Model override mismatch**: the agent def pinned `anthropic/claude-sonnet-4` which isn't in the model registry. Fixed by dropping the override.
- **Reviewer children hang on Playwright/intercom**: 3 of 5 reviewers got stuck on long Playwright runs or the intercom-pause pattern. Steered them to finalize; interrupted the ones that wouldn't. The acceptance-reviewer would benefit from a per-tool-call timeout (Bug 5).
- **Very long wait (405 min)**: one reviewer ran for 7 hours because it got stuck writing a Playwright script. The harness should bound reviewer wall-clock.

### Outcome
- **Product**: ACCEPTED by hostile review. Real puzzles, real MultiPV, Brilliant fires, checkmate analysis completes, solution displayed.
- **Gate proven**: the acceptance-reviewer gate caught 4 BLOCKERs that all prior gates missed. The fix loop (find → fix → re-review) converged in one round.
- **Tests**: 260 → 284 vitest (+24 new, all green).

## F24 — Acceptance-reviewer was blind (no vision model pinned) [CRITICAL]

**What happened:** The acceptance-reviewer agent def had no `model:` field, so
it used the default text-only model (GLM-5.2). It captured screenshots but
could not read them — every `read` of an image returned `[Current model does
not support images. The image will be omitted from this request.]`. It fell
back to verifying via `innerText`, which catches data-model bugs but not
visual presentation bugs.

**What escaped:** Three visual bugs shipped past "ACCEPTED" review:
1. Brilliant badge `color: transparent` (invisible) — `innerText` found `!!`
2. Eval bar fill `height: 0px` (styled-components transient-prop bug)
3. No auto-advance after analysis (page looked empty)

**Root cause:** One missing line in `acceptance-reviewer.md`. The
`visual-reviewer` agent (which pins `model: tng/Qwen/Qwen3.5-397B-A17B-FP8`)
successfully read screenshots and found real bugs. The `acceptance-reviewer`
agent (no model field) could not. Same harness, same screenshots, different
model = different outcome.

**Fix:** Pinned `model: tng/Qwen/Qwen3.5-397B-A17B-FP8` in
`acceptance-reviewer.md`. Verified: the agent now reads screenshots and
describes real visual details (eval bar fill level, badge glyphs, board state).

**Lesson:** Agent defs that verify visual output MUST pin a vision-capable
model explicitly. The default model is text-only and cannot read images.
An agent prompt that says "be specific and visual" is useless if the agent
literally cannot see. This is a one-line config, not a deep harness bug.

**Also:** the `visual-reviewer` agent (which DID have the right model) found
a real board/move-list desync bug in the manual session that all the blind
acceptance reviewers missed entirely. Vision matters.

## F25 — Vision swarm blindness: three stacked failures let a glaring arrow-bleed bug ship [CRITICAL]

**What happened:** After F24, the acceptance-reviewer was upgraded to a
vision-capable model. But a new, glaring visual bug — the board best-move
arrow SVG rendering across the *entire viewport* into the nav bar and move
list (because `BoardGrid` lacked `position: relative`, so the SVG's
`position: absolute; inset: 0` resolved against the viewport instead of the
board) — shipped past 20 vision-checker runs and two review rounds. A human
caught it in one glance at a screenshot.

**What escaped:** indigo arrows drawn diagonally across the page
background, nav tabs, and move list — not on the board — on 7 of 11 analyze
screenshots. The acceptance swarm's `analyze.md` report claimed "best-move
arrows render on the board."

**Root cause — three independent failures stacked:**

1. **Nesting-depth cap killed the first vision wave.** The analyze
   orchestrator dispatched 4 vision-checkers; ALL 4 failed with `Nested
   subagent call blocked (depth=1, max=1)`. It never got any vision data.
2. **The orchestrator wrote a visual verdict anyway.** Instead of reporting
   "vision unavailable," it asked the supervisor, which dispatched
   parent-level vision-checkers that *hallucinated* the arrow's position
   ("purple arrow from f7 toward d5" on a screenshot where the arrow was
   in the nav bar). The orchestrator then wrote "arrows render on the
   board" based on hallucinated relayed reports.
3. **The vision-checker prompt was a leading question.** It asked "Are there
   any arrows drawn on the board?" — assuming the arrow IS on the board.
   The model sees indigo pixels, invents plausible from/to squares, and
   reports "no glitches." Proven by re-running the same model on the same
   screenshot with old vs new prompt: old → "correctly on the board, e5 to
   d4"; new → "BLOCKER: arrow NOT on the board, spans nav bar to move list."

**The deeper pattern:** vision models are unreliable for spatial-position
verification. They hallucinate "on the board" when an arrow is in the nav
bar. The DOM probe checked `arrowCount` (SVG has children) and reported
"arrows render" — but never compared the SVG's `getBoundingClientRect()` to
the board's. A 3-line containment check would have caught it instantly, and
the text orchestrator (GLM-5.2) can do that reliably without vision.

**Fixes applied (commit `e99cc21`, `9e7efcf`):**
- `vision-checker.md`: rewrote the arrow/overlay section to require EXACT
  region specification per arrow, explicit warning not to assume arrows are
  on the board, flag any arrow outside the board grid as BLOCKER. Verified
  working on the same screenshot the old prompt missed.
- `acceptance-reviewer.md`: added §5 (mandatory DOM `getBoundingClientRect`
  containment probes for every visual element with a position constraint)
  and the absolute text-only rule (see F26).
- `VISUAL_SWARM_BLINDNESS.md`: full investigation report.

**Lesson:** Vision models are unreliable for spatial verification. The
harness MUST use DOM containment checks (which the text orchestrator can do
reliably) as the primary spatial-correctness gate, with vision only for
subjective confirmation. A vision report saying "on the board" is not
evidence; a `getBoundingClientRect` containment check is.

## F26 — User-story-driven review + absolute text-only rule [HARNESS FIX]

**What happened:** F25 showed a reviewer with no explicit visual target
invents its own (loose) target and misses defects. A vision model asked
"are there arrows on the board?" says "yes" regardless of where the arrow is.

**Fix:** Two harness changes (commit `9e7efcf`):

1. **User-story-driven review pipeline.** The orchestrator now authors a
   detailed visual user-story script per ticket (stored in
   `.pi/acceptance/stories/<ticket>.md`) BEFORE launching reviewers — a
   step-by-step description of what a user does and what they should VISIBLE-
   see at each step, derived from the ticket requirements, with explicit
   SPATIAL expectations (which element is inside which container). The
   reviewer executes the script step by step: performs each user action,
   screenshots, dispatches a vision-checker with that step's VISIBLE
   expectations, runs a DOM containment probe for each SPATIAL expectation,
   and cross-references both against the script. A step passes only when
   vision confirms appearance AND the DOM probe confirms containment. No
   script = BLOCKER on the review (no visual verdict without a contract).

2. **The absolute text-only rule.** Hammered down in both
   `acceptance-reviewer.md` (as THE FIRST RULE, at the top) and
   `docs/agents/acceptance.md`: a text-only model (GLM-5.2) has NO vision.
   Any visual fact it states is a hallucination. Four absolute sub-rules:
   - NEVER describe what a screenshot shows.
   - NEVER substitute a DOM probe for appearance checks (contrast,
     legibility, color visibility need vision).
   - NEVER substitute vision for spatial-containment checks (vision
     hallucinates positions; use DOM containment).
   - NEVER write a visual verdict when vision-checkers fail.
   DOM probes AND vision are both required — they check different things.
   A gate passes only when BOTH agree.

**Validation — Swarm 4 (the first run under the new harness):** 5 parallel
fresh reviewers, all using user-story scripts + two-tier vision + DOM
containment probes. Results: Analyze ACCEPTED, Puzzles ACCEPTED, Play
ACCEPTED, Visual/Home ACCEPTED (arrow-bleed confirmed NOT recursing via DOM
containment probe), Weaknesses REQUEST-CHANGES (caught a real bug — see F27).

**Lesson:** An explicit visual contract (the user-story script) +
cross-referencing vision against DOM containment is what makes the visual
review trustworthy. A reviewer with a concrete checklist ("indigo arrow ON
the board e2→e4; BOOK badge next to 1.e4; arrow SVG contained in board rect")
catches defects a reviewer told "check the analyze page" misses.

## F27 — Swarm 4 caught a real product-truth bug the prior swarms missed [VALIDATION]

**What happened:** Under the new harness (F25+F26 fixes), Swarm 4's
Weaknesses reviewer caught a genuine defect no prior swarm flagged: every
opening in the My Weaknesses Openings table showed "Unknown" because
`getOpening()` read only the PGN `Opening` header, which chess.com pubapi
PGNs omit (they provide `ECO` + `ECOUrl` instead). The human-readable name
was present in the data (in `ECOUrl`) but the code never read it.

**Why the new harness caught it:** The user-story script's Step 2 explicitly
required "opening names … NOT a hardcoded fixture." The reviewer
cross-referenced the vision report (which independently flagged "Unknown")
against a DOM probe (which confirmed 30/30 rows showed "Unknown") and a
code probe (which found the root cause in `getOpening()`). The explicit
visual contract turned a vague "check the page" into a concrete "does the
Openings table show real opening names?" check.

**Fix (commit `aaa81bb`):** `getOpening()` now resolves Opening header →
ECOUrl slug (parsed to a human name) → ECO code → "Unknown". Verified
live: 0/19 rows show "Unknown" for hikaru; opening names render as "Indian
Game Knights Variation", "Sicilian Defense Canal Main Line", etc. Two
downstream issues also fixed: the "Train →" link dead-end (I1) and the
styled-components `severity` prop warning (N1). Fresh independent re-review:
ACCEPTED, all 3 findings verified fixed.

**Lesson:** The new harness works. The user-story script + cross-referenced
vision/DOM/code probes caught a real product-truth bug that survived the
old harness's loose "check the page" reviews. This is the validation that
the F25/F26 harness fixes actually improved detection, not just paperwork.

---

## F28 — Environment briefing (discovery tax)

**What:** Across swarm 4, every fresh-context reviewer spent 2–8 minutes
before its first useful action rediscovering the same environment facts —
dev server URL, browser tool, testids, sample inputs. The puzzles reviewer
spent 473s and visual-home 437s before their first vision-checker. The
weaknesses reviewer spent 63% of its bash calls on p-browser/playwright
discovery.

**Root cause:** Fresh-context reviewers start from zero and independently
re-derive the same facts every time. In a 5-reviewer parallel swarm, that's
5× the discovery cost.

**Fix:** New `environment-analyzer` agent (`.pi/agents/environment-analyzer.md`).
The orchestrator dispatches it ONCE before the swarm. It probes the project
and writes `.pi/acceptance/ENVIRONMENT.md` — dev server URL, routing mode,
browser tool, the complete testid inventory, data files, ready-to-use
sample inputs (real PGN, real username), external integrations. Every
downstream reviewer reads it first (acceptance-reviewer §Step 0). One
discovery, many consumers.

**Lesson:** Amortize discovery. In a multi-agent swarm, any fact every agent
needs should be discovered once by a dedicated agent and passed as a
briefing, not rediscovered N times in parallel.

## F29 — Two-vision-checker cross-reference with adjudication

**What:** Swarm 4's vision-checkers were bound to the user story and biased
toward confirming it. 20/21 returned freeform text (the prompt didn't
request structured verdicts), and a single checker's "PRESENT" was the only
visual signal — no cross-check against an independent observer.

**Root cause:** A vision-checker handed expectations is biased toward
confirming them ("is the arrow on the board? yes"). A single checker has no
independent witness to contradict a hallucinated confirmation.

**Fix:** Three vision-checker agents:
- `vision-checker` (story-bound) — receives expectations, returns
  per-expectation PRESENT/ABSENT/DIFFERENT.
- `vision-checker-freeform` — receives NO expectations, writes freeform
  prose about everything it sees, flags anything off. The unbiased witness.
- `vision-checker-adjudicator` — dispatched ONLY on disagreement, resolves
  the concrete discrepancy with a single verdict.

The acceptance-reviewer dispatches the first two in parallel per
screenshot, cross-references, and dispatches the adjudicator on
disagreement. The DOM containment probe remains the spatial authority
regardless.

**Lesson:** Cross-reference independent observers with different
incentives. A biased checker (knows the expectations) + an unbiased
checker (knows nothing) + a tie-breaker catches confirmation bias that a
single checker cannot. This generalizes beyond vision — any review with a
contract should also have an independent no-contract observer.

## F30 — Structured vision-checker output

**What:** 20/21 swarm 4 vision-checkers ignored the PRESENT/ABSENT/DIFFERENT
format the reviewers asked for and returned freeform descriptions, because
the `vision-checker.md` agent def asked for "exhaustive description" not
structured output. Reviewers had to manually cross-reference freeform text
against the script (error-prone, non-deterministic).

**Fix:** `vision-checker.md` now mandates per-expectation
`EXPECTATION: ... VERDICT: PRESENT|ABSENT|DIFFERENT DETAIL: ...` output when
the task includes expectations. Freeform detail is kept for serendipitous
discovery (it caught the "Unknown" openings bug), but the structured
verdict is the contract.

**Lesson:** An agent's output format is defined by its agent def, not by the
task text. If you need structured output, the agent def must require it — a
task-text request is overridden by the def's own output-format section.

## F31 — Containment-probe enforcement

**What:** Only 2/6 swarm 4 reviewers ran DOM containment probes despite the
mandate. The play reviewer skipped its 1 SPATIAL line. The §5 instruction
was descriptive ("mandatory") but not enforced — a reviewer could skip it
and still write a report.

**Fix:** `acceptance-reviewer.md` §5 now explicitly states a step with a
SPATIAL expectation and no containment-probe result is NOT_RUN, not
silently passed. The skip is now visible in the report rather than silent.

**Lesson:** "Mandatory" in prose is not enforcement. Make the skip visible
(report NOT_RUN) so it surfaces in review rather than disappearing. A gate
that can be silently skipped is not a gate.
