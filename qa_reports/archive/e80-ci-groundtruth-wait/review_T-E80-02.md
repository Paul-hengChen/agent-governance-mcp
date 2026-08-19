# QA Review — T-E80-01, T-E80-02

covers: T-E80-01, T-E80-02

feature: e80-ci-groundtruth-wait
spec: `docs/backlog.md:203` (E80 row, tasks.md:329-330) + the cut recorded in handoff `scope_decision_why` — no `specs/e80-*.md`; the backlog row IS the spec (mini-chain, precedent E69/E71/E75/E76/E78).
reviewed diff: `scripts/verify-release.mjs` (Check 6 sha-not-found branch bounded-poll), `content/skill-release-engineer.md` (step 9a wait-vs-degraded rewrite), `test/verify-release.test.mjs` (QA-owned test edits, this task).
prior gate: code-reviewer APPROVED T-E80-01 with zero blocking findings, `review_reports/review_T-E80-01.md`. Verified against a stubbed `gh` binary, confirmed E78's contract intact (no new FAIL mode on any path), scope confined to the two cut-named regions.

## Phase 0.5 — Expected-Red Diff

Skipped (no `qa_reports/expected-red_e80-ci-groundtruth-wait.txt` manifest declared). No test files were touched by sr-engineer (§2 owns all test edits by qa-engineer on this cut per the tasks.md row), so there is no sr-authored intentional-red set to diff against.

## Phase 1.5 — Visual Compare

Skipped (no `design/e80-ci-groundtruth-wait.md`, no Visual Baselines — this is a CLI script + SOP-text change, not a UI feature).

## Phase 3.5 — AC Execution Log

Skipped (no `specs/e80-ci-groundtruth-wait.md`; the backlog row carries no `proof:`-annotated Acceptance Criteria — its own text describes the pins directly, executed below as the Spec-to-Test map).

## Phase 1 — Review

Read the full working-tree diff to `scripts/verify-release.mjs` and `content/skill-release-engineer.md`, plus the code-reviewer's independent empirical verification in `review_reports/review_T-E80-01.md` (stubbed-`gh` behavior table: wait=0 -> 1 call; budget=5 -> 2 calls in ~5s then the byte-identical pre-E80 WARN; all four other degraded branches unaffected at any budget; matched-run FAIL/OK paths unaffected). Independently re-derived the same shape from the diff itself:

- The bounded poll is scoped to the sha-not-found branch only (the `if (matched) {...return;}` early-return for the matched-sha case is unchanged; the four early-return degraded branches — `res.error`, `res.status !== 0`, JSON parse failure, zero-length array — sit before the poll and return on the first iteration regardless of budget).
- `AGC_VERIFY_CI_WAIT_SECONDS` parses to `600` on anything that isn't a non-negative finite number (unset, `""`, `"abc"`, negative, `Infinity`), and to `0` cleanly opts out — `deadline = Date.now()` at budget `0` guarantees `remainingMs <= 0` immediately after the first `gh` call, so exactly one call is made.
- Budget expiry emits the identical WARN string the pre-E80 code emitted on first miss (same template literal, same trailing "graceful degradation, E14" text) — E78's contract is preserved, not inverted; there is no new FAIL mode on this path.
- `content/skill-release-engineer.md` step 9a now correctly splits the SOP's advice: a sha genuinely still pending is a "let the poll run" instruction, while WARN-and-continue is scoped to poll-budget expiry or a genuinely degraded environment (no `gh`, unauthenticated, no workflow) — matching the two-case language in the script's own comment block.

Task scope (my §2 ownership) is test-file-only: `scripts/verify-release.mjs` and `content/skill-release-engineer.md` are unchanged by this review — I did not touch either, consistent with T-E80-01's "MUST NOT touch test/verify-release.test.mjs" being the mirror-image constraint on sr-engineer.

### 3a/3b — Copy / Visual Audit Gates

N/A — no `specs/e80-*.md` Copy/Strings or Visual Tokens H2 exists (backlog-row-as-spec mini-chain). No user-facing UI copy or visual literal is introduced; the only user-visible text is stdout/stderr script output and SOP prose, both reviewed above and pinned by the tests below.

## Spec-to-Test Map (tasks.md:330, T-E80-02 acceptance criteria)

