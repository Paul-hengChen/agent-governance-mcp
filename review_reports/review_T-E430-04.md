# Review — T-E430-04 (batched round, feature e430-mailbox-and-verify-rule, revision 2)

covers: T-E430-04, T-E430-05

## Round 1 — APPROVED — by code-reviewer

Revision 1 PASS at `9516b1a`; revision 2 head `a8dacb4` (dispatch base `f08ea57`). Inputs read: `git diff 9516b1a..HEAD` (content, docs, test, qa_reports, specs, ledger), `specs/e430-mailbox-and-verify-rule.md` (AC8, the `C-IN5` Copy row, *Revision 2*, human ruling Q4 (a)), `qa_reports/expected-red_e430-mailbox-and-verify-rule.txt`, `qa_reports/tests_e430-mailbox-and-verify-rule.md`, my revision 1 report `review_reports/review_T-E430-01.md`, and the tool code `C-IN5` makes a claim about (`tools/fanout-handoff.ts`). No ticket file: the spec's ACs stand in as the scenarios. The coordinator's state read surfaced sr-engineer's handoff notes; nothing below relies on them — every claim is re-executed here.

## Summary
- T-E430-05: one sentence, `C-IN5`, inserted into the Stage 4 `**Two-hour idle stop**` sub-bullet of `content/skill-integrator.md` (line 114), directly after `Then tell the human the watch stopped and why. ` and directly before the byte-unchanged `Resuming — …` sentence. `git diff 9516b1a..HEAD -- content docs`: 1 insertion / 1 deletion on that one line, nothing else; file stays 260 lines.
- Byte proof: the file at HEAD equals the `9516b1a` file with the spec row's `C-IN5` text (extracted mechanically from the Copy row) plus one space inserted at the single anchor — whole-file equality `true`, `C-IN5` count 1.
- T-E430-04: the AC8 test is red at `9516b1a`'s content for the right reason (`idle-stop sub-bullet contains C-IN5 exactly once`, 0 !== 1), green at HEAD, and fails each of five mutations with the matching assertion. sr's commit `a8dacb4` touches no test.
- Closes my revision 1 recommended note 2: a same-session resume now re-arms the mailboxes of sessions outside a lane, which the handoff's `watch baseline` never names (verified in `tools/fanout-handoff.ts`).
- Full suite on a clean tree: 4766 pass / 0 fail / 2 skipped of 4768, exit 0. Verdict: **APPROVED**; no required findings.

## AC Completeness
AC1 — implemented — unchanged since revision 1 PASS (`9516b1a`); test green in the revision 2 suite.
AC2 — implemented — unchanged since revision 1 PASS; `git diff 9516b1a..HEAD -- docs` empty; test green.
AC3 — implemented — unchanged since revision 1 PASS; Take-over step 5 (`content/skill-integrator.md:249`) byte-unchanged; test green.
AC4 — implemented — unchanged since revision 1 PASS; test green (scans the revision 1 added lines; `C-IN5`'s own hygiene is AC8's).
AC5 — implemented — unchanged since revision 1 PASS; test green.
AC6 — implemented — unchanged since revision 1 PASS; test green.
AC7 — implemented — no golden, cap or line-number pin moved (no content line added); `compose-equivalence`, `context-budget`, `e449` 71/71; `e410` green in the AC8 proof set.
AC8 — implemented — `content/skill-integrator.md:114` (`C-IN5` once, at the anchor, `Resuming — …` byte-unchanged and last; file 260 lines; served text clean).

