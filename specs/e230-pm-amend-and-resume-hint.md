# e230-pm-amend-and-resume-hint

Lane e230 of fan-out wave A. Tickets: **E230** (same-tuple PM amendment keeps `cut_approved`) and **E151** (the missing-`resume_of` rejection names the field). Source: `docs/backlog.md` rows E230 and E151, `specs/fanout-backlog-wave-a.md` (e230 Lanes row, ownership re-split, Decisions ruling 3 = a; binding, not re-asked). Chain: sr-engineer → code-reviewer → qa-engineer, no architect.

## Problem Statement

Two write-path frictions, both correct checks with unhelpful failure paths. **E230**: every `pm:In_Progress` write that omits `cut_approved` clears it, including a write whose on-disk predecessor is already `pm:In_Progress` on the same `active_feature`. That shape is not a re-entry; it is an amendment of the current tuple (the coordinator persisting `dispatch_pins`, a PM note, a spec touch-up). The approval is dropped with no warning, and the next build-entry hop is rejected `CUT_APPROVAL_REQUIRED`, so the human is asked to re-approve an already-approved cut. **E151**: a `pm:In_Progress → code-reviewer:In_Progress` or `→ qa-engineer:In_Progress` write without a matching `resume_of` is rejected `TRANSITION_REJECTED` with an `allowed` list taken from the static table (which never lists those two edges) and the shared static hint, so nothing tells the writer that the edge exists and that `resume_of` must be set on the resuming write itself.

## User Stories

- As a coordinator persisting `dispatch_pins` on the current `pm:In_Progress` tuple after the human approved the cut, I want the approval to survive that write, so that the human is not asked to approve the same cut twice.
- As a PM bounced back by a QA FAIL (or re-entering from any other role, or switching feature), I want the gate re-armed exactly as today, so that a stale approval never lets a reworked cut into build.
- As a code-reviewer or qa-engineer resuming after a PM mid-chain amendment, I want the rejection to tell me that the resume edge exists and that `resume_of` on my own write opens it, so that I fix the write in one retry.

## Acceptance Criteria

Writer-level ACs call `writeHandoffState` from `dist/tools/handoff.js`; handler-level ACs call `handleUpdateState` from `dist/tools/handoff-orchestrator.js` in file mode. "Amendment" below means: this write is `agent=pm, status=In_Progress`, and the on-disk handoff read inside the write lock has `last_agent: pm`, `status: In_Progress` and the same `active_feature`.

### E230 — `cut_approved` on a same-tuple PM amendment

- **AC1** — Given an on-disk handoff `pm:In_Progress` on feature F with `cut_approved: true`, when a `pm:In_Progress` write on F omits `cut_approved`, then the written handoff still has `cut_approved: true`.
  proof: `node --test test/e230-*.test.mjs` (qa names the case; writer-level).
- **AC2** — Given the E230 incident sequence on one workspace (pm write with `cut_approved: true`, then a second pm write on the same feature carrying only `dispatch_pins`), when sr-engineer then writes `In_Progress` through `handleUpdateState`, then the write is NOT rejected `CUT_APPROVAL_REQUIRED` (scope_decision set; external refs none).
  proof: `node --test test/e230-*.test.mjs` (handler-level case).
- **AC3** — Given an on-disk handoff `qa-engineer:FAIL` on feature F with `cut_approved: true`, when a `pm:In_Progress` write on F omits `cut_approved`, then the field is absent afterwards (QA-FAIL bounce still re-arms).
  proof: existing `R5` in `test/cut-approval-gate.test.mjs` stays green unchanged.
- **AC4** — Given an on-disk handoff with `cut_approved: true` on feature F whose tuple is anything other than `pm:In_Progress` — at minimum `pm:Blocked`, `sr-engineer:In_Progress`, `code-reviewer:FAIL` — when a `pm:In_Progress` write on F omits `cut_approved`, then the field is absent afterwards.
  proof: `node --test test/e230-*.test.mjs` (one case per predecessor; `pm:Blocked` is the same-agent boundary).
