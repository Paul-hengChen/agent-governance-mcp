// Coded by @sr-engineer
// AC-Execution-Log gate predicates: a spec that declares `proof:` commands cannot
// PASS until QA logs running them under a `## AC Execution Log` H2 in
// qa_reports/review_<id>.md. Arms on the spec file, not a handoff field. Checks
// existence only: never runs the commands or judges their output. File mode only.
// Design: specs/e3-outcome-shaped-acceptance-architecture.md.
import * as fs from "fs";
import * as path from "path";
import { sliceH2SectionAt, buildCoverageIndex, encodeEvidenceId, resolveJudgeReport, normalizeHeadingText, } from "../tools/evidence-file.js";
import { parseTicketFile } from "../tools/ticket-file.js";
import { resolveTicketDir } from "../tools/config.js";
// The H2 heading qa-engineer's Phase 3.5 writes (skill-qa-engineer SOP 6a).
const DISPOSITION_HEADING = "AC Execution Log";
// Arm regex: a line whose first non-whitespace token is `proof:` (case-insensitive,
// whitespace allowed around the colon). Per-line anchor with newline-free
// whitespace classes, so mid-line "proof:" prose never arms.
const PROOF_LINE_RE = /^[^\S\n]*proof[^\S\n]*:/im;
function judgeReportDir(workspacePath) {
    return resolveJudgeReport(workspacePath).dir;
}
// Same sanitiser as expectedRedManifestPath: replace disallowed chars and collapse
// `..` runs to `_`, so a hostile feature name cannot form a traversal path.
export function specFilePath(workspacePath, activeFeature) {
    const safe = activeFeature
        .replace(/[^A-Za-z0-9._-]/g, "_")
        .replace(/\.\.+/g, "_");
    return path.join(workspacePath, "specs", `${safe}.md`);
}
// Mirrors gates/qa-review.ts evidencePath (same dir, same encodeEvidenceId stem).
function reviewPath(workspacePath, taskId) {
    return path.join(judgeReportDir(workspacePath), `review_${encodeEvidenceId(taskId)}.md`);
}
// Arm check: armed iff specs/<feature>.md exists and has >= 1 proof: line; a
// missing file or no proof: line leaves it dormant (absence is non-blocking).
// Never throws (fs errors give armed: false). Returns the spec path for errors.
export function hasProofAnnotatedAC(workspacePath, activeFeature) {
    const specPath = specFilePath(workspacePath, activeFeature);
    if (!activeFeature)
        return { armed: false, specPath };
    let content;
    try {
        content = fs.readFileSync(specPath, "utf-8");
    }
    catch {
        return { armed: false, specPath };
    }
    return { armed: PROOF_LINE_RE.test(content), specPath };
}
// Disposition: true iff a candidate review file for the PASS'd ids has the H2
// (match per the evidence-schema pin). Per id: direct review_<id>.md, then its
// `covers:` file when the direct one is missing or lacks the H2 (index built
// lazily, once per call). Never throws. Same traversal as expected-red.
export function hasAcExecutionLogDisposition(workspacePath, taskIds, evidenceSchema) {
    const located = locateAcExecutionLog(workspacePath, taskIds, evidenceSchema);
    return { present: located.content !== null, checkedPaths: located.checkedPaths };
}
// Shared traversal behind hasAcExecutionLogDisposition and the ticket path.
function locateAcExecutionLog(workspacePath, taskIds, evidenceSchema) {
    const dir = judgeReportDir(workspacePath);
    let coverage = null;
    const checked = new Set();
    const checkedPaths = [];
    const headingContent = (file) => {
        if (checked.has(file))
            return null;
        checked.add(file);
        checkedPaths.push(file);
        try {
            const content = fs.readFileSync(file, "utf-8");
            return sliceH2SectionAt(content, DISPOSITION_HEADING, evidenceSchema) !== null ? content : null;
        }
        catch {
            return null;
        }
    };
    for (const id of taskIds) {
        const direct = reviewPath(workspacePath, id);
        const directExists = fs.existsSync(direct);
        if (directExists) {
            const content = headingContent(direct);
            if (content !== null)
                return { content, checkedPaths };
        }
        if (coverage === null)
            coverage = buildCoverageIndex(dir);
        const covering = coverage.get(id);
        if (covering !== undefined) {
            const content = headingContent(path.join(dir, covering));
            if (content !== null)
                return { content, checkedPaths };
        }
        else if (!directExists && !checked.has(direct)) {
            // Nothing on disk for this id: record where the server looked.
            checked.add(direct);
            checkedPaths.push(direct);
        }
    }
    return { content: null, checkedPaths };
}
// ---------------------------------------------------------------------------
// Ticket path: when the spec cites a ticket file, every scenario verified by a
// test or a command needs a passing acceptance-record entry. Reads the spec, the
// config, the cited ticket and judge reports only; runs nothing.
// ---------------------------------------------------------------------------
// Static tail of the ticket-path rejection (kept here so hintStatic is unchanged).
export const AC_TICKET_HINT = "Under ## AC Execution Log in a qa_reports/review_<id>.md for one of the PASS'd ids (covers: files count), " +
    "write one line per ticket scenario: \"- <scenario id> — <command or test> — <outcome or exit code> — pass\" " +
    "(or \"— fail\"). Every scenario verified by a test or a command needs a line ending in \"— pass\"; " +
    "device-or-person scenarios are listed for manual verification and never block. The server reads the record " +
    "and the ticket file only and runs nothing; whether each outcome is true stays with the judge.";
