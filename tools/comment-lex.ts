// Coded by @sr-engineer
// Table-driven lexer shared by every non-JS language of the comment-length scan.
// Design: specs/e259-comment-scan-languages-architecture.md.

import type { LexedLine, LineKind } from "./comment-types.js";

export interface Interp {
  open: string;
  openCh: string;
  closeCh: string;
}

export interface Closer {
  end: string;
  escape: "backslash" | "doubled" | "none";
  multiline: boolean;
  interp?: Interp;
  docCandidate?: boolean;
}

export interface StringForm {
  first: string;
  re: RegExp;
  wordStart?: boolean;
  close?: (m: RegExpExecArray) => Closer;
}

export interface DocstringTracker {
  code(s: string, i: number): void;
  string(docCandidate: boolean): boolean;
  lineEnd(continued: boolean): void;
}

export interface LexTable {
  line: "//" | "#";
  block?: { nested: boolean };
  hashWordStart?: boolean;
  beginEnd?: boolean;
  shebang?: boolean;
  strings: readonly StringForm[];
  docstrings?: () => DocstringTracker;
}

type Mode = "code" | "block" | "str" | "beginEnd";
type Origin = "slash" | "hash" | "beginEnd" | "doc";

interface Frame {
  closer: Closer;
  depth: number;
}