- **AC5** — Given an on-disk handoff `pm:In_Progress` on feature A with `cut_approved: true`, when a `pm:In_Progress` write names feature B and omits `cut_approved`, then the field is absent afterwards (feature change re-arms even from a pm:In_Progress predecessor).
  proof: `node --test test/e230-*.test.mjs`.
- **AC6** — Given an on-disk handoff `pm:In_Progress` on F with `cut_approved: true`, when a `pm:In_Progress` write on F passes `cut_approved: false`, then the field is absent afterwards and `hasCutApproval` is false (explicit false re-arms on an amendment — same behaviour every PM In_Progress write has today).
  proof: `node --test test/e230-*.test.mjs` (writer-level and one handler-level case through the zod boundary).
- **AC7** — Given an on-disk handoff with `cut_approved: true` on F, when any non-PM role writes on F omitting the field, then it is carried (unchanged behaviour), and an explicit `cut_approved: true` on any PM write still sets it.
  proof: existing `R1`, `R3` in `test/cut-approval-gate.test.mjs` stay green unchanged.
- **AC8** — Given the change, when `tools/handoff-write.ts` and `specs/e260a-tools-a-h-rationale.md` are read, then the in-code resolution comment lists the amendment clause, and the e260a "field lifetimes" bullet for `cut_approved` says it is cleared on a PM In_Progress write unless that write amends a `pm:In_Progress` tuple of the same feature, and that an explicit `false` always clears; no other e260a section changes, and `content/**` is untouched.
  proof: `git diff --stat <base>..HEAD -- content/ specs/qa-flow-enforcement-architecture.md gates/ tools/handoff-orchestrator.ts tools/registry.ts` prints nothing (reviewer reads the two prose sites).

### E151 — rejection envelope for the resume edge

- **AC9** — Given `validateTransition` with prev `pm:In_Progress`, next `code-reviewer:In_Progress` and `next_resume_of` absent, when it rejects, then `error` is `TRANSITION_REJECTED`; `allowed` equals the six static `pm:In_Progress` entries in table order, each with exactly the keys `new_agent`, `new_status`, followed by exactly two conditional entries in this order: `{ "new_agent": "code-reviewer", "new_status": "In_Progress", "requires": { "resume_of": "code-reviewer" } }`, `{ "new_agent": "qa-engineer", "new_status": "In_Progress", "requires": { "resume_of": "qa-engineer" } }`.
  proof: `node --test test/e151-*.test.mjs` (`assert.deepEqual` on `r.allowed`).
- **AC10** — Given the AC9 rejection, then `hint` equals S1 below byte-for-byte with `<role>` = `code-reviewer` and `<received>` = `absent`.
  proof: `node --test test/e151-*.test.mjs`.
- **AC11** — Given the same with next `qa-engineer:In_Progress` and `next_resume_of: "code-reviewer"` (wrong role), then `allowed` is the AC9 list (same two conditional entries, same order) and `hint` is S1 with `<role>` = `qa-engineer`, `<received>` = `"code-reviewer"`; likewise next `code-reviewer:In_Progress` with `next_resume_of: "qa-engineer"` gives `<received>` = `"qa-engineer"`.
  proof: `node --test test/e151-*.test.mjs`.
- **AC12** — Given any other rejected transition — at minimum pm:In_Progress → qa-engineer:PASS, pm:In_Progress → code-reviewer:FAIL, pm:Blocked → code-reviewer:In_Progress with `next_resume_of: "code-reviewer"`, sr-engineer:In_Progress → qa-engineer:PASS — then no `allowed` entry has a `requires` key and `hint` is exactly `No edge <prev> → <next>` + the registry `hintStatic` (byte-identical to today).
  proof: `node --test test/e151-*.test.mjs`.
- **AC13** — Given `handleUpdateState` in file mode on a workspace whose handoff is `pm:In_Progress`, when a `code-reviewer` `In_Progress` write omits `resume_of`, then the result is an error whose text starts `⛔ TRANSITION_REJECTED` and whose JSON body carries the two conditional entries and S1.
  proof: `node --test test/e151-*.test.mjs` (handler-level case).
