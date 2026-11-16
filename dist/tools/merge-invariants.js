// Coded by @sr-engineer
// Post-merge ledger/sidecar preservation check (E126), the git-native
// complement to tw_detect_drift: for merge commit M (parents P1, P2, base B),
// task ids and [x] marks at P1/P2 survive at M (or COMPACTED), and every
// sidecar (kind, lane) has count(M) >= P1 + P2 - B. Reads trees through git,
// never the working directory; fires no gate and writes nothing.
// Why: specs/e260b-rationale.md (tools/merge-invariants.ts)
import { execFileSync } from "node:child_process";
import { resolveTaskRegex } from "./config.js";
import { HISTORY_BUCKET_RE, isBytePrefix, isSafeLaneName, NON_LANE_DIRS } from "./lane-paths.js";
import { SECTION_HEADING_RE } from "./tasks-lane-migrate.js";
// --- exit-code table ---------------------------------------------------------
export const MERGE_INVARIANTS_EXIT = {
    PASS: 0,
    FAIL: 1,
    NOT_A_MERGE_COMMIT: 2,
    NO_MERGE_BASE: 3,
    USAGE_ERROR: 4,
};
export const MERGE_INVARIANTS_USAGE = "Usage: node scripts/merge-invariants.mjs [<merge-ref> | --ref <merge-ref>] [<absolute-repo-root>]\n" +
    "  merge-ref defaults to HEAD; repo-root defaults to the current directory.\n" +
    "  exit: 0 PASS, 1 FAIL, 2 NOT_A_MERGE_COMMIT, 3 NO_MERGE_BASE, 4 USAGE_ERROR";
export const SIDECAR_KINDS = ["dispatch", "telemetry", "metrics", "usage"];
/** Thrown for anything that must surface as USAGE_ERROR rather than a stack trace. */
export class MergeInvariantsUsageError extends Error {
}
const GIT_MAX_BUFFER = 512 * 1024 * 1024;
function git(repoRoot, args) {
    return execFileSync("git", args, {
        cwd: repoRoot,
        maxBuffer: GIT_MAX_BUFFER,
        stdio: ["ignore", "pipe", "pipe"],
    });
}
/** History-walk reads: a partial clone's missing object fails instead of triggering a network fetch. */
function gitWalk(repoRoot, args) {
    return execFileSync("git", args, {
        cwd: repoRoot,
        maxBuffer: GIT_MAX_BUFFER,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
    });
}
/** Ledger path shape per spec Definitions → Row identity; null = not a ledger. */
export function isLedgerPath(p) {
    if (p === "tasks.md")
        return true;
    const s = p.split("/");
    if (s[0] !== ".current" || s[s.length - 1] !== "tasks.md")
        return false;
    if (s.length === 3)
        return isSafeLaneName(s[1]) && !NON_LANE_DIRS.has(s[1]);
    return s.length === 5 && s[1] === "history" && HISTORY_BUCKET_RE.test(s[2]) && isSafeLaneName(s[3]);
}
/** Sidecar path shape (flat / live lane / history lane); null = not a sidecar. */
export function classifySidecarPath(p) {
    const s = p.split("/");
    if (s[0] !== ".current")
        return null;
    const kind = SIDECAR_KINDS.find((k) => s[s.length - 1] === `${k}.jsonl`);
    if (!kind)
        return null;
    if (s.length === 2)
        return { kind, lane: null, source: "flat" };
    if (s.length === 3 && isSafeLaneName(s[1]) && !NON_LANE_DIRS.has(s[1])) {
        return { kind, lane: s[1], source: "live" };
    }
    if (s.length === 5 && s[1] === "history" && HISTORY_BUCKET_RE.test(s[2]) && isSafeLaneName(s[3])) {
        return { kind, lane: s[3], source: "history" };
    }
    return null;
}
export function sidecarKey(kind, lane) {
    return `${kind}/${lane ?? ""}`; // lane names are never empty (isSafeLaneName)
}
const VOID_PREFIX_RE = /^- \[-\] /;
const COMPACTED_SECTION = "Compacted History";
const COMPACTED_MARKER_RE = /^<!--\s*compacted:/;
const MANIFEST_BULLET_RE = /^- (.+): (\d+) done, (\d+) voided\s*$/;
/**
 * Parse one ledger's text: checkbox rows (via the workspace's configured task
 * regex; the `[-]` void marker is normalized to `[ ]` for id extraction only)
 * and the `## Compacted History` manifest, which counts ONLY when its first
 * non-blank line is the `<!-- compacted: ... -->` marker.
 */
