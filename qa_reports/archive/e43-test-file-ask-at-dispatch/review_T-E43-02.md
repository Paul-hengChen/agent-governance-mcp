# QA Review — T-E43-01 + T-E43-02 (E43, `e43-test-file-ask-at-dispatch`)

covers: T-E43-01, T-E43-02

## Round 1 — PASS

Ticket: `docs/backlog.md` E43 (order 7). Mini-chain — the backlog row IS the spec, so there is no
`specs/e43-*.md`; the "ACs" below are the row's own requirements, mapped in Phase 3.

## Phase 0 — Claim

No separate claim write was issued: the state machine was already at `(qa-engineer, In_Progress)`
because the code-reviewer's APPROVED row stamps `agent_id="qa-engineer"` by design (Constitution
§3.1's canonical edge; `coord-03`'s *Known non-mismatches* note pins this as legitimate, not an
identity misstamp). A further self-loop write would have added a state record with no state change.

## Expected-Red Diff

Manifest: `qa_reports/expected-red_e43-test-file-ask-at-dispatch.txt`, 16 entries. Full suite run by
QA **before any re-baseline edit** (own run, not sr-engineer's or the reviewer's figure).

- **Run 1**: 1745 tests / 1728 pass / **17 fail** — 16/16 manifest entries confirmed red, plus **one
  actual red not on the manifest**:
  `test/e32-e33-gate-hardening.test.mjs | P6a: review_task_ids=[A] (evidenced via review_reports) but completed_tasks grows with [B] (NO qa_reports) -> REJECTED QA_COMPLETION_EVIDENCE_MISSING, ledger []`
- **Disposition: intermittent flake, not caused by this cut.** Substantiated rather than asserted:
  (i) the test file and every code path it exercises are untouched by this cut — `git diff
  --name-only` is `content/*.md` only, and no mechanism connects a prose edit to a gate-evidence
  test; (ii) the test uses `mkWs()` temp workspaces, so it does not read this repo's real
  `qa_reports/` or `review_reports/` and cannot have been polluted by the files this feature added;
  (iii) re-ran that file in isolation **3×: 10/10 pass each time**; (iv) re-ran the **full** suite:
  1745 / 1729 / **16 fail**, the 17th red gone, red set exactly equal to the manifest. One
  occurrence in four full runs, zero in three isolated runs.
- **Limitation, stated rather than papered over**: run 1 captured only the `not ok` lines, so the
  assertion message for that failure was not preserved and the flake's mechanism is
  **unidentified**. "Flake" here means "not reproducible and not causally connected to this cut",
  not "understood". A gate test that fails intermittently under the parallel runner is worth a
  ticket on its own evidence — surfaced to PM below rather than closed here.
- Not escalated as an expected-red regression: the *Escalation Routes* row fires on a red "with no
  plausible innocent disposition". Four independent lines of evidence is a disposition; the
  unexplained-mechanism residue is a filing, not a FAIL.
- After the re-baselines: **1756 tests / 1756 pass / 0 fail** (1745 + 11 new).

## Phase 1 — Review

Reviewed the shipped text, not the handoff prose.

- **Copy Audit Gate (3a) / Visual Audit Gate (3b)**: N/A — no `specs/<feature>.md`, hence no *Copy /
  Strings* or *Visual Tokens* H2 to audit, and this cut renders no user-facing string or style
  literal. Logged rather than silently skipped.
- **Correctness of the rule as delivered**: verified the three branches partition with a residual
  catch-all, that the catch-all is two-sided (create **or** judge none warranted), and that both
  unaccountable outcomes (silent create, silent skip) are barred. Verified in the **rendered**
  bundle, not just on disk — `applyTextTransforms({fullDetail:false})` keeps all three branches and
  the halting prohibition, and leaks no fence markers.
- **The change is live in this very session**: the `skill-qa-engineer.md` SOP delivered by
  `tw_switch_role` for this round already carried the edited Phase 3a, and this round then executed
  under the new rule (see Phase 3a below). The fix was exercised, not only asserted.
- **Out-of-scope observation, not a FAIL** (QA scope rule — correctness/architecture belong to
  code-reviewer): none found beyond what Round 1/2 of `review_reports/review_T-E43-01.md` already
  raised and resolved.

## Phase 1.5 — Visual Compare

`Phase 1.5: skipped (no Visual Baselines declared)` — no `design/e43-*.md`; `content/skill-qa-visual.md` deliberately not read.

