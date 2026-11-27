// Coded by @qa-engineer
// Tests (T-E425-01, T-E425-07) for specs/e425-stop-ticket-batch.md AC1-AC16 (E425 stop-ticket batch).
// WHY: a batch ticket that needs a ruling stops only itself and its dependents, and the human gets one summary
// instead of being asked mid-run; the rule lives once in docs/lane-protocol.md §3 and the rest point at it.
// Copy / Strings are pinned verbatim; scripts/batch-summary.mjs is driven as a black box over temp dirs.
// Each title starts with its AC id. FROZEN literals come from the spec and the served text at base 3de5b143,
// never read through git or from the growable spec.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf-8");
const count = (hay, needle) => hay.split(needle).length - 1;
const norm = (s) => s.replace(/\s+/g, " ").trim();
const cells = (row) => row.split("|").slice(1, -1).map((c) => c.trim());
const stripOrigin = (t) => t.replace(/<!-- origin:start -->[\s\S]*?<!-- origin:end -->/g, "");

const { buildPromptForRole } = await import(path.join(ROOT, "dist", "prompts", "build.js"));
const { setActiveStorage, FileHandoffStorage } = await import(path.join(ROOT, "dist", "tools", "storage.js"));
const { parseTicketFile } = await import(path.join(ROOT, "dist", "tools", "ticket-file.js"));

const SCRIPT = path.join(ROOT, "scripts", "batch-summary.mjs");
const CHECK_TICKETS = path.join(ROOT, "scripts", "check-tickets.mjs");

