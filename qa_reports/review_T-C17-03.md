# Review — T-C17-03, T-C17-04, T-C17-05 (c17-dispatch-brief-template)

covers: T-C17-03, T-C17-04, T-C17-05

## Summary
- T-C17-01/T-C17-02 already code-reviewer APPROVED (`review_reports/review_T-C17-01.md`): the
  "Dispatch Brief Template" subsection landed in `content/skill-coordinator.md` §Auto-Routing
  verbatim per spec, with the `prompt=` phrasing repointed.
- T-C17-03: re-measured (not trusted from sr-engineer's ~11815 claim) the AC8 design-arm floor
  bundle in `test/context-budget.test.mjs` and confirmed 11815 ~tok exactly. Bumped the cap
  `<= 11445` → `<= 11815` with a Phase-2-convention history comment (test/context-budget.test.mjs:825-832).
- T-C17-04: verified all existing skill-coordinator.md-anchored tests pass
  (`subagent-templates.test.mjs` AC3/AC4, `cut-approval-gate.test.mjs` C4:S04,
  `feature-scope-gate.test.mjs`, `design-auditor-volume-guard.test.mjs`) and added one new test
  in `test/subagent-templates.test.mjs` ("c17 AC1/AC2: skill-coordinator.md has a Dispatch Brief
  Template section referenced by prompt=") asserting the repointed `prompt=` phrasing, the
  `**Dispatch Brief Template**` heading, and all six Copy/Strings invariant lines verbatim.
- T-C17-05: full `npm run build` clean, full `npm test` green (1043/1043, 0 fail), `npm audit
  --audit-level=high` clean (exit 0; one pre-existing low-severity esbuild dev-server advisory,
  unrelated to this feature, below the audit-level threshold).

## Expected-Red Diff
`qa_reports/expected-red_c17-dispatch-brief-template.txt` present (sr-engineer-authored, single
entry). Ran the FULL suite BEFORE any re-baseline edit:

- Actual reds: 1/1042 — `test/context-budget.test.mjs | AC8/AC-P2-7: teamwork coordinator bundle
  (design-arm, both strips) is at/below the floor (≤ 9545 ~tok)` — failure message:
  `teamwork stripped bundle (11815 ~tok) must be ≤ 11445 ...`.
- Manifest entry: same test, same file. Match.
- **Phase 0.5: clean (1/1 manifest entries confirmed red, 0 unexplained reds).** Independent
  re-measurement confirms sr-engineer's ~11815 claim exactly (11815, no rounding needed) — cap
  bumped to this exact value, no headroom, per the established Phase-2 convention.

## Copy Audit Gate
Independently re-verified (not solely relying on code-reviewer's prior pass) all six
Copy/Strings entries against `content/skill-coordinator.md` via grep — byte-exact match on:
`**Dispatch Brief Template**`, the `First action: ...`, `Known drift, ignore ...`,
`Dispatch pins in effect: ...`, `` Do NOT set `cut_approved` ... ``, and
`Watermark your reply per Constitution §1 ...` lines. No drift, no coverage gap.

## Visual Audit Gate
N/A — spec Visual Tokens/Widgets tables are both `N/A` (content-only skill-file edit, no visual
literals). Phase 1.5 skipped: no `design/<feature>.md`, no Visual Baselines declared.

## AC6 Anchor Check
Grepped `content/skill-coordinator.md` post-change: `**Subagent Dispatch (Claude Code)**`,
`` **Fallback (`tw_switch_role`)** ``, `ALLOWED_TRANSITIONS`, and
`` **Dispatch-time overrides (`dispatch_pins`)** `` all present verbatim, unmoved, count 1 each.
The new section is purely additive between the Subagent Dispatch paragraph and the
Dispatch-time overrides paragraph, matching the spec-mandated insertion point.

## Spec-to-Test Map
| AC | Test |
|---|---|
| AC1 (six invariant lines open the brief, in order) | `test/subagent-templates.test.mjs` — new "c17 AC1/AC2" test (all 6 lines asserted verbatim) |
| AC2 (dispatch_pins quoted directly, no pending_notes convention) | same test (pins line assertion) + manual grep in this review (framing prose) |
| AC3 (known-drift line always present, literal fallback) | manual Copy Audit Gate (prose-only AC, no test infra to assert conditional rendering at authoring time — same treatment as AC4) |
| AC4 (cut_approved line conditional on next_role=pm) | manual Copy Audit Gate (same as AC3) |
| AC5 (token cap re-measured + bumped, qa-owned) | `test/context-budget.test.mjs:847` (bumped assertion) — this task, T-C17-03 |
| AC6 (existing anchor tests unmoved) | `test/subagent-templates.test.mjs` AC3/AC4, `test/cut-approval-gate.test.mjs` C4:S04, `test/feature-scope-gate.test.mjs`, `test/design-auditor-volume-guard.test.mjs` — all re-run green |

AC3/AC4 are prose-authoring contracts about which lines a human/agent must render at
dispatch-composition time (a runtime behavior of the coordinator role, not a static property of
the skill file); the template text itself statically encodes both rules as instructions,
verified here by manual read (see Copy Audit Gate) rather than a new automated test — no
existing test infra parses the coordinator's live dispatch composition.

## Coverage Gate
New/modified files: `test/context-budget.test.mjs` (comment + cap value only, no new logic),
`test/subagent-templates.test.mjs` (+1 test, all lines exercised by the new assertions). Both are
test files — coverage gate N/A (measures test code, not implementation under test).

## Security Smoke Tests
N/A — no new input parsing, auth, or executable surface (skill-prose + test-file edit only).

## Run
- `npm run build`: clean, 0 errors.
- `npm test`: 1043/1043 pass, 0 fail (up from 1042 total / 1 fail pre-fix).
- `npm audit --audit-level=high`: exit 0 (1 pre-existing low-severity esbuild advisory, out of
  scope for this feature and below the `high` threshold).
- CI runnable: headless, zero human interaction required.

## Verdict
PASS — T-C17-03/04/05 complete. Token-cap re-baseline independently re-measured and confirmed
exact (11815), new coverage added for the Dispatch Brief Template section, all existing
skill-coordinator.md-anchored tests remain green, full suite green, build clean, audit clean.
## 2026-07-10T04:13:35.144Z — PASS — by qa-engineer

PASS — c17-dispatch-brief-template. Expected-Red Diff clean (1/1 manifest entry confirmed red, 0 unexplained). T-C17-03: independently re-measured the AC8 design-arm floor teamwork bundle (test/context-budget.test.mjs) at 11815 ~tok exactly (confirmed sr-engineer's ~11815 claim), bumped cap 11445→11815 with Phase-2 history comment. T-C17-04: verified all existing skill-coordinator.md-anchored tests pass (subagent-templates.test.mjs AC3/AC4, cut-approval-gate.test.mjs C4:S04, feature-scope-gate.test.mjs, design-auditor-volume-guard.test.mjs) and added one new assertion in test/subagent-templates.test.mjs covering the Dispatch Brief Template section (heading + repointed prompt= + all 6 Copy/Strings invariant lines verbatim). Copy Audit Gate: all 6 invariant lines byte-exact vs spec. AC6 anchors unmoved. Visual Audit N/A (no visual literals). T-C17-05: npm run build clean, npm test 1043/1043 pass 0 fail, npm audit --audit-level=high exit 0 (1 pre-existing unrelated low-severity esbuild advisory). Full details in qa_reports/review_T-C17-03.md.

