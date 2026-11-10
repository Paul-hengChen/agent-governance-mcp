# e262-sop-text-fixes

Lane e262 (backlog wave B; manifest `specs/fanout-backlog-wave-b.md`, lane row e262). Tickets E262, E355, E360, E340. Prose-only: `content/**` and `docs/**` markdown, plus the qa-owned pins, goldens and budget caps they move. Spec source: the four `docs/backlog.md` rows, the manifest's 派工前核對 sites and its Decisions (rulings 1–6 = a). No architect hop.

## Problem Statement

Four SOP texts are wrong or not portable. (E262) The integrator SOP and the lane protocol tell an architect-hop lane to hold the human cut presentation until the architect's Open Questions are pre-reviewed too, but the server refuses the pm → architect hop with `CUT_APPROVAL_REQUIRED` until the human has approved the cut, so following the text literally deadlocks. (E355) The integrator SOP still states facts that hold only in this repository (the CI trigger on `feat/**`, the load-sensitive list in `docs/backlog.md` and its E238 / E254 / E278 family, restarting the primary MCP server after a merge, the root `NEW-TICKETS.md` check, `npm test` as the full suite). (E360) The qa-visual Phase 1.5 FAIL calls omit `review_task_ids`, so the server rejects them (`QA_REVIEW_TARGET_REQUIRED`) and the failed ids never leave the `completed_tasks` ledger. (E340) The constitution forbids every hand-edit of the task list, but no tool edits an unchecked task's description or `depends_on`, and void + add changes the task id that evidence files are named after.

## User Stories

- As an architect-hop lane, I want the SOP order to match what the server allows, so that I reach the architect without a deadlock or a correction from the integrator.
- As an integrator in an adopter repo, I want the SOP to state only generic rules and the addendum to carry this repo's facts, so that I never act on a fact that is false in my repo.
- As a qa-engineer running Phase 1.5, I want each FAIL call to carry `review_task_ids`, so that the call is accepted and the failed ids leave the ledger.
- As a PM amending a cut mid-chain, I want a sanctioned in-place edit for an unchecked task's description and `depends_on`, so that amendments keep the task id the evidence files use.

## Acceptance Criteria

### E262

- **AC-E262-1** — Given `content/skill-integrator.md` Stage 4, when the architect-hop sub-bullet (line 117) is read, then it is exactly the W1 new text: it keeps the bold label `**Architect-hop tickets pre-review twice**`, states the order (1) PM cut converges → the lane presents it → the human approves it, with the pm → architect hop refused until that approval is recorded; (2) the architect runs; (3) the Open Questions get a second pre-review that converges before the human's ruling and before sr-engineer starts; and the sentence `Both must converge before the lane presents to the human.` is gone.
  proof: the qa test in `test/e262-*.test.mjs` asserts W1-new occurs exactly once at a line starting `  - **Architect-hop tickets pre-review twice**` and `grep -c "Both must converge before the lane presents to the human" content/skill-integrator.md` prints `0`.
- **AC-E262-2** — Given `docs/lane-protocol.md` §5 rule 2, when the architect-hop sub-bullet (line 101) is read, then it is exactly the W2 new text, in the same three-step order, keeping `有 architect hop 的票，預審兩次`, and §4 / §6 are byte-identical to the base.
  proof: the qa test in `test/e262-*.test.mjs` asserts W2-new occurs exactly once, inside the `## 5.`..`## 6.` slice; qa checks §3, §4 and §6 untouched with `git diff origin/main...HEAD -- docs/lane-protocol.md` (merge-base, no fixed sha) showing one hunk, at the §5 line; `test/e290-lane-protocol-generic.test.mjs` stays green.
- **AC-E262-3** — Given both sites, when the manifest-tier clause is read, then each says the manifest tier's auto-approval stands in for step (1)'s human approval, and that the second pre-review's `close` with no `needs human ruling` item lets sr-engineer start, otherwise the Open Questions go to the human; `content/skill-integrator.md` line 115 (the manifest-tier `close` sentence) is unchanged.
  proof: the qa test asserts W1-new contains `Under the manifest tier, (1)'s approval is the auto-approval` and `with no \`needs human ruling\` item lets sr-engineer start`, W2-new contains `manifest tier 下，(1) 的核准就是上一條的自動核准` and `否則把 Open Questions 呈給人類`, and line 115 still contains `your \`close\` on the final cut is a condition of that lane's auto-approval`.
