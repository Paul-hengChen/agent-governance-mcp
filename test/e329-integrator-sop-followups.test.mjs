// Coded by @qa-engineer
// Tests (T-E329-02) for specs/e329-integrator-sop-followups.md: integrator SOP Stage 0 / Stage 4 / Stage 6 wording,
// lane-protocol §3/§4, qa SOP hygiene line. Content-structure assertions on section-bounded slices; Copy literals
// are pinned verbatim because the SOP text IS the contract an agent reads. No git, no fixed sha, no real
// specs/fanout-*.md content (E323 hygiene).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { HANDOFF_SUBITEMS, HANDOFF_SECTION } from "../dist/tools/fanout-manifest.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const SOP = read("content/skill-integrator.md");
const LP = read("docs/lane-protocol.md");
const ADD = read("docs/lane-protocol-addendum.md"); // E290: repo-specific examples live here
const QA = read("content/skill-qa-engineer.md");

const count = (text, needle) => text.split(needle).length - 1;
/** From the line starting `start` to (excluding) the next heading of depth <= its own; "" when absent. */
function sec(start, text) {
  const lines = text.split("\n");
  const i = lines.findIndex((l) => l.startsWith(start));
  if (i < 0) return "";
  const depth = start.match(/^#+/)[0].length;
  const out = [lines[i]];
  for (let j = i + 1; j < lines.length; j++) {
    const m = lines[j].match(/^(#+) /);
    if (m && m[1].length <= depth) break;
    out.push(lines[j]);
  }
  return out.join("\n");
}

const STAGE0 = sec("## Stage 0", SOP);
const STAGE6 = sec("## Stage 6", SOP);
const BASEFIX = sec("### Mid-wave base fix", SOP);
const S4 = sec("## 4. ", LP);

const STAGE6_CLOSE = "   - **Close the manifest** (the 5c-5 close box, in the bookkeeping commit): its status line reads `**狀態：已結案 <日期>。…**` — `node <agc install>/scripts/fanout.mjs validate` treats a manifest as closed only when the status text starts `已結案` right after `狀態：`, so any other wording (`結案 <日期>`, `已合併`) is never checked. A closed manifest carries one `## 接手步驟` section whose `###` sub-items are 核對 primary, 已結案, 待人類決定 and 進行中的背景工作 (each once and non-empty; 進行中的背景工作 reads exactly 無), optionally 裝置 and 工具, with no machine-local absolute path in the section. `node <agc install>/scripts/fanout.mjs validate <manifest>` exits 0 before step 2's push.";
const STAGE6_FINDINGS = "   - **Findings finish did not number**: finish lists on stderr each `target_repo` finding (another repo's; archived under `## Applied`, no id here) and warns when a lane's `pending-tickets.md` was never committed at `--base` (its findings unnumbered, a copy kept under `.current/history/<YYYY-MM>/<lane>/`). Get the human's ruling on each `target_repo` finding and record it as a Decisions row; hand-file each warned unallocated finding as a full `docs/backlog.md` row (5c-1). Both before step 2's push.";
const COND2 = "2. Nothing the merge brings in is lane-owned: `node <agc install>/scripts/fanout.mjs owners <manifest> --range <lane branch>...origin/<target>` exits 0 — exit 1 names each path a lane owns through its `擁有` cell or its own bookkeeping, exit 2 is a usage, manifest or git error, and either means the condition does not hold; when the fix came through an insertion lane listed in the manifest, `node <agc install>/scripts/fanout.mjs check <manifest> <insertion lane> --base <dispatch base>` exits 0.";
const DECIDER = "Its `裁決者` is `人類`: the human settled the contract and carries the note here; you only record it.";
const REVISE = "4. **Revising the cut**: when a ticket from a Stage 0 cut goes back to PM (Stage 1 step 4), re-dispatch PM via Task to revise `specs/ticket-cut-<feature>.md` — the *Stage 0 only* permission row covers it, with the same limits (that file only); the revised file is presented with the manifest at Stage 2 like the first one.";
const LP_TEMPLATE = "  target_repo: other-repo           # 選填：只在這筆發現屬於別的 repo 時寫";
const LP_TARGET = "- **選填 `target_repo: <repo>`**：這筆發現屬於別的 repo。finish 不在本 repo 配號，照樣把它移到 `## Applied` 之下，並在 stderr 列出、等人類裁決（由整合者到那個 repo 建票）。有寫就不能是空值；本 repo 的其他 block 不能在 `depends_on` 引用它（finish 會拒絕），要提就寫進 `body`。";
const LP_COMMIT = "- **`pending-tickets.md` 一定要 commit 進你的 branch**：只存在 worktree、從未 commit 的檔案不會配號 —— finish 警告並列出這些發現，在 primary 的 `.current/history/<YYYY-MM>/<lane>/` 留一份（不 commit），由整合者手動建票。";
const QA_HYGIENE = "f. **Resident-test hygiene**: assert only the stable structure of a real, growable file (e.g. `specs/fanout-*.md`) or use a frozen in-test fixture; never diff against a fixed lane base sha. One exception: a closed historical range (both ends fixed shas, e.g. a shipped lane's own scope check), guarded by `git rev-parse --verify <sha>^{commit}` and skipped loudly when absent.";

test("AC-E329-1: Stage 6 carries the close literal; status-line wording, headings, exit-0 rule", () => {
  // WHY: a close written in other wording silently skips validate; the SOP must name the exact wording.
  assert.equal(count(STAGE6, STAGE6_CLOSE), 1, "close literal exactly once inside Stage 6");
  const step1 = STAGE6.indexOf("\n1. Per lane");
  const step2 = STAGE6.indexOf("\n2. `git push -u origin");
  const at = STAGE6.indexOf(STAGE6_CLOSE);
  assert.ok(step1 >= 0 && step2 > step1, "steps 1 and 2 present in order");
  assert.ok(at > step1 && at < step2, "close sub-bullet sits under step 1, before step 2");
  const order = ["核對 primary", "已結案", "待人類決定", "進行中的背景工作"].map((h) => STAGE6_CLOSE.indexOf(h, STAGE6_CLOSE.indexOf("sub-items")));
  assert.ok(order.every((p) => p >= 0) && [...order].sort((a, b) => a - b).join() === order.join(), "four headings in order");
  for (const n of ["裝置", "工具", "reads exactly 無", "machine-local absolute path", "fanout.mjs validate <manifest>` exits 0"]) {
    assert.ok(STAGE6_CLOSE.includes(n), `missing ${n}`);
  }
});

test("AC-E329-2: SOP heading set equals the tool's exported HANDOFF_SUBITEMS / HANDOFF_SECTION", () => {
  // WHY: the SOP must not drift from what validate actually enforces (no extra, none missing).
  assert.ok(Array.isArray(HANDOFF_SUBITEMS) && HANDOFF_SUBITEMS.length > 0);
  assert.ok(STAGE6_CLOSE.includes("`## " + HANDOFF_SECTION + "`"), "section name matches export");
  const listed = STAGE6_CLOSE.match(/sub-items are (.*?) \(each once/)[1]
    .split(/, | and /).map((s) => s.trim()).filter(Boolean);
  assert.deepEqual(listed, [...HANDOFF_SUBITEMS], "mandatory headings equal the export, same order");
  const real = STAGE6.split("\n").filter((l) => l.includes("Close the manifest")).join("\n");
  for (const h of HANDOFF_SUBITEMS) assert.ok(real.includes(h), `SOP names ${h}`);
});

test("AC-E329-3: base-fix condition 2 uses owners --range, keeps insertion-lane check, no hand diff", () => {
  const lines = BASEFIX.split("\n");
  const pos = [1, 2, 3, 4, 5].map((n) => lines.findIndex((l) => l.startsWith(`${n}. `)));
  assert.ok(pos.every((p) => p >= 0) && [...pos].sort((a, b) => a - b).join() === pos.join(), "ordered 1..5");
  assert.equal(lines[pos[1]], COND2, "condition 2 equals the literal");
  assert.equal(count(SOP, "git diff --name-only <lane branch>...origin/<target>"), 0, "hand diff literal gone");
  assert.ok(lines[pos[1]].includes("fanout.mjs check <manifest> <insertion lane> --base <dispatch base>"));
  assert.ok(BASEFIX.includes("Condition 2 or 4"), "stop sentence retained");
});

test("AC-E328-1: Stage 0 hand-off note names 裁決者 人類; 出處 sentence kept", () => {
  const para = STAGE0.split("\n").find((l) => l.includes("Cross-repo hand-off note")) ?? "";
  assert.ok(para.endsWith(" " + DECIDER), "decider appended at the end of the paragraph");
  assert.equal(count(STAGE0, DECIDER), 1);
  const src = para.indexOf("出處");
  assert.ok(src >= 0 && src < para.indexOf(DECIDER), "出處 sentence precedes the decider");
});

test("AC-E328-2: Stage 0 step 4 covers PM re-dispatch; Permissions table unchanged", () => {
  const lines = STAGE0.split("\n");
  const pos = [1, 2, 3, 4].map((n) => lines.findIndex((l) => l.startsWith(`${n}. `)));
  assert.ok(pos.every((p) => p >= 0) && [...pos].sort((a, b) => a - b).join() === pos.join(), "steps 1..4 in order");
  assert.equal(lines[pos[3]], REVISE);
  const perms = sec("## Permissions", SOP);
  assert.equal(perms.split("\n").filter((l) => l.startsWith("|")).slice(2).length, 5, "5 Permissions body rows");
  assert.ok(perms.includes("Stage 0 only") || /Ticket cut/.test(perms), "Stage 0 row present");
});

test("AC-E334-1: lane-protocol §4 template line and target_repo bullet", () => {
  assert.ok(S4.length > 0, "§4 found");
  const lines = S4.split("\n");
  const dep = lines.findIndex((l) => l.startsWith("  depends_on:"));
  assert.ok(dep >= 0 && lines[dep + 1] === LP_TEMPLATE, "template line directly after depends_on");
  assert.equal(count(S4, LP_TARGET), 1);
  assert.ok(S4.indexOf(LP_TARGET) > S4.indexOf("- **不要自己配 E 號**"), "bullet follows the no-self-allocate bullet");
});

test("AC-E334-2: lane-protocol §4 commit-or-not-numbered bullet", () => {
  assert.equal(count(S4, LP_COMMIT), 1);
  assert.ok(S4.indexOf(LP_COMMIT) > S4.indexOf(LP_TARGET), "directly after the target_repo bullet");
});

test("AC-E334-3: Stage 6 findings sub-bullet; e246-pinned fragments and §5 sentence intact", () => {
  assert.equal(count(STAGE6, STAGE6_FINDINGS), 1);
  assert.ok(STAGE6.indexOf(STAGE6_FINDINGS) < STAGE6.indexOf(STAGE6_CLOSE), "findings before close");
  assert.ok(STAGE6.indexOf(STAGE6_FINDINGS) > STAGE6.indexOf("\n1. Per lane"), "under step 1");
  assert.ok(STAGE6.indexOf(STAGE6_FINDINGS) < STAGE6.indexOf("\n2. `git push -u origin"), "before step 2");
  for (const f of ["reset", "never reused", "by hand", "stop the mailbox watch", "removes the default-location mailbox"]) {
    assert.ok(SOP.toLowerCase().includes(f.toLowerCase()), `SOP fragment ${f}`); // e246 pins the whole SOP, case-insensitive
  }
  assert.ok(LP.includes("信箱在 `agc feature finish` 拆除 lane 時才會刪除"));
});

test("AC-E327-1: qa SOP item f equals the hygiene literal, exactly once", () => {
  // WHY: one rule on historical shas; the single allowed shape is named, the E323 rule is otherwise kept.
  const f = QA.split("\n").find((l) => l.trim().startsWith("f. **Resident-test hygiene**")) ?? "";
  assert.equal(f.trim(), QA_HYGIENE);
  assert.equal(count(QA, "f. **Resident-test hygiene**"), 1);
});

test("AC-E327-2: lane-protocol §3 keeps its 常駐測試 exception bullet; qa SOP within byte cap", () => {
  const s3 = sec("## 3. ", LP);
  const b = s3.split("\n").find((l) => l.startsWith("- **常駐測試不要釘死歷史 commit SHA**")) ?? "";
  assert.ok(b.includes("git rev-parse --verify <sha>^{commit}") && !b.includes("test/e130-lane-default.test.mjs"), "§3 exception kept, repo example moved out (E290)");
  assert.ok(ADD.includes("test/e130-lane-default.test.mjs"), "addendum holds the e130 example");
  const bytes = Buffer.byteLength(QA, "utf8");
  assert.ok(bytes <= 18500, `qa SOP ${bytes} bytes exceeds 18500`);
  const split = read("test/qa-visual-skill-split.test.mjs");
  assert.ok(split.includes("18500"), "cap in qa-visual-skill-split unchanged");
});