export function parseLedger(file, content, taskRegex) {
    const rows = [];
    let manifest = null;
    let section = null;
    let manifestState = "none";
    for (const raw of content.split("\n")) {
        const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
        const h2 = SECTION_HEADING_RE.exec(line);
        if (h2 || /^#\s/.test(line)) {
            section = h2 ? h2[1].trim() : null;
            manifestState = section === COMPACTED_SECTION ? "await-marker" : "none";
            continue;
        }
        if (manifestState === "await-marker") {
            if (line.trim() === "")
                continue;
            if (COMPACTED_MARKER_RE.test(line)) {
                manifestState = "active";
                manifest ??= new Map();
                continue;
            }
            manifestState = "none";
        }
        if (manifestState === "active" && manifest) {
            const b = MANIFEST_BULLET_RE.exec(line);
            if (b) {
                const prev = manifest.get(b[1]) ?? { done: 0, voided: 0 };
                manifest.set(b[1], { done: prev.done + Number(b[2]), voided: prev.voided + Number(b[3]) });
                continue;
            }
        }
        // R-2: the identical per-line rule tools/tasks-file.ts's row parsers apply
        // (`line.trim()` before the row regex, in parseTasks and addTaskInFile), so
        // an indented row they count is never invisible here.
        const rowLine = line.trim();
        const isVoid = VOID_PREFIX_RE.test(rowLine);
        const m = taskRegex.exec(isVoid ? rowLine.replace(VOID_PREFIX_RE, "- [ ] ") : rowLine);
        if (!m || m[2] === undefined)
            continue;
        const state = isVoid ? "-" : m[1] === "x" ? "x" : " ";
        rows.push({ taskId: m[2], state, file, section });
    }
    return { file, rows, manifest };
}
function countNewlines(buf) {
    let n = 0;
    for (const byte of buf)
        if (byte === 0x0a)
            n++;
    return n;
}
/**
 * Read one commit's ledgers + sidecars from git objects. `blobCache` is shared
 * across the four commits of one run so an unchanged file is read once.
 */
export function readCommitSnapshot(repoRoot, sha, label, taskRegex, blobCache = new Map()) {
    const entries = [];
    for (const rec of git(repoRoot, ["ls-tree", "-r", "-z", sha]).toString("utf8").split("\0")) {
        const tab = rec.indexOf("\t");
        if (tab < 0)
            continue;
        const [mode, type, blob] = rec.slice(0, tab).split(" ");
        if (type !== "blob" || !mode.startsWith("100"))
            continue; // regular files only
        entries.push({ path: rec.slice(tab + 1), blob });
    }
    const read = (b) => {
        let buf = blobCache.get(b);
        if (!buf) {
            buf = git(repoRoot, ["cat-file", "blob", b]);
            blobCache.set(b, buf);
        }
        return buf;
    };
    const ledgers = new Map();
    const rowsById = new Map();
    const sidecarFiles = [];
    for (const e of entries) {
        if (isLedgerPath(e.path)) {
            const ledger = parseLedger(e.path, read(e.blob).toString("utf8"), taskRegex);
            ledgers.set(e.path, ledger);
            for (const r of ledger.rows) {
                const list = rowsById.get(r.taskId);
                if (list)
                    list.push(r);
                else
                    rowsById.set(r.taskId, [r]);
            }
            continue;
        }
        const info = classifySidecarPath(e.path);
        if (info)
            sidecarFiles.push({ ...info, path: e.path, bytes: read(e.blob) });
    }
    return { label, sha, ledgers, rowsById, sidecars: dedupSidecars(sidecarFiles) };
}
/**
 * Same content-dedup rule as tools/lane-paths.ts enumerateLaneSidecarSources
 * (which reads the live filesystem, so it cannot be reused against a commit):
 * a history copy of lane L is skipped iff it is a byte-prefix of live L; the
 * flat copy is skipped iff it is a byte-prefix of any counted lane copy.
 */
function dedupSidecars(files) {
    const out = new Map();
    const add = (kind, lane, path, bytes) => {
        const key = sidecarKey(kind, lane);
        const cur = out.get(key) ?? { kind, lane, records: 0, paths: [] };
        cur.records += countNewlines(bytes);
        cur.paths.push(path);
        out.set(key, cur);
    };
    for (const kind of SIDECAR_KINDS) {
        const ofKind = files.filter((f) => f.kind === kind);
        const live = ofKind.filter((f) => f.source === "live");
        const liveByLane = new Map(live.map((f) => [f.lane, f]));
        const counted = [...live];
        for (const h of ofKind.filter((f) => f.source === "history")) {
            const lc = liveByLane.get(h.lane);
            if (h.bytes.length > 0 && lc && isBytePrefix(h.bytes, lc.bytes))
                continue;
            counted.push(h);
        }
        for (const fl of ofKind.filter((f) => f.source === "flat")) {
            if (fl.bytes.length > 0 && counted.some((c) => isBytePrefix(fl.bytes, c.bytes)))
                continue;
            counted.push(fl);
        }
        for (const c of counted)
            add(kind, c.lane, c.path, c.bytes);
    }
    return out;
}
// =============================================================================
// condition (c) history: rows a one-sided compaction summarized after the base
// =============================================================================
export const HISTORY_COMMIT_CAP = 256;
const ZERO_ENTRY = { done: 0, voided: 0 };
const entryOf = (ledger, section) => ledger?.manifest?.get(section) ?? ZERO_ENTRY;
const isKeptAt = (snap, taskId) => (snap.rowsById.get(taskId)?.length ?? 0) > 0;
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
function splitOf(states) {
    let done = 0;
    let voided = 0;
    for (const s of states.values()) {
        if (s === "x")
            done++;
        else
            voided++;
    }
    return { done, voided };
}
/**
 * Sections whose (c) verdict depends on history: the merge's F names S (t1),
 * exactly one parent's F names S (t2, that parent is P_c), and the other
 * parent has a closed row under F/S that is nowhere at the merge (t3).
 * Grouped per (P_c, F); empty means no extra git call at all.
 */
