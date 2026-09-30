// Coded by @sr-engineer
// Comment-length scan (E258B, E259): the sixth `agc check` advisory. It flags
// long comment blocks and comment-heavy files in the lines the current change
// adds, and never changes the exit code. Rules and rationale: specs/e258b-*
// and specs/e259-comment-scan-languages*.md.

import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "node:child_process";
import type { LangSpec, LexedLine, TagRule } from "./comment-types.js";
import { jsLang, langForPath, scannedExtensions } from "./comment-langs.js";

export type { LineKind, LexedLine } from "./comment-types.js";
export { lexJs as lexLines } from "./comment-lang-js.js";

export const commentLimits = Object.freeze({
  maxBlockLines: 7,
  maxRatioPercent: 30,
  minRatioLines: 50,
  maxListed: 50,
  maxContentBytes: 1048576,
  binarySniffBytes: 8192,
} as const);

export interface CommentBlock {
  start: number;
  end: number;
  counted: number;
}

export interface FileAnalysis {
  lines: LexedLine[];
  nonBlank: number;
  commentLines: number;
  blocks: CommentBlock[];
}

export type AddedLines = ReadonlySet<number> | "all";

export type Finding =
  | { kind: "long-block"; path: string; line: number; lines: number }
  | { kind: "high-ratio"; path: string; pct: string; nonBlank: number };

export interface CommentScanOptions {
  write?: (line: string) => void;
}

const prefix = "agc check — comments";

export const commentCopy = Object.freeze({
  block: (p: string, line: number, n: number) =>
    `${prefix}: ${p}:${line} long-block ${n} lines (limit ${commentLimits.maxBlockLines})`,
  ratio: (p: string, pct: string, n: number) =>
    `${prefix}: ${p} high-ratio ${pct}% of ${n} non-blank lines are comments (limit ${commentLimits.maxRatioPercent}%)`,
  more: (n: number) => `${prefix}: … ${n} more warning(s) not listed`,
  summary: (n: number, m: number) =>
    `${prefix}: ${n} warning(s) in ${m} file(s) (only ${scannedExtensions().join("/")} are scanned) — advisory; ` +
    "keep a comment to WHAT and WHY, move long rationale to a tracked spec or the commit message " +
    "(see Comment discipline, constitution section 6)",
  error: (why: string) => `${prefix}: scan skipped (${why})`,
  whyLoad: "cannot load dist/tools/comment-scan.js — run `npm run build`",
  whyUnexpected: "unexpected error",
});

// ---------------------------------------------------------------------------
// Pure layer: text in, lines / findings out. No I/O.
// ---------------------------------------------------------------------------

function countBlock(lines: LexedLine[], start: number, end: number, rule: TagRule): number {
  let excluding = false;
  let counted = 0;
  for (let i = start; i <= end; i++) {
    const t = rule(lines[i]);
    if (t !== null) excluding = t;
    if (!lines[i].delimiterOnly && !excluding) counted++;
  }
  return counted;
}

export function analyzeText(text: string, lang: LangSpec = jsLang): FileAnalysis {
  const lines = lang.lex(text);
  const blocks: CommentBlock[] = [];
  let nonBlank = 0;
  let commentLines = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].kind === "blank") continue;
    nonBlank++;
    if (lines[i].kind !== "comment") continue;
    commentLines++;
    if (i > 0 && lines[i - 1].kind === "comment") continue;
    let j = i;
    while (j + 1 < lines.length && lines[j + 1].kind === "comment") j++;
    blocks.push({ start: i + 1, end: j + 1, counted: countBlock(lines, i, j, lang.tags) });
  }
  return { lines, nonBlank, commentLines, blocks };
}

export function formatPct(comment: number, nonBlank: number): string {
  const t = Math.floor((comment * 1000 + nonBlank - 1) / nonBlank);
  return t % 10 === 0 ? String(t / 10) : `${Math.floor(t / 10)}.${t % 10}`;
}

export function findingsForFile(p: string, a: FileAnalysis, added: AddedLines): Finding[] {
  const isAdded = (line: number) => added === "all" || added.has(line);
  const out: Finding[] = [];
  const { maxBlockLines, maxRatioPercent, minRatioLines } = commentLimits;
  if (
    a.nonBlank >= minRatioLines &&
    a.commentLines * 100 > maxRatioPercent * a.nonBlank &&
    a.lines.some((l, i) => l.kind === "comment" && isAdded(i + 1))
  ) {
    out.push({ kind: "high-ratio", path: p, pct: formatPct(a.commentLines, a.nonBlank), nonBlank: a.nonBlank });
  }
  for (const b of a.blocks) {
    if (b.counted <= maxBlockLines) continue;
    for (let n = b.start; n <= b.end; n++) {
      if (isAdded(n)) {
        out.push({ kind: "long-block", path: p, line: b.start, lines: b.counted });
        break;
      }
    }
  }
  return out;
}

const cEscapes: Record<string, string> = {
  "\\": "\\", '"': '"', a: "\x07", b: "\b", t: "\t", n: "\n", v: "\v", f: "\f", r: "\r",
};

