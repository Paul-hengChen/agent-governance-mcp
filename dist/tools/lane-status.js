// Coded by @sr-engineer
// tools/lane-status.ts — lane observability + roll-up for the integrator
// (E177b, e177b-lane-status-tooling, T-E177B-05, spec AC1-AC6).
//
// Replaces the integrator's by-hand lane read (per-worktree handoff reads,
// `git log` / `git status` per lane, adding hop/round counts against caps,
// eyeballing claimed completed_tasks vs on-disk qa evidence). Wave 5 showed
// every one of those failing by hand; this module makes them mechanical.
//
// REPORTING SURFACE ONLY — like tools/feature-rollup.ts it fires no gate,
// writes nothing, and never makes a cap span workspaces (E109).
//
// Data sources (all imported, none modified — lane boundary):
//   - lane list: tools/lane-registry.ts `laneRegistryList` (itself
//     `git worktree list` via tools/feature-rollup.ts). NEVER any
//     `specs/fanout-*.md` manifest (E177a's concern, AC1).
//   - handoff round fields: tools/handoff-parse.ts `parseHandoff` (the
//     LaneInfo shape carries hop but not review/qa rounds).
//   - same-feature hop/ticket totals: tools/feature-rollup.ts
//     `computeFeatureRollup`, fed this module's already-derived lane list so
//     nothing is re-derived (AC4).
//   - caps: tools/transitions.ts `HOP_CAP_EXPORTED` / `ROUND_CAP_EXPORTED` /
//     `REVIEW_ROUND_CAP_EXPORTED` — never a hardcoded number (AC4).
//   - evidence: tools/evidence-file.ts `parseCoversIds` (covers: label
//     lines) + direct `review_<id>.md` filenames, PASS rounds only (AC5).
//   - ticket token + lane ledger location: tools/lane-paths.ts
//     `resolveLaneName` / `LEGACY_LANE` / `PRIMARY_LANE` / `isSafeLaneName` /
//     `laneFile` — imported, never a restated ticket-id regex (the e73/e126
//     import-only precedent). Deliberately not lane-paths' lane-path
//     resolver functions: each has its own pinned caller allow-list
//     (CALLERS1 / CALLERS3 in test/lane-paths.test.mjs) that this ticket is
//     not authorized to extend, and the row's branch already names the lane.
//
// E178b adds a `--watch` mode (`runLaneWatch`, T-E178B-01): a polling event
// stream over every lane's handoff state for the integrator's Monitor tool,
// with scripts/mailbox-watch.mjs's baseline / `expiring — re-arm` / exit-code
// conventions. Each tick reads ONLY the lane list + each lane's handoff — no
// git log/status, no evidence cross-check (spec decision (b), AC7).
//
// Degrade-honestly (same posture as tools/feature-rollup.ts, AC3): a lane
// whose handoff is missing/unparseable is always CARRIED with
// `readable: false` and a reason string — never dropped, never zero-filled —
// and the whole report is marked degraded with a stated reason.
//
// The functions are split I/O vs pure: `computeLaneStatus` does all the
// reading (git + fs); `rollupSameFeature` / `rollupAcrossLanes` and every
// `render*` function are pure over a `LaneStatusReport`, so callers (and
// tests) can build synthetic reports without a git fixture.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { computeFeatureRollup } from "./feature-rollup.js";
import { laneRegistryList } from "./lane-registry.js";
import { parseHandoff } from "./handoff-parse.js";
import { HOP_CAP_EXPORTED, ROUND_CAP_EXPORTED, REVIEW_ROUND_CAP_EXPORTED } from "./transitions.js";
import { parseCoversIds } from "./evidence-file.js";
import { LEGACY_LANE, PRIMARY_LANE, isSafeLaneName, laneFile, resolveLaneName } from "./lane-paths.js";
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Printed (per lane) when the feature id yields no ticket token (AC5c). */
export const TOKEN_NOT_DERIVABLE_NOTE = "ticket token not derivable — comparing completed_tasks only";
/**
 * Lowercased leading ticket-id token of a feature id, or null. Delegates to
 * tools/lane-paths.ts `resolveLaneName` (the single owner of the ticket-id
 * pattern — import-only reuse, never a restated regex), mapping its
 * LEGACY_LANE "no token" sentinel to null.
 */
export function featureTicketToken(activeFeature) {
    const lane = resolveLaneName(activeFeature ?? undefined);
    return lane === LEGACY_LANE ? null : lane;
}
const FEAT_BRANCH_PREFIX = "feat/";
const REVIEW_FILE_RE = /^review_(.+)\.md$/;
// The section header gates/qa-review.ts `recordReviewInFile` writes for a
// PASS round: `## <iso-ts> — PASS — by qa-engineer` (AC5b).
const QA_PASS_HEADER_RE = /^##\s.*\s—\sPASS\s—\sby qa-engineer\b/m;
// A voided ledger row: `- [-] <id> ... (voided: ...)` (tools/tasks-file.ts
// voidTaskInFile's marker; AC5d).
const VOIDED_ROW_RE = /^- \[-\] (\S+)(?=\s|$)/;
/** Ticket-id lane token of a `feat/<id>-...` branch (via resolveLaneName), else null. */
function laneIdFromBranch(branch) {
    if (!branch || !branch.startsWith(FEAT_BRANCH_PREFIX))
        return null;
    return featureTicketToken(branch.slice(FEAT_BRANCH_PREFIX.length));
}
function errMessage(err) {
    if (err && typeof err === "object" && "stderr" in err) {
        const stderr = err.stderr;
        const text = typeof stderr === "string" ? stderr : Buffer.isBuffer(stderr) ? stderr.toString("utf-8") : "";
        if (text.trim())
            return text.trim().split(/\r?\n/)[0];
    }
    return err instanceof Error ? err.message : String(err);
}
function runGit(args, cwd, timeoutMs) {
    // execFileSync (argv array, no shell) — branch/ref names never pass through
    // a shell, so no injection surface. stderr captured, never inherited.
    return execFileSync("git", args, {
        cwd,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: timeoutMs,
    });
}
function numOrNull(v) {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
}
/** Does `id` carry `token` as one delimited segment (case-insensitive)?
 *  e.g. token "e177b" matches "T-E177B-04" but not "T-E177-04". */
export function idCarriesTicketToken(id, token) {
    if (!token)
        return false;
    return id.toLowerCase().split(/[^a-z0-9]+/).includes(token.toLowerCase());
}
/** One path segment that cannot escape `qa_reports/archive/` (no separator,
 *  no NUL, not "." / ".."). Kept local rather than lane-paths'
 *  `isSafeLaneName` because that guard rejects dots, and dot-named archive
 *  dirs such as `wave1.5-content-catchup` exist. */
function isSafeArchiveSegment(s) {
    return s !== "" && s !== "." && s !== ".." && !/[\\/\0]/.test(s);
}
/**
 * Task ids backed by a PASS-bearing evidence file in `dir` (AC5b): each
 * `*.md` whose content carries a `— PASS — by qa-engineer` section header
 * contributes its own `review_<id>.md` id plus every id its `covers:` line
 * names (tools/evidence-file.ts `parseCoversIds`). A FAIL-only file
 * contributes nothing. Not `buildCoverageIndex`: its first-seen-wins map
 * would hide a later PASS file covering an id a FAIL-only file covered first.
 * Never throws — an unlistable dir or unreadable file reads as no evidence.
 */