export function compactionHistoryRequests(p1, p2, _base, merge) {
    const byParentFile = new Map();
    for (const [file, mergeLedger] of merge.ledgers) {
        if (!mergeLedger.manifest)
            continue;
        for (const section of mergeLedger.manifest.keys()) {
            const namers = [p1, p2].filter((p) => p.ledgers.get(file)?.manifest?.has(section) === true);
            if (namers.length !== 1)
                continue;
            const compactor = namers[0];
            const other = compactor === p1 ? p2 : p1;
            const droppable = (other.ledgers.get(file)?.rows ?? []).some((r) => r.section === section && r.state !== " " && !isKeptAt(merge, r.taskId));
            if (!droppable)
                continue;
            const key = `${compactor.label}\0${file}`;
            const req = byParentFile.get(key) ?? { parent: compactor, file, sections: [] };
            req.sections.push(section);
            byParentFile.set(key, req);
        }
    }
    return [...byParentFile]
        .sort(([a], [b]) => cmp(a, b))
        .map(([, r]) => ({ ...r, sections: [...r.sections].sort(cmp) }));
}
/** Every requested section of one walk falls back with the same reason. */
export function historyFallbackAll(req, reason, detail) {
    return req.sections.map((section) => ({
        parent: req.parent.label,
        parentSha: req.parent.sha,
        file: req.file,
        section,
        summarized: null,
        fallback: { reason, detail },
    }));
}
/** WARN detail for a failed git call: first non-empty stderr line, else message line, else a fixed text; never empty. */
export function historyErrorDetail(err, subcommand) {
    const e = typeof err === "object" && err !== null ? err : {};
    const texts = [e.stderr, e.message, typeof err === "string" ? err : undefined];
    for (const t of texts) {
        const text = Buffer.isBuffer(t) ? t.toString("utf8") : typeof t === "string" ? t : "";
        const line = text.split("\n").map((l) => l.trim()).find((l) => l !== "");
        if (line)
            return line.slice(0, 200);
    }
    return `git ${subcommand} failed`;
}
/** True iff `git version` output names 2.44 or later (the first release honouring GIT_NO_LAZY_FETCH). */
export function gitVersionAllowsNoLazyFetch(versionText) {
    const m = /^git version (\d+)\.(\d+)/.exec(versionText.trim());
    if (!m)
        return false;
    const major = Number(m[1]);
    return major > 2 || (major === 2 && Number(m[2]) >= 44);
}
/** One walk read; a failure is rethrown with its WARN detail as the message. */
function walkRead(repoRoot, args) {
    try {
        return gitWalk(repoRoot, args);
    }
    catch (err) {
        throw new Error(historyErrorDetail(err, args[0]));
    }
}
/** F's ledger at one commit (absent path = empty ledger); throws on any unreadable object. */
function readLedgerAt(repoRoot, sha, file, blobCache, taskRegex) {
    for (const rec of walkRead(repoRoot, ["ls-tree", "--full-tree", "-z", sha, "--", file]).toString("utf8").split("\0")) {
        const tab = rec.indexOf("\t");
        if (tab < 0 || rec.slice(tab + 1) !== file)
            continue;
        const [mode, type, blob] = rec.slice(0, tab).split(" ");
        if (type !== "blob" || !mode.startsWith("100"))
            break; // same regular-file rule as readCommitSnapshot
        let buf = blobCache.get(blob);
        if (!buf) {
            buf = walkRead(repoRoot, ["cat-file", "blob", blob]);
            blobCache.set(blob, buf);
        }
        return parseLedger(file, buf.toString("utf8"), taskRegex);
    }
    return parseLedger(file, "", taskRegex);
}
const PROMISOR_OFF = new Set(["false", "no", "off", "0"]);
const PARTIAL_CLONE_DETAIL = "partial clone and git older than 2.44 (or version not recognised); history is not read to avoid a fetch";
/** Run probes p1-p3 (spec step 2): shallow, or an unreadable detail, or null when walks may read. */
export function probeHistoryReadable(repoRoot) {
    let shallowOut;
    try {
        shallowOut = gitWalk(repoRoot, ["rev-parse", "--is-shallow-repository"]).toString("utf8").trim();
    }
    catch (err) {
        return { reason: "unreadable", detail: historyErrorDetail(err, "rev-parse") };
    }
    if (shallowOut === "true")
        return { reason: "shallow", detail: "" };
    if (shallowOut !== "false")
        return { reason: "unreadable", detail: "git rev-parse failed" };
    let promisorOut = "";
    try {
        const re = "^(extensions\\.partialclone|remote\\..+\\.promisor)$";
        promisorOut = gitWalk(repoRoot, ["config", "--get-regexp", re]).toString("utf8");
    }
    catch (err) {
        const e = err;
        const out = Buffer.isBuffer(e.stdout) ? e.stdout.toString("utf8").trim() : "";
        if (e.status !== 1 || out !== "")
            return { reason: "unreadable", detail: historyErrorDetail(err, "config") };
    }
    const partial = promisorOut.split("\n").some((line) => {
        const [key, ...rest] = line.trim().split(/\s+/);
        if (!key)
            return false;
        const off = /^remote\..+\.promisor$/.test(key) && PROMISOR_OFF.has(rest.join(" ").toLowerCase());
        return !off;
    });
    if (!partial)
        return null;
    try {
        const version = gitWalk(repoRoot, ["version"]).toString("utf8");
        return gitVersionAllowsNoLazyFetch(version) ? null : { reason: "unreadable", detail: PARTIAL_CLONE_DETAIL };
    }
    catch (err) {
        return { reason: "unreadable", detail: historyErrorDetail(err, "version") };
    }
}
/**
 * Recover H for one section: at each commit whose count for S rises over the
 * max of its real parents, the closed rows that left F/S (not kept in F at
 * that commit, not anywhere at P_c's tip, not already in H) must match the
 * rise exactly, and H must stay within P_c's own count; else unreconciled.
 */
