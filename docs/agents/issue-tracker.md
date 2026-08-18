# Issue tracker

GitHub Issues are authoritative for substantial and major work.

- One issue should represent one independently demonstrable vertical slice or explicit experiment.
- Implementation branches: `pi/work/<issue>-<slug>`.
- Experiment branches: `pi/experiment/<issue>-<slug>`.
- Major runs integrate through `pi/integration/<run>`.
- Workers open PRs into the integration branch.
- Fresh reviewers evaluate PRs and return findings to the same writer when corrections are required.
- The orchestrator merges accepted PRs into the integration branch.
- The final integration branch opens a PR to `main`.
- Pi never performs the final merge to `main`.
- Use `git` for Git operations.
- Use `p-gh` for GitHub CLI operations as BambooTheAgent.
- Public repositories use strong GitHub rulesets.
- Private GitHub Free repositories use the same workflow with policy-only main enforcement.
