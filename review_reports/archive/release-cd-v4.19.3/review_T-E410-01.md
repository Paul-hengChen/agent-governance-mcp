# Review — T-E410-01

covers: T-E410-01, T-E410-02, T-E410-03, T-E410-05, T-E413-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- Diff under review: `cbbbc9b..c216461 -- content/`: 7 content files, 16 one-line in-place span swaps (15 E410 alias sites, which hold 16 alias occurrences because const-01:33 carries two, plus the E413 skill-pm:109 Action cell). Spec: `specs/e410-task-alias-content-tail.md` (human-approved cut at cbbbc9b). No architecture spec (mini-chain, no architect).
- All 16 replacements match the spec's Copy / Strings "new" span byte for byte. Each old span appeared exactly once on its stated line before the swap, and the rest of each line is byte-identical. A whole-file simulation (base + the 16 swaps) equals HEAD for all seven files, so no other line moved.
- AC1 alias rule re-run independently over HEAD `content/const-*.md` + `content/skill-*.md` (27 files): 0 alias occurrences (the lane base has 16), and the skipped set is exactly the spec's 13. None of the 16 site lines contains a case-sensitive `Task`.
- `npm run build` exit 0; `git status --porcelain dist/` empty. A targeted run of 14 test files gives 184/202 passing. The 18 reds are exactly the predicted T-E410-04 set.
- Verdict: APPROVED. There are no required findings. Two recommended notes (spec AC3 total slip; no expected-red manifest) and three optional wording notes follow.

