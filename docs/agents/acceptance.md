# Acceptance process — the product-truth gate

> **Status:** Mandatory for any run that touches UI, data, or external
> integrations. Added 2026-08-19 after the harness-test product-quality
> escape (see `.pi/notes/postmortem/PRODUCT_QUALITY_ESCAPE.md`).

## Why this exists

The harness loop verified "does the code build and do the unit/e2e tests
pass" but never verified "does the product actually work and look right."
Result: a chess app shipped where 100% of the puzzle bundle was synthetic
placeholder data, the "Brilliant (??)" detector's MultiPV dependency was a
hardcoded `eval − 250` phantom, and no agent in the loop had ever opened
the running app. Green gates became a false god.

This document defines the gate that catches that class of escape: a
**fresh, from-zero acceptance reviewer that boots the app, uses it like a
hostile user, and checks product truth, not code truth.**

## The acceptance gate (mandatory before merge)

After the worker claims "done" AND the code/visual reviewers pass, but
BEFORE the orchestrator merges the PR:

1. **Launch the `acceptance-reviewer` agent in a fresh context.** It has
   not seen the PR, the spec, or the worker's claims.
2. It boots the app from scratch (`npm ci`, start dev server, Playwright).
3. It opens every page, exercises every feature end-to-end, takes
   screenshots, and hunts for product-truth defects.
4. It writes `.pi/acceptance/ACCEPTANCE_REPORT.md` with a verdict
   (`ACCEPTED` / `REQUEST-CHANGES` / `REJECTED`) and a finding list
   (BLOCKER / IMPORTANT / NIT).
5. **The orchestrator does NOT merge until the acceptance reviewer returns
   `ACCEPTED`** (or `REQUEST-CHANGES` with all BLOCKERs cleared on a re-run).

### Ordering relative to other gates

```
worker claims done
  -> code reviewer (Standards + Spec)         [code-level]
  -> visual-reviewer (screenshots)           [visual-level]
  -> acceptance-reviewer (boots the app)      [product-level]   <-- NEW, mandatory
  -> orchestrator merges (only if all pass)
```

The acceptance reviewer is the LAST and highest bar. Code review can
pass and visual review can pass and the acceptance reviewer can still
REJECT — because the product can be broken in ways no code-level check
sees (fake data, faked engine, hanging feature, useless output).

## Product-truth gates (cannot be satisfied by synthetic data)

These are the gates that green tsc/eslint/tests do NOT imply. The
acceptance reviewer must mark each PASS or FAIL with evidence:

| Gate | What "PASS" requires |
|------|---------------------|
| Real data | Bundled content (puzzles, lessons, openings) is real sourced material, not generator output. Check the data file, not "data loads." |
| Real engine integration | Engine calls (MultiPV, best-move, eval) are real UCI commands, not arithmetic on a single eval or hardcoded responses. |
| Feature completes end-to-end | A real input (real PGN, real username) produces a complete, non-hanging result with sane output. |
| Every page renders | No visual glitches: no overlap, clipping, broken layout, missing affordances, illegible contrast. |
| Every flow reaches a non-dead-end | No primary user flow traps the user or errors with no recovery. |
| Annotations sane | Badges match obvious human judgement on a real game (a blunder isn't "Best"; a quiet move isn't "Brilliant"). |

A FAIL on any required product-truth gate is a BLOCKER. Do not soft-pedal
synthetic data or faked integrations.

## Fakeable artifacts registry

These are the artifacts a worker can fake and a code reviewer cannot catch
from a diff. The acceptance reviewer MUST verify each against real input.
**Add to this list whenever a new fakeable class is discovered.**

| Artifact | How to verify it's real |
|----------|------------------------|
| Puzzle/lesson/opening data | Open the data file. IDs must not be `sample-*`/`test-*`. FENs must not be the starting position for a "tactic." Solution length ≥ 3 plies for a real tactic. Rating/themes plausible. Source cited. |
| Engine MultiPV | The adapter must send `setoption name MultiPV value 2` and parse ≥2 `info` lines. `multiPv2()` must NOT return `{pv1: eval, pv2: eval - 250}`. |
| Engine best-move | `bestMove()` must send `go depth N` and parse `bestmove`. Must not return a hardcoded move. |
| External API import (chess.com) | Must hit the real `pubapi.chess.com` endpoint. Must not return a fixture. |
| "Analysis completes" | Must run on a real 20+ move PGN and finish with badges within a reasonable time. |
| Stockfish-WASM load | Must actually instantiate the worker and receive `uciok` in the browser (not just in a unit test mock). |

## Correction loop

1. acceptance-reviewer returns findings.
2. BLOCKERs + IMPORTANTs go back to the **same writer** (with the finding
   list, not a vague "fix it").
3. Writer fixes; orchestrator re-runs affected gates + a **fresh**
   acceptance reviewer on the fixed bits.
4. Cap at `.pi/coding.json -> review.maxCorrectionRounds` (default 2).
5. **After the cap, if BLOCKERs remain, the PR is REJECTED — not
   force-merged with `--admin`.** (The previous run force-merged broken
   PRs; that is how the escape shipped.)

## Self-attestation is not "done"

A worker saying "tsc 0, tests green, done" is a claim, not a fact (see F20).
"Done" is a state the orchestrator computes from:
- code reviewer: PASS
- visual-reviewer: PASS (for UI)
- acceptance-reviewer: ACCEPTED
- gate evidence independently re-run by the orchestrator (not trusted from
  the PR body)

If the acceptance reviewer was NOT RUN for a UI/data/external-integration
PR, the run is NOT done. Report it as `NOT_RUN` and block the merge.

## What this does NOT replace

- Code review (Standards/Spec) still runs first — it catches maintainability
  and spec-conformance issues the acceptance reviewer isn't looking for.
- Visual review still runs — the acceptance reviewer takes screenshots too,
  but the dedicated visual-reviewer with the vision model is the authority
  on visual polish.
- Unit/e2e tests still run — they catch regressions the acceptance reviewer
  won't re-derive.

The acceptance reviewer is an ADDITIONAL gate that catches the class of
escape all the others missed: **the product is broken in a way only a real
user would notice.**
