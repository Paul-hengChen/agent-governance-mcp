// Coded by @sr-engineer
// Comment-length scan (E258B): the sixth `agc check` advisory. It flags long
// comment blocks and comment-heavy files in the lines the current change
// adds, and never changes the exit code. Rules, lexer and rationale:
// specs/e258b-comment-scan.md and specs/e258b-comment-scan-architecture.md.

import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "node:child_process";

export const commentLimits = Object.freeze({
  maxBlockLines: 7,
  maxRatioPercent: 30,
  minRatioLines: 50,
  maxListed: 50,
  maxContentBytes: 1048576,
  binarySniffBytes: 8192,
} as const);

export type LineKind = "blank" | "code" | "comment";

export interface LexedLine {
  kind: LineKind;
  body: string;
  delimiterOnly: boolean;
}

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
    `${prefix}: ${n} warning(s) in ${m} file(s) (only .ts/.tsx/.js/.jsx/.mjs are scanned) — advisory; ` +
    "keep a comment to WHAT and WHY, move long rationale to a tracked spec or the commit message " +
    "(see Comment discipline, constitution section 6)",
  error: (why: string) => `${prefix}: scan skipped (${why})`,
  whyLoad: "cannot load dist/tools/comment-scan.js — run `npm run build`",
  whyUnexpected: "unexpected error",
});

// ---------------------------------------------------------------------------
// Pure layer: text in, lines / findings out. No I/O.
// ---------------------------------------------------------------------------

type LexState = "code" | "line" | "block" | "sq" | "dq" | "tpl" | "regex" | "regexClass";

// Tokens after which a `/` starts a regex literal rather than a division.
const regexAfterPunct = new Set("(,=:[!&|?{};+-*%<>~^".split(""));
const regexAfterWord = new Set([
  "return", "typeof", "instanceof", "in", "of", "new", "delete", "void",
  "throw", "case", "do", "else", "yield", "await",
]);
const delimiterLines = new Set(["/*", "/**", "*/"]);
const excludedTags = new Set(["param", "returns", "return", "throws", "example"]);

function isIdentChar(c: string): boolean {
  return /[A-Za-z0-9_$]/.test(c);
}

function commentBody(raw: string): string {
  return raw.trim().replace(/^(?:\/\/+|\/\*+|\*+(?!\/))/, "").trimStart();
}

export function lexLines(text: string): LexedLine[] {
  const raw = text.split(/\r?\n/);
  const hasCode = raw.map(() => false);
  const hasComment = raw.map(() => false);
  let state: LexState = "code";
  const tplDepth: number[] = [];
  let lastSig = "";
  let word = "";
  let wordOpen = false;
  let first = 0;
  if (text.startsWith("#!")) {
    hasCode[0] = true;
    first = 1;
  }
  for (let ln = first; ln < raw.length; ln++) {
    const s = raw[ln];
    if (state === "block") hasComment[ln] = true;
    else if (state !== "code") hasCode[ln] = true;
    let escapedNewline = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (state === "line" || state === "block") {
        hasComment[ln] = true;
        if (state === "block" && c === "*" && s[i + 1] === "/") {
          i++;
          state = "code";
        }
        continue;
      }
      if (state !== "code") {
        hasCode[ln] = true;
        if (c === "\\") {
          if (i === s.length - 1) escapedNewline = true;
          i++;
        } else if (state === "sq" || state === "dq") {
          if (c === (state === "sq" ? "'" : '"')) [state, lastSig, word] = ["code", '"', ""];
        } else if (state === "tpl") {
          if (c === "`") [state, lastSig, word] = ["code", "`", ""];
          else if (c === "$" && s[i + 1] === "{") {
            i++;
            tplDepth.push(0);
            [state, lastSig, word] = ["code", "{", ""];
          }
        } else if (state === "regex") {
          if (c === "[") state = "regexClass";
          else if (c === "/") [state, lastSig, word] = ["code", ")", ""];
        } else if (c === "]") {
          state = "regex";
        }
        continue;
      }
      if (/\s/.test(c)) {
        wordOpen = false;
        continue;
      }
      if (c === "/" && (s[i + 1] === "/" || s[i + 1] === "*")) {
        hasComment[ln] = true;
        state = s[i + 1] === "/" ? "line" : "block";
        i++;
        continue;
      }
      hasCode[ln] = true;
      if (isIdentChar(c)) {
        word = wordOpen ? word + c : c;
        wordOpen = true;
        lastSig = c;
        continue;
      }
      const regexOk =
        lastSig === "" || regexAfterPunct.has(lastSig) || (isIdentChar(lastSig) && regexAfterWord.has(word));
      wordOpen = false;
      word = "";
      lastSig = c;
      if (c === "'") state = "sq";
      else if (c === '"') state = "dq";
      else if (c === "`") state = "tpl";
      else if (c === "/" && regexOk) state = "regex";
      else if (c === "{" && tplDepth.length > 0) tplDepth[tplDepth.length - 1]++;
      else if (c === "}" && tplDepth.length > 0) {
        if (tplDepth[tplDepth.length - 1] === 0) {
          tplDepth.pop();
          state = "tpl";
        } else tplDepth[tplDepth.length - 1]--;
      }
    }
    if (state === "line") state = "code";
    else if ((state === "sq" || state === "dq") && !escapedNewline) state = "code";
    else if (state === "regex" || state === "regexClass") state = "code";
    wordOpen = false;
  }
  return raw.map((s, i) => {
    const kind: LineKind = hasCode[i] ? "code" : hasComment[i] ? "comment" : "blank";
    return {
      kind,
      body: kind === "comment" ? commentBody(s) : "",
      delimiterOnly: delimiterLines.has(s.trim()),
    };
  });
}

function countBlock(lines: LexedLine[], start: number, end: number): number {
  let excluding = false;
  let counted = 0;
  for (let i = start; i <= end; i++) {
    const tag = /^@([A-Za-z]+)/.exec(lines[i].body);
    if (tag) excluding = excludedTags.has(tag[1]);
    if (!lines[i].delimiterOnly && !excluding) counted++;
  }
  return counted;
}

export function analyzeText(text: string): FileAnalysis {
  const lines = lexLines(text);
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
    blocks.push({ start: i + 1, end: j + 1, counted: countBlock(lines, i, j) });
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
  if (!/\.(?:ts|tsx|js|jsx|mjs)$/.test(rel) || rel.endsWith(".d.ts")) return false;
  return !rel.split("/").some((seg) => seg === "dist" || seg === "node_modules");
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
      if (!isScannablePath(rel)) continue;
      const text = readScannable(cwd, rel);
      if (text !== null) findings.push(...findingsForFile(rel, analyzeText(text), added));
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