| AC (tasks.md:330 text) | test |
|---|---|
| (a) sha absent on first `gh` call, present+success on a later call -> OK, no WARN, exit 0 | VR-20 |
| (b) poll budget expires with sha still absent -> byte-identical pre-E80 WARN, check green, exit 0 (E78 contract intact) | VR-21 |
| (c) `AGC_VERIFY_CI_WAIT_SECONDS=0` performs exactly one `gh` call, no wall-clock wait | VR-22 |
| VR-17/VR-18 run with wait=0 so the suite never blocks | VR-17, VR-18 (amended: `AGC_VERIFY_CI_WAIT_SECONDS: "0"` pinned via `runVerifyWithPath`'s new `extraEnv` param) |
| Retarget VR-9 to step 9a's new wait-vs-degraded wording | VR-9 (3 new assertions added: bounded-poll/env-var sentence, "let it run to completion" instruction, the two-case WARN scoping) |

New helpers added to support (a)/(c): `mkGhSequenceShim` (stateful shim returning a different canned response per successive `gh` invocation, via a counter file — proves the poll loop re-queries rather than caching the first miss) and `mkGhCallCounterShim` (records invocation count so wait=0's "exactly one call" claim is verified by a call count, not just wall-clock speed, which a slow-single-call shim could otherwise satisfy by accident).

## Phase 3 — Tests

Test file: `test/verify-release.test.mjs` (existing file, extended — not the "ask before creating a new file" branch). All new/changed assertions listed above. Coverage: the new script logic (env parsing, poll loop, deadline math, the two-case WARN split) is exercised end-to-end by VR-17/18/20/21/22 driving the real `scripts/verify-release.mjs` against a real git fixture repo and a real `gh` shim executable on `PATH` — no reimplementation, following this file's established convention (see file header). Line-coverage tooling is not wired into this repo's `npm test`; the gate is covered qualitatively via the spec-to-test map above (100% of T-E80-02's four enumerated criteria have a passing test).

### Security smoke

Unaffected surface: the only new external input is `AGC_VERIFY_CI_WAIT_SECONDS`, `Number`-parsed and used only as an arithmetic operand (never interpolated into a shell command or path) — already covered by the existing VR-SEC-1..4 boundary-input suite for the script's CLI arg, and by code-reviewer's Security section in `review_reports/review_T-E80-01.md` for the env var itself. No new auth/access-control surface.

## Runtime heads-up disposition (code-reviewer's blocking relay)

VR-17/VR-18 previously drove the sha-not-found branch with `runVerify`'s bare `{ ...process.env, PATH }`-style env (no `AGC_VERIFY_CI_WAIT_SECONDS`), which under the new poll code would each block for the full 600s default (~20 min suite slowdown). Fixed: `runVerifyWithPath` gained an `extraEnv` parameter; VR-17 and VR-18 now pass `{ AGC_VERIFY_CI_WAIT_SECONDS: "0" }` explicitly. All three new tests (VR-20/21/22) likewise pin the var explicitly (`"5"`, `"2"`, `"0"` respectively) rather than relying on shell inheritance. Confirmed empirically: full `test/verify-release.test.mjs` run is 32/32 green in ~35s wall-clock (see Phase 4 below) — no test blocks on the 600s default.

## Non-blocking notes deferred (not fixed here, per scope)

Code-reviewer's four advisory nits (negative budget falls back to 600 not 0; unreachable `ms<=0` guard in `sleepSync`; stale "latest completed CI run" wording at `verify-release.mjs:280`, correctly left untouched — byte-pinned by VR-11; `spawnSync` has no timeout) are recorded in `review_reports/review_T-E80-01.md` and not actioned here — none affect test correctness or coverage, which is QA's scope. Not filing a new backlog ticket for any of them; if the human wants one, it's a one-line ask.

## Phase 4 — Run

- Build: `npm run build` — zero errors (ran as part of `npm test`'s pretest hook).
- `node --test test/verify-release.test.mjs`: **32/32 pass**, wall-clock **~34.9s** (VR-20 ~5.9s, VR-21 ~3.0s — the two genuinely-polling new tests — every other test in the file <1.2s; no test approaches, let alone hits, the 600s default).
- Full `npm test`: **1745/1745 pass, 0 fail**, total wall-clock **~58.3s** (build + full `node --test` run, reported `duration_ms: 55124` for the test run itself). No suite-wide slowdown introduced by this cut.
- CI runnability: headless, zero human interaction, confirmed by the above.

**PASS** — both T-E80-01 (code-reviewer APPROVED, re-confirmed here via the green full suite that now exercises the change) and T-E80-02 (all four acceptance criteria pinned, VR-17/VR-18 amended per the blocking heads-up, VR-9 retargeted, full suite green, runtime disclosed above) meet their acceptance criteria.
## 2026-08-19T04:11:37.935Z — PASS — by qa-engineer

PASS T-E80-01+T-E80-02. Reviewed diff: scripts/verify-release.mjs Check 6 bounded-poll (sha-not-found branch only) + skill-release-engineer.md step 9a wait-vs-degraded rewrite (code-reviewer APPROVED, zero blocking, review_reports/review_T-E80-01.md). Added 3 new tests VR-20/21/22 in test/verify-release.test.mjs pinning: (a) sha absent then present+success mid-poll -> OK no WARN; (b) budget expiry with sha still absent -> byte-identical pre-E80 WARN, green, exit 0 (E78 contract intact, no new FAIL mode); (c) AGC_VERIFY_CI_WAIT_SECONDS=0 -> exactly 1 gh call, no wall-clock wait (verified via call-counter shim, not just timing). Retargeted VR-9 with 3 new assertions for step 9a's bounded-poll/env-var wording and the two-case WARN scoping. Actioned the reviewer's blocking heads-up: VR-17/VR-18 drove the sha-not-found branch with no env override and would have blocked 600s each under the new poll code — amended runVerifyWithPath with an extraEnv param and pinned AGC_VERIFY_CI_WAIT_SECONDS=0 on both. Reviewer's 4 non-blocking nits left unfixed per scope (recorded in review_reports/review_T-E80-01.md); verify-release.mjs:280 stale wording correctly left untouched (VR-11 byte-pins it). Full npm test: 1745/1745 green, ~58.3s wall-clock total (verify-release.test.mjs alone: 32/32, ~34.9s — no test approaches the 600s default). Evidence: qa_reports/review_T-E80-02.md (covers: T-E80-01, T-E80-02).

