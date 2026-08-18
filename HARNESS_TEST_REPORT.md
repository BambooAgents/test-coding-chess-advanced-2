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

### F15 — worker hung 45+ min on a blocking bash call; no timeout, no alert
- **Area:** pi-subagents tool timeout / worker supervision
- **Issue:** Phase 2 child #14 (analyze) stalled for 45+ minutes on a single `bash` tool call (`tool bash 45m54s`, no activity). Almost certainly a blocking dev server / Playwright process that never returned. The `runs.all` workflow won't complete until all children finish, so one hung child blocks the whole phase's return. The orchestrator got no alert — I only discovered it by manually checking fleet status when the user asked "how is it going?".
- **Impact:** A single hung worker can stall an unattended overnight run indefinitely with no signal. This is the most operationally dangerous harness issue so far for an autonomous run.
- **Workaround:** Interrupt the hung child (`subagent interrupt`), re-launch #14 fresh with an explicit instruction to avoid long-running foreground servers (use `--port` isolation, background the server, or rely on Playwright's own dev-server spawn). Merge the 3 completed PRs independently.
- **Suggestion (important):** (1) The `bash` tool needs a default per-call timeout for workers (the harness docs mention a 5-min default for "known-fast built-in tools" but bash clearly didn't enforce it here). (2) A worker with no activity for N minutes should surface an attention event to the orchestrator (the watchdog is `off` per .pi/coding.json — for unattended runs an attention-after-inactivity watchdog should be the default). (3) `runs.all` should optionally return completed children early rather than waiting on the slowest/hung one.

### F16 — active async capacity (3/3) blocks parallel review launches
- **Area:** pi-subagents async capacity
- **Issue:** I tried to launch 3 fresh reviewers + 1 worker (#14 relaunch) simultaneously (4 async runs). Only the launches that found a free slot started; the rest returned "Active async run capacity exhausted: 3/3 used" and silently did NOT launch (no error thrown to me, just a message). With capacity at 3 and one slot apparently held by a lingering/uncleared run, only 2 of 4 actually started.
- **Impact:** Cannot run 3 parallel reviews + a worker at once. Forces serialization of review work, slowing the swarm. Also: the "capacity exhausted" response is easy to miss — it's not a hard error.
- **Workaround:** Sequence launches: wait for a slot to free, then launch the next review. For a bigger swarm, the capacity (3) is the real parallelism ceiling.
- **Suggestion:** (1) Surface "capacity exhausted" more loudly (it's a silent drop). (2) Consider raising default async capacity for orchestration use, or document it as the parallelism limit. (3) Auto-queue over-capacity launches instead of dropping them.

### F17 — leaked/phantom async capacity slot blocks launches
- **Area:** pi-subagents async capacity accounting
- **Issue:** Fleet status lists 2 active runs but capacity reports 3/3, so a 3rd launch gets dropped with "capacity exhausted". There is no 3rd run in the fleet view — a slot is being held by a phantom/leaked run that completed (or was orphaned by compaction) but never released its capacity slot. This happened repeatedly across compaction boundaries.
- **Impact:** Effective parallelism is lower than configured. Launches are silently dropped. Hard to diagnose because the fleet view doesn't show what's holding the slot.
- **Workaround:** Relaunch dropped work when any tracked run completes (freeing a real slot). Tolerate the phantom.
- **Suggestion:** (1) Reconcile capacity with actual tracked runs on compaction/restart. (2) Show what holds each capacity slot in fleet status. (3) Garbage-collect orphaned slots after compaction.

### F18 — paused reviewer runs leak async capacity permanently (hardest blocker)
- **Area:** pi-subagents supervisor-intercom / capacity lifecycle
- **Issue:** Three reviewer runs (`20cd77af`, `9086f910`, `e96ce41b`) entered `paused` state during the supervisor-intercom coordination flow (when a read-only reviewer asked me for gate data / branch access via `subagent_supervisor`). They delivered their review verdict via the supervisor reply, but the workflow wrapper never transitioned `paused → completed` — it stayed `paused` indefinitely, **holding their async capacity slots forever**. `subagent stop` reports "no running or queued run found" (paused ≠ running). `subagent resume` reports "missing required run fan-out recovery identity". There is NO API to clear a paused slot. Result: capacity is 3/3 with zero active runs, and every new async launch is dropped with "capacity exhausted".
- **Impact:** CATASTROPHIC for an unattended run. After 3 supervisor-intercom review cycles, the entire async fleet is dead for the session. I hit this exactly: 3 paused reviewers leaked all 3 slots, and I could not launch the PR #26 fix worker or the #14 relaunch. This ended the async phase of the swarm.
- **Workaround:** Pivot to FOREGROUND (synchronous) runs, which do NOT consume the 3/3 async capacity. Foreground launches are blocking from my perspective but they execute fully and return results inline. This kept the swarm moving after async died. The session would need a full restart to reclaim async capacity.
- **Suggestion (critical):** (1) A reviewer that has delivered its verdict via supervisor-intercom MUST transition to `completed`, not stay `paused`. (2) Provide an API to force-clear a paused/leaked capacity slot (`subagent stop` should handle `paused`, or add `subagent discard`). (3) Garbage-collect `paused` runs with no live process after a timeout. (4) Capacity accounting should be based on live processes, not state files. This is the single most important harness fix for long autonomous runs.

### F18b — leaked capacity deadlocks ALL subagent launches (worker + reviewer, foreground too)
- **Area:** pi-subagents capacity gate
- **Issue:** Once the 3 paused reviewers leaked all async slots (F18), EVERY subsequent `subagent` launch — including plain foreground workers with no worktree, even a trivial `reply with pong` — returns "Active async run capacity exhausted: 3/3 used". The capacity gate applies to ALL launches, not just async ones, and there is no escape hatch. The session is fully deadlocked for subagent work.
- **Impact:** Total. The swarm cannot spawn any more agents. The orchestrator must do all remaining work directly with its own tools.
- **Workaround:** Orchestrator executes directly (bash/edit/read). This actually works fine for implementation/review/merge — the orchestrator is capable — but it defeats the "fresh independent reviewer" principle (the orchestrator reviews its own work) and removes parallelism.
- **Suggestion (critical):** (1) Foreground launches should NOT be subject to the async capacity gate. (2) Provide an admin escape hatch to force-launch when capacity is leaked. (3) See F18 root cause — fix the paused-slot leak and this deadlocks stops happening.

### F19 — detached-HEAD worktree `git push` silently no-ops ("Everything up-to-date")
- **Area:** git worktree push mechanics (worker/foreman workflow)
- **Issue:** When a worker runs in a managed worktree created at a detached HEAD (`git worktree add <path> <commit>`), `git push -f origin <branch>` reports "Everything up-to-date" and exits 0 even though the new local commit was NOT pushed — because the branch isn't checked out in the worktree, so `git push origin <branch>` pushes the stale remote-tracking ref, not the local commit. This happened twice (PR #26 fix, PR #27 merge) and is silent — exit 0, no error.
- **Impact:** The orchestrator believes the fix is pushed and moves on; the PR still shows the OLD code, so verification/merge sees stale state. Caused a confusing "mergeable but merge didn't update" episode.
- **Workaround:** After a worker worktree push, the orchestrator must verify `git log origin/<branch>` contains the new commit SHA; if not, fetch the commit into the main repo, `git checkout -B <branch> <sha>`, and `git push -f` from a branch that's actually checked out.
- **Suggestion:** (1) The worker toolkit should `git checkout -B <branch>` in the worktree BEFORE committing/pushing (so the branch is checked out and the push targets the local commit), or push via `git push origin HEAD:<branch>`. (2) The push wrapper should verify the remote HEAD SHA matches the local HEAD after push and error if they diverge. (3) Never report "Everything up-to-date" as success when the local HEAD is ahead of the remote.

### F20 — PR gate claims universally false (tsc) across 3/3 Phase-2 PRs
- **Area:** worker self-reported gate validation
- **Issue:** All three Phase-2 workers (#19 weaknesses, #16 play, #17 puzzles) posted "✅ TypeScript: tsc -b — 0 errors" in their PR body, and ALL THREE were false — tsc actually failed (4, 2, and 5+2 errors respectively). Common failures: styled-component transient-prop `$` prefix mismatch (using `props.isCheck` when type is `$isCheck`), a styled component named `Error` shadowing the global constructor, invalid `as const` on non-literals, missing barrel re-exports, unused imports under `noUnusedLocals`, invalid indexed-access types (`StrengthLevel['label']` on a union). The workers ran `tsc` but either didn't check the exit code, didn't actually run it, or ran it in a stale state.
- **Impact:** Cannot trust worker gate reports. A fresh reviewer that re-runs gates is essential (and the reviewer can't run bash — see F18 — so the orchestrator must verify gates directly).
- **Workaround:** Orchestrator independently verifies all gates in a throwaway worktree before merge; never trust the PR body's gate summary.
- **Suggestion:** (1) The worker toolkit should run gates with explicit exit-code checks (`npx tsc -b && npx eslint . && npx vitest run`) and FAIL the task if any exit non-zero, posting the actual error output. (2) A gate summary in the PR body should be auto-generated from actual command output, not self-attested. (3) The autonomous-coding skill should make orchestrator-side gate verification the default (don't trust worker claims).

## What went well
(to fill at end)

## What didn't go well
(to fill at end)

## Bugs in the system
(to fill at end)

## Suggested improvements to the agentic coding architecture / autonomous-coding skill
(to fill at end)