// ------------------------------------------------------------------ frozen literals
// COPY: the spec's Copy / Strings blocks, verbatim (leading spaces are part of the appended suffixes and the
// sub-bullet indents). CUT_LINE / MANIFEST_LINE: the served Cut-Approval Gate and Manifest-tier lines before
// this lane (AC2: byte-unchanged). ESC_ROWS: the served coordinator Escalation Routes rows before this lane
// (AC3: byte-unchanged, header and separator included).
// E443b re-pin: C-LP2's first bullet ends with the cut's Copy lp.s3-launcher (appended, no space).
const FROZEN = {
  "COPY": {
    "C-LP1": " 例外：批次 lane 不等任何打字核准，見本節末的 *批次 lane*。",
    "C-LP3": " 批次 lane 不把 cut 呈給人類，見 §3 的 *批次 lane*。",
    "C-LP2": "### 批次 lane\n\n本小節是批次 lane 的唯一規則來源。它指名覆寫四處，只對批次 lane 生效，其餘 lane 照舊：本節第一條的「一律等人類在你這個 session 親手打字」、§5 規則 2 *cut 預審* 的「只有條件不成立……才把 cut 呈給人類」、憲法 §3.1 Cut-Approval Gate 的「人類在對話中核准 cut 之後」，以及 §3.1 Manifest tier 的「HALT exactly as today」。\n\n- **什麼是批次 lane**：三項都成立——(a) lane 從已核准的波次表（fan-out 清單）啟動：清單的 Decisions 表有 `人類` 列、Lanes 表有這條 lane；(b) 這條 lane 的每張票都是票檔（格式見 agc 的 `docs/ticket-format.md`）；(c) 這條 lane 在 Lanes 表的 `approval` 欄不是 `human`。批次 lane 由整合者跑 agc 的啟動器（`node <agc 安裝位置>/scripts/lane-launch.mjs <清單>`）開出 session，不由人類貼派工 prompt；啟動器拒絕的波次照舊由人類開。\n- **不等打字核准**：批次 lane 從不等人類打字。cut 只能由憲法 §3.1 manifest tier 自動核准；manifest tier 的條件不成立，就停票（見下），不呈給人類、不等，也不寫 `cut_approved`。政策裁決、lease override、hop 或輪數上限用完也一樣：凡是要人類決定的事，一律停票。\n- **只在兩種情況停票**：(1) 情境本身有問題：互相矛盾、漏了會改變行為的情況、做不出來，或需要修改、刪除一條既有情境；(2) 工作需要票沒授權的東西：允許路徑以外的檔案、schema 變更、對外合約，或上一條任何要人類決定的事。其餘都由做事的角色自己決定並記錄（記在哪裡見票檔格式的 *Batch summary*），不停。\n- **情境只能追加**：開工後情境只能照票檔格式追加在 `## Added during build`，不能修改或刪除。\n- **怎麼停**：遇到停票情況的角色 (a) 把票檔的 `status` 改成 `stopped — <理由>`，理由點名卡住的東西，例如允許路徑以外的那個路徑；(b) 在票檔的 `## Open question` 寫下要人類裁定的問題；(c) 同一條 lane 裡直接或間接相依這張票的票，`status` 改成 `stopped — waiting on <id>`，`<id>` 是這張停下的票；(d) commit，server 接受時寫 `tw_update_state(status=Blocked)`，`blocking_reason` 就是那行 status（hop 或輪數上限用完時 server 只接受 `pm:In_Progress`，那就不寫，票檔就是紀錄）；(e) 寫信箱 `type: report` 告訴整合者哪張票停了、問題是什麼，然後結束 session，不等。與這張票無關的票照跑。cut 未通過 manifest tier 時，由 coordinator 以當下 handoff 的 `agent_id` 做 (a)–(e)。\n- **待人工驗收**：票上有任何 `device-or-person` 情境時，照常跑到 code-reviewer PASS，然後把 `status` 改成 `stopped — awaiting manual verification`、commit，在收工回報寫明；整合者不 merge 這條 lane，等人驗收。\n- **整合者那一側**：停下的 lane（任何 `stopped — …`，含待人工驗收）不 merge，worktree 保留；別條 lane 裡直接或間接相依它的票，由整合者在整合 branch 的票檔寫 `stopped — waiting on <id>`，不派工；無關的 lane 照常 merge。批次結束時，整合者跑 agc 的批次摘要（`node <agc 安裝位置>/scripts/batch-summary.mjs <這個批次的票檔>`）印出一頁摘要，這是人類對這個批次唯一的介入點。",
    "C-C08": "  - **Batch lane**: in a batch lane (defined, with its whole mechanism, only in agc's `docs/lane-protocol.md` §3) nothing waits for a typed approval. This overrides by name the Cut-Approval Gate's \"ONLY after the human approved the inline cut in chat\" and the Manifest tier's \"HALT exactly as today\": a cut the Manifest tier does not approve stops its ticket instead, and `cut_approved` stays unset.",
    "C-CO3": "| **Batch-lane stop** — the lane is a batch lane (agc's `docs/lane-protocol.md` §3) and a row above would wait for the human, a role reports a stop condition, or a ticket with a `device-or-person` scenario reached PASS | Blocked (a PASS stays PASS) | stop the ticket per that section — ticket status, open question, dependents — and end the session without waiting; the batch summary carries it to the human | human |",
    "C-CO7": " In a batch lane nothing waits for the human: see the *Batch-lane stop* Escalation Routes row.",
    "C-IN1": "  - **Batch lane** (agc's `docs/lane-protocol.md` §3): it never waits for a typed approval — whatever needs the human stops that ticket in its ticket file and the lane reports the stop; you neither wait on it nor relay an approval, and the other lanes run on.",
    "C-IN2": "   - **A stopped batch lane** (any `stopped — …` ticket status, `awaiting manual verification` included) is not merged and keeps its worktree; on the integration branch set every ticket that depends on it, directly or transitively, to `stopped — waiting on <id>` and do not dispatch it; merge the unrelated lanes as usual.",
    "C-IN3": "   - **Batch summary**: for a batch, the final report carries the output of `node <agc install>/scripts/batch-summary.mjs <the batch's ticket files>` — the human's single touchpoint for the batch; it reads ticket files and reports and writes nothing.",
    "C-QA": "   - **Ticket verification field**: with a ticket file, replace the `Verification: automated test` line of each scenario you wrote a test for with `Verification: test <test file path> — <full nested title>` (the names of the enclosing groups and of the test, joined by ` > `). Edit only that line, never a Given, When or Then line.",
    "C-CR": "4a. **Named tests**: for each scenario whose verification line names a test (`Verification: test <file> — <title>`), confirm a test with that full nested title exists in that file and its assertions check that scenario; a name that matches no test, or a test that checks something else, is a `required` finding (test defect).",
    "C-TF1": "Two reasons have a fixed wording, so that a summary can read them. `stopped — waiting on <id>`: this ticket depends, directly or through other tickets, on ticket `<id>`, which stopped with an open question; when more than one such ticket stopped, list every id, separated by `, `. `stopped — awaiting manual verification`: every scenario that automation can check passed, and a `device-or-person` scenario is still to be checked. Any other stop states its question in an `## Open question` section (see *Batch summary*).",
    "C-TF2": "## Batch summary\n\nWhen tickets run as a batch, nobody is asked anything while the batch runs. A ticket stops in only two cases: a scenario is wrong (contradictory, missing a case that changes behaviour, impossible to build, or needing a change or removal), or the work needs something the ticket did not authorise (a file outside `allowed paths`, a schema change, an external contract, or any other decision only a person may make). Everything else, whoever does the work decides and records. At the end one summary lists, for the person who rules on the batch:\n\n| summary item | where it is recorded |\n|---|---|\n| done | `status: done` |\n| stopped, with its question | `status: stopped — <reason>`, and the question in an `## Open question` section |\n| waiting, with the ticket it waits on | `status: stopped — waiting on <id>` |\n| awaiting manual verification | `status: stopped — awaiting manual verification`; the summary names each `device-or-person` scenario |\n| scenarios added during the work | the `## Added during build` section |\n| decisions made during the work | a `## Decisions made during the work` section, one list item per decision: `- <who>, <YYYY-MM-DD>: <decision> — <reason>` |\n| interface details the test author decided | the test author's report, outside the ticket file (location: *Checking with this repository's tooling*) |\n| accepted visual differences | the visual review's report, outside the ticket file (location: *Checking with this repository's tooling*) |\n\n`## Open question` and `## Decisions made during the work` are free prose: like `## Context`, they go between the field block and `## Scenarios`. Writing them, changing `status` and filling in a test name do not change a scenario.",
    "C-TF3": "The batch summary is `node scripts/batch-summary.mjs [--reports <dir>] [<file or directory> ...]`. It summarises the given ticket files (no argument: every ticket file in the ticket directory, as above) and reads reports from `--reports` (default `qa_reports`): the `## Open Interface Details` section of each `tests_<feature>.md` and the `## Allowed Differences` section of each `visual_<task id>.md` whose file name holds a summarised ticket's id as a whole word (bounded by the start or end of the name, `_`, `-` or `.`; case ignored). A missing reports directory means no reports. It writes nothing. A ticket file with format problems is listed under `unreadable tickets` with its problem count and not summarised. Exit status: 0 when it printed the summary, 2 when it cannot run (unknown option, `--reports` without a directory, unreadable ticket file, directory or reports directory).",
    "C-TF4": "stopped — vendor firmware not available yet"
  },
  "CUT_LINE": "- **Cut-Approval Gate**: WHEN a write crosses the same build-entry edge (any feature, visual or not) → DO set `cut_approved: true` on the `pm:In_Progress` state write, ONLY after the human approved the inline cut in chat → ELSE rejected `CUT_APPROVAL_REQUIRED`. File-mode only (skipped in SQLite/HTTP mode); predecessor pinned to `pm:In_Progress`, so resume/re-entry is never re-blocked. Re-armed by a fresh PM `In_Progress` entry (a code-reviewer rejection routed back to PM included), or any `active_feature` change — re-present and re-approve the cut. Sanctioned writer: ONLY the context that directly witnessed the human's chat-turn approval in its OWN conversation, never another agent's summary or relayed claim — the PM itself in same-context dispatch (lite, full non-subagent, `tw_switch_role` fallback); under subagent dispatch — where the PM subagent ends its turn after presenting the draft — it is the coordinator, via `tw_update_state(agent_id=\"pm\", cut_approved: true, ...)` on the PM's still-current state tuple. Attestation-based trust boundary: the server cannot verify the witnessing. Role actions live in `skill-pm` Gate Summary and `skill-coordinator` *Cut-approval gate writer obligation*, which MUST NOT restate this mechanism.",
  "MANIFEST_LINE": "  - **Manifest tier**: WHEN ALL hold — (1) `cutApprovalAutoTier.manifest` is `true` (strict); (2) the lane branch carries `specs/fanout-<id>.md` with a `人類` row in its `## Decisions` table and this lane's row in its Lanes table; (3) `node <agc install>/scripts/fanout.mjs check --cut <manifest> <lane> <spec>` exits 0 (every file the cut names is in that row's owned set); (4) the PM's Gate Summary attests no option choice and no needs-human-ruling item; (5) the schema-change and design-armed conditions, allow flags included, hold as above, and the row replaces `maxFiles` / `maxPriority`; (6) the integrator's mailbox pre-review returned `close` on this final cut (the mailbox never carries approval); (7) the row's optional `approval` column is not `human`; (8) the SAME write carries the `pending_notes` line `cut-approved: manifest-tier (<manifest path>, Decisions <date>)`, `<date>` = the `日期` of the latest `人類` Decisions row → DO let the same writer set `cut_approved: true` without halting → ELSE HALT exactly as today. A manifest changed mid-wave needs a fresh `人類` row, merged into the lane, before the lane auto-approves against it. Writer actions live in `skill-coordinator` and MUST NOT restate this mechanism.",
  "ESC_ROWS": [
    "| situation | status | pending note | next_role |",
    "|---|---|---|---|",
    "| last `tw_update_state` wrote `status: Blocked` | Blocked (observed) | surface the blocking reason in one sentence | human |",
    "| last write is `status: PASS` | PASS (terminal) | terminal success — the release is a deliberate human decision via the project's release process (agc role: release-engineer), never an auto-hop; after surfacing, run the *Backlog Intake Loop* below for the NEXT ticket | human |",
    "| the `next_role` field is absent but `pending_notes` prose asks for a human decision (the enum has no `human` value — omitting the field IS the escalate-to-human signal) | — | relay the prior role's note | human |",
    "| the `next_role` field is absent with no escalation prose | — | surface as ambiguous — the prior role forgot or finished without nominating a successor | human |",
    "| `hop_count` from `tw_get_state` ≥ the `hop` cap for the active feature, or a write was rejected with `HOP_CAP_EXCEEDED` (server-enforced) | — | surface the hop cap (`hop_count={n}`) — autonomous dispatch is frozen at PM until a human re-scopes into a new feature or overrides. The human's only shortcut is a same-lane continuation, allowed only under the conditions in agc's `docs/lane-protocol.md` §3 | human |",
    "| **Token budget brake** — `.current/.config.json` sets `tokenBudgetPerFeature` AND the feature's running total (§Token Budget Brake) ≥ 80% of it | — | `token budget: {running_total} / {tokenBudgetPerFeature} ({pct}%) — handing to human` | human |",
    "| **Crash detection** — a dispatched subagent call returns a tool-error or an empty/truncated reply, or is reported killed (session or usage-limit kill), BEFORE that role's own `tw_update_state` landed (handoff `agent_id`/`status` unchanged since dispatch) | — | run the Crash-Resume Protocol before any resume or re-dispatch (fresh-session counterpart: the next row) | (role being resumed) |",
    "| **Stale-dispatch detection** — `tw_get_state` returns a `stale_dispatch` advisory (`dispatched_at` over 15 min old with no later write; read from persisted state, so a fresh session sees it too) | — | run the Crash-Resume Protocol before any resume or re-dispatch | (role named by `stale_dispatch.role`) |",
    "| **Claim-vs-state mismatch** — after EVERY handoff, `tw_get_state` and diff the finished role's claims (`completed_tasks`, `pending_notes`, the evidence file it names) against what landed; no gate catches this class | — | do not route on the reply — ground-truth first (Crash-Resume class), then re-dispatch with the mismatch stated in the brief | (role being re-dispatched) |",
    "| **Cut-approval gate** — `next_role` is `architect` or `qa-engineer` but `cut_approved` is unset (`CUT_APPROVAL_REQUIRED`) | — | surface the cut draft and wait — no auto-hop to build; writer obligation below (sole exception: a cut qualifying for the Constitution §3.1 Cut-Approval Auto-Tier — writer actions below, no halt) | human |",
    "| **External-refs gate** — `next_role` is `architect` or `qa-engineer` but the `external_refs` ledger has a `state: \"unresolved\"` entry (`EXTERNAL_REFS_UNRESOLVED`) | — | surface the unresolved refs and wait — no auto-hop to build; PM resolves each ref (fetch / index / user-confirm-ignorable) and re-writes the ledger | human |",
    "| **Source-credibility gate** — `next_role` is `architect` or `qa-engineer` but a fetch-based `design/<feature>.md` (`## Mode` ∈ `figma`/`sketch`/`xd`/`penpot`) has an `audited` `## Source` row lacking `credibility: full-page-composite` (`SOURCE_CREDIBILITY_UNVERIFIED`) | — | surface the offending row(s) and wait — no auto-hop to build; the design-auditor re-runs step 2b Source-Credibility Classification and records the attestation before build | human |",
    "| **Feature-lease gate** — a write for a NEW `active_feature` was rejected `FEATURE_LEASE_HELD` (see Feature-Scope Gate above) | — | surface the held lease (incumbent feature + status) and wait for PASS or lease expiry — never clobber; offer the separate-git-worktree route, with the Worktree bootstrap obligation above | human |",
    "| **Amend-Resume relay** — the PM amendment set the `resume_of` field to `code-reviewer`, with `next_role` naming that same role (routing, not a halt); a PM amendment that hands back to qa-engineer is the normal gated build entry, not this row. The same edge also carries a PM-sanctioned fresh dispatch of the judge alone (`code-reviewer`) on an evidence-only ticket — charter: Constitution §3.1 | In_Progress (routing write, `agent_id=\"code-reviewer\"`) | set the identical `resume_of` field (`code-reviewer`) on the routing write — the server rejects the resume edge without it (legacy `resume_of:` pending_notes lines are inert) | code-reviewer |",
    "| visual work complete but no independent judge context (`reviewer-visual`/`code-reviewer` hit a rate/session/weekly limit) and the coordinator has been building inline | Blocked | \"awaiting an independent judge\" — the builder of a surface MUST NOT author its visual verdict or PASS (builder ≠ judge, §3) | human |"
  ]
};
const C = FROZEN.COPY;

