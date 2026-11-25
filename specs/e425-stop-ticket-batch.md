# e425-stop-ticket-batch

Tickets: E425 (full: backlog row plus its 2026-11-19 audit amendment (1)–(5) and discussion section 15.2 ruling 8 / 15.4 gap 2) and E427 audit amendment (2) (the two SOP sentences only). Plan: `specs/fanout-post-v5-w2.md`, lane `e425`. Chain: v5 (pm → qa-engineer → sr-engineer → code-reviewer), no architect (no gate, schema or pipeline change).

## Problem Statement

Today any question that needs a human writes `Blocked` and the whole session waits for a person to type in that lane's session; an unattended batch of tickets therefore halts as a whole the first time one ticket needs a ruling, and the human has no single place to see what the batch did and what is left to rule on. The rulings (discussion section 11.4 rulings 1, 2, 4, 5; 15.2 ruling 8; 16.1 rulings 11, 12) settle the fix: in a batch, a ticket stops only when its scenarios are wrong or when it needs something it was not authorised to touch; the stop spreads to the tickets that depend on it and nowhere else; a ticket needing a device or a person runs to the judge's PASS and stops before merge; and one summary, printed from the ticket files and reports, is the human's only touchpoint. Separately (E427 amendment (2)), the CI check of named tests needs the test names in the ticket files: qa-engineer must backfill them and code-reviewer must confirm the named test checks its scenario.

## User Stories

- As the operator of an unattended batch, I want one ticket that needs a ruling to stop only itself and its dependents, so that the rest of the batch still lands.
- As the operator, I want one screen at the end of a batch listing what is done, what stopped and why, who waits on whom, what needs a device or a person, and every decision the agents took on their own, so that I rule once instead of being asked during the run.
- As a lane agent in a batch lane, I want the rule for when to stop and how to record it stated in one place, so that I neither wait for a typed approval nor stop for things I may decide myself.
- As code-reviewer, I want each scenario's verification line to name the test that checks it, so that CI and I can confirm that exact test exists, passed and checks that scenario.

## Acceptance Criteria

Test files are qa-engineer's to name; `test/e425-*.test.mjs` below stands for them. Fixtures for the summary script are built in temp directories inside the tests (no new fixture files under `test/fixtures/`).

- **AC1** (lane protocol, the mechanism) — Given `docs/lane-protocol.md`, when it is read, then §3 holds the subsection `C-LP2` verbatim (heading `### 批次 lane` placed after the last §3 bullet, before `## 4. 新發現`), the §3 first bullet ends with `C-LP1`, and the §5 rule 2 *cut 預審* sub-item (the one ending `只在收工送 `type: report`。`) ends with `C-LP3`; the file keeps exactly its eight `## ` headings in their order, no line before line 41 changes, and it contains none of the repo-only strings `test/e290-lane-protocol-generic.test.mjs` forbids.
  proof: `node --test test/e425-*.test.mjs` (the AC1 test, which asserts `C-LP1`, `C-LP2` and `C-LP3` at their places) passes; `node --test test/e290-lane-protocol-generic.test.mjs test/e433-test-first-rules.test.mjs test/e383-lane-ledger-worktree.test.mjs test/e385-worktree-evidence.test.mjs` stays green.
- **AC2** (constitution override) — Given the constitution composed for a chain role, when it is built on a design-armed and on a non-design workspace, then `C-C08` appears exactly once, as a sub-bullet directly after the Manifest-tier line, and the existing Cut-Approval Gate and Manifest-tier lines are byte-unchanged; the lite composition does not contain it.
  proof: the AC2 test in `test/e425-*.test.mjs`.
- **AC3** (coordinator SOP) — Given the `teamwork` coordinator bundle, when it is built, then the Escalation Routes table ends with the row `C-CO3` (exactly one row containing `Batch-lane stop`, with 4 cells), and SOP step 6 ends with `C-CO7`; every other Escalation Routes row is byte-unchanged.
  proof: the AC3 test in `test/e425-*.test.mjs`.
- **AC4** (integrator SOP, stage text only) — Given `content/skill-integrator.md`, when it is read, then `C-IN1` is a sub-bullet of the Stage 4 *Cut pre-review* bullet, `C-IN2` a sub-bullet of Stage 5b step 3 and `C-IN3` a sub-bullet of Stage 6 step 7; the sentence "The human approves each lane **once**, typed in that lane's own session. The mailbox never carries approval." is still present; the file has no `Escalation Routes` heading.
  proof: the AC4 test in `test/e425-*.test.mjs`.
