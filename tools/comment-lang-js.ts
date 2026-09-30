// Coded by @sr-engineer
// The E258 JavaScript/TypeScript lexer, moved verbatim from comment-scan.ts,
// plus its JSDoc tag rule. Design: specs/e259-comment-scan-languages-architecture.md.

import type { LexedLine, LineKind, TagRule } from "./comment-types.js";

type LexState = "code" | "line" | "block" | "sq" | "dq" | "tpl" | "regex" | "regexClass";

// Tokens after which a `/` starts a regex literal rather than a division.
const regexAfterPunct = new Set("(,=:[!&|?{};+-*%<>~^".split(""));
const regexAfterWord = new Set([
  "return", "typeof", "instanceof", "in", "of", "new", "delete", "void",
  "throw", "case", "do", "else", "yield", "await",
]);
const delimiterLines = new Set(["/*", "/**", "*/"]);

function isIdentChar(c: string): boolean {
  return /[A-Za-z0-9_$]/.test(c);
}

function commentBody(raw: string): string {
  return raw.trim().replace(/^(?:\/\/+|\/\*+|\*+(?!\/))/, "").trimStart();
}

export function lexJs(text: string): LexedLine[] {
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

const jsExcluded = new Set(["param", "returns", "return", "throws", "example"]);

export const jsTags: TagRule = (l) => {
  const m = /^@([A-Za-z]+)/.exec(l.body);
  return m ? jsExcluded.has(m[1]) : null;
};
