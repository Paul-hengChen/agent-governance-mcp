# Review — T-E403-01 (batched: E403 + E407 content edits)

covers: T-E403-01, T-E407-01, T-E407-02, T-E407-03, T-E407-04

Diff: commit d9e953e, read as `git diff 1000517 HEAD -- content/` (lane base `1000517`).
Contract: `specs/e403-lean-dispatch-alias.md` (AC1–AC12, Site map, Copy / Strings). No
architecture spec exists for this feature (mini-chain, no architect).

## Round 1 — APPROVED — by code-reviewer

## Summary
- Five sentence-level text edits in five `content/` files (8 insertions, 16 deletions): the coord-03
  Fallback disjuncts become host-neutral (E403), and four skill sites that restated a constitution
  rule now carry a role-specific trigger plus a named citation of that rule (E407).
- Every new string is byte-exact to its Copy / Strings entry, and nothing else on any touched line
  moved. Checked by direct string comparison of each line against the spec text, not by eye.
- Each citation resolves to a rule that exists under the cited name and section in every
  composition that loads the site. Checked on the built `dist/` via `composeConstitution` for all four
  `{chain, design}` combinations and via `composeSkill` for the no-host, `cursor` and `claude-code`
  profiles.
- No dropped text carries a role-specific instruction that the cited rule lacks.
- Verdict: APPROVED. Three findings, all `optional`.

## AC Completeness
Scope: this round reviews the five sr-engineer build tasks. AC3, AC8, AC10, AC11 and AC12 are owned
by the qa tasks T-E403-02, T-E407-05 and T-E407-06, so this round judges only the content half of
each.
AC1 — implemented — `content/coord-03-core-fallback.md:1`. In the no-host and `cursor` compositions
the Fallback paragraph contains `coord03.fallback` verbatim and has no `` `Task` ``, no `Task(` and
no bare `Task` word.
AC2 — implemented — in the `claude-code` composition coord-02's alias sentence sits at composed line
80 and the coord-03 Fallback at line 119, so the alias comes first, and both use the noun
`subagent-dispatch tool`. `content/coord-02-host-dispatch.md` is not in the lane diff, so it is
byte-identical to the base. coord-02's forward pointer "the Fallback below" still resolves.
AC3 — partial, owned by qa (T-E403-02) — the content side is done. `t-fallback-genuine-unavailability`
is red as the spec predicts (stale regex) and `t-fallback-self-contained` is green.
AC4 — implemented — `content/coord-05-core-visual-drift.md:18-21`. The heading at line 16 is
unchanged, the body equals `coord05.drift` exactly, and the file ends with that body plus a single
blank line. The section has no numbered list and no `handoff-ahead` / `vibe drift` / `tw_sync` text.
`Sequential-context assumption + reconcile` occurs exactly once in both `{chain:true, design:true}`
and `{chain:true, design:false}`. Lines 1–15 (Visual Verdict Boundary) are outside the hunk.
AC5 — implemented — `content/skill-coordinator-lite.md:20` equals `lite.hopcap`. The Limits `hop`
cap row ("lite mode exempt") and `## 5. Anti-Loop Circuit Breaker` ("Lite mode is exempt") are both
present in `{chain:false, design:true}` and `{chain:false, design:false}`.
AC6 — implemented — `content/skill-qa-engineer.md:13` equals `qa.ownership`.
`` **`tw_complete_task` ownership** `` appears once, under `## 3. State Synchronisation`, in all four
compositions.
AC7 — implemented — `content/skill-integrator.md:38` equals
`| <integrator.row1.can> | <integrator.row1.cannot> |`. The `| can | cannot |` header (line 36) and
rows 2–5 are unchanged, and `test/e178a-integrator-role.test.mjs` is green. §6 in
`content/const-15-core-tail.md:12-15` still lists the grant.
AC8 — partial, owned by qa (T-E407-05) — the content side is done. `AC-E336-1` is red as the spec
predicts, because the row no longer contains `` `pull --ff-only` on `main` ``.
AC9 — implemented — `git diff --stat 1000517 HEAD -- content/ tools/ prompts/ dist/ test/` lists
exactly the five files. The hunks sit at coord-03:1, coord-05:18-29, lite:20, qa:13 and
integrator:38. No `const-*`, `tools/**`, `prompts/**`, `dist/**` or `test/**` file changed, and
`npm run build` leaves `dist/` with no diff.
AC10 — qa-owned (T-E407-06) — `t-golden-byte-identity` is red as predicted. `compose-equivalence`
(the 11 constitution and hook goldens) is green, which fits the absence of any `const-*` change.
AC11 — qa-owned (T-E407-06) — `test/context-budget.test.mjs` is green on the patched tree, and no
cap literal changed (the file is outside the diff).
AC12 — qa-owned (T-E407-06) — not run in this round. That is qa's final full-suite gate.

## Correctness
No `required` findings.

Citation accuracy (point 2 of the brief), checked on the composed output:
- coord-05 → §3 *Sequential-context assumption + reconcile* (R10). The rule is the
  `content/const-12-chain-r10-s4.md:1` bullet and loads in every chain composition. coord-05 loads
  only in the coordinator SOP, and `prompts/build.ts:444` composes that with `chain: !isLite`, so the
  rule is always loaded next to the citation. It renders under `### 3.1` when design is off and under
  `### 3.2` when design is on. Both are subsections of §3, so "§3" is accurate either way.
- lite → Limits / §5. `content/const-01-core-head.md:17` reads "(lite mode exempt)" and
  `content/const-15-core-tail.md:6` reads "Lite mode is exempt (no auto-routing)". Both are core
  fragments.
