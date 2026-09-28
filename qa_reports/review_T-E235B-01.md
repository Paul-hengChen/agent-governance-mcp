# Review — T-E235B-01 (architect deliverable, single-task qa judge pass)

covers: T-E235B-01

## <2026-09-28T07:46:00Z> — PASS — by qa-engineer

Reviewer model: sonnet, dispatched via Task. Amend-Resume relay dispatch
(coordinator wrote PASS→pm evidence-only amendment, then
`qa-engineer:In_Progress` with `resume_of=qa-engineer`) — single-role qa judge
pass scoped to T-E235B-01 only: verify `specs/e235b-relative-manifest-worktree-architecture.md`
exists and is consistent with the already-PASS'd AC1-3 implementation
(`tools/fanout-manifest.ts`), the regression tests
(`test/e235b-relative-worktree.test.mjs`), and the prior evidence
(`qa_reports/review_T-E235B-06.md`). T-E235B-02..16 are already complete and
out of scope for this round; no re-review of that diff is performed here.

## Expected-Red Diff

`qa_reports/expected-red_e235b-relative-manifest-worktree.txt` exists
(2 entries, feature-scoped, not task-scoped). Both entries were already fully
dispositioned to green in the prior round's evidence
(`qa_reports/review_T-E235B-06.md` Phase 0.5: "clean, 2/2 manifest entries
confirmed red pre-edit, both now confirmed green post-edit, 0 unexplained
reds"). This round makes no code change (T-E235B-01 is a documentation/spec
deliverable, not an implementation task), so the disposition is unchanged and
is not re-litigated. Reconfirmed live in this session (see Phase 4) that both
named tests are still green: `test/e177a-check-cli.test.mjs` "AC15 CLI
contract" and `test/e177a-manifest.test.mjs` "AC2 validate wave7 exit 0"
pass as part of the 10/10 and 5/5 file totals below.

**Phase 0.5: clean (previously dispositioned in qa_reports/review_T-E235B-06.md; reconfirmed green this round, 0 unexplained reds).**

## Phase 1 — Review

Confirmed `specs/e235b-relative-manifest-worktree-architecture.md` exists at
the path the dispatch names, and cross-checked it against the shipped
implementation and evidence:

- **OQ1 (mechanism)** — architecture states the `worktree` cell is relative to
  the primary checkout, resolved by `render`, with an absolute cell passed
  through byte-verbatim via `path.isAbsolute`. `tools/fanout-manifest.ts:744-773`
  (`isAbsoluteWorktree`, `resolveWorktree`) implements exactly this rule order
  (empty → tilde → absolute-verbatim → relative-resolve-against-primary), and
  `renderPrompt` (lines 837-845) calls it against the already-resolved
  `primary`, never `manifestDir` or `process.cwd()`, matching Interface
  Contracts §1 and the Decision Records table row "Base for relative
  resolution".
- **OQ2 (CLI input)** — architecture states no new flag; resolution reuses the
  existing `--primary` / `resolvePrimary(manifestDir)` value. Confirmed:
  `runRender` (lines 1170-1192) adds no new flag to its `parseArgs` list, and
  `opts.manifestDir` is passed through unchanged.
- **OQ3 (check / lane-status)** — architecture states no behavior change to
  `checkLane` or `tools/lane-status.ts`, pinned by regression cases R7 and R9.
  Confirmed both cases exist in `test/e235b-relative-worktree.test.mjs`
  ("R7 check unaffected (AC3)", "R9 lane-status unaffected (AC3)") and pass
  (see Phase 4).
- **`validate` warning** — architecture's `WORKTREE_ABSOLUTE_WARN` constant
  (non-fatal, exit 0, value never echoed) matches
  `tools/fanout-manifest.ts:123-129` verbatim, and `runValidate` (lines
  1149-1168) appends it per absolute dispatchable row after the unchanged
  first line, matching Interface Contracts §3.
- **Module header amendment** — the architecture requires the e177a "Render
  field sources" `<worktree>` row be amended by citation rather than editing
  the closed e177a spec. `tools/fanout-manifest.ts:19-29`'s header comment
  states the one exception to byte-verbatim rendering and cites
  `specs/e235b-relative-manifest-worktree-architecture.md` by path — matches.
