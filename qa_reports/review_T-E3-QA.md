# Review — T-E3-QA (e3-outcome-shaped-acceptance)

covers: T-E3-ARCH, T-E3-01, T-E3-02, T-E3-03, T-E3-CR, T-E3-QA

## Summary
- QA round over T-E3-01 (PM AC schema, `content/skill-pm.md`), T-E3-02 (QA
  runtime-evidence phase, `content/skill-qa-engineer.md`), and T-E3-03 (the
  `AC_EXECUTION_LOG_MISSING` evidence gate: `gates/ac-execution.ts` NEW,
  `gates/registry.ts`, `tools/handoff-orchestrator.ts`), already CODE-REVIEWER
  APPROVED (`review_reports/review_T-E3-CR.md`, covers T-E3-01..03). This
  round also completes the QA-owned test leg (architecture-labelled T-E3-04,
  folded into this task per the human brief) and closes out T-E3-ARCH/T-E3-CR
  bookkeeping.
- New test file `test/ac-execution.test.mjs` (28 assertions: 6 arm-check unit
  tests + 3 arm-regex-precision tests + 8 disposition unit tests + 5
  integration tests against the real `handleUpdateState` orchestrator + 2
  file-mode-only guard tests + 4 skill-content assertions). See *Placement
  Note* below for a path deviation from the architecture doc.
- Three qa-owned re-baselines applied per the architecture Test Specification
  §3: `test/error-code-contract.test.mjs` (registry 27→28: length assertions
  + title + `mapping.size` + `FREE_TEXT_ALLOWLIST` `AC_EXECUTION_LOG_MISSING:
  triggerEdge` entry), `test/context-budget.test.mjs` (skill-pm token cap
  3922→4128), `test/qa-visual-skill-split.test.mjs` (skill-qa-engineer byte
  cap 12950→14729).
- Full suite: `npm run build && npm audit --audit-level=high && npm test` —
  **1350/1350 pass, 0 fail** (see *Phase 4 — Run*). Zero modifications to any
  pre-existing per-gate behavior test file (`test/gates-expected-red.test.mjs`
  and siblings untouched — confirmed via `git diff --stat -- test/`).
- Verdict: **PASS**.

## Placement Note (test-infra defect caught + fixed, in scope per SOP "Scope")
The architecture doc (`specs/e3-outcome-shaped-acceptance-architecture.md`,
*Affected Files* T-E3-04 and *Test Specification* §1/§2) names the new test
file `test/gates/ac-execution.test.mjs`, citing `test/gates/gates-expected-
red.test.mjs` as the file it mirrors. Both citations are inaccurate: this repo
has no `test/gates/` directory, and `npm test` runs `node --test
test/*.test.mjs` — a **non-recursive** shell glob. Empirically verified: a
probe file dropped at `test/gates/_probe.test.mjs` does not appear in the
shell's glob expansion and its test never executes under `npm test`. Every
existing `*-gate` test file in this repo (including the real
`gates-expected-red.test.mjs`) lives flat under `test/` for exactly this
reason. Shipping the new suite at the architecture-named nested path would
have produced a test file that never runs in CI — a test-infra defect, which
`skill-qa-engineer`'s "Scope" rule explicitly authorizes QA to fix directly
(not a correctness/architecture issue requiring escalation, since it's purely
about where the test collector looks). Fixed by filing the suite at
`test/ac-execution.test.mjs` (flat), matching the real convention and
confirmed collected by `npm test` (see Phase 4). Not a FAIL — this is a
harness-path correction, not a defect in the gate's behavior, spec compliance,
or any of the 8 ACs.

## Expected-Red Diff

Phase 0.5. `qa_reports/expected-red_e3-outcome-shaped-acceptance.txt` (C15 manifest)
present — 5 declared entries. Ran the full suite BEFORE any re-baseline edit:

```
$ npm test 2>&1 | grep '^not ok'
not ok 124 - AC1/AC2: skill-pm stripped token count meets ≤ 3775 cap
not ok 288 - AC-1/AC-5: GATE_REGISTRY has exactly 27 entries (26 in, 27 out — e4-design-source-credibility-gate added SOURCE_CREDIBILITY_UNVERIFIED)
not ok 307 - doc-file mapping (c12): gates/registry.ts's errorCode→doc-file mapping comment matches the actual backtick-quote sites
not ok 308 - AC3 (c12): every (errorCode, field) pair for triggerEdge/armCondition is either mechanically checked above or explicitly allowlisted as free-text — no silent exemptions
not ok 765 - AC-5: byte counts stay within v3.14.0-relaxed budgets (savings invariant vs v3.8.2 baseline)
```
1318 pass / 5 fail / 1323 total.

