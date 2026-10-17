# Review — T-E329-01

covers: T-E329-01, T-E328-01, T-E334-01, T-E327-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- Scope: `git diff cec96d7..HEAD -- content docs` (cut approved at cec96d7, dispatch base 902462e). Three files change: `content/skill-integrator.md` (+5/-2), `content/skill-qa-engineer.md` (+1/-1), `docs/lane-protocol.md` (+3). No change under `test/`, `tools/`, `bin/`, `scripts/`, `dist/`. The rest of the range is lane state (`.current/e329/`) and the expected-red manifest.
- All nine Copy/Strings literals appear verbatim, exactly once each, at the required placement and indent. This was checked by a script that extracts each literal from the spec table and looks it up in the target file.
- No text outside the literal placements changed. The diff contains only those hunks. The appended Stage 0 paragraph keeps its base text byte-identical as a prefix, followed by one space.
- Every factual claim was checked against the base code (902462e) and holds: the `owners --range` shape and exit codes, the validate closed-status rule and `## 接手步驟` heading set, and finish's `target_repo` and never-committed handling.
- Verdict: APPROVED. No required findings. Two optional notes and one same-model flag.

## AC Completeness
AC-E329-1 — implemented — content/skill-integrator.md:192 (`int.stage6.close` verbatim, second sub-bullet under Stage 6 step 1, 3-space indent)
AC-E329-2 — implemented — content/skill-integrator.md:192 names section `接手步驟` and exactly 核對 primary / 已結案 / 待人類決定 / 進行中的背景工作, which equal `HANDOFF_SECTION` / `HANDOFF_SUBITEMS` at base (tools/fanout-manifest.ts:750,753). It names no extra mandatory heading; 裝置 / 工具 are stated as optional. (The qa test T-E329-02 still has to pin this.)
AC-E329-3 — implemented — content/skill-integrator.md:127 (`int.basefix.cond2` replaces the whole condition-2 line; the insertion-lane `check` clause is kept; `git diff --name-only <lane branch>...origin/<target>` no longer appears anywhere in the file; conditions 1–5 stay an ordered list; the *Condition 2 or 4* stop sentence and the Decision rights row are untouched)
AC-E328-1 — implemented — content/skill-integrator.md:80 (`int.stage0.decider` appended after one space; the `出處` sentence is byte-identical)
AC-E328-2 — implemented — content/skill-integrator.md:78 (new step 4 `int.stage0.revise`; Permissions table unchanged; `test/e288-integrator-stage0.test.mjs` green unmodified)
AC-E334-1 — implemented — docs/lane-protocol.md:54 (`lp.s4.template-line` directly after `depends_on:`, inside the template block) and :61 (`lp.s4.target-repo` directly after the 「不要自己配 E 號」 bullet)
AC-E334-2 — implemented — docs/lane-protocol.md:62 (`lp.s4.commit` directly after `lp.s4.target-repo`)
AC-E334-3 — implemented — content/skill-integrator.md:191 (`int.stage6.findings` is the first sub-bullet under step 1, before `int.stage6.close`). Step 1's existing sentences and all e246 fragments are unchanged. `test/e246-mailbox-teardown.test.mjs` green unmodified.
AC-E327-1 — implemented — content/skill-qa-engineer.md:77 (`qa.hygiene` verbatim, same 3-space indent; no other line in the file changes)
AC-E327-2 — implemented — docs/lane-protocol.md §3 (line 41) is byte-identical to base, since the only lane-protocol hunk is in §4. `wc -c content/skill-qa-engineer.md` = 18253 (base 18066, +187), which is ≤ 18500. `test/qa-visual-skill-split.test.mjs` is green and unmodified.
AC-LANE-1 — qa scope (T-E329-02). Pre-check: none of the AC-LANE-1 protected test files or goldens appear in the diff. The targeted suite below shows the single expected red only.
AC-LANE-2 — implemented — `node scripts/fanout.mjs check specs/fanout-post-v4-w6.md e329 --base main` → 9 file(s) changed, 0 out of bounds, exit=0.

