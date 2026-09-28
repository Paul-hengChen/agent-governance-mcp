# QA Review — c12-registry-field-consumers

covers: T-C12-02, T-C12-03, T-C12-04, T-C12-05

## Summary

Extended `test/error-code-contract.test.mjs` to give `triggerEdge`,
`armCondition`, and `clearingArtifact` — the three doc-facing `GateDefinition`
fields A10 left unchecked — the same generative-parity treatment `hintStatic`
already has, per option (b) "assert" chosen in `specs/c12-registry-field-consumers.md`
(options (a) render and (c) delete were rejected there). 7 new tests added
(21 total in the file, 1042/1042 in the full suite). Verdict: **PASS**.

Crash-resume note: a prior qa-engineer instance was killed by a session limit
immediately after the Phase-0 claim write landed. Ground-truthed against
`git diff` before starting: zero test-file edits existed, `T-C12-02..05` were
fully open, and code-reviewer's `review_reports/review_T-C12-01.md` APPROVED
verdict for T-C12-01 (the errorCode→doc-file mapping comment above
`GATE_REGISTRY`) was already in place. All work below is fresh, done in this
session.

## Phase 0.5 — Expected-Red Diff

`Phase 0.5: skipped (no expected-red manifest declared)` — no
`qa_reports/expected-red_c12-registry-field-consumers.txt` exists; this
feature is a pure test-coverage addition, no intentionally-red tests.

## Phase 1 — Review

T-C12-01 (the registry mapping comment this feature consumes as its
doc-file-mapping input) was already independently reviewed and APPROVED by
code-reviewer (`review_reports/review_T-C12-01.md`) — adversarial 10-entry
cross-producer spot-check, 0 stale. Not re-litigated here; T-C12-02..05 are
QA-authored test additions, not implementation under code-reviewer's
correctness/architecture purview.

**Copy Audit Gate**: N/A — spec's Copy/Strings table is explicitly empty
("feature introduces no new user-facing strings").

**Visual Audit Gate**: N/A — spec's Visual Tokens table is explicitly empty
("feature has no visual literals").

## Phase 1.5 — Visual Compare

`Phase 1.5: skipped (no Visual Baselines declared)` — no `design/<feature>.md`
exists; non-design feature (recorded on the handoff `scope_decision` field
per standing PM practice).

## Phase 2 — Discussion

No issues found in Phase 1 — proceeding directly to Phase 3.

## Phase 3 — Tests

### AC → test map

| AC | test(s) |
|---|---|
| AC1 (non-empty triggerEdge/armCondition/clearingArtifact, all 22) | `AC1 (c12): every GATE_REGISTRY entry has non-empty triggerEdge/armCondition/clearingArtifact` |
| AC2 (checkable-literal parity: cap literals, predicate names, transition-edge pairs, doc-file mapping) | `AC2 (c12): round-cap entries' triggerEdge numeric literal matches the live transitions.ts cap constant`; `AC2 (c12): orchestrator-producer armCondition predicate names are literally present in tools/handoff-orchestrator.ts`; `AC2 (c12): transition-edge-pair literals in triggerEdge appear verbatim in the mapped content/*.md doc file(s)`; `AC2 (c12): TRANSITION_REJECTED's ALLOWED_TRANSITIONS literal is a real transitions.ts export, verbatim in its mapped doc`; `doc-file mapping (c12): gates/registry.ts's errorCode→doc-file mapping comment matches the actual backtick-quote sites` (supporting infra: proves the mapping the AC2 doc-checks trust is itself accurate) |
| AC3 (explicit allowlist for free-text fields, no silent exemptions) | `FREE_TEXT_ALLOWLIST` data table (24 entries) + `AC3 (c12): every (errorCode, field) pair for triggerEdge/armCondition is either mechanically checked above or explicitly allowlisted as free-text — no silent exemptions` (closure/completeness test) |
| AC4 (negative-control test-of-the-test) | manual verification below (not a persisted test — mutation must not ship) |
| AC5 (compose-golden / context-budget untouched) | verified below via `git status`/`git diff --stat` |
| AC6 (GateDefinition type + all 22 entries byte-unchanged except factual corrections) | verified below via `git diff --stat gates/registry.ts` |

