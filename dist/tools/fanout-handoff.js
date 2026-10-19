// Coded by @sr-engineer
// `fanout.mjs handoff`: prints a wave's `## 接手步驟` section with every repo
// fact filled in (target branch, origin relation, primary's git status,
// worktrees, lane-status rows, background work), and `handoff --check`
// re-collects the same facts and names each one that changed since the
// section was written. Contract: specs/e284-fanout-handoff-command.md (D1, D2).
// Read-only: no fetch, no file or ref writes; git is read via execFileSync
// argv, never a shell. No path written into the section is absolute.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { BASE_RE, HANDOFF_BACKGROUND, HANDOFF_CODES, HANDOFF_SECTION, HANDOFF_SUBITEMS, HANDOFF_NONE, HANDOFF_USAGE, findHandoffSections, formatError, gitErrorLine, isNamedHeading, parseManifest, readsNone, resolveMailboxHeader, resolvePrimary, } from "./fanout-manifest.js";
import { LANE_TO_INTEGRATOR_FILE, computeLaneStatus, parseMailboxHeaders } from "./lane-status.js";
// --- section text ------------------------------------------------------------
/** Fact keys, in section order: four primary checks, then the background ones. */
export const HANDOFF_PRIMARY_KEYS = ["目標分支", "目標分支對 origin", "git status", "worktree", "lane-status"];
export const HANDOFF_BACKGROUND_KEYS = ["整合分支", "未 push 的 commit", "信箱", "watch baseline", "監看"];
export const HANDOFF_FACT_KEYS = [...HANDOFF_PRIMARY_KEYS, ...HANDOFF_BACKGROUND_KEYS];
export const HANDOFF_INTRO = "（事實欄位由 `node scripts/fanout.mjs handoff` 產生；接手時先跑 `node scripts/fanout.mjs handoff --check <manifest>`。`<待填：…>` 由整合者填寫。）";
export const HANDOFF_PLACEHOLDER_CLOSED = "- <待填：本波次結果、lane 紀錄位置、未配號的新發現>";
export const HANDOFF_PLACEHOLDER_DECIDE = "- <待填：下一波要不要開、待裁定的題目、整合者的建議>";
export const HANDOFF_NO_MAILBOX_NOTE = "note: no mailbox root (no mailbox: header and no --mailbox-root) — mailbox facts not collected.";
/** Written for a path that cannot be made relative to primary (e.g. another drive). */
export const NOT_RELATIVE = "<非相對路徑>";
/** Suffix of a worktree whose branch is not a lane of this manifest. */
export const FOREIGN_WORKTREE_SUFFIX = " ［別的清單］";
/** A fact present on one side only is shown as this on the other side. */
export const FACT_ABSENT = "（缺）";
export const HANDOFF_CHECK_SUMMARY = (checked, differ, moved) => `fanout handoff --check: ${checked} fact(s) checked, ${differ} differ, ${moved} moved`;
/** Primary's branch at closure: the target it will land on, the integration branch and primary's HEAD. */
export const closingAnnotation = (target, integ, sha7) => `${target} ← ${integ} @ ${sha7}`;
/** CLI codes of this command, named outside the gate-suffix vocabulary like FANOUT_CODES. */
export const HANDOFF_CLI_CODES = {
    factDuplicate: "HANDOFF_FACT_DUPLICATE",
    gitFailed: "HANDOFF_GIT_FAILED",
};
const MAILBOX_FILES = [LANE_TO_INTEGRATOR_FILE, "to-lane.md"];
// --- scripts/mailbox-watch.mjs parity -----------------------------------------
// tools/ cannot import the script (dist layout), so these two re-derive its
// watchLockPath and formatRearmCommand (default deadline / interval, without
// the `re-arm with: ` prefix); a test pins each against the script's export.
/** Sidecar lock path the mailbox watcher holds while it watches `file`. */
export function watchLockPath(file) {
    const abs = path.resolve(file);
    return path.join(path.dirname(abs), `.${path.basename(abs)}.watch-lock`);
}
function shellQuote(s) {
    if (/^[A-Za-z0-9_\/.,:=@%+-]+$/.test(s))
        return s;
    return `'${s.replace(/'/g, `'\\''`)}'`;
}
/** The mailbox watch command for these files at these read counts (`key` = the file's lane directory). */
export function formatWatchCommand(entries) {
    const files = entries.map((e) => shellQuote(e.file)).join(" ");
    const baseline = entries.length === 1 ? String(entries[0].lastRead) : entries.map((e) => `${e.key}=${e.lastRead}`).join(",");
    return `node scripts/mailbox-watch.mjs ${files} --baseline ${shellQuote(baseline)}`;
}
// --- git + path helpers --------------------------------------------------------
const GIT_MAX_BUFFER = 64 * 1024 * 1024;
class HandoffFailure extends Error {
    errors;
    constructor(errors) {
        super(errors.map((e) => e.code).join(", "));
        this.errors = errors;
    }
}
function inputErr(code, message) {
    return { code, scope: "input", message };
}
function git(args, cwd) {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: GIT_MAX_BUFFER });
}
/**
 * The git subcommand in `args`: the first argument that is not an option,
 * skipping a `-c <name>=<value>` pair so its value is never read as the subcommand.
 */
function gitSubcommand(args) {
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "-c") {
            i++;
            continue;
        }
        if (!args[i].startsWith("-"))
            return args[i];
    }
    return args[0];
}
/** git output for a required fact; a failure is HANDOFF_GIT_FAILED naming the fact and the subcommand. */
function gitFact(key, args, cwd) {
    try {
        return git(args, cwd);
    }
    catch (err) {
        const sub = gitSubcommand(args);
        throw new HandoffFailure([inputErr(HANDOFF_CLI_CODES.gitFailed, `git ${sub} failed for fact "${key}": ${gitErrorLine(err)}`)]);
    }
}
/** Full sha of `ref` as a commit, or undefined when it does not resolve. */
function resolveCommit(ref, cwd) {
    try {
        return git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], cwd).trim() || undefined;
    }
    catch {
        return undefined;
    }
}
function isAncestor(a, b, cwd) {
    try {
        git(["merge-base", "--is-ancestor", a, b], cwd);
        return true;
    }
    catch {
        return false;
    }
}
function realOrResolved(p) {
    try {
        return fs.realpathSync(p);
    }
    catch {
        return path.resolve(p);
    }
}
/** `p` relative to primary with `/` separators, or NOT_RELATIVE. */
function relToPrimary(primaryReal, p) {
    const rel = path.relative(primaryReal, realOrResolved(p));
    if (rel === "")
        return ".";
    if (path.isAbsolute(rel))
        return NOT_RELATIVE;
    return rel.split(path.sep).join("/");
}
/** `git worktree list --porcelain` blocks, in git's order (primary first). */
function parseWorktrees(out) {
    const entries = [];
    for (const block of out.split(/(?:\r?\n){2,}/)) {
        let cur;
        for (const line of block.split(/\r?\n/)) {
            if (line.startsWith("worktree ")) {
                cur = { path: line.slice("worktree ".length).trim(), branch: null };
                entries.push(cur);
            }
            else if (cur && line.startsWith("HEAD ")) {
                cur.head = line.slice("HEAD ".length).trim();
            }
            else if (cur && line.startsWith("branch ")) {
                const raw = line.slice("branch ".length).trim();
                cur.branch = raw.startsWith("refs/heads/") ? raw.slice("refs/heads/".length) : raw;
            }
        }
    }
    return entries;
}
function branchLabel(w) {
    if (w.branch !== null)
        return w.branch;
    return w.head ? `detached @ ${w.head.slice(0, 7)}` : "-";
}
/** `integration branch: <name>` on the manifest's base line, if any. */
export function integrationBranchOf(text) {
    const baseLine = text.split(/\r?\n/).find((l) => BASE_RE.test(l));
    return baseLine === undefined ? undefined : /integration branch:\s*(\S+)/.exec(baseLine)?.[1];
}
/**
 * Collect every fact of the D2 table for `m`. Throws HandoffFailure on an
 * input error (repo, target, mailbox header) or a failed git call for a
 * required fact.
 */
export function collectFacts(m, manifestText, opts) {
    const target = opts.target ?? "main";
    const fail = (code, message) => {
        throw new HandoffFailure([inputErr(code, message)]);
    };
    const repo = path.resolve(opts.repo);
    try {
        git(["rev-parse", "--git-dir"], repo);
    }
    catch {
        fail("REPO_NOT_GIT", `--repo "${opts.repo}" is not inside a git repository`);
    }
    const primary = resolvePrimary(repo) ?? fail("REPO_NOT_GIT", `--repo "${opts.repo}" has no main worktree (git worktree list failed)`);
    const primaryReal = realOrResolved(primary);
    const targetSha = (target !== "" && !target.startsWith("-") && !/\s/.test(target) ? resolveCommit(target, primary) : undefined) ??
        fail("REF_NOT_FOUND", `--target "${target}" does not resolve to a commit (git rev-parse --verify)`);
    const notes = [];
    let mailboxRoot;
    if (opts.mailboxRoot !== undefined && opts.mailboxRoot.trim() !== "") {
        mailboxRoot = path.resolve(opts.mailboxRoot);
    }
    else if (m.mailbox !== undefined && m.mailbox.trim() !== "") {
        const mb = resolveMailboxHeader(m.mailbox, primary);
        if (!mb.ok)
            fail(mb.code, mb.message);
        else
            mailboxRoot = mb.path;
    }
    else {
        notes.push(HANDOFF_NO_MAILBOX_NOTE);
    }
    const laneByBranch = new Map();
    for (const l of m.dispatchable)
        if (!laneByBranch.has(l.branch))
            laneByBranch.set(l.branch, l.lane);
    const localBranch = (b) => resolveCommit(`refs/heads/${b}`, primary);
    const worktrees = parseWorktrees(gitFact("worktree", ["worktree", "list", "--porcelain"], primary));
    const primaryEntry = worktrees[0];
    const primaryBranch = primaryEntry?.branch ?? null;
    const integ = integrationBranchOf(manifestText);
    const annotation = opts.closing && integ !== undefined && primaryBranch === integ && primaryEntry?.head
        ? closingAnnotation(target, integ, primaryEntry.head.slice(0, 7))
        : undefined;
    const facts = new Map();
    facts.set("目標分支", `${target} @ ${targetSha.slice(0, 7)}`);
    const originSha = resolveCommit(`refs/remotes/origin/${target}`, primary);
    if (originSha === undefined) {
        facts.set("目標分支對 origin", `origin/${target} 不存在`);
    }
    else {
        const [ahead, behind] = gitFact("目標分支對 origin", ["rev-list", "--left-right", "--count", `${targetSha}...${originSha}`], primary)
            .trim()
            .split(/\s+/)
            .map(Number);
        facts.set("目標分支對 origin", ahead === 0 && behind === 0 ? "一致" : behind === 0 ? `本機領先 ${ahead}` : ahead === 0 ? `本機落後 ${behind}` : `分岔（本機 +${ahead}／origin +${behind}）`);
    }
    // Pasting the section dirties the manifest itself, so it is left out.
    // core.quotePath=false keeps a non-ASCII path unquoted and unescaped, so
    // the manifest's own line still matches manifestRel and other paths read
    // as typed.
    const manifestRel = opts.manifestPath !== undefined ? relToPrimary(primaryReal, opts.manifestPath) : undefined;
    const statusLines = gitFact("git status", ["-c", "core.quotePath=false", "--no-optional-locks", "status", "--porcelain"], primary)
        .split(/\r?\n/)
        .filter((l) => l.trim() !== "")
        .filter((l) => {
        const p = l.slice(3);
        const dest = p.includes(" -> ") ? p.slice(p.lastIndexOf(" -> ") + 4) : p;
        return dest !== manifestRel && dest !== `"${manifestRel}"`;
    });
    facts.set("git status", statusLines.length === 0 ? "乾淨" : `${statusLines.length} 項：${statusLines.join("；")}`);
    facts.set("worktree", worktrees
        .map((w, i) => {
        if (i === 0)
            return `primary（${annotation ?? branchLabel(w)}）`;
        const foreign = w.branch === null || !laneByBranch.has(w.branch);
        return `${relToPrimary(primaryReal, w.path)}（${branchLabel(w)}）${foreign ? FOREIGN_WORKTREE_SUFFIX : ""}`;
    })
        .join("；"));
    const report = computeLaneStatus({ repoRoot: primary, baseRef: target });
    const rows = [];
    for (const r of report.lanes) {
        const isPrimary = realOrResolved(r.workspacePath) === primaryReal;
        const label = isPrimary ? "primary" : r.branch !== null ? laneByBranch.get(r.branch) : undefined;
        if (label === undefined)
            continue;
        const branchText = isPrimary && annotation !== undefined ? annotation : (r.branch ?? "-");
        if (!r.readable) {
            rows.push(`${label}（${branchText}）unreadable`);
            continue;
        }
        const v = (x) => (x === null ? "-" : String(x));
        const commits = isPrimary && annotation !== undefined ? 0 : r.commits.count;
        // Primary's clean / dirty follows the `git status` fact above, which leaves
        // out the manifest, so pasting the section does not turn this row dirty.
        const clean = isPrimary ? (statusLines.length === 0 ? "clean" : "dirty") : r.gitStatus.clean === null ? "-" : r.gitStatus.clean ? "clean" : "dirty";
        rows.push(`${label}（${branchText}）${v(r.activeFeature)}／${v(r.status)}／${v(r.lastAgent)}，hop ${v(r.hopCount)}，commits ${v(commits)}，${clean}`);
    }
    facts.set("lane-status", rows.join("；"));
    // Background work.
    const integSha = integ !== undefined && !opts.closing ? localBranch(integ) : undefined;
    if (integ !== undefined && integSha !== undefined) {
        const onOrigin = resolveCommit(`refs/remotes/origin/${integ}`, primary) !== undefined;
        facts.set("整合分支", `${integ} @ ${integSha.slice(0, 7)}（origin ${onOrigin ? "有" : "無"}）`);
    }
    const unpushed = [];
    const candidates = [target, ...(integ !== undefined && !opts.closing ? [integ] : []), ...m.dispatchable.map((l) => l.branch)];
    for (const b of [...new Set(candidates)]) {
        const sha = localBranch(b);
        if (sha === undefined)
            continue;
        const n = Number(gitFact("未 push 的 commit", ["rev-list", "--count", sha, "--not", "--remotes"], primary).trim());
        if (n > 0)
            unpushed.push(`${b} ${n}`);
    }
    if (unpushed.length > 0)
        facts.set("未 push 的 commit", unpushed.join("；"));
    if (mailboxRoot !== undefined) {
        const counts = [];
        const watch = [];
        const locks = [];
        for (const l of m.dispatchable) {
            // A lane id of `.` or `..` would name a directory outside the mailbox root.
            if (l.lane === "." || l.lane === "..")
                continue;
            const dir = path.join(mailboxRoot, l.lane);
            for (const f of MAILBOX_FILES) {
                if (fs.existsSync(watchLockPath(path.join(dir, f))))
                    locks.push(`${l.lane}/${f}`);
            }
            if (!isDirectory(dir))
                continue;
            const [toIntegrator, toLane] = MAILBOX_FILES.map((f) => messageCount(path.join(dir, f)));
            counts.push(`${l.lane} to-integrator ${toIntegrator ?? "-"}／to-lane ${toLane ?? "-"}`);
            if (toIntegrator !== undefined) {
                watch.push({ file: relToPrimary(primaryReal, path.join(dir, LANE_TO_INTEGRATOR_FILE)), key: l.lane, lastRead: toIntegrator });
            }
        }
        if (counts.length > 0)
            facts.set("信箱", counts.join("；"));
        if (watch.length > 0)
            facts.set("watch baseline", formatWatchCommand(watch));
        if (locks.length > 0)
            facts.set("監看", locks.join("、"));
    }
    return { facts, notes, primary, primaryBranch, target, targetSha };
}
function isDirectory(p) {
    try {
        return fs.statSync(p).isDirectory();
    }
    catch {
        return false;
    }
}
/** Message count of a mailbox file; undefined when it is absent or unreadable. */
function messageCount(file) {
    try {
        return parseMailboxHeaders(fs.readFileSync(file, "utf8")).length;
    }
    catch {
        return undefined;
    }
}
// --- generate ----------------------------------------------------------------------
const factLine = (key, value) => `- ${key}：${value}`;
/** The `## 接手步驟` section text (trailing newline included) for these facts. */
export function renderHandoffSection(facts) {
    const [primaryItem, closedItem, decideItem, backgroundItem] = HANDOFF_SUBITEMS;
    const background = HANDOFF_BACKGROUND_KEYS.filter((k) => facts.has(k)).map((k) => factLine(k, facts.get(k)));
    return [
        `## ${HANDOFF_SECTION}`,
        HANDOFF_INTRO,
        `### ${primaryItem}`,
        ...HANDOFF_PRIMARY_KEYS.map((k) => factLine(k, facts.get(k) ?? "")),
        `### ${closedItem}`,
        HANDOFF_PLACEHOLDER_CLOSED,
        `### ${decideItem}`,
        HANDOFF_PLACEHOLDER_DECIDE,
        `### ${backgroundItem}`,
        ...(background.length > 0 ? background : [HANDOFF_NONE]),
    ].join("\n") + "\n";
}
// --- check ---------------------------------------------------------------------------
/**
 * Fact lines of the manifest's single `## 接手步驟` section: every
 * `- <key>：<value>` line whose key is a fact key, wherever it sits. When the
 * background sub-item reads 無, every background key counts as absent.
 */
export function readHandoffFacts(text) {
    const sections = findHandoffSections(text);
    if (sections.length === 0) {
        return {
            ok: false,
            errors: [inputErr(HANDOFF_CODES.sectionAbsent, `no "## ${HANDOFF_SECTION}" section — write one with node scripts/fanout.mjs handoff <manifest>`)],
        };
    }
    if (sections.length > 1) {
        return {
            ok: false,
            errors: [
                inputErr(HANDOFF_CODES.sectionDuplicate, `${sections.length} "## ${HANDOFF_SECTION}" sections found (lines ${sections.map((s) => s.line).join(", ")}); exactly one is allowed`),
            ],
        };
    }
    const keys = new Set(HANDOFF_FACT_KEYS);
    const seen = new Map();
    let backgroundBody;
    let inBackground = false;
    for (const l of sections[0].lines) {
        if (l.text.startsWith("### ")) {
            inBackground = backgroundBody === undefined && isNamedHeading(l.text.slice(4).trim(), HANDOFF_BACKGROUND);
            if (inBackground)
                backgroundBody = [];
            continue;
        }
        if (inBackground && l.text.trim() !== "")
            backgroundBody.push(l.text);
        const fm = /^- ([^：]+)：(.*)$/.exec(l.text);
        if (!fm || !keys.has(fm[1].trim()))
            continue;
        const key = fm[1].trim();
        const prev = seen.get(key);
        if (prev)
            prev.lines.push(l.line);
        else
            seen.set(key, { value: fm[2].trim(), lines: [l.line] });
    }
    const dups = [...seen.entries()].filter(([, v]) => v.lines.length > 1);
    if (dups.length > 0) {
        return {
            ok: false,
            errors: dups.map(([k, v]) => inputErr(HANDOFF_CLI_CODES.factDuplicate, `fact "${k}" appears on ${v.lines.length} lines (lines ${v.lines.join(", ")}) of "## ${HANDOFF_SECTION}"`)),
        };
    }
    const facts = new Map([...seen.entries()].map(([k, v]) => [k, v.value]));
    if (backgroundBody !== undefined && backgroundBody.length === 1 && readsNone(backgroundBody[0])) {
        for (const k of HANDOFF_BACKGROUND_KEYS)
            facts.delete(k);
    }
    return { ok: true, facts };
}
const TARGET_FACT_RE = /^(.+) @ ([0-9a-f]{7,40})$/;
const CLOSING_RE = /primary（([^（）]+?) ← ([^（）]+?) @ ([0-9a-f]{7,40})）/;
/**
 * Why a differing fact is an expected move rather than a change, or
 * undefined when it is a DIFF:
 * - the target branch moved forward from the recorded sha;
 * - a closure annotation on primary whose integration-branch sha has merged
 *   into the target, with primary now on the target and the rest of the line
 *   unchanged.
 */
function movedReason(key, written, now, c) {
    if (key === "目標分支") {
        const t = TARGET_FACT_RE.exec(written);
        if (!t || t[1] !== c.target)
            return undefined;
        const sha = resolveCommit(t[2], c.primary);
        if (sha === undefined || sha === c.targetSha || !isAncestor(sha, c.targetSha, c.primary))
            return undefined;
        const n = gitFact(key, ["rev-list", "--count", `${sha}..${c.targetSha}`], c.primary).trim();
        return `（前進 ${n} 個 commit）`;
    }
    if (key === "worktree" || key === "lane-status") {
        const a = CLOSING_RE.exec(written);
        if (!a || a[1] !== c.target || c.primaryBranch !== c.target)
            return undefined;
        const sha = resolveCommit(a[3], c.primary);
        if (sha === undefined || !isAncestor(sha, c.targetSha, c.primary))
            return undefined;
        if (written.replace(a[0], `primary（${c.target}）`) !== now)
            return undefined;
        return `（${a[2]} @ ${a[3]} 已合併進 ${c.target}）`;
    }
    return undefined;
}
/** Compare the written facts with freshly collected ones, key by key (absent equals absent). */
export function compareFacts(written, c) {
    const lines = [];
    let checked = 0;
    let differ = 0;
    let moved = 0;
    for (const key of HANDOFF_FACT_KEYS) {
        const w = written.get(key);
        const n = c.facts.get(key);
        if (w === undefined && n === undefined)
            continue;
        checked++;
        if (w === n)
            continue;
        const pair = `${key}: handoff「${w ?? FACT_ABSENT}」／repo「${n ?? FACT_ABSENT}」`;
        const why = w !== undefined && n !== undefined ? movedReason(key, w, n, c) : undefined;
        if (why !== undefined) {
            moved++;
            lines.push(`MOVED  ${pair}${why}`);
        }
        else {
            differ++;
            lines.push(`DIFF  ${pair}`);
        }
    }
    lines.push(HANDOFF_CHECK_SUMMARY(checked, differ, moved));
    return { checked, differ, moved, output: lines.join("\n") + "\n", exitCode: differ > 0 ? 1 : 0 };
}
// --- CLI -------------------------------------------------------------------------------
function fail(errors) {
    return { stdout: "", stderr: errors.map(formatError).join("\n") + "\n", exitCode: 2 };
}
function handoffUsage(message) {
    return { stdout: "", stderr: `${formatError({ code: "USAGE", message })}\n${HANDOFF_USAGE}\n`, exitCode: 2 };
}
function parseHandoffArgs(args) {
    // `--check` only as the first argument, like `check --cut`.
    const check = args[0] === "--check";
    const rest = check ? args.slice(1) : args;
    const valueFlags = {
        "--target": "target",
        "--repo": "repo",
        "--mailbox-root": "mailboxRoot",
    };
    const out = { check, closing: false };
    const positional = [];
    for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === "--closing") {
            if (out.closing)
                return "flag --closing given more than once";
            out.closing = true;
        }
        else if (Object.hasOwn(valueFlags, a)) {
            const key = valueFlags[a];
            if (i + 1 >= rest.length)
                return `flag ${a} needs a value`;
            if (out[key] !== undefined)
                return `flag ${a} given more than once`;
            out[key] = rest[++i];
        }
        else if (a.startsWith("--")) {
            return a === "--check" ? "--check must come right after handoff" : `unknown flag ${a}`;
        }
        else {
            positional.push(a);
        }
    }
    if (positional.length !== 1)
        return "handoff takes exactly one <manifest>";
    if (check && out.closing)
        return "--closing is only valid without --check";
    return { ...out, manifest: positional[0] };
}
/** Manifest errors that block handoff: any Lanes or row error (a dropped row could be a lane whose facts would be missed). */
function handoffFatalErrors(m) {
    return m.errors.filter((e) => e.scope === "lanes" || e.scope === "row");
}
/**
 * `handoff [--check] <manifest> [--target <branch>] [--repo <dir>]
 * [--mailbox-root <dir>] [--closing]`. Generate: exit 0 = section printed,
 * 2 = usage / input / manifest / git error. Check: 0 = every fact agrees
 * (MOVED allowed), 1 = at least one DIFF, 2 = as generate, or a missing,
 * duplicated or ambiguous section.
 */
