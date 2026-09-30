// Coded by @sr-engineer
// Python docstring-position tracker (spec D5) fed by the shared table lexer.
// Design: specs/e259-comment-scan-languages-architecture.md (Python docstrings).

import type { DocstringTracker } from "./comment-lex.js";

const header = /(?:async\s+)?(?:def|class)\b/y;

export function pythonDocstrings(): DocstringTracker {
  let bracket = 0;
  let atStart = true;
  let expectDoc = true;
  let inHeader = false;
  return {
    code(s: string, i: number): void {
      header.lastIndex = i;
      if (atStart && header.test(s)) inHeader = true;
      atStart = false;
      expectDoc = false;
      const c = s[i];
      if ("([{".includes(c)) bracket++;
      else if (")]}".includes(c)) bracket = Math.max(0, bracket - 1);
      else if (bracket === 0 && c === ":" && inHeader) [inHeader, expectDoc, atStart] = [false, true, true];
      else if (bracket === 0 && c === ";") atStart = true;
    },
    string(docCandidate: boolean): boolean {
      const doc = atStart && expectDoc && docCandidate;
      atStart = false;
      expectDoc = false;
      return doc;
    },
    lineEnd(continued: boolean): void {
      if (!continued && bracket === 0) atStart = true;
    },
  };
}