function sectionHistory(req, section, commits, ledgers) {
    const result = (summarized, unreconciled) => ({
        parent: req.parent.label,
        parentSha: req.parent.sha,
        file: req.file,
        section,
        summarized,
        fallback: unreconciled === null ? null : { reason: "unreconciled", detail: unreconciled },
    });
    const recovered = new Map();
    let transitions = 0;
    for (const c of commits) {
        const parentLedgers = c.parents.map((p) => ledgers.get(p)).filter((l) => l !== undefined);
        const max = parentLedgers.reduce((m, l) => {
            const e = entryOf(l, section);
            return { done: Math.max(m.done, e.done), voided: Math.max(m.voided, e.voided) };
        }, ZERO_ENTRY);
        const atC = ledgers.get(c.sha);
        const cur = entryOf(atC, section);
        const inc = { done: cur.done - max.done, voided: cur.voided - max.voided };
        if (inc.done < 0 || inc.voided < 0)
            return result(null, `count fell at ${short(c.sha)}`);
        if (inc.done === 0 && inc.voided === 0)
            continue;
        transitions++;
        const inFileAtC = new Set((atC?.rows ?? []).map((r) => r.taskId));
        const removed = new Map();
        for (const l of parentLedgers) {
            for (const r of l.rows) {
                if (r.section !== section || r.state === " ")
                    continue;
                if (inFileAtC.has(r.taskId) || isKeptAt(req.parent, r.taskId) || recovered.has(r.taskId))
                    continue;
                if (removed.get(r.taskId) !== "x")
                    removed.set(r.taskId, r.state);
            }
        }
        const left = splitOf(removed);
        if (left.done !== inc.done || left.voided !== inc.voided) {
            return result(null, `count rose by ${inc.done} done/${inc.voided} voided at ${short(c.sha)} but ` +
                `${left.done} [x]/${left.voided} [-] row(s) left the section`);
        }
        for (const [id, s] of removed)
            recovered.set(id, s);
    }
    if (transitions === 0)
        return result(null, null); // compacted at or before the merge-base: silent
    const own = entryOf(req.parent.ledgers.get(req.file), section);
    const h = splitOf(recovered);
    if (h.done > own.done || h.voided > own.voided) {
        return result(null, `${h.done} [x]/${h.voided} [-] recovered row(s) exceed the parent's manifest ${own.done} done/${own.voided} voided`);
    }
    return result(recovered, null);
}
/**
 * One walk over P_c's history between the merge-base and P_c for ledger F,
 * one entry per requested section. Never throws: shallow, unreadable and
 * over-cap history map to a fallback (snapshot-only rule + WARN line).
 */
