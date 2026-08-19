# Issue tracker

GitHub Issues are authoritative for substantial and major work.

- One issue should represent one independently demonstrable vertical slice or explicit experiment.
- Implementation branches: `pi/work/<issue>-<slug>`.
- Experiment branches: `pi/experiment/<issue>-<slug>`.
- Major runs integrate through `pi/integration/<run>`.
- Workers open PRs into the integration branch.
- Fresh reviewers evaluate PRs and return findings to the same writer when corrections are required.
- For PRs touching UI, data, or external integrations, the orchestrator MUST also run the `acceptance-reviewer` (see `docs/agents/acceptance.md`) before merging. The acceptance reviewer boots the app from scratch with no mocks, exercises the full UX, and checks product truth (real data, real engine, features complete, pages render, annotations sane). It runs AFTER code/visual review and is the highest bar.
- "Done" is a state the orchestrator computes from: code review PASS + visual review PASS (UI) + acceptance review ACCEPTED + orchestrator-verified gates. A worker's self-attestation of green gates is NOT done (see F20).
- After `review.maxCorrectionRounds`, if BLOCKERs remain, the PR is REJECTED — not force-merged with `--admin`.
- The orchestrator merges accepted PRs into the integration branch.
- The final integration branch opens a PR to `main`.
- Pi never performs the final merge to `main`.
- Use `git` for Git operations.
- Use `p-gh` for GitHub CLI operations as BambooTheAgent.
- Public repositories use strong GitHub rulesets.
- Private GitHub Free repositories use the same workflow with policy-only main enforcement.
