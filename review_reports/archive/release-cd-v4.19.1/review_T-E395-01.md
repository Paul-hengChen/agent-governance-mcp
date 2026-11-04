# Review — T-E395-01

covers: T-E395-01, T-E395-02, T-E404-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- Scope: implementation commit `ec66eb0`, reviewed as `git diff 1000517...HEAD -- CLAUDE.md templates/`. Two files changed: `CLAUDE.md` (+16/-5) and `templates/claude-code-agents/release-engineer.md` (+2/-12). The other lane commits are the spec and `.current/e395` bookkeeping.
- E395: the four stale count literals are replaced, the F1 "most recent release" wording is applied, and 11 Layout rows are added as one block after `tools/fanout-*.ts`.
- E404: the release-engineer template goes from 23 to 13 lines (frontmatter, watermark, load line, step 5 re-baseline hint, RELAY), the same shape as the other 11 templates.
- Every deleted template rule is still covered by the SOP Hard rules or steps, or by `scripts/release.mjs prepare`.
- Verdict: APPROVED. No required findings.

## AC Completeness
Spec: `specs/e395-claude-md-template-tail.md`. ACs owned by tasks other than T-E395-01/02 and T-E404-01 (new tests, re-pins, full suite) are listed as out of this round.

- AC-E395-1 — implemented — the stale-literal regex `[0-9]+ test files|[0-9]+ gate definitions|\([0-9]+ entries\)` matches 0 times in `CLAUDE.md`.
- AC-E395-2 — implemented — each new text occurs exactly once as a whole line: `c395.what-50` (CLAUDE.md:50), `c395.layout-91` (:102), `c395.layout-126` (:137), `c395.testing-158` (:169).
- AC-E395-3 — implemented — base and HEAD counts match: "thirteen `tw_*` tools" 1/1, "18-step" 2/2, "12 model-pinned" 1/1, "(15 fragments)" 1/1, "12 registered role prompts" 1/1, "Twelve prompts are registered" 1/1, "the other ten" 2/2, "the other 11 role SOPs" 1/1. The diff has five hunks, at base lines 50, 91, 126, 158 and 163. Those lines sit in What this repo is (:16), Layout (:56) and Testing changes (:156). Everything from `<!-- agc-version` to EOF is byte-identical to base. `test/e178a-integrator-role.test.mjs` is green and unmodified.
- AC-E395-4 — implemented — the 11 rows are in spec order at CLAUDE.md:91–101, directly after `tools/fanout-*.ts` (:90) and before `gates/registry.ts` (:102). Apart from the two edited rows, the base Layout lines keep their relative order. 13 Layout lines are new: 11 rows plus 2 edits. `test/e391-prompt-audit-stale-facts.test.mjs` is green and unmodified.
- AC-E395-5 — implemented (row side) — every `tools/*.ts` file is covered by a row or by a glob row; none is uncovered. The only globs are `tools/fanout-*.ts` and `tools/comment-*.ts`. The test that pins this is T-E395-03 (qa).
- AC-E395-6 — implemented — CLAUDE.md:174 matches `c395.testing-163` verbatim. "the latest qa_reports" occurs 0 times, "most recent release" once and `suite-result:` once.
- AC-E395-7 — implemented — the e391 suite is green and unmodified.
- AC-E404-1 — implemented — the template has 13 lines with 4 non-blank body lines in the target order. It ends with a single `\n` and no trailing blank line. Lines 1–8 (frontmatter, blank, watermark, blank) are byte-identical to base.
- AC-E404-2 — implemented — the watermark is base line 7 verbatim. `test/subagent-templates.test.mjs` v3.21.2 AC1 is green.
- AC-E404-3 — implemented — line 9 equals `c404.load` and starts with base line 9 verbatim.
- AC-E404-4 — implemented — line 13 is byte-identical to base line 19 and is the last line. e9a AC2 and E9A-S4 are green.
- AC-E404-5 — implemented — exactly one line contains `SOP step 5`. It equals `c404.rebaseline`, counts as 1 sentence, and names `git fetch origin` and `git -c pull.rebase=false pull --ff-only`.
- AC-E404-6 — implemented — the template has no `Example reply suffix:` line and no `(haiku)`. v3.21.2 AC2 is green.
- AC-E404-7 — implemented — none of the 18 absence-list strings occurs.
- AC-E404-8 — implemented — `git diff --stat 1000517 -- templates/` lists only `release-engineer.md`.
- AC-DIST — implemented — `git diff --stat 1000517 -- dist/` is empty.
- AC-SCOPE — implemented — the changed paths are `CLAUDE.md`, the template, the spec and `.current/e395/**`.
- AC-BOOK, AC-STAMP, AC-GEN, AC-SUITE — out of this round (T-E395-04, qa). The stamp tail is byte-identical, so AC-STAMP is expected to hold.

## Correctness
No required findings.