export function readCompactionHistory(repoRoot, baseSha, req, blobCache, opts) {
    if (opts.shallow)
        return historyFallbackAll(req, "shallow", "");
    try {
        let listing;
        try {
            listing = gitWalk(repoRoot, [
                "log", "--full-history", "--topo-order", "--reverse", `--max-count=${opts.cap + 1}`,
                "--format=%H %P", `${baseSha}..${req.parent.sha}`, "--", `:(top,literal)${req.file}`,
            ]).toString("utf8");
        }
        catch (err) {
            return historyFallbackAll(req, "unreadable", historyErrorDetail(err, "log"));
        }
        const commits = listing
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l !== "")
            .map((l) => {
            const [sha, ...parents] = l.split(/\s+/);
            return { sha, parents };
        });
        if (commits.length > opts.cap) {
            return historyFallbackAll(req, "cap", `more than ${opts.cap} commits touch ${req.file} between the merge-base and ${req.parent.label}`);
        }
        const ledgers = new Map();
        for (const c of commits) {
            for (const sha of [c.sha, ...c.parents]) {
                if (!ledgers.has(sha))
                    ledgers.set(sha, readLedgerAt(repoRoot, sha, req.file, blobCache, opts.taskRegex));
            }
        }
        return req.sections.map((section) => sectionHistory(req, section, commits, ledgers));
    }
    catch (err) {
        return historyFallbackAll(req, "unreadable", historyErrorDetail(err, "log"));
    }
}
const fileSectionKey = (file, section) => `${file}\0${section}`;
/** Compaction exemption (a), (b), (d) for one parent occurrence (all per-parent); null = passes them. */
function perParentIneligibility(occ, parentSnap, merge) {
    const where = `${occ.file} § ${occ.section ?? "(no section)"} at ${occ.parent}`;
    if (occ.state === " ")
        return `(a) open [ ] row in ${where} is never compaction-eligible`;
    if (occ.section === null)
        return `(b) row in ${occ.file} at ${occ.parent} has no ## section`;
    if (!merge.ledgers.get(occ.file)?.manifest?.has(occ.section)) {
        return `(b) no Compacted History manifest naming "${occ.section}" in ${occ.file} at merge`;
    }
    if (parentSnap.ledgers.get(occ.file)?.manifest?.has(occ.section)) {
        return `(d) "${occ.section}" was already compacted in ${occ.file} at ${occ.parent} (recycled section name)`;
    }
    return null;
}
const coversSplit = (entry, ids) => {
    const { done, voided } = splitOf(ids);
    return entry.done >= done && entry.voided >= voided;
};
/**
 * History check ids (run only when the snapshot check holds): U_snap minus kept
 * ids the compacting side never counted, plus H ids found nowhere at the merge,
 * the merge-base or the other parent's tip (rows that existed only on the
 * compacting side and were summarized there). U_snap ids keep their states.
 */
function historyCheckIds(snapIds, summarized, base, other, merge) {
    const ids = new Map();
    for (const [id, s] of snapIds)
        if (!isKeptAt(merge, id) || summarized.has(id))
            ids.set(id, s);
    let added = 0;
    for (const [id, s] of summarized) {
        if (snapIds.has(id) || isKeptAt(merge, id) || isKeptAt(base, id) || isKeptAt(other, id))
            continue;
        ids.set(id, s);
        added++;
    }
    return { ids, added };
}
/**
 * Condition (c) over the UNION across parents (R-1): U per file F / section S =
 * distinct closed task_ids from parent occurrences passing (a)/(b)/(d). A
 * task_id not found at the merge always counts; a kept one counts only when
 * (i) the merge-base has it under F/S and (ii) no parent whose F names S in
 * its manifest holds it (specs/e126-merge-invariants.md (c)). `[x]` in any
 * contributing occurrence counts as done, else voided. Returns the (c)
 * failure reason per failing F/S key; see historyCheckIds for the second check.
 */
