# e286-integrator-trust-and-git

Lane e286 of the post-v4 wave 4 fan-out (`specs/fanout-post-v4-w4.md`). Ticket E286 (integrator revision wave 1: §3.1 Q5, Q7; §3.2; §4 O4, O5, O8, O10 of `docs/integrator-revision-2026-10-08.md`), with E282 folded in by human ruling (2026-10-15, manifest Decisions). Scope is the manifest's e286 row; it is not widened or narrowed here.

## Problem Statement

The integrator SOP (`content/skill-integrator.md`) has no sanctioned way to get a mid-wave fix to the shared base into running lanes: merging the target branch into a lane is inside the §6 grant (`git merge --no-ff`) but no step says when it is safe, and the grant has no `merge --abort`, so a merge that conflicts halfway has no legal way back. The lane protocol (`docs/lane-protocol.md`) has no matching pause rule, and lane comment-proof scripts compute scope against the fixed dispatch base, so the files such a merge brings in show up as a false scope violation (E282). Three trust gaps sit beside it: the SOP gives no rule for when a human approval typed in a lane session may be recorded without re-asking (O10); it does not say what the Decisions table's `裁決者` column records, so rows have named the executor instead of the decider (O4); and its mailbox watch globs every lane folder under the shared mailbox root, so a second integrator session with its own manifest would watch lanes it does not own (O5).

## User Stories

- As the integrator, I want a mid-wave base-fix step with five checkable conditions, so that I merge a fix into a lane only when the merge cannot conflict, cannot touch lane-owned work, and cannot catch the lane mid-edit.
- As a lane session, I want a pause rule, so that I know how to reach a clean, acknowledged stop, what not to do while paused, and how I learn the merge is done.
- As a lane's qa or proof script, I want scope computed against the merge-base after a target-branch merge, so that files the merge brought in are not reported as my scope violation.
- As the integrator, I want a three-part test for lane-session approvals, so that I stop re-asking the human for decisions already written and visible on the lane branch, and still ask for anything else.
- As anyone reading a manifest's Decisions table, I want `裁決者` to name who decided, so that the audit trail separates the decision from its execution.
- As one of two concurrent integrator sessions, I want to watch only my own manifest's mailboxes, so that two sessions never answer the same lane.

## Acceptance Criteria

Section extracts below use `sec() { awk -v h="$1" 'index($0,h)==1{f=1;print;next} f&&/^##/{exit} f' "$2"; }` (prints from the heading line up to the next heading of any level) and `need() { s=$(sec "$1" "$2"); shift 2; for p in "$@"; do printf '%s' "$s" | grep -qF -- "$p" || echo "missing: $p"; done; }` (prints one line per fixed string absent from the extract).

- **AC1 (O8, integrator step)** — Given `content/skill-integrator.md`, when it is read, then it has a subsection `### Mid-wave base fix` (inside `## Stage 4`, after its bullet list) that: says opening an insertion lane (or any other vehicle for the fix) is the human's decision; lists, as a numbered list in this order, the five conditions that must all hold before the integrator merges the target branch into a lane — (1) the fix is merged into the target branch and pushed (verified after `git fetch`, e.g. `git merge-base --is-ancestor <fix sha> origin/<target>`); (2) nothing the merge brings in is lane-owned: every path in `git diff --name-only <lane branch>...origin/<target>` falls outside every lane's `擁有` cell, and when the fix came through an insertion lane listed in the manifest, `node scripts/fanout.mjs check <manifest> <insertion lane> --base <dispatch base>` exits 0; (3) the lane has paused and acked (lane-protocol §7) and the integrator verifies `git -C <worktree> status --porcelain` is empty and the lane branch sha equals the acked sha; (4) `git merge-tree --write-tree <lane branch> origin/<target>` exits 0 on git 2.38 or newer — exit 1 (conflict), any other exit, or an older git counts as a predicted conflict, because the grant has no `merge --abort`; (5) after `git -C <worktree> merge --no-ff origin/<target>`: `node scripts/merge-invariants.mjs`, the lane's `npm run build` and `npm audit --audit-level=high`, a resume notice to the lane, and one Decisions row; and says the conditions are checked per lane, one lane at a time.
  proof: `need '### Mid-wave base fix' content/skill-integrator.md 'insertion lane' 'merge-base --is-ancestor' 'fanout.mjs check' 'status --porcelain' 'git merge-tree --write-tree' '2.38' 'merge --abort' 'merge --no-ff origin/<target>' 'merge-invariants.mjs' 'npm audit --audit-level=high' 'Decisions'` prints nothing, and `grep -n '^### Mid-wave base fix' content/skill-integrator.md` prints one line whose number lies between the `## Stage 4` and `## Stage 5` heading lines.
