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
        // R-2: the identical per-line rule tools/tasks-file.ts's row parser applies
        // (`line.trim()` before the row regex, tasks-file.ts:216/703), so an
        // indented row it counts is never invisible here.
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
/**
 * Condition (c) over the UNION across parents (spec amendment R-1): for each
 * file F / section S, U = distinct closed task_ids under F/S from every parent
 * occurrence passing (a)/(b)/(d) — a (d)-barred parent contributes nothing.
 * A task_id closed as `[x]` in any contributing occurrence counts as done,
 * otherwise voided. Returns the (c) failure reason per failing F/S key.
 */
function unionReconciliationFailures(occsById, merge) {
    const union = new Map(); // F/S key -> task_id -> state
    for (const [taskId, occs] of occsById) {
        for (const { ref, snap } of occs) {
            if (ref.section === null || perParentIneligibility(ref, snap, merge) !== null)
                continue;
            const key = fileSectionKey(ref.file, ref.section);
            const ids = union.get(key) ?? new Map();
            if (ids.get(taskId) !== "x")
                ids.set(taskId, ref.state);
            union.set(key, ids);
        }
    }
    const failures = new Map();
    for (const [key, ids] of union) {
        const [file, section] = key.split("\0");
        const entry = merge.ledgers.get(file)?.manifest?.get(section);
        if (!entry)
            continue; // unreachable: (b) held for every contributor
        let done = 0;
        let voided = 0;
        for (const s of ids.values()) {
            if (s === "x")
                done++;
            else
                voided++;
        }
        if (entry.done < done || entry.voided < voided) {
            failures.set(key, `(c) manifest under-reconciles ${file} § ${section}: manifest ${entry.done} done/` +
                `${entry.voided} voided < union across parents ${done} [x]/${voided} [-] (${ids.size} distinct task_id(s))`);
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
export function evaluateMergeInvariants(p1, p2, base, merge) {
    const byId = new Map();
    for (const snap of [p1, p2]) {
        for (const [id, rows] of snap.rowsById) {
            const list = byId.get(id) ?? [];
            for (const r of rows)
                list.push({ ref: { ...r, parent: snap.label, parentSha: snap.sha }, snap });
            byId.set(id, list);
        }
    }
    const unionFailures = unionReconciliationFailures(byId, merge);
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
    };
}
const short = (sha) => sha.slice(0, 7);
const fmtRef = (r) => `${r.parent} (${short(r.parentSha)}) ${r.file} § ${r.section ?? "(no section)"} [${r.state}]`;
export function renderMergeInvariantsReport(shas, f) {
    const out = [
        `merge-invariants: merge ${short(shas.merge)} (parent1 ${short(shas.parent1)}, parent2 ${short(shas.parent2)}, merge-base ${short(shas.base)})`,
    ];
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
/** Exported entrypoint: never throws; every outcome maps to an exit code. */
export function runMergeInvariants(ref = "HEAD", repoRoot = process.cwd()) {
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
        const findings = evaluateMergeInvariants(snap(parent1, "parent1"), snap(parent2, "parent2"), snap(base, "merge-base"), snap(mergeSha, "merge"));
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