function passEvidenceIdsIn(dir) {
    const ids = new Set();
    let entries;
    try {
        entries = fs.readdirSync(dir);
    }
    catch {
        return ids;
    }
    for (const name of entries.sort()) {
        if (!name.toLowerCase().endsWith(".md"))
            continue;
        let content;
        try {
            content = fs.readFileSync(path.join(dir, name), "utf-8");
        }
        catch {
            continue;
        }
        if (!QA_PASS_HEADER_RE.test(content))
            continue;
        const m = REVIEW_FILE_RE.exec(name);
        if (m)
            ids.add(m[1]);
        for (const id of parseCoversIds(content))
            ids.add(id);
    }
    return ids;
}
/**
 * Ids voided in the lane's own task ledger (AC5d): `.current/<lane>/tasks.md`
 * (filename from tools/lane-paths.ts `laneFile("tasks")`) plus a legacy root
 * `tasks.md`. A voided id is never reusable (tools/tasks-file.ts refuses a
 * re-cut), so the union is safe. Read-only; an unsafe lane name is skipped.
 */
function voidedTaskIds(workspacePath, lane) {
    const voided = new Set();
    const tasksFile = laneFile("tasks").filename;
    const candidates = [path.join(workspacePath, tasksFile)];
    if (isSafeLaneName(lane))
        candidates.unshift(path.join(workspacePath, ".current", lane, tasksFile));
    for (const file of candidates) {
        let content;
        try {
            content = fs.readFileSync(file, "utf-8");
        }
        catch {
            continue;
        }
        for (const line of content.split(/\r?\n/)) {
            const m = VOIDED_ROW_RE.exec(line.trim());
            if (m)
                voided.add(m[1]);
        }
    }
    return voided;
}
/**
 * AC5 / AC5a-AC5d — independently count the task ids backed by qa evidence
 * on disk in one lane's worktree, and compare against the handoff's
 * completed_tasks. Never trusts the handoff's own count.
 *
 * Evidence sources: `qa_reports/*.md` and `qa_reports/archive/<feature>/*.md`
 * — each file's `review_<id>.md` id and its `covers:` ids. The SAME filters
 * apply to both directories; neither is ever scanned unfiltered (AC5a):
 *   - PASS-only (AC5b): a file with no `— PASS — by qa-engineer` round
 *     contributes nothing.
 *   - in scope: the id is in completed_tasks, OR carries the feature's ticket
 *     token as a delimited segment (`e177b-lane-status-tooling` → `e177b` →
 *     `T-E177B-04` in scope, `T-E125A-01` not). A worktree's `qa_reports/`
 *     holds every merged feature's evidence, and a release archive holds a
 *     whole wave's.
 *   - no token (AC5c): scoping falls back to completed_tasks membership
 *     alone, and the report states it (TOKEN_NOT_DERIVABLE_NOTE).
 *   - voided (AC5d): an id voided in the lane's own tasks ledger never counts.
 *     `lane` names that ledger (`.current/<lane>/`); computeLaneStatus passes
 *     the branch's lane (`feat/<id>-*` → id, else PRIMARY_LANE, mirroring
 *     the live resolver). Omitted, it defaults to the feature's ticket token,
 *     else PRIMARY_LANE.
 */
export function checkLaneEvidence(workspacePath, activeFeature, completedTasks, lane) {
    const qaDir = path.join(workspacePath, "qa_reports");
    const claimed = [...new Set(completedTasks)];
    const claimedSet = new Set(claimed);
    const token = featureTicketToken(activeFeature);
    const voided = voidedTaskIds(workspacePath, lane ?? token ?? PRIMARY_LANE);
    const inScope = (id) => claimedSet.has(id) || (token !== null && idCarriesTicketToken(id, token));
    const candidates = passEvidenceIdsIn(qaDir);
    let archiveNote;
    if (activeFeature && isSafeArchiveSegment(activeFeature)) {
        for (const id of passEvidenceIdsIn(path.join(qaDir, "archive", activeFeature)))
            candidates.add(id);
        archiveNote = `qa_reports/archive/${activeFeature}/`;
    }
    else {
        archiveNote = "no archive dir (feature id absent or not a safe path segment)";
    }
    const evidence = new Set();
    const excludedVoided = new Set();
    for (const id of candidates) {
        if (!inScope(id))
            continue;
        if (voided.has(id))
            excludedVoided.add(id);
        else
            evidence.add(id);
    }
    const evidenceIds = [...evidence].sort();
    const claimedWithoutEvidence = claimed.filter((id) => !evidence.has(id)).sort();
    const evidenceWithoutClaim = evidenceIds.filter((id) => !claimedSet.has(id));
    const filter = token !== null
        ? `PASS rounds, ids in completed_tasks or carrying ticket token "${token}", voided ids excluded`
        : "PASS rounds, ids in completed_tasks only (no ticket token), voided ids excluded";
    return {
        claimedIds: claimed,
        evidenceIds,
        claimedCount: claimed.length,
        evidenceCount: evidenceIds.length,
        claimedWithoutEvidence,
        evidenceWithoutClaim,
        mismatch: claimedWithoutEvidence.length > 0 || evidenceWithoutClaim.length > 0,
        ticketToken: token,
        excludedVoided: [...excludedVoided].sort(),
        scope: `qa_reports/ + ${archiveNote} (${filter})`,
    };
}
// ---------------------------------------------------------------------------
// Cut pre-review fan-in (E178b T-E178B-02, spec decision (g), AC10-AC15)
// ---------------------------------------------------------------------------
/** The lane-side mailbox file, as docs/lane-protocol.md §5 names it. */
export const LANE_TO_INTEGRATOR_FILE = "to-integrator.md";
// Same message-start line as scripts/mailbox-watch.mjs MSG_LINE_RE.
const MAILBOX_MSG_LINE_RE = /^--- msg(?:[ \t].*)?$/;
const MAILBOX_HEADER_RE = /^([a-z]+):\s?(.*)$/;
const CUT_RE_TOKEN_RE = /cut|預審/i;
/**
 * Header fields of every `--- msg` block, in file order — a minimal reader
 * kept at parity with scripts/mailbox-watch.mjs `parseMessageHeaders`
 * (pinned by test, AC14): a block opens at a `--- msg` line, its header
 * closes at the first bare `---` line, `<key>: <value>` lines inside the
 * header are captured, and the first occurrence of a key wins. tools/ cannot
 * import the script (tsconfig), hence the local copy. Objects are
 * null-prototype, so a header key such as `constructor` is captured rather
 * than shadowed.
 */
export function parseMailboxHeaders(text) {
    const out = [];
    if (!text)
        return out;
    let cur = null;
    for (const line of text.split(/\r?\n/)) {
        if (MAILBOX_MSG_LINE_RE.test(line)) {
            cur = Object.create(null);
            out.push(cur);
            continue;
        }
        if (cur === null)
            continue;
        if (line === "---") {
            cur = null; // header closed; body follows
            continue;
        }
        const m = MAILBOX_HEADER_RE.exec(line);
        if (m && !Object.hasOwn(cur, m[1]))
            cur[m[1]] = m[2];
    }
    return out;
}
/** Decision (g) recognizer: `type: proposal` whose `re:` contains `cut` or `預審`, any case. */
export function isCutPrereviewMessage(headers) {
    return (headers.type ?? "").trim() === "proposal" && CUT_RE_TOKEN_RE.test(headers.re ?? "");
}
function isDirectory(p) {
    try {
        return fs.statSync(p).isDirectory();
    }
    catch {
        return false;
    }
}
function isRegularFile(p) {
    try {
        return fs.statSync(p).isFile();
    }
    catch {
        return false;
    }
}
/**
 * Decision (g) — did a lane that has a written cut (`specs/<active_feature>.md`
 * in its worktree) send it for pre-review? Read-only; never throws. States:
 *   sent (to-integrator#<seq>) — first matching block;
 *   missing     — spec exists, no matching block (or the file is absent);
 *   no-mailbox  — spec exists, `<mailbox-root>/<lane>/` does not;
 *   n/a         — no spec;
 *   not-checked — lane unreadable, no active_feature, or a name that is not
 *                 a safe single path segment (never joined into a path).
 * Policy-neutral: whether a given lane must send a cut is E178a's decision.
 */
