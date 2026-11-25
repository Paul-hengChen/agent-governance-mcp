// Coded by @sr-engineer
// QA evidence gate predicates: each QA round appends a timestamped section to
// qa_reports/review_<task_id>.md. For the completion check a per-id file's
// existence is enough (hasEvidenceInFile); the file-mode PASS check needs a
// report whose last server-recorded verdict is PASS (hasPassEvidenceInFile).
// When the per-id file does not qualify, a lazy `covers:` fallback lets one
// covering report satisfy other ids (tools/evidence-file.ts).
// Spec: specs/c3-covering-evidence.md.

import * as fs from "fs";
import * as path from "path";
import {
  buildCoverageIndex,
  encodeEvidenceId,
  isPassStanding,
  judgeReportStanding,
  parseCoversIds,
  resolveJudgeReport,
} from "../tools/evidence-file.js";

function evidenceDir(workspacePath: string): string {
  return resolveJudgeReport(workspacePath).dir;
}

function evidencePath(workspacePath: string, taskId: string): string {
  // The injective encoder keeps distinct ids on distinct files and blocks
  // path traversal (its output has no separator characters).
  return path.join(evidenceDir(workspacePath), `review_${encodeEvidenceId(taskId)}.md`);
}

// Exported so the QA completion-evidence rejection names the exact expected file,
// the same sanitised path the predicates below check. A wrapper, not a rename:
// test/covering-evidence.test.mjs pins the literal
// `fs.existsSync(evidencePath(...))` text inside hasEvidenceInFile.
export function qaEvidencePath(workspacePath: string, taskId: string): string {
  return evidencePath(workspacePath, taskId);
}

export async function recordReviewInFile(
  workspacePath: string,
  taskIds: string[],
  status: "PASS" | "FAIL",
  reviewer: string,
  notes: string,
): Promise<void> {
  await recordReviewInFileUndoable(workspacePath, taskIds, status, reviewer, notes);
}

// Per-path bookkeeping for one undoable record: the pre-write shape and what
// this write appended, so the undo can prove the file still ends with exactly
// those bytes before touching it.
interface RecordedAppend {
  filePath: string;
  existedBefore: boolean;
  preSize: number;
  appended: Buffer;
  postSize: number;
}

// Byte size of a regular file, or null when it does not exist / cannot be
// stat'd.
function sizeOrNull(filePath: string): number | null {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return null;
  }
}

// True when the file is non-empty and its last byte is not "\n". Unreadable
// or empty files read as false, so no separator is added.
function lacksTrailingNewline(filePath: string): boolean {
  let fd: number | null = null;
  try {
    const size = fs.statSync(filePath).size;
    if (size === 0) return false;
    fd = fs.openSync(filePath, "r");
    const last = Buffer.alloc(1);
    fs.readSync(fd, last, 0, 1, size - 1);
    return last[0] !== 0x0a;
  } catch {
    return false;
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        // Best effort: a close failure changes nothing about the answer.
      }
    }
  }
}

// Reverts the appends in `records` (reverse order) and removes the evidence
// directory when this write created it and left it empty. Never throws. A file
// is touched only when it still matches this write's post-append shape, so a
// concurrent writer's later append is never destroyed (the file is left as is).
function undoRecordedAppends(
  records: RecordedAppend[],
  dir: string,
  dirExistedBefore: boolean,
): void {
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i];
    try {
      if (r.appended.length === 0) continue;
      if (sizeOrNull(r.filePath) !== r.postSize) continue;
      if (!r.existedBefore) {
        fs.unlinkSync(r.filePath);
        continue;
      }
      const tail = fs.readFileSync(r.filePath).subarray(r.preSize);
      if (!tail.equals(r.appended)) continue;
      fs.truncateSync(r.filePath, r.preSize);
    } catch {
      // Best effort: an undo failure leaves the file as it is.
    }
  }
  if (!dirExistedBefore) {
    try {
      if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
    } catch {
      // Best effort, as above.
    }
  }
}