- **AC14** — Given the change, then both accept paths (resume_of matching target) are still accepted, `ALLOWED_TRANSITIONS` is unchanged, `gates/registry.ts` is unchanged, and `npm run check:transitions-sync` exits 0.
  proof: `npm run build` (postbuild runs `check:transitions-sync`; exit 0) and the C1-07/AC-2 tests in `test/qa-flow.test.mjs` stay green.

### Both

- **AC15** — Given the final HEAD, when the full suite runs, then it passes with zero unexplained reds.
  proof: `node scripts/test-lock.mjs -- npm test` exits 0.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| S1 | `No edge pm:In_Progress → <role>:In_Progress in ALLOWED_TRANSITIONS. See specs/qa-flow-enforcement-architecture.md. Amend-Resume edge: set resume_of: "<role>" on this write itself (the resuming write, not only the PM amendment) to open pm:In_Progress → <role>:In_Progress; received resume_of: <received>.` | authored-here — the first two sentences are today's text (`No edge <prev> → <next>` + `gates/registry.ts` TRANSITION_REJECTED `hintStatic`, unchanged); the suffix answers backlog E151 ("set on the resuming write itself"). `<role>` = the rejected target agent; `<received>` = `absent` when `next_resume_of` is undefined, else `JSON.stringify(next_resume_of)` |
| S2 | `requires` (key) / `resume_of` (key) | authored-here — names the gating field verbatim as the tool argument is named, so the envelope reads as "this edge requires resume_of = X" |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Decisions (PM, this cut)

1. **Amendment predicate** (ruling 3 = a, binding): a write is an amendment iff it is `agent=pm, status=In_Progress` AND the on-disk handoff read inside the write lock has `last_agent === "pm"`, `status === "In_Progress"`, `active_feature` equal to this write's. The writer already reads the existing handoff on every write (`archiveCheckNeedsExisting = true`), so no new I/O. Resolution order becomes: (1) explicit `true` → true; (2) PM In_Progress write with explicit `false` → unset; (3) PM In_Progress amendment → carry the on-disk value; (4) any other PM In_Progress write → unset; (5) same feature on disk → carry; (6) otherwise → unset.
2. **Explicit `cut_approved: false` on an amendment re-arms.** The write path can express it (zod `z.boolean().optional()` → orchestrator passes `parsed.cut_approved` → writer `opts.cutApproved`). Today every PM In_Progress write clears on `false`, so this keeps today's behaviour and gives a same-tuple revoke when an amendment changes the cut materially. Non-PM writes with `false` are unchanged (carry) — out of scope.
3. **Constitution §3.1 "Feature-scoped re-arm" needs no change.** Its wording is "a fresh PM `In_Progress` entry, a QA-FAIL bounce back to PM, or any `active_feature` change re-arms the gate". A same-tuple amendment is not a fresh entry; the three named triggers all still re-arm. `content/coord-02` and every other `content/**` file stay untouched; no golden or `test/context-budget.test.mjs` cap moves.
4. **Prose sites that change**: the resolution comment above `isPmReentry` in `tools/handoff-write.ts` (rename the flag; list clause (3)) and the `cut_approved` bullet in `specs/e260a-tools-a-h-rationale.md` "tools/handoff-write.ts — field lifetimes" (currently "cleared on every PM In_Progress write", which becomes false). **Prose sites that stay** (their wording already reads "re-entry", which an amendment is not): the `tw_update_state` `cut_approved` description in `tools/registry.ts` ("re-armed on every PM In_Progress re-entry"), the `cut_approved` comment in `tools/handoff-types.ts`, and test-file comments in `test/dispatch-pins.test.mjs` W5 and `test/cut-approval-gate.test.mjs` XR1. `tools/registry.ts` and `tools/handoff-types.ts` are outside this lane's ownership, so they are not touched either way.
5. **E151 envelope shape**: conditional entries are appended (never interleaved) after the unchanged static list, both always present on the enriched rejection, ordered code-reviewer then qa-engineer, each carrying `requires: { resume_of: "<same role>" }`. The `TransitionRejection.allowed` element type gains an optional `requires?: { resume_of: "code-reviewer" | "qa-engineer" }`; the `error` union is untouched (the DR-8 pin in `test/error-code-contract.test.mjs` anchors on it). Enrichment fires only at step 4 (table lookup), only for prev `pm:In_Progress` → next `{code-reviewer, qa-engineer}:In_Progress`; earlier steps (agent-id, round-cap, hop-cap) and every other rejection are byte-identical. Fix is entirely in `tools/transitions.ts` — `gates/registry.ts` `hintStatic`, the static table, the orchestrator and `specs/qa-flow-enforcement-architecture.md` are not touched, so no STOP is needed.
6. **Expected-red manifest**: sr-engineer's change turns two existing assertions red (Site Map rows 9, 11). sr-engineer writes `qa_reports/expected-red_e230-pm-amend-and-resume-hint.txt` naming both before handing to code-reviewer; qa-engineer rewrites them.

