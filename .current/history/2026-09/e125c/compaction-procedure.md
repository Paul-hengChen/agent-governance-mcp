# E125c compaction procedure (T-E125C-03)

Evidence for spec `specs/e125c-index-compaction.md` AC7-AC10. Run on 2026-09-26 by sr-engineer (fable) in the lane worktree
`<lanes-root>/e125c` (branch `feat/e125c-index-compaction`, base `165b72d`), after T-E125C-01 was built into
`dist/` (commit `0e0fca0`). The scripts lived in `$TMPDIR` only; no `tools/` or `scripts/` file was added.

Invocation: `cd <worktree> && node $TMPDIR/e125c-compact.mjs` (dry run, prints the report), then the same with `--write`
(writes `.current/_primary/tasks.md`, root `tasks.md`, `.current/tasks-index-receipt.json`), then
`node $TMPDIR/e125c-verify.mjs`.

## Result

- Baseline tag: `git describe --tags --abbrev=0` → `v3.118.0`.
- `_primary` `##` sections before: **70**. Kept **3** + compacted **67** + foreign **0** = 70.
- **Kept set (actual)**, in original order:
  - `## e145-md-tables-cited-donemark` — bytes differ from v3.118.0.
  - `## e137-render-sanitise` — bytes differ from v3.118.0. **Not in the spec's expected set.** The only difference is one
    trailing blank line: at v3.118.0 it was the last section of the file (ended at EOF); now a later section follows it, so a
    blank separator line was added. The spec's rule compares bytes, so it is kept. The spec left the actual set for sr to record.
  - `## e125a-lane-local-ledgers` — no counterpart at v3.118.0.
- Compacted (67): every other section, including the old `## Active` (428 done, 10 voided) and `## Completed` (161 done, 0 voided).
- **X7: foreign sections removed: 0** (D12 filter: a live `.current/<lane>/tasks.md` or a `.current/history/<bucket>/<lane>/tasks.md`
  for the heading's lane. The worktree has live `e125c` + history `e125b`; the primary checkout has only history `e125b`; `_primary`
  has no section for either lane.)
- Rows: before 905 `[x]`, 28 `[-]`, 0 `[ ]`. Kept 14 `[x]` + 2 `[-]`; summarized 891 `[x]` + 26 `[-]` (891 + 14 = 905, 26 + 2 = 28).
  After: 0 open rows.
- Pre-compaction commit named in the `compacted:` comment: `165b72d` (lane base on `main`, the last commit on main holding the
  pre-compaction ledgers; the files are unchanged between it and `7d74171`).

| file | bytes before | bytes after | sha256 before | sha256 after |
|---|---|---|---|---|
| `.current/_primary/tasks.md` | 548036 | 14120 | `b73f1215cfe94caa1377124692c52076f539cd1131c44cf1bb78adc150a6b175` | `7fdc034f3b5316cda0bc086e1ae99d3243a7188cbd50342b36c05d9a51a6a9e2` |
| `tasks.md` (root index) | 548452 | 14536 | `ac95f3e3fd996d047ee7574388491033e2c73f25179c0c466e43f5e012c05d58` | `b0fb7d2e42c719b6c24448b8c086f64177df7f0b8483c77ce6b56874ab37ac44` |
| receipt `bodySha256` | — | — | `4792d507ca99438e458ad5bd177eb39bcc413a2709afc3910629443d89cb8db5` | `78d4c41eb4ee167626171880a40b0f40c1cabfa238c26ef9e516dcad7c2f1262` |

Before compaction, with the T-E125C-01 fix built: `primaryIndexReceiptSha(<root body>)` = `4792d507…` = the stale receipt, and the
raw root body hashed to `9bc90da0…`. So the fix alone already made the real repo's reverse pass again (E195). The re-stamp keeps it passing.

## AC8 / round trip / consumers (output of `e125c-verify.mjs`, post-compaction)

AC10 real-data round trip: the `migratePrimaryReverse` → first tw_* read (forward) cycle ran on a `$TMPDIR` copy with a fake `.git/HEAD` on `main`.
This is sr's sanity run, not a test file. qa's AC10/AC11 test cases are separate.