// The append recordReviewInFile performs, returning an undo that restores
// every touched evidence file (and the qa_reports/ directory) to its pre-write
// state. Used by tw_update_state so a write the server then rejects, or whose
// state write throws, leaves no PASS/FAIL section behind. When an existing
// report does not end with a newline, one is written first so the verdict
// heading starts its own line; the undo truncates that byte away too. If an append throws
// part-way, what was already appended is undone and the error is rethrown.
export async function recordReviewInFileUndoable(
  workspacePath: string,
  taskIds: string[],
  status: "PASS" | "FAIL",
  reviewer: string,
  notes: string,
): Promise<() => void> {
  const dir = evidenceDir(workspacePath);
  const dirExistedBefore = fs.existsSync(dir);
  // Snapshot every distinct target path before any append: a repeated id
  // appends twice to one file, and the undo must restore the pre-write size.
  const records: RecordedAppend[] = [];
  const byPath = new Map<string, RecordedAppend>();
  for (const id of taskIds) {
    const filePath = evidencePath(workspacePath, id);
    if (byPath.has(filePath)) continue;
    const preSize = sizeOrNull(filePath);
    const record: RecordedAppend = {
      filePath,
      existedBefore: preSize !== null,
      preSize: preSize ?? 0,
      appended: Buffer.alloc(0),
      postSize: preSize ?? 0,
    };
    byPath.set(filePath, record);
    records.push(record);
  }
  const undo = (): void => undoRecordedAppends(records, dir, dirExistedBefore);
  try {
    if (!dirExistedBefore) fs.mkdirSync(dir, { recursive: true });
    const ts = new Date().toISOString();
    for (const id of taskIds) {
      const filePath = evidencePath(workspacePath, id);
      const existed = fs.existsSync(filePath);
      const header = existed ? "" : `# Review — ${id}\n\n<!-- Auto-appended by tw_update_state(qa_review=...). -->\n\n`;
      // A report whose last line has no newline would leave the verdict
      // heading mid-line, where the standing check cannot see it.
      const lead = existed && lacksTrailingNewline(filePath) ? "\n" : "";
      const section = `## ${ts} — ${status} — by ${reviewer}\n\n${notes.trim()}\n\n`;
      const text = `${lead}${header}${section}`;
      fs.appendFileSync(filePath, text, "utf-8");
      const record = byPath.get(filePath)!;
      record.appended = Buffer.concat([record.appended, Buffer.from(text, "utf-8")]);
      record.postSize = record.preSize + record.appended.length;
    }
  } catch (err) {
    undo();
    throw err;
  }
  return undo;
}

// Read a file as UTF-8, or null when it is absent or unreadable.
function readOrNull(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

// Ids named by the covers: line of any qa_reports/*.md report with standing
// PASS. A set, not a first-seen map, so a later PASS covering report is never
// hidden behind an earlier non-PASS one. Unreadable entries are skipped.
function passCoveredIds(dir: string): Set<string> {
  const covered = new Set<string>();
  let entries: string[];
  try {
    entries = fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
  } catch {
    return covered;
  }
  for (const name of entries) {
    const content = readOrNull(path.join(dir, name));
    if (content === null || !isPassStanding(judgeReportStanding(content))) continue;
    for (const id of parseCoversIds(content)) covered.add(id);
  }
  return covered;
}

// File-mode PASS evidence: each id needs a candidate report with standing PASS
// (direct review_<id>.md, else any qa_reports/*.md whose covers: names it).
// Never throws: unreadable files read as no evidence.
export function hasPassEvidenceInFile(
  workspacePath: string,
  taskIds: string[],
): { present: string[]; missing: string[] } {
  const present: string[] = [];
  const missing: string[] = [];
  // Built at most once per call, only on the first direct miss.
  let covered: Set<string> | null = null;
  for (const id of taskIds) {
    const direct = readOrNull(evidencePath(workspacePath, id));
    if (direct !== null && isPassStanding(judgeReportStanding(direct))) {
      present.push(id);
      continue;
    }
    if (covered === null) covered = passCoveredIds(evidenceDir(workspacePath));
    if (covered.has(id)) {
      present.push(id);
    } else {
      missing.push(id);
    }
  }
  return { present, missing };
}

export function hasEvidenceInFile(
  workspacePath: string,
  taskIds: string[],
): { present: string[]; missing: string[] } {
  const present: string[] = [];
  const missing: string[] = [];
  // Covering evidence (C3): coverage index over qa_reports/ `covers:` lines,
  // built at most once per call and ONLY on the first direct-file miss (AC-6).
  let coverage: Map<string, string> | null = null;
  for (const id of taskIds) {
    if (fs.existsSync(evidencePath(workspacePath, id))) {
      present.push(id);
      continue;
    }
    if (coverage === null) coverage = buildCoverageIndex(evidenceDir(workspacePath));
    if (coverage.has(id)) {
      present.push(id);
    } else {
      missing.push(id);
    }
  }
  return { present, missing };
}
