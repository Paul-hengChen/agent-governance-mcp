# Review — T-E260G-17

Round 1 — APPROVED — by code-reviewer (opus). Feature `e260g-r3-fix` (spec `specs/e260g-r3-fix.md`), diff `a85ebde..47404ab`, fix commits `333e1f3`, `ccf640f`, `67384d4`. This resolves the round 2 required item of the parent feature `e260g-test-e3-l-comment-trim` (review_T-E260G-09..16).

## Summary
- (a) The e31 header is now 7 counted lines, at most 83 columns. `--list-mid` prints `8-20: 0 block(s)`, so AC5 holds again and the Retained blocks table "none" is true.
- (b) The proof's cited-paths exemption now requires a whole path token in a base comment line. My control that puts the round-2 bug back (`gates/registry.js` at error-code-contract:318) now fails.
- (c) Both rationale nits are fixed (:107, :176).
- The full proof at `47404ab` passes. Comment-only change to the test: emit and tokens are identical to base.
- Verdict: APPROVED.

## AC Completeness
Spec `specs/e260g-r3-fix.md` adds no AC of its own; it closes the parent's AC5 and keeps AC1-AC4, AC7 and AC8.
AC1 — implemented — `emit: 25 files, 0 differ`
AC2 — implemented — `tokens: 0 differ`, `directives: 0 lost`
AC3 — implemented — `scope: ok`
AC4 — implemented — `>20: 0 unexpected`
AC5 — implemented — `8-20: 0 block(s)`; e31 header lines 1-7 (counted 7)
AC6 — implemented — the e31 pointer line :7 is unchanged
AC7 — implemented — `bare-id: 0`, `cited-paths: 0 untracked`
AC8 — implemented — `form: ok`
AC9 — not judged here — the fresh verifier re-runs the suite on the clean HEAD

**Retained blocks** (AC5):

| file | line at HEAD | counted | reason |
|---|---|---|---|
| — | — | — | none: every long block was cut to 7 counted lines or fewer |

## Correctness
- (1) The e31 header (test/e31-config-nonfatal.test.mjs:2-6) is accurate. It still says enough for the next reader, with one dropped clause noted below.
  - "the tw_get_state pre-flight reads it, so a throw blocks every call" is true: guards/session.ts `markStateRead`, then `findTasksFile`, then `resolveTaskPaths`, then `loadConfig` (tools/config.ts:321-338).
  - "getConfigError(ws) reports the failure" is true, though less precise than before. The dropped clause ("while defaults are served in place of an unusable config file") is the condition for a non-null `getConfigError`. "loadConfig NEVER throws" already implies the defaults, and the exact contract ("surfaces the loud failure … exactly when loadConfig is serving defaults …; null when clean or absent") still lives in specs/e260g-comment-rationale.md:22, which :7 points to. Nothing a reader needs is lost.
  - "Accepted: under a corrupt config the custom taskPaths/taskPattern are ignored (completeTaskInFile errors loudly, addTaskInFile writes the lane ledger)" is true per the tests at :257 and :271 and per `resolveTaskPaths` and `resolveTaskRegex`.
- (2) proof.mjs:145-160. `baseCitesToken` escapes the path, anchors it with `(?<![\w./-])` … `(?![\w/-]|\.\w)`, and is tested against the base file's comment lines only (`baseCmt`). Code strings no longer exempt a path. Controls on a scratch clone at `47404ab` with `--base bdbffaf`:

| control | expected | result |
|---|---|---|
| clean tree | PASS | `cited-paths: 0 untracked`, PASS |
| `gates/registry.js (AC-5)` at error-code-contract:318 | FAIL | `cited-paths: 1 untracked` — `test/error-code-contract.test.mjs:318 gates/registry.js`, FAIL |
| `x/registry.js` suffix at :318 | FAIL | `cited-paths: 1 untracked` — `:318 x/registry.js`, FAIL |
| new `tools/nope.ts` at :6 | FAIL | `cited-paths: 1 untracked` — `:6 tools/nope.ts`, FAIL |
| reword lane-migrate:60 (block that keeps `.current/tasks.md` at :61) | PASS (legitimate exemption) | `cited-paths: 0 untracked`, PASS |

  The legitimate exemptions from round 2 still pass at HEAD: lane-migrate:61 and :625, the feature-rollup, handoff-write-arg-guard and skill-coordinator "no longer exists" lines. The clean proof reports 0 untracked.
- (3) rationale :176 now says the `t-*` labels "came from the old file header", which is correct. :107 now says "the five … tests", which matches the file (five `T-E5-02 content: const-08` tests).
  - optional — specs/e260g-comment-rationale.md:107 — the bullet says five tests but quotes four phrases. The fifth ("documents the conservative per-field defaults", e5:308) is not quoted. Not blocking.

## Quality
No findings. Every changed line in `test/` is a comment line, and the e31 header width (83 or less) matches the file.

## Architecture
No architecture spec; comment-only change to the test, plus a tightening of the lane-owned proof script.

## Security
No findings. The path token is regex-escaped before it is interpolated (proof.mjs:147).

## Performance
No findings. There is one extra `analyzeText` per changed file in a one-shot script.

## Verdict
APPROVED — the e31 header is back to 7 counted lines and still true, the cited-paths exemption now catches the round-2 regression, and nothing required is left.
