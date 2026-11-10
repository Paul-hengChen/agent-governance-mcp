// Coded by @qa-engineer: pins for specs/e262-sop-text-fixes.md AC-E355-1..4 (T-E355-02).
// WHY: the integrator SOP ships to every adopter, so it must not state facts true only in this repo
// (CI trigger, full-suite command, retired findings file, post-merge restart, load-sensitive list).
// Each becomes a generic phrase in the SOP plus one line in docs/lane-protocol-addendum.md.
// Reads only shipped md files; no real specs/fanout-*.md, no fixed base sha, no platform dependence.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rd = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf-8");
const count = (text, needle) => text.split(needle).length - 1;
const SOP = rd("content/skill-integrator.md");
const ADD = rd("docs/lane-protocol-addendum.md");

const i5a = SOP.indexOf("### 5a.");
const i5b = SOP.indexOf("### 5b.");
const i5c = SOP.indexOf("### 5c.");
const S5A = SOP.slice(i5a, i5b);
const S5B = SOP.slice(i5b, i5c);

const W3 =
  "(the repo's CI must run on a lane-branch push — the addendum names its trigger, E298); you push the lane branch — lanes never push. The local full suite runs only under the *CI fallback* below, and then it is still the **full suite**, never \"related files\", serial — the repo's full-suite command (the addendum names it), wrapped in `node <agc install>/scripts/test-lock.mjs -- <full-suite command>`.";
const W4 = "no block below `## Applied`; any retired findings file the addendum names untouched; under";
const W5 = "on the committed branch under `node <agc install>/scripts/test-lock.mjs -- <full-suite command>` as before,";
const W6 = "is on the repo's load-sensitive test list (the addendum names it; no list, no re-run); any other red";
const W7 = "- the `pending-tickets.md` / `## Applied` / retired-findings-file check.";
const W8 =
  "After merging, run the repo's build, plus the post-merge restart the addendum names, if any (so the next `tw_*` call runs the merged code).";
const W9_LOAD =
  "- 整合者 flake rule 的負載敏感測試清單（只有清單上的測試在 CI 紅時可以 `gh run rerun --failed` 一次）：`test/e108-eject.test.mjs` 名稱以 `AC7` 開頭的兩個測試、`test/verify-release.test.mjs` 的 `VR-20 (E80)`。E238 處理過的六個站點（五個已去耦，usage-accounting 的 20 s 上限確認不動）不在清單上：再紅代表退化，照一般紅燈送回 lane。";

test("AC-E355-1: the SOP contains none of this repo's CI / findings / test-list / restart facts", () => {
  for (const banned of [
    "feat/**", "ci.yml", "NEW-TICKETS.md", "npm test", "load-sensitive in `docs/backlog.md`",
    "E238", "E254", "E278", "primary MCP server",
  ]) {
    assert.equal(count(SOP, banned), 0, `SOP must not contain ${banned}`);
  }
});

test("AC-E355-2: W3-W8 generic replacements appear exactly once, in the step the spec names", () => {
  for (const [name, w, slice] of [
    ["W3", W3, S5A], ["W4", W4, S5A], ["W5", W5, S5A], ["W6", W6, S5A], ["W7", W7, S5A], ["W8", W8, S5B],
  ]) {
    assert.ok(slice.length > 0, "slice found");
    assert.equal(count(SOP, w), 1, `${name} once in the file`);
    assert.equal(count(slice, w), 1, `${name} once in its step`);
  }
});

test("AC-E355-3: addendum §5 gains the five W9 bullets after the existing four, §7 follows", () => {
  const sec5 = ADD.slice(ADD.indexOf("## §5 信箱"), ADD.indexOf("## §7 中途修 base"));
  const bullets = sec5.split("\n").filter((l) => l.startsWith("- "));
  assert.equal(bullets.length, 9, "four existing + five W9");
  const tail = bullets.slice(4);
  assert.ok(tail[0].includes("`feat/**`") && tail[0].includes("E298"), "CI trigger line");
  assert.ok(tail[1].includes("`node scripts/test-lock.mjs -- npm test`"), "full-suite command line");
  assert.ok(tail[2].includes("`NEW-TICKETS.md`"), "retired findings file line");
  assert.ok(tail[3].includes("重啟 primary 的 MCP server"), "post-merge restart line");
  assert.equal(tail[4], W9_LOAD, "load-sensitive bullet verbatim");
});

test("AC-E355-4: the load-sensitive list names exactly the two candidates and says the E238 sites are off it", () => {
  assert.equal(count(ADD, "`test/e108-eject.test.mjs` 名稱以 `AC7` 開頭的兩個測試"), 1);
  assert.equal(count(ADD, "`test/verify-release.test.mjs` 的 `VR-20 (E80)`"), 1);
  assert.ok(W9_LOAD.includes("E238 處理過的六個站點") && W9_LOAD.includes("不在清單上"));
  // the other test files the list could be confused with are not named on the list
  const list = ADD.split("\n").filter((l) => l.includes("負載敏感測試清單"));
  assert.equal(list.length, 1);
  const named = [...list[0].matchAll(/`(test\/[^`]+)`/g)].map((m) => m[1]);
  assert.deepEqual(named, ["test/e108-eject.test.mjs", "test/verify-release.test.mjs"]);
});