### Design notes (why these specific checks)

- **Cap literals**: `QA_ROUND_EXCEEDED`/`REVIEW_ROUND_EXCEEDED`/`VISUAL_ROUND_EXCEEDED`'s
  `triggerEdge` encodes `>= N`. Rather than hand-verifying N once, the test
  imports `ROUND_CAP_EXPORTED`/`REVIEW_ROUND_CAP_EXPORTED`/`VISUAL_ROUND_CAP_EXPORTED`
  from the built `tools/transitions.js` (these exports already existed,
  added for `test/visual-round-transitions.test.mjs`) and asserts numeric
  equality against the live constant — a cap re-tune in `transitions.ts`
  without a matching registry-comment update now fails loudly.
- **Predicate names**: for `producer: "orchestrator"` entries, a camelCase
  identifier (`/\b[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)+\b/g`) extracted from
  `armCondition` (e.g. `hasDesignModeRequiringVisual`, `armCheck`,
  `checkBaselineManifest`) must appear literally in
  `tools/handoff-orchestrator.ts` — the file that actually calls it. 15
  checks fire across 13 of the 14 orchestrator-producer entries (the 15th,
  `CUT_APPROVAL_REQUIRED`/`EXTERNAL_REFS_UNRESOLVED`/`REVIEW_VERDICT_STATUS_MISMATCH`/
  `REVIEWER_COMPLETED_TASKS_REJECTED`, carry no camelCase predicate and are
  allowlisted for `armCondition` instead).
- **Transition-edge pairs**: `SCOPE_DECISION_REQUIRED`/`CUT_APPROVAL_REQUIRED`/
  `EXTERNAL_REFS_UNRESOLVED`'s `triggerEdge` all encode a bare `pm:In_Progress`
  edge (the `{architect,sr-engineer}:In_Progress` half is a brace-set, not a
  single role name, so `EDGE_RE` intentionally does not extract it). Each is
  asserted verbatim-present in >=1 of that code's mapped
  `content/*.md` file(s) (per `extractDocCodes()`, already used by the
  existing "registry ⊆ doc" test). Verified by direct grep before writing
  the assertion: `pm:In_Progress` appears in `const-08-chain-31-mid.md`
  (SCOPE_DECISION_REQUIRED, CUT_APPROVAL_REQUIRED) and `skill-pm.md`
  (EXTERNAL_REFS_UNRESOLVED).
