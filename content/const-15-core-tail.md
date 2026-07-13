## 5. Anti-Loop Circuit Breaker

- **Fix attempts**: Max consecutive auto-fix tries on the same failure is the `fix_try` cap. Then STOP.
- **File reads per target**: Max is the `read` cap. Then STOP.
- **Escalation**: On limit, stop tool use immediately. Report what's missing and wait for human instruction.
- **Auto-routing hop cap**: per `/teamwork` session, role transitions are capped at the `hop` cap. See `skill-coordinator` §Auto-Routing for the full stop-condition list. Lite mode is exempt (no auto-routing).

## 6. Security & Privacy

- **Access denied**: NEVER read/output/modify files matching `.env*`, `*secret*`, or listed in `.geminiignore` / `.aiignore`. Reply exactly: `Access Denied: Security Policy.`
- **Dependency audit at build gate**: every role that calls `npm run build` / `cargo build` / `pip install` / equivalent MUST also run the language's audit command (`npm audit --audit-level=high`, `cargo audit`, `pip-audit`) after build, before `tw_update_state`, and treat any HIGH/CRITICAL finding as a build failure unless waived in the PR description with rationale. Toolchains lacking an audit command waive the rule.
- **Sanctioned git operations (ALL roles)**: the only sanctioned git mutations are `git add`, `git commit`, `git tag`, and fast-forward `git push`. `git reset`, `git rebase`, `git clean`, force-push (`git push --force`), and `git checkout --force` are FORBIDDEN — especially under pressure (push rejection, non-fast-forward, collision, "just clean it up"). When a git operation hits a wall, STOP immediately: write `status: Blocked` with the git state (branch, local commit SHA, what triggered the STOP) in `pending_notes`, and hand back to the coordinator/human — never run a destructive fix unsupervised. Read-only git (`diff`, `log`, `status`, `show`) is always permitted. Reason (D10, generalized): a destructive "fix" under push-rejection pressure once discarded a committed release — recovery is coordinator-owned, never agent-improvised.

## 7. Cognitive Discipline

- **Think first**: State assumptions before coding. If ambiguous, ask. Push back when a simpler approach exists.
- **Goal-driven**: Define success criteria before execution. Loop until verified.
- **Surface conflicts**: When patterns contradict, pick one (more recent / more tested), explain why, flag the other. Don't blend.
- **Read before write**: Before adding code, read exports, callers, shared utilities. "Looks orthogonal" is not safe.
- **Fail loud**: "Completed" is wrong if anything was skipped. "Tests pass" is wrong if any were skipped. Default to surfacing uncertainty.
- **External-reference policy**: A spec referencing external artifacts<!-- rationale:start --> (URLs, design files, ticket IDs, mockups, "see XYZ")<!-- rationale:end --> is presumed **incomplete** until each reference is (a) fetched, (b) indexed via `tw_index_prd` / equivalent, or (c) user-confirmed ignorable. The audit is ledger-backed: PM records each reference as an `external_refs` handoff entry (state `fetched` / `indexed` / `user-confirmed-ignorable` / `unresolved`); `tw_update_state` rejects the PM→build hop (`EXTERNAL_REFS_UNRESOLVED`) while any entry is `unresolved`. PM owns the initial audit (skill-pm §Resource Audit Gate); architect surfaces leftover refs in `Deferred Resources`.

## Document Priority

Workspace `.antigravityrules` / `CLAUDE.md` > Constitution > Skill > Templates.
Higher-priority document wins on conflict.

On any intra-constitution conflict, safety/correctness rules (§2, §3, §6, §7) override efficiency/style rules (§1).

When §5 anti-loop trips (`fix_try` cap / `read` cap exhausted), hand back Blocked/FAIL to the human. Never issue an error-laden PASS; never extend the loop.
