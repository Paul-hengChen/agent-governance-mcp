covers: T-E260G-09, T-E260G-10, T-E260G-11, T-E260G-12, T-E260G-13, T-E260G-14, T-E260G-15, T-E260G-16, T-E260G-17

# QA review: e260g (comment-only trim of 28 test files, ticket E260)

**Ledger and evidence split.** T-E260G-09..16 belong to parent feature `e260g-test-e3-l-comment-trim`, which never reached PASS (two review rounds, hop cap reached). The human approved re-scoping the last fix into feature `e260g-r3-fix` (T-E260G-17), which code-review round 3 approved. T-E260G-09..16 are therefore completed under feature `e260g-r3-fix`, and this one report covers all nine ids.

Fresh independent verifier. Base `bdbffaf`, HEAD `a354a1c`, tree clean, no untracked files. Phase 0.5: skipped (no expected-red manifest declared). Phase 1.5: skipped (no Visual Baselines declared). Phase 3: skipped, verification only (no test file created or edited; the lane's test edits were authored and reviewed earlier). Copy and visual audits not applicable (comment-only change).

## Expected-Red Diff
Phase 0.5: skipped (no expected-red manifest declared)

## AC Execution Log
| AC | command | raw result | verdict |
|---|---|---|---|
| AC1 | `node .current/e260g/proof.mjs` | `emit: 25 files, 0 differ`; exit 0 | pass |
| AC2 | same | `tokens: 25 files, 0 differ`, `directives: 25 files, 0 lost` | pass |
| AC3 | same, plus `git diff --name-status bdbffaf..HEAD` | `scope: ok`; 25 modified test files (the other 3 of the 28 are untouched), no D or R; every other path is an added lane artifact (`.current/e260g/*`, `review_reports/*`, `specs/e260g-*`) | pass |
| AC4 | same | `>20: 0 unexpected` | pass |
| AC5 | `--list-mid` | `8-20: 0 block(s)`; Retained blocks table reads "none", so nothing needs a reason | pass |
| AC6 | grep of pointer lines vs section headings | 20 files carry `Rationale: specs/e260g-comment-rationale.md (<path>)`; all 20 have a matching `## <path>` section; cited tracked specs exist; `node scripts/check-md-tables.mjs` exits 0 (474 files, 0 malformed) | pass |
| AC7 | same | `bare-id: 0`, `cited-paths: 0 untracked`; 10+ comments sampled for plain readability (below) | pass |
| AC8 | same | `form: ok` | pass |
| AC9 | `git status --porcelain` empty, then `node scripts/test-lock.mjs -- npm test` | tests 3043, pass 3040, fail 0, skipped 3, exit 0 (base 3043/3040/0/3) | pass |

## Independent checks (did not take the proof script on trust)
- Own script: TypeScript `transpileModule` with `removeComments: true` on base blob vs HEAD for all 25 changed files: 0 differ (962 net lines removed).
- Negative control on a scratch clone in $TMPDIR: changed one `assert.equal(` to `assert.notEqual(` in `test/lane-paths.test.mjs`; proof reported `emit` and `tokens` FAIL, `proof: FAIL (emit, tokens)`. Unmodified clone passes.

## Sample of trimmed comments checked against code
1. hop-count-transitions header: tests are `t-compute-*`, `t-gate-*`, `t-e2e-*`, `t-crash-*` (24 matches); `HOP_CAP_EXCEEDED` exists in tools; accurate.
2. hop-count lease helper: `LEASE_TTL_MIN = 30` at `tools/handoff-orchestrator.ts:77`; accurate.
3. hop-count climb: `pm:In_Progress` and `sr-engineer:In_Progress` rows exist in `tools/transitions.ts`; `cut_approved: true` used in the helper; accurate.
4. e43 header: names `t-e43-branches-partition-with-catch-all` and `t-e43-placement-label-is-one-string`, both exist; accurate.
5. e43 inline: "(E69, E76, E77)" now trails plain words; fine.
6. lane-paths header: labels RN, RP, REG, CL, CLP, CALLERS1-3 (CALLERS used 7 times); cited specs e123a and e123b0 exist.
7. feature-rollup header: cited spec e113 exists; `readable` downgrade behaviour is in `tools/feature-rollup.ts`.
8. gates-expected-red header: tests U1-U12 and I1-I5 exist (U13 and I6 are not claimed in the range, U13 exists but header says U1-U12 only; see note); `I5` is the SQLite-skip test; accurate.
9. e32-e33 pointer to `specs/c16-c10-role-boundary.md` (Amendment E32): tracked spec exists (cited-paths 0 untracked).
10. error-code-contract, eval-assertions, e5, e90, e96 rationale pointers: sections present.
Note (non-blocking): the gates-expected-red header says U1-U12 but a U13 test exists at line 153; the comment is slightly under-inclusive, not wrong about what it lists. Also the review's optional nit on `specs/e260g-comment-rationale.md:107` stands.

## Verdict
PASS for T-E260G-09..17.