## Phase 3 — Tests

### 3a. Test File Discovery — the ticket's own rule, exercised

Branch **(a)** fired. `tasks.md` T-E43-02 states *"new test file creation is pre-authorized for this
ticket"*, which is exactly branch (a)'s "brief names the target test file(s) **or pre-authorizes
creation**", so no ask was owed and none was made. Recorded here because branch (a) requires the
acting role to log which branch it acted on. Placement chosen by QA per the pre-authorization:
`test/e43-test-file-ask-at-dispatch.test.mjs`, following the established per-ticket convention
(`test/e5-intake-tiering.test.mjs`, `test/e16-judge-dispatch-charter.test.mjs`,
`test/e24-exemptions.test.mjs`). Note the counterfactual: under the **pre-E43** rule this round would
have had to either halt or deviate-and-disclose. It did neither.

### 3b. Ticket-to-Test map

| E43 requirement (backlog row / review findings) | test |
|---|---|
| fix (i) — dispatcher resolves placement at brief time | `t-e43-branch-a-reads-the-brief`, `t-e43-coord02-template-line` |
| the brief line must stay target-conditional (unconditional would re-break every non-qa brief) | `t-e43-coord02-rule-is-target-conditional` |
| Round-1 **F1** — catch-all must permit "no new test warranted" | `t-e43-branch-c-is-two-sided` |
| Round-1 **F2** — branches must partition, no fall-through | `t-e43-branches-partition-with-catch-all` |
| neither unaccountable outcome may be silent | `t-e43-no-silent-create-or-skip` |
| the unexecutable pre-E43 instruction must survive nowhere | `t-e43-retired-form-absent-everywhere` (sweeps every `const-`/`coord-`/`skill-` fragment, not just the edited two) |
| §2 no-restatement + read-the-brief-first in the acting SOP | `t-e43-qa-sop-defers-to-const2` |
| the label must mean the same thing in all three files | `t-e43-placement-label-is-one-string` |
| the rule must reach non-`fullDetail` bundles | `t-e43-branches-survive-strip` |
| the pins must red against the defect they name | `t-e43-assertions-red-against-pre-e43-text` |

Class assertions were preferred over instance pins (E66 option (ii) / E69 precedent): the realistic
regressions are a **fourth branch reintroducing a fall-through**, a **conditional template line
added without stating when it applies**, and **label drift across the three files** — none of which
an instance pin on today's wording would catch. Two of the eleven are guard-the-guard: the pins are
replayed against a hermetic pre-E43 literal **and** against the round-1 draft the code reviewer
rejected, and each must throw. A pin that cannot fail against its own defect is decoration.

**One defect found in QA's own test code and fixed before PASS**: the first draft's branch parser was
last-wins, so the bullet's trailing *"never compliant under (c)"* back-reference silently overwrote
the real branch-(c) span — the F1/F2 pins were reading the rationale sentence instead of the branch.
Caught because two assertions went red against correct content. Fixed to first-match-wins, with the
trap documented in-file.

No history-as-fixture reads (E77 meta-test class): the pre-fix texts are embedded literals, not
`git show`. Verified green — `test/render-structure.test.mjs` sweeps all test files for that pattern.

### 3c. Coverage Gate

Not measurable and deliberately not faked: the cut changes **zero executable lines** (3 markdown
files), so line coverage is undefined. The meaningful coverage question is *"is every requirement of
the ticket pinned"*, answered by the map above.

### 3d. Security Smoke Tests

N/A, stated explicitly: no input crosses a trust boundary, no auth surface, no new code path.
`npm audit --audit-level=high` exit 0 (5 advisories, none high/critical).

## Re-baseline record (T-E43-02's substance)

**12 golden fixtures**, regenerated via `scripts/capture-constitution-golden.mjs` (10) plus the two
the script cannot produce: `constitution-monolith.txt` (script's capture path is `content/constitution.md`,
deleted at A9/AC8 — rebuilt as the ordered concatenation of `CONSTITUTION_SEGMENTS`, the same
operation the assertion performs) and `skill-coordinator-monolith.txt` (rebuilt via
`composeSkill("skill-coordinator.md", hostCapabilitiesFor("claude-code"))`).
**Minimality diff-verified** (E72 precedent): `git diff --stat` shows **1 changed line in each of the
11 constitution fixtures** and **+2/-1 in the coordinator monolith** — exactly the edited spans, no
incidental drift.