## Correctness
Factual claims, checked against the base code (902462e):
- **owners** (`runOwners` / `ownersOf` / `rangePaths` / `fail`, tools/fanout-manifest.ts:1728–1802, 1935–1983; scripts/fanout.mjs:5): the `owners <manifest> --range <a>...<b>` shape is correct. Exit 0 means no hit. Exit 1 means a HIT through an 擁有 token or the lane's implicit bookkeeping (`isImplicitBookkeeping`), which matches "its `擁有` cell or its own bookkeeping". Exit 2 is `fail()`: usage, an invalid range, `REF_NOT_FOUND`, `REPO_NOT_GIT`, or a fatal Lanes/row error. The range direction `<lane branch>...origin/<target>` gives what a merge of target into the lane brings in, which is correct.
- **validate** (`isManifestClosed` / `handoffSectionErrors` / `validateManifest`, tools/fanout-manifest.ts:745–887): the section is checked only when the closed status matches (`/^狀態[：:]\s*已結案/` after `**` is removed). Other wording (`結案 …`, `已合併`) is never checked. The rules match the code: exactly one section; each mandatory sub-item once and non-empty; the background sub-item a single line reading 無; optional and unknown sub-items not checked; the absolute-path check covers the heading and every line.
- **finish** (bin/agc-init.mjs:2005–2030, 2170–2232, 2340–2372, 3138–3150; tools/lane-ticket-allocation.ts:356–373, 471–572): a `target_repo` value must be non-empty when present (otherwise a parse error). Such a block is never numbered, is archived under `## Applied`, and gets one stderr line "needs a human ruling (file it in that repo)". A local `depends_on` naming a `target_repo` block is refused with "rewrite the reference as prose in body", and nothing is applied. A `pending-tickets.md` that is not committed at `--base` (shipped) is warned about and listed, and a copy is kept under `.current/history/<YYYY-MM>/<lane>/` in primary with the note "a human must file them". All of this matches `int.stage6.findings`, `lp.s4.target-repo` and `lp.s4.commit`.
- **Cross-references** in the new text resolve: "Stage 1 step 4" (skill-integrator.md:89), "5c-1" and "5c-5 close box" (skill-integrator.md:180,184), and the *Stage 0 only* Permissions row (skill-integrator.md:40).
- **E327 consistency**: lane-protocol §3 (line 41) allows a guarded historical diff, gives a shipped lane's own scope check as the example, requires a `git rev-parse --verify <sha>^{commit}` guard, and requires a loud skip. The new qa line names the same exception with the same guard and the same loud skip. The two documents no longer contradict each other (decision D1).

**Expected-Red Sampling (4a)**: `qa_reports/expected-red_e329-integrator-sop-followups.txt` holds 1 entry, and I sampled it. `test/e286-integrator-trust-and-git.test.mjs | AC1: human owns the vehicle decision; five conditions are an ordered numbered list with their commands` exists at test/e286-integrator-trust-and-git.test.mjs:50. A targeted run of e286, e288, e246, e296, qa-visual-skill-split, e297, e295, e178a, e177a and e130 gave 142 tests: 139 pass, 2 skip (e130's pre-existing loud history skips, unrelated), and 1 fail. The only failure is e286 AC1, with `base-fix: missing "git diff --name-only <lane branch>...origin/<target>"`, which is the removed literal that qa re-pins in T-E329-02. There are no unexplained reds.

- optional — content/skill-integrator.md:127: "exit 1 names each path a lane owns". At base, a git failure inside `rangePaths`' `git diff` (for example, no merge base) is an uncaught throw, so the process also exits 1 without HIT lines. The literal's conclusion, "either means the condition does not hold", still holds, and lane e284's E331 moves that case to exit 2. The spec already records this. No action.
- optional — content/skill-integrator.md:192: "進行中的背景工作 reads exactly 無" is slightly stricter than `readsNone`, which also accepts a leading list marker or a trailing `。`. The stricter wording is safe, because following it always passes validate. No action.

## Quality
No findings. Each insertion matches the surrounding list and indent conventions: sub-bullets use the 3-space continuation indent of step 1, and the template line keeps the block's comment-column style. The edits add no code comments, so the 4b comment check does not apply. The `#` lines in the expected-red manifest are data-file annotations.

## Architecture
No architecture spec exists (the spec's Chain section says there is no architect hop). There is no layering impact; these are SOP and doc wording edits only.

## Security
No findings. Constitution §6 information hygiene holds: the new text contains no absolute or machine-local path, no secret, and no internal link. `other-repo` and `<repo>` are placeholders, and history paths are repo-relative.

## Performance
No findings. Docs only. `content/skill-qa-engineer.md` grows by 187 bytes and stays under the 18500 cap. Neither edited SOP is part of a compose golden.

Same-model note: this review ran on opus, the same tier as the sr-engineer pin (`sr-engineer: opus`). That may mean shared blind spots. The mechanical verbatim check and the base-code checks are designed to be independent of the model.

## Verdict
APPROVED — all nine literals are verbatim at their specified placements, nothing else changed, every factual claim holds against base 902462e, and the only red is the declared e286 AC1 re-pin.