```
AC8 root startsWith sentinel+notice: true
AC8 receiptSha(root body) === sha(_primary body): true
AC8 receipt file matches: true
AC8 root body === _primary body + CL: true
reverse ok; restored v1 bytes: 14404 sha: 71b1a0f58b82b59f6e28d7221f1f9bff07b9ab6cdad23ef1e58eae82afe1a53d ledger/receipt removed: true
restored v1 === V1 + root body: true
forward reproduces all three byte-for-byte: true
parse before: 905 after: 14 after ids subset w/ same state: true
kept sections in after-parse: [
  'e145-md-tables-cited-donemark',
  'e137-render-sanitise',
  'e125a-lane-local-ledgers'
]
allComplete before/after: true true
E125A ids after: 7
```

`grep -c 'lane_closed: ticket=e125b' tasks.md` → `1`.

## Script: `$TMPDIR/e125c-compact.mjs` (exact text)

```js
// E125c T-E125C-03 one-off compaction (spec AC7-AC9). Run from the lane worktree root:
//   node $TMPDIR/e125c-compact.mjs [--write]
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFileSync } from "child_process";

const WS = process.cwd();
const { primaryIndexReceiptSha } = await import(path.join(WS, "dist/tools/tasks-lane-migrate.js"));
const { resolveLaneName, hasHistoryLedger, LEGACY_LANE } = await import(path.join(WS, "dist/tools/lane-paths.js"));

const WRITE = process.argv.includes("--write");
const DATE = "2026-09-26";
const PRE_SHA = "165b72d"; // lane base on main: last commit holding the pre-compaction ledgers
const V2 = "<!-- schema_version: 2 -->\n";
const NOTICE =
  "<!-- tasks_role: index — the tw_* ledger for lane _primary is .current/_primary/tasks.md (E125a); tw_* never writes this file -->\n";
const HEADING_RE = /^##\s+(.+)/;
const OPEN_RE = /^\s*- \[ \]/, DONE_RE = /^\s*- \[x\]/, VOID_RE = /^\s*- \[-\]/;
const sha = (t) => crypto.createHash("sha256").update(t, "utf-8").digest("hex");
const count = (lines, re) => lines.filter((l) => re.test(l)).length;

const ledgerPath = path.join(WS, ".current/_primary/tasks.md");
const rootPath = path.join(WS, "tasks.md");
const receiptPath = path.join(WS, ".current/tasks-index-receipt.json");
const ledgerRaw = fs.readFileSync(ledgerPath, "utf-8");
const rootRaw = fs.readFileSync(rootPath, "utf-8");

// ---- sections of a body (preamble + `## ` blocks; trailing "\n" stripped first)
function sections(body) {
  const lines = body.replace(/\n$/, "").split("\n");
  const pre = [], secs = [];
  for (const l of lines) {
    const m = HEADING_RE.exec(l);
    if (m) secs.push({ heading: m[1].trim(), lines: [l] });
    else (secs.length ? secs[secs.length - 1].lines : pre).push(l);
  }
  return { pre, secs };
}

if (!ledgerRaw.startsWith(V2)) throw new Error("ledger is not v2");
const ledgerBody = ledgerRaw.slice(V2.length);
const { pre, secs } = sections(ledgerBody);
if (pre.length !== 3 || pre[2] !== "") throw new Error(`unexpected preamble: ${JSON.stringify(pre)}`);

// ---- baseline: the last release tag's root tasks.md
const tag = execFileSync("git", ["describe", "--tags", "--abbrev=0"], { cwd: WS, encoding: "utf-8" }).trim();
const tagRoot = execFileSync("git", ["show", `${tag}:tasks.md`], { cwd: WS, encoding: "utf-8", maxBuffer: 64 << 20 });
const tagSecs = new Map(sections(tagRoot.replace(/^<!--\s*schema_version:\s*\d+\s*-->\n/, "")).secs.map((s) => [s.heading, s.lines.join("\n")]));

// ---- X7: foreign sections (D12 ownership filter: live lane ledger or history-bucket ledger)
const isForeign = (heading) => {
  const lane = resolveLaneName(heading);
  if (lane === LEGACY_LANE) return false;
  return fs.existsSync(path.join(WS, ".current", lane, "tasks.md")) || hasHistoryLedger(WS, lane, "tasks.md");
};

const kept = [], compacted = [], foreign = [];
for (const s of secs) {
  if (isForeign(s.heading)) { foreign.push(s); continue; }
  const base = tagSecs.get(s.heading);
  const why = count(s.lines, OPEN_RE) > 0 ? "open row" : base === undefined ? "no counterpart at " + tag : base !== s.lines.join("\n") ? "changed since " + tag : null;
  (why ? kept : compacted).push({ ...s, why });
}

