<!-- PI-CODING-HARNESS:START -->
## Pi autonomous coding harness

Read `.pi/coding.json` before substantial coding work and use the `autonomous-coding` skill as the orchestration policy. The tracker-specific operations live in `docs/agents/issue-tracker.md`; domain-doc conventions live in `docs/agents/domain.md`.

Make sensible reversible implementation/product decisions and continue. Ask only for consequential product choices, destructive/external actions, or genuinely incompatible interpretations. If the prompt explicitly asks to see visual directions first, use the prototype/HITL flow and wait for selection; otherwise choose a coherent direction autonomously.

For substantial work use a persistent project-local worktree/branch with checkpoint commits, one writer per worktree, environment-backed validation, and fresh independent review. For meaningful UI work use Playwright plus the read-only Qwen visual reviewer. Human owns the final merge boundary.
<!-- PI-CODING-HARNESS:END -->
