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