export function checkCutPrereview(input) {
    const notChecked = (reason) => ({
        state: "not-checked",
        text: "not-checked",
        specFile: null,
        mailboxFile: null,
        mailboxFileExists: false,
        reason,
    });
    const feature = input.activeFeature;
    if (!input.readable)
        return notChecked("lane handoff unreadable");
    if (feature === null || feature.trim() === "")
        return notChecked("no active_feature");
    if (!isSafeArchiveSegment(feature))
        return notChecked("active_feature is not a safe path segment");
    if (!isSafeArchiveSegment(input.lane))
        return notChecked("lane name is not a safe path segment");
    const root = path.resolve(input.mailboxRoot);
    const laneDir = path.join(root, input.lane);
    const mailboxFile = path.join(laneDir, LANE_TO_INTEGRATOR_FILE);
    const specFile = `specs/${feature}.md`;
    const base = { specFile, mailboxFile };
    if (!isRegularFile(path.join(input.workspacePath, "specs", `${feature}.md`))) {
        return { state: "n/a", text: "n/a", ...base, mailboxFileExists: isRegularFile(mailboxFile) };
    }
    if (!isDirectory(laneDir)) {
        return { state: "no-mailbox", text: `no-mailbox — ${laneDir}/ does not exist`, ...base, mailboxFileExists: false };
    }
    let text;
    try {
        text = fs.readFileSync(mailboxFile, "utf-8");
    }
    catch (err) {
        if (err && typeof err === "object" && err.code === "ENOENT") {
            return {
                state: "missing",
                text: `missing — ${specFile} exists but ${mailboxFile} has no cut proposal`,
                ...base,
                mailboxFileExists: false,
            };
        }
        return { ...notChecked(`cannot read ${mailboxFile}: ${errMessage(err).split(/\r?\n/)[0]}`), ...base };
    }
    const hit = parseMailboxHeaders(text).find(isCutPrereviewMessage);
    if (!hit) {
        return {
            state: "missing",
            text: `missing — ${specFile} exists but ${mailboxFile} has no cut proposal`,
            ...base,
            mailboxFileExists: true,
        };
    }
    const seq = (hit.seq ?? "").trim() || "?";
    return {
        state: "sent",
        text: `sent (to-integrator#${seq})`,
        ...base,
        mailboxFileExists: true,
        seq,
        re: (hit.re ?? "").trim(),
    };
}
// ---------------------------------------------------------------------------
// I/O: computeLaneStatus (AC1-AC3)
// ---------------------------------------------------------------------------
/**
 * Derive every sibling lane from `git worktree list` (via the lane-registry
 * provider — never a fan-out manifest, AC1) and, per lane, report the
 * handoff's active_feature/status/last_agent, `git log <base>..<branch>`,
 * `git status --porcelain`, round counters, and the evidence cross-check
 * (AC2, AC5). Never throws: provider failure, unreadable handoffs, and git
 * failures all degrade (AC3).
 */
export function computeLaneStatus(opts = {}) {
    const repoRoot = path.resolve(opts.repoRoot ?? process.cwd());
    const baseRef = opts.baseRef ?? "main";
    const provider = opts.laneListProvider ?? laneRegistryList;
    const readHandoff = opts.handoffReader ?? parseHandoff;
    const timeoutMs = opts.gitTimeoutMs ?? 15_000;
    let list;
    try {
        list = provider(repoRoot);
    }
    catch (err) {
        list = {
            source: "local-fallback",
            lanes: [],
            degraded: true,
            degradedReason: `lane list provider threw: ${errMessage(err)}`,
        };
    }
    let anyUnreadable = false;
    const lanes = list.lanes.map((info) => {
        const row = {
            workspacePath: info.workspacePath,
            lane: path.basename(info.workspacePath),
            laneId: laneIdFromBranch(info.branch),
            branch: info.branch,
            readable: info.readable,
            ...(info.readable
                ? {}
                : { reason: (info.error ?? "handoff could not be read (no reason given)").split(/\r?\n/)[0] }),
            activeFeature: info.activeFeature,
            status: info.status,
            lastAgent: info.lastAgent,
            lastUpdated: info.lastUpdated,
            hopCount: info.hopCount,
            reviewRound: null,
            qaRound: null,
            completedTasks: Array.isArray(info.completedTasks) ? [...info.completedTasks] : [],
            commits: { list: null, count: null },
            gitStatus: { clean: null, changedFiles: null },
            evidence: null,
        };
        if (row.readable) {
            try {
                const state = readHandoff(info.workspacePath);
                if (!state) {
                    row.readable = false;
                    row.reason = "handoff disappeared between lane listing and round read";
                }
                else if (typeof state.active_feature !== "string" || state.active_feature.trim() === "") {
                    // parseHandoff falls back to all-default fields for content with no
                    // parseable frontmatter (it does not throw) — a handoff naming no
                    // active_feature carries no usable state, so it is unreadable here
                    // (AC3), never a silently zero-filled row.
                    row.readable = false;
                    row.reason = "handoff has no active_feature (missing or unparseable frontmatter)";
                    row.activeFeature = null;
                    row.status = null;
                    row.lastAgent = null;
                    row.hopCount = null;
                    row.completedTasks = [];
                }
                else {
                    row.reviewRound = numOrNull(state.review_round);
                    row.qaRound = numOrNull(state.qa_round);
                    if (row.hopCount === null)
                        row.hopCount = numOrNull(state.hop_count);
                    if (!Array.isArray(info.completedTasks) && Array.isArray(state.completed_tasks)) {
                        row.completedTasks = [...state.completed_tasks];
                    }
                }
            }
            catch (err) {
                row.readable = false;
                row.reason = `handoff unparseable: ${errMessage(err).split(/\r?\n/)[0]}`;
            }
        }
        if (!row.readable)
            anyUnreadable = true;
        // AC2 — commit list vs base. Run from repoRoot: every worktree shares refs.
        if (row.branch === null) {
            row.commits = { list: null, count: null, error: "detached HEAD or unknown branch — no commit range" };
        }
        else {
            try {
                const out = runGit(["log", "--oneline", `${baseRef}..${row.branch}`, "--"], repoRoot, timeoutMs);
                const commitList = out.split(/\r?\n/).filter((l) => l.trim() !== "");
                row.commits = { list: commitList, count: commitList.length };
            }
            catch (err) {
                row.commits = { list: null, count: null, error: `git log failed: ${errMessage(err)}` };
            }
        }
        // AC2 — working-tree cleanliness, run inside the lane's own worktree.
        try {
            const out = runGit(["status", "--porcelain"], info.workspacePath, timeoutMs);
            const changed = out.split(/\r?\n/).filter((l) => l.trim() !== "").length;
            row.gitStatus = { clean: changed === 0, changedFiles: changed };
        }
        catch (err) {
            row.gitStatus = { clean: null, changedFiles: null, error: `git status failed: ${errMessage(err)}` };
        }
        // AC5 — evidence cross-check (readable lanes only: needs a feature id).
        if (row.readable) {
            row.evidence = checkLaneEvidence(info.workspacePath, row.activeFeature, row.completedTasks, row.laneId ?? PRIMARY_LANE);
        }
        // E178b decision (g) — cut pre-review fan-in, only when asked for.
        if (opts.mailboxRoot !== undefined) {
            row.cutPrereview = checkCutPrereview({
                workspacePath: info.workspacePath,
                lane: row.lane,
                activeFeature: row.activeFeature,
                readable: row.readable,
                mailboxRoot: opts.mailboxRoot,
            });
        }
        return row;
    });
    const degraded = list.degraded || anyUnreadable;
    const degradedReason = list.degraded
        ? list.degradedReason ?? "lane list degraded (no reason given)"
        : anyUnreadable
            ? "one or more lane handoffs are missing or unparseable (see per-lane reason)"
            : undefined;
    return {
        repoRoot,
        baseRef,
        source: list.source,
        lanes,
        degraded,
        ...(degradedReason !== undefined && { degradedReason }),
        listDegraded: list.degraded,
        ...(list.degraded && { listDegradedReason: list.degradedReason ?? "lane list degraded (no reason given)" }),
    };
}
// ---------------------------------------------------------------------------
// Pure: roll-ups (AC4-AC6)
// ---------------------------------------------------------------------------
function capCheck(metric, value) {
    const [capName, cap] = metric === "hop"
        ? ["HOP_CAP_EXPORTED", HOP_CAP_EXPORTED]
        : metric === "review_round"
            ? ["REVIEW_ROUND_CAP_EXPORTED", REVIEW_ROUND_CAP_EXPORTED]
            : ["ROUND_CAP_EXPORTED", ROUND_CAP_EXPORTED];
    return { metric, capName, cap, value, over: value > cap, atCap: value === cap };
}
function sumTotals(rows) {
    const add = (pick) => rows.reduce((s, r) => s + (pick(r) ?? 0), 0);
    return {
        tickets: rows.reduce((s, r) => s + r.completedTasks.length, 0),
        hop: add((r) => r.hopCount),
        reviewRounds: add((r) => r.reviewRound),
        qaRounds: add((r) => r.qaRound),
    };
}
function rowsToLaneInfo(rows) {
    return rows.map((r) => ({
        workspacePath: r.workspacePath,
        branch: r.branch,
        activeFeature: r.activeFeature,
        status: r.status,
        hopCount: r.hopCount,
        lastAgent: r.lastAgent,
        lastUpdated: r.lastUpdated,
        readable: r.readable,
        ...(r.reason !== undefined && { error: r.reason }),
        // Always an array for readable lanes so computeFeatureRollup never falls
        // back to its own parseHandoff re-read (keeps this function pure).
        completedTasks: r.completedTasks,
    }));
}
/**
 * AC4 — same-feature roll-up: sum tickets / hop / review+qa rounds over the
 * lanes whose active_feature === featureId and compare each total against
 * its cap (imported constant, never hardcoded). Hop/ticket totals and the
 * attribution/degrade rules come from tools/feature-rollup.ts's
 * computeFeatureRollup, fed this report's lane list (no re-derivation);
 * only its totals and degrade verdict are kept.
 * AC5 — lanes whose evidence cross-check mismatches are collected.
 */
