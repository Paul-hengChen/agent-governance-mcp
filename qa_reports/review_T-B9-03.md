# Review — T-B9-03 (b9-token-budget-brake)

covers: T-B9-01, T-B9-02, T-B9-03, T-B9-04, T-B9-05

## Summary
- T-B9-01/02/04/05 already code-reviewer APPROVED (`review_reports/review_T-B9-01.md`): opt-in,
  off-by-default `tokenBudgetPerFeature` field lands in `tools/config.ts` (typed field + non-fatal
  numeric filter + shape comment) and `content/skill-coordinator.md` gets a new "Token Budget
  Brake" subsection plus a new Escalation Routes row — additive-only, no schema bump, no
  server-side gate (spec AC5), matching the `driftBaselineIds` precedent.
- T-B9-03 (this task): wrote the new `test/token-budget-config.test.mjs` (human consent given at
  cut approval, §2 conditional-test-writing), re-measured and re-baselined the exact-value token
  cap in `test/context-budget.test.mjs`, added one Copy/Strings verbatim assertion to the existing
  `test/subagent-templates.test.mjs`, and ran the full verify gate (build/test/audit).

## Expected-Red Diff
`qa_reports/expected-red_b9-token-budget-brake.txt` present (sr-engineer-authored, single entry).
Ran the FULL suite BEFORE any re-baseline edit:

- Actual reds: 1/1043 — `test/context-budget.test.mjs | AC8/AC-P2-7: teamwork coordinator bundle
  (design-arm, both strips) is at/below the floor (≤ 9545 ~tok)` (stale test title from the A11
  baseline; live assertion read `≤ 11815`) — failure message: `teamwork stripped bundle (12247
  ~tok) must be ≤ 11815 ...`.
- Manifest entry: same test, same file. Match.
- **Phase 0.5: clean (1/1 manifest entries confirmed red, 0 unexplained reds).** Independent
  re-measurement confirms both sr-engineer's and code-reviewer's 12247 claim exactly (12247, no
  rounding needed) — cap bumped from 11815 → 12247, no headroom, per the established Phase-2
  convention.

## Copy Audit Gate
Spec Copy/Strings has one entry, `budget.stop-note`:
`` `token budget: {running_total} / {tokenBudgetPerFeature} ({pct}%) — handing to human` ``.
Grepped `content/skill-coordinator.md` — the string appears byte-exact in the new Escalation
Routes row (line 132) and is restated identically in the "Token Budget Brake" section prose
(§WHEN/DO/ELSE, line ~258-261). No drift, no coverage gap. Added a permanent regression test for
this (see Spec-to-Test Map) since it is the feature's only Copy/Strings entry and the Escalation
Routes table is prose that could be paraphrased in a future edit without a test noticing.

## Visual Audit Gate
N/A — spec Visual Tokens/Widgets tables are both `N/A` (config field + coordinator-SOP prose only,
no visual literals). Phase 1.5 skipped: no `design/<feature>.md`, no Visual Baselines declared.

