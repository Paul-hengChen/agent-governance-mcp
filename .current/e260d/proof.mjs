// Coded by @sr-engineer
// Comment-only proof for lane e260d; checks: specs/e260d-core-dirs-comment-trim.md.
// Usage, from the worktree root: node .current/e260d/proof.mjs [--base <rev>] [--changed-only] [--list-mid]
//   --base          base revision (default: first line of .current/e260d/base-sha)
//   --changed-only  run the >20 and bare-id checks on changed files only (per-task runs)
//   --list-mid      also print every 8-20 line block as `<file>:<line> <counted>`
// Prints one line per check, then `proof: PASS` or `proof: FAIL (<checks>)`; exit 1 on FAIL.
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { analyzeText } = await import(new URL("../../dist/tools/comment-scan.js", import.meta.url).href);

const LANE = ["gates", "prompts", "schema", "lib", "guards", "transport", "index.ts"];
const FORBIDDEN = ["tools", "dist/tools", "test", "bin", "scripts", "content", "templates", "docs",
  "specs/fanout-*.md", "CHANGELOG.md", "package.json", "CLAUDE.md", "AGENTS.md", ".antigravityrules", ".current/history"];
const ALLOWED_MARK = /^\/\/\s{3}AGENT_ID_REQUIRED\s/;
const ALLOWED_MAX = 34;
// Tokens test/lane-paths and test/lane-migrate count per file, comments included.
const PINNED_TOKENS = ["resolveLanePaths", "lane-paths", "resolveCurrentLane", "migrateFlatToLane(", "migrateLaneToFlat(", "migrateFlatToLaneLocked"];
const BARE_ID = /^\s*(\/\/|\/\*|\*|#)\s*\(?E[0-9]+[a-z]?\b[^A-Za-z]*(\(e[0-9][a-z0-9-]*\))?\s*[:—-]?\s*$/;

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8", maxBuffer: 64 << 20 });
const lines = (s) => s.split("\n").filter(Boolean);

function resolveBase() {
  const i = argv.indexOf("--base");
  if (i >= 0 && argv[i + 1]) return argv[i + 1];
  const f = path.join(root, ".current", "e260d", "base-sha");
  const first = existsSync(f) ? readFileSync(f, "utf8").split("\n")[0].trim() : "";
  if (!first) {
    console.error("proof: no base — pass --base <rev> or write .current/e260d/base-sha");
    process.exit(2);
  }
  return first;
}

const base = resolveBase();
const baseText = (f) => git("show", `${base}:${f}`);
const headText = (f) => readFileSync(path.join(root, f), "utf8");
const failed = [];
const report = (name, ok, line, details = []) => {
  console.log(line);
  for (const d of details) console.log(`  ${d}`);
  if (!ok) failed.push(name);
};

// scope (AC3)
const status = lines(git("diff", "--name-status", base, "--", ...LANE)).map((l) => l.split("\t"));
const untracked = lines(git("ls-files", "--others", "--exclude-standard", "--", ...LANE));
const scopeBad = [
  ...status.filter(([s, f]) => s !== "M" || !f.endsWith(".ts")).map(([s, ...f]) => `${s} ${f.join(" ")}`),
  ...untracked.map((f) => `?? ${f}`),
  ...lines(git("diff", "--name-only", base, "--", ...FORBIDDEN)).map((f) => `forbidden ${f}`),
];
const changed = status.filter(([s, f]) => s === "M" && f.endsWith(".ts")).map(([, f]) => f);
console.log(`base: ${base.slice(0, 7)}, changed: ${changed.length} file(s)`);
report("scope", scopeBad.length === 0, scopeBad.length ? `scope: ${scopeBad.length} bad path(s)` : "scope: ok", scopeBad);

// emit (AC1)
const cfg = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile);
const compilerOptions = {
  ...ts.convertCompilerOptionsFromJson(cfg.config.compilerOptions, root).options,
  removeComments: true, sourceMap: false, inlineSourceMap: false, declaration: false, declarationMap: false,
};
const emit = (text, fileName) => ts.transpileModule(text, { fileName, compilerOptions }).outputText;
const emitBad = changed.filter((f) => emit(baseText(f), f) !== emit(headText(f), f));
report("emit", emitBad.length === 0, `emit: ${changed.length} files, ${emitBad.length} differ`, emitBad);