export function rollupSameFeature(report, featureId) {
    const laneInfos = rowsToLaneInfo(report.lanes);
    const base = computeFeatureRollup(featureId, {
        repoRoot: report.repoRoot,
        laneListProvider: () => ({
            source: report.source,
            lanes: laneInfos,
            degraded: report.degraded,
            ...(report.degradedReason !== undefined && { degradedReason: report.degradedReason }),
        }),
    });
    const matchingLanes = report.lanes.filter((r) => r.activeFeature === featureId);
    // One source per total: tickets/hop are computeFeatureRollup's (same
    // active_feature === featureId attribution); review/qa rounds — which
    // LaneInfo does not carry — are summed here.
    const rounds = sumTotals(matchingLanes);
    const totals = {
        tickets: base.totals.ticketCount,
        hop: base.totals.hopCount,
        reviewRounds: rounds.reviewRounds,
        qaRounds: rounds.qaRounds,
    };
    const capChecks = [
        capCheck("hop", totals.hop),
        capCheck("review_round", totals.reviewRounds),
        capCheck("qa_round", totals.qaRounds),
    ];
    const evidenceMismatches = matchingLanes.filter((r) => r.evidence?.mismatch === true);
    return {
        mode: "feature",
        featureId,
        matchingLanes,
        allLanes: report.lanes,
        totals,
        capChecks,
        evidenceMismatches,
        degraded: base.degraded,
        ...(base.degradedReason !== undefined && { degradedReason: base.degradedReason }),
    };
}
/** Does a lane answer to `name`? Worktree basename, branch lane id, or branch. */
export function laneMatchesName(row, name) {
    const n = name.trim().toLowerCase();
    if (!n)
        return false;
    return (row.lane.toLowerCase() === n ||
        (row.laneId !== null && row.laneId === n) ||
        (row.branch !== null && row.branch.toLowerCase() === n));
}
/**
 * AC6 — cross-feature (wave-level) roll-up over explicitly named lanes (or
 * every lane with `{ all: true }`), REGARDLESS of each lane's own
 * active_feature. Caps are evaluated per lane only; the combined total is
 * informational and never compared against any cap.
 */
