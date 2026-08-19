# Postmortem notes — harness test, product quality escape (2026-08-19)

Trigger: User ran the deployed build and reported "obvious visual glitches,
annotations are wrong, analysis functionality doesn't work properly, puzzles
are not puzzles, UX is terrible." This is the ground truth for evaluating the
harness loop. Recorded here verbatim and reproduced.

## Concrete failures reproduced locally (not vibes)

### 1. PUZZLES ARE NOT PUZZLES (the biggest escape)
- src/data/puzzles.json contains 2380 entries, ALL with id prefix "sample-".
  0 real lichess/CC0 puzzles. The "curated bundle (~couple thousand puzzles,
  CC0)" claim in PR #27 was false.
- 280/2380 have the STARTING POSITION FEN with moves ["e2e4","e7e5"] — i.e.
  "the puzzle" is "white plays e4, black plays e5." Not a tactic.
- All FENs/moves are synthetically generated (a generator produced fake data
  with plausible-looking rating/theme fields). No human or reviewer solved
  one, so nobody noticed they're empty of content.
- The build is green and 5 puzzles-page e2e tests pass — because those tests
  only check that the board renders and a puzzle loads, not that a puzzle is
  a real solvable tactic.

### 2. ANALYZE — multiPv2 is faked (brilliant detection built on sand)
- src/pages/AnalyzePage.tsx realEngine.multiPv2() does NOT run MultiPV.
  It returns pv1 = position eval, pv2 = eval - 250cp. The "only-move margin"
  rule of the brilliant heuristic (#15) therefore compares the real eval to a
  hardcoded -250cp phantom second line. Brilliant (??) can fire on positions
  where it categorically should not, or never fire where it should.
- The fix is real: send `setoption name MultiPV value 2` then `go`, parse two
  info lines. The adapter's `getEvaluation`/`getBestMove` don't support it.
  This was a known limitation noted in PR #29 but shipped anyway.

### 3. ANALYZE — engine wiring depth & error surface
- StockfishEngine only has getEvaluation(depth=6 default, 12 used) and
  getBestMove. The analyze page calls depth 12 per position, sequentially,
  with a progressive callback. On a 40-move game that's ~80 depth-12 evals
  in-browser. Likely the "doesn't work properly" = it hangs / shows nothing
  for a long time, or the worker errors (SharedArrayBuffer/COOP-COEP) and
  the banner may or may not surface cleanly.
- No "analyzing… N/total" progress indicator is obvious from the wiring
  (onProgress fires but UI feedback is weak) → user sees a frozen board.

### 4. ANNOTATIONS — eval-delta vs win-prob mixing
- classifyMove mixes lichess winning-chance-delta bands (BLUNDER -0.30,
  MISTAKE -0.20, INACC -0.10) with chess-review-engine win-prob bands for
  positive labels. The decision tree precedence between the two systems
  isn't clearly specified in docs/spec and the impl has commented-out
  opening-ply constants. Edge cases (mate transitions, garbage-time) are
  handled but the net result on real games is "obviously wrong" badges,
  likely because the thresholds are tuned to single-source and the depth-12
  eval noise pushes borderline moves into wrong buckets.

### 5. VISUAL / UX (not yet reproduced — needs a visual pass)
- Reported: visual glitches, terrible UX. Not individually repro'd here
  because they need a human/browser eyeball. NO reviewer in the loop ever
  looked at a rendered page. The Playwright e2e tests check DOM testids,
  not visual correctness. The read-only Qwen visual reviewer that the
  autonomous-coding skill mandates was never invoked.

## Root cause (single sentence)
The loop verified "does the code build and do the unit/e2e tests pass"
but never verified "does the product actually work and look right" —
because no agent in the loop ever opened the app, solved a puzzle, ran an
analysis end-to-end, or looked at a screenshot.

## Where each gate failed
- Worker (PR #27 puzzles): shipped synthetic data and called it curated.
- Reviewer (PR #27): checked code/tests, did not inspect data, did not solve
  a puzzle.
- Orchestrator gate verify (F20 lesson): re-ran tsc/eslint/vitest/playwright
  — all green — and merged. Gates don't measure product truth.
- No visual reviewer was ever launched (F18 deadlock killed async, then
  orchestrator-as-writer for #14/#15/#18 had no fresh reviewer at all).
- .pi/coding.json autonomy=high let "done" self-attestations stand.

## UPDATE — Async deadlock root cause (answered for the human)

Question from human: "what async deadlock? harness or config break? can I fix it?"

**Answer: It is a harness bug, not a config break. The human can fix it; the
agent cannot.**

### Precise anatomy (from status.json + events.jsonl of run 20cd77af)
1. 2026-08-18 ~21:30: orchestrator launched a reviewer as a workflow.
2. The reviewer child (55e99d66) finished in 5.4s and called
   `contact_supervisor` with reason=progress_update.
3. At that moment the orchestrator was mid-turn, so the workflow runtime
   DETACHED the run "for intercom coordination" and PAUSED it, waiting for
   the orchestrator to reply to the supervisor request.
4. The orchestrator never replied (the session moved on to other work).
5. The run stayed in `state: "paused"` permanently. Three such runs
   (20cd77af, 9086f910, e96ce41b) held 3/3 async capacity slots from
   Aug 18 onward.

### The two harness faults
1. `pause` is a terminal state with no reclaim. `subagent stop` and
   `subagent resume` both no-op on paused runs ("No running or queued
   async run found" / "missing required run fan-out recovery identity").
   There is NO `forget`/`release`/`clear` action. The status.json ghost
   holds the slot forever.
2. The async-capacity gate counts `paused` runs as "used." Once 3/3 slots
   are paused, EVERY subsequent `subagent` launch — including foreground,
   non-async — is rejected: "Active async run capacity exhausted: 3/3
   used." This deadlocks the entire session for subagent work.

### Manual fix that worked (proof it's a harness gap, not config)
Editing the three status.json files from `"state": "paused"` to
`"state": "completed"` released the slots. A test `subagent` launch of a
reviewer immediately succeeded (Run fan-out: 0/12 used, 12 remaining) and
returned "pong". Async capacity is now fully restored.

### Fixes the human can make to the harness (pi-subagents)
A. Add a `subagent({ action: "forget" | "release" | "clear", id })` action
   that deletes or terminalizes a paused/leaked run's status and frees its
   async slot. This is the missing primitive.
B. Make `pause` auto-reclaim: a paused run with no resume within N minutes
   (e.g. 5) should auto-transition to `completed`/`stopped` and release its
   slot. Pausing should not be permanent by default.
C. Exempt FOREGROUND (non-async) launches from the async-capacity gate
   entirely. A single foreground `runs.run` should always be allowed so a
   leaked async slot can never brick the session. (This is F18b's core
   ask.)
D. When a workflow detaches for intercom coordination and the parent
   never replies within a short timeout, auto-complete the run instead of
   leaving it paused.

A+B are the minimal fix; C is the structural safeguard that prevents the
deadlock class entirely; D addresses the trigger.
