// Coded by @sr-engineer
// Lexer tables for the # languages: Python, shell, Ruby.
// Design: specs/e259-comment-scan-languages-architecture.md (String forms).
import { dq } from "./comment-lex.js";
import { pythonDocstrings } from "./comment-python.js";
const hashHole = { open: "#{", openCh: "{", closeCh: "}" };
function pyCloser(m) {
    const q = m[1];
    const triple = q.length === 3;
    const prefix = m[0].slice(0, m[0].length - q.length);
    return { end: q, escape: "backslash", multiline: triple, docCandidate: triple && /^[rRuU]?$/.test(prefix) };
}
const multi = (end, escape, interp) => ({
    end,
    escape,
    multiline: true,
    interp,
});
export const pythonTable = Object.freeze({
    line: "#",
    shebang: true,
    strings: [
        { first: "rRbBuUfF", wordStart: true, re: /[rRbBuUfF]{1,2}("""|'''|"|')/y, close: pyCloser },
        { first: "\"'", re: /("""|'''|"|')/y, close: pyCloser },
    ],
    docstrings: pythonDocstrings,
});
export const shellTable = Object.freeze({
    line: "#",
    shebang: true,
    hashWordStart: true,
    strings: [
        { first: "$", re: /\$'/y, close: () => multi("'", "backslash") },
        { first: "'", re: /'/y, close: () => multi("'", "none") },
        dq(true),
    ],
});
export const rubyTable = Object.freeze({
    line: "#",
    shebang: true,
    beginEnd: true,
    strings: [
        { first: "$", re: /\$['"]/y },
        { first: '"', re: /"/y, close: () => multi('"', "backslash", hashHole) },
        { first: "\x60", re: /\x60/y, close: () => multi("\x60", "backslash", hashHole) },
        { first: "'", re: /'/y, close: () => multi("'", "backslash") },
    ],
});
//# sourceMappingURL=comment-lang-hash.js.map