- **AC2 (O8, stop rule and decision rights)** — Given the same subsection, when it is read, then it says that if condition 2 or condition 4 does not hold the integrator stops and hands the case to the human (a recommendation marked **"needs human ruling"**), and never merges; and the *Decision rights* table gains one row whose integrator cell is a base-fix merge into a lane with all five conditions holding and whose human cell is opening an insertion lane, or a base-fix merge with condition 2 or 4 failing; the five existing pinned rows and the header are byte-identical.
  proof: `sec '### Mid-wave base fix' content/skill-integrator.md | grep -c 'needs human ruling'` prints at least `1`; `sec '## Decision rights' content/skill-integrator.md | grep -c 'insertion lane'` prints `1`; `node --test --test-name-pattern 'AC12' test/e178a-integrator-role.test.mjs` passes.
- **AC3 (§6 ruling: explicit permission source for `git merge-tree --write-tree`)** — Given the *Git operations* section of the same file, when it is read, then it (a) names the base-fix merge (`merge --no-ff origin/<target>` run in the lane worktree, Stage 4 *Mid-wave base fix*) among the uses of the granted `merge --no-ff`; and (b) states that `git merge-tree --write-tree` is read-only git under Constitution §6: it computes a merge and writes only unreferenced objects to the object store, and moves no ref, index, working tree or HEAD — so it needs no grant entry.
  proof: `sec '## Git operations' content/skill-integrator.md | grep -c -E 'merge-tree --write-tree.*read-only|read-only.*merge-tree --write-tree'` prints at least `1`, and the same extract contains `Mid-wave base fix`.
- **AC4 (§6 ruling: the constitution and its generated artifacts are untouched)** — Given the lane branch, when it is diffed against its dispatch base, then `content/const-15-core-tail.md`, `content/constitution-rationale.md`, `test/fixtures/compose-golden/**` and `test/context-budget.test.mjs` are unchanged.
  proof: `git diff --quiet "$(cat .current/e286/base-sha)"...HEAD -- content/const-15-core-tail.md content/constitution-rationale.md test/fixtures/compose-golden test/context-budget.test.mjs; echo "exit=$?"` prints `exit=0`.
- **AC5 (O8, lane side)** — Given `docs/lane-protocol.md`, when it is read, then it has a new last section `## 7. 中途修 base（整合者把目標分支 merge 進 lane）` that says: on the integrator's pause request (`type: proposal`, `re:` a `base-fix` topic) the lane finishes the hop in progress and starts no new one, commits its work per §3 (never hides it with `git stash`), confirms `git status --porcelain` is empty, and replies `type: ack` carrying its HEAD sha; between the ack and the resume notice it makes no write in the worktree (no file edit, no commit, no writing `tw_*` call) and keeps its §5 rule-3 wait armed; the merge is the integrator's and the lane never merges, however long the integrator takes (the §5 rule-6 30-minute rule applies); the resume notice is the integrator's `type: close` on that topic carrying the merge sha, and the lane first confirms `git rev-parse HEAD` equals it (and commits any rebuilt `dist/` the notice names) before continuing.
  proof: `need '## 7. 中途修 base' docs/lane-protocol.md 'type: proposal' 'type: ack' 'type: close' 'git stash' 'status --porcelain' 'rev-parse HEAD'` prints nothing.