**Phase 0.5: clean (5/5 manifest entries confirmed red, 0 unexplained reds).**
Disposition per entry (all qa-owned re-baselines, all fixed in this round —
see *Summary*):
- `test/error-code-contract.test.mjs | AC-1/AC-5: GATE_REGISTRY has exactly 27 entries ...` — registry 27→28 re-baseline; fixed (title/asserts bumped to 28).
- `test/error-code-contract.test.mjs | doc-file mapping (c12): ...` — `mapping.size` 27→28 re-baseline; fixed.
- `test/error-code-contract.test.mjs | AC3 (c12): every (errorCode, field) pair ...` — needed the new `AC_EXECUTION_LOG_MISSING:triggerEdge` `FREE_TEXT_ALLOWLIST` entry; fixed.
- `test/context-budget.test.mjs | AC1/AC2: skill-pm stripped token count meets ≤ 3775 cap` — cap re-baseline; fixed (bumped to 4128, see *Cosmetic-note disposition* below).
- `test/qa-visual-skill-split.test.mjs | AC-5: byte counts stay within v3.14.0-relaxed budgets ...` — skill-qa-engineer.md byte cap re-baseline; fixed (bumped to 14729).

No 6th unlisted red, no listed-but-green entry — byte-exact match, confirming code-reviewer's own count in `review_reports/review_T-E3-CR.md`.

