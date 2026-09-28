# QA Review — T-E223-01, T-E223-02

covers: T-E223-01, T-E223-02

Feature: `e223-watch-rearm-gone` — spec `specs/e223-watch-rearm-gone.md` (AC1-AC6). Impl 35eebb7 (T-E223-01, code-review APPROVED in `review_reports/review_T-E223-01.md`, b1f2adc). Tests a18183a (T-E223-02).

## Phase 0.5
Phase 0.5: skipped (no expected-red manifest declared). The known-red noted in the dispatch brief (e178b "AC5 re-arm round trip" `zeta=<fp>` now exits 3, not 64) is the spec-anticipated change named in AC5's own proof line; resolved by the T-E223-02 test edit, not dispositioned as a regression.

## Phase 1 — Review
- Implementation read against decisions (a)-(g): `parseWatchBaseline(value, keys, { unknownIsGone })` skips only the unknown-key throw; malformed / bad-fingerprint / repeated / empty checks are unconditional and run before any `io.out`. `watchLoop` passes `unknownIsGone: !named`, prints gone keys after the watched-lane start lines, never adds them to `last` (so the re-arm `--baseline` omits them), and `armed:` N uses `keys.length`. No findings.
- 3a Copy Audit: `watch.gone` = `[<lane>] gone` rendered verbatim at `tools/lane-status.ts:1591` (the ``io.out(`[${key}] gone`)`` call). No new user-facing strings introduced. PASS.
- 3b Visual Audit: spec Visual Tokens = N/A; no visual literals in the diff. PASS.

## Phase 1.5
Phase 1.5: skipped (no Visual Baselines declared — no `design/e223-watch-rearm-gone.md`).

## Phase 3 — Tests
Placement: dispatch brief `Test-file placement` line (pre-authorized) — created `test/e223-watch-rearm-gone.test.mjs`, updated `test/e178b-lane-watch.test.mjs` "AC5 re-arm round trip". Harness mirrors e178b: in-process `runLaneWatch` with injected provider/reader and a fake clock.

### Spec-to-Test Map
| AC | test |
|---|---|
| AC1 | e223 "AC1 gone key on start in the default set" |
| AC2 | e223 "AC2 gone ordering" (gone keys interleaved and unsorted in `--baseline`, plus a changed-since-last-watch lane) |
| AC3 | e223 "AC3 gone keys are not carried" (re-arm drops the key; round trip prints zero gone / zero changed; all-gone + empty list arms 0 lanes and re-arms with no `--baseline`) |
| AC4 | e223 "AC4 --lanes unknown key stays a usage error" (`--lanes a,b` and `--lanes alpha,beta`; plus a valid-key control) |
| AC5 | e178b "AC5 re-arm round trip" (`zeta=<fp>` now asserted gone + exit 3; `zeta=<fp>,zeta=<fp>` added to the exit-64 list) |
| AC6 | Phase 4 run below |
| smoke | e223 "parseWatchBaseline boundary inputs" (empty string, `,`, repeated gone key, uppercase/wrong-length/empty fp, empty key, special characters, 10k-char key, exact-match/no case folding) |

### Coverage
`node --test --experimental-test-coverage` over both files: every line of `dist/tools/lane-status.js` from 1100 on (the `parseWatchBaseline` / `watchLoop` region, including all e223 changes at 1191, 1290, 1294, 1312) is covered. Whole-file line coverage is 69.51%; the uncovered ranges are in non-watch code outside this diff.

## AC Execution Log
| AC | command | output / exit | verdict |
|---|---|---|---|
| AC1 | `node --test --test-name-pattern="^AC1 gone key on start in the default set$" test/e223-watch-rearm-gone.test.mjs` | `ok 1`, pass 1 fail 0, exit 0 | pass |
| AC2 | `node --test --test-name-pattern="^AC2 gone ordering$" test/e223-watch-rearm-gone.test.mjs` | `ok 1`, pass 1 fail 0, exit 0 | pass |
| AC3 | `node --test --test-name-pattern="^AC3 gone keys are not carried$" test/e223-watch-rearm-gone.test.mjs` | `ok 1`, pass 1 fail 0, exit 0 | pass |
| AC4 | `node --test --test-name-pattern="^AC4 --lanes unknown key stays a usage error$" test/e223-watch-rearm-gone.test.mjs` | `ok 1`, pass 1 fail 0, exit 0 | pass |
| AC5 | `node --test --test-name-pattern="^AC5 re-arm round trip$" test/e178b-lane-watch.test.mjs` | `ok 1`, pass 1 fail 0 | pass |
| AC6 | `npm run build && git status --porcelain dist/ && npm test` (tree clean after a18183a; only the tw_update_state checkpoint touched `.current/e223/handoff.md`, outside `dist/`) | build exit 0; `git status --porcelain dist/` empty; `npm test` exit 0, tests 2800 pass 2800 fail 0 | pass |

## Phase 4 — Run
- Build: `npm run build` exit 0, zero errors; `dist/` has no diff.
- Full suite: `npm test` 2800/2800 pass, 0 fail, 0 cancelled, 0 skipped. Runs headless with no interaction.

## Verdict
PASS — T-E223-01 and T-E223-02.
## 2026-09-27T09:30:58.225Z — PASS — by qa-engineer

E223 PASS. Copy audit clean (watch.gone verbatim), no visual tokens, no expected-red manifest, no Visual Baselines. All 5 proof: ACs (AC1-AC5) executed green; AC6: npm run build exit 0 with no dist/ diff, npm test 2800/2800. New test/e223-watch-rearm-gone.test.mjs (AC1-AC4 + parser boundary smoke); e178b AC5 loop updated per decision (g). Watch-region lines fully covered. Report: qa_reports/review_T-E223-01.md (covers T-E223-01, T-E223-02).

