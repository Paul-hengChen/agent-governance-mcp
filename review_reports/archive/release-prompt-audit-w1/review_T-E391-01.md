# Review — E391 (T-E391-01, T-E391-02, T-E391-08, T-E391-04)

covers: T-E391-01, T-E391-02, T-E391-08, T-E391-04

## Round 1 — APPROVED — by code-reviewer

Range reviewed: `664e147..e98976a` (task commits c06cbd8, 9ffa4ef, d2376fa, a081f20; chore e98976a). Spec: `specs/e391-prompt-audit-stale-facts.md`. No architecture spec (mini-chain, no architect).

## Summary
- Wording-only edits to 9 `content/` files and `CLAUDE.md`, 14 findings (G2-02/03/04/05/06/07/08/11/12/13/15/18/24/26). There is one commit per task, and each commit touches only that task's files.
- Every changed line matches the spec's Copy / Strings text exactly. I checked this with a per-line prefix/suffix diff against base, and with full-line reads of every long replacement. Every `content/` hunk header equals the spec's site table (const-08 L2/L4; const-15 L6; lite L16/L49; release-engineer L292; rationale L3/10/15/173-174; design-auditor L71/89; doc-writer L13; qa-engineer L59-60/95/101; qa-visual L24/65).
- All hard conditions hold. Nothing under tools/gates/schema/prompts/bin/scripts/lib/templates/test/dist changed. `npm run build` leaves dist/ with no diff. `agc check` exits 0. Bundle lean is 5722. skill-qa-engineer.md is 18371 B. The fanout check exits 0.
- The expected-red manifest matches the actual reds exactly (12 of 12), and the guard suites are green.
- Verdict: APPROVED. All three findings are optional; two concern the spec's wording, not the implementation.
- Same-model note: sr-engineer and this reviewer both ran on opus (dispatch pins), so there is a same-model bias risk. The verbatim checks below are mechanical, which limits that risk.

## AC Completeness
AC-G2-02 — implemented — content/skill-release-engineer.md:292; "33 gate definitions" 0, `` `gates/registry.ts` (`GATE_REGISTRY`) `` 1, one `@@` hunk
AC-G2-04 — implemented — content/constitution-rationale.md:173-174; the stale "max N" phrases 0, `` the `fix_try`, `read`, and `hop` caps `` 1
AC-G2-05 — implemented — content/skill-design-auditor.md:71; "max 3 extraction / max 5 files" 0, new phrase 1; const-01 has no diff (`git diff --quiet` 0)
AC-G2-06 — implemented — content/const-08-chain-31-mid.md:2; "stop-condition 6" 0; the label resolves to content/coord-03-core-fallback.md:43 **Cut-approval gate writer obligation**
AC-G2-07 — implemented — content/skill-design-auditor.md:89; "2a-bis" 0; resolves to content/skill-pm.md:104 Gate Summary row **Geometric-Density Split Gate** (`## Gate Summary` at :97)
AC-G2-08 — implemented — content/constitution-rationale.md:3,10,15 and content/skill-doc-writer.md:13; "content/constitution.md" 0/0, "Rationale target" 0, the doc-writer list names `content/const-*.md`, `content/coord-*.md`; rationale L39/L77 keep their `v3.27.0` origin tags, as the AC requires
AC-G2-11 — implemented — content/skill-coordinator-lite.md:16; "will be rejected" 0, the new server-rejected / SOP-forbidden clause 1
AC-G2-12 — implemented — content/skill-qa-engineer.md:59,60,95,101 (4 hits); content/skill-qa-visual.md:24,65 (2 hits); 0 workspace-relative `content/skill-qa-*` paths left; `<agc install>` defined once at qa-engineer:60; 18371 B ≤ 18500
AC-G2-18 — implemented — const-08:2,4 and lite:49 use bare names (no `skill-*.md` left); const-08 L12 "(Round 4 of `review_round`)" untouched (1)
AC-G2-26 — implemented — content/const-15-core-tail.md:6; "§Auto-Routing" 0; resolves to coord-03:19 `## Escalation Routes`
AC-G2-03 — implemented — CLAUDE.md:163; "1633|at v3.94.0" 0, "suite-result:" 1 (see Correctness F1, optional)
AC-G2-13 — implemented — CLAUDE.md:198; "18.7KB|27KB" 0; the measure command appears once with a plain `|`; `mjs \| wc` 0
AC-G2-15 — implemented — CLAUDE.md:184-187; "Commit/PR workflow is out of scope" 0, "never write to git" 1, "Constitution §6" 1
AC-G2-24 — implemented — CLAUDE.md:88-90,103,125; all 4 new rows present (grep → 4); the check-version row names dist/index.js, package-lock.json, CHANGELOG and the advisory git tag; rows were only added, none moved (see Quality F2, optional)
AC-SCOPE — implemented — `node scripts/fanout.mjs check specs/fanout-e391-prompt-audit.md e391 --base 664e147` exit 0 (16 files, 0 out of bounds); content/ hunk headers equal the site table; adapter blocks and `agc-version:` have no diff; no coord-*/const-01/06/12/skill-integrator/skill-pm/templates/tools/gates/prompts/schema/lib/bin/scripts change
AC-DIST — implemented — after `npm run build`, `git status --short` shows only `.current/e391/*`; dist/ is clean
AC-STAMP — implemented — `node bin/agc-init.mjs check` → "OK (4.16.0)", exit 0
AC-BUDGET — implemented (sr scope) — `measure-context-cost` bundle lean 5722 (≤ 5722 target, base 5723); `test/context-budget.test.mjs` unedited and green. The full before/after record belongs to QA (T-E391-05).
AC-GOLDEN / AC-SUITE — not in this review's scope (qa-owned T-E391-05/-07); the planned golden reds are listed in the manifest