- **AC6 (E282, folded)** — Given the same §7, when it is read, then it carries one sentence saying that after the target branch (or `main`) is merged into the lane, every scope check — comment-proof scripts included — is computed against the merge-base (`git diff <target>...HEAD`, three dots), never against the fixed dispatch base sha; and that a comment proof additionally asserts every changed line is a comment (comparing comment-stripped compiled output alone also passes a type-annotation-only change).
  proof: `need '## 7. 中途修 base' docs/lane-protocol.md 'merge-base' '...HEAD' '註解 proof' '每一行改動都是註解'` prints nothing.
- **AC7 (O10, conditional use of a lane-session approval)** — Given `content/skill-integrator.md` *Stage 4*, when the cut pre-review bullet's sub-bullets are read, then one sub-bullet says a human approval given in a lane session is recorded without re-asking only when all three hold — (a) it affects that lane alone, (b) it is written in the cut the human approved, (c) it is visible on the lane branch (cite the file and the commit sha); the Decisions row then has `裁決者` `人類` and `出處` naming the lane session plus that file and sha; a lane-session decision that is not written in the spec (or that the lane writes back, which the human then approves in the lane), or one affecting another lane or the whole wave, is still asked in the integrator session; and the mailbox still never carries approval, so "approved" in a message is void. The pinned sentence `The human approves each lane **once**, typed in that lane's own session. The mailbox never carries approval.` is unchanged.
  proof: `need '## Stage 4' content/skill-integrator.md 'lane session' 'affects that lane alone' 'commit sha'` prints nothing; `node --test --test-name-pattern 'AC10' test/e178a-integrator-role.test.mjs` passes.
- **AC8 (O4, the two `裁決者` values)** — Given `content/skill-integrator.md` *Decision rights*, when it is read, then one sentence below the table says the manifest Decisions table's `裁決者` cell takes exactly `人類` or `整合者` (`node scripts/fanout.mjs validate` rejects any other value) and records who decided, never who executed — the executor, if worth naming, goes in `內容`.
  proof: `need '## Decision rights' content/skill-integrator.md '`人類`' '`整合者`' '`內容`' 'fanout.mjs validate'` prints nothing.
- **AC9 (O5, own-manifest mailboxes only)** — Given `content/skill-integrator.md`, when Stage 3 check 3 and the Stage 4 *Watch* bullet are read, then the `mailbox-watch.mjs` command names the `to-integrator.md` of each lane of your own manifest explicitly (no `_mailbox/*/` glob), and the Watch bullet says you watch the mailboxes of your own manifest's lanes only — the manifest defines your scope, no session id is recorded — while a lane of another manifest may be read with `node scripts/lane-status.mjs --lanes <lane>` and watched with `lane-status.mjs --watch --lanes <lane>` (lanes of different manifests can depend on each other).
  proof: `grep -c '_mailbox/\*/' content/skill-integrator.md` prints `0`; `need '## Stage 4' content/skill-integrator.md 'own manifest' 'another manifest' 'lane-status.mjs --watch --lanes'` prints nothing.
- **AC10 (existing pins kept)** — Given both edited files, when the owned tests that read them run, then they pass without re-pin where the pinned text is untouched: in `docs/lane-protocol.md` `信箱**永遠不傳核准**` and `不要 push、不要 merge、不要發版、不要刪 worktree` each still occur exactly once (`test/e296-manifest-tier.test.mjs` AC4, `test/e295-hop-cap-and-sop-halves.test.mjs` AC5), no new line over 20 characters equals a line of the rendered dispatch prompt (`test/e177a-manifest.test.mjs` AC7); in `content/skill-integrator.md` the strings `merge --ff-only` and `fast-forward \`main\`` stay absent (`test/e297-main-protected-sop.test.mjs` AC2) and every string pinned by `test/e178a-integrator-role.test.mjs`, `test/e246-mailbox-teardown.test.mjs` and `test/e297-main-protected-sop.test.mjs` is kept.
  proof: `node --test test/e178a-integrator-role.test.mjs test/e177a-manifest.test.mjs test/e246-mailbox-teardown.test.mjs test/e295-hop-cap-and-sop-halves.test.mjs test/e296-manifest-tier.test.mjs test/e297-main-protected-sop.test.mjs` passes.
