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