- **AC5** (ticket format: fixed stop wordings) — Given `docs/ticket-format.md`, when it is read, then *Status values* holds `C-TF1` after the "No other value is valid" paragraph; and given ticket files whose status is `stopped — waiting on A`, `'stopped — waiting on A, D'` and `stopped — awaiting manual verification`, and which carry `## Open question` and `## Decisions made during the work` sections between the field block and `## Scenarios`, when `node scripts/check-tickets.mjs` checks them, then it exits 0.
  proof: the AC5 test in `test/e425-*.test.mjs`.
- **AC6** (ticket format: where each summary item is recorded) — Given `docs/ticket-format.md`, when it is read, then it has a `## Batch summary` section (`C-TF2`) between `## Named tests checked in CI` and `## Example ticket`, whose table names a recording location for each of the eight summary items, and the tooling section ends with `C-TF3`.
  proof: the AC6 test in `test/e425-*.test.mjs`.
- **AC7** (stop spreads to dependents only) — Given ticket files A (`stopped — S2 contradicts S1`, with an `## Open question`), B (`depends on: [A]`, `stopped — waiting on A`), D (`depends on: [B]`, `stopped — waiting on A`) and C (independent, `done`), when `node scripts/batch-summary.mjs <dir>` runs, then A is under `stopped (1):` with its reason and its question line, B and D are under `waiting (2):` each naming A, C is under `done (1):`, and the exit status is 0.
  proof: the AC7 test in `test/e425-*.test.mjs`.
- **AC8** (a stop outside the allowed paths names the path) — Given a ticket whose status is `'stopped — needs src/billing/tax.ts, outside allowed paths'`, when the summary prints, then its `stopped` line shows that reason with the path; and `C-LP2` requires the reason to name the blocking path.
  proof: the AC8 test in `test/e425-*.test.mjs`.
- **AC9** (appended scenarios and decisions reach the summary) — Given a batch ticket E901 with one scenario under `## Added during build` (with its `Added:` line), two items under `## Decisions made during the work`, a report `qa_reports/tests_e901-csv.md` with two lines under `## Open Interface Details`, a report `qa_reports/visual_T-E901-02.md` with one line under `## Allowed Differences`, and an unrelated report `qa_reports/tests_e9010-other.md`, when the summary runs with `--reports <that qa_reports dir>`, then `added scenarios`, `agent decisions`, `qa interface decisions` and `allowed visual differences` list those items under E901 with their source file, and nothing from `tests_e9010-other.md` appears.
  proof: the AC9 test in `test/e425-*.test.mjs`.
- **AC10** (manual verification) — Given a ticket with `needs device or person: yes`, a `Verification: device-or-person: open the file in a spreadsheet` scenario S3 and status `stopped — awaiting manual verification`, when the summary prints, then `awaiting manual verification (1):` lists `<id> — S3: open the file in a spreadsheet`; and `C-LP2` states such a ticket runs to code-reviewer PASS and stops before merge.
  proof: the AC10 test in `test/e425-*.test.mjs`.
- **AC11** (reports only) — Given any ticket directory, when the summary runs, then no file under the ticket directory or the reports directory changes (content hashes equal before and after); with no ticket directory it prints `batch-summary: no ticket directory at <dir>; 0 ticket(s)` and exits 0; with an unknown option it prints `batch-summary: unknown option <opt>` on stderr and exits 2.
  proof: the AC11 test in `test/e425-*.test.mjs`.
- **AC12** (a malformed ticket is not summarised) — Given a ticket file with format problems next to valid ones, when the summary runs, then it is listed under `unreadable tickets (1):` with its problem count, the valid tickets are summarised as usual, and the exit status is 0.
  proof: the AC12 test in `test/e425-*.test.mjs`.
- **AC13** (E427 amendment (2)) — Given the `qa-engineer` and `code-reviewer` role prompts, when they are built, then the qa SOP step 6 carries `C-QA` as its last bullet and the code-reviewer SOP carries step `C-CR` directly after step 4.
  proof: the AC13 test in `test/e425-*.test.mjs`.
