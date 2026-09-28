# Review — T-A12-04 (a12-partials-limits-registry)

covers: T-A12-04, T-A12-08, T-A12-09

## Summary
- T-A12-01/02/03/05/06/07 already code-reviewer APPROVED (`review_reports/review_T-A12-01.md`,
  covers all 6 ids): the `{{PARTIAL:step1-preflight}}` substitution mechanism (registry +
  `expandPartials` + both render-path wiring in `prompts/build.ts` and `tools/role.ts`) and the
  `## Limits` table + reference-by-name rewrites in const-01/08/09/12/15 and 7 skill files.
- T-A12-04 (this task): repointed the raw `fs.readFileSync`-based `PM_RULE_MARKERS` assertion
  (and, for consistency, the parallel `SR_RULE_MARKERS` assertion) in `test/context-budget.test.mjs`
  to assert against `expandSkill()`-composed text instead of the raw disk file (the raw file now
  carries the bare `{{PARTIAL:step1-preflight}}` token, not the expanded step-1 line); folded the
  same `expandSkill()` fix into the two exact-value skill-body token caps (`skill-pm` ≤3473,
  `skill-sr` ≤2469) that were silently measuring the wrong (un-expanded) text; added a new AC2
  byte-identity test block covering `expandPartials` directly (exact-literal, unknown-token
  fail-loud, no-token passthrough) plus per-role `buildPromptForRole` and `tools/role.ts
  switchRole` end-to-end checks for all 5 partial-adopting roles (architect, pm, design-auditor,
  researcher, sr-engineer) — closing DR-4's "second render path" risk. Also added the DR-5 static
  source-file guard the architecture calls out ("Invariant to record… T-A12-09"): no literal
  `{{PARTIAL:` may appear in any `const-*.md`, `skill-coordinator.md`, or
  `skill-coordinator-lite.md`.
- T-A12-08 (this task): re-baselined every exact-value token cap in `test/context-budget.test.mjs`
  tripped by the `## Limits` table insertion (AC2 lean bundle, AC8 design-arm floor, AC8 teamwork
  bundle, AC8 non-design floor); regenerated all 10 `test/fixtures/compose-golden/*.txt` fixtures
  via `scripts/capture-constitution-golden.mjs` plus a one-off re-cat of
  `constitution-monolith.txt` (the script's own monolith-capture branch is permanently skipped
  post-A9's `content/constitution.md` delete — the repo's established convention, confirmed via
  `git log`, is to hand-regenerate this specific fixture by concatenating
  `CONSTITUTION_SEGMENTS` in manifest order); reviewed every diff (not blindly accepted) — all 10
  fixture diffs contain ONLY the `## Limits` table insertion and the const-08/09/12/15
  reference-by-name rewrites, nothing else.