## AC Completeness
AC1 — implemented — 0 alias occurrences at c216461 (lane base cd24f34: 16 on 15 lines, matching the spec list exactly); skipped set = const-01:29, const-05:17, const-08:9, const-13:18, skill-architect:27, skill-design-auditor:105, skill-integrator:196, skill-pm:10/14/73, skill-sr-engineer:13/28/49 (13, as specified); none of the 16 lines contains a `Task` substring. Test half (`test/e410-*.test.mjs`) is T-E410-04 scope, not yet written — expected.
AC2 — implemented — every site carries its new span verbatim, the old span is gone, the rest of the line is unchanged (a simulated `base.replace(old,new)` equals HEAD per line), and line counts hold: const-01 37, const-05 23, const-08 13, const-12 22, skill-coordinator-lite 53, skill-integrator 249, skill-pm 120. Test half is T-E410-04.
AC3 — implemented — new ≤ old on every row. Measured JS lengths: c01.33 73→54, c05.9 35→30, c08.2 36→31, c08.5 34→29, c12.2 34→29, lite.43 30→26, lite.49 21→21, int.40 47→40, int.177 36→36, int.181 34→34, int.41 27→20, int.78 24→24, int.81 33→24, int.248 20→18, pm.111 41→36, pm.109 194→193. Total −74 (see R1 for the spec's −78).
AC4 — implemented — `git diff --numstat cd24f34 c216461 -- content/` prints exactly const-01 1/1, const-05 1/1, const-08 2/2, const-12 1/1, skill-coordinator-lite 2/2, skill-integrator 7/7, skill-pm 2/2; no `coord-*` file.
AC5 — implemented — `git diff --exit-code cd24f34 c216461 -- 'content/coord-*.md'` exits 0; coord-02 line 1 alias sentence unchanged; const-01 watermark table still has two data rows, the first `| Subagent-dispatched with \`model:\` pinned by the parent | \`— @<role> (<tier>)\` |` (content/const-01-core-head.md:33); const-05 (c) still starts `otherwise —` (content/const-05-core-standards.md:9); e43, e403, e408 green.
AC6 — implemented — content/skill-pm.md:109 trigger cell and rationale block unchanged (whole-line simulation equal); Action cell = `pm.109.new` exactly; no `AskUserQuestion`; contains `inline`, `numbered`, `≤ 4`, `2 batches if more`, `recommended answer`, `end the turn`, `coordinator`, `**Dependencies / Prerequisites**`; length 193 ≤ 194. Line 111 still contains ``do NOT use `AskUserQuestion` `` (only the `Task-subagent dispatch` span changed); `content/skill-coordinator-lite.md` line 21 is unchanged (the file's only diff hunks are 43 and 49).
AC7 — partial (by design, not an sr defect) — the content halves of the re-pins (int.41/78/81/177/181/248) are in place. The test re-pins are T-E410-04 (qa); the e178a/e285/e288/e329 reds observed are those pins. They are not counted as findings.
AC8 — partial (by design) — golden re-capture is T-E410-04; the 11 compose-equivalence reds observed are exactly the 8 build-*, hook-lite, hook-full and constitution-monolith goldens the spec predicts; skill-manifest (coordinator monolith) green.
AC9 — implemented on the content side — `test/context-budget.test.mjs` green on c216461 (no cap literal touched by this diff); qa records before/after values.
AC10 — partial (by design) — `npm run build` exit 0 and `git status --porcelain dist/` empty verified here; the full suite, `check:bookkeeping` and `npm audit` on the final HEAD are T-E410-04.

## Correctness
No required findings.

Semantic read of every rewritten sentence, checked under Claude Code (where coord-02 line 1 still defines the alias) and on a host without it:
- content/const-01-core-head.md:33 — "Subagent-dispatched with `model:` pinned by the parent" still separates the tiered case from the `otherwise` row (initial session agent, coordinator, coordinator-lite, in-context `tw_switch_role`). Dropping the `Task(subagent_type=…)` example loses no condition: the pinned-model clause is what carries the distinction, and Claude Code's `Agent` tool is a subagent dispatch under coord-02's definition.
- content/const-05-core-standards.md:9 — branch (c) is an `otherwise` fallthrough after (a) and (b), so "dispatched with a silent brief" cannot capture an in-context `tw_switch_role` case with a reachable human (that is (b)). The next sentence's "a dispatched subagent" makes the subagent meaning explicit. Meaning preserved.
- content/const-08-chain-31-mid.md:2 and :5 — "under subagent dispatch" stands opposite the same sentence's "same-context dispatch (lite, full non-subagent, or the `tw_switch_role` fallback)", so the witness rule (the coordinator attests, not the PM subagent / stranded role) is unchanged.
- content/const-12-chain-r10-s4.md:2 — "Background/parallel subagents and inline-coordinator execution can desync `tasks.md`" carries the same R10 risk statement.
- content/skill-coordinator-lite.md:43 and :49 — "After a subagent dispatch, call `validateWatermark`" and "Out-of-scope: ONLY after subagents; skip after `tw_*`/bash/file." still read correctly under the `## Subagent Reply Watermark Validation` heading (see O1).
- content/skill-integrator.md:248 — "(no tier: an MCP-prompt invocation is not a subagent, Constitution §1)" still justifies the no-tier watermark against const-01's first-row subject ("Subagent-dispatched…"), and the noun now matches that row.
- content/skill-integrator.md:40/41/78/81/177/181 — the dispatch verbs and objects are kept; :78's heading names the subagent dispatch, and :81 "re-dispatch PM" refers back to it; :41 now matches line 24's existing "dispatch PM to write the ticket-cut file". The Stage 0 limits (that file only, no `tasks.md`, no write-type `tw_*`) are intact on :41 and :78.
- content/skill-pm.md:109 — keeps ≤ 4, the split into 2 batches above that, upfront + inline + numbered, a recommended answer per question, end of turn, relay via the coordinator when running as a subagent, and answers recorded under **Dependencies / Prerequisites**. No other `content/` line still points the Question Batch at `AskUserQuestion` (grep: the only remaining `AskUserQuestion` mentions are the two "do NOT use" prohibitions at skill-pm:111 and skill-coordinator-lite:21).
- content/skill-pm.md:111 — "Subagent dispatch: if your turn ends after presenting this draft, do NOT set cut_approved" stands opposite the line's own "Same-context dispatch (…)" branch; the `AskUserQuestion` prohibition is untouched.
- coord-02's compound terms `Task-dispatched` / `Task-spawned` still have live users in coord-02 (:9, :11, :17) and coord-04 (:3), so removing const-01's `Task-spawned` leaves no definition orphaned.

Step 4a (expected red): the targeted run (`compose-equivalence`, e178a, e285, e288, e329, context-budget, e43, e403, e408, skill-manifest, render-structure, teamwork-lite, e391, e90) gives 18 fail / 184 pass of 202. The failures are compose-equivalence ×11 (tests 1–11), e178a AC1 and AC9, e285 AC-E285-5, e288 AC-E288-3 / AC-E288-4 / negative control, and e329 AC-E328-2. All 18 are real, locatable tests reported by name in the TAP output, and each matches the spec's *Test files: pin audit* and *Dry-run suite result* one-for-one; T-E410-04 owns them all. No unexplained red.

- **R2 (recommended)** — no `qa_reports/expected-red_e410-task-alias-content-tail.txt` exists, although the intentional reds above are evident. SOP step 4a calls for a CHANGES_REQUESTED finding in that case. I am recording it as recommended instead, for four reasons:
  - the human-approved spec already lists every red as file + test + line (pin-audit table and dry-run result);
  - the approved cut limits sr-engineer's touches to `content/` (T-E410-01..03/05, T-E413-01), so sr writing under `qa_reports/` would leave the cut;
  - `dispatch_mode` is not `bugfix`, so no gate consumes the manifest;
  - the same-class precedent (review_reports/archive/release-cd-v4.19.2/review_T-E408-01.md, R1) set this exact tier for golden reds predicted by the spec.

  If the coordinator or human reads 4a strictly, overrule this to CHANGES_REQUESTED.

## Quality
- **R1 (recommended, spec defect, non-blocking)** — specs/e410-task-alias-content-tail.md AC3 prose says "PM dry run: total −78 chars over the 16 rows". The spec's own per-row figures in the Copy / Strings table sum to −74, and I measured −74 independently (sr reported the same). The normative part of AC3 is "new ≤ old for every row", which holds; the total is an informational parenthetical, so this does not block the implementation. Action: qa must not encode −78 in the AC3 test (assert per-row `new ≤ old`, or −74 if a total is asserted). PM can correct the figure at the next spec touch; a separate amendment round is not warranted for an arithmetic slip in a parenthetical.
- O1 (optional) — content/skill-coordinator-lite.md:49 "ONLY after subagents;" is elliptical ("after subagent replies" is meant). The section heading and line 43 make the meaning clear, and the spec's length rule ruled out "a subagent dispatch" (+10 chars). No action.
- O2 (optional) — content/skill-pm.md:109 drops the nouns "questions" (after `≤ 4`) and "the spec's … section". The terse "(as a subagent: via the coordinator)" relies on the reader knowing the coordinator relays. Both changes are spec-verbatim under ruling 3's length ceiling, and the meaning can be recovered from the row's trigger cell. No action.
- O3 (optional) — content/skill-integrator.md:40 drops the parenthetical rather than replacing it, so "Dispatch code-reviewer / qa-engineer" no longer says the dispatch is a subagent one in that cell. The cell's own "dispatch a read-only verifier" and the merge-stage lines 177/181 ("subagent-dispatch") supply the meaning. This matches the spec's int.40 rationale. No action.

Comment check (4b): the diff adds no code comments; no `agc check — comments` surface touched.

## Architecture
No architecture spec (mini-chain, no architect). Layering is unchanged: the alias definition stays only in `content/coord-02-host-dispatch.md` (`host:claude-code`), per ruling 2, and every coord-* file is byte-identical. The host-neutral nouns follow the E403/E408 precedent (`specs/e408-core-task-alias-tail.md`). The diff touches no `tools/`, `prompts/`, `gates/`, `dist/` or schema.

## Security
No findings. The diff is prose only: no input crosses a trust boundary, no secrets, no paths or identifiers that leak environment detail. The cut-approval and lease-override witness rules (const-08:2/5) and the PM `cut_approved` dispatch branch (skill-pm:111) keep their trust boundary: the coordinator remains the sanctioned writer under subagent dispatch.

## Performance
No regression. All 16 spans shrink or hold length (−74 chars total). `test/context-budget.test.mjs` is green on c216461 with no cap literal touched. No code path changed.

## Verdict
APPROVED. All 16 span swaps match the approved Copy / Strings byte for byte, nothing else in `content/` moved (coord-* untouched), the alias rule finds 0 occurrences, every rewritten sentence keeps its Claude Code meaning and reads host-neutrally, `dist/` matches a fresh build, and the only reds are the spec-predicted T-E410-04 goldens and pins.

Reviewer note: this review ran on opus, the same tier as sr-engineer (dispatch pins), so the different-model recommendation could not be honoured. To offset same-model bias, every claim above was checked mechanically (byte-level simulation script, independent alias-rule implementation, test run) rather than taken from a read-through.
