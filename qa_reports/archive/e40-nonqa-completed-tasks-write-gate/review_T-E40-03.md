# Review — T-E40-03 (E40 non-qa completed_tasks write gate, QA test surface)

covers: T-E40-01, T-E40-02, T-E40-03

Reviewed by @qa-engineer (sonnet). Code review APPROVED at round 2
(`review_reports/review_T-E40-01.md`) — this review does not re-open F1/F2/F3;
it owns only the test surface named in T-E40-03 and the PASS decision on
T-E40-01/T-E40-02/T-E40-03.

## Expected-Red Diff

`qa_reports/expected-red_e40-nonqa-completed-tasks-write-gate.txt` exists, feature-scoped
to `e40-nonqa-completed-tasks-write-gate`, 19 entries, authored by sr-engineer per SOP 7a
(closing the gap the code-reviewer flagged forward in round 1: the manifest previously
arrived only as `pending_notes` prose, not a file).

Ran `npm test` myself against the pre-edit tree (before any of this round's test changes):
**1704 tests / 1685 pass / 19 fail**. Diffed the actual 19 `not ok` names against the
manifest's 19 entries — **identical sets**, 19 and 19, confirming the code-reviewer's own
round-2 verification independently rather than trusting it on report. All 19 located in
their named files (15 literal grep hits; the 4 `compose-equivalence:
buildPromptForRole(...)` rows are template-generated at
`test/compose-equivalence.test.mjs:93`, correctly attributed).

Disposition: all 19 are genuine expected-red, baseline-shift class (32→33
`GATE_REGISTRY` re-baseline + its downstream consumers), not regressions — closed by this
round's Phase 3 below. Phase 0.5: clean.

One manifest inaccuracy, already flagged by the manifest itself and independently
re-confirmed here rather than taken on trust: the manifest's inline comment at its ceilings
section says the F2 clause (a code-reviewer round-2 fix) added "+24/+24/+23 ~tok
respectively" for the third figure, when it is actually +24 (matching the other two) — the
manifest's own `+383` totals two lines below are correct and are what this round's
re-baseline actually uses. Re-measured live (below), not taken from any handoff note.

## Phase 1 — Review

No `specs/e40-nonqa-completed-tasks-write-gate.md` or
`design/e40-nonqa-completed-tasks-write-gate.md` exists — mini-chain, backlog-row-as-spec
dispatch (`.current/handoff.md` `scope_decision_why`: PM/architect skipped;
`docs/backlog.md:166` E40 row is the spec). Consequently:

- **Phase 3a Copy Audit Gate**: N/A, no spec Copy/Strings H2 exists. Skipped.
- **Phase 3b Visual Audit Gate**: N/A, no spec Visual Tokens H2 exists. Skipped.
- **Phase 1.5 Visual Compare**: no `design/<feature>.md`, no Visual Baselines H2. Skipped
  (`content/skill-qa-visual.md` not read).
- **Phase 3.5 AC Execution**: no `specs/<active_feature>.md` to scan for `proof:`
  annotations. Skipped.

Implementation review of the shipped diff (`tools/handoff-orchestrator.ts`'s widened
`REVIEWER_COMPLETED_TASKS_REJECTED` step, `gates/registry.ts`'s union + doc-map line + 33rd
entry, `content/const-08-chain-31-mid.md`'s new row) was already carried out across two
code-review rounds — the bypass closure constructed end-to-end (not read-and-assumed) in
both file mode and SQLite mode, the c16 envelope proven byte-identical, `agent_id`
absent/undefined proven to still be caught earlier by `AGENT_ID_REQUIRED`, and the stale
doc-map comment for the pre-existing `REVIEWER_COMPLETED_TASKS_REJECTED` code (F1) fixed
and independently re-verified. QA scope (skill-qa-engineer §Scope) is tests/coverage, not
re-litigating correctness/architecture the reviewer already cleared. I did independently
re-derive the pipeline position of the new step (read `tools/handoff-orchestrator.ts:437-490`
myself) to design the test seeding correctly — see the hazard note below — rather than
trusting the reviewer's characterization blind.

**Test-design hazard** (flagged forward by the code-reviewer, round 2): the widened step
sits AFTER `AGENT_ID_REQUIRED`, `TRANSITION_REJECTED`, and `CUT_APPROVAL_REQUIRED` in
`UPDATE_STATE_GATE_PIPELINE`. `CUT_APPROVAL_REQUIRED`/`SCOPE_DECISION_REQUIRED`/
`EXTERNAL_REFS_UNRESOLVED`/`SOURCE_CREDIBILITY_UNVERIFIED` are all pinned specifically to
`prevTuple.agent === "pm" && nextTuple.agent ∈ {architect, sr-engineer}` (verified by
reading every `prevTuple.agent ===`/`nextTuple.agent ===` site in the file). A naive test
that seeds `prev=pm:In_Progress` (no `cut_approved`) then writes `agent_id="architect"`
would hit `CUT_APPROVAL_REQUIRED` instead, and a raw `agent_id="doc-writer"` write isn't
even a real `AgentName` (not in the 8-member union in `tools/transitions.ts`), so it would
hit `AGENT_ID_REQUIRED` first — both pass, but for the wrong reason, silently certifying
nothing about the new gate. Every new identity test below instead seeds a LEGAL prev-tuple
via the generic same-agent self-loop fast path (`validateTransition` step 3: accepted
unconditionally, before the table lookup and before any pm-pinned build-entry gate, none
of which match a same-agent self-loop since `prevTuple.agent` is never `"pm"` there), and
asserts the SPECIFIC new error code, not merely `isError`.

## Phase 3 — Tests

### (1) Non-qa identity matrix — `test/reviewer-completed-tasks-gate.test.mjs`

Extended (not rewritten). Added `FM6`-`FM11` (file mode: `sr-engineer`, `pm`, `architect`,
`researcher`, `design-auditor`, `release-engineer`), each: seed `(role, In_Progress)` on
disk directly (the file's existing `seedFileState` helper — real server write path, so no
`STAMP_PROVENANCE_SUSPECT` false-positive), then a same-role self-loop write carrying
`completed_tasks: ["T-BOGUS-01"]`. Each asserts: `isError`, the text includes
`NON_QA_COMPLETED_TASKS_REJECTED`, the text does NOT include
`REVIEWER_COMPLETED_TASKS_REJECTED` (proves the NEW code fires, not a mis-shadowed old
one), and the on-disk ledger stays `[]` after the rejection (no poisoning). Added `SQ4`
(SQLite mode, `sr-engineer`) mirroring FM6, proving the gate's "no `FileHandoffStorage`
guard" design at runtime for a non-reviewer identity too (SQ1/SQ3 already covered
code-reviewer/qa-engineer in SQLite; this closes the non-qa-identity gap in that matrix).

`code-reviewer` still rejected with the unchanged c16 code/envelope (FM1/SQ1, both
untouched by this round, still green) and `qa-engineer` still accepted (FM2/FM3/FM4/FM5,
SQ2/SQ3, all untouched, still green) — verified by running the full file, not merely by
inspection that I didn't touch those tests.

### (2) Bypass regression pin — `BYPASS-FM` / `BYPASS-SQL`

`BYPASS-FM` (file mode) constructs the exact incident shape the code-reviewer built
end-to-end in round 1/2: `sr-engineer` self-loop pre-filling `T-BOGUS-BYPASS`
(**WRITE1**) → asserted rejected specifically with `NON_QA_COMPLETED_TASKS_REJECTED`
**at that write**, ledger asserted still `[]` → legitimate advance
`sr-engineer:In_Progress → code-reviewer:In_Progress → qa-engineer:In_Progress` (both
empty-`completed_tasks` claim writes, unaffected) → **WRITE2**: `qa-engineer` write
carrying the SAME never-persisted id, deliberately `status: "In_Progress"` and no
`qa_review` field (a `qa_review`-bearing PASS/FAIL write auto-records its own evidence
BEFORE the completion-evidence gate runs — `QA_REVIEW_RECORD` precedes
`QA_COMPLETION_EVIDENCE_MISSING` in the pipeline by design — which would have satisfied
the gate for the wrong reason and proven nothing; mirrors the `QAEV-4a` shape in
`test/e18-write-provenance.test.mjs` exactly). Asserted: rejected specifically with
`QA_COMPLETION_EVIDENCE_MISSING` (the id is now genuinely new, since WRITE1 never
persisted it — the control proving E18/E32 was not loosened or reordered to compensate for
the new upstream gate), ledger still `[]` throughout.

`BYPASS-SQL` (SQLite mode) mirrors WRITE1 only: `pm` self-loop pre-filling
`T-BOGUS-BYPASS-SQL`, asserted rejected at the first write with
`NON_QA_COMPLETED_TASKS_REJECTED`, ledger (read back via `storage.parse(dir)`) still `[]`.
It deliberately does NOT replay WRITE2: `QA_COMPLETION_EVIDENCE_MISSING` is explicitly
FILE-MODE ONLY (`content/const-08-chain-31-mid.md`'s QA Completion-Evidence row;
`storage instanceof FileHandoffStorage` guard in `tools/handoff-orchestrator.ts`,
pre-existing and untouched by this feature) — asserting it fires in SQLite mode would
assert a behavior the codebase documents as explicitly out of scope, not a real regression
check. Satisfies T-E40-03(2)'s "cover both file mode and the SQLite matrix" instruction
without overclaiming what the SQLite matrix actually guarantees.

**Spec-to-test map** (T-E40-03's own four items):
- Item (1) non-qa identity matrix → `FM6`-`FM11`, `SQ4` (above).
- Item (2) bypass regression pin, both modes → `BYPASS-FM`, `BYPASS-SQL` (above).
- Item (3) `error-code-contract`/`e35-pipeline-order` re-baseline → below.
- Item (4) golden/ceiling re-baseline → below.

### (3) `error-code-contract.test.mjs` / `e35-pipeline-order.test.mjs` re-baseline

`test/error-code-contract.test.mjs`: `GATE_REGISTRY.length` 32→33 (test 544, title updated
to name the cause); doc-file mapping comment count 32→33 (test 563) — added an in-file
note explaining test 563 is NOT a bare re-baseline this round: round 1 shipped a stale
mapping-comment line for the PRE-EXISTING `REVIEWER_COMPLETED_TASKS_REJECTED` code (F1,
masked by the same `32` count assert this round re-baselines), fixed in *source* by
sr-engineer and independently re-verified by the code-reviewer at round 2 — QA's
re-baseline here is only the count, the per-code comparison needed no test-side change.
Added two `FREE_TEXT_ALLOWLIST` entries for `NON_QA_COMPLETED_TASKS_REJECTED` ×
{`triggerEdge`, `armCondition`} (test 564) — verified both are genuinely uncheckable
(`triggerEdge` is free English with no role:Status pair or `CAP_BY_CODE` literal;
`armCondition` is snake_case field-name shorthand, so `extractPredicateNames`'s
`CAMEL_RE` finds nothing), same shape as the `REVIEWER_COMPLETED_TASKS_REJECTED` precedent
immediately above it, not a new exemption class.

`test/e35-pipeline-order.test.mjs`: widened the `REVIEWER_COMPLETED_TASKS_REJECTED` step's
`codes:` pin from 1 to 2 entries (test 499) — step NAME unchanged (no rename: the reviewer
proved the c16 envelope stays byte-identical, so retiring the published step name would
misdescribe that continuity), order unchanged.

Also re-baselined `test/e26-gate-stats.test.mjs` (6 failures: R1, R2, U1, D1, D2, T3b) —
**not explicitly named in T-E40-03's item (3) list, but load-bearing for the "full suite
PASS" requirement** and confirmed by the code-reviewer's own round-1 review to be genuine
32→33 baseline-shift, nothing substantive broken (registry coverage, catalog order,
fired/zero_fire disjointness+union-equality, unregistered-code isolation,
`prose_behavioral fires:null` boundary, bare-workspace degradation all re-verified to hold
at 33 in the reviewer's own probe). All six hardcoded `32` literals (sanity asserts, test
titles, coverage-sum asserts) moved to `33`, with an in-file comment naming E40 as the
cause, same convention as the other files.

### (4) Golden/ceiling re-baseline — precedent 6ef1a6e / E59

**Goldens**: ran `scripts/capture-constitution-golden.mjs` against the built tree (backed
up the existing fixtures first, diffed byte-for-byte after, then deleted the backup).
Exactly 5 of the 12 committed fixtures moved: `build-full-{nondesign,design}{,-fd}.txt`
(4) and `hook-full.txt` (1) — the const-08 fragment is chain-tagged (composed into every
chain/full-detail bundle, never lite), matching the manifest's claim exactly. The other 7
(`build-lite-*` ×4, `hook-lite.txt`, `skill-coordinator-monolith.txt`, and
`constitution-monolith.txt`) came back byte-identical to the pre-edit fixtures — confirmed
by `cmp`, not by assumption — so were left untouched; a golden moving for any other reason
would have been a real regression per T-E40-03's own instruction, and none did.
`constitution-monolith.txt` needed a manual re-derive (the script prints a note and skips
it: the pre-refactor `content/constitution.md` monolith source no longer exists, deleted
by an earlier ticket's AC8) — regenerated it as `CONSTITUTION_SEGMENTS.map(fragment =>
readFile).join("")`, exactly what `test/compose-equivalence.test.mjs`'s own
`t-cat-equals-monolith` test compares against, so the fixture is authoritative for what
that test actually checks.

**Ceilings**: re-measured live from the built tree (not taken from any handoff note),
independently confirming the code-reviewer's own two-round re-measurement:

| ceiling | old | new | delta |
|---|---|---|---|
| design-arm rationale-stripped (`test/context-budget.test.mjs`) | 8804 | 9187 | +383 |
| teamwork coordinator bundle (design-arm) | 16898 | 17281 | +383 |
| non-design (design-only + rationale stripped) | 6706 | 7089 | +383 |

All three match the manifest's `+383` totals exactly (its `+23` parenthetical for the third
figure — noted above as inaccurate — was never load-bearing; only the `+383` totals were
used here). Each assertion's message and preceding comment block updated with the new
figure and an E40-attributed explanation, following the exact wording convention of the
`e59-const6-waiver-clause` re-baseline in commit `25d231e` (precedent named by the task).
Saving-margin sub-asserts (`raw - stripped >= 240`, `ratStripped - nonDesign >= 2080`)
re-verified to still hold at the new figures (380 and 2098 respectively) — unchanged
invariants, not touched.

**Coverage**: the new pipeline step is one `if`-branch with a 4-term boolean predicate; all
branches are exercised — `code-reviewer` (pre-existing, unchanged), each of the 6 other
non-qa identities individually, `qa-engineer` (falls through, unchanged), and the
absent-`agent_id` case (owned by `AGENT_ID_REQUIRED`, already covered by
`test/e18-write-provenance.test.mjs` and `review_reports/review_T-E40-01.md`'s
T-E40-02(b), not re-duplicated here). No coverage tooling wired for this repo; noted per
SOP 6c in lieu of a numeric figure.

**Security smoke**: boundary inputs — empty `completed_tasks` (unaffected, existing
FM2/FM3/SQ2), absent `agent_id` (owned earlier in the pipeline, not this gate's
responsibility). No new auth/permission surface (attestation-based identity, unchanged per
the reviewer's Security section) — no additional smoke tests needed beyond the identity
matrix itself.

## Phase 4 — Run

- **Build**: `npm run build` — `prebuild` (`check:version` OK 3.99.0) → `tsc` (0 errors) →
  `postbuild` (`check:transitions-sync` OK, 21 keys, exact match). No source file touched
  this round (only `test/**` and `test/fixtures/compose-golden/**`), so `dist/` is
  unchanged by this round versus the already-reviewed T-E40-01/02 diff.
- **Audit**: `npm audit --audit-level=high` — exit 0. 5 advisories (2 low, 3 moderate:
  `body-parser`, `esbuild`, `hono`, `protobufjs`), none HIGH/CRITICAL. No dependency added
  or removed this round; `package.json`/`package-lock.json` untouched — Constitution §6's
  dependency-audit build gate does not fire.
- **Test**: `npm test` — **1713/1713 pass, 0 fail** (`# tests 1713 / # pass 1713 / # fail
  0`). 1685 baseline-post-source-fix + 19 previously-red now green (the exact manifest set)
  + 9 new tests (`FM6`-`FM11`, `BYPASS-FM`, `SQ4`, `BYPASS-SQL`). CI runnability: headless,
  zero interaction, standard `node --test` exit code.

## Cut hygiene

`git status --short` after this round shows only my own edits (`test/context-budget.test.mjs`,
`test/e26-gate-stats.test.mjs`, `test/e35-pipeline-order.test.mjs`,
`test/error-code-contract.test.mjs`, `test/reviewer-completed-tasks-gate.test.mjs`, and the
5 golden fixtures named above), the state-write side effects (`.current/handoff.md`,
`tasks.md`), and the already-approved cut (`content/const-08-chain-31-mid.md`,
`gates/registry.ts`, `tools/handoff-orchestrator.ts`, `dist/gates/registry.*`,
`dist/tools/handoff-orchestrator.*`, `qa_reports/expected-red_*`,
`review_reports/review_T-E40-01.md`). `.current/feature-split.md` is the pre-existing
E48/E59 doc-guard modification the round-1 review already noted as unrelated to this cut.
No `test/` file other than the five named above was touched; no out-of-scope file was
created.

## Verdict

**PASS.** All four T-E40-03 test-surface items land: the non-qa identity matrix (6 new
identities + the SQLite parity case) is extended with the test-design hazard the
code-reviewer flagged forward correctly avoided (every case seeds a legal prev-tuple and
asserts the specific new code, never an earlier-gate shadow); the bypass regression pin
constructs the incident end-to-end in file mode (asserting rejection at the exact first
write, then re-proving the downstream evidence gate is still armed and unweakened) and
pins the storage-agnostic first-write rejection in SQLite mode without overclaiming the
file-mode-only downstream gate; `error-code-contract`/`e35-pipeline-order` are re-baselined
32→33 with the in-file E40 comment convention (plus `e26-gate-stats`, load-bearing for full
green though not named in the task's item list); and exactly the 5 goldens the const-08
edit legitimately moves were re-captured (7 confirmed unchanged, `constitution-monolith.txt`
re-derived from its actual current source of truth) alongside the 3 ceilings that actually
breached, each with the measured `+383` delta. Build green (postbuild OK, 21 keys exact
match); `npm audit --audit-level=high` clean of HIGH/CRITICAL; full suite **1713/1713**,
the declared 19-entry expected-red now fully closed with 0 unexplained reds. T-E40-01 and
T-E40-02 were already code-review APPROVED (round 2, `review_reports/review_T-E40-01.md`)
and are completed here as part of this same PASS per this feature's dispatch shape
(mini-chain, qa owns the close for all three ids).
## 2026-08-13T07:16:18.496Z — PASS — by qa-engineer

PASS. E40 non-qa completed_tasks write gate. Test surface: (1) 6 new non-qa identity tests (FM6-FM11: sr-engineer/pm/architect/researcher/design-auditor/release-engineer) + SQ4 SQLite parity, each seeded on a LEGAL self-loop prev-tuple per the reviewer's flagged hazard (avoids CUT_APPROVAL_REQUIRED/AGENT_ID_REQUIRED shadowing) and asserting the specific NON_QA_COMPLETED_TASKS_REJECTED code. (2) BYPASS-FM/BYPASS-SQL regression pin: non-qa prefill rejected AT THE FIRST WRITE (not merely somewhere in the sequence), ledger stays unpoisoned, downstream QA_COMPLETION_EVIDENCE_MISSING still armed on the genuinely-new id (proves E18/E32 not loosened). (3) error-code-contract.test.mjs + e35-pipeline-order.test.mjs re-baselined 32->33 with in-file E40 comments (test 563's mapping-comment count re-baseline separated from F1's genuine source-side fix, already closed by sr-engineer/code-reviewer); e26-gate-stats.test.mjs also re-baselined (6 tests, load-bearing for full green, not in task's literal item list but flagged as such). (4) Exactly 5 goldens re-captured (4 build-full-*, hook-full) + constitution-monolith.txt re-derived from its actual current source (CONSTITUTION_SEGMENTS concat, since the pre-refactor monolith file no longer exists); 7 other goldens confirmed byte-unchanged. 3 ceilings re-baselined to measured +383 each (9187/17281/7089), matching manifest exactly (its +23 parenthetical typo noted, non-load-bearing). Full build clean, npm audit --audit-level=high clean of HIGH/CRITICAL, full suite 1713/1713 (0 fail). Evidence qa_reports/review_T-E40-03.md covering T-E40-01, T-E40-02.