- **`MISSING_REVIEW_EVIDENCE` deliberately excluded from the edge-pair
  bucket**: its `triggerEdge` (`code-reviewer:In_Progress -> qa-engineer:In_Progress`)
  is structurally identical to the pm-edge cases, but its sole mapped doc
  (`skill-code-reviewer.md`) documents that hop only as comma-tuple prose
  (`` `(sr-engineer, In_Progress)` `` → `` `(code-reviewer, In_Progress)` ``),
  never the colon form verbatim — confirmed by direct grep (no
  `code-reviewer:In_Progress`/`qa-engineer:In_Progress` substring anywhere
  in that file). Forcing this into the checkable bucket would be a
  guaranteed false failure, not a real check, so it is allowlisted with the
  reason recorded inline (AC3's "never silently exempted without
  acknowledgment" bar).
- **`ALLOWED_TRANSITIONS`**: `TRANSITION_REJECTED`'s `triggerEdge` names this
  export once — pinned as its own test (a repeating extractor wasn't
  warranted for a single occurrence) rather than folded into the generic
  camelCase/edge-pair extractors, since it's a SCREAMING_SNAKE constant name,
  not a predicate call or role:status pair.
- **Doc-file mapping accuracy**: the AC2 doc-verbatim checks above all trust
  `gates/registry.ts`'s hand-authored comment (T-C12-01) to know which
  `content/*.md` file(s) to search. That comment is prose, not an exported
  const (TS comments don't survive into `dist/`), so a dedicated test
  parses it directly from source and asserts it is byte-identical (as a
  file-basename set) to `extractDocCodes()`'s live scan of `content/*.md` —
  verified 0 mismatches across all 22 codes before writing the assertion.
- **Coverage gate**: all 22 `GATE_REGISTRY` entries are covered by AC1's
  non-empty bar; AC2's checkable buckets cover 7/22 for `triggerEdge` and
  13/22 for `armCondition`; the remaining 15/22 and 9/22 respectively are
  named individually in `FREE_TEXT_ALLOWLIST` with a one-line reason each.
  The closure test (`AC3 (c12): ...no silent exemptions`) mechanically
  proves every one of the 44 (22 × {triggerEdge, armCondition}) pairs lands
  in exactly one bucket — 100% line coverage on the classification logic
  itself, not just the registry data.
- **Security smoke**: N/A — this is a test-file-only addition with no new
  input surface (no user input, no auth/permission boundary); the existing
  boundary-input coverage on `GATE_REGISTRY`/doc parsing (empty-string,
  malformed-comment resilience) is inherited from the pre-existing
  `extractDocCodes`/`extractCodeCodes` harvesters this feature reuses
  unchanged.

## AC4 — Negative-control (test-of-the-test)

Three independent mutations were applied to `gates/registry.ts`, rebuilt,
and confirmed to turn the corresponding new assertion red — each was then
reverted and rebuilt clean before proceeding. `git diff` confirms zero
mutation residue.

1. **Cap-literal drift**: `QA_ROUND_EXCEEDED.triggerEdge` `"prev_qa_round >= 4 ..."`
   → `"prev_qa_round >= 5 ..."`. Result: `AC2 (c12): round-cap entries'
   triggerEdge numeric literal matches the live transitions.ts cap constant`
   → **FAILED** (`5 !== 4`, exact expected message). Reverted; rebuilt; test
   passed again.
2. **Predicate-name typo**: `SCOPE_DECISION_REQUIRED.armCondition`
   `"hasDesignModeRequiringVisual().required"` → `"hasDesignModeRequiresVisual().required"`.
   Result: `AC2 (c12): orchestrator-producer armCondition predicate names are
   literally present in tools/handoff-orchestrator.ts` → **FAILED**
   (`"hasDesignModeRequiresVisual" ... does not appear literally`). Reverted;
   rebuilt; test passed again.
3. **Doc-file-mapping drift**: the mapping comment's `AGENT_ID_REQUIRED`
   row `skill-qa-engineer.md` → `skill-qa-visual.md`. Result: `doc-file
   mapping (c12): gates/registry.ts's errorCode→doc-file mapping comment
   matches the actual backtick-quote sites` → **FAILED** (declared
   `[skill-qa-visual.md]` vs actual `[skill-qa-engineer.md]`). Reverted;
   rebuilt; test passed again.

Post-revert verification: `git diff --stat gates/registry.ts` shows only
the pre-existing T-C12-01 comment-only insertion (32 lines, unchanged from
before this session); `git status --porcelain` shows no `.bak`/stray files;
full suite re-run green (1042/1042).

## Phase 4 — Run

- **Build**: `npm run build` — 0 errors (ran 5 times total across the
  mutation/revert cycle plus the final check; all clean).
- **`npm test`**: **1042/1042 pass, 0 fail** (prebuild + full `node --test
  test/*.test.mjs`; up from the pre-existing 1035, +7 for this feature's
  new tests). CI-runnable: headless, zero interaction.
- **`npm audit --audit-level=high`**: exit 0 — 1 low-severity finding only
  (`esbuild` 0.27.3–0.28.0, GHSA-g7r4-m6w7-qqqr, Windows-dev-server-only file
  read; unrelated to this diff, below the `--audit-level=high` threshold).
- **AC5 guardrail (compose-golden / context-budget untouched)**:
  `git status --porcelain test/fixtures/compose-golden/` → empty.
  `git diff --stat test/fixtures/compose-golden/` → empty.
  `git diff --stat test/context-budget.test.mjs` → empty. Zero edits to
  either, confirmed by direct `git` inspection, not by absence-of-intent.
- **AC6 guardrail (registry.ts unchanged except factual corrections)**:
  `git diff --stat gates/registry.ts` shows only T-C12-01's pre-existing
  32-line comment-only insertion (errorCode→doc-file mapping) — no
  `GateDefinition` field added/removed, no entry value edited by this
  session's work. `git status --porcelain -- dist/` shows only
  `dist/gates/registry.*` changed (T-C12-01's rebuild), confirming no other
  source file's compiled output drifted.
- **Known pre-existing flakes** (`test/handoff-write-arg-guard.test.mjs`
  AC-1, `test/prompt-state-footer.test.mjs:429`): did not manifest this run
  — full suite was green on the first pass with no isolation re-run needed.

**Verdict: PASS.**

## Diff surface (this session)

- `test/error-code-contract.test.mjs` — 7 new tests (T-C12-02/03), the
  `FREE_TEXT_ALLOWLIST` data table (T-C12-03/AC3), and the new
  `ROUND_CAP_EXPORTED`/`REVIEW_ROUND_CAP_EXPORTED`/`VISUAL_ROUND_CAP_EXPORTED`
  import.
- No edits to `gates/registry.ts`, `prompts/build.ts`,
  `prompts/constitution-manifest.ts`, any `content/const-*.md`, or any
  compose-golden fixture — DR-3's guardrail (option (a) rejected) stays
  respected.
## 2026-07-10T03:42:36.413Z — PASS — by qa-engineer

c12-registry-field-consumers PASS. Extended test/error-code-contract.test.mjs with 7 new tests (21 total in file, 1042/1042 full suite) giving triggerEdge/armCondition/clearingArtifact the same generative-parity bar hintStatic already has (option (b) assert, per spec). AC1: non-empty on all 22 entries x 3 fields. AC2: cap-literal parity (4/4/6 vs live transitions.ts ROUND_CAP/REVIEW_ROUND_CAP/VISUAL_ROUND_CAP exports), predicate-name parity (15 checks, 13 orchestrator-producer entries, vs tools/handoff-orchestrator.ts), transition-edge-pair doc-verbatim parity (pm:In_Progress, 3 entries) + ALLOWED_TRANSITIONS pinned case, plus a new doc-file-mapping-accuracy test proving gates/registry.ts's T-C12-01 comment matches extractDocCodes()'s live scan (0 mismatches). AC3: explicit FREE_TEXT_ALLOWLIST (24 entries, one-line reason each) + a closure test mechanically proving all 44 (22 x {triggerEdge,armCondition}) pairs land in exactly one bucket (checked or allowlisted, never neither/both) — no silent exemptions. AC4: 3 negative-control mutations (cap drift, predicate typo, doc-mapping drift) each confirmed to turn the matching new assertion red, then reverted; git diff confirms zero residue. AC5: npm run build 0 errors, npm audit --audit-level=high exit 0 (1 unrelated low-severity esbuild finding), npm test 1042/1042 (0 fail), zero diffs to test/fixtures/compose-golden/* or test/context-budget.test.mjs. AC6: git diff --stat gates/registry.ts shows only T-C12-01's pre-existing 32-line comment-only insertion — no GateDefinition field/entry edits this session. Full evidence: qa_reports/review_T-C12-02.md (covers T-C12-02..05). Release bookkeeping (T-C12-06) intentionally left to release-engineer.