- **Layout rows against module headers.** I read the header of each module the rows describe.
  - `tools/comment-*.ts`: it is the sixth `agc check` advisory (comment-scan.ts:2). The row's description fits: scanner (comment-scan), per-language lexers (comment-lex, comment-lang-*, comment-python), doc-tag rules (comment-tags), shared types (comment-types).
  - `dispatch-log.ts`: append-only per-hop sidecar, one JSON line per write carrying dispatch_mechanism (:2–4).
  - `evidence-lookup.ts`: used only by tools/drift.ts; looks in the qa_reports/ root and qa_reports/archive/<feature>/ (:2–5).
  - `feature-rollup.ts`: "Reporting only: no gate" (:4).
  - `hygiene-scan.ts`: the fifth advisory, and it never changes the exit code (:2–3).
  - `join-precondition.ts`: depends_on branches are ancestors of HEAD, and it is "not a pipeline gate" (:2–6).
  - `lane-migrate.ts`: flat <-> lane runners (:2–4).
  - `lane-registry.ts`: read-only and derived from `git worktree list`. Its consumers are tw_get_state and the feature roll-up (:2–5).
  - `lane-ticket-allocation.ts`: `<LANE>-NEW-n` in `.current/<lane>/pending-tickets.md` (:2–4).
  - `merge-invariants.ts`: "fires no gate and writes nothing" (:6), and `scripts/merge-invariants.mjs` exists.
  - `tasks-lane-migrate.ts`: legacy tasks.md -> `.current/<lane>/tasks.md` (:2).
  - All 11 rows are accurate.
- **Re-baseline sentence vs SOP step 5.** Step 5 is at `content/skill-release-engineer.md:41`, which I only read. The sentence is faithful: on `main`, `git fetch origin`, then `git -c pull.rebase=false pull --ff-only`, then derive the version from HEAD. "Before the version bump" is correct, since step 5 comes before the step 7 bumps. "never from the baseline read at PASS time" is not in step 5, but it agrees with it.
- **Deleted template rules.** Each of the six deleted lines is still covered somewhere else, so none was a template-only rule:
  - Old :11, staging and "STOP on missing path": `release.mjs prepare` does the staging and citation checks (SOP step 12). Exit 30 `STAGING_INCOMPLETE` is a Blocked row (scripts/release.mjs:639, :659).
  - Old :13, re-baseline: replaced by the hint line. It is backed by SOP step 5, by the Hard rule **Git** ("locally only by `git -c pull.rebase=false pull --ff-only`") and by exit 11 `STALE_BASE`.
  - Old :15, STOP on ⛔ and no hand-editing: Hard rule **STOP on ⛔** (SOP:19), plus the ⛔ escalation row (:105).
  - Old :17, push rejection and the never-reset/rebase/checkout --force/clean list: Hard rule **Git** (SOP:15) says "Never force-push … A push rejection, collision or any `RELEASE_STOP` is a Blocked write carrying the branch and local sha, never a recovery command". It is also backed by Constitution §6 *Sanctioned git operations*, which is an allowlist, and by exit 34 `PUSH_REJECTED` (Blocked, branch and local sha). The four commands are no longer named one by one. "Never a recovery command" plus the §6 allowlist forbid all of them, so no rule is lost.
  - Old :21, record integrity: Hard rule **Record integrity** (SOP:21), which is stricter than the deleted line.
  - Old :23, `driftBaselineIds`: `release.mjs prepare` appends it, deduplicated and creating the array if absent (scripts/release.mjs:473–497). The SOP Artifact list and step 12 ("drift baseline") also cover it.
- **Expected reds.** I ran 12 related test files: 317 tests, 307 pass, 10 fail. The 10 failures are exactly the cases in the brief: T-E166-01b; e392 AC8; feature-lease S4, E9A-S5, E17-S3 and E17-S4; release-staging AC5, both C13-AC6/AC7 cases and D10-AC4. None falls outside that list. `subagent-templates`, `e391`, `e178a`, `e234-hygiene-scan`, `e258b-comment-scan`, `e108`, `e250` and `e336` are all green.
- **Step 4a, expected-red manifest.** No manifest exists, and I am not blocking on it. The diff touches no test file. Every red comes from deleted template text that the human-approved spec's *Re-pin survey* lists as structured `file | case` pairs. They are re-pin work inside this same chain (T-E404-02/03), not reds that will persist, and the feature is in feature mode, not bugfix. Instead of sampling a manifest, I ran all 10 and matched them to the survey.

## Quality
- optional — CLAUDE.md:91, `tools/comment-*.ts`. "scanner, per-language lexers, doc-tag rules, shared types" leaves out the language registry (`comment-langs.ts`) and the Python docstring tracker (`comment-python.ts`). As a summary of a glob row it is accurate enough, and the spec's Copy / Strings row is verbatim, so this does not block.
- optional — template:11. The hint leaves out step 5's "plus the step 3 bump kind". This is harmless because the SOP the agent loads supplies it.
- No dead text and no convention drift. The 11 rows follow the existing column-alignment style: two-space separators where the path overflows the 26-column gutter, the same as `tools/skill-frontmatter.ts`.

## Architecture
No architecture spec exists (mini-chain, no architect). The change makes the template thinner and leaves the SOP as the only normative source, which is the stated goal (User Story 2). `content/**` is untouched (ruling 4).

## Security
No findings.
- Constitution §6 hygiene: the added lines contain no absolute or home paths, user names, internal hosts or links. `<LANE>`, `<feature>` and `<lane>` are generic placeholders.
- The cited specs and scripts are in-repo paths only.
- The diff adds no code comments, so step 4b has nothing to check.
- The e234 hygiene and e258b comment scans are green on HEAD.

## Performance
No findings. The change is documentation and template text only; no runtime code changed and `dist/` is unchanged.

## Verdict
APPROVED. Every Copy / Strings row is applied verbatim, both changes stay inside their owned sections and file, the template keeps its frontmatter, watermark and RELAY byte-identical, and every deleted rule is still covered by the SOP or by `release.mjs prepare`. The test reds match the expected list exactly.

Same-model note: sr-engineer and code-reviewer are both pinned to opus (human ruling 6). The two may share blind spots, so the checks above were run mechanically: verbatim matching, byte comparison and test runs.