const X = compacted.reduce((n, s) => n + count(s.lines, DONE_RE), 0);
const V = compacted.reduce((n, s) => n + count(s.lines, VOID_RE), 0);
const out = [
  pre[0], pre[1], "",
  "## Active",
  "_(No active tasks — ready for the next feature.)_",
  "",
  "## Compacted History",
  `<!-- compacted: E125c ${DATE} — ${compacted.length} sections, ${X} [x] rows, ${V} [-] rows summarized below; full rows: git log -i --grep <ticket-id>, or git log -p -- .current/_primary/tasks.md (pre-compaction commit ${PRE_SHA} is auxiliary and invalidated by a history rewrite, E104) -->`,
  ...compacted.map((s) => `- ${s.heading}: ${count(s.lines, DONE_RE)} done, ${count(s.lines, VOID_RE)} voided`),
  "",
  ...kept.flatMap((s) => s.lines),
];
while (out.length && out[out.length - 1].trim() === "") out.pop();
const newBody = out.join("\n") + "\n";

// ---- root: sentinel + notice + new body + the pre-compaction root CL section bytes
if (!rootRaw.startsWith(V2 + NOTICE)) throw new Error("root is not a v2 index with the notice");
const rootBody = rootRaw.slice(V2.length + NOTICE.length);
const clAt = rootBody.search(/\n\n## Closed Lanes\n/);
if (clAt < 0) throw new Error("no Closed Lanes section in root");
const clText = rootBody.slice(clAt + 1); // "\n## Closed Lanes\n\n<ptr>\n"
if (rootBody.slice(0, clAt + 1) !== ledgerBody) throw new Error("root body before CL != _primary ledger body (pre-compaction)");
const newRootBody = newBody + clText;
const receipt = `${JSON.stringify({ bodySha256: primaryIndexReceiptSha(newRootBody) })}\n`;

const all = (re) => count(ledgerBody.split("\n"), re);
const keptX = kept.reduce((n, s) => n + count(s.lines, DONE_RE), 0);
const keptV = kept.reduce((n, s) => n + count(s.lines, VOID_RE), 0);
console.log(JSON.stringify({
  tag, sections: secs.length, kept: kept.map((s) => `${s.heading} (${s.why})`), compacted: compacted.length,
  foreignSectionsRemoved: foreign.length, foreign: foreign.map((s) => s.heading),
  rows: { before: { done: all(DONE_RE), voided: all(VOID_RE), open: all(OPEN_RE) }, keptDone: keptX, keptVoided: keptV, summarizedDone: X, summarizedVoided: V,
          after: { open: count(newBody.split("\n"), OPEN_RE), done: count(newBody.split("\n"), DONE_RE), voided: count(newBody.split("\n"), VOID_RE) } },
  checks: { keptPlusCompactedPlusForeign: kept.length + compacted.length + foreign.length === secs.length, doneSum: X + keptX === all(DONE_RE), voidSum: V + keptV === all(VOID_RE),
            receiptEqualsShaOfNewBody: primaryIndexReceiptSha(newRootBody) === sha(newBody) },
  sizes: { ledger: [Buffer.byteLength(ledgerRaw), Buffer.byteLength(V2 + newBody)], root: [Buffer.byteLength(rootRaw), Buffer.byteLength(V2 + NOTICE + newRootBody)] },
  sha256: { ledgerBefore: sha(ledgerRaw), ledgerAfter: sha(V2 + newBody), rootBefore: sha(rootRaw), rootAfter: sha(V2 + NOTICE + newRootBody),
            receiptBefore: JSON.parse(fs.readFileSync(receiptPath, "utf-8")).bodySha256, receiptAfter: JSON.parse(receipt).bodySha256 },
}, null, 2));

if (WRITE) {
  fs.writeFileSync(ledgerPath, V2 + newBody);
  fs.writeFileSync(rootPath, V2 + NOTICE + newRootBody);
  fs.writeFileSync(receiptPath, receipt);
  console.log("written");
}
```

## Script: `$TMPDIR/e125c-verify.mjs` (exact text)

```js
// E125c T-E125C-03 post-compaction verification (AC8, AC10 sanity, AC11 sanity). cwd = lane worktree.
import fs from "fs"; import os from "os"; import path from "path"; import crypto from "crypto"; import { execFileSync } from "child_process";
const WS = process.cwd();
const mig = await import(path.join(WS, "dist/tools/tasks-lane-migrate.js"));
const tf = await import(path.join(WS, "dist/tools/tasks-file.js"));
const st = await import(path.join(WS, "dist/tools/storage.js"));
st.setActiveStorage(new st.FileHandoffStorage());
const sha = (t) => crypto.createHash("sha256").update(t, "utf-8").digest("hex");
const V2 = "<!-- schema_version: 2 -->\n";
const NOTICE = "<!-- tasks_role: index — the tw_* ledger for lane _primary is .current/_primary/tasks.md (E125a); tw_* never writes this file -->\n";
const FILES = ["tasks.md", ".current/_primary/tasks.md", ".current/tasks-index-receipt.json"];
const read = (ws) => FILES.map((f) => fs.readFileSync(path.join(ws, f), "utf-8"));
function copyTo(files) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "e125c-verify-"));
  fs.mkdirSync(path.join(ws, ".git")); fs.writeFileSync(path.join(ws, ".git/HEAD"), "ref: refs/heads/main\n");
  FILES.forEach((f, i) => { fs.mkdirSync(path.dirname(path.join(ws, f)), { recursive: true }); fs.writeFileSync(path.join(ws, f), files[i]); });
  return ws;
}
const [root, ledger, receipt] = read(WS);
// AC8
const rootBody = root.slice(V2.length + NOTICE.length);
const ledgerBody = ledger.slice(V2.length);
console.log("AC8 root startsWith sentinel+notice:", root.startsWith(V2 + NOTICE));
console.log("AC8 receiptSha(root body) === sha(_primary body):", mig.primaryIndexReceiptSha(rootBody) === sha(ledgerBody));
console.log("AC8 receipt file matches:", JSON.parse(receipt).bodySha256 === sha(ledgerBody));
console.log("AC8 root body === _primary body + CL:", rootBody.startsWith(ledgerBody) && /^\n## Closed Lanes\n\n<!-- lane_closed: ticket=e125b /.test(rootBody.slice(ledgerBody.length)));
// AC10 round trip on a TMPDIR copy: reverse, then forward via first tw_* read
const ws = copyTo([root, ledger, receipt]);
mig.migratePrimaryReverse(ws);
const v1 = fs.readFileSync(path.join(ws, "tasks.md"), "utf-8");
console.log("reverse ok; restored v1 bytes:", Buffer.byteLength(v1), "sha:", sha(v1), "ledger/receipt removed:", !fs.existsSync(path.join(ws, FILES[1])) && !fs.existsSync(path.join(ws, FILES[2])));
console.log("restored v1 === V1 + root body:", v1 === "<!-- schema_version: 1 -->\n" + rootBody);
tf.getNextTaskFromFile(ws);
const after = read(ws);
console.log("forward reproduces all three byte-for-byte:", after.every((t, i) => t === [root, ledger, receipt][i]));
// AC11 sanity: parse before/after
const pre = FILES.map((f) => execFileSync("git", ["show", `HEAD:${f}`], { cwd: WS, encoding: "utf-8", maxBuffer: 64 << 20 }));
const wsPre = copyTo(pre), wsPost = copyTo([root, ledger, receipt]);
const tPre = tf.parseTasksFromFile(wsPre), tPost = tf.parseTasksFromFile(wsPost);
const preMap = new Map(tPre.map((t) => [t.id, t]));
console.log("parse before:", tPre.length, "after:", tPost.length, "after ids subset w/ same state:", tPost.every((t) => preMap.has(t.id) && JSON.stringify(preMap.get(t.id).status ?? preMap.get(t.id).state ?? preMap.get(t.id).completed) === JSON.stringify(t.status ?? t.state ?? t.completed)));
console.log("kept sections in after-parse:", [...new Set(tPost.map((t) => t.section))]);
console.log("allComplete before/after:", JSON.parse(tf.getNextTaskFromFile(wsPre)).allComplete, JSON.parse(tf.getNextTaskFromFile(wsPost)).allComplete);
console.log("E125A ids after:", tPost.filter((t) => /^T-E125A-/.test(t.id)).length);
```