// ------------------------------------------------------------------ helpers

const BUILD_SEP = "\n\n---\n\n";
const FEATURE = "e425-probe-feat";
async function makeWorkspace({ design }) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e425-ws-"));
  setActiveStorage(new FileHandoffStorage());
  await new FileHandoffStorage().writeState(ws, FEATURE, "In_Progress", [], []);
  if (design) {
    fs.mkdirSync(path.join(ws, "design"), { recursive: true });
    fs.writeFileSync(path.join(ws, "design", `${FEATURE}.md`), "# Design\n\n## Mode\n\nfigma\n");
  }
  return ws;
}
const built = (skillFile, ws) => buildPromptForRole(skillFile, "e425", ws, false).messages[0].content.text;
const constitutionOf = (t) => {
  const i = t.indexOf(BUILD_SEP);
  assert.notEqual(i, -1, "no skill separator in prompt output");
  return t.slice(0, i);
};
const skillOf = (t) => t.slice(t.indexOf(BUILD_SEP) + BUILD_SEP.length);

// Lines of `ls` from the first line matching `start` up to (excluding) the first later line matching `end`.
function block(ls, start, end) {
  const at = ls.findIndex(start);
  assert.ok(at >= 0, `start line present: ${start}`);
  let stop = ls.findIndex((l, i) => i > at && end(l));
  if (stop < 0) stop = ls.length;
  return ls.slice(at, stop);
}
const nonBlank = (ls) => ls.filter((l) => l.trim() !== "");

