// Coded by @sr-engineer
// Lexer tables for the non-nested /* */ languages: c-like, Java, Go, C#.
// Design: specs/e259-comment-scan-languages-architecture.md (String forms).

import { charLit, dq, type Closer, type LexTable } from "./comment-lex.js";

const multi = (end: string, escape: Closer["escape"]): Closer => ({ end, escape, multiline: true });

export const cTable = Object.freeze<LexTable>({
  line: "//",
  block: { nested: false },
  strings: [
    { first: "uULR", wordStart: true, re: /(?:u8|u|U|L)?R"([^\s()\\]{0,16})\(/y, close: (m) => multi(")" + m[1] + '"', "none") },
    dq(false),
    charLit,
  ],
});

export const javaTable = Object.freeze<LexTable>({
  line: "//",
  block: { nested: false },
  strings: [{ first: '"', re: /"""/y, close: () => multi('"""', "backslash") }, dq(false), charLit],
});

export const goTable = Object.freeze<LexTable>({
  line: "//",
  block: { nested: false },
  strings: [{ first: "\x60", re: /\x60/y, close: () => multi("\x60", "none") }, dq(false), charLit],
});

export const csharpTable = Object.freeze<LexTable>({
  line: "//",
  block: { nested: false },
  strings: [
    { first: '$"', re: /\$*("{3,})/y, close: (m) => multi(m[1], "none") },
    { first: "$@", re: /(?:\$@|@\$?)"/y, close: () => multi('"', "doubled") },
    { first: "$", re: /\$+"/y, close: () => ({ end: '"', escape: "backslash", multiline: false }) },
    dq(false),
    charLit,
  ],
});