**4 context-budget caps**, each independently re-measured by QA (not taken from sr-engineer's handoff
or the reviewer's report):

| cap | was | now | delta | source of the delta |
|---|---|---|---|---|
| AC2 lean always-on bundle | 4667 | **4868** | +201 | const-05 bullet |
| AC8 design-arm constitution | 9187 | **9374** | +187 | const-05 bullet |
| AC8 non-design constitution | 7089 | **7276** | +187 | const-05 bullet |
| AC8 teamwork coordinator bundle | 17498 | **17844** | +346 | +187 const-05, ~159 coord-02 |

Cross-check that the numbers are internally consistent rather than merely measured: the design-arm
minus non-design saving is **9374 − 7276 = 2098 ~tok, unchanged** from the pre-E43 pair (9187 − 7089).
That invariance is the expected signature of an edit to a **core (untagged)** fragment — it lands in
both paths identically — and it is why only the coordinator bundle, the sole measured bundle carrying
the host-tagged `coord-02`, moves by more than the const-05 delta. A stray change to the design-only
fragments would have broken that equality.

## Decision: rationale-fencing the §2 bullet — considered, REJECTED (carried from review Round 2)

The code reviewer routed this here explicitly so it would be decided against the measured number
rather than an estimate, and asked for the decision to be written down either way.

- Measured cost of the bullet: 230 → 1032 chars, **+187 ~tok on every bundle** (const-05 is core, so
  every dispatch mode pays it).
- Fenceable text, examined clause by clause: *"Halting the round to ask is never compliant under
  (c)"* is **normative** — it is the single sentence that makes E43's fix binding, and stripping it
  from non-`fullDetail` bundles would delete the rule from the text every dispatched role actually
  receives. Only the causal tail (*"a dispatched subagent has no ask channel and no resumption path,
  so resolving placement is the DISPATCHER's obligation at brief time (…)"*) is genuinely rationale
  — **~45 ~tok, i.e. 0.5% of the 9374-tok design-arm bundle** and under a quarter of this cut's
  growth.
- **Rejected**, three reasons: the saving is ~0.5% of one bundle; `const-05` uses no rationale fences
  today, so this would be the first, and E69/E75 are two shipped instances of fence placement
  rendering wrong; and the tail carries the pointer to where the obligation lives, which is the part
  a reader of the always-on bundle most needs.
- Locked in rather than left as a comment: `t-e43-branches-survive-strip` now fails if any part of
  the branches or the halting prohibition is ever moved behind a fence. Fencing the causal tail
  alone remains available and would still pass.

## Phase 3.5 — AC Execution

`Phase 3.5: skipped (no proof:-annotated ACs)` — no `specs/<feature>.md` exists for this mini-chain, so
no `proof:` annotations exist to execute. The server-side `AC_EXECUTION_LOG_MISSING` gate is
therefore not armed.

## Phase 4 — Run

- `npm run build`: **clean** (tsc + `check:transitions-sync` OK, 21 keys exact).
- Full suite: **1756 tests / 1756 pass / 0 fail** (1745 + the 11 new).
- CI runnability: headless, zero human interaction, no new tooling or fixture infrastructure added.
- `npm audit --audit-level=high`: exit 0.

## Surfaced to PM (not blocking, filed rather than dispositioned away)

1. **`test/e32-e33-gate-hardening.test.mjs` P6a is intermittently red under the parallel full-suite
   runner** — 1 failure in 4 full runs, 0 in 3 isolated runs (10/10 each), mechanism unidentified
   because the assertion text was not captured. Backlog-worthy on its own evidence: a
   **governance-gate** test that flakes is the kind that gets dispositioned away next time by
   someone with less context, and this round is itself the precedent for doing so. Candidate P3,
   test-infra class (adjacent to E77's hermeticity work). Recommend capturing full failure output on
   the next occurrence before diagnosing.
2. **`scripts/capture-constitution-golden.mjs` cannot regenerate 2 of the 12 fixtures it is the
   documented tool for** — `constitution-monolith.txt` (its source `content/constitution.md` was
   deleted at A9/AC8; the script prints a note and skips) and `skill-coordinator-monolith.txt`
   (never in the script's scope). Both had to be rebuilt by hand-written one-off code this round,
   re-deriving the exact operation from the assertions. That is a re-baseline trap for every future
   const-/coord- content ticket: the obvious tool silently under-delivers and the suite stays red
   until someone works out why. Candidate P3, content-only-ish (extend the script to derive the
   monolith from `CONSTITUTION_SEGMENTS` and add the `composeSkill` capture).

## Verdict

**PASS** — T-E43-01 (3 content files, both round-1 findings resolved and independently re-verified
against the shipped text) and T-E43-02 (12 goldens re-baselined and minimality-verified, 4 caps
re-measured and bumped with the cross-check holding, 11 new pins including two guard-the-guard, one
self-inflicted parser defect found and fixed before PASS). Full suite green. The rule that E43 exists
to fix was exercised by this very round under branch (a) and did not require a deviation.
## 2026-08-20T11:16:37.958Z — PASS — by qa-engineer

PASS round 1. T-E43-01: 3 content files, zero code/logic/schema; both code-review round-1 findings independently re-verified against the shipped text (branch (c) is two-sided AND a true residual catch-all). T-E43-02: 12 golden fixtures re-baselined with minimality diff-verified (1 changed line in each of the 11 constitution fixtures, +2/-1 in the coordinator monolith); 4 context-budget caps independently re-measured and bumped (4667->4868, 9187->9374, 7089->7276, 17498->17844) with the design-arm-minus-non-design saving holding at 2098 ~tok, the expected invariant for a core-fragment edit; 11 new pins in test/e43-test-file-ask-at-dispatch.test.mjs, class assertions preferred over instance pins, two of them guard-the-guard (replayed against a hermetic pre-E43 literal AND against the round-1 draft the reviewer rejected, each required to throw). One defect found in QA's own test code and fixed pre-PASS: a last-wins branch parser was reading the bullet's trailing "under (c)" back-reference instead of branch (c). Expected-red diff: 16/16 manifest entries confirmed, one 17th red (e32-e33 P6a) dispositioned as an intermittent flake on four independent lines of evidence and FILED rather than closed (mechanism unidentified). Rationale-fencing the bullet was considered with the measured numbers and REJECTED (~45 ~tok = 0.5%; const-05 uses no fences today; E69/E75 are two shipped fence-render failures) and the rejection is now pinned by t-e43-branches-survive-strip. Build clean, npm audit --audit-level=high exit 0, full suite 1756/1756. Evidence: qa_reports/review_T-E43-02.md (covers T-E43-01, T-E43-02).

**RECORD CORRECTION (2026-08-20, qa-engineer)** — the auto-recorded `qa_review` above was truncated at this point by an **E86-class malformed tool call**: the `tw_update_state` call's SECOND argument block was mis-tagged, so its entire literal text (closing tag and a literal opening parameter tag for the second argument included — reproduced here only in prose, never as markup) was absorbed onto the tail of the FIRST argument and auto-recorded here verbatim, while the handoff's `pending_notes` landed EMPTY. The markup tail has been removed from this file; the substantive review text above is unaltered, and the intended `pending_notes` were re-written to the handoff in a follow-up bookkeeping write. No verdict, evidence, or measurement was changed. This is the second recorded occurrence of the E86 class and the first to reach an evidence artifact rather than only a handoff field — filed for E86.

## Addendum — why the handoff's `pending_notes` is empty

The bookkeeping write intended to restore the notes lost to the E86-class malformed call was
**rejected by the server**: `TRANSITION_REJECTED`, no `qa-engineer:PASS → qa-engineer:PASS` edge —
PASS is terminal, so the only outbound edges are `pm` / `researcher` / `release-engineer` /
`design-auditor` at `In_Progress`. Manufacturing one of those transitions purely to repopulate a
free-text field would move a genuinely-terminal feature off PASS and re-arm the scope/cut gates,
which is a worse record than an empty notes field. So the notes were **not** restored to the handoff
by design, and this file is the authoritative record instead.

Consequence for whoever picks this up next: the two items under *Surfaced to PM* above, and the
release-bookkeeping note below, are **not** in `handoff.pending_notes` — read them here. This is
precisely the E55 mechanism (findings reachable only if someone remembers to look) arriving by a
different route, and it is a second reason E86 deserves more than a P3 slot.

Release bookkeeping owed (release-engineer, not QA): semver bump, CHANGELOG, and the
`docs/backlog.md` E43 done-mark plus its order-7 row. The shipped origin tags read
`(v3.104.0, E43)` — the release must land as **v3.104.0** or those two tags need correcting.
