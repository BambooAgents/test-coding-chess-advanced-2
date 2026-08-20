# TASK: Fix minor harness bugs in `pi-subagents` (the pi coding-agent subagent runtime)

You are an outside engineering agent. Below is a self-contained task to fix a set
of real, reproduced bugs in the `pi-subagents` package — the subagent orchestration
runtime for the "pi" coding agent. Each bug has a precise reproduction, the exact
source location, and a suggested fix. Make minimal, targeted changes. Add or update
tests where reasonable. Do not refactor beyond the fixes.

## Repo layout

- The package is installed (TypeScript source, not compiled) at:
  `/home/bamboo/.pi/agent/npm/node_modules/pi-subagents`
- Version: `0.50.0`
- Source tree: `src/` (imported via `index.ts` → `./src/extension/index.ts`)
- There is no build step visible; the package is consumed as TS by the host.
- Full evidence log + postmortem from the run that surfaced these bugs:
  `/home/bamboo/pi/projects/coding/test-coding-chess-advanced-2/.pi/notes/postmortem/PRODUCT_QUALITY_ESCAPE.md`
  and `.../HARNESS_LEARNINGS_BRIEF.md`
- The 24-flag harness report with all bug bodies:
  branch `pi/work/0-harness-report` in repo
  `BambooAgents/test-coding-chess-advanced-2`, file `HARNESS_TEST_REPORT.md`.

Work on a copy/branch of the package. Keep changes minimal and reviewable.

---

## BUG 1 (CRITICAL) — Paused async runs leak capacity permanently; deadlocks the whole session

**This is the most dangerous bug. It bricked an entire autonomous run.**

### Reproduction (already observed)
1. An orchestrator launches a reviewer as a workflow.
2. The reviewer's child finishes and calls `contact_supervisor` (reason=`progress_update`).
3. The orchestrator is mid-turn, so the workflow runtime DETACHES the run "for intercom coordination" and writes `state: "paused"` to its `status.json`.
4. The orchestrator never replies; the session moves on.
5. The run stays `"paused"` forever. Three such runs held all 3 async capacity slots from Aug 18 onward.
6. EVERY subsequent `subagent` launch — including foreground, non-async ones — is rejected: `Active async run capacity exhausted: 3/3 used.` The session is fully deadlocked.

### Root cause (exact line)
File: `src/runs/background/active-async-capacity.ts`

```ts
// line 172
function terminalState(state: string | undefined): boolean {
  return state !== "queued" && state !== "running" && state !== "paused";
}
```

`terminalState("paused")` returns `false`, so in `ownerReleaseVerdict()`:
- line 180: `if (!terminalState(status.state)) return { state: "retained", reason: "run is still ${status.state}" };`
  → a paused run is always `retained`, never `releasable`. Its capacity slot is held forever.

The `stop` and `resume` actions both no-op on paused runs (the process is gone; only
the status-file ghost remains). There is no `forget`/`release`/`clear` action.

### Manual fix that proved the gap
Editing each paused run's `status.json` from `"state": "paused"` to `"state": "completed"`
instantly released the slots; a test `subagent` launch succeeded right after.

### Required fixes (implement all of A, B, C; D if reasonable)

**A — Add a `forget`/`release` management action to the `subagent` tool.**
Add a new action (e.g. `action: "forget"` or `"release"`, taking `id`/`dir` like the
other actions) that terminalizes a paused/leaked run's status and frees its async
slot. This is the missing primitive. Wire it alongside `stop`/`resume` in
`src/runs/foreground/async-stop-action.ts` and the action dispatcher. It should:
  - mark the run's `status.json` terminal (e.g. `state: "stopped"` or `"completed"`),
  - call the capacity-releasing path (the same one `reconcile` uses to release a
    `releasable` slot),
  - be idempotent and safe to call on a run that's already gone.

**B — Auto-reclaim paused runs.** A paused run with no resume within N minutes
(e.g. 5) should auto-transition to terminal and release its slot. The natural place
is the existing reconciliation/stale-run sweep (`src/runs/background/stale-run-reconciler.ts`
and the capacity `reconcile()` path). Add an age check: if `status.state === "paused"`
and `now - lastUpdate > RECLAIM_AFTER_MS`, treat it as releasable.