**Cosmetic-note disposition** (code-reviewer's nitpick, manifest line 16 vs
16-18): the manifest's human-readable caption said "vs 3922 cap" while the
*test's own title string* said "≤ 3775 cap" and the *live assert* was `<=
3922`. Independently re-measured: `content/skill-pm.md`'s stripped body is
**4128 ~tok** (computed via the exact `stripRationale(stripOriginTags(
expandSkill(body)))` pipeline the test itself uses — confirmed by direct
script execution, not trusted from any handoff note). 3922 was therefore the
correct *live* pre-E3 cap (the manifest prose was right, the test's *title
string* was the stale one — drifted since e4-design-source-credibility-gate
bumped the assert 3775→3922 without updating the title text). Fixed both: the
assert now reads `<= 4128` and the title now reads "≤ 4128 cap", back in sync.

## Phase 1 — Review
Implementation already reviewed by code-reviewer (`review_reports/review_T-E3-CR.md`, APPROVED, zero blocking findings across Correctness/Quality/Architecture/Security/Performance). Independently spot-checked during this round:
- `gates/ac-execution.ts`: `hasProofAnnotatedAC`/`hasAcExecutionLogDisposition` are faithful structural twins of `gates/expected-red.ts` (arm-by-content-read, never-throw, per-feature at-least-one-across-ids disposition, `covers:` fallback via `buildCoverageIndex`). Confirmed via my own new unit tests (U1-U14) — all pass against the real `dist/gates/ac-execution.js`.
- `tools/handoff-orchestrator.ts` PASS block: file-mode-only guard (`storage instanceof FileHandoffStorage`), placed immediately after the Expected-Red block, inside the PASS `if` — confirmed via my I5/I5b tests (guard-presence pinned against the live source, not just behavior).
- `gates/registry.ts`: 28th `GateDefinition` entry, doc-file-mapping comment line, `documentedInProse: true` — confirmed consistent by my re-baselined `error-code-contract.test.mjs` generative parity tests (registry ⊆ doc / doc ⊆ registry / internal-consistency all green).

### 3a. Copy Audit Gate
Spec's *Copy / Strings* table: single `N/A` row ("feature has no user-facing strings — internal governance/server mechanism only"). Grepped `gates/ac-execution.ts`, `tools/handoff-orchestrator.ts`, `gates/registry.ts`, `content/skill-pm.md`, `content/skill-qa-engineer.md` for any new user-facing copy: none found beyond the gate's own error-hint text (server-internal diagnostic, not user-facing product copy). **N/A confirmed, no drift, no coverage gap.**

### 3b. Visual Audit Gate
Spec's *Visual Tokens* / *Visual Widgets* tables: both single `N/A` rows ("feature has no visual literals" / "feature has no non-primitive widgets"). No hex colors, dimensions, or widget literals introduced anywhere in the diff. **N/A confirmed, no drift, no coverage gap.**

## Phase 1.5 — Visual Compare
`Phase 1.5: skipped (no Visual Baselines declared)` — no `design/e3-outcome-shaped-acceptance.md` exists (process-only feature, spec AC8).

## Phase 2 — Discussion
No unresolved issues from code-reviewer or this round. Skipped — proceeding directly to Phase 3.

## Phase 3 — Tests

### Spec-to-Test Map (8 ACs)
| AC | Test(s) | Notes |
|---|---|---|
| AC1 | AC Execution Log (self-check proof, below) | `grep -c '^  proof:'` = 8 ≥ 4 |
| AC2 | `test/ac-execution.test.mjs` "AC2: skill-pm.md's proof: annotation guidance states..." | + AC Execution Log verbatim check |
| AC3 | `test/ac-execution.test.mjs` "AC3: ... exact new phase heading verbatim" + "AC3/AC4: ... H2 token" | + AC Execution Log |
| AC4 | `test/ac-execution.test.mjs` U1-U14 (unit), I1/I2 (arm+missing→reject, arm+present→accept), I3/I3b (unarmed/no-spec-file dormant), I5/I5b (file-mode-only) | mirrors `test/gates-expected-red.test.mjs` shape per architecture |
| AC5 | full suite green (Phase 4) + U3/U4/I3/I3b (dormant paths) + zero edits to any per-gate behavior test file | |
| AC6 | `test/ac-execution.test.mjs` "AC6: new Phase 3.5 references the existing Phase 4 FAIL escalation route..." | asserts 6-row Escalation Routes table unchanged |
| AC7 | AC Execution Log (self-check, below) — diff file list reviewed against Out of Scope | code-reviewer also confirmed this in review_T-E3-CR.md |
| AC8 | AC Execution Log (self-check proof, below) | `grep -c '^| N/A'` = 3 |

### Coverage Gate
New/modified files: `gates/ac-execution.ts` (100% of its two exported predicates exercised by U1-U14 + I1-I5b), `gates/registry.ts` (28th entry exercised by the full `error-code-contract.test.mjs` generative parity suite), `tools/handoff-orchestrator.ts` PASS block (exercised end-to-end by I1-I3b via the real `handleUpdateState`). Estimated >90% line coverage on the new/modified surface (no coverage tool wired into this repo's test runner; assessed by reading `gates/ac-execution.ts` end-to-end against the test list — every branch (armed/unarmed, direct-hit/covers-fallback/miss, throw-safety, file-mode guard) has a dedicated test).

### Security Smoke Tests
- Boundary inputs: empty `active_feature` (U4), path-traversal-shaped feature names (`evil/feature/name` U5, `..feat` U6) — sanitiser confirmed to collapse both, matching the v3.14.1 hardening precedent already reviewed by code-reviewer.
- Malformed/bad-encoding review file content (U13) — confirmed never throws (fail-closed).
- No auth/permission surface in this feature (server-internal gate, no new external input trust boundary).

## Phase 3.5 — AC Execution
Spec `specs/e3-outcome-shaped-acceptance.md` carries 8 line-leading `proof:` annotations (self-check AC1 below confirms exactly 8) — **armed**. Executed each declared proof; see `## AC Execution Log` below, BEFORE this PASS attempt.

## Phase 4 — Run
```
$ npm run build
> tsc
(zero errors)

$ npm audit --audit-level=high
1 low severity vulnerability (esbuild, dev-only transitive dep) — below the --audit-level=high threshold; exit 0.

$ npm test
# tests 1350
# suites 1
# pass 1350
# fail 0
# cancelled 0
# skipped 0
# todo 0
```
CI runnability: `npm test` runs headlessly via `node --test test/*.test.mjs`, zero human interaction, zero flags required.

**PASS.**

## AC Execution Log

Executed each of the 8 `proof:`-annotated ACs in `specs/e3-outcome-shaped-acceptance.md`, in order.

**AC1** — proof: `grep -c '^  proof:' specs/e3-outcome-shaped-acceptance.md` returns ≥ 4.
```
$ grep -c '^  proof:' specs/e3-outcome-shaped-acceptance.md
8
exit=0
```
Verdict: **PASS** (8 ≥ 4).

