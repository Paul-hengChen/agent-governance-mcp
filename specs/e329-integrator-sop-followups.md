# e329-integrator-sop-followups

Lane `e329` of `specs/fanout-post-v4-w6.md` (post-v4 wave 6, the wave's only content lane). Tickets: E329, E328, E334, E327. Sources: `docs/backlog.md` rows E327 / E328 / E329 / E334; the manifest's 派工前核對 bullets for those four tickets and the e329 Lanes row. Every command shape and behaviour the new SOP text cites was checked against the dispatch base (`902462e`), not the ticket text — see *Dependencies / Prerequisites → Verified at base*.

## Problem Statement
Four wording gaps left by wave 5. (E329) `fanout.mjs validate` checks a manifest's `## 接手步驟` section only when the status line reads `已結案` right after `狀態：`, but the integrator SOP never names that status line or the sub-item headings, so a close written as `結案 <date>` silently skips the check; and *Mid-wave base fix* condition 2 still asks for a hand comparison of `git diff --name-only` against every `擁有` cell although `fanout.mjs owners --range` now does it mechanically. (E328) Stage 0 says the cross-repo hand-off note becomes the manifest's first Decisions row but not which `裁決者` value it carries, and does not say that re-dispatching PM to revise the ticket-cut file is covered by the "Stage 0 only" permission row. (E334) `agc feature finish` already refuses to number a `target_repo` finding and warns when a lane's `pending-tickets.md` was never committed, but neither `docs/lane-protocol.md` §4 (the lane side) nor Stage 6 (the integrator side) says so. (E327) `docs/lane-protocol.md` §3 allows a guarded historical-SHA diff while the qa SOP's E323 line says "never diff against a fixed lane base sha" with no exception — the two contradict each other.

## User Stories
- As an integrator closing a wave, I want Stage 6 to name the exact status line and `## 接手步驟` headings `validate` checks, so that my close is actually validated instead of silently exempt.
- As an integrator running a mid-wave base fix, I want condition 2 to be one command with a defined exit code, so that I do not compare paths by hand.
- As an integrator running Stage 0, I want the SOP to name the hand-off note's `裁決者` and say a PM revision of the cut file is in my grant, so that I neither guess nor over-ask.
- As a lane writing findings, I want §4 to tell me about `target_repo` and that only a committed `pending-tickets.md` is numbered, so that no finding is lost at finish.
- As an integrator reading finish output, I want Stage 6 to say what to do with `target_repo` and unallocated-findings lines, so that each one reaches a human ruling or a backlog row.
- As a qa-engineer writing resident tests, I want one rule about historical SHAs that both documents state the same way, so that I know the one allowed shape.

## Acceptance Criteria

All `proof:` cases live in the new `test/e329-integrator-sop-followups.test.mjs` (qa task T-E329-02) unless stated otherwise; the case title starts with the AC id.

### E329 — Stage 6 close + Stage 4 condition 2
- **AC-E329-1** — Given `content/skill-integrator.md` `## Stage 6`, when it is read, then it contains the `int.stage6.close` literal: the canonical status line `**狀態：已結案 <日期>。…**`, the statement that validate treats only that wording as closed (other wording never checked), one `## 接手步驟` section, the four mandatory `### ` sub-items in the order 核對 primary, 已結案, 待人類決定, 進行中的背景工作, the rule that 進行中的背景工作 reads exactly 無, the optional 裝置 and 工具, no machine-local absolute path, and `node scripts/fanout.mjs validate <manifest>` exiting 0 before step 2's push.
  proof: `node --test --test-name-pattern="AC-E329-1" test/e329-integrator-sop-followups.test.mjs`
- **AC-E329-2** — Given the base implementation, when the Stage 6 text is compared with `HANDOFF_SUBITEMS` and `HANDOFF_SECTION` exported by `dist/tools/fanout-manifest.js`, then every mandatory heading name and the section name in the SOP equal the exported values (the SOP names no mandatory heading the tool does not require, and none the tool requires is missing).
  proof: `node --test --test-name-pattern="AC-E329-2" test/e329-integrator-sop-followups.test.mjs`
- **AC-E329-3** — Given `### Mid-wave base fix`, when condition 2 (the line starting `2. `) is read, then it carries the `int.basefix.cond2` literal: `node scripts/fanout.mjs owners <manifest> --range <lane branch>...origin/<target>` exits 0; exit 1 (a lane-owned path) or exit 2 (usage, manifest or git error) means the condition does not hold; the insertion-lane `node scripts/fanout.mjs check <manifest> <insertion lane> --base <dispatch base>` clause is kept; and the literal `git diff --name-only <lane branch>...origin/<target>` no longer appears anywhere in the file. Conditions 1–5 stay an ordered numbered list; the *Condition 2 or 4* stop sentence and the Decision rights row are unchanged.
  proof: `node --test --test-name-pattern="AC-E329-3" test/e329-integrator-sop-followups.test.mjs` plus `node --test test/e286-integrator-trust-and-git.test.mjs` (re-pinned AC1) green.

### E328 — Stage 0 decider + re-dispatch grant
- **AC-E328-1** — Given `## Stage 0`, when the cross-repo hand-off note paragraph is read, then it contains the `int.stage0.decider` literal naming `裁決者` `人類` for the note's Decisions row, and the existing `出處` sentence is byte-identical.
  proof: `node --test --test-name-pattern="AC-E328-1" test/e329-integrator-sop-followups.test.mjs`
- **AC-E328-2** — Given `## Stage 0`, when its numbered steps are read, then a step 4 carries the `int.stage0.revise` literal: re-dispatching PM via Task to revise `specs/ticket-cut-<feature>.md` falls under the *Stage 0 only* permission row, with the same limits; and the `## Permissions` table is unchanged (5 body rows, the e288 `PERM_ROW` verbatim).
  proof: `node --test --test-name-pattern="AC-E328-2" test/e329-integrator-sop-followups.test.mjs` plus `node --test test/e288-integrator-stage0.test.mjs` green unchanged.

### E334 — target_repo + unallocated findings
- **AC-E334-1** — Given `docs/lane-protocol.md` §4, when it is read, then the `pending-ticket` template block shows an optional `target_repo:` line (`lp.s4.template-line`), and a bullet (`lp.s4.target-repo`) says: the finding belongs to another repo, gets no id here, is still moved under `## Applied`, is listed on stderr for a human ruling, must be non-empty when present, and may not be named in another block's `depends_on` (finish refuses; write it as prose in `body`).
  proof: `node --test --test-name-pattern="AC-E334-1" test/e329-integrator-sop-followups.test.mjs`
- **AC-E334-2** — Given §4, when it is read, then a bullet (`lp.s4.commit`) says a `pending-tickets.md` never committed to the branch is not numbered: finish warns, lists its findings, and keeps a copy under `.current/history/<YYYY-MM>/<lane>/` in primary (not committed), and the integrator files them by hand.
  proof: `node --test --test-name-pattern="AC-E334-2" test/e329-integrator-sop-followups.test.mjs`
- **AC-E334-3** — Given Stage 6 step 1, when it is read, then a sub-bullet (`int.stage6.findings`) says the integrator gets a human ruling on each `target_repo` finding finish lists (recorded as a Decisions row) and hand-files each warned unallocated finding as a full `docs/backlog.md` row (5c-1), both before step 2's push; and every e246-pinned Stage 6 fragment (`reset`, `never reused`, `by hand`, `stop the mailbox watch`, `removes the default-location mailbox`) and the §5 sentence `信箱在 \`agc feature finish\` 拆除 lane 時才會刪除` are unchanged.
  proof: `node --test --test-name-pattern="AC-E334-3" test/e329-integrator-sop-followups.test.mjs` plus `node --test test/e246-mailbox-teardown.test.mjs` green unchanged.

### E327 — one historical-SHA rule
- **AC-E327-1** — Given `content/skill-qa-engineer.md` SOP item `f. **Resident-test hygiene**`, when it is read, then it equals the `qa.hygiene` literal (the E323 sentence plus the one named exception: a closed historical range, both ends fixed shas, guarded by `git rev-parse --verify <sha>^{commit}` and skipped loudly), and nothing else in that file changes.
  proof: `node --test --test-name-pattern="AC-E327-1" test/e329-integrator-sop-followups.test.mjs`
- **AC-E327-2** — Given `docs/lane-protocol.md` §3, when the 常駐測試 bullet is read, then it is byte-identical to the base (decision D1 below: the qa line names the exception; §3 is not narrowed), and `content/skill-qa-engineer.md` stays ≤ 18500 bytes with the cap in `test/qa-visual-skill-split.test.mjs` unchanged.
  proof: `node --test test/qa-visual-skill-split.test.mjs` green with the file unmodified; `wc -c content/skill-qa-engineer.md` ≤ 18500 (expected ≈ 18253).

### Lane-wide
- **AC-LANE-1** — Given the committed lane HEAD, when the full suite runs, then it is green, with `test/e296-manifest-tier.test.mjs`, `test/e177a-manifest.test.mjs`, `test/e297-main-protected-sop.test.mjs` and `test/e295-hop-cap-and-sop-halves.test.mjs` unmodified, and `test/fixtures/compose-golden/**` + `test/context-budget.test.mjs` unmodified (neither edited SOP is part of any golden — measured at base).
  proof: `node scripts/test-lock.mjs -- npm test` on the committed HEAD with a clean `git status --porcelain`; `git diff --stat 902462e...HEAD -- test/e296-manifest-tier.test.mjs test/fixtures/compose-golden test/context-budget.test.mjs` prints nothing.
- **AC-LANE-2** — Given the lane branch, when `node scripts/fanout.mjs check specs/fanout-post-v4-w6.md e329 --base main` runs, then it exits 0.
  proof: that command, `echo "exit=$?"` → `exit=0`.

## Copy / Strings

All literals are SOP text the agent reads (no end-user UI). sr-engineer inserts each one verbatim — the text between the double-backtick delimiters, one line each, with the placement stated in the source cell; a wording change needs a PM amendment. Sub-bullets under Stage 6 step 1 are indented three spaces (`   - `), matching that list's continuation indent.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| int.stage6.findings | `` - **Findings finish did not number**: finish lists on stderr each `target_repo` finding (another repo's; archived under `## Applied`, no id here) and warns when a lane's `pending-tickets.md` was never committed at `--base` (its findings unnumbered, a copy kept under `.current/history/<YYYY-MM>/<lane>/`). Get the human's ruling on each `target_repo` finding and record it as a Decisions row; hand-file each warned unallocated finding as a full `docs/backlog.md` row (5c-1). Both before step 2's push. `` | Placement: first sub-bullet under Stage 6 step 1. E334 backlog row; behaviour from `formatUnallocatedWarning` / `printTargetRepoListing` in `bin/agc-init.mjs` at base; authored-here (English rendering) |
| int.stage6.close | `` - **Close the manifest** (the 5c-5 close box, in the bookkeeping commit): its status line reads `**狀態：已結案 <日期>。…**` — `node scripts/fanout.mjs validate` treats a manifest as closed only when the status text starts `已結案` right after `狀態：`, so any other wording (`結案 <日期>`, `已合併`) is never checked. A closed manifest carries one `## 接手步驟` section whose `###` sub-items are 核對 primary, 已結案, 待人類決定 and 進行中的背景工作 (each once and non-empty; 進行中的背景工作 reads exactly 無), optionally 裝置 and 工具, with no machine-local absolute path in the section. `node scripts/fanout.mjs validate <manifest>` exits 0 before step 2's push. `` | Placement: second sub-bullet under Stage 6 step 1. E329 backlog row; heading set from `HANDOFF_SUBITEMS` / `STATUS_CLOSED_RE` in `tools/fanout-manifest.ts` at base; authored-here (English rendering) |
| int.basefix.cond2 | `` 2. Nothing the merge brings in is lane-owned: `node scripts/fanout.mjs owners <manifest> --range <lane branch>...origin/<target>` exits 0 — exit 1 names each path a lane owns through its `擁有` cell or its own bookkeeping, exit 2 is a usage, manifest or git error, and either means the condition does not hold; when the fix came through an insertion lane listed in the manifest, `node scripts/fanout.mjs check <manifest> <insertion lane> --base <dispatch base>` exits 0. `` | Placement: replaces the whole current condition-2 line of *Mid-wave base fix*. E329 backlog row; command shape and exit codes from `runOwners` / `ownersOf` / `rangePaths` in `tools/fanout-manifest.ts` at base; authored-here |
| int.stage0.decider | `` Its `裁決者` is `人類`: the human settled the contract and carries the note here; you only record it. `` | Placement: appended (after one space) to the end of the existing *Cross-repo hand-off note* paragraph, after the `出處` sentence. E328 backlog row (a); value per decision D2; authored-here |
| int.stage0.revise | `` 4. **Revising the cut**: when a ticket from a Stage 0 cut goes back to PM (Stage 1 step 4), re-dispatch PM via Task to revise `specs/ticket-cut-<feature>.md` — the *Stage 0 only* permission row covers it, with the same limits (that file only); the revised file is presented with the manifest at Stage 2 like the first one. `` | Placement: new step 4 after Stage 0 step 3. E328 backlog row (b); authored-here |
| lp.s4.template-line | `` target_repo: other-repo           # 選填：只在這筆發現屬於別的 repo 時寫 `` | Placement: inside the `pending-ticket` template block, directly after the `depends_on:` line. E334 backlog row; field name from `tools/lane-ticket-allocation.ts` at base; authored-here |
| lp.s4.target-repo | `` - **選填 `target_repo: <repo>`**：這筆發現屬於別的 repo。finish 不在本 repo 配號，照樣把它移到 `## Applied` 之下，並在 stderr 列出、等人類裁決（由整合者到那個 repo 建票）。有寫就不能是空值；本 repo 的其他 block 不能在 `depends_on` 引用它（finish 會拒絕），要提就寫進 `body`。 `` | Placement: §4, directly after the 「不要自己配 E 號」 bullet. E334 backlog row; refusal from the `unresolvedDependencies` handling in `bin/agc-init.mjs` at base; authored-here |
| lp.s4.commit | `` - **`pending-tickets.md` 一定要 commit 進你的 branch**：只存在 worktree、從未 commit 的檔案不會配號 —— finish 警告並列出這些發現，在 primary 的 `.current/history/<YYYY-MM>/<lane>/` 留一份（不 commit），由整合者手動建票。 `` | Placement: §4, directly after `lp.s4.target-repo`. E334 backlog row; behaviour from `readUnallocatedFindings` / `formatUnallocatedWarning` in `bin/agc-init.mjs` at base; authored-here |
| qa.hygiene | `` f. **Resident-test hygiene**: assert only the stable structure of a real, growable file (e.g. `specs/fanout-*.md`) or use a frozen in-test fixture; never diff against a fixed lane base sha. One exception: a closed historical range (both ends fixed shas, e.g. a shipped lane's own scope check), guarded by `git rev-parse --verify <sha>^{commit}` and skipped loudly when absent. `` | Placement: replaces the current SOP item f. line (same leading indent as today); +187 bytes. E327 backlog row; decision D1; exception shape mirrors `docs/lane-protocol.md` §3 and `test/e130-lane-default.test.mjs` |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- Constitution fragments, coordinator SOP, `content/skill-pm.md`.
- SOP text citing `fanout.mjs handoff` (E285); the Stage 6-5 final-report rewrite (E285).
- Generic rewrite of `docs/lane-protocol.md` (E290); its §1 node_modules paragraph.
- `docs/lane-protocol.md` §5-2 and skill-integrator Stage 2 sentences pinned by `test/e296-manifest-tier.test.mjs` (hard: not touched).
- Narrowing `docs/lane-protocol.md` §3 (decision D1 rejects it).
- Any change to `tools/**`, `bin/**`, `scripts/**` — the SOP follows the base implementation as it is.
- The `## Permissions` table of skill-integrator (E328 is stated in Stage 0 text only, so the e288-pinned row stays verbatim).

## Dependencies / Prerequisites

None blocking. No `design/<feature>.md` (mode = no-design), so Visual Structural Assertions are omitted. No external references (Resource Audit: the four backlog rows and the manifest cite only repo paths).

### Verified at base (`902462e`)
- **validate's closed check** (`tools/fanout-manifest.ts`): `STATUS_CLOSED_RE = /^狀態[：:]\s*已結案/` on the first `狀態` line before the first `## ` heading, after removing `**`; `HANDOFF_SECTION = "接手步驟"`; `HANDOFF_SUBITEMS = ["核對 primary", "已結案", "待人類決定", "進行中的背景工作"]` (presence once + non-empty; order not enforced); 進行中的背景工作 must read `無` (optional list marker / trailing `。` allowed); 裝置 / 工具 and unknown sub-items are not checked; any machine-local absolute path in the section fails. The ticket's heading set matches exactly.
- **owners** (`scripts/fanout.mjs` → `runOwners`): `owners <manifest> (--range <a>...<b> [--repo <dir>] | --paths <file|->)`; `--range` takes exactly one `...`; paths = `git diff --no-renames --name-only <a>...<b>` (committed changes on `<b>` since its merge-base with `<a>` — what a merge of `<b>` into `<a>` brings in); `--repo` defaults to the repo holding the manifest. Exit 0 = no path owned by any dispatchable lane (擁有 token or the lane's implicit bookkeeping), 1 = at least one hit, 2 = usage / input / manifest (Lanes or row) error. Provisional lanes are reported as not checked. `owners` is absent from the generic USAGE text at base (E330, lane e284, adds it — no conflict: the SOP cites the subcommand, not the USAGE text).
- **finish** (`bin/agc-init.mjs` + `tools/lane-ticket-allocation.ts`): a block with `target_repo` (non-empty string when present, else a parse error) gets no id, is archived under `## Applied`, and gets one stderr line ending `needs a human ruling (file it in that repo)`; a local block whose `depends_on` names a `target_repo` block is an unresolved dependency and finish refuses (nothing applied, nothing removed). A `pending-tickets.md` present in the worktree but not at the revision finish reads (`--base` for `--shipped`, the branch for `--abandoned`) is not numbered: finish prints a warning listing its findings and keeps a verified fs copy (not committed) under `.current/history/<YYYY-MM>/<lane>/` in primary — "a human must file them".

### Decisions (presented with the cut; the human approves them with it)
- **D1 — E327: name the exception in the qa line; do not narrow §3.** Reasoning: the only resident historical-SHA test, `test/e130-lane-default.test.mjs`, diffs a *closed* range (`121ddc8..5896bdd`, both ends fixed), which never grows — it is not the rot E323 targets (a fixed base against a moving HEAD / working tree). Narrowing §3 to forbid it would leave that non-owned test out of policy with no lane to fix it; naming the one exception in the qa line makes both documents state the same rule and costs +187 bytes (18066 → ≈ 18253, under the 18500 cap). **No cap change needed** — `test/qa-visual-skill-split.test.mjs` stays untouched.
- **D2 — E328: the hand-off note's Decisions row has `裁決者` `人類`.** The note carries a contract the human settled and the human carries its path into this repo; the integrator only records it. `裁決者` records who decided, never who executed (Decision rights), so `整合者` would misstate it.
- **D3 — Stage 6 placement.** Both new Stage 6 items are sub-bullets under step 1 (findings first, then the manifest close), so steps 1–7 keep their numbers and the e296 AC6 step-4 range (`^4\. Wait for the merge` … `^5\. \`git switch main\``) is untouched.

### Pinned text this cut touches (re-pin list for qa)
- `test/e286-integrator-trust-and-git.test.mjs` AC1 — pins `"git diff --name-only <lane branch>...origin/<target>"` in the base-fix need-list and `assert.match(item(2), /git diff --name-only/)`. **Re-pin required** (owned): replace with `fanout.mjs owners <manifest> --range <lane branch>...origin/<target>` and `/fanout\.mjs owners/`; keep `/fanout\.mjs check/` on item 2 and every other literal.
- `test/e288-integrator-stage0.test.mjs` — Stage 0 literals, `出處` regex, `PERM_ROW`, 5 Permissions body rows: must stay green **unchanged** (the edits only append).
- `test/e246-mailbox-teardown.test.mjs` — Stage 6 fragments `reset`, `never reused`, `by hand`, `stop the mailbox watch`, `removes the default-location mailbox`; lane-protocol `信箱在 \`agc feature finish\` 拆除 lane 時才會刪除`: green **unchanged** (no re-pin needed; step 1's sentences are not edited).
- `test/e296-manifest-tier.test.mjs` (**not owned, hard: unchanged**) pins: AC4 lane-protocol `check --cut` (≥1), `信箱**永遠不傳核准**` (exactly 1 line), `不要 push、不要 merge、不要發版、不要刪 worktree` (exactly 1 line); AC5 Stage 2 `` `approval` `` and `human`; AC6 Stage 6 step-4 range — `verify-release.mjs --ci-check --sha <HEAD>` exactly once in it, `the full suite, and a push` absent, `merge-invariants.mjs` before `verify-release.mjs --ci-check`, `CI fallback` present, and `cannot reach \`main\`` exactly 1 line in the whole file; AC14 line 2 `recommended_model: opus`, no `fable, with opus as the fallback`. New text must not repeat any exactly-once literal.
- `test/e297-main-protected-sop.test.mjs` AC1/AC2/AC10, `test/e295-hop-cap-and-sop-halves.test.mjs` AC5–AC7/AC10 (`例如 7/14` once, `7/10` absent, the no-push line once, `cannot reach \`main\`` once, `npm run check:bookkeeping` once inside 5c), `test/e178a-integrator-role.test.mjs` AC11/AC14 (§3 task-id and §5 sentences): green **unchanged**.
- `test/e177a-manifest.test.mjs` AC7 (not owned): no non-blank lane-protocol line over 20 chars may appear in a rendered prompt — the new §4 lines must not duplicate prompt-template text (they don't; qa confirms by the full suite).
- Goldens / budget: neither `content/skill-integrator.md` nor `content/skill-qa-engineer.md` is embedded in any `test/fixtures/compose-golden/*.txt` (measured: 0 hits for their edited text), so no regen is expected; regen + explain only if red.

### Dependencies / Findings filed
- **Exports the new test depends on**: `test/e329-integrator-sop-followups.test.mjs` (AC-E329-2) imports `HANDOFF_SUBITEMS` and `HANDOFF_SECTION` from `dist/tools/fanout-manifest.js`. `tools/fanout-manifest.ts` belongs to lane e284 this wave; the integrator asks e284 to keep those two export names stable.
- **`int.basefix.cond2` wording vs E331**: lane e284's E331 moves `owners --range` git failures (e.g. no merge base) from exit 1 to exit 2, so the literal says exit 2 is "a usage, manifest or git error" — true both at base and after the e284 merge (integrator pre-review).
- No other lane is needed. One finding filed in `.current/e329/pending-tickets.md` (`E329-NEW-1`): the `HANDOFF_SUBITEMS` doc comment in `tools/fanout-manifest.ts` says "in order" but validate does not enforce order (tools/** is forbidden to this lane).

### Chain
Chain: pm → sr-engineer (T-E329-01, T-E328-01, T-E334-01, T-E327-01 in one session; the three skill-integrator tasks run serially in the listed order) → code-reviewer → qa-engineer (T-E329-02). No architect hop: wording edits in three files, no new module, data model or API.

## Cut
| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E329-01 | sr-engineer: skill-integrator *Mid-wave base fix* condition 2 → `int.basefix.cond2` verbatim (whole line replaced); Stage 6 step 1 sub-bullet `int.stage6.close` verbatim; nothing else in Stage 4 / Stage 6 / Decision rights (AC-E329-1..3) | none | 1 | `content/skill-integrator.md` | — |
| T-E328-01 | sr-engineer: skill-integrator Stage 0 — append `int.stage0.decider` to the hand-off note paragraph, add step 4 `int.stage0.revise`; Permissions table untouched (AC-E328-1..2) | T-E329-01 | 1 | `content/skill-integrator.md` | — |
| T-E334-01 | sr-engineer: lane-protocol §4 — template line `lp.s4.template-line`, bullets `lp.s4.target-repo` + `lp.s4.commit`; skill-integrator Stage 6 step 1 sub-bullet `int.stage6.findings` (before `int.stage6.close`); no edit outside §4 of lane-protocol, step 1's existing sentences unchanged (AC-E334-1..3) | T-E328-01 | 2 | `docs/lane-protocol.md`, `content/skill-integrator.md` | — |
| T-E327-01 | sr-engineer: skill-qa-engineer SOP item f. → `qa.hygiene` verbatim, nothing else in that file; lane-protocol §3 untouched (D1) (AC-E327-1..2) | none | 1 | `content/skill-qa-engineer.md` | — |
| T-E329-02 | qa-engineer: new `test/e329-integrator-sop-followups.test.mjs` (AC-E329-1..3, AC-E328-1..2, AC-E334-1..3, AC-E327-1..2, one case per AC, AC-E329-2 imports `HANDOFF_SUBITEMS` / `HANDOFF_SECTION` from `dist/`); re-pin e286 AC1 condition-2 literals only; confirm goldens / budget / qa cap unchanged; full suite on committed HEAD (AC-LANE-1..2) | T-E329-01, T-E328-01, T-E334-01, T-E327-01 | 2 | `test/e329-integrator-sop-followups.test.mjs`, `test/e286-integrator-trust-and-git.test.mjs` | — |
