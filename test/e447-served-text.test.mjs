// Coded by @qa-engineer
// E447 (T-E447-01) AC11 / AC12: the SOP and doc texts of the local knowledge-files mode. The three SOP
// items (C-C08K, C-CO3K, C-IN-R4) ship to every adopter, so besides their placement they must cite no
// repo-only path or bare ticket id and quote no gate error code; coord-03's addition must stay Task-free
// (the coord-03 Task-alias sentences themselves are another lane's and are not asserted here). Doc
// items are located by their own text and their anchor line, never by line number or a base sha.
// Spec: specs/e447-local-knowledge-files.md AC11, AC12, Copy / Strings (SOP / doc text).
// "Every pre-existing line byte-unchanged" (AC12) is a diff property: the judge runs
// `git diff <lane base>..HEAD -- docs/config.md docs/install.md docs/lane-protocol.md` and checks only
// '+' lines appear (resident-test hygiene: no fixed base sha here); the existing pins in
// test/e351-*, test/e383-*, test/e425-*, test/e433-* guard the anchor lines in the full suite.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf-8");
const count = (hay, needle) => hay.split(needle).length - 1;

const { buildPromptForRole } = await import(path.join(ROOT, "dist", "prompts", "build.js"));
const { setActiveStorage, FileHandoffStorage } = await import(path.join(ROOT, "dist", "tools", "storage.js"));

// ------------------------------------------------------------------ frozen literals (spec Copy / Strings)
const C_C08K =
  "  - **Local knowledge files**: in a workspace whose `.current/.config.json` sets `\"knowledge\": \"local\"` (`docs/config.md`), the lane branch carries no manifest, so the lane's seeded copy of `specs/fanout-<id>.md` — the copy `agc feature start` made — meets condition (2) in place of the branch copy, provided the `check --cut` of condition (3) also found it byte-identical to the primary checkout's current copy. In that mode the fresh `人類` row a mid-wave manifest change needs reaches the lane by `agc feature reseed`, not by a merge.";
const C_CO3K =
  " When `.current/.config.json` sets `\"knowledge\": \"local\"` (`docs/config.md`), the backlog, ticket files and fan-out manifests are git-ignored: edit them in the primary checkout with no commit, branch or pull request, and a running lane sees a manifest edit only after `agc feature reseed`.";
const C_IN_R4 =
  " When `.current/.config.json` sets `\"knowledge\": \"local\"` (`docs/config.md`), B fans out only after `agc feature finish --shipped` has run for every lane B needs, not merely after their merge: each lane starts from a snapshot of the primary checkout, and a lane's specs, design, research and ticket edits reach the primary checkout only through that finish. In that mode the manifest is git-ignored too: edit it in the primary checkout, uncommitted.";
const DOC_LP_1 =
  "  - **知識檔也留本機的 repo**（`.current/.config.json` 的 `knowledge` 是 `local`）：`specs/`、`design/`、`research/`、票檔目錄（`ticketDir`，預設 `docs/tickets/`）與 `docs/backlog.md` 也被 git exclude，lane 不 commit 這些路徑。`feature start` 把 primary 當下的這些檔複製進 worktree（快照：之後 primary 的修改不會自動進來）並記下每個檔的內容雜湊；`agc feature finish --shipped` 只把 lane 新建或改過的檔複製回 primary 的同一路徑（不 commit），沒改過的複本直接丟掉；primary 也改了同一個檔時 finish 拒絕、什麼都不動。要讓 lane 跟上 primary 改過的檔，在 worktree 裡跑 `agc feature reseed <路徑>`；lane 改過的檔不能 re-seed。";
const DOC_LP_2 =
  "- **知識檔也留本機的 repo**：finish 直接從 worktree 的 `.current/<lane>/pending-tickets.md` 配號，把新列附加到 primary 未追蹤的 `docs/backlog.md`（不 commit），不走上一條「從未 commit」的路徑。";