**AC2** — proof: `content/skill-pm.md`'s AC-schema guidance states the annotation is conditional ("where feasible"), not unconditional — reviewed verbatim against this line at code-review time.
```
$ grep -n "where feasible" content/skill-pm.md
20:- **Acceptance Criteria** — BDD: `Given / When / Then`. Each AC must be testable. **`proof:` annotation** ... where feasible — i.e. when an individual AC is provable by ONE command, ONE test (name), or ONE pixel-diff region — the AC carries an indented `proof:` line ... This is a per-AC judgment, NOT a blanket requirement: a genuinely subjective AC ... MAY omit `proof:` ...
exit=0
```
Verdict: **PASS** — the literal "where feasible" + explicit "NOT a blanket requirement" / "MAY omit" carve-out is present verbatim, matching AC2's conditional (not unconditional) requirement. Also independently re-verified by the automated `test/ac-execution.test.mjs` "AC2: ..." assertion (green).

**AC3** — proof: `content/skill-qa-engineer.md` contains a new mandatory phase (inserted between the existing Phase 3 "Tests" and Phase 4 "Run") whose heading text the test suite asserts verbatim.
```
$ grep -n "Phase 3.5 — AC Execution" content/skill-qa-engineer.md
75:6a. **Phase 3.5 — AC Execution**...: scan `specs/<active_feature>.md`'s Acceptance Criteria for `proof:` annotations...
exit=0
```
Confirmed positionally between step 6 ("Phase 3 — Tests", ends at line ~72) and step 7 ("Phase 4 — Run", starts at line ~81 post-insertion) — numbered "6a" per the file's existing SOP-step convention (matches how Phase 0.5/1.5 were inserted as "2a"/"4" in prior features). The heading is asserted verbatim by `test/ac-execution.test.mjs` "AC3: skill-qa-engineer.md contains the exact new phase heading verbatim" (green).
Verdict: **PASS**.

**AC4** — proof: new test `test/gates/ac-execution.test.mjs` (filed at `test/ac-execution.test.mjs`, see *Placement Note* above) — construct a spec with a proof-annotated AC and a PASS write missing the H2 → assert rejection with the new error code; add the H2 → assert the write is accepted.
```
$ node --test test/ac-execution.test.mjs 2>&1 | tail -8
# tests 27
# suites 0
# pass 27
# fail 0
# cancelled 0
# skipped 0
# todo 0
```
(Test count is 27, not 28, after the integration-level "I4" covers: attempt was removed as architecturally unreachable — see the `NOTE` comment in the test file; the covers: mechanism is fully exercised at the unit level by U10/U11 instead. All other described behaviors — arm+missing→reject (I1), arm+present→accept (I2), unarmed→dormant (I3), no-spec-file→dormant (I3b) — are present and green.)
Verdict: **PASS**.

**AC5** — proof: `npm test` — the full existing suite (1323/1323 as of v3.76.0) stays green with zero modifications to any pre-existing gate test file.
```
$ npm test 2>&1 | tail -8
# tests 1350
# pass 1350
# fail 0
```
Baseline was 1323 tests at v3.76.0; this round adds 27 new tests (`test/ac-execution.test.mjs`) — 1323 + 27 = 1350, reconciling exactly. `git diff --stat -- test/` confirms only the 3 designated qa-owned re-baseline files were modified (`context-budget.test.mjs`, `error-code-contract.test.mjs`, `qa-visual-skill-split.test.mjs`); no per-gate behavior test file (e.g. `test/gates-expected-red.test.mjs`) was touched.
Verdict: **PASS**.

**AC6** — proof: `content/skill-qa-engineer.md`'s new phase explicitly cross-references the existing *Escalation Routes: Phase 4 FAIL* row rather than defining a new escalation row — reviewed verbatim at code-review time.
```
$ grep -n "Phase 4 FAIL" content/skill-qa-engineer.md
78:   - **A proof's command fails, or its observed outcome contradicts the AC text** → that is a Phase 4 FAIL: `tw_rollback_task` + escalate per *Escalation Routes: Phase 4 FAIL*. The AC Execution Log is evidence feeding the existing FAIL path — NOT a new outcome type and NOT a new escalation row.
98:| Phase 4 FAIL | FAIL | `QA: <task-id> FAIL — <reason>` | sr-engineer |
```
Escalation Routes table row count independently counted: 6 data rows (lines 93-98), unchanged from pre-E3. Also automated via `test/ac-execution.test.mjs` "AC6: ..." (green, asserts exactly 6 rows).
Verdict: **PASS**.