export function rollupAcrossLanes(report, selection) {
    let lanes;
    const missing = [];
    if ("all" in selection) {
        lanes = [...report.lanes];
    }
    else {
        lanes = [];
        for (const name of selection.lanes) {
            const hit = report.lanes.find((r) => laneMatchesName(r, name));
            if (!hit)
                missing.push(name);
            else if (!lanes.includes(hit))
                lanes.push(hit);
        }
    }
    const distinctFeatures = [...new Set(lanes.map((r) => r.activeFeature ?? "(none)"))];
    const perLaneCaps = lanes.map((r) => ({
        lane: r.lane,
        activeFeature: r.activeFeature,
        checks: [
            capCheck("hop", r.hopCount ?? 0),
            capCheck("review_round", r.reviewRound ?? 0),
            capCheck("qa_round", r.qaRound ?? 0),
        ],
    }));
    const unreadable = lanes.filter((r) => !r.readable);
    // Only degradation that touches the SELECTED lanes counts: the lane-list
    // derivation itself, a named lane that was not found, or a selected lane
    // that is unreadable. An unreadable lane outside --lanes does not.
    const reasons = [];
    if (report.listDegraded)
        reasons.push(report.listDegradedReason ?? "lane list degraded");
    if (missing.length > 0)
        reasons.push(`lane(s) not found: ${missing.join(", ")}`);
    if (unreadable.length > 0) {
        reasons.push(`${unreadable.length} selected lane(s) unreadable: ${unreadable.map((r) => r.lane).join(", ")}`);
    }
    if (lanes.length === 0)
        reasons.push("no lanes selected");
    const degraded = reasons.length > 0;
    return {
        mode: "cross",
        lanes,
        missing,
        distinctFeatures,
        perLaneCaps,
        combined: sumTotals(lanes),
        evidenceMismatches: lanes.filter((r) => r.evidence?.mismatch === true),
        degraded,
        ...(degraded && { degradedReason: reasons.join("; ") || "roll-up degraded (unspecified reason)" }),
    };
}
// ---------------------------------------------------------------------------
// Pure: rendering
// ---------------------------------------------------------------------------
function show(v) {
    return v === null || v === undefined || v === "" ? "-" : String(v);
}
function gitStatusCell(g) {
    if (g.clean === null)
        return "unknown";
    return g.clean ? "clean" : `dirty (${g.changedFiles} file${g.changedFiles === 1 ? "" : "s"})`;
}
/** AC5c note line for a lane whose feature yields no ticket token, else null. */
function tokenNoteLine(r) {
    return r.evidence && r.evidence.ticketToken === null ? `[${r.lane}] ${TOKEN_NOT_DERIVABLE_NOTE}` : null;
}
function evidenceLine(r) {
    const e = r.evidence;
    if (!e || !e.mismatch)
        return null;
    const parts = [
        `EVIDENCE MISMATCH [${r.lane}]: handoff completed_tasks = ${e.claimedCount}, evidence-backed ids on disk = ${e.evidenceCount}`,
    ];
    if (e.evidenceWithoutClaim.length > 0)
        parts.push(`evidence not claimed: ${e.evidenceWithoutClaim.join(", ")}`);
    if (e.claimedWithoutEvidence.length > 0)
        parts.push(`claimed without evidence: ${e.claimedWithoutEvidence.join(", ")}`);
    return parts.join(" — ");
}
function capLine(c, subject) {
    if (c.over) {
        return `OVER CAP: ${subject} ${c.metric} ${c.value} exceeds ${c.capName} = ${c.cap} (over by ${c.value - c.cap})`;
    }
    if (c.atCap)
        return `AT CAP: ${subject} ${c.metric} ${c.value} equals ${c.capName} = ${c.cap}`;
    return null;
}
/** AC1-AC3 — plain lane status listing. */
export function renderLaneStatus(report) {
    const out = [];
    if (report.degraded) {
        out.push(`LANE STATUS DEGRADED — ${report.degradedReason ?? "unspecified reason"}`);
        out.push("");
    }
    out.push(`Lane status — ${report.lanes.length} lane(s), source: ${report.source}, base: ${report.baseRef}`);
    out.push("");
    if (report.lanes.length === 0) {
        out.push("(no lanes found)");
        return out.join("\n");
    }
    out.push("lane | branch | active_feature | status | last_agent | hop | commits | worktree");
    out.push("--- | --- | --- | --- | --- | --- | --- | ---");
    for (const r of report.lanes) {
        out.push([
            r.lane,
            show(r.branch),
            r.readable ? show(r.activeFeature) : "(unreadable)",
            show(r.status),
            show(r.lastAgent),
            show(r.hopCount),
            show(r.commits.count),
            gitStatusCell(r.gitStatus),
        ].join(" | "));
    }
    for (const r of report.lanes) {
        const notes = [];
        if (!r.readable)
            notes.push(`  handoff unreadable: ${r.reason}`);
        if (r.commits.error)
            notes.push(`  commits: ${r.commits.error}`);
        else if (r.commits.list && r.commits.list.length > 0) {
            for (const c of r.commits.list)
                notes.push(`  ${c}`);
        }
        if (r.gitStatus.error)
            notes.push(`  status: ${r.gitStatus.error}`);
        if (r.evidence && r.evidence.ticketToken === null)
            notes.push(`  ${TOKEN_NOT_DERIVABLE_NOTE}`);
        const ev = evidenceLine(r);
        if (ev)
            notes.push(`  ${ev}`);
        if (r.cutPrereview)
            notes.push(`  cut pre-review: ${r.cutPrereview.text}`);
        if (notes.length > 0) {
            out.push("");
            out.push(`[${r.lane}] ${r.workspacePath}`);
            out.push(...notes);
        }
    }
    return out.join("\n");
}
/** AC4/AC5 — same-feature roll-up report. */
export function renderSameFeatureRollup(r) {
    const out = [];
    const readable = r.allLanes.filter((l) => l.readable).length;
    if (r.degraded) {
        out.push(`ROLL-UP INCOMPLETE — ${readable} of ${r.allLanes.length} lane(s) readable; totals below are NOT a verified feature total.`);
        out.push(`Reason: ${r.degradedReason ?? "unspecified"}`);
        out.push("");
    }
    out.push(`Feature roll-up: ${r.featureId} — ${r.matchingLanes.length} of ${r.allLanes.length} lane(s) match`);
    out.push("");
    out.push("lane | active_feature | status | tickets | hop | review_round | qa_round | evidence | matches");
    out.push("--- | --- | --- | --- | --- | --- | --- | --- | ---");
    for (const l of r.allLanes) {
        out.push([
            l.lane,
            l.readable ? show(l.activeFeature) : "(unreadable)",
            show(l.status),
            l.completedTasks.length,
            show(l.hopCount),
            show(l.reviewRound),
            show(l.qaRound),
            l.evidence ? `${l.evidence.evidenceCount}` : "-",
            l.activeFeature === r.featureId,
        ].join(" | "));
    }
    out.push("");
    const t = r.totals;
    out.push(`Totals (matching lanes only) — tickets: ${t.tickets}, hop: ${t.hop} (cap ${HOP_CAP_EXPORTED}), review_round: ${t.reviewRounds} (cap ${REVIEW_ROUND_CAP_EXPORTED}), qa_round: ${t.qaRounds} (cap ${ROUND_CAP_EXPORTED})`);
    for (const l of r.matchingLanes) {
        const note = tokenNoteLine(l);
        if (note)
            out.push(note);
        const ev = evidenceLine(l);
        if (ev)
            out.push(ev);
    }
    const capLines = r.capChecks.map((c) => capLine(c, "feature total")).filter((x) => x !== null);
    out.push(...capLines);
    if (r.degraded) {
        out.push("VERDICT: undetermined — resolve the issue above (see Reason) and re-run.");
    }
    else if (r.capChecks.some((c) => c.over)) {
        out.push("VERDICT: OVER CAP — surface to the human before declaring the feature closed. Reporting only: per-lane caps remain authoritative for each lane (E109).");
    }
    else if (r.evidenceMismatches.length > 0) {
        out.push("VERDICT: within cap, but handoff completed_tasks disagrees with on-disk evidence — reconcile before closing.");
    }
    else {
        out.push("VERDICT: within cap; completed_tasks agrees with on-disk evidence for every matching lane.");
    }
    return out.join("\n");
}
export const CROSS_FEATURE_BANNER = [
    "CROSS-FEATURE ROLL-UP — the lanes below carry their own (possibly different) active_feature values; the sum spans features.",
    "Caps are evaluated PER LANE — never a shared cap across differing features.",
    "The combined total is informational only; it is not compared against any cap.",
];
/** AC6 — cross-feature (wave-level) roll-up report. */
export function renderCrossLaneRollup(r) {
    const out = [];
    if (r.degraded) {
        out.push(`ROLL-UP INCOMPLETE — ${r.degradedReason ?? "unspecified reason"}`);
        out.push("");
    }
    out.push(...CROSS_FEATURE_BANNER);
    out.push(`Features spanned (${r.distinctFeatures.length}): ${r.distinctFeatures.join(", ")}`);
    out.push("");
    out.push("lane | active_feature | status | tickets | hop | review_round | qa_round | evidence");
    out.push("--- | --- | --- | --- | --- | --- | --- | ---");
    for (const l of r.lanes) {
        out.push([
            l.lane,
            l.readable ? show(l.activeFeature) : "(unreadable)",
            show(l.status),
            l.completedTasks.length,
            show(l.hopCount),
            show(l.reviewRound),
            show(l.qaRound),
            l.evidence ? `${l.evidence.evidenceCount}` : "-",
        ].join(" | "));
    }
    for (const name of r.missing)
        out.push(`${name} | (lane not found) | - | - | - | - | - | -`);
    out.push("");
    const c = r.combined;
    out.push(`Combined total (informational only, not capped) — tickets: ${c.tickets}, hop: ${c.hop}, review_round: ${c.reviewRounds}, qa_round: ${c.qaRounds}`);
    const perLane = [];
    for (const p of r.perLaneCaps) {
        for (const check of p.checks) {
            const line = capLine(check, `lane ${p.lane} (${p.activeFeature ?? "no feature"})`);
            if (line)
                perLane.push(line);
        }
    }
    out.push(...perLane);
    for (const l of r.lanes) {
        const note = tokenNoteLine(l);
        if (note)
            out.push(note);
    }
    for (const l of r.evidenceMismatches) {
        const ev = evidenceLine(l);
        if (ev)
            out.push(ev);
    }
    if (perLane.length === 0 && r.evidenceMismatches.length === 0 && !r.degraded) {
        out.push("Per-lane caps: every lane within its own caps; evidence agrees with completed_tasks.");
    }
    return out.join("\n");
}
// ---------------------------------------------------------------------------
// CLI (scripts/lane-status.mjs is a thin shell over this)
// ---------------------------------------------------------------------------
export const LANE_STATUS_USAGE = [
    "Usage: node scripts/lane-status.mjs [options]",
    "  (no mode)                 list every lane: handoff state + git log/status",
    "  --rollup <feature-id>     same-feature roll-up vs caps + evidence cross-check",
    "  --lanes <a,b,...>         cross-feature roll-up over the named lanes",
    "  --all                     cross-feature roll-up over every lane",
    "  --base <ref>              commit-range base (default: main)",
    "  --repo <path>             repo/worktree to derive lanes from (default: cwd)",
    "  --json                    emit the computed object as JSON",
    "  --watch                   stream one line per lane handoff-state change until the deadline",
    "                            (with --lanes: watch only the named lanes; exit 3 = re-arm)",
    "  --interval <s>            --watch poll interval in seconds (default: 30)",
    "  --deadline <min>          --watch deadline in minutes (default: 29)",
    "  --baseline <lane>=<fp>,...  --watch: state fingerprints printed by the previous watch's re-arm command",
    "  --mailbox-root <dir>      lane listing / --watch: report each lane's cut pre-review state",
    "                            (a spec/<active_feature>.md with no cut proposal in <dir>/<lane>/to-integrator.md)",
].join("\n");
function positiveInt(value, flag, unit) {
    if (!/^\d+$/.test(value) || Number(value) <= 0 || !Number.isSafeInteger(Number(value))) {
        throw new Error(`${flag} requires a positive integer (${unit})`);
    }
    return Number(value);
}
/** Parse argv (without node + script). Throws Error with a usage message. */
export function parseLaneStatusArgs(argv) {
    const args = { mode: "status", json: false };
    const takeValue = (i, flag) => {
        const v = argv[i + 1];
        if (v === undefined || v.startsWith("--"))
            throw new Error(`${flag} requires a value`);
        return v;
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        switch (a) {
            case "--rollup":
                args.featureId = takeValue(i, a);
                i++;
                break;
            case "--lanes":
                args.lanes = takeValue(i, a)
                    .split(",")
                    .map((s) => s.trim())
                    .filter((s) => s !== "");
                if (args.lanes.length === 0)
                    throw new Error("--lanes requires at least one lane name");
                i++;
                break;
            case "--all":
                args.all = true;
                break;
            case "--base":
                args.baseRef = takeValue(i, a);
                i++;
                break;
            case "--repo":
                args.repoRoot = takeValue(i, a);
                i++;
                break;
            case "--json":
                args.json = true;
                break;
            case "--watch":
                args.watch = true;
                break;
            case "--interval":
                args.intervalSeconds = positiveInt(takeValue(i, a), a, "seconds");
                i++;
                break;
            case "--deadline":
                args.deadlineMinutes = positiveInt(takeValue(i, a), a, "minutes");
                i++;
                break;
            case "--baseline":
                args.baseline = takeValue(i, a);
                i++;
                break;
            case "--mailbox-root":
                args.mailboxRoot = takeValue(i, a);
                i++;
                break;
            default:
                throw new Error(`unknown argument: ${a}`);
        }
    }
    if (args.watch) {
        // AC6 — --watch is its own mode; --lanes restricts the watched set.
        if (args.featureId !== undefined || args.all === true || args.json) {
            throw new Error("--watch cannot be combined with --rollup, --all or --json");
        }
        if (args.baseRef !== undefined)
            throw new Error("--base has no effect under --watch (a watch tick runs no git log)");
        args.mode = "watch";
        return args;
    }
    if (args.intervalSeconds !== undefined || args.deadlineMinutes !== undefined || args.baseline !== undefined) {
        throw new Error("--interval, --deadline and --baseline require --watch");
    }
    const modes = [args.featureId !== undefined, args.lanes !== undefined, args.all === true].filter(Boolean).length;
    if (modes > 1)
        throw new Error("--rollup, --lanes and --all are mutually exclusive");
    if (args.baseRef !== undefined && (args.baseRef.startsWith("-") || /\s/.test(args.baseRef))) {
        throw new Error("--base must be a plain ref name");
    }
    args.mode = args.featureId !== undefined ? "rollup" : args.lanes !== undefined || args.all ? "cross" : "status";
    if (args.mailboxRoot !== undefined && args.mode !== "status") {
        throw new Error("--mailbox-root applies only to the lane listing (no mode) and --watch");
    }
    return args;
}
/** Run the CLI end to end; returns what to print and the exit code. */
export function runLaneStatusCli(argv, opts = {}) {
    let args;
    try {
        args = parseLaneStatusArgs(argv);
    }
    catch (err) {
        return { output: `lane-status: ${errMessage(err)}\n${LANE_STATUS_USAGE}`, exitCode: 64, stream: "stderr" };
    }
    if (args.mode === "watch") {
        // The watch is async and streams; scripts/lane-status.mjs routes --watch
        // to runLaneWatch before this sync entry point is ever reached.
        return {
            output: `lane-status: --watch is served by runLaneWatch (node scripts/lane-status.mjs --watch)\n${LANE_STATUS_USAGE}`,
            exitCode: WATCH_EXIT_USAGE,
            stream: "stderr",
        };
    }
    const report = computeLaneStatus({
        ...opts,
        repoRoot: args.repoRoot,
        baseRef: args.baseRef,
        ...(args.mailboxRoot !== undefined && { mailboxRoot: args.mailboxRoot }),
    });
    if (args.mode === "rollup") {
        const r = rollupSameFeature(report, args.featureId);
        return { output: args.json ? JSON.stringify(r, null, 2) : renderSameFeatureRollup(r), exitCode: 0, stream: "stdout" };
    }
    if (args.mode === "cross") {
        const r = rollupAcrossLanes(report, args.all ? { all: true } : { lanes: args.lanes });
        return { output: args.json ? JSON.stringify(r, null, 2) : renderCrossLaneRollup(r), exitCode: 0, stream: "stdout" };
    }
    return { output: args.json ? JSON.stringify(report, null, 2) : renderLaneStatus(report), exitCode: 0, stream: "stdout" };
}
// ---------------------------------------------------------------------------
// Watch mode (E178b T-E178B-01, spec AC1-AC9, decisions (a)-(f), (j))
// ---------------------------------------------------------------------------
//
// A multi-lane polling event stream, the handoff-state twin of
// scripts/mailbox-watch.mjs's multi-file mode: it never exits on the first
// change, runs until the deadline, then prints `expiring — re-arm` plus a
// ready-to-run re-arm command carrying the fingerprint of every lane's state
// line AS THIS WATCH LAST READ IT (never a fresh read at expiry), so a
// transition landing between two watches still fires as
// `changed since last watch:` (decision (d)). Read-only, no watch lock
// (decision (e)).
/** Mirrors scripts/mailbox-watch.mjs `DEFAULT_DEADLINE_MINUTES` — tools/ cannot
 *  import scripts/*.mjs under the tsconfig, so the value is declared here and
 *  pinned equal by test (spec decision (f), AC8). */
