// Coded by @qa-engineer
// Comment-only proof for lane e260i; checks: specs/e260i-budget-render-comment-trim.md.
// Usage, from the worktree root: node .current/e260i/proof.mjs [--base <rev>] [--changed-only] [--list-mid]
//   --base          base revision (default: first line of .current/e260i/base-sha)
//   --changed-only  run the >20, 8-20 and bare-id checks on changed files only (per-task runs)
//   --head-root <dir>  self-test only: read HEAD file text from <dir>/<path> instead of the worktree
//   --through <file>:<line>  per-task runs: limit the >20, 8-20 and bare-id checks of <file> to HEAD lines <= <line>
//   --list-mid      also print every 8-20 line block as `<file>:<line> <counted>`
// Prints one line per check, then `proof: PASS` or `proof: FAIL (<checks>)`; exit 1 on FAIL.
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { analyzeText } = await import(new URL("../../dist/tools/comment-scan.js", import.meta.url).href);

// Owned set (AC3): exactly two test files.
const OWNED = /^test\/(context-budget|render-structure)\.test\.mjs$/;
const RENDER = "test/render-structure.test.mjs";
// Paths besides owned test files that the lane may change.
const ALLOWED = [/^specs\/e260i-[^/]+$/, /^qa_reports\/[^/]*E260I[^/]*$/, /^review_reports\/[^/]*E260I[^/]*$/, /^\.current\/e260i\//];
const FORBIDDEN = ["content", "test/fixtures", "test/eval", "templates", "docs", "specs/fanout-*.md", "CHANGELOG.md", "package.json",
  "CLAUDE.md", "AGENTS.md", ".antigravityrules", ".current/history", "dist", "tools", "gates", "prompts",
  "schema", "lib", "guards", "transport", "bin", "scripts", "index.ts"];
const DIRECTIVE = /@ts-|eslint-|istanbul|\bc8 (?:ignore|disable|enable)|prettier-ignore|__PURE__|@vite|@vitest/;
// Bare-id (AC7): after removing id tokens (E/AC/DR/T- ids, range forms such as E1A-1..7, e-slugs)
// and joiners, nothing is left.
const ID_TOKEN = /\b(?:E\d+[A-Za-z]?(?:-\d+(?:\.\.\d+)?)?|AC-E\d+[A-Za-z]?-\d+(?:\.\.\d+)?|AC-?\d+[A-Za-z]?|DR-?\d+[A-Za-z]?|T-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*(?:\.\.\d+)?|e\d+[a-z0-9-]*)\b/g;
const JOINERS = /\b(and|or|to|see|per|cf|ref|refs)\b|[\s,;:&+/()\[\]—–.\-]|\.\./gi;
function bareId(rawLine) {
  const content = rawLine.replace(/^\s*(\/\/+|\/\*+|\*+\/?|#)/, "").replace(/\*\/\s*$/, "");
  if (!ID_TOKEN.test(content)) return false;
  ID_TOKEN.lastIndex = 0;
  return content.replace(ID_TOKEN, "").replace(JOINERS, "").length === 0;
}
// Hygiene (AC11). The home-directory prefixes are assembled here so this file never holds the literal.
const HOME = new RegExp(["Users", "home"].map((d) => `/${d}/`).join("|"));
const HYGIENE = [
  ["home path", HOME],
  ["url", /https?:\/\//],
  ["sha", /\b(?=[0-9a-f]*[a-f])(?=[0-9a-f]*[0-9])[0-9a-f]{7,40}\b/],
  ["git show", /\bgit show\b/],
  ["git log", /\bgit log\b/],
];

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8", maxBuffer: 64 << 20 });
const lines = (s) => s.split("\n").filter(Boolean);

function resolveBase() {
  const i = argv.indexOf("--base");
  if (i >= 0 && argv[i + 1]) return argv[i + 1];
  const f = path.join(root, ".current", "e260i", "base-sha");
  const first = existsSync(f) ? readFileSync(f, "utf8").split("\n")[0].trim() : "";
  if (!first) {
    console.error("proof: no base — pass --base <rev> or write .current/e260i/base-sha");
    process.exit(2);
  }
  return first;
}

const base = resolveBase();
const baseText = (f) => git("show", `${base}:${f}`);
const headRootAt = argv.indexOf("--head-root");
const headRoot = headRootAt >= 0 ? path.resolve(argv[headRootAt + 1]) : root;
const headText = (f) => readFileSync(path.join(headRoot, f), "utf8");
const failed = [];
const report = (name, ok, line, details = []) => {
  console.log(line);
  for (const d of details) console.log(`  ${d}`);
  if (!ok) failed.push(name);
};

// scope (AC3)
const status = lines(git("diff", "--name-status", "--no-renames", base)).map((l) => l.split("\t"));
const untracked = lines(git("ls-files", "--others", "--exclude-standard"));
const allowedPath = (f) => ALLOWED.some((re) => re.test(f));
const scopeBad = [
  ...status.filter(([s, f]) => !(OWNED.test(f) && s === "M") && !allowedPath(f)).map(([s, f]) => `${s} ${f}`),
  ...untracked.filter((f) => f.startsWith("test/") || !allowedPath(f)).map((f) => `?? ${f}`),
  ...lines(git("diff", "--name-only", base, "--", ...FORBIDDEN)).map((f) => `forbidden ${f}`),
];
const changed = headRootAt >= 0
  ? ["test/context-budget.test.mjs", RENDER].filter((f) => existsSync(path.join(headRoot, f)) && headText(f) !== baseText(f))
  : status.filter(([s, f]) => s === "M" && OWNED.test(f)).map(([, f]) => f);
console.log(`base: ${base.slice(0, 7)}, changed: ${changed.length} file(s)`);
report("scope", scopeBad.length === 0, scopeBad.length ? `scope: ${scopeBad.length} bad path(s)` : "scope: ok", scopeBad);

// emit (AC1)
const compilerOptions = {
  removeComments: true, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext,
  sourceMap: false, inlineSourceMap: false,
};
const emit = (text, fileName) => ts.transpileModule(text, { fileName, compilerOptions }).outputText;
const emitBad = changed.filter((f) => emit(baseText(f), f) !== emit(headText(f), f));
report("emit", emitBad.length === 0, `emit: ${changed.length} files, ${emitBad.length} differ`, emitBad);

// leaves (AC2)
function leaves(text, f) {
  const out = [];
  const walk = (n) => {
    if (n.kind >= ts.SyntaxKind.FirstJSDocNode && n.kind <= ts.SyntaxKind.LastJSDocNode) return;
    if (n.kind === ts.SyntaxKind.EndOfFileToken) return;
    const kids = n.getChildren();
    if (kids.length === 0) out.push(`${n.kind}\u0000${n.getText()}`);
    else kids.forEach(walk);
  };
  walk(ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true));
  return out.join("\n");
}
const leafBad = changed.filter((f) => leaves(baseText(f), f) !== leaves(headText(f), f));
report("leaves", leafBad.length === 0, `leaves: ${changed.length} files, ${leafBad.length} differ`, leafBad);

// long blocks (AC4, AC5) and bare-id (AC7)
const owned = lines(git("ls-files", "--", "test")).filter((f) => OWNED.test(f));
const thr = argv.indexOf("--through");
const [thrFile, thrLine] = thr >= 0 ? [argv[thr + 1].split(":")[0], Number(argv[thr + 1].split(":")[1])] : [null, Infinity];
const upTo = (f, n) => f !== thrFile || n <= thrLine;
const scanSet = flag("--changed-only") ? changed : owned;
const over = [];
const mid = [];
const bare = [];
for (const f of scanSet) {
  const text = headText(f);
  const raw = text.split(/\r?\n/);
  const a = analyzeText(text);
  for (const b of a.blocks) {
    if (!upTo(f, b.start)) continue;
    if (b.counted > 20) over.push(`${f}:${b.start} ${b.counted}`);
    else if (b.counted >= 8) mid.push(`${f}:${b.start} ${b.counted}`);
  }
  a.lines.forEach((l, i) => { if (l.kind === "comment" && upTo(f, i + 1) && bareId(raw[i])) bare.push(`${f}:${i + 1}`); });
}
console.log(`scanned: ${scanSet.length} file(s)${flag("--changed-only") ? " (changed only)" : ""}`);
report(">20", over.length === 0, `>20: ${over.length}`, over);
console.log(`8-20: ${mid.length} block(s)`);
if (flag("--list-mid")) for (const m of mid) console.log(`  ${m}`);
report("bare-id", bare.length === 0, `bare-id: ${bare.length}`, bare);

// directives and form (AC8)
function comments(text, f) {
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true);
  const seen = new Map();
  const add = (rs) => (rs ?? []).forEach((r) => seen.set(r.pos, r));
  const walk = (n) => {
    if (n.kind >= ts.SyntaxKind.FirstJSDocNode && n.kind <= ts.SyntaxKind.LastJSDocNode) return;
    const kids = n.getChildren();
    if (kids.length === 0 || n.kind === ts.SyntaxKind.EndOfFileToken) {
      add(ts.getLeadingCommentRanges(text, n.getFullStart()));
      add(ts.getTrailingCommentRanges(text, n.getEnd()));
    } else kids.forEach(walk);
  };
  walk(sf);
  return [...seen.values()].sort((x, y) => x.pos - y.pos)
    .map((r) => ({ multi: r.kind === ts.SyntaxKind.MultiLineCommentTrivia, text: text.slice(r.pos, r.end) }));
}
const pinned = (text) => text.split(/\r?\n/).filter((l) => /^\s*(\/\*!|\/\/\/\s*<reference)/.test(l)).join("\n");
const dirBad = [];
const formBad = [];
const hygBad = [];
for (const f of changed) {
  const [b, h] = [baseText(f), headText(f)];
  const [cb, ch] = [comments(b, f), comments(h, f)];
  const dirs = (cs) => cs.filter((c) => DIRECTIVE.test(c.text)).map((c) => c.text).join("\n\u0000\n");
  if (dirs(cb) !== dirs(ch)) dirBad.push(`${f}: directive comments differ`);
  if (b.split("\n")[0] !== h.split("\n")[0]) formBad.push(`${f}: first line changed`);
  const nb = cb.filter((c) => c.multi).length;
  const nh = ch.filter((c) => c.multi).length;
  if (nh > nb) formBad.push(`${f}: block comments ${nb} -> ${nh}`);
  if (ch.some((c) => c.text.split("\n").some((l) => /^\s*(\/\/+|\/\*+|\*+)?\s*##/.test(l)))) {
    formBad.push(`${f}: comment contains a ## heading`);
  }
  if (pinned(b) !== pinned(h)) formBad.push(`${f}: /*! or /// <reference line changed`);
  // New comment lines = HEAD comment lines not present (as a multiset) in the base comments.
  const pool = new Map();
  for (const c of cb) for (const l of c.text.split("\n")) pool.set(l.trim(), (pool.get(l.trim()) ?? 0) + 1);
  for (const c of ch) {
    for (const l of c.text.split("\n")) {
      const k = l.trim();
      if (pool.get(k) > 0) { pool.set(k, pool.get(k) - 1); continue; }
      for (const [name, re] of HYGIENE) if (re.test(k)) hygBad.push(`${f}: ${name}: ${k.slice(0, 100)}`);
    }
  }
}
report("directives", dirBad.length === 0, dirBad.length ? `directives: ${dirBad.length} problem(s)` : "directives: ok", dirBad);
report("form", formBad.length === 0, formBad.length ? `form: ${formBad.length} problem(s)` : "form: ok", formBad);
report("hygiene", hygBad.length === 0, hygBad.length ? `hygiene: ${hygBad.length} problem(s)` : "hygiene: ok", hygBad);

// width (AC13): added comment lines wider than 120 columns fail; over 100 is a warning.
const words = (cs) => cs.join(" ").replace(/\/\/+|\/\*+|\*+\/|(^|\s)\*+(?=\s|$)/g, " ").split(/\s+/).filter(Boolean).sort().join(" ");
const wideBad = [];
const wideWarn = [];
for (const f of changed) {
  const [b, h] = [baseText(f), headText(f)];
  const pool = new Map();
  for (const c of comments(b, f)) for (const l of c.text.split("\n")) pool.set(l.trim(), (pool.get(l.trim()) ?? 0) + 1);
  const rawH = h.split(/\r?\n/);
  const lineStarts = [];
  { let o = 0; for (const l of h.split("\n")) { lineStarts.push(o); o += l.length + 1; } }
  const lineOf = (pos) => { let lo = 0, hi = lineStarts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (lineStarts[m] <= pos) lo = m; else hi = m - 1; } return lo; };
  const sf = [];
  const walkRanges = (text) => {
    const seen = new Map();
    const add = (rs) => (rs ?? []).forEach((r) => seen.set(r.pos, r));
    const sfile = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true);
    const w = (n) => {
      if (n.kind >= ts.SyntaxKind.FirstJSDocNode && n.kind <= ts.SyntaxKind.LastJSDocNode) return;
      const kids = n.getChildren();
      if (kids.length === 0 || n.kind === ts.SyntaxKind.EndOfFileToken) {
        add(ts.getLeadingCommentRanges(text, n.getFullStart()));
        add(ts.getTrailingCommentRanges(text, n.getEnd()));
      } else kids.forEach(w);
    };
    w(sfile);
    return [...seen.values()].sort((x, y) => x.pos - y.pos);
  };
  for (const r of walkRanges(h)) {
    const t = h.slice(r.pos, r.end).split("\n");
    t.forEach((l, i) => {
      const k = l.trim();
      if (pool.get(k) > 0) { pool.set(k, pool.get(k) - 1); return; }
      const raw = rawH[lineOf(r.pos) + i] ?? "";
      if (raw.length > 120) wideBad.push(`${f}:${lineOf(r.pos) + i + 1} ${raw.length} cols`);
      else if (raw.length > 100) wideWarn.push(`${f}:${lineOf(r.pos) + i + 1} ${raw.length} cols`);
    });
  }
}
report("width", wideBad.length === 0, wideBad.length ? `width: ${wideBad.length} line(s) over 120` : "width: ok", wideBad);
if (wideWarn.length) console.log(`width warning: ${wideWarn.length} new line(s) over 100 columns`);

// reflow (AC13): a base block whose word multiset reappears in a HEAD block with fewer counted lines.
const reflowBad = [];
for (const f of changed) {
  const blocksOf = (text) => {
    const a = analyzeText(text);
    const raw = text.split(/\r?\n/);
    return a.blocks.map((b) => ({ start: b.start, counted: b.counted, w: words(raw.slice(b.start - 1, b.end)) }));
  };
  const hb = blocksOf(headText(f));
  for (const bb of blocksOf(baseText(f))) {
    if (bb.counted <= 1) continue;
    const hit = hb.find((x) => x.w === bb.w && x.counted < bb.counted);
    if (hit) reflowBad.push(`${f}: base block ${bb.start} (${bb.counted}) reflowed to HEAD block ${hit.start} (${hit.counted})`);
  }
}
report("reflow", reflowBad.length === 0, reflowBad.length ? `reflow: ${reflowBad.length} problem(s)` : "reflow: ok", reflowBad);

// pinned (AC12): the two regex code lines are read as text by the e122 test.
const PINS = ["const NUMHEADER_RE = /", "const BULLET_RE = /"];
const pinBad = [];
{
  const [b, h] = [baseText(RENDER), headText(RENDER)];
  const count = (t, s) => t.split(s).length - 1;
  for (const p of PINS) {
    if (count(h, p) !== 1) pinBad.push(`"${p}" appears ${count(h, p)} time(s) in HEAD (want exactly 1)`);
    const lb = b.split("\n").filter((l) => l.includes(p));
    const lh = h.split("\n").filter((l) => l.includes(p));
    if (lb.length !== 1 || lh.length !== 1 || lb[0] !== lh[0]) pinBad.push(`"${p}" line differs from base`);
  }
}
report("pinned", pinBad.length === 0, pinBad.length ? `pinned: ${pinBad.length} problem(s)` : "pinned: ok", pinBad);

console.log(failed.length ? `proof: FAIL (${failed.join(", ")})` : "proof: PASS");
process.exit(failed.length ? 1 : 0);