export function runHandoff(args) {
    const a = parseHandoffArgs(args);
    if (typeof a === "string")
        return handoffUsage(a);
    let text;
    try {
        text = fs.readFileSync(a.manifest, "utf8");
    }
    catch (err) {
        return fail([inputErr("MANIFEST_UNREADABLE", `cannot read manifest "${a.manifest}": ${err.message}`)]);
    }
    const m = parseManifest(text);
    const fatal = handoffFatalErrors(m);
    if (fatal.length > 0)
        return fail(fatal);
    let written;
    if (a.check) {
        const r = readHandoffFacts(text);
        if (!r.ok)
            return fail(r.errors);
        written = r.facts;
    }
    try {
        const collected = collectFacts(m, text, {
            target: a.target,
            repo: a.repo ?? path.dirname(path.resolve(a.manifest)),
            mailboxRoot: a.mailboxRoot,
            closing: a.closing,
            manifestPath: a.manifest,
        });
        const stderr = collected.notes.map((n) => `${n}\n`).join("");
        if (written === undefined)
            return { stdout: renderHandoffSection(collected.facts), stderr, exitCode: 0 };
        const report = compareFacts(written, collected);
        return { stdout: report.output, stderr, exitCode: report.exitCode };
    }
    catch (err) {
        if (err instanceof HandoffFailure)
            return fail(err.errors);
        throw err;
    }
}
//# sourceMappingURL=fanout-handoff.js.map