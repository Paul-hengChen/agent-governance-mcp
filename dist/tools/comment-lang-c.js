// Coded by @sr-engineer
// Lexer tables for the non-nested /* */ languages: c-like, Java, Go, C#.
// Design: specs/e259-comment-scan-languages-architecture.md (String forms).
import { charLit, dq } from "./comment-lex.js";
const multi = (end, escape) => ({ end, escape, multiline: true });
export const cTable = Object.freeze({
    line: "//",
    block: { nested: false },
    strings: [
        { first: "uULR", wordStart: true, re: /(?:u8|u|U|L)?R"([^\s()\\]{0,16})\(/y, close: (m) => multi(")" + m[1] + '"', "none") },
        dq(false),
        charLit,
    ],
});
export const javaTable = Object.freeze({
    line: "//",
    block: { nested: false },
    strings: [{ first: '"', re: /"""/y, close: () => multi('"""', "backslash") }, dq(false), charLit],
});
export const goTable = Object.freeze({
    line: "//",
    block: { nested: false },
    strings: [{ first: "\x60", re: /\x60/y, close: () => multi("\x60", "none") }, dq(false), charLit],
});
//# sourceMappingURL=comment-lang-c.js.map