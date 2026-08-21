# Swarm 4 — Final Consolidated Findings

**Date:** 2026-08-21
**Harness version:** post user-story-driven + absolute-text-only-rule + vision-swarm-blindness fixes
**Branch:** `pi/work/acceptance-fixes-20260821` @ `aaa81bb`
**Dev server:** http://localhost:5183/test-coding-chess-advanced-2/

## Method

Swarm 4 was the first run under the **new harness**:
- Orchestrator authored **visual user-story scripts** per ticket (`.pi/acceptance/swarm4/stories/`) BEFORE launching reviewers — concrete step-by-step descriptions with VISIBLE (appearance) and SPATIAL (containment) expectations.
- Each reviewer executed its script step by step in Playwright, dispatched a **vision-checker (Qwen)** subagent per screenshot with that step's expectations, ran **DOM `getBoundingClientRect` containment probes** for every SPATIAL line, and cross-referenced both against the script.
- The **absolute text-only rule** was enforced: GLM-5.2 reviewers never described screenshots; every visual fact came from a vision-checker report or a DOM probe. Vision claims were never trusted for spatial containment.

5 parallel reviewers (fresh contexts, from-zero): analyze, puzzles, play, weaknesses, visual/home.

## Per-page verdicts

| Page | Verdict | BLOCKERs | IMPORTANTs | NITs | Report |
|------|---------|----------|------------|------|--------|
| Analyze (#14+#15) | **ACCEPTED** | 0 | 0 | 0 | swarm4/analyze.md |
| Puzzles (#17+#18) | **ACCEPTED** | 0 | 0 | 2 | swarm4/puzzles.md |
| Play (#16) | **ACCEPTED** | 0 | 0 | 0 | swarm4/play.md |
| Weaknesses (#19) | REQUEST-CHANGES → **ACCEPTED** (after fixes) | 1→0 | 1→0 | 1→0 | swarm4/weaknesses.md, swarm4/weaknesses-rereview.md |
| Visual/Home | **ACCEPTED** | 0 | 0 | 0 | swarm4/visual-home.md |

**All 5 pages ACCEPTED.**

## The one real bug the new harness caught (that prior swarms missed)

Swarm 4 caught a genuine product-truth defect on My Weaknesses (B1) that the prior swarms never flagged:
- Every opening in the Openings table showed "Unknown" because `getOpening()` read only the PGN `Opening` header, which chess.com pubapi PGNs omit (they provide `ECO` + `ECOUrl` instead). The human-readable name was present in the data but the code never read it.
- The user-story script's Step 2 explicitly required "opening names … NOT a hardcoded fixture." The reviewer cross-referenced the vision report (which flagged "Unknown" independently) against a DOM probe (which confirmed 30/30 rows showed "Unknown") and a code probe (which found the root cause in `getOpening()`).
- Fix: `getOpening()` now resolves Opening header → ECOUrl slug (parsed to a name) → ECO code → "Unknown". Verified live: 0/19 rows show "Unknown" for hikaru; opening names render as "Indian Game Knights Variation", "Sicilian Defense Canal Main Line", etc.

Two downstream issues also fixed:
- I1: the "Train →" link produced a `?set=` slug that matched no lichess opening tag (chess.com and lichess use different opening vocabularies), landing on plain puzzles (silent dead-end). Fix: PuzzlesPage falls back to themed openings mode.
- N1: RecCard leaked a non-transient `severity` prop to the DOM. Fix: prefix with `$`.

## The arrow-bleed bug — confirmed FIXED and did NOT recur

The prior swarm's flagship miss (board arrow SVG rendering across the viewport into the nav bar and move list) did NOT recur. The visual-home reviewer's DOM containment probe confirmed the arrow SVG's bounding rect is contained inside the board's bounding rect on the post-fix build. The new harness's mandatory DOM spatial-containment probe (§5) would have caught it even if vision hallucinated "on the board" again.

## Gates

- tsc: 0 errors
- eslint: 0 errors
- vitest: 292/292 passed (+8 new for the ECOUrl fix)
- build: OK
- console warnings: 0 (N1 fixed)

## Conclusion

Swarm 4 is the final deliverable acceptance pass. All 5 pages are ACCEPTED under the new harness (user-story scripts + two-tier vision + DOM containment probes + absolute text-only rule). The new harness caught a real product-truth bug the old harness missed (the "Unknown" openings), and the arrow-bleed spatial bug did not recur. The product is the final deliverable.