export function dq(multiline: boolean, interp?: Interp): StringForm {
  const closer: Closer = { end: '"', escape: "backslash", multiline, interp };
  return { first: '"', re: /"/y, close: () => closer };
}

export const charLit: StringForm = Object.freeze({ first: "'", re: /'(?:\\.|[^\\'\n])*'/y });

export function slashBody(raw: string): string {
  return raw.trim().replace(/^(?:\/\/+|\/\*+|\*+(?!\/))/, "").trimStart();
}

export function hashBody(raw: string): string {
  return raw.trim().replace(/^#+/, "").trimStart();
}

export function docBody(raw: string): string {
  return raw.trim().replace(/^[rRuU]?(?:"""|''')/, "").trimStart();
}

const bodies: Record<Origin, (raw: string) => string> = {
  slash: slashBody,
  hash: hashBody,
  beginEnd: (raw) => raw.trim(),
  doc: docBody,
};
const slashDelims = new Set(["/*", "/**", "*/"]);
const docDelim = /^[rRuU]?(?:"""|''')$/;
const shellBreaks = new Set([" ", "\t", ";", "&", "|", "(", ")", "<", ">"]);

function isWordChar(c: string | undefined): boolean {
  return c !== undefined && /[A-Za-z0-9_]/.test(c);
}

function opensLineComment(t: LexTable, s: string, i: number): boolean {
  if (t.line === "//") return s.startsWith("//", i);
  return s[i] === "#" && (!t.hashWordStart || i === 0 || shellBreaks.has(s[i - 1]));
}

function leavesHole(top: Frame | undefined, c: string): boolean {
  const hole = top?.closer.interp;
  if (top === undefined || hole === undefined) return false;
  if (c === hole.openCh) top.depth++;
  else if (c === hole.closeCh) {
    if (top.depth === 0) return true;
    top.depth--;
  }
  return false;
}

export function lexTable(text: string, t: LexTable): LexedLine[] {
  const raw = text.split(/\r?\n/);
  const hasCode = raw.map(() => false);
  const origin: (Origin | null)[] = raw.map(() => null);
  const delim = raw.map(() => false);
  const tracker = t.docstrings?.();
  let mode: Mode = "code";
  let closer: Closer | null = null;
  let asComment = false;
  let carried: Origin = "slash";
  let depth = 0;
  const frames: Frame[] = [];
  for (let ln = 0; ln < raw.length; ln++) {
    const s = raw[ln];
    const mark = (o: Origin) => (origin[ln] ??= o);
    if (ln === 0 && t.shebang && s.startsWith("#!")) {
      hasCode[0] = true;
      continue;
    }
    if (mode === "beginEnd" || (mode === "code" && t.beginEnd && /^=begin(?:\s|$)/.test(s))) {
      mark("beginEnd");
      if (mode === "code") [mode, delim[ln]] = ["beginEnd", true];
      else if (/^=end(?:\s|$)/.test(s)) [mode, delim[ln]] = ["code", true];
      continue;
    }
    if (mode === "block" || (mode === "str" && asComment)) mark(carried);
    else if (mode === "str") hasCode[ln] = true;
    let escapedNewline = false;
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (mode === "block") {
        if (s.startsWith("*/", i)) {
          i += 2;
          if (--depth === 0) mode = "code";
        } else if (t.block?.nested && s.startsWith("/*", i)) {
          i += 2;
          depth++;
        } else i++;
        continue;
      }
      if (mode === "str" && closer !== null) {
        const end = closer.end;
        if (closer.interp && s.startsWith(closer.interp.open, i)) {
          frames.push({ closer, depth: 0 });
          i += closer.interp.open.length;
          mode = "code";
        } else if (closer.escape === "backslash" && c === "\\") {
          if (i === s.length - 1) escapedNewline = true;
          i += 2;
        } else if (closer.escape === "doubled" && s.startsWith(end + end, i)) {
          i += 2 * end.length;
        } else if (s.startsWith(end, i)) {
          i += end.length;
          mode = "code";
        } else i++;
        continue;
      }
      if (/\s/.test(c)) {
        i++;
        continue;
      }
      if (opensLineComment(t, s, i)) {
        mark(t.line === "//" ? "slash" : "hash");
        break;
      }
      if (t.block && s.startsWith("/*", i)) {
        mark("slash");
        [mode, depth, carried] = ["block", 1, "slash"];
        i += 2;
        continue;
      }
      if (leavesHole(frames[frames.length - 1], c)) {
        hasCode[ln] = true;
        [mode, closer] = ["str", frames.pop()?.closer ?? null];
        i++;
        continue;
      }
      const hit = matchString(t, s, i);
      if (hit === null) {
        hasCode[ln] = true;
        tracker?.code(s, i);
        i++;
        continue;
      }
      i += hit.len;
      if (hit.closer === null) {
        hasCode[ln] = true;
        continue;
      }
      [mode, closer] = ["str", hit.closer];
      asComment = tracker !== undefined && tracker.string(hit.closer.docCandidate === true);
      if (asComment) [carried, origin[ln]] = ["doc", origin[ln] ?? "doc"];
      else hasCode[ln] = true;
    }
    if (mode === "str" && closer !== null && !closer.multiline && !escapedNewline) mode = "code";
    if (mode === "code") tracker?.lineEnd(s.endsWith("\\"));
  }
  return raw.map((s, i) => lexedLine(t, s, hasCode[i], origin[i], delim[i]));
}

function lexedLine(t: LexTable, s: string, code: boolean, o: Origin | null, d: boolean): LexedLine {
  const kind: LineKind = code ? "code" : o !== null ? "comment" : "blank";
  const trimmed = s.trim();
  const delimiterOnly =
    d || (t.block !== undefined && slashDelims.has(trimmed)) || (t.docstrings !== undefined && docDelim.test(trimmed));
  const line: LexedLine = { kind, body: kind === "comment" && o !== null ? bodies[o](s) : "", delimiterOnly };
  if (kind === "comment" && o === "doc") line.docstring = true;
  return line;
}

function matchString(t: LexTable, s: string, i: number): { len: number; closer: Closer | null } | null {
  for (const f of t.strings) {
    if (!f.first.includes(s[i]) || (f.wordStart && isWordChar(s[i - 1]))) continue;
    f.re.lastIndex = i;
    const m = f.re.exec(s);
    if (m !== null) return { len: m[0].length, closer: f.close ? f.close(m) : null };
  }
  return null;
}
