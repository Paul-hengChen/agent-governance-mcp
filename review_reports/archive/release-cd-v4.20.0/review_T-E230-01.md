# Review — T-E230-01 (batched with T-E151-01)

covers: T-E230-01, T-E151-01

## Round 1 — APPROVED — by code-reviewer

Diff: `75895df..3048464` on `feat/e230-pm-amend-and-resume-hint`. Contract: `specs/e230-pm-amend-and-resume-hint.md` (no architecture spec for this feature). Reviewer model: opus; sr-engineer was also pinned opus, so same-model bias is possible. The verdict rests on executed checks, not a reading of the code alone.

## Summary
- T-E230-01: `tools/handoff-write.ts` resolves `cut_approved` with a new same-tuple PM amendment clause. A `pm:In_Progress` write over an on-disk `pm:In_Progress` tuple of the same `active_feature` keeps the approval. An explicit `false` clears it. Any other PM In_Progress write re-arms the gate as before. The resolution comment and the e260a `cut_approved` field-lifetime bullet are updated to match.
- T-E151-01: `tools/transitions.ts` changes the step-4 `TRANSITION_REJECTED` envelope, only for `pm:In_Progress -> {code-reviewer, qa-engineer}:In_Progress`. It appends two conditional `allowed` entries carrying `requires.resume_of` and the S1 hint suffix. The element type gains an optional `requires`. The `error` union does not change.
- Scope is clean. `gates/**`, `tools/handoff-orchestrator.ts`, `tools/registry.ts`, `tools/handoff-types.ts`, `content/**`, `specs/qa-flow-enforcement-architecture.md` and `test/**` have no diff. The `dist/` diff covers only `dist/tools/handoff-write.*` and `dist/tools/transitions.*`, and a fresh `npm run build` reproduces it exactly (no working-tree change afterwards). `check:transitions-sync` passes (OK, 21 keys).
- Verdict: APPROVED. There are no required findings, one recommended finding and three optional findings.

## AC Completeness
Executed with a reviewer scratch harness against the freshly built `dist/` (writer-level `writeHandoffState`, handler-level `handleUpdateState`, file mode, temporary workspaces). These are not committed tests; qa-engineer owns the permanent pins (T-E230-02 / T-E151-02).