function unionReconciliationFailures(occsById, parents, base, merge, historyByKey) {
    const union = new Map(); // F/S key -> task_id -> state
    for (const [taskId, occs] of occsById) {
        const kept = (merge.rowsById.get(taskId)?.length ?? 0) > 0;
        for (const { ref, snap } of occs) {
            if (ref.section === null || perParentIneligibility(ref, snap, merge) !== null)
                continue;
            if (kept) {
                const section = ref.section;
                const atBase = (base.rowsById.get(taskId) ?? []).some((r) => r.file === ref.file && r.section === section);
                const heldByCompactor = parents.some((p) => p.ledgers.get(ref.file)?.manifest?.has(section) === true && (p.rowsById.get(taskId)?.length ?? 0) > 0);
                if (!atBase || heldByCompactor)
                    continue;
            }
            const key = fileSectionKey(ref.file, ref.section);
            const ids = union.get(key) ?? new Map();
            if (ids.get(taskId) !== "x")
                ids.set(taskId, ref.state);
            union.set(key, ids);
        }
    }
    const reason = (file, section, entry, ids, suffix) => {
        const { done, voided } = splitOf(ids);
        return (`(c) manifest under-reconciles ${file} § ${section}: manifest ${entry.done} done/` +
            `${entry.voided} voided < closed rows it must cover, union across parents ${done} [x]/${voided} [-] ` +
            `(${ids.size} distinct task_id(s))${suffix}`);
    };
    const failures = new Map();
    for (const key of new Set([...union.keys(), ...historyByKey.keys()])) {
        const [file, section] = key.split("\0");
        const entry = merge.ledgers.get(file)?.manifest?.get(section);
        if (!entry)
            continue; // unreachable: (b) held for every contributor, t1 for every history key
        const snapIds = union.get(key) ?? new Map();
        if (!coversSplit(entry, snapIds)) {
            failures.set(key, reason(file, section, entry, snapIds, ""));
            continue;
        }
        const sh = historyByKey.get(key);
        const other = sh ? parents.find((p) => p.label !== sh.parent) : undefined;
        if (!sh?.summarized || !other)
            continue;
        const { ids: histIds, added } = historyCheckIds(snapIds, sh.summarized, base, other, merge);
        if (!coversSplit(entry, histIds)) {
            const suffix = added > 0 ? ` — includes ${added} row(s) read from ${sh.parent} history after the merge-base` : "";
            failures.set(key, reason(file, section, entry, histIds, suffix));
        }
    }
    return failures;
}
/** Compaction exemption (a)–(d) for one parent occurrence; null = eligible, else the reason it is not. */
function compactionIneligibility(occ, parentSnap, merge, unionFailures) {
    const perParent = perParentIneligibility(occ, parentSnap, merge);
    if (perParent !== null || occ.section === null)
        return perParent;
    return unionFailures.get(fileSectionKey(occ.file, occ.section)) ?? null;
}
/** Pure. `history` = walk outcomes; [] (or only null-`summarized` entries) is the snapshot-only rule. */
export function evaluateMergeInvariants(p1, p2, base, merge, history = []) {
    const byId = new Map();
    for (const snap of [p1, p2]) {
        for (const [id, rows] of snap.rowsById) {
            const list = byId.get(id) ?? [];
            for (const r of rows)
                list.push({ ref: { ...r, parent: snap.label, parentSha: snap.sha }, snap });
            byId.set(id, list);
        }
    }
    const historyByKey = new Map();
    const historyFallbacks = [];
    for (const h of history) {
        if (h.summarized)
            historyByKey.set(fileSectionKey(h.file, h.section), h);
        if (h.fallback) {
            const { parent, parentSha, file, section } = h;
            historyFallbacks.push({ parent, parentSha, file, section, reason: h.fallback.reason, detail: h.fallback.detail });
        }
    }
    historyFallbacks.sort((a, b) => cmp(a.parent, b.parent) || cmp(a.file, b.file) || cmp(a.section, b.section));
    const unionFailures = unionReconciliationFailures(byId, [p1, p2], base, merge, historyByKey);
    const checkedAtMerge = [...merge.ledgers.keys()].sort();
    const missing = [];
    const lostCompletions = [];
    const compacted = [];
    for (const [taskId, occs] of [...byId].sort(([a], [b]) => a.localeCompare(b))) {
        const atMerge = merge.rowsById.get(taskId) ?? [];
        const refs = occs.map((o) => o.ref);
        let isCompacted = false;
        if (atMerge.length === 0) {
            // Strict: EVERY parent occurrence must qualify, so a row dropped from a
            // non-compacted ledger is never hidden by another file's manifest.
            const reasons = occs
                .map((o) => compactionIneligibility(o.ref, o.snap, merge, unionFailures))
                .filter((r) => r !== null);
            if (reasons.length === 0) {
                isCompacted = true;
                compacted.push({ taskId, occurrences: refs });
            }
            else {
                missing.push({ taskId, foundAt: refs, checkedAtMerge, reasons });
            }
        }
        const doneAt = refs.filter((r) => r.state === "x");
        if (doneAt.length > 0 && !isCompacted && !atMerge.some((r) => r.state === "x")) {
            lostCompletions.push({ taskId, doneAt, atMerge });
        }
    }
    const sidecarKeys = new Set([...p1.sidecars.keys(), ...p2.sidecars.keys(), ...base.sidecars.keys()]);
    const sidecarShortfalls = [];
    for (const key of [...sidecarKeys].sort()) {
        const sample = p1.sidecars.get(key) ?? p2.sidecars.get(key) ?? base.sidecars.get(key);
        if (!sample)
            continue;
        const n = (s) => s.sidecars.get(key)?.records ?? 0;
        const expectedMin = n(p1) + n(p2) - n(base);
        if (n(merge) < expectedMin) {
            sidecarShortfalls.push({
                kind: sample.kind,
                lane: sample.lane,
                merge: n(merge),
                parent1: n(p1),
                parent2: n(p2),
                base: n(base),
                expectedMin,
            });
        }
    }
    return {
        rowsChecked: byId.size,
        missing,
        lostCompletions,
        compacted,
        sidecarsChecked: sidecarKeys.size,
        sidecarShortfalls,
        historyFallbacks,
    };
}
const short = (sha) => sha.slice(0, 7);
const fmtRef = (r) => `${r.parent} (${short(r.parentSha)}) ${r.file} § ${r.section ?? "(no section)"} [${r.state}]`;
const FALLBACK_CLASS = {
    shallow: "shallow repository",
    unreadable: "history unreadable: ",
    cap: "history over cap: ",
    unreconciled: "history unreconciled: ",
};
const fmtFallback = (w) => `WARN (c) history fallback: ${w.parent} (${short(w.parentSha)}) ${w.file} § ${w.section} — ` +
    `${FALLBACK_CLASS[w.reason]}${w.detail}; snapshot-only (c) used for this section`;