const DOC_LP_3 =
  "   - **知識檔也留本機的 repo**：fan-out 清單不在 lane branch 上，manifest tier 改看 `feature start` 複製進來的那份；`check --cut` 另外逐 byte 比對它和 primary 當下的清單，不同就 exit 非 0 並印 `manifest changed since lane start — re-seed`，這時先跑 `agc feature reseed specs/fanout-<id>.md` 再重跑 `check --cut`。";
const DOC_INST_5 =
  " With `\"knowledge\": \"local\"`, the knowledge exclude rules are kept, so untracked knowledge files never show up for a `git add -A`; remove them by hand from the shared `.git/info/exclude` when you no longer need them.";
const DOC_CFG_CLOSING =
  "- **No schema version change.** The key is additive-optional; config `schema_version` stays 2 and no migration exists.";

// Adopter-portability checks on an SOP text (AC11): no repo-only path, no bare ticket id, no
// backticked gate-style error code.
const REPO_ONLY_PATH = /(^|[\s`(（])(test|dist|tools|gates|prompts|bin|content|schema|qa_reports|review_reports)\//;
const BARE_TICKET_ID = /(^|[^A-Za-z0-9_-])E\d+[A-Za-z]?(?![A-Za-z0-9])/;
const BACKTICKED_CODE = /`[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+`/;
function assertPortable(label, text) {
  assert.doesNotMatch(text, REPO_ONLY_PATH, `${label}: cites a repo-only path`);
  assert.doesNotMatch(text, BARE_TICKET_ID, `${label}: carries a bare ticket id`);
  assert.doesNotMatch(text, BACKTICKED_CODE, `${label}: quotes a gate error code`);
}

// ------------------------------------------------------------------ composition helpers (e425 precedent)
const BUILD_SEP = "\n\n---\n\n";
const FEATURE = "e447-probe-feat";
async function makeWorkspace({ design }) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e447-ws-"));
  setActiveStorage(new FileHandoffStorage());
  await new FileHandoffStorage().writeState(ws, FEATURE, "In_Progress", [], []);
  if (design) {
    fs.mkdirSync(path.join(ws, "design"), { recursive: true });
    fs.writeFileSync(path.join(ws, "design", `${FEATURE}.md`), "# Design\n\n## Mode\n\nfigma\n");
  }
  return ws;
}
const built = (skillFile, ws) => buildPromptForRole(skillFile, "e447", ws, false).messages[0].content.text;
const constitutionOf = (t) => {
  const i = t.indexOf(BUILD_SEP);
  assert.notEqual(i, -1, "no skill separator in prompt output");
  return t.slice(0, i);
};
const BATCH_LANE_PREFIX = "  - **Batch lane**: in a batch lane";

// ============================================================================
// AC11 (Fix 6)
// ============================================================================

test("AC11: C-C08K served once directly after the Batch-lane line on both design arms, not in lite; C-CO3K ends coord-03's bookkeeping line; C-IN-R4 ends Stage 1 step 3; all portable", async () => {
  for (const design of [true, false]) {
    const ws = await makeWorkspace({ design });
    const cons = constitutionOf(built("skill-sr-engineer.md", ws));
    const ls = cons.split("\n");
    assert.equal(count(cons, C_C08K), 1, `C-C08K served exactly once (design=${design})`);
    const b = ls.findIndex((l) => l.startsWith(BATCH_LANE_PREFIX));
    assert.ok(b >= 0, `Batch-lane line present (design=${design})`);
    assert.equal(ls[b + 1], C_C08K, `C-C08K is the line directly after the Batch-lane line (design=${design})`);
    fs.rmSync(ws, { recursive: true, force: true });
  }
  const ws = await makeWorkspace({ design: false });
  assert.ok(!built("skill-coordinator-lite.md", ws).includes("**Local knowledge files**"), "lite does not carry C-C08K");
  fs.rmSync(ws, { recursive: true, force: true });

  // Raw fragment: the new const-08 line sits directly after the Batch-lane line there too.
  const c08 = read("content/const-08-chain-31-mid.md").split("\n");
  const b8 = c08.findIndex((l) => l.startsWith(BATCH_LANE_PREFIX));
  assert.equal(c08[b8 + 1], C_C08K, "const-08 source: C-C08K directly after the Batch-lane line");

  // coord-03: appended to the end of the existing bookkeeping line (same line, no line added).
  const coord3 = read("content/coord-03-core-fallback.md");
  const book = coord3.split("\n").filter((l) => l.startsWith("**Bookkeeping never lands on local `main`**"));
  assert.equal(book.length, 1, "exactly one bookkeeping line");
  assert.ok(book[0].endsWith(C_CO3K), "the bookkeeping line ends with C-CO3K");
  assert.ok(book[0].includes("A protected `main` moves only by pull request merge." + C_CO3K), "appended after the line's existing last sentence");
  assert.equal(count(coord3, C_CO3K), 1);
  assert.ok(!C_CO3K.includes("Task"), "coord-03 addition is Task-free");

  // skill-integrator Stage 1 step 3: one line, ending with C-IN-R4.
  const integ = read("content/skill-integrator.md").split("\n");
  const s1 = integ.findIndex((l) => l.startsWith("## Stage 1"));
  const s2 = integ.findIndex((l) => l.startsWith("## Stage 2"));
  const step3 = integ.slice(s1, s2).filter((l) => l.startsWith("3. **Hard constraints**"));
  assert.equal(step3.length, 1, "Stage 1 step 3 is one line");
  assert.ok(step3[0].endsWith(C_IN_R4), "Stage 1 step 3 ends with C-IN-R4");
  assert.ok(step3[0].startsWith("3. **Hard constraints**: owned sets of any two lanes are disjoint;"), "existing head kept");

  for (const [label, text] of [["C-C08K", C_C08K], ["C-CO3K", C_CO3K], ["C-IN-R4", C_IN_R4]]) assertPortable(label, text);
});

// ============================================================================
// AC12 (docs)
// ============================================================================

function sectionLines(lines, startIdx, isEnd) {
  const out = [];
  for (let i = startIdx + 1; i < lines.length && !isEnd(lines[i]); i++) out.push(lines[i]);
  return out;
}

test("AC12: docs/config.md has exactly one knowledge section after ticketDir; docs/install.md carries DOC-INST-1..5; docs/lane-protocol.md carries DOC-LP-1..3 at their anchors", () => {
  // --- docs/config.md (DOC-CFG)
  const cfg = read("docs/config.md").split("\n");
  const kHeads = cfg.filter((l) => /^#{2,4} `knowledge`/.test(l));
  assert.equal(kHeads.length, 1, "exactly one knowledge section");
  assert.ok(kHeads[0].includes("`knowledge` — keep knowledge files out of git too (optional)"), kHeads[0]);
  const kIdx = cfg.indexOf(kHeads[0]);
  const tIdx = cfg.findIndex((l) => l.startsWith("### `ticketDir`"));
  assert.ok(tIdx >= 0 && kIdx > tIdx, "after the ticketDir section");
  const nextTop = cfg.findIndex((l, i) => i > tIdx && /^## /.test(l));
  assert.ok(kIdx < nextTop, "inside the .config.json section, before the next top-level heading");
  const kBody = sectionLines(cfg, kIdx, (l) => /^#{2,3} /.test(l)).join("\n");
  for (const fact of ['"knowledge": "local"', '"artifacts": "local"', "knowledge-seed.json", "`specs/`", "`design/`", "`research/`", "`docs/backlog.md`", '"repo"']) {
    assert.ok(kBody.includes(fact), `knowledge section names ${fact}`);
  }
  for (const cmd of ["agc init", "agc feature start", "agc feature reseed", "agc feature finish", "check --cut"]) {
    assert.ok(kBody.includes(cmd), `knowledge section names its reader ${cmd}`);
  }
  assert.ok(kBody.split("\n").includes(DOC_CFG_CLOSING), "closing bullet verbatim");

  // --- docs/install.md (DOC-INST-1..5)
  const inst = read("docs/install.md").split("\n");
  const h1 = inst.filter((l) => l.startsWith("###") && l.includes("Keeping knowledge files out of git too: `agc init --knowledge=local|repo`"));
  assert.equal(h1.length, 1, "DOC-INST-1 subsection");
  const i1 = inst.indexOf(h1[0]);
  const iAdapter = inst.findIndex((l) => l.startsWith("### When CLAUDE.md is a team file: `agc init --adapter=shared|local`"));
  const iFeatures = inst.findIndex((l) => l.startsWith("## Feature lanes"));
  assert.ok(iAdapter >= 0 && i1 > iAdapter && i1 < iFeatures, "after the --adapter subsection, before Feature lanes");
  const b1 = sectionLines(inst, i1, (l) => /^#{2,3} /.test(l)).join("\n");
  for (const fact of ["--artifacts=local", "CLAUDE.local.md", "git rm -r --cached"]) assert.ok(b1.includes(fact), `DOC-INST-1 names ${fact}`);

  const iStart = inst.findIndex((l) => l.startsWith("### `agc feature start"));
  const iFinish = inst.findIndex((l) => l.startsWith("### `agc feature finish"));
  const startBody = inst.slice(iStart + 1, iFinish).join("\n");
  assert.ok(startBody.includes("knowledge-seed.json"), "DOC-INST-2: start's Env-bootstrap bullet names the seed record");

  const h3 = inst.filter((l) => l.startsWith("###") && l.includes("`agc feature reseed <path>...`"));
  assert.equal(h3.length, 1, "DOC-INST-3 subsection");
  const i3 = inst.indexOf(h3[0]);
  const iEject = inst.findIndex((l) => l.startsWith("## Leaving agc"));
  assert.ok(i3 > iFinish && i3 < iEject, "after the finish subsection, before Leaving agc");
  const b3 = sectionLines(inst, i3, (l) => /^#{2,3} /.test(l)).join("\n");
  assert.ok(b3.includes("check --cut"), "DOC-INST-3 points check --cut's re-seed line here");

  const finishBody = inst.slice(iFinish + 1, i3).join("\n");
  assert.match(finishBody, /knowledge/, "DOC-INST-4: finish bullets cover knowledge files");
  assert.ok(finishBody.includes("docs/backlog.md"), "DOC-INST-4: numbering into the untracked backlog");
  assert.ok(finishBody.includes("abandoned/<"), "DOC-INST-4: the --abandoned destination");

  const rowIii = inst.filter((l) => l.startsWith("| (iii) host traces |"));
  assert.equal(rowIii.length, 1);
  assert.ok(rowIii[0].endsWith(DOC_INST_5 + " |"), "DOC-INST-5 appended to the (iii) disposition cell");

  // --- docs/lane-protocol.md (DOC-LP-1..3)
  const lp = read("docs/lane-protocol.md");
  const lpl = lp.split("\n");
  const anchors = [
    [DOC_LP_1, (l) => l.startsWith("  - 證據目錄不 symlink（E385）：")],
    [DOC_LP_2, (l) => l.startsWith("- **`artifacts: local` 的 repo**：`.current/` 被 git exclude，`pending-tickets.md` 進不了 branch")],
    [DOC_LP_3, (l) => l.startsWith("   - **有 architect hop 的票，預審兩次**")],
  ];
  for (const [text, isAnchor] of anchors) {
    assert.equal(count(lp, text), 1, `once: ${text.slice(0, 40)}`);
    const a = lpl.findIndex(isAnchor);
    assert.ok(a >= 0, "anchor line present");
    assert.equal(lpl[a + 1], text, `directly after its anchor: ${text.slice(0, 40)}`);
    for (const banned of ["node bin/agc-init.mjs", "dist/", "test/", "node scripts/fanout.mjs", "content/", "compose-golden", "context-budget"]) {
      assert.ok(!text.includes(banned), `new lane-protocol line carries no ${banned}`);
    }
  }
});