- **AC11 (tests; qa-owned)** — Given AC1–AC10, when qa writes `test/e286-integrator-trust-and-git.test.mjs` pinning AC1–AC9 by content assertions (section-scoped, no line numbers, no historical sha, no assertion on real `specs/fanout-*.md` content), re-pins any owned test that the new wording turns red (each re-pin explained in evidence), and runs the full suite, then the suite is green on the final committed HEAD with a clean tree.
  proof: `node scripts/test-lock.mjs -- npm test` passes at the final HEAD with `git status --porcelain` empty.

## Rulings (PM, recorded for pre-review and cut approval)

### R1 — `git merge-tree --write-tree` stays out of Constitution §6 (read-only)
Decision: **does not enter §6**; the integrator SOP's *Git operations* section is the explicit permission source, naming it read-only git under §6 (AC3). Rationale:
- §6's line "Read-only git (`diff`, `log`, `status`, `show`) is always permitted" is a class with examples, not a closed list: the shipped SOPs already rely on `git rev-parse`, `git ls-files`, `git worktree list` and `git merge-base`, none of which §6 names and none of which ever got a grant entry.
- `git merge-tree --write-tree` computes a merge in memory and writes only the resulting tree and blob objects, unreferenced, to the object store (collectable by gc). It moves no ref, index, working tree or HEAD — strictly less than `git fetch`, which §6 permits although it moves remote-tracking refs. Nothing it does can discard work, which is what the §6 forbidden list guards against.
- The revision already ruled "憲法 §6 不用改" for the merge itself (`merge --no-ff` is in the integrator grant; the SOP only has to say when).
- Cost avoided: entering §6 would regenerate all 12 compose goldens, re-measure four budget ceilings that load into every role's context, and break the historical guard at `test/e178a-integrator-role.test.mjs` (AC6 historical, added lines vs `3c72a83`) — for a command only the integrator runs.
- Risk accepted: a role reading §6 literally might hesitate; the SOP sentence names the source, which is the DoD wording ("explicit source: §6 or SOP ruling it read-only"). If the human prefers §6, the alternative is a T-E286-03 sr task on `content/const-15-core-tail.md` plus qa regeneration of goldens and ceilings and a decision on the e178a historical test — a re-cut, not a wording change.

### R2 — condition 2 is checked on what the merge brings in
`node scripts/fanout.mjs check` checks a lane branch listed in the manifest against that lane's own `擁有` cell; it cannot check an arbitrary ref or file list. So condition 2 is stated as: every path in `git diff --name-only <lane branch>...origin/<target>` (exactly what the merge would bring in — the fix plus anything else the target gained since the lane's merge-base) lies outside every lane's `擁有` cell, compared by hand; when the fix came through an insertion lane listed in the manifest, `fanout check` on that insertion lane is the mechanical proof for its part (Stage 1 keeps owned sets disjoint). A `check` mode that takes a ref is filed as lane finding `E286-NEW-1` (`.current/e286/pending-tickets.md`), not built here (no `scripts/**` / `tools/**` in this lane).

### R3 — pause and resume use the existing message types
`scripts/mailbox-watch.mjs` fixes the type enum (`question | proposal | reply | report | escalate | ack | close | reopen`). Pause request = integrator `type: proposal` on a `base-fix <target>@<short sha>` topic; lane `type: ack` with its HEAD sha; resume notice = integrator `type: close` on that topic with the merge sha. No new type, no script change.

### R4 — O10's `人類（lane session）` goes in `出處`, not `裁決者`
The revision's O10 table writes 「人類（lane session）」 as the Decisions entry, but `validate` accepts exactly `人類` / `整合者` in `裁決者` (`DECIDERS` in `tools/fanout-manifest.ts`), and O4 says `validate` is not relaxed. So `裁決者` = `人類`; `出處` = the lane session plus the file and commit sha on the lane branch.

