# Review — T-E34-01, T-E34-02

covers: T-E34-01, T-E34-02

## Summary
- E34 bugfix: `agc init` seeded `.current/handoff.md` with `pm:Not_Started`, a tuple with no `ALLOWED_TRANSITIONS` key, so every init'd workspace was dead on arrival (TRANSITION_REJECTED on the first `tw_update_state`). Live incident VS-NDI-Receiver 2026-07-17.
- T-E34-01 (`bin/agc-init.mjs`): `runInit()` no longer writes `.current/handoff.md`; the sanctioned fresh-workspace tuple is `null:null` = file absent. `.config.json` + `tasks.md` + ADAPTERS loop behaviorally unchanged; `.current/` still created; the unused `const now` removed.
- T-E34-02 (`README.md:34`): install command gains `-p` so the `agc` bin runs instead of the 3-bin package's default (MCP server) bin.
- Scope clean: no descoped files touched (`transitions.ts` / `handoff-orchestrator.ts` untouched; no migration for seeded workspaces). No test files modified.
- Verdict: APPROVED.

## Correctness
No findings.
- `.current/` directory is still created post-fix: the `.current/.config.json` files[] entry drives `fs.mkdirSync(path.dirname(abs), { recursive: true })` (agc-init.mjs:142), so `.current/` materializes even though `handoff.md` is gone. Verified independently via full suite (init-based tests other than the intentional-red trio pass).
- The removed `const now` had exactly one consumer, the deleted `handoffTemplate`; `grep -n now bin/agc-init.mjs` returns nothing. `runCheck` uses `installedVersion()`, not `now` — untouched (agc-init.mjs:184-216, scans ADAPTERS only, zero handoff refs).
- Re-run semantics coherent: on a fully-initialized (new-style) workspace, `.config.json`/`tasks.md` report Skipped and CLAUDE.md reports Updated (upsert always re-stamps its block) — pre-existing behavior, not an E34 regression. On a pre-fix victim workspace with a stale `handoff.md`, the new `runInit` simply ignores that file (not in `files[]` nor `ADAPTERS`); stdout makes no false claim about it. No auto-migration of the stale seed, which is explicitly descoped by human decision — acceptable.
- Expected-red manifest (`qa_reports/expected-red_e34-agc-init-dead-end-seed.txt`) exists and records the pre-fix RED (`pm:Not_Started → pm:In_Progress` TRANSITION_REJECTED, `allowed=[]`) and post-fix GREEN (`null:null` file-absent edge ACCEPTED) shape. SOP 4a sampling: all 3 structured `file | test name` entries grep to real, locatable tests in `test/p0-onboarding-lite-default.test.mjs` (lines 41, 62, 80).
- Full suite: 1608 pass / 3 fail. The 3 fails are EXACTLY the predicted contract-flip tests (p0-onboarding AC1/AC2/AC3), which pin the OLD template and are qa-engineer's to modernize next hop. No other reds.

## Quality
No findings. The header comment, `STR_USAGE`, and the in-function NOTE (agc-init.mjs:105-110) all document the E34 rationale consistently. Dead `handoffTemplate` fully excised; no stray references. README `-p` change is minimal and correct.

## Architecture
No architecture spec for this bugfix (backlog E34 row is the contract). The fix aligns with the transition-matrix invariant that the only fresh-workspace key is `null:null`; it corrects the init side rather than adding defensive coercion, matching the human-scoped minimal-fix decision.

## Security
No findings. No new input crosses a trust boundary; no secrets. `-p` is a standard npx package selector.

## Performance
No findings. One fewer file write at init; no hot-path change.

## Verdict
APPROVED — implementation matches the E34 contract for T-E34-01 and T-E34-02 with zero findings; build passes and the red set is exactly the 3 sanctioned contract-flip tests.