## Out of Scope

- Changing the Amend-Resume mechanism itself, adding transition edges, or editing the static `ALLOWED_TRANSITIONS` table.
- `gates/**` (incl. the shared `hintStatic`), `tools/handoff-orchestrator.ts`, `tools/registry.ts`, `tools/handoff-types.ts`, `specs/qa-flow-enforcement-architecture.md`, `content/**`, `test/fixtures/compose-golden/**`, `test/context-budget.test.mjs`.
- Explicit `cut_approved: false` semantics on non-PM writes.
- A write-response echo that the approval was re-armed (that was option b of ruling 3, not chosen).
- SQLite/HTTP mode: `cut_approved` is file-mode only; nothing changes there.
- Release bookkeeping (version, CHANGELOG, backlog done-marks): integrator / release-engineer after the wave.

## Dependencies / Prerequisites

- Ruling 3 = a and the ownership re-split in `specs/fanout-backlog-wave-a.md` (Decisions, 2026-11-09) are the binding source; no open question.
- Planning dry-run (PM, scratch copy, prototype of Decisions 1, 2, 5, not committed): full suite turned exactly the two Site Map red rows red beyond the environment-only failures that also fail on an unpatched copy; see the cut's Site Map.
- Visual Structural Assertions omitted: no `design/<feature>.md`, mode = no-design.
- External references: none (resource audit grep over the two backlog rows and the manifest row found no URL, Figma, or ticket-system link).

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E230-01 | sr-engineer: E230 amendment clause in `cut_approved` resolution (Decisions 1, 2) + resolution comment + e260a field-lifetime bullet; rebuild dist; write expected-red manifest | none | 4 | `tools/handoff-write.ts`、`dist/tools/handoff-write.*`、`specs/e260a-tools-a-h-rationale.md` | — |
| T-E151-01 | sr-engineer: E151 conditional `allowed` entries + S1 hint suffix + `requires?` element type at validateTransition step 4 (Decision 5); rebuild dist | none | 3 | `tools/transitions.ts`、`dist/tools/transitions.*` | — |
| T-E230-02 | qa-engineer: rewrite red R2 in cut-approval-gate as the amendment-carry pin; new e230 test file for AC1, AC2, AC4, AC5, AC6 | T-E230-01 | 2 | `test/cut-approval-gate.test.mjs`、`test/e230-*.test.mjs` | — |
| T-E151-02 | qa-engineer: rewrite red C1-07/AC-3 allowed assertion in qa-flow; new e151 test file for AC9–AC13 | T-E151-01 | 2 | `test/qa-flow.test.mjs`、`test/e151-*.test.mjs` | — |

## Site Map

Every source and test site, line numbers as of base `2425e04` (re-verify before editing).