**C — Exempt FOREGROUND (non-async) launches from the async-capacity gate.**
A single foreground `runs.run` (the `async: false` / foreground path) must NOT be
subject to the async capacity gate, so a leaked async slot can never brick the
session. Find where `ActiveAsyncCapacityError` is thrown on launch
(`src/runs/foreground/subagent-executor.ts` and/or `src/extension/index.ts`) and
ensure the foreground path skips the capacity reservation entirely. (Async /
background launches still gate; foreground must not.)

**D — Auto-complete detached-for-intercom workflows.** When a workflow detaches for
intercom coordination and the parent never replies within a short timeout,
auto-complete the run instead of leaving it paused. (This addresses the trigger but
is secondary to A–C.)

### Acceptance
- A paused run can be released via the new action and the slot frees.
- A paused run older than the reclaim threshold is auto-released by the reconciler.
- A foreground `subagent` launch succeeds even when all async slots are paused/full.
- Add a unit test in the package's test suite (if present) covering: paused run →
  capacity retained → `forget` → capacity released; and paused run → foreground
  launch still allowed.

---

## BUG 2 (HIGH) — `runs.all()` returns `{}` instead of the keyed results map

### Reproduction
In a `workflowScript`, `await runs.all([{key:'a',agent:'worker',task:'...'},...])`
resolved to an empty object `{}` instead of `{ a: {output:...}, b: {...} }`. The
orchestrator could not read child results programmatically and fell back to reading
child output files/status directly.

### Where to look
The `runs.all` helper is part of the workflow runtime (search `src/` for `runs.all`,
`run(`, the workflow script host). The `runs` global is injected into the
`workflowScript` eval context. Likely the result aggregation is either not keyed by
the provided `key`, or the return path drops the map when children finish async.

### Fix
Ensure `runs.all([...])` resolves to an object keyed by each item's `key` with the
child's result (at minimum `{ output, runId, ok }`) once all children complete. If a
child errors, include the error in its slot rather than resolving the whole map to
`{}`. Match the documented behavior in the pi-subagents SKILL.md
(`/home/bamboo/.pi/agent/npm/node_modules/pi-subagents/skills/pi-subagents/SKILL.md`).

### Acceptance
- A `workflowScript` using `runs.all` with two keyed children resolves to an object
  with both keys present, each carrying the child output.

---

## BUG 3 (MEDIUM) — `p-gh pr merge --base <branch>` is a no-op

> NOTE: `p-gh` is a CLI wrapper shipped with the pi agent, NOT part of pi-subagents.
> It lives in the pi agent core package, not `pi-subagents`. Locate it with
> `which p-gh` / read its source before fixing. If it's not fixable from the
> pi-subagents package, implement the fix in the correct package and note the
> location in your summary.

### Reproduction
`p-gh pr merge <n> --merge --base pi/integration/foo` did not retarget the merge to
the requested base; the `--base` flag had no effect. Workaround was to create PRs
with the correct base via `p-gh pr create --base` and merge without `--base`.

### Fix
Either honor `--base` on `merge` (retarget the merge to that branch), or remove the
`--base` flag from `merge` and error clearly if passed. Prefer honoring it.

---

## BUG 4 (MEDIUM) — Detached-HEAD worktree `git push` silently no-ops ("Everything up-to-date", exit 0)

> NOTE: This is a worker-toolkit / worktree-management behavior. It may live in the
> pi agent core (the `p-worktree` tool / worker harness), not `pi-subagents`. Locate
> the worktree management code first.

### Reproduction
When a worker runs in a managed worktree created at a detached HEAD
(`git worktree add <path> <commit>`), `git push origin <branch>` reports
"Everything up-to-date" and exits 0 even though the new local commit was NOT pushed —
because the branch isn't checked out in the worktree, so `git push origin <branch>`
pushes the stale remote-tracking ref, not the local commit. This is silent (exit 0).

### Fix (pick the cleanest)
1. The worker toolkit should `git checkout -B <branch>` in the worktree BEFORE
   committing/pushing (so the branch is checked out and the push targets the local
   commit), OR push via `git push origin HEAD:<branch>`.