export const WATCH_DEFAULT_DEADLINE_MINUTES = 29;
/** The prototype's 30 s (decision (f)); a handoff changes less often than a mailbox. */
export const WATCH_DEFAULT_INTERVAL_SECONDS = 30;
/** Mirrors mailbox-watch.mjs `EXIT_ERROR`. */
export const WATCH_EXIT_ERROR = 1;
/** Mirrors mailbox-watch.mjs `EXIT_EXPIRED`. */
export const WATCH_EXIT_EXPIRED = 3;
/** Mirrors mailbox-watch.mjs `EXIT_USAGE`. */
export const WATCH_EXIT_USAGE = 64;
/** Hex characters of sha256(state line) carried in --baseline (decision (d)). */
export const WATCH_FINGERPRINT_LENGTH = 12;
/** Watched keys, in state-line order (decision (c)). */
export const WATCH_STATE_KEYS = ["feature", "status", "last_agent", "next_role", "hop", "review_round", "qa_round"];
/** Decision (c)'s optional last key, present only under --mailbox-root. */
export const WATCH_PREREVIEW_KEY = "cut_prereview";
/** State line of a `--lanes`-named lane that matches no worktree. */
export const WATCH_GONE_STATE = "gone";
const FINGERPRINT_RE = new RegExp(`^[0-9a-f]{${WATCH_FINGERPRINT_LENGTH}}$`);
class WatchUsageError extends Error {
}
const defaultWatchIo = {
    out: (l) => {
        process.stdout.write(`${l}\n`);
    },
    err: (l) => {
        process.stderr.write(`${l}\n`);
    },
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};
function firstLine(s) {
    return s.split(/\r?\n/)[0].trim();
}
/** Display value of one watched handoff field: `-` when absent, whitespace
 *  folded to `_` so the state line stays one line of `key=value` tokens. */
