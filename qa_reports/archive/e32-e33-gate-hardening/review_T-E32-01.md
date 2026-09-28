# QA Review — T-E32-01 / T-E33-01 (batched)

covers: T-E32-01, T-E33-01

Reviewer: qa-engineer (sonnet). Code-reviewer APPROVED in round 2
(review_reports/review_T-E32-01.md) after a round-1 CHANGES_REQUESTED (C1
incident-replay-still-lands, C2 c16-conflict-needs-PM-adjudication) and a
human-approved c16 contract amendment (option A). This report certifies the
test-modernization + new-coverage + full-suite phase (SOP Phase 3 onward) and
records the PASS decision for both T-E32-01 and T-E33-01.

## Expected-Red Diff

Manifest: `qa_reports/expected-red_e32-e33-gate-hardening.txt` (11 entries,
round-2 superseding version — see the file's own header for the round-1 ->
round-2 rationale).

Pre-edit `npm test`: **1600 total, 1589 pass, 11 fail.** The 11 actual reds
match the manifest **exactly**, one-for-one, zero unexplained:

- 6 compose-goldens (`test/compose-equivalence.test.mjs`): the four
  `build-full-*` modes, the full SessionStart hook, and the 15-fragment
  monolith invariant — all stale against the amended `content/const-08-chain-31-mid.md`
  QA Completion-Evidence bullet.
- `QAEV-4` (`test/e18-write-provenance.test.mjs`) — pinned the OLD
  exemption (now removed).
- `FM4`, `FM5` (`test/reviewer-completed-tasks-gate.test.mjs`) — pinned the
  OLD manifest-in-`completed_tasks` shape on the APPROVED row.
- `P1a`, `P1b` (`test/e28-shrink-warning.test.mjs`) — pinned the pre-E33
  "same-count swap is silent" behavior.

Phase 0.5: **clean (11/11 manifest entries confirmed red, 0 unexplained
reds).** No re-baseline edit made before this disposition.

## Phase 1 — Review

No `design/e32-e33-gate-hardening.md` exists → Phase 1.5 (Visual Compare):
skipped (no Visual Baselines declared). `specs/c16-c10-role-boundary.md`
carries no `proof:`-annotated ACs → Phase 3.5 (AC Execution Log): skipped.

Correctness/architecture/security review of the implementation itself was
already performed adversarially by code-reviewer across two rounds (see
`review_reports/review_T-E32-01.md`, both rounds, including the live-replay
tables R1-R4/C1-C4 and the PROBE 6 divergent-field analysis, all verified
against a freshly rebuilt `dist/`). Per skill-qa-engineer's Hard Rules
("Scope"), correctness/architecture is code-reviewer's domain; QA's role
here is test authorship, coverage, and the evidence/PASS boundary. I
independently re-verified the amended gate code
(`tools/handoff-orchestrator.ts` lines 706-784 QA_COMPLETION_EVIDENCE_MISSING,
lines 1081-1114 MISSING_REVIEW_EVIDENCE) and the amendment text in
`specs/c16-c10-role-boundary.md`'s "## Amendment — E32" section before
writing new tests against them — no discrepancy found from the reviewer's
account.

Copy Audit / Visual Token Audit: N/A — `specs/c16-c10-role-boundary.md`'s
Copy/Visual Tokens/Visual Widgets tables are all "N/A — feature has no
user-facing strings / visual literals / non-primitive widgets" (server-gate
and skill-text change only).

## Test Modernization (§2, qa-owned)