2. The push wrapper should verify `git rev-parse origin/<branch>` equals the local
   `HEAD` after push and error (non-zero) if they diverge.
3. Never report "Everything up-to-date" as success when the local HEAD is ahead of
   the remote.

### Acceptance
- After a worker worktree push, the remote `origin/<branch>` HEAD equals the worktree
  `HEAD`. If not, the push command errors non-zero with a clear message.

---

## BUG 5 (MEDIUM) — Worker `bash` tool has no enforced per-call timeout; a 45-min hang produced no alert

> NOTE: The `bash` tool is part of the pi agent core, not pi-subagents. Locate it
> there. This may be a config/default issue rather than a code bug.

### Reproduction
A worker child stalled for 45+ minutes on a single `bash` tool call (a blocking
dev server / Playwright process that never returned). The orchestrator got no alert;
it was only discovered by manually checking fleet status. The docs mention a 5-min
default for "known-fast built-in tools" but `bash` clearly didn't enforce it.

### Fix
- Enforce a default per-call timeout on the worker `bash` tool (configurable, but
  with a sane default, e.g. 5–10 min). On timeout, terminate the call and return a
  tool error.
- For unattended/AFK runs, surface an attention event when a worker has no activity
  for N minutes (this ties into the watchdog, which was `off` by default). At minimum,
  document that `review.watchdog` should be `on` for autonomous runs.

### Acceptance
- A worker `bash` call that blocks longer than the configured timeout is terminated
  and returns a tool error instead of hanging indefinitely.

---

## BUG 6 (LOW) — Wayfinder/grilling HITL-first skills block in AFK/autonomous mode

> NOTE: These are skills in the pi workspace, not pi-subagents code. This is a
> prompt/policy fix in the skill files, not a runtime fix.

### Reproduction
`wayfinder` chart-the-map wants an interactive Q1–Q6 grilling loop even when
`.pi/coding.json` sets `autonomy: high` and the run is unattended. The orchestrator
had to self-answer the grilling, which defeats the purpose.

### Fix
In the wayfinder/grilling skills
(`/home/bamboo/pi/shared/skills/coding/mattpocock/v1.1.0/wayfinder/SKILL.md` and
`.../grilling/SKILL.md`): add an AFK/autonomous escape — when running autonomously
(no interactive user present, or `autonomy: high`), auto-resolve the grilling Q&A
loop from the project config + the issue body, record the decisions for human
review, and do NOT block on absent user input. Keep the interactive grilling loop
for when a user is actually present.

---

## Notes for the outside agent

- **Priority order:** Bug 1 is critical (it bricked the run). Bugs 2–5 are
  high/medium. Bug 6 is a policy fix.
- **Scope:** Some bugs are in `pi-subagents`, some in the pi agent core (`p-gh`,
  `bash` tool, `p-worktree`), some in skills. Locate each component before fixing
  and note in your summary which package/file each fix landed in.
- **Don't** refactor beyond these fixes. Don't change the capacity limit default
  (3) — fix the leak, don't raise the ceiling.
- **Test** what you can. For Bug 1 specifically, simulate: create a paused run
  status.json, assert capacity is retained, call the new `forget` action, assert
  capacity released; and assert a foreground launch succeeds while all async slots
  are held.
- Return a summary of: files changed, per-bug fix approach, and any bug you
  could not fix (and why / where it actually lives).

---

## Context (why these matter)

These bugs were found during an end-to-end test of the autonomous coding harness
where a chess web app was built fully unattended. The run passed every gate it had
(tsc, eslint, 260 vitest, 32 playwright) but shipped a broken product: 100%
synthetic puzzle data, a faked engine MultiPV integration, a hanging analysis
feature, and visual/UX defects. The harness loop verified code correctness but
never product truth. Bug 1 (the capacity deadlock) forced the orchestrator to
abandon subagent review entirely and build the last features itself with no fresh
reviewer, which is how the broken product shipped. Fixing these is part of
hardening the harness so an unattended run can both keep its subagent fleet alive
AND catch product-level escapes.