## Correctness
No findings.
- Placement and byte-equality: see Summary. The `Resuming — …` sentence is still the sub-bullet's ending, so `test/e285-integrator-session-handoff.test.mjs` AC-E344-1 (verbatim + `endsWith`) stays green (ok 1683 in the suite).
- Tool claim "the handoff has no `watch baseline` for it": true. `tools/fanout-handoff.ts:376-395` builds the `watch` list only from `m.dispatchable` (the manifest's lanes); a session outside a lane never enters `formatWatchCommand`.
- Coherence with `C-IN3` (a)/(b) (`:249`): same scope ("every session outside a lane that a Decisions row names and whose mailbox still exists") and same arming rule ("only after you have read every message already in its file"); it cross-references step 5 (b), which exists and says exactly that. With the *Two-hour idle stop* text: the stop path already handles all mail before stopping, so arming a session's file after reading everything in it loses nothing that arrived during the gap — this is the gap my revision 1 note 2 named (`accept-1` worked example in the spec's *The gap*), now closed for the same-session path; the take-over path was already covered by step 5.
- Test (T-E430-04, `test/e430-mailbox-outside-lane.test.mjs:137-160`): `C_IN5` and `BASE_IDLE_STOP` are frozen literals; `BASE_IDLE_STOP` is byte-equal to line 114 at `9516b1a` (checked). The exact-line assertion `idle === BASE_IDLE_STOP.replace(RESUME, C_IN5 + " " + RESUME)` is the full AC8 shape; position, last-sentence, single occurrence in file, line count 260, served-text survival and hygiene are asserted separately. Mutation results (run on a scratch copy outside the worktree):
  - base `9516b1a` content → fail `idle-stop sub-bullet contains C-IN5 exactly once`
  - `C-IN5` moved after `Resuming — …` → fail `C-IN5 sits directly after the tell-the-human sentence and directly before Resuming`
  - `step 5 (b)` → `step 5` inside `C-IN5` → fail `contains C-IN5 exactly once`
  - one blank line added elsewhere → fail `file line count unchanged`
  - `Resuming — …` sentence edited (comma dropped) → fail `the Resuming sentence is byte-unchanged and still the sub-bullet's last sentence`
  - `C-IN5` duplicated elsewhere in the file → fail `C-IN5 occurs exactly once in the file`

## Quality
No findings. The sentence mirrors the approved `C-IN3` wording; the step-number cross-reference follows the file's existing style (human ruling Q4 (a)). The test's added comment (3 lines) states WHAT and WHY only; `agc check — comments` flags no file in this diff.

## Architecture
No architecture spec for this feature. Change stays inside the owned file; the content/test split is unchanged.

## Security
No findings. Prose only. Served-text hygiene for `C-IN5`: no repo-only path (`REPO_ONLY` no match), no bare ticket id, no backtick-quoted gate code — asserted by the AC8 test and re-checked by reading. Its only digit is the cross-reference `step 5 (b)`, not a restated limit.

## Performance
No findings. One sentence in an SOP; integrator SOP is not in `test/context-budget.test.mjs`'s capped set and no cap moved.

## Verdict
APPROVED — `C-IN5` is byte-equal to the approved Copy row at the approved anchor with nothing else changed, the AC8 test is meaningful and red-then-green for the right reason, and revision 1 has no regression.

### Recommended (non-blocking, report-only)
- None.

### Optional (non-blocking, report-only)
1. The sentence says "Whichever way it resumes" one sentence before the `Resuming — …` sentence that names the two ways — a light forward reference, accepted by the human's Q4 (a) ruling because e285 pins `Resuming — …` as the sub-bullet's ending.
2. A reader may sense tension between `C-IN5` (a session's file is armed after reading all of it, i.e. at its count then) and the next sentence's "never the current count" (lanes). The phrase "the handoff has no `watch baseline` for it" disambiguates, and `C-IN3` (b) already uses the same split; no change needed.

Environment note: the first full-suite run had 2 reds (`test/e250-eject-path-escape.test.mjs` "a path segment carrying LF, CR and ESC…" and `test/e284-fanout-handoff.test.mjs` "status, foreign worktrees, watch-lock"), both ~947 s child-process timeouts (`spawnSync git ETIMEDOUT` / spawn status null) at the same moment — a host stall, not this diff (prose-only change; neither test reads the integrator SOP). Both files reran 25/25 green, and a second clean-tree full run is 4766/4768 pass, 0 fail, exit 0.
