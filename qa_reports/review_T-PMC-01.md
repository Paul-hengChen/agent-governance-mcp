# QA Review — T-PMC-01 (skill-pm-consolidation)

Task: behavior-preserving consolidation rewrite of `content/skill-pm.md` — lettered
SOP sub-steps (2a / 2a-bis / 2b / 7a) folded into a single **Gate Summary** table.
Contract: `specs/skill-pm-consolidation.md`. Reviewer verdict: APPROVED
(`review_reports/review_T-PMC-01.md`). This is an independent AC-by-AC
verification, re-derived from the pinning tests themselves (not from the
reviewer's report).

## Round 1 — PASS — by qa-engineer

## AC -> coverage mapping

| AC | verification method | result |
|---|---|---|
| AC-1 (suite green, zero non-target diff) | `npm run build && npm test`; `git diff --stat HEAD -- tools/ index.ts schema/ guards/ test/` | 813/813 pass, exit 0 (one transient 2-fail run on a prior pass, clean rerun confirms flake unrelated to this diff); non-target dirs diff empty except my own `test/context-budget.test.mjs` addition (Phase 3, see below) |
| AC-2 (error codes stay backtick-mentioned) | grep `content/skill-pm.md` for both codes | `SCOPE_DECISION_REQUIRED` (L54), `CUT_APPROVAL_REQUIRED` (L58) present |
| AC-3 (S01-S22 manifest survives) | read every pinning test file directly (`test/context-budget.test.mjs`, `test/widget-shape-spec.test.mjs`, `test/pixel-perfect-design-coverage.test.mjs`, `test/cut-approval-gate.test.mjs`, `test/skill-frontmatter.test.mjs`) and matched each regex/literal against the rewritten file myself | all 22 rows satisfied verbatim |
| AC-4 (one Gate Summary table, 7 rows, semantics preserved) | `git diff HEAD -- content/skill-pm.md`; manually re-derived old-vs-new semantics per row | one table, 7 rows present, all trigger/clearing-action semantics preserved (see Judgment call below for the one nuance) |
| AC-5 (clean top-level 1-8, 4 pinned substrings) | grep for letter-suffixed steps (`2a`, `2a-bis`, `2b`, `7a`) in the numbered SOP list; confirm S01-S04 substrings verbatim | numbered list is plain `1.`...`8.`; all 4 substrings present at their original step numbers |
| AC-6 (schema sections byte-identical) | `git diff HEAD -- content/skill-pm.md` — diff hunk starts at line 35 (`## SOP`); lines 1-34 (frontmatter + Spec Schema) show zero diff | confirmed byte-identical |
| AC-7 (rationale fences balanced, relocated correctly) | counted fence pairs in new file (2 in Spec Schema, unchanged; 2 in Gate Summary rows: Geometric-Density, Question Batch); ran `stripRationale` via test suite (AC9 tests) | 4 balanced fences, `PM_RULE_MARKERS` survive `stripRationale` (existing test, still passing) |
| AC-8 (STOP payload strings exact, incl. em-dash) | `python3` byte-level read of `content/skill-pm.md` around each payload string | all 3 strings byte-exact, em-dash confirmed as `\xe2\x80\x94` (U+2014) |
| AC-9 (line count soft, no pinned token dropped) | file grew 54 -> 62 lines; cross-checked against AC-3/AC-8 findings above | no pinned literal or STOP payload dropped |
| Copy/Visual gates, Phase 1.5 | feature has no `design/<feature>.md`, no Figma source (per spec Dependencies/Prerequisites) | N/A — skipped, non-design feature |

## Judgment call: reviewer's noted "MUST recommend" -> "Recommend" softening (Geometric-Density Split Gate)

Old step 2a-bis: `"you **MUST** recommend a sub-task split ... and record it in
`.current/feature-split.md` ... before routing"`.
New Gate Summary cell: `"Recommend a sub-task split ... and record it in
`.current/feature-split.md` ... before routing"` (MUST dropped).

Independently assessed as **not a weakening**, for three reasons:

1. The table's own preamble ("Work each row when its trigger holds") is a
   global modal operator that applies the same mandatory force to every row —
   none of the other six rows use an explicit "MUST" in their clearing-action
   cell either (e.g. Ambiguity Gate: "STOP. Call `tw_update_state`... Do NOT
   guess." — imperative, no MUST), so dropping MUST here is a stylistic
   normalization to match the table's uniform voice, not a selective
   softening of this one gate.
2. The sibling row (Visual State-Count Split) never had an explicit MUST in
   the old prose either ("If a single feature exceeds ~8-10... split it...
   Record the split... before routing") — so the two split gates are now
   treated identically, which is *more* consistent than the old asymmetry.
3. `grep -rn "MUST recommend"` across `test/`, `content/`, `index.ts`,
   `tools/` returns zero hits outside the (out-of-scope, expected-stale)
   `docs/skills/pm.md` generated doc — no test or cross-file citation pins
   the modal verb, confirming no mechanical contract depends on it.

Verdict: preserved. Not a FAIL condition.

## Additional observation (non-blocking, out of this ticket's scope)

`index.ts:835` hardcodes the hint string `"...See content/skill-pm.md §SOP
step 7a."` (part of the `CUT_APPROVAL_REQUIRED` gate envelope, pinned
byte-exact by `test/cut-approval-gate.test.mjs` C2/S02 — but pinned against
`dist/index.js`, not against `content/skill-pm.md`'s content). Since step 7a
no longer exists as a literal locator in the rewritten file (folded into the
Gate Summary, referenced from step 7), this hint is now a stale locator —
structurally the same category as the already-accepted `skill-design-auditor.md:88`
"step 2a-bis" locator called out in the spec's Copy/Strings S22 and Out of
Scope. `index.ts` is explicitly frozen for this ticket (content-only
constraint), so no action is available within T-PMC-01's scope. Flagging for
a future backlog item (A8/A11 gate-registry work) to fix all stale step
locators in one pass — not a blocker here.

## Phase 3 — test changes

Per SOP, existing suites already pin this file exhaustively (S01-S22 above).
One uncovered AC found: **AC-8's em-dash STOP payload
(`"PM blocked: ambiguous — <detail>"`) had zero test coverage against the
skill doc text itself** — only the general `pending_notes` shape is tested
elsewhere, and nothing pinned this literal (with its U+2014 em-dash,
indistinguishable from a hyphen in most renderers) against
`content/skill-pm.md`. This mirrors the A6 precedent exactly (qa added one
assertion pinning `skill-qa-visual.md`'s S15/S16 em-dash tokens in
`test/qa-visual-skill-split.test.mjs`, commit `77a6373`).

Added one assertion to the existing `test/context-budget.test.mjs` (no new
test file), immediately after the existing `PM_RULE_MARKERS` survival test:

```
test("AC8 (skill-pm-consolidation): Ambiguity Gate STOP payload is byte-exact (em-dash, not hyphen)", () => {
  const SKILL_PM = fs.readFileSync(path.join(ROOT, "content", "skill-pm.md"), "utf-8");
  assert.ok(
    SKILL_PM.includes("PM blocked: ambiguous — <detail>"),
    "skill-pm.md must contain the Ambiguity Gate STOP payload byte-exact, including U+2014 em-dash",
  );
});
```

## Phase 4 — build + test

`npm run build`: clean (`tsc`, exit 0).
`npm test`: 813/813 pass, 0 fail, exit 0 (rerun after one transient 2-fail
result that did not reproduce and showed no relevant assertion names —
treated as environmental flake, not attributable to this diff).

## Verdict

**PASS** — all 9 ACs independently verified against their pinning sources
(not just the spec/reviewer's claims), the reviewer's one noted nuance
(MUST softening) judged non-weakening with a documented rationale, one
genuine test-coverage gap (AC-8 em-dash) closed via a single assertion added
to an existing test file per the A6 precedent, full suite green.
## 2026-07-06T06:18:53.498Z — PASS — by qa-engineer

Independent AC-by-AC verification of the skill-pm.md consolidation rewrite: all 9 ACs (S01-S22 pin manifest, byte-identical schema sections, 7-row Gate Summary semantics, em-dash STOP payloads, balanced rationale fences) confirmed against the pinning tests directly, not just the spec/reviewer claims. Reviewer's noted MUST-recommend softening judged non-weakening (table preamble + sibling-row precedent + zero mechanical pins on the modal verb). Added one assertion to existing test/context-budget.test.mjs pinning the previously-uncovered AC-8 em-dash STOP payload byte-exact (A6 precedent). Full suite 813/813 green, zero non-target diff. Non-blocking observation logged (index.ts:835 stale step-7a locator, out of this ticket's scope). qa_reports/review_T-PMC-01.md.