export function renderMergeInvariantsReport(shas, f) {
    const out = [
        `merge-invariants: merge ${short(shas.merge)} (parent1 ${short(shas.parent1)}, parent2 ${short(shas.parent2)}, merge-base ${short(shas.base)})`,
    ];
    for (const w of f.historyFallbacks)
        out.push(fmtFallback(w));
    out.push(`[AC1] row presence: ${f.rowsChecked} task_id(s) at parents — ` +
        `${f.rowsChecked - f.missing.length - f.compacted.length} present, ${f.compacted.length} COMPACTED, ${f.missing.length} MISSING`);
    for (const m of f.missing) {
        out.push(`  MISSING ${m.taskId} — found at: ${m.foundAt.map(fmtRef).join("; ")}`);
        out.push(`    checked at merge: ${m.checkedAtMerge.join(", ") || "(no ledger files)"}`);
        for (const r of m.reasons)
            out.push(`    not compacted: ${r}`);
    }
    out.push(`[AC2] [x] preservation: ${f.lostCompletions.length} lost completion(s)`);
    for (const l of f.lostCompletions) {
        const at = l.atMerge.length ? l.atMerge.map((r) => `${r.file} [${r.state}]`).join("; ") : "absent";
        out.push(`  LOST_DONE ${l.taskId} — [x] at: ${l.doneAt.map(fmtRef).join("; ")}; at merge: ${at}`);
    }
    out.push(`[AC3] sidecar records: ${f.sidecarsChecked} (kind, lane) identities, ${f.sidecarShortfalls.length} shortfall(s)`);
    for (const s of f.sidecarShortfalls) {
        out.push(`  SIDECAR_SHORTFALL kind=${s.kind} lane=${s.lane ?? "(flat)"} merge=${s.merge} < ` +
            `parent1=${s.parent1} + parent2=${s.parent2} - base=${s.base} = ${s.expectedMin}`);
    }
    if (f.compacted.length > 0) {
        const breakdown = new Map();
        for (const c of f.compacted) {
            // Q-1: one increment per distinct task_id per file § section, never per parent occurrence.
            for (const k of new Set(c.occurrences.map((o) => `${o.file} § ${o.section ?? ""}`))) {
                breakdown.set(k, (breakdown.get(k) ?? 0) + 1);
            }
        }
        out.push(`COMPACTED (informational): ${f.compacted.length} row(s) summarized by a Compacted History manifest — file § section breakdown:`);
        for (const [k, n] of [...breakdown].sort(([a], [b]) => a.localeCompare(b)))
            out.push(`  ${k}: ${n}`);
    }
    const offending = f.missing.length + f.lostCompletions.length + f.sidecarShortfalls.length;
    out.push(offending === 0
        ? "RESULT: PASS — all three invariants held (row presence, [x] preservation, sidecar records)"
        : `RESULT: FAIL — ${offending} offending item(s): ${f.missing.length} MISSING, ` +
            `${f.lostCompletions.length} LOST_DONE, ${f.sidecarShortfalls.length} SIDECAR_SHORTFALL`);
    return out.join("\n");
}
function result(code, report, findings) {
    return { code, exitCode: MERGE_INVARIANTS_EXIT[code], report, findings };
}
function gitErr(err) {
    const e = err;
    const s = e.stderr ? e.stderr.toString().trim() : "";
    return s || e.message || String(err);
}
/**
 * Exported entrypoint: never throws; every outcome maps to an exit code.
 * `opts.historyCommitCap` is a test knob only; the CLI never passes it.
 */
