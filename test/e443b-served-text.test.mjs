// Coded by @qa-engineer
// Tests (T-E443B-01) for specs/e443b-lane-launcher.md A2-19..A2-21 and A2-25: the served and repo text that
// tells people and lanes about the lane launcher. Each Copy / Strings block of the cut is pinned verbatim at the
// place the cut names.
// WHY: the integrator must know the two moments to re-run the launcher and that a refused wave stays
// hand-started (A2-19); a coordinator hit by a usage limit must neither take the tw_switch_role fallback nor
// switch the model (A2-20); a launcher-started lane must skip worktree creation and only confirm its location,
// without §1 growing (A2-21); the repo's own Layout and addendum tool list must name the new files (A2-25).
// Served strings (content/**, docs/lane-protocol.md) carry no bare ticket id. Each title starts with its AC id.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const count = (hay, needle) => hay.split(needle).length - 1;
const BARE_TICKET_RE = /\bE\d{2,4}[a-z]?\b/;

// Copy / Strings (verbatim blocks of the cut).
const COPY = {
  coord03: "**Usage limit**: a usage-limit or rate-limit error is not tool unavailability: never take the `tw_switch_role` Fallback, end the session, switch the model or run the role in-context. After automatic continue, re-dispatch the cut-off subagent once with the same pin via this protocol; on a second failure, checkpoint, record the pause reason and stop. Only a human `dispatch_pins` changes a model.",
  overview3: "| 3. Dispatch | Check every premise the prompts rely on; create and watch the mailbox; render one prompt per lane, or start the wave's lanes with the lane launcher |",
  lifecycle4: "| 4 | the lane launcher opens one session per lane (a wave it refuses: the human opens N sessions and pastes the prompts); integrator talks to each lane over the mailbox | each lane runs its own `/teamwork` chain to the judge's `(code-reviewer, PASS)` |",
  // Re-pinned by E466 (specs/e466-conductor.md integrator.relaunch): the two-moments sentence ("Re-run it at two
  // moments: … and after a usage limit resets, to wake the paused lanes.") is replaced in place by the conductor rules.
  launcher: "**Lane launcher**: when the manifest has the `波次` column and checks 1–3 hold, run `node <agc install>/scripts/lane-launch.mjs <manifest>` as a background process instead of handing out prompts: it starts each batch lane of the current wave in its own terminal window with `render --batch`'s output, at most `laneLaunchLimit` (a `.current/.config.json` key) open at once, lists every lane it leaves unstarted with the reason, and polls until each started lane has sent its final report (a lane report, or the report after a batch stop) or is paused. Re-run it after each `波次`'s pull request has merged and local `main` is pulled (Stage 6 step 5), to start the next `波次`. **Under a conductor** — `agc-conductor.json` in the directory `git rev-parse --git-common-dir` prints exists, its `step` is not `done`, and it names this manifest or, for the first wave, the discussion record of your `fan-out` line; its mailbox is the folder `agc-conductor/` beside that file — the conductor opens you with `fan-out <record>` (first wave) or `接手 <manifest>，開始第 <n> 波次` (after *Take-over* passes, run Stage 3 checks 1–3, then start wave `<n>` with the launcher), and you carry the wave through Stage 6 in this session (no `fan-in` line comes). At the moment `waveDoneAt` (`.current/.config.json`) names — the wave's pull request merged (`merged`, the default: after Stage 6 step 6) or opened (`pr-open`: after Stage 6 step 3) — report wave-done to the conductor's mailbox: one `type: report` sent with `node <agc install>/scripts/mailbox-watch.mjs <mailbox>/to-lane.md --send --from integrator --type report --re \"wave-done <n>\" --body …` in the session-report format of agc's generic `docs/lane-protocol.md` §5, its first item reading `- 做了什麼：wave <n> of <manifest>, pull request #<number>`; it replaces the re-run above and Stage 6 step 7's (the next integrator starts the next `波次`). Then watch `<mailbox>/to-integrator.md`: a reply names an unmet fact — fix it and report again; the conductor closes this session once every fact holds. Under `pr-open`, when your launcher run lists lanes waiting on the earlier wave's pull request, watch that pull request (`gh pr view <number> --json state`); when it merges, run Stage 6 steps 5–6 for it and re-run the launcher — your own wave is not done until those waiting lanes finish. A wave it refuses stays hand-started: render and hand out the prompts as above.",
  nextWave: "The integrator never proposes the next wave — no next-wave plan, no offer to start one; a later `波次` of this approved manifest is not a next wave: re-run the lane launcher for it (Stage 3).",
  lpStep1: "1. **建 worktree —— 在任何 `tw_*` 呼叫之前**（由啟動器開出的批次 lane 例外：worktree 已建好、session 就開在裡面，跳過建立與切換，只做本步的 *確認位置*；啟動器見 §3 *批次 lane*）：",
  lpS3: "批次 lane 由整合者跑 agc 的啟動器（`node <agc 安裝位置>/scripts/lane-launch.mjs <清單>`）開出 session，不由人類貼派工 prompt；啟動器拒絕的波次照舊由人類開。",
  addTools: "- 整合者 SOP 與 coordinator 呼叫的其他 agc 工具，在本 repo 一樣用 repo 相對路徑：`node scripts/mailbox-watch.mjs`、`node scripts/lane-status.mjs`、`node scripts/merge-invariants.mjs`、`node scripts/test-lock.mjs`（全套一律 `node scripts/test-lock.mjs -- npm test`）、`node scripts/feature-rollup.mjs`、`node scripts/batch-summary.mjs`、`node scripts/lane-launch.mjs`。",
  claudeRow: "tools/lane-launch.ts      lane launcher core: waves, parallel limit, iTerm2 windows, usage-limit pauses (scripts/lane-launch.mjs)",
  claudePromptsRow: "prompts/{pm,architect,researcher,design-auditor,sr-engineer,code-reviewer,qa-engineer,doc-writer,release-engineer,integrator,spec-workshop}.ts   the other eleven role prompts",
};
// The Stage 6 step 7 sentence sop.next-wave replaces (followed by the next sentence, as served before this lane).
const OLD_NEXT_WAVE = "The integrator never proposes the next wave — no next-wave plan, no offer to start one. The human";
// FROZEN: docs/lane-protocol.md §1 (`## 1. 開工` up to `## 2.`) line count at this lane's base 79dcd4c.
const LP_S1_LINES = 21;

