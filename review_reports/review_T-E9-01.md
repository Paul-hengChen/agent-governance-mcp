# Review — T-E9-01, T-E9-02

covers: T-E9-01, T-E9-02

## Round 1 — APPROVED — by code-reviewer

## Summary
- T-E9-01: `scripts/verify-release.mjs` (new, 178 lines) — release self-check running 5 independent checks (tag-at-HEAD, pushed-to-origin, check-version subprocess, CHANGELOG entry, dist committed+parity). No short-circuit; exits non-zero on any FAIL.
- T-E9-02: `content/skill-release-engineer.md` — adds SOP step 9a (self-check, post-push/gh-release, pre-closing-write), step 13 (post-closing-write `tw_get_state` read-back), and one Escalation Routes row (Blocked → human).
- All 16 Copy/Strings entries reproduced verbatim from the spec table; regex/parse patterns reuse check-version.mjs's exact style.
- Scope clean: check-version.mjs, gates/feature-lease.ts untouched; no test files added (T-E9-04 is QA scope); steps 9–12 byte-identical, E1A triple contract unaltered.
- Verdict: APPROVED.

## Correctness
No findings.
- Independence verified empirically: `node scripts/verify-release.mjs v99.99.99` ran all 5 checks in one pass and reported 3 failures (tag-missing, changelog-missing, dist-mismatch) while pushed-to-origin and check-version reported OK — no short-circuit (spec AC8). The `runCheck` wrapper (verify-release.mjs:60-75) collects per-check fails and continues; a thrown guard is itself converted to a FAIL (line 67) rather than aborting the run.
- AC6/AC7 sub-check independence within check 5 (verify-release.mjs:150-169): the uncommitted-dist FAIL (line 153) does not `return`, so the committed-artifact parity check still runs and reports separately, exactly as AC7 requires.
- dist version regex (verify-release.mjs:163) is identical to check-version.mjs:45 and matches the committed HEAD literal `name: "agent-governance-mcp", version: "3.77.0"` — confirmed via `git show HEAD:dist/index.js`. The AC7 read uses `git show HEAD:dist/index.js` (committed artifact), not the working-tree copy, per spec.
- CHANGELOG regex `^##\s+\[<escaped>\]` (line 142) mirrors check-version.mjs:72 and correctly dot-escapes the version.
- Target-version validation (`^\d+\.\d+\.\d+$`, line 48) runs before any interpolation; invalid arg exits 1 (verified: `garbage` → exit 1).
- AC4 propagates check-version.mjs's result via `spawnSync` subprocess (line 121) without re-implementing it; stderr surfaced verbatim.
- SOP step placement correct: 9a sits after step 9 (push + gh release) and before step 12 (closing write) per AC9; step 13 sits after step 12 per AC10 and enumerates the exact fields to read back (last_agent, status, next_role, pending_notes).

## Quality
No findings. Naming (`runCheck`, `failedChecks`, check-name strings) is consistent and the file header documents the independence/no-advisory contract. Escalation Routes row uses the 4-column table format (situation | status | pending note | next_role); the pending-note text matches `vr.escalation-note` verbatim with the `<failed check name(s)>` placeholder. `next_role: human` follows the established convention of the sibling Blocked rows in this table (not the tw_update_state enum, consistent with existing rows).

## Architecture
No findings. Implementation matches the spec's stated approach: `node:child_process` / `node:fs` only, no new deps, no `gh`/CI shell-out (E7 out of scope respected), no orchestrator-side gate (correctly deferred per Out of Scope). No E9A (timestamp) or E13 (terminal-marker) logic touched — AC10's read-back narrows the consequence of a bad write without investigating the hand-edit mechanism, as the spec directs.

## Security
No findings. All git invocations use `execFileSync`/`spawnSync` with array-form argv — no `shell: true`, no string interpolation into a shell — so the version argument cannot inject shell commands, and it is additionally regex-validated before use. No secrets, no unvalidated trust boundaries introduced. `maxBuffer` bounded at 32 MiB.

## Performance
No findings. Five sequential checks, one `git fetch origin` and one subprocess spawn per run — appropriate for a release-time one-shot script. No hot path, no loops, no algorithmic regression vs base (new file).

## Verdict
APPROVED — both tasks match the spec's ACs and Copy/Strings table with zero findings; independence, verbatim failure strings, non-zero exit on FAIL, non-shell git calls, correct SOP placement, and zero behavior change to check-version.mjs all verified.