**AC7** — proof: the shipped diff's file list, reviewed at code-review time against the *Out of Scope* section below — any file outside that list is a scope violation.
```
$ git status --porcelain
 M .current/handoff.md
 M .current/telemetry.jsonl
 M content/skill-pm.md
 M content/skill-qa-engineer.md
 M dist/gates/registry.{d.ts,d.ts.map,js,js.map}
 M dist/tools/handoff-orchestrator.{d.ts.map,js,js.map}
 M gates/registry.ts
 M tasks.md
 M test/context-budget.test.mjs
 M test/error-code-contract.test.mjs
 M test/qa-visual-skill-split.test.mjs
 M tools/handoff-orchestrator.ts
?? dist/gates/ac-execution.{d.ts,d.ts.map,js,js.map}
?? gates/ac-execution.ts
?? qa_reports/expected-red_e3-outcome-shaped-acceptance.txt
?? review_reports/review_T-E3-CR.md
?? specs/e3-outcome-shaped-acceptance{,-architecture}.md
?? test/ac-execution.test.mjs
```
Every entry is one of: the three named legs (`content/skill-pm.md`, `content/skill-qa-engineer.md`, `gates/ac-execution.ts` + `gates/registry.ts` + `tools/handoff-orchestrator.ts`), the qa-owned test re-baselines (architecture's T-E3-04, folded into this task), `dist/` rebuild artifacts, or process bookkeeping (`.current/`, `tasks.md`, `qa_reports/`, `review_reports/`, `specs/`). Confirmed NOT touched: `schema/versions.ts`, `schema/migrations-*.ts`, `tools/transitions.ts`, `gates/qa-review.ts`, `content/skill-sr-engineer.md`, `content/skill-qa-visual.md`, any `const-*.md`. No pixel-diff execution engine, no second gate mechanism, no keyword-scanning of `qa_review` text. Matches code-reviewer's own AC7 confirmation in `review_reports/review_T-E3-CR.md`.
Verdict: **PASS**.

**AC8** — proof: `grep -c '^| N/A' specs/e3-outcome-shaped-acceptance.md` returns exactly 3 — one `N/A` row per table (Copy/Strings, Visual Tokens, Visual Widgets).
```
$ grep -c '^| N/A' specs/e3-outcome-shaped-acceptance.md
3
exit=0
```
Verdict: **PASS** (exactly 3).

### AC Execution Log — Overall
8/8 ACs executed, 8/8 PASS. No proof was unrunnable; no command failed; no observed outcome contradicted its AC text. Zero Phase 4 FAIL dispositions required from this log.
## 2026-07-12T11:02:22.620Z — PASS — by qa-engineer

QA PASS — e3-outcome-shaped-acceptance. Full round over T-E3-01 (PM AC schema), T-E3-02 (QA runtime-evidence phase), T-E3-03 (AC_EXECUTION_LOG_MISSING gate) — all already code-reviewer APPROVED (review_reports/review_T-E3-CR.md). QA round adds test/ac-execution.test.mjs (27 tests: arm/disposition unit tests, integration tests against the real handleUpdateState orchestrator, file-mode-only guard, skill-content assertions) and 3 qa-owned re-baselines (test/error-code-contract.test.mjs registry 27->28 + FREE_TEXT_ALLOWLIST entry; test/context-budget.test.mjs skill-pm token cap 3922->4128, also fixing a stale title/assert drift code-reviewer flagged; test/qa-visual-skill-split.test.mjs skill-qa-engineer byte cap 12950->14729). Test-infra fix: filed the new suite at test/ac-execution.test.mjs (flat) instead of the architecture-named test/gates/ac-execution.test.mjs, since npm test's non-recursive glob (test/*.test.mjs) never collects a nested path — verified empirically with a probe file. Full regression: npm run build && npm audit --audit-level=high && npm test -- 1350/1350 pass, 0 fail, 0 high/critical audit findings. Phase 0.5 Expected-Red Diff: clean, 5/5 C15 manifest entries confirmed red pre-fix, 0 unexplained reds. Dogfood Phase 3.5 AC Execution Log: all 8 of this spec's own proof:-annotated ACs executed, 8/8 PASS -- see qa_reports/review_T-E3-QA.md ## AC Execution Log and ## Expected-Red Diff sections for full command/output detail.