- qa → §3 *`tw_complete_task` ownership*. The rule is `content/const-05-core-standards.md:18`, under
  `## 3. State Synchronisation`, and is core.
- integrator → §6. `content/const-15-core-tail.md:12` holds the base list (including `git fetch`)
  and the forbidden set (`reset`, `rebase`, `clean`, force-push, `checkout --force`,
  `checkout -- <file>`). Line 13 forbids `commit --amend`. Line 14 covers `pull --ff-only` on `main`.
  Line 15 is the integrator-only grant: `merge`, `switch -c`, `switch <existing-branch>`,
  `worktree remove`, `branch -d`, compare-and-delete `update-ref`, `gh pr create`, and
  `gh pr merge --auto --merge` with "never `--squash` / `--rebase` / `--admin`". Every verb from the
  old row is still listed in §6.

Information-loss check (point 3 of the brief): for each site, the old text was compared with the
cited rule plus whatever stays in the SOP.
- coord-05: §3 R10 already says to run `tw_detect_drift`, to `tw_sync` on handoff-ahead drift
  (bookkeeping only), never to promote a `tasks.md`-only `[x]`, and to send vibe drift to qa or
  `tw_rollback_task`. The coordinator-specific trigger (background or parallel subagents, or a role
  run inline) and the "never hand-edit `tasks.md` checkboxes" rule both stay in the SOP. The dropped
  "use `tw_sync` (authoritative) or the qa PASS path" is also in const-05:17 and R10. Nothing is lost.
- lite: the dropped "server-read-only" is still in its own bullet at
  `content/skill-coordinator-lite.md:16`, and the reason `hop_count` never moves is kept in the
  parenthetical. Nothing is lost.
- integrator: nothing is lost, as listed above. The new `cannot` cell, "every git verb Constitution §6
  forbids", also brings in `stash drop` / `stash clear`, which §6 already forbids. That is accurate,
  not a change in behaviour.
- qa: see the `optional` finding Q1.

Host-neutral reading (point 4 of the brief): in the no-host and `cursor` compositions the Fallback
names "subagent-dispatch tool" and "dispatch call", which any host can check. In the `claude-code`
composition the same noun was defined 39 lines earlier by coord-02 (`Task(...)` is shorthand for
"Claude Code's subagent-dispatch tool, named `Agent`"), so the meaning there is the same as before.

Test run (`node --test` on 11 related files, built tree): 174 pass, 3 fail. The three failures are
the tests the spec's *pin audit* table predicts: e96 `t-fallback-genuine-unavailability`,
skill-manifest `t-golden-byte-identity (AC1/AC5)` and e336 `AC-E336-1`. Each is named at a real
location (`test/e96-dispatch-preference.test.mjs:86`, `test/skill-manifest.test.mjs:101`,
`test/e336-portable-pull.test.mjs:68`). They are stale pins or a golden, and the spec gives each one
to a qa task in its Cut. They are not defects in this diff.

- `recommended` R1 (SOP step 4a). `qa_reports/expected-red_e403-lean-dispatch-alias.txt` does not
  exist, although three reds are known and intended. This does not block approval: the spec's
  *Test files: pin audit* table is the structured `file | test | action` record those reds need, all
  three entries were sampled and found at the locations above, and the chain is in feature mode, not
  bugfix mode, so no gate reads that manifest. qa may still record it at the start of T-E403-02 /
  T-E407-05 so the red set is pinned in machine-readable form.

## Quality
- `optional` Q1 — `content/skill-qa-engineer.md:13`. The dropped clause "Sr-engineer never flips
  these" covered both tools. The cited §3 *`tw_complete_task` ownership* rule (const-05:18, "ONLY
  qa-engineer flips the final `[x]`") covers `tw_complete_task` only. Nothing in the constitution
  makes `tw_rollback_task` exclusive to qa. The bullet still says "You own … `tw_rollback_task`", so
  qa's own instruction is unchanged, and the dropped clause told qa nothing it acts on. The copy is
  verbatim and set by the human ruling, so this is a note on citation coverage, not a defect.
- `optional` Q2 — `content/skill-integrator.md:38`. "every git verb Constitution §6 forbids" reads as
  git-only, while `gh pr merge --squash` / `--rebase` / `--admin` are `gh` exclusions written as
  "never" inside the grant. The `can` cell's "integrator-only grant (enumerated there, not here)"
  points to the same §6 line, so the exclusions are still in force. The wording is the verbatim
  ruling-2 string. Recorded for a future wording pass only.
- No comments were added (SOP step 4b: nothing to check).

## Architecture
No architecture spec for this feature. Layering is unchanged: each rule is still stated once, in the
constitution, and the SOP sites point to it. This is the direction E407 asks for. The site
fragments' composition tags did not change.

## Security
No findings. The diff is prose only and adds no input path, secret or trust boundary. The integrator
row's permission meaning is unchanged, since the grant and forbidden set are still fully stated in
§6.

## Performance
No findings. Every measured prompt budget shrinks or stays the same (`test/context-budget.test.mjs`
is green and no cap changed). No code paths changed.

- `optional` P1 (process). sr-engineer and code-reviewer are both pinned to opus (`dispatch_pins`),
  so the two passes may share blind spots. This was partly offset by checking every claim
  mechanically against the composed output. Note: the sr-engineer `pending_notes` were visible in
  the mandatory `tw_get_state` result. The verdict rests only on the diff, the spec and the composed
  output.

## Verdict
APPROVED — all five strings are byte-exact at their mapped lines, each citation resolves under its
name and section in every composition that loads the site, no role-specific instruction was lost,
and the only reds are the three the spec gives to qa tasks.