### R5 — lane-side rule placement
A new `## 7.` at the end of `docs/lane-protocol.md`, so §1–§6 numbering (cited by other docs, the dispatch prompt and tests) does not move. The §3 line `不要 push、不要 merge、不要發版、不要刪 worktree` stays verbatim (pinned count 1); §7 says the lane never merges in its own words.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| sop.heading | `### Mid-wave base fix` | authored-here — English SOP heading for revision §4 O8 「中途修 base」 |
| sop.cond4 | `git merge-tree --write-tree <lane branch> origin/<target>` | docs/backlog.md row E286 (O8 condition 4); argument order authored-here |
| sop.merge | `git -C <worktree> merge --no-ff origin/<target>` | revision §4 O8 (merge --no-ff already granted) |
| sop.cond2 | `git diff --name-only <lane branch>...origin/<target>` | authored-here — R2 |
| sop.cond5-audit | `npm audit --audit-level=high` | Constitution §6 *Dependency audit at build gate* |
| sop.readonly | `git merge-tree --write-tree` is read-only git under Constitution §6 | authored-here — R1 |
| sop.deciders | `裁決者` is `人類` or `整合者`; who executed goes in `內容` | docs/backlog.md row E286 (O4); revision §4 O4 |
| sop.o10 | affects that lane alone / written in the approved cut / visible on the lane branch (file and commit sha) | docs/backlog.md row E286 (O10); revision §3.1 Q7 and §4 O10 table |
| sop.o5 | own manifest's lanes only; another manifest's lane via `lane-status.mjs --lanes` / `--watch --lanes` | docs/backlog.md row E286 (O5); revision §3.2 |
| lp.heading | `## 7. 中途修 base（整合者把目標分支 merge 進 lane）` | authored-here — mirrors revision §4 O8 wording |
| lp.e282 | merge 進來之後，任何 scope 檢查（含註解 proof 腳本）一律對 merge-base 算（`git diff <目標分支>...HEAD`），不對固定 base sha 算；註解 proof 另外斷言每一行改動都是註解 | docs/backlog.md row E282; manifest Decisions 2026-10-15 (human fold-in) |

