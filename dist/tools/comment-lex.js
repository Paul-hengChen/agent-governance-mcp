// Coded by @sr-engineer
// Table-driven lexer shared by every non-JS language of the comment-length scan.
// Design: specs/e259-comment-scan-languages-architecture.md.
export function dq(multiline, interp) {
    const closer = { end: '"', escape: "backslash", multiline, interp };
    return { first: '"', re: /"/y, close: () => closer };
}
export const charLit = Object.freeze({ first: "'", re: /'(?:\\.|[^\\'\n])*'/y });
export function slashBody(raw) {
    return raw.trim().replace(/^(?:\/\/+|\/\*+|\*+(?!\/))/, "").trimStart();
}
const slashDelims = new Set(["/*", "/**", "*/"]);
function isWordChar(c) {
    return c !== undefined && /[A-Za-z0-9_]/.test(c);
}
export function lexTable(text, t) {
    const raw = text.split(/\r?\n/);
    const hasCode = raw.map(() => false);
    const hasComment = raw.map(() => false);
    let mode = "code";
    let closer = null;
    let depth = 0;
    const frames = [];
    for (let ln = 0; ln < raw.length; ln++) {
        const s = raw[ln];
        if (mode === "block")
            hasComment[ln] = true;
        else if (mode === "str")
            hasCode[ln] = true;
        let escapedNewline = false;
        let i = 0;
        while (i < s.length) {
            const c = s[i];
            if (mode === "block") {
                if (s.startsWith("*/", i)) {
                    i += 2;
                    if (--depth === 0)
                        mode = "code";
                }
                else if (t.block?.nested && s.startsWith("/*", i)) {
                    i += 2;
                    depth++;
                }
                else
                    i++;
                continue;
            }
            if (mode === "str" && closer !== null) {
                const end = closer.end;
                if (closer.interp && s.startsWith(closer.interp.open, i)) {
                    frames.push({ closer, depth: 0 });
                    i += closer.interp.open.length;
                    mode = "code";
                }
                else if (closer.escape === "backslash" && c === "\\") {
                    if (i === s.length - 1)
                        escapedNewline = true;
                    i += 2;
                }
                else if (closer.escape === "doubled" && s.startsWith(end + end, i)) {
                    i += 2 * end.length;
                }
                else if (s.startsWith(end, i)) {
                    i += end.length;
                    mode = "code";
                }
                else
                    i++;
                continue;
            }
            if (/\s/.test(c)) {
                i++;
                continue;
            }
            if (t.line === "//" && s.startsWith("//", i)) {
                hasComment[ln] = true;
                break;
            }
            if (t.block && s.startsWith("/*", i)) {
                hasComment[ln] = true;
                mode = "block";
                depth = 1;
                i += 2;
                continue;
            }
            hasCode[ln] = true;
            const top = frames[frames.length - 1];
            const hole = top?.closer.interp;
            if (top !== undefined && hole !== undefined) {
                if (c === hole.openCh)
                    top.depth++;
                else if (c === hole.closeCh && top.depth > 0)
                    top.depth--;
                else if (c === hole.closeCh) {
                    [mode, closer] = ["str", top.closer];
                    frames.pop();
                    i++;
                    continue;
                }
            }
            const hit = matchString(t, s, i);
            if (hit === null) {
                i++;
                continue;
            }
            i += hit.len;
            if (hit.closer !== null)
                [mode, closer] = ["str", hit.closer];
        }
        if (mode === "str" && closer !== null && !closer.multiline && !escapedNewline)
            mode = "code";
    }
    return raw.map((s, i) => {
        const kind = hasCode[i] ? "code" : hasComment[i] ? "comment" : "blank";
        return { kind, body: kind === "comment" ? slashBody(s) : "", delimiterOnly: slashDelims.has(s.trim()) };
    });
}
function matchString(t, s, i) {
    for (const f of t.strings) {
        if (!f.first.includes(s[i]) || (f.wordStart && isWordChar(s[i - 1])))
            continue;
        f.re.lastIndex = i;
        const m = f.re.exec(s);
        if (m !== null)
            return { len: m[0].length, closer: f.close ? f.close(m) : null };
    }
    return null;
}
//# sourceMappingURL=comment-lex.js.map