// tokens (AC2)
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
const tokBad = changed.filter((f) => leaves(baseText(f), f) !== leaves(headText(f), f));
report("tokens", tokBad.length === 0, `tokens: ${changed.length} files, ${tokBad.length} differ`, tokBad);

// pinned token counts per changed file (lane-paths / lane-migrate allow-lists)
const countOf = (text, t) => text.split(t).length - 1;
const pinBad = [];
for (const f of changed) {
  const [b, h] = [baseText(f), headText(f)];
  for (const t of PINNED_TOKENS) {
    const [nb, nh] = [countOf(b, t), countOf(h, t)];
    if (nb !== nh) pinBad.push(`${f}: ${t} ${nb} -> ${nh}`);
  }
}
report("pins", pinBad.length === 0, `pins: ${changed.length} files, ${pinBad.length} count change(s)`, pinBad);

// long blocks (AC4, AC5) and bare-id (AC7)
const scanSet = flag("--changed-only") ? changed : lines(git("ls-files", "--", ...LANE)).filter((f) => f.endsWith(".ts"));
const over = [];
const mid = [];
const bare = [];
let allowed = 0;
for (const f of scanSet) {
  const text = headText(f);
  const raw = text.split(/\r?\n/);
  const a = analyzeText(text);
  for (const b of a.blocks) {
    if (b.counted > 20) {
      const isTable = f === "gates/registry.ts" && raw.slice(b.start - 1, b.end).some((l) => ALLOWED_MARK.test(l));
      if (isTable && b.counted <= ALLOWED_MAX) allowed++;
      else over.push(`${f}:${b.start} ${b.counted}`);
    } else if (b.counted >= 8) mid.push(`${f}:${b.start} ${b.counted}`);
  }
  a.lines.forEach((l, i) => { if (l.kind === "comment" && BARE_ID.test(raw[i])) bare.push(`${f}:${i + 1}`); });
}
report(">20", over.length === 0, `>20: ${over.length} unexpected (${allowed} allowed: gates/registry.ts mapping table)`, over);
if (flag("--list-mid")) {
  console.log(`8-20: ${mid.length} block(s)`);
  for (const m of mid) console.log(`  ${m}`);
}
report("bare-id", bare.length === 0, `bare-id: ${bare.length}`, bare);

// form (AC8)
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
  return [...seen.values()].map((r) => ({ multi: r.kind === ts.SyntaxKind.MultiLineCommentTrivia, text: text.slice(r.pos, r.end) }));
}
const pinned = (text) => text.split(/\r?\n/).filter((l) => /^\s*(\/\*!|\/\/\/\s*<reference)/.test(l)).join("\n");
const formBad = [];
for (const f of changed) {
  const [b, h] = [baseText(f), headText(f)];
  if (b.split("\n")[0] !== h.split("\n")[0]) formBad.push(`${f}: first line changed`);
  const [cb, ch] = [comments(b, f), comments(h, f)];
  const nb = cb.filter((c) => c.multi).length;
  const nh = ch.filter((c) => c.multi).length;
  if (nh > nb) formBad.push(`${f}: block comments ${nb} -> ${nh}`);
  const heading = ch.some((c) => c.text.split("\n").some((l) => /^\s*(\/\/+|\/\*+|\*+)?\s*##/.test(l)));
  if (heading) formBad.push(`${f}: comment contains a ## heading`);
  if (pinned(b) !== pinned(h)) formBad.push(`${f}: /*! or /// <reference line changed`);
}
report("form", formBad.length === 0, formBad.length ? `form: ${formBad.length} problem(s)` : "form: ok", formBad);

console.log(failed.length ? `proof: FAIL (${failed.join(", ")})` : "proof: PASS");
process.exit(failed.length ? 1 : 0);