- AC1 — implemented — `tools/handoff-write.ts:481-491`. A pm:In_Progress → pm:In_Progress write that omits the field keeps `cut_approved: true`. Two amendments in a row also keep it.
- AC2 — implemented — handler-level. The sequence pm (`cut_approved: true`, `scope_decision`), then pm (`dispatch_pins` only), then sr-engineer In_Progress is accepted, with no `CUT_APPROVAL_REQUIRED`.
- AC3 — implemented — a qa-engineer:FAIL predecessor followed by a pm:In_Progress write leaves the field absent. Existing R5 is green.
- AC4 — implemented — `pm:Blocked`, `sr-engineer:In_Progress` and `code-reviewer:FAIL` predecessors each leave the field absent after a pm:In_Progress write. Precondition checked: the field really was `true` on disk at `pm:Blocked`, so this result does not come from an already-absent value.
- AC5 — implemented — pm:In_Progress A → pm:In_Progress B leaves the field absent. A → B → A also stays absent, so the old approval is not resurrected.
- AC6 — implemented — an explicit `false` on an amendment clears the field (writer-level). A later omitting amendment keeps it absent. Through `handleUpdateState` (`cut_approved: false`) the field is absent, `hasCutApproval` is false, and the next sr-engineer write is rejected `CUT_APPROVAL_REQUIRED`.
- AC7 — implemented — a non-PM omitting write carries the field, and a non-PM explicit `false` also carries it (unchanged, out of scope per Decision 2). Existing R1 and R3 are green.
- AC8 — implemented — the resolution comment at `tools/handoff-write.ts:309-317` lists clauses (1)-(6), including the amendment. The e260a bullet (`specs/e260a-tools-a-h-rationale.md:66`) matches the AC wording, and no other e260a line changed. The AC8 `git diff --stat` guard over `content/ specs/qa-flow-enforcement-architecture.md gates/ tools/handoff-orchestrator.ts tools/registry.ts` (plus `tools/handoff-types.ts`) prints nothing.
- AC9 — implemented — `tools/transitions.ts:495-526`. `allowed` holds the six static pm:In_Progress entries in table order (architect, sr-engineer, researcher, design-auditor, pm:Blocked, pm:In_Progress), each with only `new_agent` and `new_status`. These are followed by the code-reviewer entry and then the qa-engineer entry, each with `requires.resume_of`.
- AC10 — implemented — the hint equals S1 byte-for-byte for `<role>=code-reviewer`, `<received>=absent` (string equality against the spec text).
- AC11 — implemented — S1 matches byte-for-byte for qa-engineer with `received resume_of: "code-reviewer"`, and for code-reviewer with `"qa-engineer"`. Both return the same 8-entry `allowed`.
- AC12 — implemented — `pm:In_Progress -> qa-engineer:PASS`, `pm:In_Progress -> code-reviewer:FAIL`, `pm:Blocked -> code-reviewer:In_Progress` (with resume_of) and `sr-engineer:In_Progress -> qa-engineer:PASS` give no `requires` key and the plain `No edge ... See specs/qa-flow-enforcement-architecture.md.` hint. HOP_CAP_EXCEEDED and REVIEW_ROUND_EXCEEDED rejections on the same edge are not enriched either, because the enrichment sits only at step 4.
- AC13 — implemented — the handler-level code-reviewer In_Progress write without `resume_of` returns an error whose text starts `⛔ TRANSITION_REJECTED`, and its body carries `"requires"` and the S1 suffix.
- AC14 — implemented — both accept paths (`resume_of` matching the target) return null. Step 3.5 is untouched, and the static table and `gates/registry.ts` have no diff. `npm run build` with postbuild `check:transitions-sync` exits 0.
- AC15 — partial, by design — the final-HEAD full-suite gate belongs to qa after T-E230-02 / T-E151-02. At this commit the full suite has exactly the two declared expected reds (see Correctness). This is not a finding against T-E230-01 / T-E151-01.

## Correctness
No required findings.

- The amendment predicate (`tools/handoff-write.ts:486-490`) reads `existing`, the handoff parsed inside `withFileLock` after `verifyFreshness` (`archiveCheckNeedsExisting = true` forces the read on every write). It tests on-disk `last_agent === "pm"`, `status === "In_Progress"` and `active_feature === _activeFeature`, all three together. A QA-FAIL bounce, a `pm:Blocked` predecessor, any non-PM predecessor and a feature change all fall through to `effectiveCutApproved = undefined`. The carried value comes from the clause (3)/(5)/(6) same-feature read above, so an amendment can only carry a `true` that is already on disk for the same feature. It cannot create an approval.
- `cutApproved !== false` inside the predicate makes an explicit `false` clear on an amendment (Decision 2). An explicit `true` still wins first (clause 1).
- Dropping `!isPmReentry` from `cutApprovalNeedsExisting` is needed: the carry value must now be read for PM writes. It adds no I/O, because the read already happens unconditionally.
- Step-4 enrichment repeats the step-3.5 prefix (`prev pm:In_Progress`, `next In_Progress`, agent in {code-reviewer, qa-engineer}). At step 4 that prefix is exactly the case where `next_resume_of !== next.agent`. `received` uses `JSON.stringify`, so a direct caller passing an odd string is quoted and escaped, not injected raw.
- Expected-red sampling (SOP 4a): `qa_reports/expected-red_e230-pm-amend-and-resume-hint.txt` has two entries, and both were checked. `test/cut-approval-gate.test.mjs` contains the test `R2: PM re-entry WITHOUT cut_approved re-arms gate (PM re-entry clause)`, and `test/qa-flow.test.mjs` contains `C1-07/AC-3: pm:In_Progress -> code-reviewer:In_Progress REJECTED with next_resume_of absent`. Both are real and locatable, and both are the only failures in the affected suites. Command: `node --test` over cut-approval-gate, e114-cut-approval-inheritance, dispatch-pins, qa-flow, error-code-contract, hop-count-transitions, e38-next-role-lookahead, e116-archive-on-feature-change, repro-first-gate, e128-orchestrator-blocked-repair, reviewer-completed-tasks-gate and e35-pipeline-order. Result: 356/358 pass, and the 2 failures are exactly the manifest entries. R2 turning red also works as the natural negative control for the new clause: the old pm→pm-clears behaviour is gone.
- Full suite at this commit (`node --test test/*.test.mjs`): 4061 tests: 4057 pass, 2 skip, 2 fail. The 2 failures are exactly the two manifest entries, and no other test in any suite is red.
- optional — `tools/handoff-parse.ts` (migration heal-write): the heal-write re-sends `lastAgent`/`status` from the parsed state. For a `pm:In_Progress` handoff it is now an amendment, so a schema-heal write keeps `cut_approved` instead of silently clearing it. This matches the heal's stated intent ("feature-scoped fields carry forward") and is an improvement, not a regression. It is noted so qa knows about it.

