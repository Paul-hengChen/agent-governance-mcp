// Coded by @sr-engineer
// Lexer tables for the nested /* */ languages: Rust, Kotlin, Swift.
// Design: specs/e259-comment-scan-languages-architecture.md (String forms).

import { charLit, dq, type Interp, type LexTable } from "./comment-lex.js";

const dollarHole: Interp = { open: "${", openCh: "{", closeCh: "}" };
const parenHole: Interp = { open: "\\(", openCh: "(", closeCh: ")" };

export const rustTable = Object.freeze<LexTable>({
  line: "//",
  block: { nested: true },
  strings: [
    { first: "bcr", wordStart: true, re: /(?:b|c)?r(#*)"/y, close: (m) => ({ end: '"' + m[1], escape: "none", multiline: true }) },
    dq(true),
    { first: "'", re: /'(?:\\(?:u\{[0-9A-Fa-f_]{1,6}\}|x[0-9A-Fa-f]{2}|.)|[^\\'\n])'/uy },
  ],
});

export const kotlinTable = Object.freeze<LexTable>({
  line: "//",
  block: { nested: true },
  strings: [
    { first: '"', re: /"""/y, close: () => ({ end: '"""', escape: "none", multiline: true, interp: dollarHole }) },
    dq(false, dollarHole),
    charLit,
  ],
});

export const swiftTable = Object.freeze<LexTable>({
  line: "//",
  block: { nested: true },
  strings: [
    { first: "#", wordStart: true, re: /(#+)("""|")/y, close: (m) => ({ end: m[2] + m[1], escape: "none", multiline: m[2] === '"""' }) },
    { first: '"', re: /"""/y, close: () => ({ end: '"""', escape: "backslash", multiline: true, interp: parenHole }) },
    dq(false, parenHole),
  ],
});
