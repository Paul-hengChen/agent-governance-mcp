// Coded by @sr-engineer
// Information-hygiene scan (e234-hygiene-scan, spec specs/e234-hygiene-scan.md,
// architecture specs/e234-hygiene-scan-architecture.md). The fifth `agc check`
// advisory: it warns about the classes of detail the constitution's
// Information hygiene rule bans from durable output, and never changes the
// exit code (bin/agc-init.mjs checkHygiene is the only caller).
//
// Two layers:
//   - shape: built-in generic patterns that name nothing concrete;
//   - keyword: a literal list read only from a local, untracked source
//     (AGC_HYGIENE_KEYWORDS, else agc-hygiene-keywords in the git common dir).
//
// Two tiers inside this file: a PURE layer (strings in, spans / verdicts /
// lines out; no I/O) and an I/O layer (listScanSet, resolveKeywordSource,
// scanWorkspace, runHygieneScan) that is the only code touching git or fs.
//
// Authoring rule: no pattern literal in this file may match its own source
// text. Separators are written as one-character classes, host dots are
// escaped, and each vendor prefix is followed by a character class, so the
// scan stays silent over this file (spec AC16). Comments describe shapes in
// prose only. Constant names avoid UPPER_SNAKE gate-code suffixes
// (test/error-code-contract.test.mjs harvests tools/*.ts).
//
// Imports are limited to fs, path and node:child_process (execFileSync with an
// argv array, never a shell). No other tools/ module is imported.
import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "node:child_process";
// D2 order; also the output order of categories within one line.
export const hygieneCategories = Object.freeze([
    "home-path",
    "encoded-home-path",
    "temp-path",
    "design-file-key",
    "credential",
    "work-item-link",
    "internal-host",
    "keyword",
]);
export const limits = Object.freeze({
    maxListed: 50, // D5 cap
    maxWalkFiles: 10000, // D4 no-git walk cap
    maxContentBytes: 1048576, // 1 MiB, D4
    binarySniffBytes: 8192, // D4 NUL sniff window
});
// The D3 built-in placeholder list, lowercase, verbatim.
export const placeholderUsernames = new Set([
    "me",
    "user",
    "username",
    "you",
    "yourname",
    "your-name",
    "your_name",
    "name",
    "someone",
    "somebody",
    "example",
    "demo",
    "test",
    "foo",
    "bar",
    "alice",
    "bob",
    "jdoe",
    "john",
    "jane",
    "johndoe",
    "janedoe",
    "dev",
    "developer",
    "admin",
    "runner",
    "ubuntu",
    "root",
    "node",
    "vscode",
    "shared",
    "linuxbrew",
    "x",
    "xxx",
]);
// ---------------------------------------------------------------------------
// Shape patterns (D2 coverage, architecture "Final shape patterns")
// ---------------------------------------------------------------------------
const backtick = "`";
// One or two backslashes, or a slash.
const sepFrag = String.raw `(?:\\{1,2}|/)`;
// A path segment: runs until whitespace, a separator, a quote or a backtick.
const segFrag = String.raw `[^\s/\\"'` + backtick + String.raw `]+`;
// The root separator must not follow a word character, a dot, a tilde or a hyphen.
const leftBound = String.raw `(?<![A-Za-z0-9_.~\-])`;
const shapePatterns = Object.freeze([
    // home-path: the macOS / Linux home roots (case-sensitive), then the Windows
    // drive form (lowercase word and one or two backslashes accepted).
    {
        category: "home-path",
        re: new RegExp(leftBound + String.raw `[/](?:Users|home)[/](` + segFrag + ")", "g"),
        home: true,
    },
    {
        category: "home-path",
        re: new RegExp(String.raw `(?<![A-Za-z0-9_])[A-Za-z]:` + sepFrag + "[Uu]sers" + sepFrag + "(" + segFrag + ")", "g"),
        home: true,
    },
    // encoded-home-path: a flattened path; the drive form is covered because its
    // hyphen before the Users word follows another hyphen.
    {
        category: "encoded-home-path",
        re: new RegExp(String.raw `(?<![A-Za-z0-9])-(?:Users|home)-([^\-\s/\\"'` + backtick + "]+)-", "g"),
        home: true,
    },
    // temp-path: a further segment below the root is always required.
    {
        category: "temp-path",
        re: new RegExp(leftBound + String.raw `(?:[/]private)?[/]var[/]folders[/]` + segFrag, "g"),
        home: false,
    },
    {
        category: "temp-path",
        re: new RegExp(leftBound + String.raw `[/]private[/]tmp[/]` + segFrag, "g"),
        home: false,
    },
    {
        category: "temp-path",
        re: new RegExp("AppData" + sepFrag + "Local" + sepFrag + "Temp" + sepFrag + segFrag, "gi"),
        home: false,
    },
    // design-file-key: the scheme is optional (the key is the secret); a template
    // token key is rejected by the alphanumeric key class.
    {
        category: "design-file-key",
        re: new RegExp(String.raw `(?<![A-Za-z0-9\-])(?:[A-Za-z0-9\-]+\.)*figma\.com[/](?:file|design|proto|board|slides|make)[/][A-Za-z0-9]{10,}`, "gi"),
        home: false,
    },
    // credential: vendor-prefixed secret shapes only.
    {
        category: "credential",
        re: new RegExp(String.raw `-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----`, "g"),
        home: false,
    },
    {
        category: "credential",
        re: new RegExp(String.raw `(?<![A-Z0-9])AKIA[A-Z0-9]{16}(?![A-Z0-9])`, "g"),
        home: false,
    },
    {
        category: "credential",
        re: new RegExp(String.raw `(?<![A-Za-z0-9_])gh[pousr]_[A-Za-z0-9]{36,}`, "g"),
        home: false,
    },
    {
        category: "credential",
        re: new RegExp(String.raw `(?<![A-Za-z0-9_])github_pat_[A-Za-z0-9_]{22,}`, "g"),
        home: false,
    },
    {
        category: "credential",
        re: new RegExp(String.raw `(?<![A-Za-z0-9_])xox[a-z]-[A-Za-z0-9\-]{10,}`, "g"),
        home: false,
    },
    {
        category: "credential",
        re: new RegExp(String.raw `(?<![A-Za-z0-9_])sk-ant-[A-Za-z0-9_\-]{20,}`, "g"),
        home: false,
    },
    // work-item-link: a scheme is required.
    {
        category: "work-item-link",
        re: new RegExp(String.raw `https?:[/][/](?:[A-Za-z0-9\-]+\.)*dev\.azure\.com(?![A-Za-z0-9.\-])`, "gi"),
        home: false,
    },
    {
        category: "work-item-link",
        re: new RegExp(String.raw `https?:[/][/][A-Za-z0-9\-]+\.visualstudio\.com(?![A-Za-z0-9.\-])`, "gi"),
        home: false,
    },
    {
        category: "work-item-link",
        re: new RegExp(String.raw `https?:[/][/][A-Za-z0-9\-]+\.atlassian\.net[/]browse[/][A-Z][A-Z0-9_]+-[0-9]+`, "g"),
        home: false,
    },
    // internal-host: a scheme is required; the lookahead keeps longer TLD-like
    // labels (for example one that merely starts with "lan") silent.
    {
        category: "internal-host",
        re: new RegExp(String.raw `https?:[/][/](?:[A-Za-z0-9\-]+\.)+(?:internal|corp|intranet|lan)(?![A-Za-z0-9.\-])`, "gi"),
        home: false,
    },
]);
// ---------------------------------------------------------------------------
// Pure layer
// ---------------------------------------------------------------------------
const trailingPunct = new Set([".", ",", ";", ":", "!", "?", ")", "]", "}", ">", "'", '"']);
const templateLeads = new Set(["<", "{", "[", "$", "%"]);
const fillerChars = new Set([".", "…", "*", "_", "x", "X"]);
export function isPlaceholderSegment(seg) {
    let end = seg.length;
    while (end > 0 && trailingPunct.has(seg[end - 1]))
        end--;
    const base = end > 0 ? seg.slice(0, end) : seg;
    const norm = base.toLowerCase();
    if (norm.length === 0)
        return false;
    if (placeholderUsernames.has(norm))
        return true;
    if (templateLeads.has(norm[0]))
        return true;
    for (const ch of norm) {
        if (!fillerChars.has(ch))
            return false;
    }
    return true;
}
export function findShapeMatches(text) {
    const out = [];
    for (const p of shapePatterns) {
        for (const m of text.matchAll(p.re)) {
            const start = m.index ?? 0;
            const end = start + m[0].length;
            const placeholder = p.home && typeof m[1] === "string" ? isPlaceholderSegment(m[1]) : false;
            out.push({ category: p.category, start, end, placeholder });
        }
    }
    out.sort((a, b) => a.start - b.start || a.end - b.end);
    return out;
}
export function parseKeywordList(text) {
    const body = text.startsWith("﻿") ? text.slice(1) : text;
    const seen = new Set();
    const out = [];
    for (const raw of body.split(/\r?\n/)) {
        const kw = raw.trim();
        if (kw.length === 0 || kw.startsWith("#"))
            continue;
        if (kw.length < 2)
            continue;
        const key = kw.toLowerCase();
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(kw);
    }
    return out;
}
const regexSyntaxChars = /[.*+?^${}()|[\]\\/]/g;
export function compileKeywordMatcher(keywords) {
    if (keywords.length === 0)
        return null;
    const ordered = [...keywords].sort((a, b) => b.length - a.length);
    const alternation = ordered.map((k) => k.replace(regexSyntaxChars, "\\$&")).join("|");
    const re = new RegExp("(?<![A-Za-z0-9_])(?:" + alternation + ")(?![A-Za-z0-9_])", "giu");
    return {
        size: keywords.length,
        spans(text) {
            const found = [];
            for (const m of text.matchAll(re)) {
                const start = m.index ?? 0;
                found.push({ start, end: start + m[0].length });
            }
            return found;
        },
    };
}
function orderCategories(set) {
    return hygieneCategories.filter((c) => set.has(c));
}
export function classifyLine(text, kw) {
    const real = new Set();
    const placeholderOnly = new Set();
    for (const s of findShapeMatches(text)) {
        if (s.placeholder)
            placeholderOnly.add(s.category);
        else
            real.add(s.category);
    }
    if (kw !== null && kw.spans(text).length > 0)
        real.add("keyword");
    for (const c of real)
        placeholderOnly.delete(c);
    return { listed: orderCategories(real), skipped: orderCategories(placeholderOnly) };
}
export function maskText(text, kw) {
    const spans = findShapeMatches(text).map((s) => ({
        start: s.start,
        end: s.end,
    }));
    if (kw !== null)
        spans.push(...kw.spans(text));
    if (spans.length === 0)
        return text;
    spans.sort((a, b) => a.start - b.start || a.end - b.end);
    const merged = [];
    for (const s of spans) {
        const last = merged[merged.length - 1];
        if (last !== undefined && s.start <= last.end) {
            if (s.end > last.end)
                last.end = s.end;
        }
        else {
            merged.push({ start: s.start, end: s.end });
        }
    }
    let out = "";
    let cursor = 0;
    for (const s of merged) {
        out += text.slice(cursor, s.start) + "***";
        cursor = s.end;
    }
    return out + text.slice(cursor);
}
const prefix = "agc check — hygiene: ";
export const hygieneCopy = Object.freeze({
    hit: (p, line, category) => `${prefix}${p}:${line} ${category}`,
    hitName: (p, category) => `${prefix}${p} (file name) ${category}`,
    more: (n) => `${prefix}… ${n} more hit(s) not listed`,
    summary: (n, m) => `${prefix}${n} hit(s) in ${m} file(s) — advisory; describe each by class, never the literal text (constitution §6 Information hygiene)`,
    skipped: (n) => `${prefix}skipped ${n} home-path hit(s) with a placeholder username`,
    kwNone: `${prefix}no keyword list found — only built-in shape patterns ran ` +
        `(set AGC_HYGIENE_KEYWORDS or create agc-hygiene-keywords in the git common dir)`,
    kwUnreadable: `${prefix}keyword list named by AGC_HYGIENE_KEYWORDS cannot be read — only built-in shape patterns ran`,
    kwRefused: `${prefix}keyword list under .current/ refused (it may be tracked) — move it outside the repo; only built-in shape patterns ran`,
    kwTracked: `${prefix}warning: the keyword list is a tracked file — move it outside the repo and untrack it`,
    walkCapped: `${prefix}stopped after 10000 files (no git repo to list files) — results are partial`,
    error: (message) => `${prefix}scan skipped (${message})`,
});
export function formatReport(o, kw) {
    const lines = [];
    if (o.source === "none")
        lines.push(hygieneCopy.kwNone);
    else if (o.source === "unreadable")
        lines.push(hygieneCopy.kwUnreadable);
    else if (o.source === "refused")
        lines.push(hygieneCopy.kwRefused);
    else if (o.keywordFileTracked)
        lines.push(hygieneCopy.kwTracked);
    if (o.walkCapped)
        lines.push(hygieneCopy.walkCapped);
    for (const h of o.hits.slice(0, limits.maxListed)) {
        const shown = maskText(h.path, kw);
        lines.push(h.line === null ? hygieneCopy.hitName(shown, h.category) : hygieneCopy.hit(shown, h.line, h.category));
    }
    const more = o.hits.length - limits.maxListed;
    if (more > 0)
        lines.push(hygieneCopy.more(more));
    if (o.hits.length > 0) {
        lines.push(hygieneCopy.summary(o.hits.length, new Set(o.hits.map((h) => h.path)).size));
    }
    if (o.skipped > 0)
        lines.push(hygieneCopy.skipped(o.skipped));
    return lines;
}
// ---------------------------------------------------------------------------
// I/O layer
// ---------------------------------------------------------------------------
const gitMaxBuffer = 256 * 1024 * 1024;
function toPosix(rel) {
    return path.sep === "/" ? rel : rel.split(path.sep).join("/");
}
function walkWorkspace(cwd) {
    const paths = [];
    let capped = false;
    const visit = (dirAbs) => {
        let names;
        try {
            names = fs.readdirSync(dirAbs).sort();
        }
        catch {
            return true;
        }
        for (const name of names) {
            const abs = path.join(dirAbs, name);
            let st;
            try {
                st = fs.lstatSync(abs);
            }
            catch {
                continue;
            }
            if (st.isDirectory()) {
                if (name === ".git" || name === "node_modules")
                    continue;
                if (!visit(abs))
                    return false;
                continue;
            }
            // Regular files, symlinks (never followed) and any other non-directory entry.
            if (paths.length >= limits.maxWalkFiles) {
                capped = true;
                return false;
            }
            paths.push(toPosix(path.relative(cwd, abs)));
        }
        return true;
    };
    visit(cwd);
    return { paths, mode: "walk", capped };
}
export function listScanSet(cwd) {
    let out;
    try {
        out = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
            cwd,
            maxBuffer: gitMaxBuffer,
            stdio: ["ignore", "pipe", "ignore"],
            encoding: "utf8",
        });
    }
    catch {
        return walkWorkspace(cwd);
    }
    const seen = new Set();
    const paths = [];
    for (const p of out.split("\0")) {
        if (p.length === 0 || seen.has(p))
            continue;
        seen.add(p);
        paths.push(p);
    }
    return { paths, mode: "git", capped: false };
}
function realpathOrNull(p) {
    try {
        return fs.realpathSync.native(p);
    }
    catch {
        return null;
    }
}
function isWithin(child, dir) {
    return child === dir || child.startsWith(dir.endsWith(path.sep) ? dir : dir + path.sep);
}
function isTrackedFile(realFile) {
    try {
        execFileSync("git", ["ls-files", "--error-unmatch", "--", ":(literal)" + path.basename(realFile)], { cwd: path.dirname(realFile), stdio: ["ignore", "ignore", "ignore"] });
        return true;
    }
    catch {
        return false;
    }
}
function loadKeywordFile(file) {
    try {
        const text = fs.readFileSync(file, "utf8");
        const real = fs.realpathSync.native(file);
        const st = fs.statSync(real);
        return { keywords: parseKeywordList(text), dev: st.dev, ino: st.ino, real };
    }
    catch {
        return null;
    }
}
export function resolveKeywordSource(cwd, env, inGit) {
    const fromEnv = env.AGC_HYGIENE_KEYWORDS;
    if (typeof fromEnv === "string" && fromEnv.length > 0) {
        const abs = path.resolve(cwd, fromEnv);
        const currentDir = path.resolve(cwd, ".current");
        const roots = [currentDir];
        const currentReal = realpathOrNull(currentDir);
        if (currentReal !== null)
            roots.push(currentReal);
        const candidates = [abs];
        const absReal = realpathOrNull(abs);
        if (absReal !== null)
            candidates.push(absReal);
        if (candidates.some((c) => roots.some((r) => isWithin(c, r))))
            return { kind: "refused" };
        const loaded = loadKeywordFile(abs);
        if (loaded === null)
            return { kind: "unreadable" };
        return {
            kind: "loaded",
            keywords: loaded.keywords,
            dev: loaded.dev,
            ino: loaded.ino,
            tracked: isTrackedFile(loaded.real),
        };
    }
    if (!inGit)
        return { kind: "none" };
    let commonDir;
    try {
        commonDir = execFileSync("git", ["rev-parse", "--git-common-dir"], {
            cwd,
            stdio: ["ignore", "pipe", "ignore"],
            encoding: "utf8",
        }).trim();
    }
    catch {
        return { kind: "none" };
    }
    if (commonDir.length === 0)
        return { kind: "none" };
    // Resolved 2: a default file that exists but cannot be read is reported as "none".
    const loaded = loadKeywordFile(path.join(path.resolve(cwd, commonDir), "agc-hygiene-keywords"));
    if (loaded === null)
        return { kind: "none" };
    return { kind: "loaded", keywords: loaded.keywords, dev: loaded.dev, ino: loaded.ino, tracked: false };
}
function hasNulPrefix(buf) {
    return buf.subarray(0, limits.binarySniffBytes).includes(0);
}
export function scanWorkspace(cwd, set, source, kw) {
    const hits = [];
    let skipped = 0;
    const self = source.kind === "loaded" ? { dev: source.dev, ino: source.ino } : null;
    const record = (rel, line, verdict) => {
        for (const category of verdict.listed)
            hits.push({ path: rel, line, category });
        skipped += verdict.skipped.length;
    };
    for (const rel of set.paths) {
        const abs = path.join(cwd, rel);
        let st;
        try {
            st = fs.lstatSync(abs);
        }
        catch {
            continue; // missing from disk (D4)
        }
        record(rel, null, classifyLine(rel, kw));
        if (!st.isFile() || st.size > limits.maxContentBytes)
            continue;
        if (self !== null && st.dev === self.dev && st.ino === self.ino)
            continue;
        let buf;
        try {
            buf = fs.readFileSync(abs);
        }
        catch {
            continue;
        }
        if (hasNulPrefix(buf))
            continue;
        const lines = buf.toString("utf8").split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            const verdict = classifyLine(lines[i], kw);
            if (verdict.listed.length > 0 || verdict.skipped.length > 0)
                record(rel, i + 1, verdict);
        }
    }
    return {
        source: source.kind,
        keywordFileTracked: source.kind === "loaded" && source.tracked,
        walkCapped: set.capped,
        hits,
        skipped,
    };
}
function errorMessage(err) {
    if (err !== null && typeof err === "object" && "message" in err) {
        const m = err.message;
        if (m !== undefined && m !== null)
            return String(m);
    }
    return String(err);
}
export function runHygieneScan(cwd, opts = {}) {
    const write = opts.write ?? ((line) => void process.stderr.write(`${line}\n`));
    let kw = null;
    try {
        const env = opts.env ?? process.env;
        const set = listScanSet(cwd);
        const source = resolveKeywordSource(cwd, env, set.mode === "git");
        kw = source.kind === "loaded" ? compileKeywordMatcher(source.keywords) : null;
        const outcome = scanWorkspace(cwd, set, source, kw);
        for (const line of formatReport(outcome, kw))
            write(line);
        return outcome;
    }
    catch (err) {
        try {
            const message = maskText(errorMessage(err), kw).replace(/\s*[\r\n]+\s*/g, " ").trim();
            write(hygieneCopy.error(message));
        }
        catch {
            // never throw: the advisory must not affect agc check
        }
        return null;
    }
}
//# sourceMappingURL=hygiene-scan.js.map