| # | file | site | change | AC | task |
|---|---|---|---|---|---|
| 1 | `tools/handoff-write.ts` | 309-313 resolution comment | list clauses per Decision 1; keep the `Why:` pointer | AC8 | T-E230-01 |
| 2 | `tools/handoff-write.ts` | 315-316 `isPmReentry`, `cutApprovalNeedsExisting` | rename to a PM-In_Progress-write flag; needs-existing no longer excludes PM writes | AC1, AC5 | T-E230-01 |
| 3 | `tools/handoff-write.ts` | 371-374 same-feature carry | unchanged logic; carry value now also used for an amendment | AC1, AC7 | T-E230-01 |
| 4 | `tools/handoff-write.ts` | 477-484 clauses (1)/(2) | add amendment predicate on `existing` (`last_agent`, `status`, `active_feature`); explicit `false` clears; non-amendment PM write clears | AC1, AC3, AC4, AC5, AC6 | T-E230-01 |
| 5 | `dist/tools/handoff-write.*` | build output | `npm run build` | AC1–AC7 | T-E230-01 |
| 6 | `specs/e260a-tools-a-h-rationale.md` | line 66 `cut_approved` bullet only | reword per AC8 | AC8 | T-E230-01 |
| 7 | `tools/transitions.ts` | 135 `TransitionRejection.allowed` element type | add optional `requires` | AC9 | T-E151-01 |
| 8 | `tools/transitions.ts` | 484-492 step 4 rejection | enrich `allowed` + append S1 suffix for the pm → code-reviewer/qa-engineer In_Progress case only | AC9–AC13 | T-E151-01 |
| 9 | `test/cut-approval-gate.test.mjs` | 186-209 `R2` — **turns red** (asserts a pm:In_Progress → pm:In_Progress write without `cutApproved` clears it) | rewrite as the amendment-carry pin (AC1) and move the clear case to a non-pm:In_Progress predecessor or explicit false | AC1, AC6 | T-E230-02 |
| 10 | `test/cut-approval-gate.test.mjs` | 259-297 `R5`, 177 `R1`, 211 `R3`, 236 `R4` | none — stay green | AC3, AC7 | T-E230-02 |
| 11 | `test/qa-flow.test.mjs` | 1190-1195 inside `C1-07/AC-3 … next_resume_of absent` — **turns red** (asserts `allowed` has no code-reviewer/qa-engineer entry) | rewrite: no UNCONDITIONAL code-reviewer/qa-engineer entry (no entry without `requires`), and the two conditional entries present | AC9 | T-E151-02 |
| 12 | `test/qa-flow.test.mjs` | 482-495 envelope shape, 1136-1175 accept cases, 1198-1290 other C1-07 rejects | none — stay green | AC12, AC14 | T-E151-02 |
| 13 | `test/e114-cut-approval-inheritance.test.mjs` | AC5-3 (337-365) and all cut_approved_source pins | none — no cut_approved re-arm assertion; stays green | — | — |
| 14 | `test/dispatch-pins.test.mjs` | W5 (580-614) | none — asserts only `dispatch_pins`; comment wording still holds | — | — |
| 15 | `test/e230-*.test.mjs` | new (qa names) | AC1, AC2, AC4, AC5, AC6 | AC1, AC2, AC4, AC5, AC6 | T-E230-02 |
| 16 | `test/e151-*.test.mjs` | new (qa names) | AC9–AC13 | AC9–AC13 | T-E151-02 |

Pins checked and not affected (grep incl. regex forms, then confirmed by the dry-run): `test/hop-count-transitions.test.mjs` (deepEqual on the HOP_CAP_EXCEEDED `allowed`, step 2.5, not enriched; every pm write there carries `cut_approved: true`), `test/error-code-contract.test.mjs` (DR-8 `error` union regex; hintStatic parity), `test/e38-next-role-lookahead.test.mjs` (uses accept/reject only), `test/e116-archive-on-feature-change.test.mjs` (feature-change drop), `test/repro-first-gate.test.mjs` D5 (dispatch_mode only), `test/e128-orchestrator-blocked-repair.test.mjs`, `test/reviewer-completed-tasks-gate.test.mjs`. None is in this lane's ownership and none needs a change.