## Spec-to-Test Map
| AC | Test |
|---|---|
| AC1 (absent key / absent file → brake disabled) | `test/token-budget-config.test.mjs` — "AC1: config file exists with other fields but no tokenBudgetPerFeature key", "AC1: .current/.config.json does not exist at all" |
| AC2 (coordinator running-total accumulation from `usage.*`) | prose-only coordinator-SOP contract (§Token Budget Brake); no runtime harness exists to drive a live `/teamwork` dispatch loop and read `agent-*.jsonl` — same treatment as the pre-existing hop-counter/Subagent Token Observability prose, which likewise has no automated test. Manually verified the four `usage.*` field names match §Subagent Token Observability verbatim (no re-derivation). |
| AC3 (≥80% → STOP, one-sentence surface, new Escalation Routes row) | `test/subagent-templates.test.mjs` — new "b9 AC3/Copy-Strings" test (section heading, row bold-label, and Copy/Strings string all asserted verbatim) |
| AC4 (invalid values filtered to absent, non-fatal) | `test/token-budget-config.test.mjs` — "AC4: string value", "AC4: negative value", "AC4: zero", "AC4: numeric-literal overflow (Infinity via valid JSON)", plus boundary cases (null, empty string, numeric-looking string) and a positive control. NaN is not separately exercised — JSON has no NaN literal, so `loadConfig` can never receive one through its actual file-read boundary; the `Number.isFinite` guard that would reject it (`tools/config.ts:136-139`) was independently confirmed by code-reviewer via direct source read (`review_reports/review_T-B9-01.md:15`), documented in the test file's header comment rather than faked with an unreachable input. |
| AC5 (no new persisted field / no schema bump / no server gate, advisory-only) | Architecture-level attestation, already verified by code-reviewer (`review_reports/review_T-B9-01.md` Architecture section) — no `schema_version` constant changed, confirmed by `test/subagent-templates.test.mjs` "AC6: no persisted-state schema_version bumped" (pre-existing test, still green, scope covers this feature's edits too since it greps the same files). |
| AC6 (byte-identical regression for workspaces without the key) | `test/token-budget-config.test.mjs` — "AC6: existing config fields are untouched when tokenBudgetPerFeature is absent" (asserts exact pre-feature key set, no stray key), "AC6: a workspace that has never created .current/.config.json sees byte-identical (pre-feature) behavior" (asserts no file materializes from a read) |

## Coverage Gate
New file `test/token-budget-config.test.mjs`: 13 tests exercise every branch of the
`tokenBudgetPerFeature` filter in `tools/config.ts:135-142` (all three guard predicates — `typeof
=== "number"`, `Number.isFinite`, `> 0` — hit on both the pass and fail side) plus both AC6
regression paths. Line coverage on the touched `loadConfig` branch: 100% (every conditional
branch has a positive and negative test). Tooling: no `c8`/`nyc` wired into `npm test`; coverage
assessed by manual branch enumeration against the diff, noted per SOP 6c.

## Security Smoke Tests
Boundary inputs exercised in `test/token-budget-config.test.mjs`: `null`, empty string (`""`),
numeric-looking special-character string (`"1e5 tokens!!"`), numeric overflow to `Infinity`
(`1e400`), and `Number.MAX_SAFE_INTEGER` (oversized-but-valid payload). No auth/permission surface
— this field is a locally-authored config number with no external trust boundary.

## Run
- `npm run build`: clean, 0 errors.
- `npm test` (prebuild + full suite): 1057/1057 pass, 0 fail.
- `npm audit --audit-level=high`: exit 0 (1 pre-existing low-severity `esbuild` dev-server
  advisory, unrelated to this feature, below the `high` threshold).
- CI runnable: headless, zero human interaction required.

## Verdict
PASS — T-B9-01 through T-B9-05 complete. Token-cap re-baseline independently re-measured and
confirmed exact (12247), new AC1/AC4/AC6 coverage added in `test/token-budget-config.test.mjs`,
one Copy/Strings regression test added to `test/subagent-templates.test.mjs`, all existing
skill-coordinator.md-anchored tests remain green, full suite green, build clean, audit clean.
## 2026-07-10T04:47:46.766Z — PASS — by qa-engineer

PASS — b9-token-budget-brake. Expected-Red Diff clean (1/1 manifest entry confirmed red, 0 unexplained). Re-measured teamwork bundle cap independently at 12247 ~tok exact (confirmed sr-engineer/code-reviewer claim), bumped test/context-budget.test.mjs cap 11815->12247 with Phase-2 history comment. T-B9-03: new test/token-budget-config.test.mjs (13 tests, AC1/AC4/AC6 coverage, human-consented new file); added 1 Copy/Strings regression test to test/subagent-templates.test.mjs for the new Token Budget Brake section + Escalation Routes row. Copy Audit Gate: budget.stop-note string byte-exact vs spec in both the row and section prose. Visual Audit N/A (no visual literals). All existing skill-coordinator.md-anchored tests remain green. npm run build clean, npm test 1057/1057 pass 0 fail, npm audit --audit-level=high exit 0 (1 pre-existing unrelated low-severity esbuild advisory). Full details qa_reports/review_T-B9-03.md.