- T-A12-09 (this task): swept `test/subagent-templates.test.mjs` and
  `test/skill-evolution-v3.11.test.mjs` — both already green; grepped both for every AC7-relevant
  string (limit numbers, round-cap phrasing, `tw_get_state`/`tw_detect_drift` literal) and
  confirmed by content match that none of their assertions target the files/lines T-A12-06/07
  edited (zero collisions, confirmed not assumed). Fixed the 2 flagged AC7-adjacent collisions
  sr-engineer's manifest called out but T-A12's own AC7 task text didn't name:
  `test/design-auditor-volume-guard.test.mjs` ("AC5: existing 250-line / 5-pass output cap...")
  and `test/pixel-perfect-design-coverage.test.mjs` ("AC-2: multi-pass Hard rule has line cap,
  pass ceiling...") — both asserted the bare `"250-line cap"` / `"≤ 250 lines per pass"` /
  `"5 passes per feature"` literals that T-A12-07 rewrote to the named `pass_budget` reference;
  repointed both to assert the named reference in the skill body AND (for the pixel-perfect test)
  cross-check the Limits table itself still resolves `pass_budget` to the exact `250 lines × 5
  passes` value, so the underlying anti-abuse property stays pinned, just indirected through the
  new name. Then ran the full gate.

## Expected-Red Diff
`qa_reports/expected-red_a12-partials-limits-registry.txt` present (sr-engineer-authored, 18
entries). Ran the FULL suite BEFORE any re-baseline edit:

- Actual reds: 18/1044 — 11 `test/compose-equivalence.test.mjs` byte-identity failures (golden
  fixtures pin pre-A12 bytes), 5 `test/context-budget.test.mjs` exact-value cap /
  raw-file-marker failures (`AC2` lean bundle, `AC9` `PM_RULE_MARKERS`, 3× `AC8/AC-P2-7` floor
  tests), and 2 AC7-adjacent literal-text collisions (`test/design-auditor-volume-guard.test.mjs`,
  `test/pixel-perfect-design-coverage.test.mjs`).
- Manifest entries: all 18, same files, same test names. Match.
- **Phase 0.5: clean (18/18 manifest entries confirmed red, 0 unexplained reds).**

## Copy Audit Gate
N/A — spec Copy/Strings table is `N/A` ("feature has no user-facing copy; all edits are internal
governance-doc prose consumed only by AI agents"). No copy-coverage-gap risk: every string this
ticket touches (the Limits table rows, the reference-by-name rewrites) is prose the constitution
composes into agent-facing prompts, not end-user-facing product copy.

## Visual Audit Gate
N/A — spec Visual Tokens/Widgets tables are both `N/A` (no visual literals). Phase 1.5 skipped: no
`design/<feature>.md`, no Visual Baselines declared (correctly omitted per the PM spec schema's
`no-design` exemption, confirmed in spec Dependencies).

## Spec-to-Test Map
| AC | Test |
|---|---|
| AC1 (no restatement of const-05 crash/failure rule in 3 skills) | code-reviewer-verified (`review_reports/review_T-A12-01.md`); grepped independently — none of the 3 skill files contain a restatement, const-01's inherited-rules mandate stands unrestated-and-unbroken. |
| AC2 (5 skills source step-1 line from one partial; composed output byte-identical) | `test/context-budget.test.mjs` — new "AC2: expandPartials(step1-preflight token) equals the exact pre-refactor step-1 line", "AC2: unknown partial token fails loud (DR-6)…", "AC2: text with zero {{PARTIAL:...}} matches passes through…", 5× "AC2: buildPromptForRole(<skillFile>) composed output carries the expanded step-1 line, no leaked token" (one per adopting role), "AC2/DR-4: tools/role.ts switchRole… also expands the step-1 partial for all 5 roles" |
| AC3 (one `## Limits` table in const-01, sole authoritative definition) | `test/compose-equivalence.test.mjs` (10 golden-fixture byte-identity tests, regenerated — the table's presence/exact wording is baked into every regenerated fixture and reviewed diff-by-diff); manual verification the table sits before `## 1.` and covers exactly the 8 named limits with the spec's exact values. |
| AC4 (const-08/09/12/15 + 7 skills reference Limits names, not bare numbers) | Same 10 `test/compose-equivalence.test.mjs` fixtures (const-side); `test/design-auditor-volume-guard.test.mjs` + `test/pixel-perfect-design-coverage.test.mjs` (skill-design-auditor.md side, repointed this round); `test/context-budget.test.mjs` PM_RULE_MARKERS/SR_RULE_MARKERS + skill-pm/skill-sr token caps (already-passing markers unaffected by the rewrite, confirmed unchanged). |
| AC5 (context-budget.test.mjs re-baselined, raw-file marker tests repointed) | `test/context-budget.test.mjs` — all 5 re-baselined/repointed tests above (T-A12-04 scope). |
| AC6 (compose-golden fixtures regenerated + reviewed) | `test/compose-equivalence.test.mjs` (10 tests); regeneration diffs manually reviewed (see Summary) — confirmed ONLY Limits-table + reference-by-name text changed. |
| AC7 (subagent-templates.test.mjs + skill-evolution-v3.11.test.mjs swept) | Both suites run directly (24/24 pass, 0 collisions found); confirmed by content-match grep across every AC7-relevant literal, not assumed. The 2 collisions the spec's own AC7 text didn't name (design-auditor-volume-guard, pixel-perfect-design-coverage) are fixed per T-A12-09's explicit sweep-beyond-the-named-suites scope. |

## Coverage Gate
This ticket is test-infrastructure-only (no new product source file); "coverage" here means: every
edited or added test assertion in this task's scope was independently re-run and shown green
post-fix, and every AC has ≥1 test per the map above. `expandPartials` itself (a pure function in
`prompts/partials-manifest.ts`, sr-engineer-authored, already code-reviewer APPROVED) now has 3
direct unit tests plus 6 end-to-end integration tests (5 buildPromptForRole roles + switchRole) —
100% branch coverage of its 3 logical branches (known token, unknown token, no-match passthrough).

## Security Smoke Tests
Boundary inputs exercised directly against `expandPartials`: empty/no-match text (passthrough
unchanged), an unknown token (fail-loud `[ERROR: unknown partial token '<token>']` marker, never
silent passthrough — DR-6). No auth/permission surface — this is a markdown-composition pipeline
with no external trust boundary; the "attacker" model is a future editor typo'ing a token name,
which the fail-loud contract already covers.

## Run
- `npm run build`: clean, 0 errors.
- `npm test` (prebuild + full suite): 1067/1067 pass, 0 fail (1057 pre-existing + 10 net-new: 9
  AC2/DR-5 tests in `test/context-budget.test.mjs`).
- `npm audit --audit-level=high`: exit 0 (1 pre-existing low-severity `esbuild` dev-server
  advisory, unrelated to this feature, below the `high` threshold).
- CI runnable: headless, zero human interaction required.

## Non-blocking follow-up (carry to PM/release)
`const-06-chain-31-head.md` L8 restates the `qa_round` value outside A12 scope (sr-engineer
flagged, code-reviewer concurred as follow-up) — confirmed still present, out of this ticket's
AC4 file list (const-06 is not one of the 4 const files AC4 names). Triage as an A12 follow-up
ticket if a fuller de-dup sweep is wanted.

## Verdict
PASS — T-A12-01 through T-A12-09 complete. Expected-Red Diff clean (18/18), all 5
partial-adopting roles proven byte-identical on both render paths (buildPromptForRole +
switchRole), all 10 compose-golden fixtures regenerated and diff-reviewed, all 4 exact-value
constitution token caps re-baselined off independently re-measured values, the 2
AC7-adjacent literal-text collisions found and fixed, zero collisions in the 2 AC7-named sweep
suites, full suite green, build clean, audit clean.
## 2026-07-10T06:29:58.135Z — PASS — by qa-engineer

PASS — a12-partials-limits-registry. Expected-Red Diff clean (18/18 manifest entries confirmed red, 0 unexplained). T-A12-04: repointed PM_RULE_MARKERS/SR_RULE_MARKERS raw-file-read tests + skill-pm/skill-sr exact-value token caps to assert via expandSkill()-composed text (production's expandPartials pipeline) instead of the raw disk file which now carries the bare {{PARTIAL:step1-preflight}} token; added 9 new AC2 tests (direct expandPartials unit tests + per-role buildPromptForRole + tools/role.ts switchRole byte-identity checks for all 5 partial-adopting roles) plus the DR-5 static source-file guard test. T-A12-08: re-baselined the 4 exact-value constitution token caps tripped by the new Limits table (independently re-measured, not trusted from sr-engineer notes); regenerated all 10 compose-golden fixtures via scripts/capture-constitution-golden.mjs plus a hand-recat of constitution-monolith.txt (script's own monolith branch permanently skipped post-A9 delete, per established repo convention); reviewed every diff — confirmed ONLY the Limits table + reference-by-name rewrites changed. T-A12-09: swept subagent-templates.test.mjs + skill-evolution-v3.11.test.mjs (24/24 green, zero collisions confirmed by content-match grep); fixed the 2 flagged AC7-adjacent collisions (design-auditor-volume-guard, pixel-perfect-design-coverage) that assert the bare 250-line/5-pass literals T-A12-07 renamed to `pass_budget`. Copy/Visual Audit Gates: N/A (spec tables both N/A, no user-facing copy or visual literals). npm run build clean, npm test 1067/1067 pass 0 fail, npm audit --audit-level=high exit 0 (1 pre-existing unrelated low-severity esbuild advisory). Full details qa_reports/review_T-A12-04.md (covers T-A12-04/08/09). Non-blocking follow-up carried for PM/release: const-06-chain-31-head.md L8 restates qa_round value outside A12 scope (sr-engineer flagged, code-reviewer concurred).