export function unquoteGitPath(s: string): string {
  if (!(s.length >= 2 && s.startsWith('"') && s.endsWith('"'))) return s;
  const inner = s.slice(1, -1);
  const bytes: number[] = [];
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c !== "\\") {
      bytes.push(...Buffer.from(c, "utf8"));
      continue;
    }
    const oct = /^[0-7]{3}/.exec(inner.slice(i + 1));
    if (oct) {
      bytes.push(parseInt(oct[0], 8));
      i += 3;
    } else {
      const next = inner[i + 1] ?? "";
      bytes.push(...Buffer.from(cEscapes[next] ?? next, "utf8"));
      i++;
    }
  }
  return Buffer.from(bytes).toString("utf8");
}

export function parseAddedLines(patch: string): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>();
  let inHeader = false;
  let current: string | null = null;
  for (const line of patch.split("\n")) {
    if (line.startsWith("diff --git ")) {
      inHeader = true;
      current = null;
    } else if (inHeader && line.startsWith("+++ ")) {
      let name = line.slice(4);
      if (name.endsWith("\t")) name = name.slice(0, -1);
      if (name.startsWith('"')) name = unquoteGitPath(name);
      current = name === "/dev/null" ? null : name.replace(/^b\//, "");
    } else if (line.startsWith("@@ ")) {
      inHeader = false;
      const m = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
      if (!m || current === null) continue;
      const c = Number(m[1]);
      const d = m[2] === undefined ? 1 : Number(m[2]);
      if (d <= 0) continue;
      const set = out.get(current) ?? new Set<number>();
      for (let n = c; n < c + d; n++) set.add(n);
      out.set(current, set);
    }
  }
  return out;
}

export function isScannablePath(rel: string): boolean {
  return langForPath(rel) !== null;
}

function displayPath(p: string): string {
  return p.replace(/[\x00-\x1f\x7f]/g, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, "0")}`);
}

export function formatFindings(f: Finding[]): string[] {
  const rank = (x: Finding) => (x.kind === "high-ratio" ? 0 : x.line);
  const sorted = [...f].sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : rank(a) - rank(b),
  );
  const out = sorted.slice(0, commentLimits.maxListed).map((x) =>
    x.kind === "high-ratio"
      ? commentCopy.ratio(displayPath(x.path), x.pct, x.nonBlank)
      : commentCopy.block(displayPath(x.path), x.line, x.lines),
  );
  const extra = sorted.length - commentLimits.maxListed;
  if (extra > 0) out.push(commentCopy.more(extra));
  if (sorted.length > 0) out.push(commentCopy.summary(sorted.length, new Set(sorted.map((x) => x.path)).size));
  return out;
}

// ---------------------------------------------------------------------------
// I/O layer: the only code touching git or fs.
// ---------------------------------------------------------------------------

function git(cwd: string, argv: string[]): string {
  return execFileSync("git", argv, {
    cwd,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
  });
}

function tryGit(cwd: string, argv: string[]): string | null {
  try {
    return git(cwd, argv).trim();
  } catch {
    return null;
  }
}

const baseRefs = [
  "@{upstream}",
  "refs/remotes/origin/main",
  "refs/remotes/origin/master",
  "refs/heads/main",
  "refs/heads/master",
];

export function resolveBase(cwd: string): string | null {
  if (tryGit(cwd, ["rev-parse", "--verify", "-q", "HEAD^{commit}"]) === null) return null;
  for (const ref of baseRefs) {
    const sha = tryGit(cwd, ["rev-parse", "--verify", "-q", `${ref}^{commit}`]);
    if (sha === null || sha === "") continue;
    return tryGit(cwd, ["merge-base", "HEAD", sha]) || "HEAD";
  }
  return "HEAD";
}

export function collectAdded(cwd: string, base: string): Map<string, AddedLines> {
  const patch = git(cwd, [
    "-c", "core.quotePath=false", "diff", "-U0", "--no-color", "--no-ext-diff", "--no-textconv",
    "--ignore-submodules=all", "-M", "--diff-filter=d", "--src-prefix=a/", "--dst-prefix=b/",
    "--relative", base, "--",
  ]);
  const out = new Map<string, AddedLines>(parseAddedLines(patch));
  const untracked = git(cwd, ["ls-files", "-z", "--others", "--exclude-standard"]);
  for (const rel of untracked.split("\0")) {
    if (rel !== "") out.set(rel, "all");
  }
  return out;
}

export function readScannable(cwd: string, rel: string): string | null {
  try {
    const abs = path.join(cwd, rel);
    const st = fs.lstatSync(abs);
    if (!st.isFile() || st.size > commentLimits.maxContentBytes) return null;
    const buf = fs.readFileSync(abs);
    if (buf.subarray(0, commentLimits.binarySniffBytes).includes(0)) return null;
    return buf.toString("utf8");
  } catch {
    return null;
  }
}

export function runCommentScan(cwd: string, opts: CommentScanOptions = {}): Finding[] | null {
  const write = opts.write ?? ((l: string) => process.stderr.write(`${l}\n`));
  try {
    const base = resolveBase(cwd);
    if (base === null) return null;
    const findings: Finding[] = [];
    for (const [rel, added] of collectAdded(cwd, base)) {
      const lang = langForPath(rel);
      if (lang === null) continue;
      const text = readScannable(cwd, rel);
      if (text !== null) findings.push(...findingsForFile(rel, analyzeText(text, lang), added));
    }
    for (const line of formatFindings(findings)) write(line);
    return findings;
  } catch {
    try {
      write(commentCopy.error(commentCopy.whyUnexpected));
    } catch {
      // The writer itself failed; nothing left to report to.
    }
    return null;
  }
}
