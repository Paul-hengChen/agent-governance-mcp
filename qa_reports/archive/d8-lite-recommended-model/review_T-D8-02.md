# Review — T-D8-02 (verify: d8-lite-recommended-model)

covers: T-D8-01, T-D8-02

## Summary

Independent QA re-verification of T-D8-01 (`recommended_model: haiku` →
`sonnet` in `content/skill-coordinator-lite.md` + doc mirror). Code-reviewer
APPROVED (`review_reports/review_T-D8-01.md`) on a static diff review;
this pass runs the actual build/test/audit gate the spec's AC5 requires.

**Verdict: FAIL.** `npm test` surfaces one genuine, deterministic regression
directly caused by the frontmatter change, in a pre-existing test that neither
the spec's Out-of-Scope analysis nor the code-reviewer's static diff review
accounted for. AC1–AC4, AC6, AC7 all independently verified PASS; AC5 fails.

## AC-by-AC verification

- **AC1** (`content/skill-coordinator-lite.md` frontmatter `recommended_model:
  sonnet`, no other line changed) — PASS. `git diff` shows exactly one line
  changed (`haiku` → `sonnet`); rest of frontmatter/body byte-identical.
- **AC2** (`docs/skills/coordinator-lite.md` mirror line reads `sonnet`) —
  PASS. `git diff` shows exactly the "**Recommended model (frontmatter):**"
  line changed to `` `sonnet` ``.
- **AC3** (lean-bundle cap `<= 4027` unaffected, no numeric edit needed) —
  PASS, independently re-measured (not trusting PM's or sr's prior note per
  file convention). `node scripts/measure-context-cost.mjs` output:
  `skill-coordinator-lite.md 3715 chars / 929 ~tok` (matches PM's predicted
  3714+1=3715); `bundle lean (post-strip) : 4027 ~tokens` — exact match to
  the cap. `test/context-budget.test.mjs` run in isolation: 64/64 pass,
  including the `AC2: lean always-on bundle ... <= 4027` assertion and the
  AC-9 `>= 1200` dual-injection floor.
- **AC4** (`test/skill-frontmatter.test.mjs` regression guard, `sonnet`
  already in `MODEL_TIERS`) — PASS, confirmed in the same isolated run
  (64/64 across both files; frontmatter test included).
- **AC5** (full suite + build + audit clean, zero unrelated regressions) —
  **FAIL**. See Finding below.
- **AC6** (diff touches only the 2 in-scope files; named out-of-scope files
  byte-identical) — PASS. `git diff --name-only -- templates/claude-code-agents/lite.md
  content/skill-coordinator.md docs/architecture.md
  test/subagent-templates.test.mjs test/eval/scenarios.mjs
  test/context-budget.test.mjs` returns empty (all six byte-identical).
  `templates/claude-code-agents/lite.md` confirmed still carries
  `model: haiku` (its own, deliberately-unchanged pin).
- **AC7** (`node scripts/measure-context-cost.mjs` runs cleanly, output
  captured as evidence) — PASS. Full output captured above/below; script is
  reporting-only, exits clean.

## Finding — AC5 regression (genuine, not test-infra flake)

`npm test` (full suite): **1106/1107 pass, 1 fail** (reproduced twice,
including in isolation — deterministic, not a flake):

```
not ok 849 - AC1 contract: each template tier mirrors content/skill-*.md recommended_model
  error: lite: template model "haiku" must equal skill recommended_model "sonnet"
  'haiku' !== 'sonnet'
  location: test/subagent-templates.test.mjs:147
```

`npm run build`: 0 errors. `npm audit --audit-level=high`: 0 findings at
`high`+ (1 pre-existing `low`-severity esbuild advisory, non-gating,
unrelated to this diff).

### Root cause