/** Lines of the `## <name>` section of `lines` (heading included), up to the next `## ` heading. */
function section(lines, name) {
  const at = lines.findIndex((l) => l.startsWith(`## ${name}`));
  assert.ok(at >= 0, `section ## ${name} present`);
  const end = lines.findIndex((l, i) => i > at && l.startsWith("## "));
  return lines.slice(at, end < 0 ? lines.length : end);
}

test("A2-19: content/skill-integrator.md names the launcher's re-run moment after the merge (the usage-limit moment moved to the conductor); Work overview, Lifecycle and Stage 3 say it replaces hand-opened sessions and a refused wave stays hand-started", () => {
  const sop = read("content/skill-integrator.md");
  const lines = sop.split("\n");

  const overview = section(lines, "Work overview");
  assert.deepEqual(overview.filter((l) => l.startsWith("| 3. Dispatch |")), [COPY.overview3], "Work overview row 3 is sop.overview-3");

  const lifecycle = section(lines, "Lifecycle");
  assert.deepEqual(lifecycle.filter((l) => l.startsWith("| 4 |")), [COPY.lifecycle4], "Lifecycle row 4 is sop.lifecycle-4");

  const stage3 = section(lines, "Stage 3");
  const render = stage3.filter((l) => l.startsWith("**Render**"));
  assert.equal(render.length, 1, "one Stage 3 Render line");
  assert.ok(render[0].endsWith(" " + COPY.launcher), "sop.launcher appended to the Render line after one space");
  assert.equal(count(sop, COPY.launcher), 1, "sop.launcher once");
  // The re-run moment after the merge stays; the usage-limit moment moved to the conductor (re-pinned by E466).
  assert.ok(COPY.launcher.includes("Re-run it after each `波次`'s pull request has merged") && !COPY.launcher.includes("after a usage limit resets"));

  const stage6 = section(lines, "Stage 6");
  const step7 = stage6.filter((l) => l.startsWith("7. Final report:"));
  assert.equal(step7.length, 1, "one Stage 6 step 7");
  assert.ok(step7[0].includes(COPY.nextWave), "Stage 6 step 7 carries sop.next-wave");
  assert.equal(count(sop, OLD_NEXT_WAVE), 0, "the old next-wave sentence is replaced, not kept beside it");

  for (const l of [COPY.overview3, COPY.lifecycle4, COPY.launcher, COPY.nextWave]) {
    assert.ok(!BARE_TICKET_RE.test(l), `no bare ticket id in served text: ${l.slice(0, 60)}`);
  }
});