const tmp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), `e425-${prefix}-`));
const write = (dir, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};
const DEFAULT_SCENARIO = [
  "### S1 — Works",
  "",
  "- Given a report",
  "- When it is exported",
  "- Then the file is written",
  "- Verification: automated test",
].join("\n");
const DEVICE_SCENARIO = [
  "### S3 — Opens in a spreadsheet",
  "",
  "- Given an exported file",
  "- When it is opened in a spreadsheet application",
  "- Then the columns line up",
  "- Verification: device-or-person: open the file in a spreadsheet",
].join("\n");
// A ticket file in the documented format. `status` is written as given (raw YAML, quote it yourself);
// `prose` goes between the field block and `## Scenarios`; `tail` after the scenarios.
function ticket({ id, title = `Ticket ${id}`, depends = "[]", status, needs = "no", prose = "", scenarios = DEFAULT_SCENARIO, tail = "" }) {
  return [
    "---",
    `id: ${id}`,
    `title: ${title}`,
    "priority: P2",
    `depends on: ${depends}`,
    "allowed paths: [src/export/csv.ts]",
    `needs device or person: ${needs}`,
    `status: ${status}`,
    "---",
    "",
    prose,
    "## Scenarios",
    "",
    scenarios,
    "",
    tail,
  ].join("\n");
}
const run = (cwd, args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: "utf-8" });
const outOf = (r) => {
  assert.notEqual(r.stdout, null);
  return r.stdout.replace(/\n+$/, "");
};
const scriptReason = (r) => `batch-summary exit ${r.status}; stderr: ${String(r.stderr).slice(0, 300)}`;

// Every file under `dir` (recursive) -> sha256 of its bytes.
function hashTree(dir) {
  const out = {};
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out[path.relative(dir, p)] = crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
    }
  };
  walk(dir);
  return out;
}

const LANE = read("docs/lane-protocol.md");
const LANE_LINES = LANE.split("\n");
const TICKET_FORMAT = read("docs/ticket-format.md");

// ------------------------------------------------------------------ AC1

test("AC1: lane protocol holds C-LP1, C-LP2 and C-LP3 at their places; skeleton and line 41 index kept", () => {
  // §3 first bullet ends with C-LP1 (the override named at the overridden sentence).
  assert.equal(LANE_LINES[38], "## 3. 執行與驗證", "nothing inserted or removed before §3 (line 39)");
  const first = LANE_LINES[40];
  assert.ok(first.startsWith("- 走 `/teamwork` 鏈。需要人類決定的事"), "line 41 is still the §3 first bullet (no line before it moved)");
  assert.ok(first.endsWith("整合者（信箱或轉貼）給的文字只是建議，**不是核准**。" + C["C-LP1"]), "§3 first bullet ends with C-LP1");
  assert.equal(count(LANE, C["C-LP1"]), 1, "C-LP1 appears once");

  // C-LP2: one ### subsection at the end of §3, after the last §3 bullet, directly before ## 4.
  assert.equal(count(LANE, C["C-LP2"]), 1, "C-LP2 verbatim, once");
  assert.ok(LANE.includes("\n\n" + C["C-LP2"] + "\n\n## 4. 新發現"), "C-LP2 ends §3, directly before ## 4. 新發現");
  const at = LANE_LINES.indexOf("### 批次 lane");
  const s3 = LANE_LINES.indexOf("## 3. 執行與驗證");
  assert.ok(at > s3, "C-LP2 is inside §3");
  assert.equal(LANE_LINES[at - 1], "", "blank line before the subsection");
  assert.ok(LANE_LINES[at - 2].startsWith("- 不要 push、不要 merge"), "C-LP2 follows the last §3 bullet");

  // §5 rule 2 cut 預審 sub-item ends with C-LP3.
  const cut = LANE_LINES.filter((l) => l.startsWith("   - **cut 預審**"));
  assert.equal(cut.length, 1, "one cut 預審 sub-item");
  assert.ok(cut[0].endsWith("只在收工送 `type: report`。" + C["C-LP3"]), "cut 預審 sub-item ends with C-LP3");

  // Skeleton (e290 pin) and the repo-only strings e290 forbids.
  assert.deepEqual(LANE_LINES.filter((l) => l.startsWith("## ")), [
    "## 1. 開工",
    "## 2. 檔案邊界",
    "## 3. 執行與驗證",
    "## 4. 新發現",
    "## 5. 信箱（lane ↔ 整合者）",
    "## 6. 收工回報格式",
    "## Lane report: <lane> / <票>",
    "## 7. 中途修 base（整合者把目標分支 merge 進 lane）",
  ]);
  for (const s of [
    "node bin/agc-init.mjs", "npm run build", "rm node_modules", "dist/", "tasks-index-receipt.json",
    "check-md-tables", "test/e130-lane-default.test.mjs", "NEW-TICKETS.md", "node scripts/fanout.mjs",
    "註解 proof", "compose-golden", "context-budget", "content/**", "test/",
  ]) assert.ok(!LANE.includes(s), `lane protocol must not contain the repo-only string: ${s}`);
});