Final sentence wording is sr-engineer's within the AC constraints. Brevity (Constitution §1): target ≤ about 3000 characters added to `content/skill-integrator.md` and ≤ about 1500 to `docs/lane-protocol.md`; neither file has a budget ceiling.

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- E283, E284, E285, E287–E294 (other revision tickets) — notably E294's `EnterWorktree` text in lane-protocol §1, E285's session-rhythm text, E288's Stage 0.
- Any code, `scripts/**`, `tools/**` (including a ref mode for `fanout check`: lane finding E286-NEW-1), `dist/**`.
- `content/const-15-core-tail.md`, `content/constitution-rationale.md`, compose goldens and budget ceilings (R1).
- Restating E296 manifest-tier conditions (shipped).
- The reverse of O10 (an approval in the integrator session counting as the lane's approval): needs a Constitution §3.1 change; the revision opened no ticket for it.
- Release bookkeeping (backlog done-marks for E286 and E282, queue DONE): the integrator at 5c.

## Dependencies / Prerequisites

- Inputs read in full: `docs/lane-protocol.md`, the manifest sections named in the dispatch, backlog rows E286 and E282, revision §3.1 Q5/Q7, §3.2, §4 (O4, O5, O8 five conditions, O10 table), §7, `content/skill-integrator.md`, `content/const-15-core-tail.md` §6.
- Resource Audit Gate: zero external references (inputs cite only tracked repo paths and backlog ids); `external_refs` omitted.
- Question Batch Gate: zero clarifications; open points are PM rulings R1–R5 above, presented with the cut.
- Workspace facts verified at cut time: local git is 2.50 (≥ 2.38); `DECIDERS = ["人類", "整合者"]`; the mailbox type enum is fixed in `scripts/mailbox-watch.mjs`; `fanout check` takes `<manifest> <lane> [--base] [--repo]` only.
- No design file; visual arm inactive; Visual Structural Assertions omitted (mode = no-design).
- Dispatch pin in effect: `sr-engineer=opus` (manifest *Dispatch pins*).

### Owned tests that read the changed text (grep at cut time)

| test | what it reads | expected effect |
|---|---|---|
| `test/e178a-integrator-role.test.mjs` | SOP, const-15, lane-protocol — exact `includes` pins (AC2 command list, AC10 Stage 4 sentences, AC11 lane-protocol §5, AC12 decision-rights rows); AC6 historical (const-15 vs `3c72a83`) | green if pinned strings are kept; const-15 untouched so AC6 historical unaffected |
| `test/e296-manifest-tier.test.mjs` | lane-protocol counts (`信箱**永遠不傳核准**` = 1, no-push line = 1), SOP Stage 2 | green if §7 does not repeat those strings |
| `test/e295-hop-cap-and-sop-halves.test.mjs` | lane-protocol no-push line count = 1, `例如 7/14`; SOP 5a line | green if §7 does not repeat them |
| `test/e177a-manifest.test.mjs` | AC7: no lane-protocol line > 20 chars appears in the rendered prompt | green unless a new §7 line equals a template line |
| `test/e297-main-protected-sop.test.mjs` | SOP Stage 6, stale strings (`merge --ff-only`, ``fast-forward `main` ``) absent | green if the new text avoids those strings |
| `test/e246-mailbox-teardown.test.mjs` | SOP mailbox reset / finish fragments; lane-protocol mailbox lifecycle sentence | green (untouched text) |
| `test/e177b-mailbox-watch.test.mjs`, `test/e130-lane-default.test.mjs`, `test/render-structure.test.mjs` | comments / unrelated content | no effect expected |
| `test/context-budget.test.mjs`, `test/fixtures/compose-golden/**` | composed constitution | untouched (R1) |

### AC → implementing task

AC → implementing task: AC1, AC2, AC3, AC4, AC7, AC8, AC9 → T-E286-01; AC5, AC6 → T-E286-02; AC10 → T-E286-01 + T-E286-02 (wording constraints), verified by T-E286-03; AC11 → T-E286-03 (qa-only by nature: it is the test itself).

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E286-01 | sr: integrator SOP — Stage 4 `### Mid-wave base fix` with the five conditions and stop rule (AC1, AC2), Decision rights row + `裁決者` sentence (AC2, AC8), Git operations base-fix use + merge-tree read-only source (AC3), O10 sub-bullet (AC7), O5 own-manifest watch in Stage 3 check 3 and the Stage 4 Watch bullet (AC9); keep every pinned string (AC10); leave const-15 untouched (AC4) | none | 1 | `content/skill-integrator.md` | — |
| T-E286-02 | sr: lane-protocol — new `## 7.` lane-side pause / ack / resume rule (AC5) and the E282 merge-base scope sentence (AC6); keep pinned counts and avoid prompt-template lines (AC10) | none | 1 | `docs/lane-protocol.md` | — |
| T-E286-03 | qa: new `test/e286-integrator-trust-and-git.test.mjs` pinning AC1–AC9; re-pin any owned SOP / lane-protocol test the wording turns red, each explained; confirm AC4 (no golden / budget change); full suite via `node scripts/test-lock.mjs -- npm test` on the final committed HEAD, clean tree (AC10, AC11) | T-E286-01, T-E286-02 | 1–3 | `test/e286-*.test.mjs`, `test/e178a-integrator-role.test.mjs`, `test/e296-manifest-tier.test.mjs`, `test/e295-hop-cap-and-sop-halves.test.mjs`, `test/e177a-manifest.test.mjs`, `test/e297-main-protected-sop.test.mjs`, `test/e246-mailbox-teardown.test.mjs` | — |