test("A2-20: the composed coordinator SOP opens the Crash-Resume Protocol with the usage-limit line (no fallback, no model switch, one re-dispatch, then checkpoint and stop)", async () => {
  const { composeSkill, hostCapabilitiesFor } = await import(path.join(ROOT, "dist", "prompts", "skill-manifest.js"));
  const { stripOriginTags } = await import(path.join(ROOT, "dist", "prompts", "build.js"));
  const readContent = (f) => fs.readFileSync(path.join(ROOT, "content", f), "utf8");
  for (const host of ["claude-code", "cursor"]) {
    const composed = stripOriginTags(composeSkill("skill-coordinator.md", hostCapabilitiesFor(host), readContent));
    const lines = composed.split("\n");
    const at = lines.findIndex((l) => l.startsWith("## Crash-Resume Protocol"));
    assert.ok(at >= 0, `${host}: Crash-Resume Protocol section present`);
    assert.equal(lines[at + 1], "", `${host}: blank line after the heading`);
    assert.equal(lines[at + 2], COPY.coord03, `${host}: Copy coord03.usage-limit directly under the heading`);
    assert.equal(lines[at + 3], "", `${host}: then one blank line`);
    assert.ok(lines[at + 4].startsWith("Constitution §3 requires"), `${host}: before the existing first paragraph`);
    assert.equal(count(composed, COPY.coord03), 1, `${host}: once`);
  }
  assert.ok(!BARE_TICKET_RE.test(COPY.coord03));
});

test("A2-21: docs/lane-protocol.md §1 step 1 exempts a launcher-started lane (confirm location only), §1 keeps its line count, §3 批次 lane names the launcher", () => {
  const lp = read("docs/lane-protocol.md");
  const lines = lp.split("\n");
  const s1 = section(lines, "1. 開工");
  assert.equal(s1.length, LP_S1_LINES, "§1 has the same line count as before");
  assert.deepEqual(s1.filter((l) => l.startsWith("1. **建 worktree")), [COPY.lpStep1], "§1 step 1 is lp.s1-step1");

  const s3 = section(lines, "3. 執行與驗證");
  const what = s3.filter((l) => l.startsWith("- **什麼是批次 lane**"));
  assert.equal(what.length, 1, "one 什麼是批次 lane bullet");
  assert.ok(what[0].endsWith("(c) 這條 lane 在 Lanes 表的 `approval` 欄不是 `human`。" + COPY.lpS3), "lp.s3-launcher appended, no space");
  assert.equal(count(lp, COPY.lpS3), 1);
  for (const l of [COPY.lpStep1, COPY.lpS3]) assert.ok(!BARE_TICKET_RE.test(l));
});

test("A2-25: CLAUDE.md keeps 250 lines with the lane-launch Layout row after tools/config.ts and a one-line prompts row; the addendum §5 tool line ends with lane-launch", () => {
  const md = read("CLAUDE.md");
  const lines = md.split("\n");
  const n = md.endsWith("\n") ? lines.length - 1 : lines.length;
  assert.equal(n, 250, "CLAUDE.md has 250 lines");
  const cfg = lines.findIndex((l) => l.startsWith("tools/config.ts "));
  assert.ok(cfg >= 0, "tools/config.ts row present");
  assert.equal(lines[cfg + 1], COPY.claudeRow, "claude.row directly after the tools/config.ts row");
  assert.equal(lines.filter((l) => l.startsWith("tools/lane-launch.ts")).length, 1, "one Layout row for tools/lane-launch.ts");
  assert.deepEqual(lines.filter((l) => l.startsWith("prompts/{pm,")), [COPY.claudePromptsRow], "the prompts row on one line");
  assert.ok(!lines.some((l) => /^\s+qa-engineer,doc-writer,/.test(l)), "no continuation line left");

  const add = read("docs/lane-protocol-addendum.md").split("\n");
  const tools = add.filter((l) => l.startsWith("- 整合者 SOP 與 coordinator 呼叫的其他 agc 工具"));
  assert.deepEqual(tools, [COPY.addTools], "addendum §5 tool line is add.tools");
  const calls = [...tools[0].matchAll(/`(node scripts\/[a-z-]+\.mjs)[^`]*`/g)].map((m) => m[1]);
  assert.equal(calls.at(-1), "node scripts/lane-launch.mjs", "named last");
});