// ------------------------------------------------------------------ AC2

test("AC2: C-C08 is served once, directly after the Manifest-tier line, on both arms; lite does not carry it", async () => {
  for (const design of [true, false]) {
    const ws = await makeWorkspace({ design });
    const cons = constitutionOf(built("skill-sr-engineer.md", ws));
    const ls = cons.split("\n");
    assert.equal(count(cons, C["C-C08"]), 1, `C-C08 appears exactly once (design=${design})`);
    assert.equal(ls.filter((l) => l === FROZEN.CUT_LINE).length, 1, `Cut-Approval Gate line byte-unchanged (design=${design})`);
    const m = ls.indexOf(FROZEN.MANIFEST_LINE);
    assert.ok(m >= 0, `Manifest-tier line byte-unchanged (design=${design})`);
    assert.equal(ls[m + 1], C["C-C08"], `C-C08 is the line directly after the Manifest-tier line (design=${design})`);
  }
  const ws = await makeWorkspace({ design: false });
  const lite = built("skill-coordinator-lite.md", ws);
  assert.ok(!lite.includes("**Batch lane**: in a batch lane"), "lite composition does not carry C-C08");
});

// ------------------------------------------------------------------ AC3

test("AC3: coordinator Escalation Routes ends with the C-CO3 row, other rows unchanged; step 6 ends with C-CO7", async () => {
  const ws = await makeWorkspace({ design: false });
  const skill = skillOf(built("skill-coordinator.md", ws));
  const ls = skill.split("\n");
  const rows = block(ls, (l) => l === "## Escalation Routes", (l) => l.startsWith("## ")).filter((l) => l.startsWith("|"));
  assert.equal(rows[rows.length - 1], C["C-CO3"], "the last Escalation Routes row is C-CO3");
  assert.equal(rows.filter((r) => r.includes("Batch-lane stop")).length, 1, "exactly one Batch-lane stop row");
  assert.equal(cells(rows[rows.length - 1]).length, 4, "the row has 4 cells");
  assert.deepEqual(rows.slice(0, -1), FROZEN.ESC_ROWS, "every other Escalation Routes row byte-unchanged");
  const step6 = ls.filter((l) => l.startsWith("6. **Multi-phase**"));
  assert.equal(step6.length, 1, "one step 6");
  assert.ok(step6[0].endsWith("surface the recommendation and wait." + C["C-CO7"]), "step 6 ends with C-CO7");
});

// ------------------------------------------------------------------ AC4