## Correctness
- **F1 — optional (spec-owned wording)** — CLAUDE.md:163. The new comment points to "the suite-result: line in the latest qa_reports/archive/release-*/review_*.md". This is true for the newest release: release-post-v4-w13 carries it, in 13 files. But only 18 of 338 archived review files carry the line, all in release-post-v4-w12/-w13. If a reader picks "latest" by sorting names (`ls | tail -1`), they get `release-v4.6.0`, which has no `suite-result:` line. The text is the spec's g2-03 string word for word, so this is not an sr-engineer defect. If the integrator wants to tighten it, a follow-up could name the newest release dir by date. No action is needed for this ticket.
- Pointer resolution, all confirmed in the current tree: coord-03 `## Escalation Routes` (:19), **Cut-approval gate writer obligation** (:43), **Auto-tier writer action** (:45); `## Subagent Reply Watermark Validation` at coord-04:1 (composed into skill-coordinator); skill-pm Gate Summary (:97) and its Geometric-Density row (:104); const-01 Limits rows `hop` 14 (:16), `fix_try` 2 (:17), `read` 3 (:18).
- G2-15 fact check. Git readers reached by tools: `tools/feature-rollup.ts:71` and `tools/lane-registry.ts` run `git worktree list --porcelain` for the lane registry. `tools/tasks-lane-migrate.ts:323` runs `git check-ignore`. Other tools also read git (merge-invariants, comment-scan, hygiene-scan, join-precondition `merge-base --is-ancestor`). A grep of `tools/*.ts` found no state-changing git verb (commit/push/checkout/reset/stash/tag/branch/merge/rebase/fetch/update-ref). So "never write to git … some read it, e.g. `git worktree list` for the lane registry" is accurate.
- G2-24 rows check against each module's header comment: `lib/render-boundary.ts` ("the one function that puts reported data … into prompt text, behind a label and inside a fence"; imported at prompts/build.ts:31); `tools/lane-paths.ts` ("sole owner of the lane-scoped `.current/` filenames"); `tools/lane-status.ts` ("fires no gate, writes nothing"); `tools/fanout-manifest.ts` + `tools/fanout-handoff.ts` exist, with `scripts/fanout.mjs` and `scripts/lane-status.mjs` present.
- Expected-red sampling (SOP 4a; manifest `qa_reports/expected-red_e391-prompt-audit-stale-facts.txt`). `node --test test/compose-equivalence.test.mjs test/qa-visual-skill-split.test.mjs` gives 23 tests, 11 pass, 12 fail. The 12 failures are compose-equivalence #1-#11 plus qa-visual-skill-split #17 "AC-3: lazy-load hook …". Every one appears in the manifest with the exact test name (12/12, so sampling covered every entry, well over the minimum of 3). Nothing unlisted is red. The guard set (context-budget, e178a-integrator-role, teamwork-lite, design-auditor-volume-guard, constitution-deliverable-guard, e164-e167-content, subagent-templates) gives 133/133 pass. Extra guards (e234-hygiene-scan, e258b-comment-scan, agc-adapters, skill-manifest, cut-approval-gate, e296-manifest-tier) give 187/187 pass.

## Quality
- **F2 — optional (spec-precision, informs T-E391-06)** — The third AC-G2-24 proof (`git diff 664e147 -- CLAUDE.md | grep -c "^-[a-z]"`) lists `lib/`, `scripts/check-version.mjs` and `npm test`, but it returns 4, not 3. The fourth removed line is the G2-13 `auto-injects … (~18.7KB) into every` line, which the spec authorizes. No row was removed and re-added, so the AC's intent holds. When QA writes `test/e391-prompt-audit-stale-facts.test.mjs`, it should not pin this count at 3.
- **F3 — optional** — CLAUDE.md:198. The G2-13 line was left unwrapped (about 112 chars, longer than its neighbours). The spec allowed but did not require a rewrap of 189-197, and leaving it reduces diff churn. Acceptable.
- Layout rows line up at column 26, like their neighbours. The G2-15 continuation lines use the 2-space indent of sibling bullets. The design-auditor L71 keeps its 3-space list indent. The diff adds no comments (Comment check, SOP 4b: nothing to apply). No new number appears in CLAUDE.md through G2-03/G2-13. "Twelve prompts are registered", "the other ten" and "the other 11 role SOPs" have no diff.

## Architecture
No architecture spec (mini-chain). No gate, routing, schema or error-code surface is touched: `git diff --name-only 664e147 --` over tools/ gates/ prompts/ schema/ lib/ bin/ scripts/ templates/ test/ dist/ returns empty. No E392/E393/E394 hunk: const-08 L12 "Round 4" has no diff, and coord-*/const-06/const-12/skill-integrator/templates are untouched. No G2-17 restatement and no new Limits row (const-01 has no diff).

## Security
No findings. The changes are prose only. The new text adds no absolute local path, user name or secret. `agc check` hygiene is clean, and e234/e258b scans pass on committed HEAD.

## Performance
No findings. No executable code changed. The prompt budget went down, not up: bundle lean 5723 → 5722, and skill-qa-engineer.md (18371 B) stays under its 18500 cap.

## Verdict
APPROVED. Every changed line matches its spec Copy / Strings row exactly and stays within the named sites. All the new pointers resolve, and every hard condition and the expected-red manifest check out. The only findings are optional (F1–F3).