1. **6 compose-goldens** — re-ran `node scripts/capture-constitution-golden.mjs`.
   5 fixtures regenerated automatically (`build-full-{nondesign,design,
   nondesign-fd,design-fd}.txt`, `hook-full.txt`); confirmed via `git diff`
   that the byte-diff in each is **solely** the amended const-08 QA
   Completion-Evidence bullet (one line: the old "sanctioned APPROVED-row...
   is exempt" sentence replaced by "NO edge/status/verdict exemption... the
   APPROVED-row handoff carries review scope in the transient
   `review_task_ids` field..."). The 6th fixture,
   `test/fixtures/compose-golden/constitution-monolith.txt`, cannot be
   auto-recaptured (its source `content/constitution.md` was deleted
   post-AC8) — hand-edited the identical one-line substitution (including
   the `<!-- origin:start --> (amended E32)<!-- origin:end -->` tag,
   byte-matched against `content/const-08-chain-31-mid.md`) to keep the
   DR-1 Option R cat-equivalence invariant true. Verified via
   `node --test test/compose-equivalence.test.mjs` (14/14 green).
2. **QAEV-4** (`test/e18-write-provenance.test.mjs`) — split into
   `QAEV-4a` (the OLD sanctioned shape — completed_tasks manifest +
   review_reports evidence, no qa_reports — now asserted REJECTED
   `QA_COMPLETION_EVIDENCE_MISSING`, ledger stays `[]`) and `QAEV-4b` (the
   AMENDED compliant shape — `review_task_ids` manifest, `completed_tasks`
   empty — asserted ACCEPTED, ledger stays `[]`).
3. **FM4/FM5** (`test/reviewer-completed-tasks-gate.test.mjs`) — both
   re-pinned to the amended contract: `completed_tasks` empty,
   `review_task_ids` carries the manifest. FM4 (no review_reports evidence)
   still asserts `MISSING_REVIEW_EVIDENCE` fires and
   `QA_COMPLETION_EVIDENCE_MISSING`/`REVIEWER_COMPLETED_TASKS_REJECTED` do
   not. FM5 (review_reports evidence present) asserts ACCEPTED and that
   `completed_tasks` stays `[]` on disk. SQ3 (SQLite-mode sibling) is
   file-mode-gate-unaffected by design (`QA_COMPLETION_EVIDENCE_MISSING` is
   `instanceof FileHandoffStorage`-guarded) — left as-is, confirmed still
   green.
4. **P1a/P1b** (`test/e28-shrink-warning.test.mjs`) — re-pinned from
   "same-count swap is silent" to "same-count swap WARNS, naming the
   dropped entry" (`dispatch_pins`/`external_refs` respectively), asserting
   the exact `kept N of M ... dropped: <entry>` envelope text E33's
   entry-identity diff now produces.

## New Coverage Authored (gaps the modernized tests left open)

New file `test/e32-e33-gate-hardening.test.mjs` (10 new tests), labeled to
match code-reviewer's own round-2 live-replay table 1:1 for direct
traceability against `review_reports/review_T-E32-01.md`:

- **R1 (PERMANENT REGRESSION PIN)** — the exact e-p3-tail-batch incident
  shape (`review_verdict=APPROVED` carried, `completed_tasks` grown with 3
  ids, a `review_reports/` covers-file naming them, `qa_reports/` ABSENT) is
  REJECTED `QA_COMPLETION_EVIDENCE_MISSING`, ledger stays `[]`. This is the
  live incident this ticket exists to close — explicitly commented as a
  permanent pin not to be weakened without re-reading the c16 Amendment.
- **R2** — R1 minus `review_verdict` → still REJECTED.
- **R4** — verdict + growth + ZERO review evidence anywhere (no
  `review_reports/` at all) → REJECTED `QA_COMPLETION_EVIDENCE_MISSING`,
  proving it fires independently of, and before, `MISSING_REVIEW_EVIDENCE`.
- **C2** — amended compliant shape (`review_task_ids`, `completed_tasks`
  empty) minus review evidence → REJECTED `MISSING_REVIEW_EVIDENCE` (proves
  the re-pointed gate did not go dead).
- **C3** — a genuine qa-engineer PASS write with its own `qa_review`
  (auto-recorded as evidence in the same write, per the gate ordering at
  handoff-orchestrator.ts:701-703 vs :753) → ACCEPTED. No prior test
  exercised this exact PASS-path self-satisfaction shape.
- **P6a/P6b/P6c** — the divergent-field matrix (completed_tasks vs
  review_task_ids naming different ids): P6a (review_task_ids evidenced,
  completed_tasks diverges unevidenced) → REJECTED
  `QA_COMPLETION_EVIDENCE_MISSING`; P6b (completed_tasks evidenced,
  review_task_ids diverges unevidenced) → REJECTED
  `MISSING_REVIEW_EVIDENCE`; P6c (both diverge, both evidenced) → ACCEPTED.
  Confirms the two gates are orthogonal — neither evidence type can
  substitute for the other, closing the "new attack surface" code-reviewer
  probed in round 2.
- **ENV-1/ENV-2** — rejection-envelope content (E23 named-path posture):
  `QA_COMPLETION_EVIDENCE_MISSING`'s envelope names every offending id AND
  its exact expected `qa_reports/review_<id>.md` path (via the exported
  `qaEvidencePath` wrapper), and mentions the `covers:` fallback as an
  alternative remediation.

(C1 — compliant amended shape ACCEPTED — is covered by the modernized
`QAEV-4b`; C4 — carry-forward no-growth ACCEPTED — is covered by the
pre-existing `QAEV-3`. Not duplicated in the new file.)

## Full Suite (Phase 4)

- `npm run build`: **green** (tsc, zero errors).
- `npm test` post-modernization: **1611 total, 1611 pass, 0 fail.**
  (1600 baseline + 1 net new in e18-write-provenance.test.mjs [QAEV-4 split
  into QAEV-4a/QAEV-4b] + 10 net new in test/e32-e33-gate-hardening.test.mjs
  = 1611.)
- CI runnability: `npm test` runs headlessly, zero human interaction
  required (`node --test test/*.test.mjs` via the package.json script).

## Non-blocking doc-debt (reviewer finding, out of QA scope)

`specs/code-reviewer-role-extraction-architecture.md` (lines 138/345/379,
historical v3.9.0 doc) still describes `completed_tasks` as the review-scope
manifest — historical architecture doc, not loaded into agent context, not
the living contract (superseded by `specs/c16-c10-role-boundary.md`'s
"## Amendment — E32" section). Flagged for a doc-writer pass; not fixed
here (out of QA scope per skill-qa-engineer's Scope hard rule).

## Verdict

**PASS** for both T-E32-01 and T-E33-01. The amended c16 contract is
enforced server-side, the R1 incident is permanently regression-pinned, the
two gates' orthogonality is proven under adversarial divergent-field
conditions, and the full suite is green with zero failures.
## 2026-07-16T10:33:12.921Z — PASS — by qa-engineer

QA PASS (batched, qa_reports/review_T-E32-01.md covers both ids). Phase 0.5: pre-edit npm test = 1600/1589 pass/11 fail, exact 1:1 match against qa_reports/expected-red_e32-e33-gate-hardening.txt, zero unexplained. Modernized the 11: (1) 6 compose-goldens re-captured via scripts/capture-constitution-golden.mjs (5 auto + constitution-monolith.txt hand-patched identically, since its source content/constitution.md was deleted post-AC8) — byte-diff verified solely the amended const-08 QA Completion-Evidence bullet; (2) QAEV-4 (e18-write-provenance.test.mjs) split into QAEV-4a (OLD sanctioned shape now REJECTED) / QAEV-4b (AMENDED review_task_ids shape ACCEPTED, ledger stays []); (3) FM4/FM5 (reviewer-completed-tasks-gate.test.mjs) re-pinned to review_task_ids, asserting MISSING_REVIEW_EVIDENCE still fires/clears correctly and completed_tasks stays unpolluted; (4) P1a/P1b (e28-shrink-warning.test.mjs) re-pinned to assert the warning naming the dropped entry. Authored new-file test/e32-e33-gate-hardening.test.mjs (10 tests) labeled 1:1 against code-reviewer's round-2 replay table: R1 (PERMANENT REGRESSION PIN for the exact e-p3-tail-batch incident shape — verdict carried, completed_tasks grown, review_reports covers-file present, qa_reports absent -> REJECTED, ledger unpolluted), R2/R4 variants, C2 (amended shape minus review evidence -> MISSING_REVIEW_EVIDENCE, gate still alive), C3 (legit PASS + own qa_review auto-record -> ACCEPTED), P6a/P6b/P6c (divergent completed_tasks vs review_task_ids id-set matrix -> gates proven orthogonal, neither evidence substitutes for the other), ENV-1/ENV-2 (rejection envelope names every offending id + its exact qa_reports/review_<id>.md path + the covers: fallback, E23 posture). Full suite post-modernization: npm test = 1611/1611 pass, 0 fail (1600 + 1 net [QAEV-4 split] + 10 net [new file]). npm run build green. Non-blocking doc-debt (specs/code-reviewer-role-extraction-architecture.md stale completed_tasks description) flagged for doc-writer, not fixed (out of QA scope).