- **`docs/lane-protocol.md`** — architecture's Interface Contracts §4 bullet
  (worktree in dispatch prompts is always absolute; tracked files use the
  relative or class-description form) is present at
  `docs/lane-protocol.md:19`, wording lightly localized but meaning
  unchanged, as the blueprint explicitly permits ("sr may polish the
  Chinese; the meaning is fixed").
- **Regression cases R1-R11** — `test/e235b-relative-worktree.test.mjs`
  implements all 11 cases named in the architecture's "Regression cases"
  section, confirmed by name match against the file's own index comment
  (lines 16-26) and each corresponding `test(...)` call.
- **No `schema_version` bump / no `content/**` touch** — architecture states
  neither applies to this ticket. `qa_reports/review_T-E235B-06.md` already
  confirmed `git diff --stat main...HEAD -- content/` is empty (AC5 vacuous,
  T-E235B-08 N/A) and no `schema/` or handoff-field change exists in the
  shipped diff; nothing in this round's read of the architecture or the
  implementation contradicts either claim.

No inconsistency found between the architecture blueprint and the shipped
AC1-3 implementation, the regression tests, or the prior QA evidence.

**Copy Audit Gate / Visual Audit Gate: N/A.** `specs/e235b-relative-manifest-worktree.md`
has no `## Copy / Strings` or `## Visual Tokens` H2 (tooling/CLI-format
ticket, consistent with `qa_reports/review_T-E235B-06.md`'s prior finding).

## Phase 1.5 — Visual Compare

**Phase 1.5: skipped (no `design/e235b-*.md` file, no Visual Baselines declared).** Non-UI feature, unchanged from the prior round.

## Phase 3 — Tests

T-E235B-01 is the architect's documentation deliverable, not a code task —
its acceptance criteria (OQ1-3 resolved, in a form qa can pin) are satisfied
by the regression tests `test/e235b-relative-worktree.test.mjs` R1-R11
already written and PASS'd in the T-E235B-06 batch, which this round
reconfirms rather than duplicates. No new test file or test case is required
for this task. Test-file placement guidance from the dispatch ("none
expected — evidence-only verification") is followed: no new
`test/e235b-*.test.mjs` file was created.

### Spec-to-Test map (T-E235B-01's own scope)

| Open Question | Resolved by | Pinned by |
|---|---|---|
| OQ1 mechanism | Architecture §"OQ1 (mechanism)" | R1, R2, R3, R4, R5, R8 |
| OQ2 CLI input | Architecture §"OQ2 (CLI input)" | R6 |
| OQ3 check/lane-status no-op | Architecture §"OQ3 (check / lane-status)" | R7, R9 |

## Phase 3.5 — AC Execution Log

**Phase 3.5: skipped (no `proof:`-annotated ACs in `specs/e235b-relative-manifest-worktree.md`).**

## Phase 4 — Run

- Build: `npm run build` — clean (tsc, `check:version`, `check:transitions-sync` all OK). Run live in this session.
- Targeted tests, run live in this session: `test/e235b-relative-worktree.test.mjs` 11/11 pass; `test/e177a-manifest.test.mjs` 10/10 pass; `test/e177a-check-cli.test.mjs` 5/5 pass (26/26 combined).
- Full suite: **2899/2902 pass, 0 fail, 3 skip** — run live in this session (matches the count already on record in `qa_reports/review_T-E235B-06.md`; not re-run a second time this round per coordinator instruction, since no code has changed since that run and this task adds no implementation diff).
- CI runnability: `npm test` runs headlessly, zero human interaction, deterministic exit code (unchanged from prior round).
- Working tree: clean immediately before this round's `tw_update_state` claim, aside from the server's own telemetry sidecar append recording an earlier, server-rejected transition attempt (`.current/e235b/telemetry.jsonl`) — committed alongside this evidence per lane protocol.

## Verdict

**PASS.** `specs/e235b-relative-manifest-worktree-architecture.md` exists and
resolves OQ1-3 exactly as the shipped `tools/fanout-manifest.ts` implements
them, as `test/e235b-relative-worktree.test.mjs`'s R1-R11 regression cases
pin them, and as `qa_reports/review_T-E235B-06.md`'s prior evidence recorded.
No drift between blueprint and shipment. T-E235B-01 is the last open ledger
row for this feature; all AC1-13 coverage is now complete across the T-01
architecture deliverable and the T-02..16 implementation/test rounds.
## 2026-09-28T07:45:53.774Z — PASS — by qa-engineer

T-E235B-01 PASS: specs/e235b-relative-manifest-worktree-architecture.md exists and is consistent with the shipped AC1-3 implementation (tools/fanout-manifest.ts), the regression tests (test/e235b-relative-worktree.test.mjs R1-R11), and prior evidence (qa_reports/review_T-E235B-06.md). Full detail: qa_reports/review_T-E235B-01.md.

## 2026-09-28T07:46:07.276Z — PASS — by qa-engineer

T-E235B-01 PASS: specs/e235b-relative-manifest-worktree-architecture.md exists and is consistent with the shipped AC1-3 implementation (tools/fanout-manifest.ts), the regression tests (test/e235b-relative-worktree.test.mjs R1-R11), and prior evidence (qa_reports/review_T-E235B-06.md). Full detail: qa_reports/review_T-E235B-01.md.