- **AC14** (adopter-safe text) — Given every string this lane adds under `content/**`, when it is scanned, then it names no path that exists only in this repository (only agc-shipped paths such as `docs/lane-protocol.md` and `<agc install>/scripts/batch-summary.mjs`) and no bare ticket id (`/\bE\d{2,}[a-z]?\b/`).
  proof: the AC14 test in `test/e425-*.test.mjs`.
- **AC15** (shared generated artifacts and invariants) — Given the content edits above, when qa-engineer re-captures, then exactly the seven chain/coordinator goldens change (`build-full-design.txt`, `build-full-design-fd.txt`, `build-full-nondesign.txt`, `build-full-nondesign-fd.txt`, `constitution-monolith.txt`, `hook-full.txt`, `skill-coordinator-monolith.txt`), the five lite goldens do not, the three moved context-budget caps are re-set to the measured values with one comment per cap explaining the hunk and the delta against the E418 saving, `GATE_REGISTRY` stays 33 and `UPDATE_STATE_GATE_PIPELINE` 17, and the full suite is green.
  proof: `node scripts/test-lock.mjs -- npm test` exits 0; `git diff --stat <base>...HEAD -- test/fixtures/compose-golden` lists exactly those seven files.

## Copy / Strings

All new text is `authored-here`: the rulings fix the behaviour, not the wording. Each string is quoted verbatim in the block of the same id below the table (strings containing table pipes cannot sit in a table cell). Placement is part of the contract (see the ACs).

| string id | exact text (quote verbatim) | source |
|---|---|---|
| C-LP1 | block `C-LP1` (appended to the end of `docs/lane-protocol.md` §3 first bullet, after `**不是核准**。`) | authored-here — names the override at the overridden sentence (E425 amendment (5)) |
| C-LP3 | block `C-LP3` (appended to the end of `docs/lane-protocol.md` §5 rule 2 *cut 預審* sub-item, after `只在收工送 `type: report`。`) | authored-here — that sub-item says a cut failing the manifest tier is presented to the human; a batch lane must not (integrator pre-review, required change) |
| C-LP2 | block `C-LP2` (new `###` subsection at the end of §3) | authored-here — the single statement of the mechanism (E425 body; amendment (2), (5); 11.4 rulings 1, 2, 4, 5; 15.2 ruling 8) |
| C-C08 | block `C-C08` (new sub-bullet after the Manifest-tier line of `content/const-08-chain-31-mid.md`) | authored-here — names the two overridden constitution phrases (amendment (5)) |
| C-CO3 | block `C-CO3` (new last row of `content/coord-03-core-fallback.md` Escalation Routes) | authored-here — the one coordinator Escalation Routes row (E425 body) |
| C-CO7 | block `C-CO7` (appended to `content/coord-07-core-sop.md` step 6) | authored-here — the pointer (E425 body) |
| C-IN1 | block `C-IN1` (Stage 4 sub-bullet) | authored-here — integrator rule in stage text (amendment (3)) |
| C-IN2 | block `C-IN2` (Stage 5b step 3 sub-bullet) | authored-here — amendment (3); 11.7 stop spreads |
| C-IN3 | block `C-IN3` (Stage 6 step 7 sub-bullet) | authored-here — amendment (3); 11.7 summary is the single touchpoint |
| C-QA | block `C-QA` (qa-engineer SOP step 6, last bullet) | authored-here — E427 amendment (2); 16.1 ruling 12 |
| C-CR | block `C-CR` (code-reviewer SOP step 4a) | authored-here — E427 amendment (2); 16.1 ruling 12 |
| C-TF1 | block `C-TF1` (ticket format, *Status values*) | authored-here — amendment (2) status forms |
| C-TF2 | block `C-TF2` (ticket format, new `## Batch summary`) | authored-here — amendment (4): the format doc defines where each item is recorded |
| C-TF3 | block `C-TF3` (ticket format, end of the tooling section) | authored-here — documents the new script |
| C-BS | block `C-BS` (output and messages of `scripts/batch-summary.mjs`) | authored-here — E425 item (5) and amendment (4); one screen, reporting only |

`C-LP1`:

```
 例外：批次 lane 不等任何打字核准，見本節末的 *批次 lane*。
```

`C-LP3`:

```
 批次 lane 不把 cut 呈給人類，見 §3 的 *批次 lane*。
```

`C-LP2`:

```
### 批次 lane

本小節是批次 lane 的唯一規則來源。它指名覆寫四處，只對批次 lane 生效，其餘 lane 照舊：本節第一條的「一律等人類在你這個 session 親手打字」、§5 規則 2 *cut 預審* 的「只有條件不成立……才把 cut 呈給人類」、憲法 §3.1 Cut-Approval Gate 的「人類在對話中核准 cut 之後」，以及 §3.1 Manifest tier 的「HALT exactly as today」。

- **什麼是批次 lane**：三項都成立——(a) lane 從已核准的波次表（fan-out 清單）啟動：清單的 Decisions 表有 `人類` 列、Lanes 表有這條 lane；(b) 這條 lane 的每張票都是票檔（格式見 agc 的 `docs/ticket-format.md`）；(c) 這條 lane 在 Lanes 表的 `approval` 欄不是 `human`。
- **不等打字核准**：批次 lane 從不等人類打字。cut 只能由憲法 §3.1 manifest tier 自動核准；manifest tier 的條件不成立，就停票（見下），不呈給人類、不等，也不寫 `cut_approved`。政策裁決、lease override、hop 或輪數上限用完也一樣：凡是要人類決定的事，一律停票。
- **只在兩種情況停票**：(1) 情境本身有問題：互相矛盾、漏了會改變行為的情況、做不出來，或需要修改、刪除一條既有情境；(2) 工作需要票沒授權的東西：允許路徑以外的檔案、schema 變更、對外合約，或上一條任何要人類決定的事。其餘都由做事的角色自己決定並記錄（記在哪裡見票檔格式的 *Batch summary*），不停。
- **情境只能追加**：開工後情境只能照票檔格式追加在 `## Added during build`，不能修改或刪除。
- **怎麼停**：遇到停票情況的角色 (a) 把票檔的 `status` 改成 `stopped — <理由>`，理由點名卡住的東西，例如允許路徑以外的那個路徑；(b) 在票檔的 `## Open question` 寫下要人類裁定的問題；(c) 同一條 lane 裡直接或間接相依這張票的票，`status` 改成 `stopped — waiting on <id>`，`<id>` 是這張停下的票；(d) commit，server 接受時寫 `tw_update_state(status=Blocked)`，`blocking_reason` 就是那行 status（hop 或輪數上限用完時 server 只接受 `pm:In_Progress`，那就不寫，票檔就是紀錄）；(e) 寫信箱 `type: report` 告訴整合者哪張票停了、問題是什麼，然後結束 session，不等。與這張票無關的票照跑。cut 未通過 manifest tier 時，由 coordinator 以當下 handoff 的 `agent_id` 做 (a)–(e)。
- **待人工驗收**：票上有任何 `device-or-person` 情境時，照常跑到 code-reviewer PASS，然後把 `status` 改成 `stopped — awaiting manual verification`、commit，在收工回報寫明；整合者不 merge 這條 lane，等人驗收。
- **整合者那一側**：停下的 lane（任何 `stopped — …`，含待人工驗收）不 merge，worktree 保留；別條 lane 裡直接或間接相依它的票，由整合者在整合 branch 的票檔寫 `stopped — waiting on <id>`，不派工；無關的 lane 照常 merge。批次結束時，整合者跑 agc 的批次摘要（`node <agc 安裝位置>/scripts/batch-summary.mjs <這個批次的票檔>`）印出一頁摘要，這是人類對這個批次唯一的介入點。
```

`C-C08`:

```
  - **Batch lane**: in a batch lane (defined, with its whole mechanism, only in agc's `docs/lane-protocol.md` §3) nothing waits for a typed approval. This overrides by name the Cut-Approval Gate's "ONLY after the human approved the inline cut in chat" and the Manifest tier's "HALT exactly as today": a cut the Manifest tier does not approve stops its ticket instead, and `cut_approved` stays unset.
```

`C-CO3`:

```
| **Batch-lane stop** — the lane is a batch lane (agc's `docs/lane-protocol.md` §3) and a row above would wait for the human, a role reports a stop condition, or a ticket with a `device-or-person` scenario reached PASS | Blocked (a PASS stays PASS) | stop the ticket per that section — ticket status, open question, dependents — and end the session without waiting; the batch summary carries it to the human | human |
```

`C-CO7` (appended to the end of step 6, after `wait.`):

```
 In a batch lane nothing waits for the human: see the *Batch-lane stop* Escalation Routes row.
```

`C-IN1`:

```
  - **Batch lane** (agc's `docs/lane-protocol.md` §3): it never waits for a typed approval — whatever needs the human stops that ticket in its ticket file and the lane reports the stop; you neither wait on it nor relay an approval, and the other lanes run on.
```

`C-IN2`:

```
   - **A stopped batch lane** (any `stopped — …` ticket status, `awaiting manual verification` included) is not merged and keeps its worktree; on the integration branch set every ticket that depends on it, directly or transitively, to `stopped — waiting on <id>` and do not dispatch it; merge the unrelated lanes as usual.
```

`C-IN3`:

```
   - **Batch summary**: for a batch, the final report carries the output of `node <agc install>/scripts/batch-summary.mjs <the batch's ticket files>` — the human's single touchpoint for the batch; it reads ticket files and reports and writes nothing.
```

`C-QA`:

```
   - **Ticket verification field**: with a ticket file, replace the `Verification: automated test` line of each scenario you wrote a test for with `Verification: test <test file path> — <full nested title>` (the names of the enclosing groups and of the test, joined by ` > `). Edit only that line, never a Given, When or Then line.
```

`C-CR`:

```
4a. **Named tests**: for each scenario whose verification line names a test (`Verification: test <file> — <title>`), confirm a test with that full nested title exists in that file and its assertions check that scenario; a name that matches no test, or a test that checks something else, is a `required` finding (test defect).
```

`C-TF1`:

```
Two reasons have a fixed wording, so that a summary can read them. `stopped — waiting on <id>`: this ticket depends, directly or through other tickets, on ticket `<id>`, which stopped with an open question; when more than one such ticket stopped, list every id, separated by `, `. `stopped — awaiting manual verification`: every scenario that automation can check passed, and a `device-or-person` scenario is still to be checked. Any other stop states its question in an `## Open question` section (see *Batch summary*).
```

`C-TF2`:

````
## Batch summary

When tickets run as a batch, nobody is asked anything while the batch runs. A ticket stops in only two cases: a scenario is wrong (contradictory, missing a case that changes behaviour, impossible to build, or needing a change or removal), or the work needs something the ticket did not authorise (a file outside `allowed paths`, a schema change, an external contract, or any other decision only a person may make). Everything else, whoever does the work decides and records. At the end one summary lists, for the person who rules on the batch:

| summary item | where it is recorded |
|---|---|
| done | `status: done` |
| stopped, with its question | `status: stopped — <reason>`, and the question in an `## Open question` section |
| waiting, with the ticket it waits on | `status: stopped — waiting on <id>` |
| awaiting manual verification | `status: stopped — awaiting manual verification`; the summary names each `device-or-person` scenario |
| scenarios added during the work | the `## Added during build` section |
| decisions made during the work | a `## Decisions made during the work` section, one list item per decision: `- <who>, <YYYY-MM-DD>: <decision> — <reason>` |
| interface details the test author decided | the test author's report, outside the ticket file (location: *Checking with this repository's tooling*) |
| accepted visual differences | the visual review's report, outside the ticket file (location: *Checking with this repository's tooling*) |

`## Open question` and `## Decisions made during the work` are free prose: like `## Context`, they go between the field block and `## Scenarios`. Writing them, changing `status` and filling in a test name do not change a scenario.
````

`C-TF3` (new last paragraph of `## Checking with this repository's tooling`):

```
The batch summary is `node scripts/batch-summary.mjs [--reports <dir>] [<file or directory> ...]`. It summarises the given ticket files (no argument: every ticket file in the ticket directory, as above) and reads reports from `--reports` (default `qa_reports`): the `## Open Interface Details` section of each `tests_<feature>.md` and the `## Allowed Differences` section of each `visual_<task id>.md` whose file name holds a summarised ticket's id as a whole word (bounded by the start or end of the name, `_`, `-` or `.`; case ignored). A missing reports directory means no reports. It writes nothing. A ticket file with format problems is listed under `unreadable tickets` with its problem count and not summarised. Exit status: 0 when it printed the summary, 2 when it cannot run (unknown option, `--reports` without a directory, unreadable ticket file, directory or reports directory).
```

`C-BS` (stdout, in this order; `<k>` counts the items of a group; a group with 0 items prints only its header line; ids and file names sorted; item lines are indented two spaces, question lines four):

```
batch-summary: <n> ticket(s)
done (<k>):
  <id> — <title>
not started (<k>):
  <id> — <title>
stopped (<k>):
  <id> — <reason>
    question: <each non-blank line of ## Open question, one per line; "(none recorded)" when the section is absent or empty>
waiting (<k>):
  <id> — waiting on <ids as written in the status>
awaiting manual verification (<k>):
  <id> — <scenario id>: <device-or-person check text, or "(no check text)">
added scenarios (<k>):
  <id> <scenario id> — <scenario title> (<text after "Added: ">)
qa interface decisions (<k>):
  <id> <report path>: <line>
allowed visual differences (<k>):
  <id> <report path>: <line>
agent decisions (<k>):
  <id>: <list item text without the leading "- ">
unreadable tickets (<k>):
  <file>: <n> problem(s)
```

Report and section lines: each non-blank line of the section up to the next `## ` heading, trimmed, except a table separator row (`|---|…`). Messages: no ticket directory → stdout `batch-summary: no ticket directory at <dir>; 0 ticket(s)`, exit 0. Errors (stderr, exit 2): `batch-summary: unknown option <opt>`, `batch-summary: --reports needs a directory`, `batch-summary: cannot read <path>: <reason>`.

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Any server gate, error code, `GATE_REGISTRY` entry (stays 33) or `UPDATE_STATE_GATE_PIPELINE` step (stays 17); no `.ts` change, so no `dist/` change.
- E430 mailbox rules, E426 PM rules (who may append scenarios, how the spec cites the ticket), the E443 launcher, and the behaviour of `scripts/check-scenario-tests.mjs`.
- `tools/ticket-file.ts`, `package.json` and `CLAUDE.md`: not touched (the script imports the existing `parseTicketFile` and `resolveTicketDir` from `dist/`, as `scripts/check-scenario-tests.mjs` does; no npm script alias).
- Marking dependents in other lanes automatically, or any script that writes ticket files: the summary only reports.
- `docs/backlog.md` done-marks for E425 and E427, the queue rows and the release: the integrator's (5c) and release-engineer's, after PASS.
- Integrator auto-decisions from discussion 16.1 ruling 16 (an E443 item).

## Dependencies / Prerequisites

No `design/e425-stop-ticket-batch.md`: mode no-design, so Visual Structural Assertions are omitted. No external reference (the Resource Audit grep found only repo-internal docs). Base `976a7890`; the PM probe on that base: `node scripts/test-lock.mjs -- npm test` → 4743 pass / 0 fail / 3 skipped of 4746, so no red test file exists before this lane's edits.

**Reader tests (literal grep, edits not yet made).** The design keeps every existing pinned line byte-unchanged: new text goes on new lines, except the three appended suffixes `C-LP1` and `C-LP3` (literal grep: no test pins either lane-protocol line) and `C-CO7` (no test pins coord-07 step 6). Expected red after the content edits, all fixed by re-capture and none by editing the test file:

| test file | why it turns red | reader in the wave table? | fixed by |
|---|---|---|---|
| `test/compose-equivalence.test.mjs` | six constitution goldens hold const-08 | yes (const-08 readers) | T-E425-06 re-capture |
| `test/skill-manifest.test.mjs` | coordinator monolith golden holds coord-03 / coord-07 | yes (coord-03 / coord-07 readers) | T-E425-06 re-capture |
| `test/context-budget.test.mjs` | design-armed constitution cap 9236, non-design cap 7324 and teamwork bundle cap 19221 are zero-headroom | yes (owned) | T-E425-06 re-baseline |

Pins checked and left green by placement: `test/e290-lane-protocol-generic.test.mjs` (eight `## ` headings, repo-only strings: the new subsection is `###`), `test/e433-test-first-rules.test.mjs` AC13 (line 37 index: nothing inserted before line 41), `test/e383-…` / `test/e385-…` (adjacent §3 sub-items untouched), `test/e178a-integrator-role.test.mjs` / `test/e286-integrator-trust-and-git.test.mjs` (the "approves each lane **once**" sentence kept), `test/e295-hop-cap-and-sop-halves.test.mjs` AC4 (the new coord-03 row has no `HOP_CAP_EXCEEDED`), `test/e453-served-text-v5.test.mjs` (pinned lines untouched), `test/e422-ticket-format-doc.test.mjs` (status rows, headings and the tooling section stay last). Any other red the qa run finds is reported in the hand-off, never edited outside this lane's owned set.

**Context-budget delta (estimate, `ceil(chars / 4)`).** `C-C08` ≈ +100 ~tok on both constitution arms (design-armed cap 9236 → ≈ 9336; non-design 7324 → ≈ 7424); teamwork bundle 19221 → ≈ 19450 (`C-C08` +100, `C-CO3` +105, `C-CO7` +24 = +229). Against the E418 saving (coordinator bundle −2490, design-armed constitution −1065, non-design −985) that gives back about 9%, 9% and 10%. The measured values replace these estimates at T-E425-06; the lean always-on bundle (6003) and the role caps (pm, sr-engineer, spec-workshop) do not move. qa-engineer, code-reviewer and integrator SOPs have no cap.

**Planned return (wave R3 (b)).** Goldens and caps can only be measured after the content edits: after T-E425-05, sr-engineer returns to qa-engineer once (`sr_return` 1), qa-engineer re-captures (T-E425-06) and hands back to sr-engineer, which confirms nothing to build and hands to code-reviewer.

**Open questions (needs human ruling — answers recorded here).**

1. *What makes a lane a batch lane?* (option choice) — (a) **recommended**: derived, no new marker: the lane comes from a manifest with a `人類` Decisions row, every ticket of the lane is a ticket file, and its `approval` cell is not `human` (as `C-LP2` reads); (b) an explicit marker in the manifest — not possible in this lane, since the `approval` cell accepts only `human`/`—`/empty and `tools/fanout-manifest.ts` is outside the owned set; (c) only lanes the E443 launcher opens — leaves the rule dormant until E443. Consequence of (a), for the human to weigh: any adopter lane whose `approval` cell is not `human` and whose tickets are all ticket files will, when its cut fails the manifest tier, stop the ticket and end the session instead of presenting the cut to a human sitting there; to keep a lane attended, write `human` in that lane's `approval` cell. This repository has no ticket directory today, so it is unaffected.
2. *Where are agent decisions recorded?* — **recommended**: in the ticket file, `## Decisions made during the work` (decisions about the work belong with the work and are readable without agc; the original item (5) said "from the ticket files alone"); alternative: a report file under `qa_reports/`, keeping the ticket file free of anything but scenarios.
3. *Does the summary print more than the eight items?* — **recommended**: yes, two extra groups, `not started` (a batch ticket nobody reached would otherwise be invisible) and `unreadable tickets` (a malformed file must not vanish silently); alternative: the eight items only.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E425-01 | qa-engineer: write the AC1–AC14 scenario tests (summary fixtures in temp dirs) and `qa_reports/expected-red_e425-stop-ticket-batch.txt`; test report with the Scenario → Test Map | none | 2 | `test/e425-*.test.mjs` | — |
| T-E425-02 | sr-engineer: lane protocol and ticket format text — `C-LP1`, `C-LP2`, `C-LP3`, `C-TF1`, `C-TF2`, `C-TF3` (AC1, AC5, AC6, AC8 and AC10 text) | T-E425-01 | 2 | `docs/lane-protocol.md`, `docs/ticket-format.md` | — |
| T-E425-03 | sr-engineer: constitution, coordinator and integrator text — `C-C08`, `C-CO3`, `C-CO7`, `C-IN1`..`C-IN3` (AC2, AC3, AC4, AC14) | T-E425-01 | 4 | `content/const-08-chain-31-mid.md`, `content/coord-03-core-fallback.md`, `content/coord-07-core-sop.md`, `content/skill-integrator.md` | — |
| T-E425-04 | sr-engineer: E427 amendment (2) SOP sentences — `C-QA`, `C-CR` (AC13, AC14) | T-E425-01 | 2 | `content/skill-qa-engineer.md`, `content/skill-code-reviewer.md` | — |
| T-E425-05 | sr-engineer: `scripts/batch-summary.mjs` per `C-BS` and `C-TF3`, importing `parseTicketFile` / `resolveTicketDir` from `dist/` (AC7–AC12); then the planned return to qa-engineer | T-E425-01 | 1 | `scripts/batch-summary.mjs` | — |
| T-E425-06 | qa-engineer (planned return): re-capture the seven goldens, re-set the three caps to measured values with a per-hunk comment and the E418 delta (AC15) | T-E425-02, T-E425-03, T-E425-04, T-E425-05 | 8 | `test/fixtures/compose-golden/**`, `test/context-budget.test.mjs` | — |