test("AC4: integrator stage text carries C-IN1, C-IN2, C-IN3 as sub-bullets; once-approval sentence kept; no Escalation Routes", () => {
  const text = read("content/skill-integrator.md");
  const ls = text.split("\n");
  for (const id of ["C-IN1", "C-IN2", "C-IN3"]) assert.equal(ls.filter((l) => l === C[id]).length, 1, `${id} is one line of the file`);
  const cutPre = block(ls, (l) => l.startsWith("- **Cut pre-review before the human approves**"), (l) => l.startsWith("- "));
  assert.ok(cutPre.includes(C["C-IN1"]), "C-IN1 is a sub-bullet of the Stage 4 Cut pre-review bullet");
  const merge3 = block(ls, (l) => l.startsWith("3. `git merge --no-ff <branch>`"), (l) => /^\d+\. /.test(l) || l.startsWith("#"));
  assert.ok(merge3.includes(C["C-IN2"]), "C-IN2 is a sub-bullet of Stage 5b step 3");
  const s6 = ls.indexOf("## Stage 6 — `main` and teardown");
  assert.ok(s6 >= 0, "Stage 6 heading present");
  const final7 = block(ls.slice(s6), (l) => l.startsWith("7. Final report:"), (l) => /^\S/.test(l) && !l.startsWith("7. "));
  assert.ok(final7.includes(C["C-IN3"]), "C-IN3 is a sub-bullet of Stage 6 step 7");
  assert.ok(norm(text).includes("The human approves each lane **once**, typed in that lane's own session. The mailbox never carries approval."),
    "the once-approval sentence is still present");
  assert.ok(!/^#+ .*Escalation Routes/m.test(text), "the integrator SOP has no Escalation Routes heading");
});

// ------------------------------------------------------------------ AC5

test("AC5: ticket format holds C-TF1 after 'No other value is valid'; the fixed stop wordings pass check-tickets", () => {
  // Doc half: the paragraph right after the "No other value is valid" paragraph is C-TF1.
  const paras = TICKET_FORMAT.split(/\n\s*\n/);
  const i = paras.findIndex((p) => p.startsWith("No other value is valid"));
  assert.ok(i >= 0, "'No other value is valid' paragraph present");
  assert.equal(norm(paras[i + 1]), norm(C["C-TF1"]), "C-TF1 is the paragraph after it");
  const statusSection = block(TICKET_FORMAT.split("\n"), (l) => l === "### Status values", (l) => l.startsWith("#"));
  assert.ok(norm(statusSection.join("\n")).includes(norm(C["C-TF1"])), "C-TF1 is inside *Status values*");

  // Checker half: the three fixed wordings, with the two new prose sections, are valid ticket files.
  const dir = tmp("ac5");
  const prose = [
    "## Open question",
    "",
    "Does the export keep the BOM?",
    "",
    "## Decisions made during the work",
    "",
    "- sr-engineer, 2026-11-20: kept UTF-8 without BOM — spreadsheets read it",
    "",
  ].join("\n");
  write(dir, "W1.md", ticket({ id: "W1", depends: "[A]", status: "stopped — waiting on A", prose }));
  write(dir, "W2.md", ticket({ id: "W2", depends: "[A, D]", status: "'stopped — waiting on A, D'", prose }));
  write(dir, "M1.md", ticket({ id: "M1", needs: "yes", status: "stopped — awaiting manual verification", prose,
    scenarios: DEFAULT_SCENARIO + "\n\n" + DEVICE_SCENARIO }));
  const r = spawnSync(process.execPath, [CHECK_TICKETS, dir], { cwd: dir, encoding: "utf-8" });
  assert.equal(r.status, 0, `check-tickets exits 0; stdout: ${r.stdout} stderr: ${r.stderr}`);
  assert.match(r.stdout, /check-tickets: 3 file\(s\), 4 scenario\(s\), 0 problem\(s\)/);
});

// ------------------------------------------------------------------ AC6

test("AC6: ticket format has ## Batch summary (C-TF2) between Named tests and Example ticket; tooling ends with C-TF3", () => {
  const ls = TICKET_FORMAT.split("\n");
  const heads = ls.filter((l) => l.startsWith("## "));
  const n = heads.indexOf("## Named tests checked in CI");
  assert.ok(n >= 0, "Named tests section present");
  assert.deepEqual(heads.slice(n, n + 3), ["## Named tests checked in CI", "## Batch summary", "## Example ticket"],
    "## Batch summary sits between ## Named tests checked in CI and ## Example ticket");
  const sec = block(ls, (l) => l === "## Batch summary", (l) => l === "## Example ticket").join("\n");
  assert.equal(norm(sec), norm(C["C-TF2"]), "the section is C-TF2 verbatim");
  const rows = sec.split("\n").filter((l) => l.startsWith("|")).slice(2).map(cells);
  assert.deepEqual(rows.map((r) => r[0]), [
    "done", "stopped, with its question", "waiting, with the ticket it waits on", "awaiting manual verification",
    "scenarios added during the work", "decisions made during the work", "interface details the test author decided",
    "accepted visual differences",
  ], "the table lists the eight summary items");
  for (const r of rows) assert.ok(r[1] && r[1].length > 0, `a recording location for: ${r[0]}`);
  assert.equal(heads[heads.length - 1], "## Checking with this repository's tooling", "tooling section stays last");
  const tooling = block(ls, (l) => l === "## Checking with this repository's tooling", () => false).join("\n");
  const paras = tooling.trimEnd().split(/\n\s*\n/);
  assert.equal(norm(paras[paras.length - 1]), norm(C["C-TF3"]), "the tooling section ends with C-TF3");
});

// ------------------------------------------------------------------ AC7

test("AC7: a stop spreads to dependents only — A stopped, B and D waiting on A, C done", () => {
  const dir = tmp("ac7");
  write(dir, "tickets/A.md", ticket({ id: "A", status: "stopped — S2 contradicts S1",
    prose: "## Open question\n\nWhich of S1 or S2 holds for an empty report?\n\n" }));
  write(dir, "tickets/B.md", ticket({ id: "B", depends: "[A]", status: "stopped — waiting on A" }));
  write(dir, "tickets/C.md", ticket({ id: "C", status: "done" }));
  write(dir, "tickets/D.md", ticket({ id: "D", depends: "[B]", status: "stopped — waiting on A" }));
  const r = run(dir, ["tickets"]);
  assert.equal(r.status, 0, scriptReason(r));
  assert.equal(outOf(r), [
    "batch-summary: 4 ticket(s)",
    "done (1):",
    "  C — Ticket C",
    "not started (0):",
    "stopped (1):",
    "  A — S2 contradicts S1",
    "    question: Which of S1 or S2 holds for an empty report?",
    "waiting (2):",
    "  B — waiting on A",
    "  D — waiting on A",
    "awaiting manual verification (0):",
    "added scenarios (0):",
    "qa interface decisions (0):",
    "allowed visual differences (0):",
    "agent decisions (0):",
    "unreadable tickets (0):",
  ].join("\n"));
});

// ------------------------------------------------------------------ AC8

test("AC8: a stop outside the allowed paths shows its reason with the path; C-LP2 requires naming it", () => {
  const dir = tmp("ac8");
  write(dir, "tickets/X1.md", ticket({ id: "X1", status: "'stopped — needs src/billing/tax.ts, outside allowed paths'" }));
  const r = run(dir, ["tickets"]);
  assert.equal(r.status, 0, scriptReason(r));
  assert.ok(outOf(r).includes([
    "stopped (1):",
    "  X1 — needs src/billing/tax.ts, outside allowed paths",
    "    question: (none recorded)",
    "waiting (0):",
  ].join("\n")), `stopped group names the path; got:\n${r.stdout}`);
  assert.ok(C["C-LP2"].includes("理由點名卡住的東西，例如允許路徑以外的那個路徑"), "spec literal sanity");
  assert.ok(LANE.includes("`status` 改成 `stopped — <理由>`，理由點名卡住的東西，例如允許路徑以外的那個路徑"),
    "lane protocol (C-LP2) requires the reason to name the blocking path");
});

// ------------------------------------------------------------------ AC9

test("AC9: added scenarios, agent decisions, qa interface decisions and allowed visual differences reach the summary", () => {
  const dir = tmp("ac9");
  const prose = [
    "## Decisions made during the work",
    "",
    "- sr-engineer, 2026-11-20: kept UTF-8 without BOM — spreadsheets read it",
    "- qa-engineer, 2026-11-21: named the flag --out — matches the other scripts",
    "",
  ].join("\n");
  const tail = [
    "## Added during build",
    "",
    "### S4 — Header names are quoted",
    "",
    "- Given a column named amount, net",
    "- When the report is exported as CSV",
    "- Then that header cell is quoted",
    "- Verification: automated test",
    "- Added: the implementer, 2026-01-15, a column name with a comma broke the header row",
    "",
  ].join("\n");
  write(dir, "tickets/E901.md", ticket({ id: "E901", title: "CSV export", status: "done", prose, tail }));
  write(dir, "qa_reports/tests_e901-csv.md", [
    "# tests", "", "## Open Interface Details", "",
    "- exit code 2 on an unknown option — follows check-tickets",
    "  - output path defaults to out.csv — no config key exists  ",
    "", "## Red Reasons", "", "- not part of the summary", "",
  ].join("\n"));
  write(dir, "qa_reports/visual_T-E901-02.md", [
    "# visual", "", "## Allowed Differences", "", "- header row anti-aliasing differs by 1px — font hinting", "",
  ].join("\n"));
  write(dir, "qa_reports/tests_e9010-other.md", [
    "# other", "", "## Open Interface Details", "", "- UNRELATED-E9010 detail", "",
  ].join("\n"));
  const r = run(dir, ["--reports", "qa_reports", "tickets"]);
  assert.equal(r.status, 0, scriptReason(r));
  const out = outOf(r);
  const expectBlock = (lines) => assert.ok(out.includes(lines.join("\n")), `summary holds:\n${lines.join("\n")}\ngot:\n${out}`);
  expectBlock([
    "added scenarios (1):",
    "  E901 S4 — Header names are quoted (the implementer, 2026-01-15, a column name with a comma broke the header row)",
  ]);
  expectBlock([
    "qa interface decisions (2):",
    "  E901 qa_reports/tests_e901-csv.md: - exit code 2 on an unknown option — follows check-tickets",
    "  E901 qa_reports/tests_e901-csv.md: - output path defaults to out.csv — no config key exists",
  ]);
  expectBlock([
    "allowed visual differences (1):",
    "  E901 qa_reports/visual_T-E901-02.md: - header row anti-aliasing differs by 1px — font hinting",
  ]);
  expectBlock([
    "agent decisions (2):",
    "  E901: sr-engineer, 2026-11-20: kept UTF-8 without BOM — spreadsheets read it",
    "  E901: qa-engineer, 2026-11-21: named the flag --out — matches the other scripts",
  ]);
  assert.ok(!out.includes("e9010") && !out.includes("E9010"), "nothing from the unrelated tests_e9010-other.md report");
  assert.ok(!out.includes("not part of the summary"), "a report section stops at the next ## heading");
});

// ------------------------------------------------------------------ AC10

test("AC10: a device-or-person ticket is listed under awaiting manual verification with its check; C-LP2 states PASS-then-stop", () => {
  const dir = tmp("ac10");
  write(dir, "tickets/M1.md", ticket({ id: "M1", needs: "yes", status: "stopped — awaiting manual verification",
    scenarios: DEFAULT_SCENARIO + "\n\n" + DEVICE_SCENARIO }));
  const r = run(dir, ["tickets"]);
  assert.equal(r.status, 0, scriptReason(r));
  const out = outOf(r);
  assert.ok(out.includes("awaiting manual verification (1):\n  M1 — S3: open the file in a spreadsheet\nadded scenarios ("),
    `awaiting manual verification lists the scenario and its check; got:\n${out}`);
  assert.ok(out.includes("stopped (0):\nwaiting (0):"), "not listed as a plain stop or a wait");
  const bullet = LANE_LINES.filter((l) => l.startsWith("- **待人工驗收**："));
  assert.equal(bullet.length, 1, "C-LP2 has the manual-verification bullet");
  assert.ok(bullet[0].includes("照常跑到 code-reviewer PASS，然後把 `status` 改成 `stopped — awaiting manual verification`"),
    "C-LP2: runs to code-reviewer PASS, then stops");
  assert.ok(bullet[0].includes("整合者不 merge 這條 lane，等人驗收"), "C-LP2: stops before merge");
});

// ------------------------------------------------------------------ AC11

test("AC11: the summary only reads — no file changes; no ticket directory and unknown option messages", () => {
  // Defaults: no positional argument reads the ticket directory (default docs/tickets), --reports defaults to qa_reports.
  const dir = tmp("ac11");
  write(dir, "docs/tickets/A.md", ticket({ id: "A", status: "stopped — S2 contradicts S1", prose: "## Open question\n\nWhich?\n\n" }));
  write(dir, "docs/tickets/B.md", ticket({ id: "B", depends: "[A]", status: "stopped — waiting on A" }));
  write(dir, "docs/tickets/README.md", "# Tickets\n\nNot a ticket file.\n");
  write(dir, "qa_reports/tests_a-x.md", "## Open Interface Details\n\n- one detail\n");
  const before = hashTree(dir);
  const r = run(dir, []);
  assert.equal(r.status, 0, scriptReason(r));
  assert.ok(outOf(r).startsWith("batch-summary: 2 ticket(s)\n"), `default ticket directory read, README.md skipped; got:\n${r.stdout}`);
  assert.ok(outOf(r).includes("qa interface decisions (1):\n  A qa_reports/tests_a-x.md: - one detail"), "default reports directory read");
  assert.deepEqual(hashTree(dir), before, "no file under the ticket or reports directory changed, none added");

  const empty = tmp("ac11-empty");
  const none = run(empty, []);
  assert.equal(none.status, 0, scriptReason(none));
  assert.equal(outOf(none), "batch-summary: no ticket directory at docs/tickets; 0 ticket(s)");
  assert.deepEqual(fs.readdirSync(empty), [], "nothing created");

  const bad = run(dir, ["--bogus"]);
  assert.equal(bad.status, 2, scriptReason(bad));
  assert.equal(String(bad.stderr).trim(), "batch-summary: unknown option --bogus");
  assert.equal(String(bad.stdout).trim(), "", "no summary on a usage error");

  // Boundary inputs: --reports without a value, an unreadable ticket path.
  const noDir = run(dir, ["--reports"]);
  assert.equal(noDir.status, 2, scriptReason(noDir));
  assert.equal(String(noDir.stderr).trim(), "batch-summary: --reports needs a directory");
  const missing = run(dir, ["nope.md"]);
  assert.equal(missing.status, 2, scriptReason(missing));
  assert.ok(String(missing.stderr).startsWith("batch-summary: cannot read nope.md: "), `cannot read message; got: ${missing.stderr}`);
  assert.deepEqual(hashTree(dir), before, "error paths write nothing either");
});

// ------------------------------------------------------------------ AC12

test("AC12: a malformed ticket is listed under unreadable tickets with its problem count; the valid ones are summarised", () => {
  const dir = tmp("ac12");
  const badText = "---\nid: BAD\ntitle: broken\n---\n\nno scenarios here\n";
  const problems = parseTicketFile(badText).problems.length;
  assert.ok(problems > 0, "fixture sanity: the bad ticket has format problems");
  write(dir, "tickets/bad.md", badText);
  // Boundary input: a title with YAML-special characters, quoted per the format, prints as its value.
  write(dir, "tickets/OK1.md", ticket({ id: "OK1", title: "'Retry 3 times #flaky on C:\\temp\\new'", status: "done" }));
  write(dir, "tickets/OK2.md", ticket({ id: "OK2", status: "not started" }));
  const r = run(dir, ["tickets"]);
  assert.equal(r.status, 0, scriptReason(r));
  const out = outOf(r);
  assert.ok(out.startsWith("batch-summary: 3 ticket(s)\n"), `every ticket file given counts; got:\n${out}`);
  assert.ok(out.includes("done (1):\n  OK1 — Retry 3 times #flaky on C:\\temp\\new\nnot started (1):\n  OK2 — Ticket OK2\nstopped (0):"),
    `valid tickets summarised as usual; got:\n${out}`);
  assert.ok(out.endsWith(`unreadable tickets (1):\n  tickets/bad.md: ${problems} problem(s)`), `bad ticket listed with its problem count; got:\n${out}`);
  assert.ok(!out.includes("BAD —"), "the malformed ticket is not summarised");
});

// ------------------------------------------------------------------ AC13

test("AC13: qa-engineer step 6 ends with C-QA; code-reviewer carries step C-CR directly after step 4", async () => {
  const ws = await makeWorkspace({ design: false });
  const qa = skillOf(built("skill-qa-engineer.md", ws)).split("\n");
  const step6 = block(qa, (l) => l.startsWith("6. **Record**:"), (l) => l.startsWith("7. **Hand off to sr-engineer**"));
  const items = nonBlank(step6);
  assert.equal(items[items.length - 1], C["C-QA"], "C-QA is the last bullet of qa step 6");
  assert.equal(count(qa.join("\n"), C["C-QA"]), 1, "C-QA once");
  const cr = skillOf(built("skill-code-reviewer.md", ws)).split("\n");
  const s4 = cr.findIndex((l) => l.startsWith("4. **Review the tests**"));
  assert.ok(s4 >= 0, "code-reviewer step 4 present");
  const after = nonBlank(cr.slice(s4 + 1));
  assert.equal(after[0], C["C-CR"], "step 4a (C-CR) directly after step 4");
  assert.ok(after[1].startsWith("5. **Review the implementation**"), "step 5 follows step 4a");
});

// ------------------------------------------------------------------ AC14

test("AC14: every string this lane adds under content/** names no repo-only path and no bare ticket id", () => {
  const ADDED = {
    "const-08-chain-31-mid.md": ["C-C08"],
    "coord-03-core-fallback.md": ["C-CO3"],
    "coord-07-core-sop.md": ["C-CO7"],
    "skill-integrator.md": ["C-IN1", "C-IN2", "C-IN3"],
    "skill-qa-engineer.md": ["C-QA"],
    "skill-code-reviewer.md": ["C-CR"],
  };
  const SHIPPED_DOCS = new Set(["docs/lane-protocol.md", "docs/ticket-format.md"]);
  const PATH_RE = /(<agc install>\/)?\b(?:specs|gates|tools|docs|test|scripts|content|prompts|bin|lib|dist|schema|guards|transport)\/[\w.\/*-]+/g;
  const check = (where, s) => {
    assert.doesNotMatch(s, /\bE\d{2,}[a-z]?\b/, `${where}: no bare ticket id`);
    for (const m of s.matchAll(PATH_RE)) {
      const rel = m[0].replace(/^<agc install>\//, "").replace(/[.]+$/, "");
      // A path is repo-only when it exists in this checkout and is neither reached through the agc install nor
      // one of the agc-shipped adopter docs; a pattern such as `specs/<feature>.md` names no file here.
      const repoOnly = m[1] === undefined && !SHIPPED_DOCS.has(rel) && fs.existsSync(path.join(ROOT, rel));
      assert.ok(!repoOnly, `${where}: repo-only path ${m[0]} (only <agc install>/… or agc-shipped docs)`);
    }
  };
  for (const [file, ids] of Object.entries(ADDED)) {
    const served = stripOrigin(read(path.join("content", file)));
    for (const id of ids) {
      assert.ok(served.includes(C[id]), `${id} is added to content/${file}`);
      check(id, C[id]);
    }
    // Any other line on the same subject the build adds is held to the same rule.
    for (const line of served.split("\n").filter((l) => /batch[ -]lane|batch summary|batch-summary|named tests|ticket verification field/i.test(l))) {
      check(`content/${file}`, line);
    }
  }
});

// ------------------------------------------------------------------ AC16

test("AC16: the Status values example reason for 'stopped — <reason>' is C-TF4, not a 'waiting on' form", () => {
  // WHY: an example `stopped — waiting on <text>` reads as the fixed wording C-TF1, so a summary would list it as
  // waiting on a ticket; the only `waiting on` status the doc may show is `stopped — waiting on <id>`.
  const rows = TICKET_FORMAT.split("\n").filter((l) => l.startsWith("| `stopped — <reason>` |"));
  assert.equal(rows.length, 1, "exactly one *Status values* row for `stopped — <reason>`");
  const examples = [...rows[0].matchAll(/for example `([^`]+)`/g)].map((m) => m[1]);
  assert.equal(examples.length, 1, "the row gives exactly one example status");
  assert.doesNotMatch(examples[0], /^stopped — waiting on\b/, "the example reason does not begin with `waiting on`");
  assert.equal(examples[0], C["C-TF4"], "the example is C-TF4 verbatim");
});
