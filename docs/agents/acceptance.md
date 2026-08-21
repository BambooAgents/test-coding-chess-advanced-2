# Acceptance process — the product-truth gate

> **Status:** Mandatory for any run that touches UI, data, or external
> integrations. Added 2026-08-19 after the harness-test product-quality
> escape (see `.pi/notes/postmortem/PRODUCT_QUALITY_ESCAPE.md`).
> Updated 2026-08-21 after the visual-swarm-blindness escape (see
> `.pi/acceptance/VISUAL_SWARM_BLINDNESS.md`) to add user-story scripts and
> the text-only-model rule.

## Why this exists

The harness loop verified "does the code build and do the unit/e2e tests
pass" but never verified "does the product actually work and look right."
Result: a chess app shipped where 100% of the puzzle bundle was synthetic
placeholder data, the "Brilliant (??)" detector's MultiPV dependency was a
hardcoded `eval − 250` phantom, and no agent in the loop had ever opened
the running app. Green gates became a false god.

A second escape followed: a board-arrow SVG rendered across the entire
viewport (into the nav bar and move list) because `BoardGrid` lacked
`position: relative`. The acceptance swarm — 20 vision-checker runs, two
review rounds — never flagged it, because (a) the first wave of
vision-checkers failed on a nesting-depth cap and the orchestrator wrote a
visual verdict anyway, (b) the vision model hallucinated the arrow was "on
the board," and (c) the DOM probe checked the SVG existed but never checked
its bounding rect was inside the board's. A human caught it in one glance.

This document defines the gate that catches both classes of escape: a
**fresh, from-zero acceptance reviewer that boots the app, uses it like a
hostile user, and checks product truth AND visual truth against an
explicit user-story script.**

## User stories — the orchestrator authors the visual script

The orchestrator, before launching the acceptance reviewer, writes a
**visual user-story script** per ticket (or per integrated feature set) and
hands it to the reviewer. The script is a step-by-step description of what
a user does and what they should VISIBLE see at each step. It is derived
from the ticket's requirements, not from the worker's claims.

### Why

The visual-swarm-blindness escape showed that a reviewer with no explicit
visual target will invent its own (loose) target and miss defects. A
vision model asked "are there arrows on the board?" will say "yes"
regardless of where the arrow actually is. A reviewer handed "at step 3 the
user should see an indigo arrow ON the board from e2 to e4, and a grey BOOK
badge next to 1.e4" has a concrete contract to check each expectation
against.

### Format

```markdown
STORY: <name> (ticket #<n>)
1. <user action>. VISIBLE: <what the user should see — layout, colors,
   badges, arrows, text, positions>. SPATIAL: <which element is inside
   which container, if it matters>.
2. <user action>. VISIBLE: ...
```

### Example (Analyze, ticket #14+#15)

```
STORY: Analyze a game (ticket #14+#15)
1. User pastes the Opera Game PGN and clicks Load PGN.
   VISIBLE: board updates to game start; move list populates with 21 moves;
   opening name shows.
2. Analysis runs to completion (~8s).
   VISIBLE: “Analyzing… N/21” progress; on completion eval bar fills, badges
   appear next to moves.
3. User scrubs to ply 1 (1.e4).
   VISIBLE: indigo best-move arrow ON the board e2→e4; BOOK (grey) badge next
   to 1.e4. SPATIAL: arrow SVG contained inside board rect.
4. User scrubs to ply 19 (10.Nxb5).
   VISIBLE: purple BRILLIANT (‼) badge next to 10.Nxb5; move list auto-scrolls
   so move 10 is in view. SPATIAL: brilliant badge span inside move-list
   rect; arrow SVG inside board rect.
```

### Rules for the orchestrator

- **Author the script from the ticket requirements, not the worker's
  claims.** If the ticket says “best-move arrows on the board,” the script
  says “VISIBLE: indigo arrow ON the board from <sq> to <sq>.”
- **Be concrete about visual specifics.** Name colors, positions, badges,
  and which container each element should be inside. “Looks fine” is not
  a visual requirement.
- **Mark spatial expectations explicitly.** Any “ON the board” or “IN the
  move list” expectation is a SPATIAL line — the reviewer will run a DOM
  containment probe for it.