function watchValue(v) {
    if (v === null || v === undefined)
        return "-";
    const s = String(v).trim();
    return s === "" ? "-" : s.replace(/\s+/g, "_");
}
/** The state line (Copy/Strings watch.state / watch.unreadable). */
export function formatWatchState(s) {
    if (s === null)
        return WATCH_GONE_STATE;
    if (!s.readable)
        return `unreadable (${s.reason ?? "no reason given"})`;
    return s.fields.map(([k, v]) => `${k}=${v}`).join(" ");
}
/** First WATCH_FINGERPRINT_LENGTH hex chars of sha256(state line) (decision (d)). */
export function watchFingerprint(stateLine) {
    return createHash("sha256").update(stateLine, "utf8").digest("hex").slice(0, WATCH_FINGERPRINT_LENGTH);
}
/** Keys whose values moved, in `next`'s key order. [] unless both are readable. */
export function diffWatchState(prev, next) {
    if (!prev.readable || !next.readable)
        return [];
    const before = new Map(prev.fields);
    return next.fields.filter(([k, v]) => before.get(k) !== v).map(([k]) => k);
}
/**
 * Read one lane's watched state from its lane-list entry + its handoff
 * (decision (b)). Never throws: every failure becomes `readable: false` with
 * a one-line reason (AC3). A handoff naming no active_feature is unreadable,
 * the same rule computeLaneStatus applies.
 */
export function readLaneWatchState(key, info, readHandoff, mailboxRoot) {
    const base = { lane: key, workspacePath: info.workspacePath };
    if (!info.readable) {
        return { ...base, readable: false, reason: firstLine(info.error ?? "handoff could not be read (no reason given)"), fields: [] };
    }
    let state;
    try {
        state = readHandoff(info.workspacePath);
    }
    catch (err) {
        return { ...base, readable: false, reason: `handoff unparseable: ${firstLine(errMessage(err))}`, fields: [] };
    }
    if (!state)
        return { ...base, readable: false, reason: "handoff not found", fields: [] };
    if (typeof state.active_feature !== "string" || state.active_feature.trim() === "") {
        return { ...base, readable: false, reason: "handoff has no active_feature (missing or unparseable frontmatter)", fields: [] };
    }
    const values = {
        feature: state.active_feature,
        status: state.status,
        last_agent: state.last_agent,
        next_role: state.next_role,
        hop: state.hop_count,
        review_round: state.review_round,
        qa_round: state.qa_round,
    };
    const fields = WATCH_STATE_KEYS.map((k) => [k, watchValue(values[k])]);
    if (mailboxRoot !== undefined) {
        // AC15 — decision (c)'s optional last key. Keyed by the worktree
        // basename (never a --lanes spelling) like the one-shot check.
        const check = checkCutPrereview({
            workspacePath: info.workspacePath,
            lane: path.basename(info.workspacePath),
            activeFeature: state.active_feature,
            readable: true,
            mailboxRoot,
        });
        // Folded like every other field so the state line stays single
        // `key=value` tokens; `sent` keeps its seq: `sent_(to-integrator#<seq>)`.
        fields.push([WATCH_PREREVIEW_KEY, watchValue(check.state === "sent" ? check.text : check.state)]);
    }
    return { ...base, readable: true, fields };
}
/**
 * Parse a --baseline value (`<lane>=<fp>,...`) against the watched keys
 * (e178b AC5). A repeated key, a malformed entry or an empty value is always
 * a usage error, and the whole value is validated before anything is printed.
 * An unknown key (one naming no watched lane) is a usage error unless
 * `unknownIsGone` is set — the default watch set (e223 decision (a)), where it
 * is a lane that closed since the last watch. Such keys are kept in the
 * returned map, in --baseline order, for the caller to report as gone; an
 * all-gone value is not empty (e223 decision (b)).
 */