`test/subagent-templates.test.mjs` (confirmed byte-identical to pre-change
state — AC6, this is NOT a file this ticket touched) has a pre-existing
regression guard, `ROLE_TO_SKILL` (line 59: `"lite":
"skill-coordinator-lite.md"`), asserting for every role that the Task-subagent
template's `model:` frontmatter equals the corresponding skill file's
`recommended_model:` frontmatter, verbatim (test at line 147). This is a
*different* test than the `HAIKU_ROLES` fixture the spec's "Scope note"
correctly identified and deliberately left alone. The spec's Decision
section (and the code-reviewer's APPROVED verdict) reasoned that
`templates/claude-code-agents/lite.md`'s `model: haiku` pin and
`skill-coordinator-lite.md`'s `recommended_model` hint are "a different
mechanism" that may legitimately diverge — but a pre-existing test enforces
they must be identical for every role, `lite` included. Bumping the skill's
`recommended_model` to `sonnet` while leaving the template's `model: haiku`
pin untouched (both intentional, both individually correct per this spec)
breaks that existing invariant test.

Neither the spec's AC6/Out-of-Scope analysis nor `review_reports/review_T-D8-01.md`
(a static diff review with no recorded `npm test` run) surfaced this — it only
appears when the full suite is actually executed, which is exactly the gap
QA's independent Phase 4 run exists to close.

### Disposition

This is a **failing test caused directly by this change**, squarely in QA's
FAIL scope (Constitution §2 / skill-qa-engineer.md scope rule: "QA rejects
only for failing tests..."). It is not a style/architecture judgment call
(out of QA-FAIL scope) and not a test-infra defect — the test is correctly
enforcing a real invariant that this diff, as currently scoped, violates.

This is not necessarily a defect in T-D8-01's own two lines; it may be a gap
in the spec's Out-of-Scope reasoning (the "different mechanism" argument
needs to be reconciled with this specific existing test, not just the
`HAIKU_ROLES` fixture it named). Routing to sr-engineer per standard Phase 4
FAIL escalation; sr-engineer/PM can decide the correct fix (e.g. amend the
spec's Out-of-Scope note plus update this one assertion's expectation for
`lite` with a dated rationale — mirroring how other intentional
tier-divergences are already documented elsewhere in this suite — or, if the
architecture doc's "different mechanism" argument doesn't hold, reconsider
whether the template pin should move too). Not a QA-owned decision under
Constitution §2 (QA does not resolve architecture/spec conflicts, only
surfaces them).

## Evidence

- `npm run build`: 0 errors (tsc clean, check:version OK at 3.67.1).
- `npm test`: 1106/1107 pass, 1 fail (`test/subagent-templates.test.mjs:147`,
  reproduced in isolation).
- `npm audit --audit-level=high`: 0 findings at high/critical (1 pre-existing
  low-severity esbuild advisory, non-blocking, unrelated).
- `node scripts/measure-context-cost.mjs`: lean bundle 4027 ~tok (cap
  unaffected), full output captured above under AC3/AC7.
- `git diff --name-only`: only `content/skill-coordinator-lite.md` and
  `docs/skills/coordinator-lite.md` differ among feature-relevant files
  (plus governance bookkeeping files `.current/handoff.md`, `tasks.md`,
  untouched by this review).

## Verdict

**FAIL** — AC5 (full suite green, zero regressions) not met. Rolling back
T-D8-01 for sr-engineer rework; T-D8-02 (this verify task) not completed.
## 2026-07-11T08:19:11.780Z — FAIL — by qa-engineer

FAIL — full test suite regression (1106/1107). AC1/AC2/AC3/AC4/AC6/AC7 all independently re-verified PASS (lean bundle re-measured at exactly 4027 ~tok, matches PM claim; out-of-scope files byte-identical). AC5 fails: test/subagent-templates.test.mjs:147 pre-existing tier-consistency guard now mismatches (lite template model=haiku, skill recommended_model=sonnet). Not a flake (reproduced in isolation). Routed to sr-engineer to reconcile the template/skill tier-consistency invariant with this spec's decision (may require spec amendment via PM). Details: qa_reports/review_T-D8-02.md.

## 2026-07-11T08:30:19.921Z — PASS — by qa-engineer

PASS — qa_reports/review_T-D8-03.md (covers T-D8-01, T-D8-02, T-D8-03). Round-1 Amend-Resume: PM amended spec (option b, AC8) to add a narrow, dated MIRROR_EXEMPT_ROLES exemption for `lite` in test/subagent-templates.test.mjs's tier-mirror test, reconciling the intentional divergence between skill-coordinator-lite.md's recommended_model=sonnet and templates/claude-code-agents/lite.md's model=haiku. Implemented as a purely-additive edit (23 ins/0 del) — map + skip-continue only, following the file's existing HAIKU_ROLES/FILE_PATH_DELEGATES convention; assertion still runs/fails for the other 11 roles (confirmed exemption is load-bearing, not dead code). AC1-AC8 all independently re-verified. npm run build clean, npm test 1107/1107 (0 fail, regression from Round 1 resolved), npm audit --audit-level=high clean (1 pre-existing low-severity esbuild advisory, unrelated). Ready for release-engineer (T-D8-REL) and pm/coordinator backlog done-mark (T-D8-DONE) — human decision on release timing, no release bookkeeping performed by QA.