- **AC-E262-4** — Given the moved text, when the suite runs, then `test/e178a-integrator-role.test.mjs` AC10 asserts the W1 order instead of the removed sentence, and AC11 stays green unchanged.
  proof: `node --test test/e178a-integrator-role.test.mjs` exits 0.

### E355

- **AC-E355-1** — Given `content/skill-integrator.md`, when it is scanned, then it contains none of `feat/**`, `ci.yml`, `NEW-TICKETS.md`, `npm test`, `load-sensitive in \`docs/backlog.md\``, `E238`, `E254`, `E278`, `primary MCP server`.
  proof: the qa test (in `test/e349-integrator-repo-facts.test.mjs` AC-E349-1's banned list or a new `test/e355-*.test.mjs`) counts each at 0.
- **AC-E355-2** — Given the five sites, when read, then each carries its generic replacement verbatim exactly once, in its own step: W3 (5a lead paragraph, line 142), W4 (5a `new findings` row, line 151), W5 + W6 (CI fallback and flake rule, line 156), W7 (verifier bullet, line 164), W8 (5b step 4, line 175).
  proof: the qa test asserts each W3–W8 new string has count 1 and sits in the slice the site names (5a: `### 5a.`..`### 5b.`; 5b: `### 5b.`..`### 5c.`).
- **AC-E355-3** — Given `docs/lane-protocol-addendum.md`, when read, then §5 holds the existing four bullets unchanged followed by the five W9 bullets in order, verbatim; the heading list and §7 are unchanged; each SOP generic phrase W3–W8 has its addendum line (CI trigger, full-suite command, retired findings file, post-merge restart, load-sensitive list).
  proof: `test/e349-integrator-repo-facts.test.mjs` AC-E349-2 (moved by qa) asserts the nine §5 bullets in order and §7 byte-identical.
- **AC-E355-4** — Given the load-sensitive list (ruling 4 = a), when read, then it names exactly `test/e108-eject.test.mjs` (the two tests whose names start `AC7`) and `test/verify-release.test.mjs` `VR-20 (E80)`, and states that the six E238 sites are not on it (the E238 decision below); `test/e108-eject.test.mjs` and `test/verify-release.test.mjs` are not modified.
  proof: the qa test asserts the W9 load-sensitive bullet verbatim; `git diff --quiet origin/main...HEAD -- test/e108-eject.test.mjs test/verify-release.test.mjs` exits 0 (qa runs it against the merge-base, not a fixed sha).
- **AC-E355-5** — Given `test/e410-task-alias-content-tail.test.mjs` (not owned by this lane), when the suite runs, then it stays green: `content/skill-integrator.md` keeps 249 `split("\n")` lines and lines 40, 41, 78, 81, 177, 181, 248 keep their pinned spans (every W1–W8 edit is in place, no line added or removed).
  proof: `node --test test/e410-task-alias-content-tail.test.mjs` exits 0.
- **AC-E355-6** — Given the moved text, when the suite runs, then the pins below are moved by qa and green: `test/e178a-integrator-role.test.mjs` AC13 (the verifier item), `test/e226-integrator-sop-portable.test.mjs` AC-E226-4 (`FINDINGS_CMD`), `test/e295-hop-cap-and-sop-halves.test.mjs` AC9 (flake rule now asserts the addendum list, not the E238/E254/E278 line), `test/e349-integrator-repo-facts.test.mjs` AC-E349-1 and AC-E349-2.
  proof: `node --test test/e178a-integrator-role.test.mjs test/e226-integrator-sop-portable.test.mjs test/e295-hop-cap-and-sop-halves.test.mjs test/e349-integrator-repo-facts.test.mjs` exits 0.

### E360

- **AC-E360-1** — Given `content/skill-qa-visual.md` *Error codes & STOP routes*, when each `tw_update_state(status=FAIL` call is read (rows at lines 88, 89, 90, 91, 93), then each carries `review_task_ids=[<task-id>]` directly after its `qa_review=` argument (W10), matching the qa SOP format line (`content/skill-qa-engineer.md` *Escalation Routes* Format, read-only here).
  proof: the qa test in `test/e360-*.test.mjs` asserts the count of `status=FAIL` equals the count of `review_task_ids=[<task-id>]` and both are 5, and that each FAIL call's `qa_review=` argument is immediately followed by `, review_task_ids=[<task-id>], next_role=`.
- **AC-E360-2** — Given the edit, when the suite runs, then `content/skill-qa-visual.md` is ≤ 20700 bytes (measured 17169 after trial), the existing route regexes in `test/qa-visual-skill-split.test.mjs` and `test/pixel-perfect-visual-compare.test.mjs` stay green, and no golden or budget moves for E360.
  proof: `node --test test/qa-visual-skill-split.test.mjs test/pixel-perfect-visual-compare.test.mjs test/visual-widgets-unverified-gate.test.mjs` exits 0.

### E340

- **AC-E340-1** — Given `content/const-05-core-standards.md`, when line 17 is read, then it is the W11 new text: the exception covers only the description and `depends_on` of an unchecked, non-voided task, edited in place by the role amending the cut (pm, or the coordinator for it), disclosed in `pending_notes`; never ids, checkboxes or voided rows; everything else is `tw_void_task` + `tw_add_task`. The file keeps 23 `split("\n")` lines (pinned by `test/e410-task-alias-content-tail.test.mjs`) and the added text names no repo path.
  proof: the qa test in `test/e340-*.test.mjs` asserts W11-new is line 17 verbatim and the added clause contains none of `docs/`, `specs/`, `test/`, `.current/`, `qa_reports/`.
- **AC-E340-2** — Given `test/e130-lane-default.test.mjs` AC9, when the suite runs, then AC9 asserts the rule with its exception (the bootstrapping-clause negatives kept), not an unqualified sentence.
  proof: `node --test test/e130-lane-default.test.mjs` exits 0.
- **AC-E340-3** — Given the capture script, when qa runs `npm run build` then `node scripts/capture-constitution-golden.mjs`, then exactly the 11 goldens in *Golden change list* change, each by one line (line 17's text), and `skill-coordinator-monolith.txt` is byte-identical.
  proof: `git diff --numstat -- test/fixtures/compose-golden/` after capture lists exactly the 11 files, each `1	1`.
- **AC-E340-4** — Given ruling 5 = a, when the suite runs, then the two exceeded caps in `test/context-budget.test.mjs` are re-set to the measured values with zero headroom (lean 5723 → 5731, non-design 8501 → 8518) with an E340 re-baseline comment in the E336/E350 style, the stripped (10598) and teamwork (21715) caps are not touched, and the suite is green.
  proof: `node --test test/context-budget.test.mjs` exits 0 and its assertion messages name 5731 and 8518.

### Lane

- **AC-L-1** — Given the committed final HEAD on a clean tree, when qa runs `node scripts/test-lock.mjs -- npm test`, then it passes with zero unexplained reds, and the files changed against the merge-base are all in the lane row's 擁有 cell.
  proof: `node scripts/test-lock.mjs -- npm test` (suite-result recorded) and `node scripts/fanout.mjs check specs/fanout-backlog-wave-b.md e262 --base origin/main` exits 0.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| W1-new | verbatim in § Wording W1 (new) | backlog E262 row, Fix (1)–(3); manifest e262 row |
| W2-new | verbatim in § Wording W2 (new) | backlog E262 row, Fix (1)–(3); manifest e262 row |
| W3-new … W8-new | verbatim in § Wording W3–W8 (new) | backlog E355 row; manifest 派工前核對 E355 sites |
| W9 (five addendum bullets) | verbatim in § Wording W9 | backlog E355 row; manifest Decisions ruling 4 = a; E238 decision below |
| W10 (five rows) | `review_task_ids=[<task-id>], ` inserted as in § Wording W10 | backlog E360 row; `content/skill-qa-engineer.md` Escalation Routes Format line |
| W11-new | verbatim in § Wording W11 (new) | backlog E340 row (Scope ruled 2026-11-09) |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- `tw_edit_task` or any task-list tool (E340 is ruled an SOP exception); E358.
- E225's 5a rewrite (ruling 3 = a); `docs/lane-protocol.md` §4 and §6 (lane e196).
- Any non-md product code, `dist/**`, `docs/backlog.md`, any other `content/**` file (`content/skill-qa-engineer.md` is read-only).
- The *Tool calls* paragraph of `content/skill-integrator.md` (pinned verbatim by `test/e226-integrator-sop-portable.test.mjs` AC-E226-2): it already says the addendum supplies the repo's commands; the per-site "(the addendum names it)" carries the rest.
- Other repo facts in the SOP not named by E355 (for example `docs/backlog.md` as the queue file in 5c-1 and Stage 6 step 1, and "Actions is down").
- Decoupling `test/e108-eject.test.mjs` AC7 or `test/verify-release.test.mjs` VR-20 (ruling 4 = a: listed, not changed).
- Release bookkeeping (version, CHANGELOG, done-marks): integrator / release-engineer after the wave.

## Dependencies / Prerequisites

- Rulings 1–6 of `specs/fanout-backlog-wave-b.md` Decisions are all `a` and not re-asked; ruling 4 (list the two candidates, tests unchanged) and ruling 5 (zero-headroom re-set of exceeded caps) apply here.
- No external references (Resource Audit: the backlog rows and the manifest cite only repo paths and ticket ids; zero `http(s)://`, Figma or tracker links). No design file; mode = no-design, so Visual Structural Assertions are omitted.
- Hard constraint found while grepping: `test/e410-task-alias-content-tail.test.mjs` (not owned) pins `content/skill-integrator.md` at 249 lines with spans at lines 40, 41, 78, 81, 177, 181, 248, and `content/const-05-core-standards.md` at 23 lines with line 9. Every edit below is an in-place line edit; the trial run kept that file green.
- Trial run (all content edits applied, goldens recaptured, 60 test files that reference the four files, the goldens or the budget): 899 tests, 9 red, every red in an owned test file and listed in *Pins that move*. Originals were restored from `git show HEAD:<path>` afterwards.
- Ownership change (integrator, 2026-11-10, via the coordinator): `docs/lane-protocol.md` §3 (the E196 known-gap line, ~44), `test/e351-lane-protocol-gaps.test.mjs` AC-E351-3 and `test/e383-lane-ledger-worktree.test.mjs` AC-E383-7 now belong to lane e196. This cut edits none of them: W2 is §5 only, and in the trial run both test files were green. No cross-lane item. The authoritative manifest is primary's updated copy; the coordinator runs `check --cut` against it.
- manifest-tier: not eligible — cutApprovalAutoTier.manifest is not enabled (`.current/.config.json` `cutApprovalAutoTier` = `{}`), so the cut goes to the human after the mailbox pre-review.

## Wording (old → new, line numbers re-verified at base 4b25061)

Each site is an exact substring replacement on the named line; no line is added or removed in `content/skill-integrator.md` or `content/const-05-core-standards.md`.

### W1 — `content/skill-integrator.md:117` (E262)

Old (whole line):
```
  - **Architect-hop tickets pre-review twice**: the PM cut, then the architect's Open Questions (`specs/<feature>-architecture.md`). Both must converge before the lane presents to the human.
```
New (whole line):
```
  - **Architect-hop tickets pre-review twice**, in this order: (1) the PM cut converges here, then the lane presents it and the human approves it — the pm → architect hop is refused until that approval is recorded; (2) the architect runs; (3) its Open Questions (`specs/<feature>-architecture.md`) come back for a second pre-review and converge before the lane presents them for the human's ruling, and before sr-engineer starts. Under the manifest tier, (1)'s approval is the auto-approval, and your `close` in (3) with no `needs human ruling` item lets sr-engineer start without presenting the Open Questions.
```

### W2 — `docs/lane-protocol.md:101` (E262, §5 rule 2)

Old (whole line):
```
   - **有 architect hop 的票，預審兩次**：PM 的 cut 一次；architect 的 Open Questions（`specs/<feature>-architecture.md`）出來後，**再送信箱預審一次**。兩次都談定，才呈給人類核准。manifest tier 下，第二次預審也要 `close` 且沒有留下 `needs human ruling` 項，才派 sr-engineer；否則把 Open Questions 呈給人類。
```
New (whole line):
```
   - **有 architect hop 的票，預審兩次**，照這個順序：(1) PM 的 cut 送信箱預審、談定後呈給人類核准 —— 核准記錄之前，server 拒絕 pm → architect 的 hop；(2) architect 執行；(3) architect 的 Open Questions（`specs/<feature>-architecture.md`）出來後，**再送信箱預審一次**，談定後才呈給人類裁決，sr-engineer 也在這之後才開始。manifest tier 下，(1) 的核准就是上一條的自動核准；(3) 的第二次預審也要 `close` 且沒有留下 `needs human ruling` 項，才派 sr-engineer；否則把 Open Questions 呈給人類。
```

### W3 — `content/skill-integrator.md:142` (E355: CI trigger + full-suite command)

Old (substring):
```
(`ci.yml` triggers on `feat/**`, E298); you push the lane branch — lanes never push. The local full suite runs only under the *CI fallback* below, and then it is still the **full suite**, never "related files", serial — wrapped in `node <agc install>/scripts/test-lock.mjs -- npm test`.
```
New:
```
(the repo's CI must run on a lane-branch push — the addendum names its trigger, E298); you push the lane branch — lanes never push. The local full suite runs only under the *CI fallback* below, and then it is still the **full suite**, never "related files", serial — the repo's full-suite command (the addendum names it), wrapped in `node <agc install>/scripts/test-lock.mjs -- <full-suite command>`.
```

### W4 — `content/skill-integrator.md:151` (E355: `new findings` row)

Old (substring): `no block below `## Applied`; root `NEW-TICKETS.md` untouched; under`
New: `no block below `## Applied`; any retired findings file the addendum names untouched; under`

### W5 — `content/skill-integrator.md:156` (E355: CI fallback command)

Old (substring): ``on the committed branch under `node <agc install>/scripts/test-lock.mjs -- npm test` as before,``
New: ``on the committed branch under `node <agc install>/scripts/test-lock.mjs -- <full-suite command>` as before,``

### W6 — `content/skill-integrator.md:156` (E355: flake rule)

Old (substring): ``is one already listed as load-sensitive in `docs/backlog.md` (the E238 / E254 / E278 family); any other red``
New: `is on the repo's load-sensitive test list (the addendum names it; no list, no re-run); any other red`

### W7 — `content/skill-integrator.md:164` (E355: verifier bullet)

Old (whole line): ``- the `pending-tickets.md` / `## Applied` / root `NEW-TICKETS.md` check.``
New (whole line): ``- the `pending-tickets.md` / `## Applied` / retired-findings-file check.``

### W8 — `content/skill-integrator.md:175` (E355: post-merge restart)

Old (substring): ``After merging, run the repo's build and restart the primary MCP server so the next `tw_*` call runs the merged code.``
New: ``After merging, run the repo's build, plus the post-merge restart the addendum names, if any (so the next `tw_*` call runs the merged code).``

### W9 — `docs/lane-protocol-addendum.md` §5, five bullets inserted after line 33 (the `npm run check:bookkeeping` bullet), before the blank line and `## §7`

```
- 整合者 5a 的 lane 層 CI：本 repo 的 `.github/workflows/ci.yml` 在 push 到 `feat/**`（另有 `main`、`integ/**`、`release/**`）時觸發，所以整合者 push lane branch 就會跑 CI（E298）。
- 整合者 SOP 的「repo 的全套指令」在本 repo 是 `npm test`，一律包成 `node scripts/test-lock.mjs -- npm test`。
- 整合者 5a 與 verifier 檢查的「補充規則點名的退役發現檔」是 root 的 `NEW-TICKETS.md`（§4）：lane branch 不得改動它。
- 整合者 5b-4 的合併後重啟：本 repo 就是 agc 的 MCP server，合併並建置之後重啟 primary 的 MCP server，下一次 `tw_*` 呼叫才會跑合併後的程式。
- 整合者 flake rule 的負載敏感測試清單（只有清單上的測試在 CI 紅時可以 `gh run rerun --failed` 一次）：`test/e108-eject.test.mjs` 名稱以 `AC7` 開頭的兩個測試、`test/verify-release.test.mjs` 的 `VR-20 (E80)`。E238 處理過的六個站點（五個已去耦，usage-accounting 的 20 s 上限確認不動）不在清單上：再紅代表退化，照一般紅燈送回 lane。
```
The CI trigger fact was re-verified against `.github/workflows/ci.yml` (`branches: [main, 'feat/**', 'integ/**', 'release/**']`).

### W10 — `content/skill-qa-visual.md:88, 89, 90, 91, 93` (E360)

In each row insert `review_task_ids=[<task-id>], ` directly after the `qa_review=…, ` argument, nothing else changed:

| line | old substring | new substring |
|---|---|---|
| 88 | `qa_review=<list of missing widgets>, next_role` | `qa_review=<list of missing widgets>, review_task_ids=[<task-id>], next_role` |
| 89 | `qa_review=<diff>, next_role` | `qa_review=<diff>, review_task_ids=[<task-id>], next_role` |
| 90 | `qa_review=<path>, next_role="design-auditor"` | `qa_review=<path>, review_task_ids=[<task-id>], next_role="design-auditor"` |
| 91 | `qa_review=<path>, next_role="sr-engineer"` | `qa_review=<path>, review_task_ids=[<task-id>], next_role="sr-engineer"` |
| 93 | `qa_review="Source manifest missing frozen baseline node-id list", next_role` | `qa_review="Source manifest missing frozen baseline node-id list", review_task_ids=[<task-id>], next_role` |

Line 92 (dimension mismatch) has no call of its own (it points at the missing-baseline path) and is unchanged.

### W11 — `content/const-05-core-standards.md:17` (E340)

Old (substring): `Do NOT hand-edit the task-list file from a role. `tw_sync``
New: ``Do NOT hand-edit the task-list file from a role, except: the role amending the cut (pm, or the coordinator for it) may edit an unchecked, non-voided task's description and `depends_on` in place, disclosed in `pending_notes` — never ids, checkboxes or voided rows; anything else is `tw_void_task` + `tw_add_task`. `tw_sync``

## E238 decision

The six E238 sites leave the flake rule's list; the list holds only the two ruling-4 candidates. Reasoning: wave A made sites 1–5 deterministic (no wall-clock bound or race left), so a red there now means the decoupling regressed, and a re-run allowance would hide exactly that. Site 6 (`test/usage-accounting.test.mjs`, 20 s ceiling) was confirmed and left unchanged; it has never gone red and was never on the old list, so adding it would widen the re-run exemption for a test with no observed flake. The two candidates did go red under parallel load with CI green (wave A observation), so they are the only tests with a current flake record.

## Pins that move (trial run, all in owned files)

| test file | test | why it goes red | task |
|---|---|---|---|
| `test/e178a-integrator-role.test.mjs` | AC10 (line 301) | asserts `Both must converge before the lane presents to the human.` (W1) | T-E262-02 |
| `test/e178a-integrator-role.test.mjs` | AC13 (line 352) | asserts the verifier item with root `NEW-TICKETS.md` (W7) | T-E355-02 |
| `test/e226-integrator-sop-portable.test.mjs` | AC-E226-4 (`FINDINGS_CMD`, line 38) | pins the `new findings` cell verbatim (W4) | T-E355-02 |
| `test/e295-hop-cap-and-sop-halves.test.mjs` | AC9 (lines 94–98) | asserts a SOP line holding E238, E254 and E278 (W6) | T-E355-02 |
| `test/e349-integrator-repo-facts.test.mjs` | AC-E349-1 (line 39) | pins `After merging, run the repo's build and restart the primary MCP server` (W8) | T-E355-02 |
| `test/e349-integrator-repo-facts.test.mjs` | AC-E349-2 (lines 66–71) | asserts §5 ends after three bullets (W9 adds five) | T-E355-02 |
| `test/e130-lane-default.test.mjs` | AC9 (line 217) | regex requires `from a role\.` (W11 continues with `, except:`) | T-E340-02 |
| `test/context-budget.test.mjs` | AC2 lean (line 200) | 5731 > 5723 | T-E340-02 |
| `test/context-budget.test.mjs` | AC8 non-design (line 912) | 8518 > 8501 | T-E340-02 |

Pins checked and staying green: `test/e178a-integrator-role.test.mjs` AC11 (`有 architect hop 的票，預審兩次`), line 300 (bold label kept); `test/e296-manifest-tier.test.mjs` AC4/AC6; `test/e290-lane-protocol-generic.test.mjs` (W2 adds no repo-only string to the generic file); `test/e410-task-alias-content-tail.test.mjs` (line counts and spans); `test/qa-visual-skill-split.test.mjs`, `test/pixel-perfect-visual-compare.test.mjs` (route regexes); `test/e298-finish-remote-delete.test.mjs` (ci.yml itself untouched).

## Golden change list

`node scripts/capture-constitution-golden.mjs` after the W11 edit changes exactly these 11 files, one line each (const-05 line 17); `skill-coordinator-monolith.txt` is byte-identical. W1–W10 move no golden (`content/skill-integrator.md` and `content/skill-qa-visual.md` are in no composition).

- `test/fixtures/compose-golden/build-full-design-fd.txt`
- `test/fixtures/compose-golden/build-full-design.txt`
- `test/fixtures/compose-golden/build-full-nondesign-fd.txt`
- `test/fixtures/compose-golden/build-full-nondesign.txt`
- `test/fixtures/compose-golden/build-lite-design-fd.txt`
- `test/fixtures/compose-golden/build-lite-design.txt`
- `test/fixtures/compose-golden/build-lite-nondesign-fd.txt`
- `test/fixtures/compose-golden/build-lite-nondesign.txt`
- `test/fixtures/compose-golden/constitution-monolith.txt`
- `test/fixtures/compose-golden/hook-full.txt`
- `test/fixtures/compose-golden/hook-lite.txt`

## Budget (trial-applied W1–W11, `npm run build`, chars/4 estimator as in `test/context-budget.test.mjs`)

| budget | before | after | cap now | cap after | action |
|---|---|---|---|---|---|
| lean always-on (AC2) | 5665 | 5731 | 5723 | 5731 | exceeded by 8 → re-set, zero headroom (ruling 5 = a) |
| stripped constitution, design arm (AC8) | 10451 | 10517 | 10598 | 10598 | within cap, unchanged |
| non-design constitution (AC8) | 8452 | 8518 | 8501 | 8518 | exceeded by 17 → re-set, zero headroom (ruling 5 = a) |
| teamwork coordinator bundle (AC8) | 21526 | 21592 | 21715 | 21715 | within cap, unchanged |
| skill-pm stripped | 4847 | 4847 | 4849 | 4849 | not touched |
| design-only saving (stripped − non-design, floor ≥ 1999) | 1999 | 1999 | 1999 | 1999 | unchanged (W11 lands on both arms) |
| `content/skill-qa-visual.md` bytes (`test/qa-visual-skill-split.test.mjs`) | 17024 | 17169 | 20700 | 20700 | within cap |

W11 costs +66 ~tok on every constitution composition. A shorter form that drops the explicit "never ids, checkboxes or voided rows" saves about 3 ~tok and no longer states the E340 row's limits, so the explicit form is kept.

## Site map (file × site × AC × task)

| file | site | AC | sr task | qa task |
|---|---|---|---|---|
| `content/skill-integrator.md` | :117 W1 | AC-E262-1, AC-E262-3 | T-E262-01 | T-E262-02 |
| `docs/lane-protocol.md` | :101 W2 (§5 only) | AC-E262-2, AC-E262-3 | T-E262-01 | T-E262-02 |
| `content/skill-integrator.md` | :142 W3, :151 W4, :156 W5 W6, :164 W7, :175 W8 | AC-E355-1, AC-E355-2, AC-E355-5 | T-E355-01 | T-E355-02 |
| `docs/lane-protocol-addendum.md` | §5 after :33 W9 | AC-E355-3, AC-E355-4 | T-E355-01 | T-E355-02 |
| `content/skill-qa-visual.md` | :88 :89 :90 :91 :93 W10 | AC-E360-1, AC-E360-2 | T-E360-01 | T-E360-02 |
| `content/const-05-core-standards.md` | :17 W11 | AC-E340-1 | T-E340-01 | T-E340-02 |
| `test/e178a-integrator-role.test.mjs` | AC10, AC13 | AC-E262-4, AC-E355-6 | — | T-E262-02, T-E355-02 |
| `test/e226-integrator-sop-portable.test.mjs` | AC-E226-4 | AC-E355-6 | — | T-E355-02 |
| `test/e295-hop-cap-and-sop-halves.test.mjs` | AC9 | AC-E355-6 | — | T-E355-02 |
| `test/e349-integrator-repo-facts.test.mjs` | AC-E349-1, AC-E349-2 | AC-E355-3, AC-E355-6 | — | T-E355-02 |
| `test/e130-lane-default.test.mjs` | AC9 | AC-E340-2 | — | T-E340-02 |
| `test/fixtures/compose-golden/**` | 11 goldens | AC-E340-3 | — | T-E340-02 |
| `test/context-budget.test.mjs` | AC2 lean, AC8 non-design | AC-E340-4 | — | T-E340-02 |
| `test/e262-*.test.mjs` (new) | W1, W2 order | AC-E262-1..3 | — | T-E262-02 |
| `test/e355-*.test.mjs` (new, or inside e349) | W3–W9 | AC-E355-1..4 | — | T-E355-02 |
| `test/e360-*.test.mjs` (new) | W10 | AC-E360-1 | — | T-E360-02 |
| `test/e340-*.test.mjs` (new) | W11 | AC-E340-1 | — | T-E340-02 |
| (none) | final full suite on committed clean HEAD | AC-L-1, AC-E355-5, AC-E360-2 | — | T-E262-03 |

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| E262 | Architect-hop pre-review order made runnable at both sites (W1, W2): cut approval before architect, Open Questions second pre-review before the human ruling and sr. ACs AC-E262-1..4. Tasks T-E262-01 (sr), T-E262-02 (qa), T-E262-03 (qa, final suite) | none | 4 | `content/skill-integrator.md`、`docs/lane-protocol.md`、`test/e178a-integrator-role.test.mjs`、`test/e262-*.test.mjs` | — |
| E355 | Five integrator-SOP repo facts become generic wording (W3–W8) with one addendum line each in §5 (W9); flake rule points at the addendum load-sensitive list (two candidates, ruling 4 = a; E238 sites leave). ACs AC-E355-1..6. Tasks T-E355-01 (sr), T-E355-02 (qa) | none | 7 | `content/skill-integrator.md`、`docs/lane-protocol-addendum.md`、`test/e178a-integrator-role.test.mjs`、`test/e226-integrator-sop-portable.test.mjs`、`test/e295-hop-cap-and-sop-halves.test.mjs`、`test/e349-integrator-repo-facts.test.mjs`、`test/e355-*.test.mjs` | — |
| E360 | Five qa-visual Phase 1.5 FAIL calls gain `review_task_ids=[<task-id>]` (W10). ACs AC-E360-1..2. Tasks T-E360-01 (sr), T-E360-02 (qa) | none | 2 | `content/skill-qa-visual.md`、`test/e360-*.test.mjs` | — |
| E340 | const-05 line 17 narrow in-place-edit exception (W11); e130 AC9 pin, 11 goldens, lean and non-design caps re-set at zero headroom (ruling 5 = a). ACs AC-E340-1..4. Tasks T-E340-01 (sr), T-E340-02 (qa) | none | 15 | `content/const-05-core-standards.md`、`test/e130-lane-default.test.mjs`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e340-*.test.mjs` | — |
