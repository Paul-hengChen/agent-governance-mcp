# QA review — T-E18-01 / T-E18-02

covers: T-E18-01, T-E18-02

Feature: e18-write-provenance. Spec = docs/backlog.md "## E18 — Write-provenance
hardening" section (baseline 8789bd8, v3.85.0, uncommitted tree). Code review:
APPROVED (verdict returned inline to coordinator, no review_reports/*.md file
per subagent policy — see chain pending_notes).

Both gates close holes exploited during the PREVIOUS chain (E5): incident (a)
a hand-authored closing write (third E9A-class, fabricated zero-entropy
stamps); incident (b) an identity-swap gate evasion (a code-reviewer
subagent's second write, stamped agent_id="qa-engineer", pre-filling
completed_tasks before any qa-engineer ran, zero evidence on disk).

## Expected-Red Diff

`qa_reports/expected-red_e18-write-provenance.txt` (15 entries) declared by
sr-engineer at handoff. Ran the FULL suite BEFORE touching any re-baseline
edit; collected the actual red set; diffed against the manifest.

**Phase 0.5: clean (15/15 manifest entries confirmed red, 0 unexplained
reds).** The actual `node --test test/*.test.mjs` red set (`grep "^not ok"`)
was, verbatim:

1. `compose-equivalence.test.mjs | buildPromptForRole(skill-sr-engineer.md, design=false, fullDetail=false) ... build-full-nondesign.txt`
2. `compose-equivalence.test.mjs | buildPromptForRole(..., design=true, fullDetail=false) ... build-full-design.txt`
3. `compose-equivalence.test.mjs | buildPromptForRole(..., design=false, fullDetail=true) ... build-full-nondesign-fd.txt`
4. `compose-equivalence.test.mjs | buildPromptForRole(..., design=true, fullDetail=true) ... build-full-design-fd.txt`
5. `compose-equivalence.test.mjs | SessionStart hook (AGC_DEFAULT_SKILL=full) ... hook-full.txt`
6. `compose-equivalence.test.mjs | cat(15 manifest fragments in order) === ... monolith`
7. `context-budget.test.mjs | AC8/AC-P2-7: rationale-stripped (design-arm) ... floor`
8. `context-budget.test.mjs | AC8/AC-P2-7: teamwork coordinator bundle ... floor`
9. `context-budget.test.mjs | AC8/AC-P2-7: non-design ... floor`
10. `error-code-contract.test.mjs | AC-1/AC-5: GATE_REGISTRY has exactly 30 entries`
11. `error-code-contract.test.mjs | AC-5: ALL_GATE_CODES === code-side shape-rule harvest`
12. `error-code-contract.test.mjs | registry ⊆ doc: every documentedInProse:true entry ...`
13. `error-code-contract.test.mjs | doc-file mapping (c12): ... comment matches ... backtick-quote sites`
14. `error-code-contract.test.mjs | AC3 (c12): every (errorCode, field) pair ...`
15. `feature-lease.test.mjs | AC4 (e10): migration heal-write preserves pre-heal last_updated verbatim`

Byte-for-byte the same 15 entries as the manifest (6 compose-equivalence + 3
context-budget ratchet floors + 5 error-code-contract + 1 feature-lease AC4).
Zero extra/missing entries — no disposition-by-exception needed.

## AC Execution Log

Phase 3.5: skipped (no `proof:`-annotated ACs — the E18 spec is a
`docs/backlog.md` row, not a `specs/<feature>.md` file with AC `proof:`
annotations).

## Phase 1 — Review findings

Read `gates/stamp-provenance.ts`, `gates/qa-review.ts`, `gates/registry.ts`,
`tools/handoff-orchestrator.ts`, `tools/drift.ts`, `content/const-08-chain-31-mid.md`,
`content/skill-release-engineer.md` in full. Verified against both incidents:

- **Incident (a) replay** (test `QAEV-INCIDENT` is the (b) replay; the (a)
  gate is directly exercised by `STAMP-1`/`STAMP-2`/`STAMP-3`): a hand-authored
  stamp shape (seconds `00`, ms `.000`) on disk now blocks the next write
  unless acknowledged via `stamp-remediation:` — this would have caught the
  v3.85.0 incident (a) hand-edit at the NEXT legitimate write after the
  fabrication, forcing acknowledgment into the audit trail. Confirmed the
  predicate is the SAME one used by the pre-existing read-only `stampAdvisory`
  (tools/drift.ts now imports `isHandAuthoredStamp` from
  `gates/stamp-provenance.ts` — no fork, single source of truth).
- **Incident (b) replay** (test `QAEV-INCIDENT`): reproduced the exact E5
  shape — a legitimate APPROVED write (empty completed_tasks manifest, the
  review-scope list) followed by a SECOND, same-session write still stamped
  `agent_id="qa-engineer"` pre-filling the real completion ids with zero
  evidence on disk. Confirmed REJECTED `QA_COMPLETION_EVIDENCE_MISSING`,
  naming all 3 replayed ids, and confirmed the ids do NOT land in
  `completed_tasks` (no ledger pollution). This is the exact hole
  `REVIEWER_COMPLETED_TASKS_REJECTED` (C16) could not see (it only gates
  writes stamped `agent_id="code-reviewer"`; the incident borrowed the
  `qa-engineer` identity to route around it).
- Gate placement verified correct: `STAMP_PROVENANCE_SUSPECT` runs BEFORE
  the feature-lease gate (the lease predicate consumes `last_updated`, so a
  suspect stamp must be resolved before the lease trusts it) —
  `QA_COMPLETION_EVIDENCE_MISSING` runs AFTER the `qa_review` auto-record
  (so a legitimate PASS/FAIL write's own just-recorded evidence satisfies
  it; confirmed live by this session's own completion write).
- Both gates correctly `FileHandoffStorage`-only (SQLite/HTTP mode inert) —
  confirmed via direct-row-poke SQLite tests (`STAMP-SQL`, `QAEV-SQL`), not
  just code inspection.
- `tw_complete_task` confirmed untouched (own evidence path; no diff in
  `tools/tasks.ts` / `tools/tasks-file.ts`).
- **Finding (fixed, test-infra only, not a product bug):** the
  `gates/registry.ts` doc-file mapping comment for `MISSING_REVIEW_EVIDENCE`
  was stale — the new QA-Completion-Evidence bullet in const-08 incidentally
  backtick-quotes `MISSING_REVIEW_EVIDENCE` as a cross-reference (explaining
  the APPROVED-row exemption), giving it a SECOND backtick-quote site the
  hand-authored mapping comment didn't yet list. Fixed the comment
  (`skill-code-reviewer.md, const-08-chain-31-mid.md`) as part of the
  qa-owned error-code-contract re-baseline — this is bookkeeping for the
  test-side parity check, not a behavioral change.
- Spec fidelity: both fixes match docs/backlog.md's Fix (a)/Fix (b) text and
  the E5 incident records (qa_reports/review_T-E5-01.md) exactly. No scope
  drift found.

## Spec-to-Test map

- Fix (a) STAMP_PROVENANCE_SUSPECT fires on suspect stamp -> STAMP-1
- Fix (a) audited stamp-remediation note clears the gate, persists verbatim -> STAMP-2
- Fix (a) self-disarm after accepted write -> STAMP-3
- Fix (a) new-workspace inert -> STAMP-4
- Fix (a) ms-entropy stamp never trips -> STAMP-5
- Fix (a) SQLite/HTTP-mode exempt -> STAMP-SQL
- Fix (a) RELAY REQUIRED / COORDINATOR-RELAYED hard line content pin -> CONTENT-3
- Fix (b) unevidenced self-loop add rejected, names missing ids -> QAEV-1
- Fix (b) per-id evidence clears the gate -> QAEV-2
- Fix (b) cumulative list-back not gated -> QAEV-3
- Fix (b) APPROVED-row edge exempt (evidenced by MISSING_REVIEW_EVIDENCE instead) -> QAEV-4
- Fix (b) incident (b) exact replay rejected -> QAEV-INCIDENT
- Fix (b) SQLite/HTTP-mode exempt -> QAEV-SQL
- Content pins: const-08 both bullets carry (v3.86.0, E18) origin tags + own error code -> CONTENT-1, CONTENT-1b, CONTENT-2
- Re-baselines: 6 compose-equivalence goldens (regen via scripts/capture-constitution-golden.mjs
  + direct composeConstitution regen for constitution-monolith.txt, content/constitution.md
  being retired; skill-coordinator-monolith.txt independently confirmed byte-identical,
  no regen needed — E18 touches no coord-NN fragment); 3 context-budget floors
  (independently re-measured: design-arm 8437 ~tok, teamwork bundle 16532 ~tok,
  non-design 6340 ~tok — all +574 ~tok over the pre-E18 baseline, proportionate
  to the ~602 ~tok combined size of the two new const-08 bullets, not a blowout);
  5 error-code-contract entries (30->32 count, SUFFIX_RE +SUSPECT, 2 new
  FREE_TEXT_ALLOWLIST triggerEdge entries, doc-file mapping count + the
  MISSING_REVIEW_EVIDENCE finding above); feature-lease AC4 (e10) re-baselined
  with a stamp-remediation: pending_notes[0] note on the follow-up write,
  preserving the original heal-write-preserves-last_updated assertion AND
  adding a sub-assertion that the new gate genuinely fires first (not a
  vacuous "it's exempt" claim).

## Coverage

New file `test/e18-write-provenance.test.mjs` (17 tests, all green): STAMP-1..5,
STAMP-SQL, QAEV-1..4, QAEV-INCIDENT, QAEV-SQL, CONTENT-1/1b/2/3, plus one
predicate sanity test. Re-baselined `test/compose-equivalence.test.mjs` (6),
`test/context-budget.test.mjs` (3), `test/error-code-contract.test.mjs` (5),
`test/feature-lease.test.mjs` (1 — AC4 (e10)).

## Run

`npm run build` — clean, zero errors. `npm test` — 1472/1472 pass, 0 fail
(prebuild + node --test test/*.test.mjs). Full suite green, no unexpected reds.

## Verdict

PASS. Both gates verified against the exact incident shapes they close.
Content pins verified. Full suite 100% green. No unresolved findings.
## 2026-07-14T03:53:06.092Z — PASS — by qa-engineer

PASS. Phase 0.5: expected-red manifest (15 entries) verified byte-identical to the actual red set — clean, 0 unexplained reds. Re-baselined: 6 compose-equivalence goldens (regen via scripts/capture-constitution-golden.mjs + direct composeConstitution regen for the retired constitution.md monolith fixture; skill-coordinator-monolith.txt confirmed unchanged, no coord-NN fragment touched); 3 context-budget floors independently re-measured (design-arm 8437, teamwork bundle 16532, non-design 6340 ~tok — all +574 over baseline, proportionate to the ~602~tok combined new const-08 bullets); 5 error-code-contract entries (30->32, SUFFIX_RE +SUSPECT, 2 new FREE_TEXT_ALLOWLIST triggerEdge entries, doc-file mapping count + a stale-mapping finding fixed: MISSING_REVIEW_EVIDENCE gained a second backtick-quote site in const-08's new bullet); feature-lease AC4 (e10) re-baselined with a stamp-remediation note on the follow-up write, preserving the original heal-write-preservation assertion and adding proof the new gate fires first. New file test/e18-write-provenance.test.mjs (17 tests): STAMP gate verified against incident (a) shape (suspect stamp rejects, remediation note clears + persists, self-disarms, new-workspace/ms-entropy inert, SQLite exempt); QA-evidence gate verified against incident (b) shape, including an EXACT E5 identity-swap replay (APPROVED write then same-session self-loop pre-fill, zero evidence) now REJECTED naming all 3 ids, plus APPROVED-row exemption, cumulative list-back non-gating, SQLite exempt. Content pins: const-08 both bullets carry (v3.86.0, E18) origin tags + own error codes; skill-release-engineer carries the COORDINATOR-RELAYED hard line. tw_complete_task confirmed untouched. npm run build clean; npm test 1472/1472 pass. My own completion writes exercised the new QA-evidence gate live without incident (evidence auto-recorded by the same PASS write satisfies it, per design). See qa_reports/review_T-E18-01.md (covers: T-E18-02) for full detail.

