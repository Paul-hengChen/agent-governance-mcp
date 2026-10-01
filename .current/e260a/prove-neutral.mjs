// Coded by @sr-engineer
// Proves the lane is comment-only: removeComments transpile output is
// byte-identical at base and in the working tree, plus scope, style and pins.
// Usage: node .current/e260a/prove-neutral.mjs [--base <rev>]
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const base = args.includes("--base") ? args[args.indexOf("--base") + 1] : "b37178a";
const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8", maxBuffer: 1 << 26 });
const lines = (s) => s.split("\n").filter(Boolean);
const atBase = (f) => git("show", `${base}:${f}`);
const atHead = (f) => fs.readFileSync(path.join(root, f), "utf8");
const out = [];

const owned = [/^tools\/[a-h][^/]*$/, /^dist\/tools\/[a-h][^/]*$/, /^specs\/e260a-/, /^qa_reports\/[^/]*E260A/,
  /^review_reports\/[^/]*E260A/, /^\.current\/e260a\//];
const touched = [...lines(git("diff", "--name-only", base)), ...lines(git("ls-files", "--others", "--exclude-standard"))];
for (const p of new Set(touched)) if (!owned.some((re) => re.test(p))) out.push(`OUT-OF-SCOPE ${p}`);

const transpile = (src, fileName) => ts.transpileModule(src, {
  fileName, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, removeComments: true },
}).outputText;

// Walks every token's comment trivia via the parser, so strings and regexes never count.
function blockOpeners(src) {
  const sf = ts.createSourceFile("x.ts", src, ts.ScriptTarget.ES2022, true);
  const seen = new Set();
  const take = (rs) => rs?.forEach((r) => r.kind === ts.SyntaxKind.MultiLineCommentTrivia && seen.add(r.pos));
  const walk = (node) => {
    take(ts.getLeadingCommentRanges(src, node.pos));
    take(ts.getTrailingCommentRanges(src, node.end));
    node.getChildren(sf).forEach(walk);
  };
  walk(sf);
  return seen.size;
}
const markers = (src) => src.split("\n").filter((l) => /^\s*\/\/ Coded by @/.test(l)).length;

const pins = {
  "tools/handoff.ts": ["@deprecated v3.15.0:", "options-object overload", "removal in v4.0.0"],
  "tools/feature-rollup.ts": ["SEAM FOR E132"],
  "tools/fanout-manifest.ts": ["the single canonical copy"],
};
// Tests that list exactly which files mention these tokens count comments too.
const callerTokens = ["lane-paths", "resolveLanePaths", "resolveCurrentLane", "migrateFlatToLane(",
  "migrateLaneToFlat(", "migrateFlatToLaneLocked"];
function template3bComment(src) {
  const decl = src.indexOf("export const PROMPT_TEMPLATE_3B");
  const start = decl < 0 ? -1 : src.lastIndexOf("/**", decl);
  const end = start < 0 ? -1 : src.indexOf("*/", start);
  return end > start && end < decl ? src.slice(start, end + 2) : "";
}

const changed = lines(git("diff", "--name-only", base, "--", "tools")).filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"));
for (const f of changed) {
  const b = atBase(f);
  const h = atHead(f);
  if (transpile(b, f) !== transpile(h, f)) out.push(`DIFF ${f}`);
  if (blockOpeners(h) > blockOpeners(b) || (f === "tools/dispatch-log.ts" && blockOpeners(h) > 0)) out.push(`STYLE ${f}`);
  if (markers(h) !== markers(b)) out.push(`MARKER ${f}`);
  for (const p of pins[f] ?? []) if (!h.includes(p)) out.push(`PIN-MISSING ${f} ${p}`);
  if (f === "tools/fanout-manifest.ts") {
    const c = template3bComment(h);
    for (const p of ["content/skill-integrator.md", "the single canonical copy", "E177a render golden"]) {
      if (!c.includes(p)) out.push(`PIN-MISSING ${f} ${p} (PROMPT_TEMPLATE_3B doc comment)`);
    }
    if (h.includes("commands/integrator")) out.push(`PIN-MISSING ${f} no commands/integrator`);
  }
  if (h.includes("lane-paths") && !b.includes("lane-paths")) out.push(`NEW-TOKEN ${f} lane-paths`);
  if (!h.includes("lane-paths") && b.includes("lane-paths")) out.push(`PIN-MISSING ${f} lane-paths`);
  for (const t of callerTokens) {
    const [nb, nh] = [b.split(t).length - 1, h.split(t).length - 1];
    if (nb !== nh) out.push(`TOKEN-COUNT ${f} ${t} base=${nb} head=${nh}`);
  }
}

out.forEach((l) => console.log(l));
if (out.length === 0) console.log(`neutral OK: ${changed.length} files`);
process.exit(out.length === 0 ? 0 : 1);