- **One script per ticket (or per integrated feature set).** Store scripts
  in `.pi/acceptance/stories/<ticket>.md`. Hand the script path to the
  acceptance reviewer as part of its task.

## THE FIRST RULE — text-only models cannot see

Any agent in the review loop that runs on a text-only model (e.g.
GLM-5.2, GLM-4.7, GLM-5) has NO vision capability. This is absolute:

- **Never describe what a screenshot shows.** A visual fact stated by a
  text-only model about a screenshot is a hallucination.
- **Never substitute a DOM probe for visual appearance checks.** A DOM
  probe proves an element exists and where its rect is; it cannot prove the
  element looks right (contrast, color visibility, legibility). Those need
  vision.
- **Never substitute vision for spatial-containment checks.** Vision
  models hallucinate positions. Use DOM `getBoundingClientRect` containment
  for “is X inside Y.”
- **Both DOM probes AND vision are required for visual gates.** They check
  different things. A gate passes only when BOTH agree.
- **If vision-checkers fail, the visual gate is BLOCKED, not passed.** A
  text-only model may not infer what the screenshot “probably” shows.

This rule exists because the swarm shipped a product with arrows rendering
across the entire viewport while the text-only orchestrator wrote “arrows
render on the board” based on hallucinated relayed reports. See
`.pi/acceptance/VISUAL_SWARM_BLINDNESS.md`.

## The acceptance gate (mandatory before merge)

After the worker claims "done" AND the code/visual reviewers pass, but
BEFORE the orchestrator merges the PR:

1. **Orchestrator authors the visual user-story script** for the ticket
   (see §User stories). Stored at `.pi/acceptance/stories/<ticket>.md`.
2. **Launch the `acceptance-reviewer` agent in a fresh context** with the
   script path. It has not seen the PR, the spec, or the worker's claims.
3. It boots the app from scratch (`npm ci`, start dev server, Playwright).
4. It executes the script step by step: performs each user action, takes a
   screenshot, dispatches a vision-checker with the step's VISIBLE
   expectations, runs a DOM containment probe for each SPATIAL expectation,
   and cross-references both against the script.
5. It writes `.pi/acceptance/ACCEPTANCE_REPORT.md` with a verdict
   (`ACCEPTED` / `REQUEST-CHANGES` / `REJECTED`) and a finding list
   (BLOCKER / IMPORTANT / NIT), with each finding tied to a script step.
6. **The orchestrator does NOT merge until the acceptance reviewer returns
   `ACCEPTED`** (or `REQUEST-CHANGES` with all BLOCKERs cleared on a re-run).

### Ordering relative to other gates

```
worker claims done
  -> code reviewer (Standards + Spec)         [code-level]
  -> orchestrator authors user-story script     [visual contract]
  -> visual-reviewer (screenshots)             [visual-level]
  -> acceptance-reviewer (boots the app, runs script)  [product-level]   <-- mandatory
  -> orchestrator merges (only if all pass)
```

The orchestrator authors the user-story script BEFORE the acceptance
reviewer runs (the reviewer needs it as input). The acceptance reviewer is
the LAST and highest bar. Code review can pass and visual review can pass
and the acceptance reviewer can still REJECT — because the product can be
broken in ways no code-level check sees (fake data, faked engine, hanging
feature, useless output, or visual elements rendered in the wrong place).

## Product-truth gates (cannot be satisfied by synthetic data)

These are the gates that green tsc/eslint/tests do NOT imply. The
acceptance reviewer must mark each PASS or FAIL with evidence:

| Gate | What "PASS" requires |
|------|---------------------|
| Real data | Bundled content (puzzles, lessons, openings) is real sourced material, not generator output. Check the data file, not "data loads." |
| Real engine integration | Engine calls (MultiPV, best-move, eval) are real UCI commands, not arithmetic on a single eval or hardcoded responses. |
| Feature completes end-to-end | A real input (real PGN, real username) produces a complete, non-hanging result with sane output. |
| Every page renders | No visual glitches: no overlap, clipping, broken layout, missing affordances, illegible contrast. Verified by vision-checker report AND DOM containment probe per the user-story script. |
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