## Quality
- recommended — `tools/handoff-write.ts:309-317`. `agc check — comments` reports `long-block 9 lines (limit 7)`. The base block was 5 lines, so this diff introduced the warning. Kept, because AC8 requires the clause list in code, and the block is still WHAT plus a `Why:` pointer. It could be trimmed to within the limit by dropping the first two narrative sentences ("re-armed on every PM In_Progress re-entry ... keeps it"), since the e260a bullet already holds that rationale. Not blocking.
- The `high-ratio` comment warnings on both files existed before this diff. `tools/transitions.ts` went from 32.5% to 31.7% and `tools/handoff-write.ts` stayed at 42.4%, so this diff does not regress either.
- The rename `isPmReentry` → `isPmInProgressWrite` names what the flag now tests, and the clause-number references in the two inline comments (`(3)/(5)/(6)`, `(1)/(2)/(4)`) match the resolution list. The step-4 comment and the `allowed` type comment are short and state WHY.
- optional — `specs/e260a-tools-a-h-rationale.md:66`. "Every route back to PM (a new feature, a QA FAIL bounce, scope rework) re-enters from some other tuple" is slightly too broad. A scope rework done while staying in `pm:In_Progress` is now an amendment and keeps the approval unless the PM passes `cut_approved: false`. The same bullet already states that an explicit `false` always clears, so the contract is recorded. Rewording "scope rework" as "scope rework (or an explicit `false` on an amendment)" would remove the ambiguity.
- optional — `tools/transitions.ts:504-509`. The enrichment condition repeats the step-3.5 predicate prefix verbatim. A small local helper (`isAmendResumeTarget(req)`) would keep the two sites from drifting apart. The duplication is cosmetic.

## Architecture
No architecture spec exists for this feature. The changes stay inside the two lane-owned files, as Decisions 1, 4 and 5 require. The writer keeps resolution in one place. The rejection enrichment is pure and storage-agnostic, sits after the static table lookup, and leaves earlier steps byte-identical. The static `ALLOWED_TRANSITIONS`, `gates/registry.ts` `hintStatic`, the orchestrator and the error-code union do not change.

## Security
No findings. No new input crosses a trust boundary. `next_resume_of` is zod-enum-validated at the tool boundary and also goes through `JSON.stringify` in the hint. The approval can only be kept, never created (the predicate needs an on-disk `true` from the same feature and the same pm:In_Progress tuple). There are no secrets, absolute local paths or codenames in any changed tracked file (information hygiene, Constitution §6).

## Performance
No findings. The writer adds one constant-time predicate on an object already read. The rejection path adds two array entries and one string concatenation, only on the rejection branch. Neither is in a hot loop.

## Verdict
APPROVED — every in-scope AC (AC1–AC14) is met, as shown by executed writer-level, handler-level and pure-function checks. The two reds are exactly the declared manifest entries, the dist output is reproducible, and no required finding remains.