const TICKET_LINE_RE = /^[^\S\n]*ticket[^\S\n]*:[^\S\n]*(.*)$/i;
const ENTRY_SEPARATOR_RE = /[ \t]+—[ \t]+/;
const DRIVE_PREFIX_RE = /^[A-Za-z]:/;
function isFenceDelimiter(line) {
    const t = line.trim();
    return t.startsWith("```") || t.startsWith("~~~");
}
// Lines outside fenced code blocks; the delimiter lines themselves are dropped.
function unfencedLines(text) {
    const out = [];
    let inFence = false;
    for (const line of text.split("\n")) {
        if (isFenceDelimiter(line)) {
            inFence = !inFence;
            continue;
        }
        if (!inFence)
            out.push(line);
    }
    return out;
}
// Backtick-quoted path (no closing backtick: none), else the first bare token.
function citationToken(remainder) {
    if (remainder.startsWith("`")) {
        const close = remainder.indexOf("`", 1);
        return close === -1 ? "" : remainder.slice(1, close);
    }
    const m = /^\S+/.exec(remainder);
    return m ? m[0] : "";
}
// Ticket citations: a line-leading `Ticket:` followed by a relative .md path that
// lies strictly inside the configured ticket directory (lexical check only).
// Returned repo-root-relative with "/" separators, deduplicated, in document order.
export function findTicketCitations(workspacePath, specContent) {
    const ticketDir = resolveTicketDir(workspacePath);
    const out = [];
    for (const line of unfencedLines(specContent)) {
        const m = TICKET_LINE_RE.exec(line.replace(/\r$/, ""));
        if (!m)
            continue;
        const token = citationToken(m[1]);
        if (token === "" || path.isAbsolute(token) || DRIVE_PREFIX_RE.test(token) || !token.endsWith(".md"))
            continue;
        const resolved = path.resolve(workspacePath, token);
        const rel = path.relative(ticketDir, resolved);
        if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel))
            continue;
        const cited = path.relative(workspacePath, resolved).replace(/\\/g, "/");
        if (!out.includes(cited))
            out.push(cited);
    }
    return out;
}
// Body of the LAST `## AC Execution Log` H2 (same heading rule as the evidence
// reader's schema-keyed lookup), up to the next `## ` heading or EOF; null if none.
export function sliceLastAcExecutionLog(content, evidenceSchema) {
    let bodyStart = -1;
    if (evidenceSchema === 1) {
        const re = /^##\s+AC Execution Log\b[^\n]*/gim;
        let m;
        while ((m = re.exec(content)) !== null)
            bodyStart = m.index + m[0].length;
    }
    else {
        const target = normalizeHeadingText(DISPOSITION_HEADING);
        const re = /^##[ \t]+(.+)$/gm;
        let m;
        while ((m = re.exec(content)) !== null) {
            if (normalizeHeadingText(m[1]).includes(target))
                bodyStart = m.index + m[0].length;
        }
    }
    if (bodyStart === -1)
        return null;
    const rest = content.slice(bodyStart);
    const nextIdx = rest.search(/\n##\s/);
    return nextIdx === -1 ? rest : rest.slice(0, nextIdx);
}
// Entries of an acceptance record: unfenced lines, optional "- " / "* " marker,
// split on " — " (em dash); an entry has >= 2 fields and a first field equal to
// one of scenarioIds. Other lines (raw output, prose, unknown ids) are ignored.
export function parseAcceptanceRecord(section, scenarioIds) {
    const out = [];
    for (const raw of unfencedLines(section)) {
        let line = raw.trim();
        if (line.startsWith("- ") || line.startsWith("* "))
            line = line.slice(2);
        const fields = line.split(ENTRY_SEPARATOR_RE);
        if (fields.length < 2)
            continue;
        const id = fields[0].trim();
        if (!scenarioIds.includes(id))
            continue;
        out.push({ id, pass: fields[fields.length - 1].trim() === "pass" });
    }
    return out;
}
function notArmed(specPath) {
    return {
        armed: false, specPath, ticketPaths: [], problem: null,
        missingIds: [], notPassedIds: [], manualIds: [], checkedPaths: [], rejected: false,
    };
}
// Per-scenario evaluation of the cited ticket against the acceptance record of
// the review file the traversal chooses. Never throws; executes nothing.
export function evaluateTicketAcceptance(workspacePath, activeFeature, taskIds, evidenceSchema) {
    const specPath = specFilePath(workspacePath, activeFeature);
    if (!activeFeature)
        return notArmed(specPath);
    let spec;
    try {
        spec = fs.readFileSync(specPath, "utf-8");
    }
    catch {
        return notArmed(specPath);
    }
    const ticketPaths = findTicketCitations(workspacePath, spec);
    if (ticketPaths.length === 0)
        return notArmed(specPath);
    const located = locateAcExecutionLog(workspacePath, taskIds, evidenceSchema);
    const base = { armed: true, specPath, ticketPaths, checkedPaths: located.checkedPaths };
    const withProblem = (problem) => ({
        ...base, problem, missingIds: [], notPassedIds: [], manualIds: [], rejected: true,
    });
    if (ticketPaths.length >= 2)
        return withProblem({ kind: "many" });
    let ticketText;
    try {
        ticketText = fs.readFileSync(path.join(workspacePath, ticketPaths[0]), "utf-8");
    }
    catch {
        return withProblem({ kind: "missing-file" });
    }
    const ticket = parseTicketFile(ticketText);
    if (ticket.problems.length > 0) {
        return withProblem({ kind: "parse", count: ticket.problems.length, first: ticket.problems[0] });
    }
    const blockingIds = [];
    const manualIds = [];
    for (const s of ticket.scenarios) {
        const kind = s.verification?.kind;
        if (kind === "test" || kind === "command" || kind === "automated-test")
            blockingIds.push(s.id);
        else if (kind === "device-or-person")
            manualIds.push(s.id);
    }
    const missingIds = [];
    const notPassedIds = [];
    if (blockingIds.length > 0) {
        const section = located.content === null ? null : sliceLastAcExecutionLog(located.content, evidenceSchema);
        const entries = parseAcceptanceRecord(section ?? "", blockingIds);
        for (const id of blockingIds) {
            const mine = entries.filter((e) => e.id === id);
            if (mine.length === 0)
                missingIds.push(id);
            else if (mine.some((e) => !e.pass))
                notPassedIds.push(id);
        }
    }
    return {
        ...base, problem: null, missingIds, notPassedIds, manualIds,
        rejected: missingIds.length > 0 || notPassedIds.length > 0,
    };
}
// The rejection text after the `⛔ AC_EXECUTION_LOG_MISSING: <ids>. ` prefix.
export function renderTicketAcceptanceRejection(result, evidenceSchemaLabel) {
    const ticketPath = result.ticketPaths[0] ?? "";
    let text = `Spec ${result.specPath} cites ticket file ${ticketPath}; the acceptance record must hold a passing entry for ` +
        "every scenario verified by a test or a command. ";
    const problem = result.problem;
    if (problem !== null) {
        if (problem.kind === "many") {
            text += `The spec cites more than one ticket file (${result.ticketPaths.join(", ")}); cite exactly one. `;
        }
        else if (problem.kind === "missing-file") {
            text += `The cited ticket file could not be read: ${ticketPath}. `;
        }
        else {
            text += `The cited ticket file has ${problem.count} format problem(s); first: ${problem.first}. `;
        }
    }
    else {
        if (result.missingIds.length > 0)
            text += `No entry for scenario(s): ${result.missingIds.join(", ")}. `;
        if (result.notPassedIds.length > 0) {
            text += `Entry not marked pass for scenario(s): ${result.notPassedIds.join(", ")}. `;
        }
        if (result.manualIds.length > 0) {
            text += `Awaiting manual verification (does not block PASS): ${result.manualIds.join(", ")}. `;
        }
    }
    const inspected = result.checkedPaths.length > 0
        ? result.checkedPaths.join(", ")
        : "(none — no review file resolved for the listed task(s))";
    return text + `Inspected: ${inspected}. ` + `Evidence schema: ${evidenceSchemaLabel}. ` + AC_TICKET_HINT;
}
//# sourceMappingURL=ac-execution.js.map