export function parseWatchBaseline(value, keys, opts = {}) {
    const result = new Map();
    if (value === undefined)
        return result;
    for (const part of value.split(",")) {
        const p = part.trim();
        if (!p)
            continue;
        const eq = p.lastIndexOf("=");
        if (eq <= 0)
            throw new WatchUsageError(`bad --baseline entry "${p}" (expected <lane>=<fingerprint>,...)`);
        const k = p.slice(0, eq).trim();
        const fp = p.slice(eq + 1).trim();
        if (!FINGERPRINT_RE.test(fp)) {
            throw new WatchUsageError(`bad --baseline fingerprint for "${k}": "${fp}" (expected ${WATCH_FINGERPRINT_LENGTH} lowercase hex characters)`);
        }
        if (!opts.unknownIsGone && !keys.includes(k)) {
            throw new WatchUsageError(`--baseline key "${k}" names no watched lane (watching: ${keys.join(", ") || "none"})`);
        }
        if (result.has(k))
            throw new WatchUsageError(`--baseline key "${k}" given twice`);
        result.set(k, fp);
    }
    if (result.size === 0)
        throw new WatchUsageError("empty --baseline");
    return result;
}
/** Quote one argument for a POSIX shell only when it needs it (mailbox-watch.mjs `shellQuote`). */
function shellQuote(s) {
    if (/^[A-Za-z0-9_/.,:=@%+-]+$/.test(s))
        return s;
    return `'${s.replace(/'/g, `'\\''`)}'`;
}
/**
 * The ready-to-run re-arm command (Copy/Strings watch.rearm). `lastRead` is
 * [key, state line as last read] in watch order; non-default --interval /
 * --deadline and any given --lanes / --mailbox-root / --repo are carried
 * (AC4). No --baseline when nothing is watched (an empty one is a usage error).
 */
export function formatWatchRearmCommand(lastRead, a) {
    const parts = ["node", "scripts/lane-status.mjs", "--watch"];
    if (a.lanes !== undefined)
        parts.push("--lanes", shellQuote(a.lanes.join(",")));
    if (a.intervalSeconds !== WATCH_DEFAULT_INTERVAL_SECONDS)
        parts.push("--interval", String(a.intervalSeconds));
    if (a.deadlineMinutes !== WATCH_DEFAULT_DEADLINE_MINUTES)
        parts.push("--deadline", String(a.deadlineMinutes));
    if (a.mailboxRoot !== undefined)
        parts.push("--mailbox-root", shellQuote(a.mailboxRoot));
    if (a.repoRoot !== undefined)
        parts.push("--repo", shellQuote(a.repoRoot));
    if (lastRead.length > 0) {
        parts.push("--baseline", shellQuote(lastRead.map(([k, line]) => `${k}=${watchFingerprint(line)}`).join(",")));
    }
    return parts.join(" ");
}
/**
 * AC7 — one tick: the lane-list provider + one handoff read per lane, and
 * nothing else. A provider that throws, or a degraded list with zero lanes
 * (git failure), is "list unavailable" — never read as every lane gone.
 * Keys are worktree basenames; a second worktree with the same basename is
 * reported once on stderr and skipped (never merged or overwritten).
 */
function readWatchTick(repoRoot, provider, readHandoff, mailboxRoot, dupReported, err) {
    let list;
    try {
        list = provider(repoRoot);
    }
    catch (e) {
        return { ok: false, reason: `lane list provider threw: ${firstLine(errMessage(e))}` };
    }
    if (list.degraded && list.lanes.length === 0) {
        return { ok: false, reason: firstLine(list.degradedReason ?? "lane list degraded (no reason given)") };
    }
    const lanes = new Map();
    for (const info of list.lanes) {
        const key = path.basename(info.workspacePath);
        const existing = lanes.get(key);
        if (existing) {
            if (!dupReported.has(key)) {
                dupReported.add(key);
                err(`lane-status: duplicate lane key "${key}": ${existing.workspacePath} and ${info.workspacePath} — watching only the first`);
            }
            continue;
        }
        lanes.set(key, readLaneWatchState(key, info, readHandoff, mailboxRoot));
    }
    return { ok: true, lanes };
}
/** Case-insensitive worktree-basename lookup for a `--lanes` name (AC6). */
function findNamedLane(tick, name) {
    const n = name.toLowerCase();
    for (const [k, s] of tick)
        if (k.toLowerCase() === n)
            return { ...s, lane: name };
    return null;
}
async function watchLoop(args, io, provider, readHandoff) {
    const repoRoot = path.resolve(args.repoRoot ?? process.cwd());
    const intervalSeconds = args.intervalSeconds ?? WATCH_DEFAULT_INTERVAL_SECONDS;
    const deadlineMinutes = args.deadlineMinutes ?? WATCH_DEFAULT_DEADLINE_MINUTES;
    const named = args.lanes;
    const mailboxRoot = args.mailboxRoot !== undefined ? path.resolve(args.mailboxRoot) : undefined;
    const dupReported = new Set();
    const first = readWatchTick(repoRoot, provider, readHandoff, mailboxRoot, dupReported, io.err);
    if (!first.ok) {
        io.err(`lane-status: cannot start watch — lane list unavailable: ${first.reason}`);
        return WATCH_EXIT_ERROR;
    }
    // Watched set: the named lanes (kept even while absent), else every lane
    // in the list (lanes join/leave as the list changes).
    const keys = named ? [...new Set(named)] : [...first.lanes.keys()];
    // Under --lanes an unknown key can only be a typo (absent named lanes stay
    // watched); in the default set it is a lane closed since the last watch
    // (e223 decision (a)). Exact match only (decision (f)).
    const baselines = parseWatchBaseline(args.baseline, keys, { unknownIsGone: !named }); // throws WatchUsageError
    // e223 decisions (c)-(e): gone keys are reported once after the watched-lane
    // start lines, in --baseline order; never counted in `armed:`, never
    // tracked in `last`, so the next re-arm --baseline omits them.
    const goneKeys = named ? [] : [...baselines.keys()].filter((k) => !keys.includes(k));
    const last = new Map();
    io.out(`armed: watching ${keys.length} lane(s) — interval ${intervalSeconds}s, deadline ${deadlineMinutes} min`);
    for (const key of keys) {
        const s = named ? findNamedLane(first.lanes, key) : (first.lanes.get(key) ?? null);
        last.set(key, s);
        const line = formatWatchState(s);
        const fp = baselines.get(key);
        if (fp !== undefined && fp !== watchFingerprint(line)) {
            io.out(`[${key}] changed since last watch: ${line}`);
        }
        else if (s === null) {
            io.out(`[${key}] gone`);
        }
        else {
            io.out(`[${key}] baseline: ${line}`);
        }
    }
    for (const key of goneKeys)
        io.out(`[${key}] gone`);
    const deadlineAt = io.now() + deadlineMinutes * 60_000;
    const intervalMs = intervalSeconds * 1000;
    for (;;) {
        await io.sleep(Math.max(0, Math.min(intervalMs, deadlineAt - io.now())));
        // Expiry is checked BEFORE any fresh read: the re-arm fingerprints are
        // the states this watch last READ (decision (d), mailbox-watch AC16).
        if (io.now() >= deadlineAt) {
            io.out("expiring — re-arm");
            io.out(formatWatchRearmCommand([...last].map(([k, s]) => [k, formatWatchState(s)]), {
                ...(named && { lanes: keys }),
                intervalSeconds,
                deadlineMinutes,
                ...(mailboxRoot !== undefined && { mailboxRoot }),
                ...(args.repoRoot !== undefined && { repoRoot }),
            }));
            return WATCH_EXIT_EXPIRED;
        }
        const tick = readWatchTick(repoRoot, provider, readHandoff, mailboxRoot, dupReported, io.err);
        if (!tick.ok) {
            io.err(`lane-status: lane list unavailable this tick: ${tick.reason} (keeping last states)`);
            continue;
        }
        const order = named ? keys : [...new Set([...last.keys(), ...tick.lanes.keys()])];
        for (const key of order) {
            const had = last.has(key);
            const prev = last.get(key) ?? null;
            const next = named ? findNamedLane(tick.lanes, key) : (tick.lanes.get(key) ?? null);
            if (next === null) {
                if (had && prev !== null)
                    io.out(`[${key}] gone`);
                // Default set: a gone lane leaves the watched set and the re-arm
                // baseline, so it is reported gone once (e223 decision (e)). Named: kept.
                if (named)
                    last.set(key, null);
                else
                    last.delete(key);
                continue;
            }
            last.set(key, next);
            if (prev === null) {
                io.out(`[${key}] appeared: ${formatWatchState(next)}`);
                continue;
            }
            const before = formatWatchState(prev);
            const after = formatWatchState(next);
            if (before === after)
                continue; // only non-watched fields moved (AC2)
            const delta = diffWatchState(prev, next);
            io.out(delta.length > 0 ? `[${key}] changed: ${after} — Δ ${delta.join(",")}` : `[${key}] changed: ${after}`);
        }
    }
}
/**
 * AC1-AC9 — `lane-status --watch` end to end. Resolves to the exit code:
 * WATCH_EXIT_EXPIRED at the deadline, WATCH_EXIT_USAGE on a usage error,
 * WATCH_EXIT_ERROR on a runtime error. Never rejects.
 */
export async function runLaneWatch(argv, opts = {}) {
    const io = { ...defaultWatchIo, ...opts.io };
    let args;
    try {
        args = parseLaneStatusArgs(argv);
    }
    catch (err) {
        io.err(`lane-status: ${errMessage(err)}\n${LANE_STATUS_USAGE}`);
        return WATCH_EXIT_USAGE;
    }
    if (args.mode !== "watch") {
        io.err(`lane-status: runLaneWatch requires --watch\n${LANE_STATUS_USAGE}`);
        return WATCH_EXIT_USAGE;
    }
    try {
        return await watchLoop(args, io, opts.laneListProvider ?? laneRegistryList, opts.handoffReader ?? parseHandoff);
    }
    catch (err) {
        if (err instanceof WatchUsageError) {
            io.err(`lane-status: ${err.message}\n${LANE_STATUS_USAGE}`);
            return WATCH_EXIT_USAGE;
        }
        io.err(`lane-status: ${errMessage(err)}`);
        return WATCH_EXIT_ERROR;
    }
}
//# sourceMappingURL=lane-status.js.map