export function runMergeInvariants(ref = "HEAD", repoRoot = process.cwd(), opts = {}) {
    if (ref.startsWith("-") || ref.length === 0) {
        return result("USAGE_ERROR", `merge-invariants: invalid ref ${JSON.stringify(ref)}\n${MERGE_INVARIANTS_USAGE}`);
    }
    try {
        git(repoRoot, ["rev-parse", "--git-dir"]);
    }
    catch (err) {
        return result("USAGE_ERROR", `merge-invariants: ${repoRoot} is not a git repository (${gitErr(err)})\n${MERGE_INVARIANTS_USAGE}`);
    }
    let mergeSha;
    try {
        mergeSha = git(repoRoot, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]).toString().trim();
    }
    catch {
        return result("USAGE_ERROR", `merge-invariants: cannot resolve ref ${JSON.stringify(ref)} to a commit\n${MERGE_INVARIANTS_USAGE}`);
    }
    let parents;
    try {
        parents = git(repoRoot, ["rev-list", "--parents", "-n", "1", mergeSha]).toString().trim().split(/\s+/).slice(1);
    }
    catch (err) {
        return result("USAGE_ERROR", `merge-invariants: cannot list parents of ${short(mergeSha)} (${gitErr(err)})`);
    }
    if (parents.length !== 2) {
        return result("NOT_A_MERGE_COMMIT", `merge-invariants: NOT_A_MERGE_COMMIT — ${ref} (${short(mergeSha)}) has ${parents.length} parent(s); ` +
            "exactly 2 required (octopus merges are unsupported)");
    }
    const [parent1, parent2] = parents;
    let base;
    try {
        base = git(repoRoot, ["merge-base", parent1, parent2]).toString().trim();
    }
    catch {
        return result("NO_MERGE_BASE", `merge-invariants: NO_MERGE_BASE — parents ${short(parent1)} and ${short(parent2)} of ${short(mergeSha)} share no common ancestor`);
    }
    try {
        const taskRegex = resolveTaskRegex(repoRoot);
        const cache = new Map();
        const snap = (sha, label) => readCommitSnapshot(repoRoot, sha, label, taskRegex, cache);
        const p1Snap = snap(parent1, "parent1");
        const p2Snap = snap(parent2, "parent2");
        const baseSnap = snap(base, "merge-base");
        const mergeSnap = snap(mergeSha, "merge");
        const requests = compactionHistoryRequests(p1Snap, p2Snap, baseSnap, mergeSnap);
        const history = [];
        if (requests.length > 0) {
            const knob = opts.historyCommitCap;
            const cap = knob !== undefined && Number.isInteger(knob) && knob >= 0 ? knob : HISTORY_COMMIT_CAP;
            const probe = probeHistoryReadable(repoRoot);
            const shallow = probe?.reason === "shallow";
            for (const req of requests) {
                history.push(...(probe?.reason === "unreadable"
                    ? historyFallbackAll(req, "unreadable", probe.detail)
                    : readCompactionHistory(repoRoot, base, req, cache, { cap, shallow, taskRegex })));
            }
        }
        const findings = evaluateMergeInvariants(p1Snap, p2Snap, baseSnap, mergeSnap, history);
        const report = renderMergeInvariantsReport({ merge: mergeSha, parent1, parent2, base }, findings);
        const failed = findings.missing.length + findings.lostCompletions.length + findings.sidecarShortfalls.length > 0;
        return result(failed ? "FAIL" : "PASS", report, findings);
    }
    catch (err) {
        return result("USAGE_ERROR", `merge-invariants: could not read commit trees (${gitErr(err)})`);
    }
}
// =============================================================================
// argv surface (kept here so scripts/merge-invariants.mjs has zero logic)
// =============================================================================
/** Parse argv (`[ref] [--ref <ref>] [abs-repo-root]`) and run; never throws. */
export function runMergeInvariantsCli(argv, cwd) {
    let ref;
    let repoRoot;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "-h" || a === "--help")
            return result("USAGE_ERROR", MERGE_INVARIANTS_USAGE);
        let value;
        if (a === "--ref")
            value = argv[++i];
        else if (a.startsWith("--ref="))
            value = a.slice("--ref=".length);
        if (a === "--ref" || a.startsWith("--ref=")) {
            if (!value || ref !== undefined)
                return result("USAGE_ERROR", `merge-invariants: bad --ref\n${MERGE_INVARIANTS_USAGE}`);
            ref = value;
        }
        else if (a.startsWith("-")) {
            return result("USAGE_ERROR", `merge-invariants: unknown option ${a}\n${MERGE_INVARIANTS_USAGE}`);
        }
        else if (a.startsWith("/") && repoRoot === undefined) {
            repoRoot = a;
        }
        else if (ref === undefined) {
            ref = a;
        }
        else {
            return result("USAGE_ERROR", `merge-invariants: unexpected argument ${a}\n${MERGE_INVARIANTS_USAGE}`);
        }
    }
    return runMergeInvariants(ref ?? "HEAD", repoRoot ?? cwd);
}
//# sourceMappingURL=merge-invariants.js.map