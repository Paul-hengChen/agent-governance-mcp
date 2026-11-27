// Coded by @sr-engineer
// `fanout.mjs waves`: compares a fan-out manifest that carries the `波次`
// column with the approved spec-workshop wave table and the tickets' files.
// It passes only when the manifest holds exactly the approved tickets, keeps
// every approved dependency and owns no path outside the tickets' allowed
// paths; a pass prints the reason line the integrator records as a Decisions
// row. Contract: specs/e443a-manifest-waves.md (I4). Read-only: reads the two
// files and primary's ticket directory; git is read only to find primary.

import fs from "node:fs";
import path from "node:path";
import {
  FANOUT_CODES,
  formatError,
  isGlobToken,
  isImplicitBookkeeping,
  lanesSectionsWithoutWave,
  lookupTicketFiles,
  matchesGlob,
  resolvePrimary,
  splitRow,
  ticketIds,
  usageResult,
  validateManifest,
} from "./fanout-manifest.js";
import type { CliResult, DispatchableLane, FanoutError, TicketFileInfo } from "./fanout-manifest.js";

// --- constants ---------------------------------------------------------------

/** Exact header cells (trimmed) of the approved wave table. */
export const WAVE_TABLE_HEADER = ["wave", "ticket", "depends on"] as const;

/** `depends on` cell values that mean "no dependency". */
const NO_DEPENDENCY = new Set(["", "—", "-", "none", "無"]);

const WAVE_RE = /^[1-9][0-9]*$/;
const LIST_SEPARATOR_RE = /\s*[,，、]\s*/;

/**
 * waves codes: input errors (exit 2) and broken-condition FAIL lines (exit 1).
 * CLI codes, not tw_update_state gate codes, so none ends in a gate suffix.
 */
export const WAVES_CODES = {
  columnAbsent: "WAVES_COLUMN_ABSENT",
  tableUnreadable: "WAVE_TABLE_UNREADABLE",
  tableAbsent: "WAVE_TABLE_ABSENT",
  tableDuplicate: "WAVE_TABLE_DUPLICATE",
  rowMalformed: "WAVE_TABLE_ROW_MALFORMED",
  ticketAdded: "TICKET_ADDED",
  ticketRemoved: "TICKET_REMOVED",
  ticketInTwoLanes: "TICKET_IN_TWO_LANES",
  dependencyDropped: "DEPENDENCY_DROPPED",
  ownedOutsideAllowed: "OWNED_OUTSIDE_ALLOWED",
} as const;

/** Decisions-row reason line, printed last on a pass. */
export const WAVES_REASON_LINE = (n: number, d: number): string =>
  `自動：只改順序或分組 — 票組與核准的波次表相同（${n} 張票），核准的 ${d} 條相依都保留，每條 lane 的擁有檔都在其票的允許路徑內`;

export const WAVES_OK_LINE = (n: number, m: number, d: number): string =>
  `fanout waves: ok — ${n} ticket(s) in ${m} lane(s), ${d} approved dependency(ies) kept`;

export const WAVES_FAIL_SUMMARY = (k: number): string => `fanout waves: ${k} broken condition(s) — halt for human approval`;

// --- wave table --------------------------------------------------------------

/** One row of the approved wave table. */
export interface WaveTableRow {
  wave: number;
  ticket: string;
  dependsOn: string[];
  line: number;
}

export type WaveTableResult = { ok: true; rows: WaveTableRow[] } | { ok: false; errors: FanoutError[] };

function inputErr(code: string, message: string): FanoutError {
  return { code, scope: "input", message };
}

/** Runs of consecutive lines starting with `|`, each with its 1-based line numbers. */
function tables(text: string): { text: string; line: number }[][] {
  const out: { text: string; line: number }[][] = [];
  let cur: { text: string; line: number }[] = [];
  text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .forEach((l, i) => {
      if (l.startsWith("|")) {
        cur.push({ text: l, line: i + 1 });
      } else if (cur.length > 0) {
        out.push(cur);
        cur = [];
      }
    });
  if (cur.length > 0) out.push(cur);
  return out;
}

const isWaveHeader = (cells: string[]): boolean =>
  cells.length === WAVE_TABLE_HEADER.length && WAVE_TABLE_HEADER.every((c, i) => cells[i] === c);

/**
 * Parse the single `| wave | ticket | depends on |` table of `text`.
 *
 * `file` is only used in messages. Every malformed row is reported; a
 * dependency must name another ticket of the same table.
 */
export function parseWaveTable(text: string, file: string): WaveTableResult {
  const found = tables(text).filter((t) => isWaveHeader(splitRow(t[0].text)));
  if (found.length === 0) {
    return { ok: false, errors: [inputErr(WAVES_CODES.tableAbsent, `no | wave | ticket | depends on | table found in ${file}`)] };
  }
  if (found.length > 1) {
    const lines = found.map((t) => t[0].line).join(", ");
    return { ok: false, errors: [inputErr(WAVES_CODES.tableDuplicate, `more than one | wave | ticket | depends on | table in ${file} (lines ${lines})`)] };
  }
  const body = found[0].slice(1).map((l) => ({ cells: splitRow(l.text), line: l.line }));
  if (body.length > 0 && body[0].cells.length > 0 && body[0].cells.every((c) => /^:?-+:?$/.test(c))) body.shift();

  const errors: FanoutError[] = [];
  const bad = (line: number, what: string): void => {
    errors.push(inputErr(WAVES_CODES.rowMalformed, `${file} line ${line}: ${what}`));
  };
  const firstLine = new Map<string, number>();
  const rows: WaveTableRow[] = [];
  for (const { cells, line } of body) {
    if (cells.length !== WAVE_TABLE_HEADER.length) {
      bad(line, `row has ${cells.length} cell(s), expected ${WAVE_TABLE_HEADER.length} (${WAVE_TABLE_HEADER.join(" | ")})`);
      continue;
    }
    const [wave, ticket, deps] = cells;
    let ok = true;
    if (!WAVE_RE.test(wave)) {
      bad(line, `wave cell is "${wave}" — must be a positive integer`);
      ok = false;
    }
    if (ticket === "") {
      bad(line, "ticket cell is empty");
      ok = false;
    } else if (firstLine.has(ticket)) {
      bad(line, `ticket ${ticket} appears more than once (first on line ${firstLine.get(ticket)})`);
      ok = false;
    } else {
      firstLine.set(ticket, line);
    }
    const list = NO_DEPENDENCY.has(deps) ? [] : deps.split(LIST_SEPARATOR_RE);
    if (list.some((d) => d === "")) {
      bad(line, `depends on cell "${deps}" has an empty entry`);
      ok = false;
    }
    if (!ok) continue;
    rows.push({ wave: Number(wave), ticket, dependsOn: [...new Set(list)], line });
  }
  for (const row of rows) {
    for (const d of row.dependsOn) {
      if (d === row.ticket) bad(row.line, `depends on names ${d}, the row's own ticket`);
      else if (!firstLine.has(d)) bad(row.line, `depends on names "${d}", which is not a ticket of this table`);
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, rows };
}

// --- comparison --------------------------------------------------------------

/** One broken-condition line, without the `FAIL  ` prefix. */
interface Failure {
  code: string;
  message: string;
}

/** Outcome of the three conditions; `failures[i]` holds condition i+1's lines. */
export interface WavesReport {
  failures: [Failure[], Failure[], Failure[]];
  tickets: number;
  lanes: number;
  dependenciesKept: number;
}

/** True when lane `to` is reachable from lane `from` along `相依` edges (one or more steps). */
function reaches(byLane: Map<string, DispatchableLane>, from: string, to: string): boolean {
  const seen = new Set<string>();
  const queue = [...(byLane.get(from)?.depLanes ?? [])];
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    if (cur === to) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    queue.push(...(byLane.get(cur)?.depLanes ?? []));
  }
  return false;
}

/** Owned tokens that are lane bookkeeping and so never compared with allowed paths. */
function isBookkeepingToken(token: string, lane: string): boolean {
  return (
    token === "tasks.md" ||
    token.startsWith(".current/") ||
    token.startsWith("qa_reports/") ||
    token.startsWith("review_reports/") ||
    isImplicitBookkeeping(token, lane)
  );
}

/** A glob token is inside only a byte-identical entry; a literal also inside a matching glob. */
function insideAllowed(token: string, allowed: string[]): boolean {
  return allowed.some((entry) => entry === token || (!isGlobToken(token) && matchesGlob(token, entry)));
}

/**
 * Check the three waves conditions for a validated, all-`波次` manifest.
 *
 * `tickets` must hold the ticket file of every wave-table ticket. Pure.
 */
export function compareWaves(lanes: DispatchableLane[], table: WaveTableRow[], tickets: TicketFileInfo[]): WavesReport {
  const approved = new Set(table.map((r) => r.ticket));
  const infoOf = new Map(tickets.map((t) => [t.id, t]));
  const byLane = new Map(lanes.map((l) => [l.lane, l]));
  const cellIds = new Map(lanes.map((l) => [l.lane, ticketIds(l.ticket)]));

  const occurrences = new Map<string, string[]>();
  for (const l of lanes) {
    for (const t of cellIds.get(l.lane) ?? []) occurrences.set(t, [...(occurrences.get(t) ?? []), l.lane]);
  }

  const c1: Failure[] = [];
  for (const l of lanes) {
    for (const t of new Set(cellIds.get(l.lane))) {
      if (!approved.has(t)) {
        c1.push({ code: WAVES_CODES.ticketAdded, message: `ticket ${t} is in lane ${l.lane}'s 票 cell but not in the wave table` });
      }
    }
  }
  for (const r of table) {
    if (!occurrences.has(r.ticket)) {
      c1.push({ code: WAVES_CODES.ticketRemoved, message: `ticket ${r.ticket} is in the wave table but in no lane's 票 cell` });
    }
  }
  for (const [t, ls] of occurrences) {
    if (ls.length > 1) {
      c1.push({ code: WAVES_CODES.ticketInTwoLanes, message: `ticket ${t} is listed more than once across 票 cells (lanes ${ls.join(", ")})` });
    }
  }

  const c2: Failure[] = [];
  let kept = 0;
  for (const r of table) {
    for (const y of r.dependsOn) {
      const x = r.ticket;
      const lx = occurrences.get(x);
      const ly = occurrences.get(y);
      if (lx?.length !== 1 || ly?.length !== 1) continue;
      const head = `${x} depends on ${y} (wave table), but`;
      if (lx[0] === ly[0]) {
        const ids = cellIds.get(lx[0]) ?? [];
        if (ids.indexOf(y) < ids.indexOf(x)) kept++;
        else c2.push({ code: WAVES_CODES.dependencyDropped, message: `${head} both are in lane ${lx[0]} and ${y} is not listed before ${x} in its 票 cell` });
      } else if (reaches(byLane, lx[0], ly[0])) {
        kept++;
      } else {
        c2.push({ code: WAVES_CODES.dependencyDropped, message: `${head} lane ${lx[0]} does not reach lane ${ly[0]} through 相依` });
      }
    }
  }

  const c3: Failure[] = [];
  for (const l of lanes) {
    const own = [...new Set(cellIds.get(l.lane))].filter((t) => approved.has(t));
    const allowed = own.flatMap((t) => infoOf.get(t)?.allowedPaths ?? []);
    const of = own.length > 0 ? own.join("、") : "any approved ticket of the lane";
    for (const token of new Set(l.ownedTokens)) {
      if (isBookkeepingToken(token, l.lane) || insideAllowed(token, allowed)) continue;
      c3.push({ code: WAVES_CODES.ownedOutsideAllowed, message: `lane ${l.lane}: 擁有 token ${token} is not inside the allowed paths of ${of}` });
    }
  }

  return { failures: [c1, c2, c3], tickets: approved.size, lanes: lanes.length, dependenciesKept: kept };
}

/** stdout and exit code for a comparison report (exit 0 = pass, 1 = broken condition). */
export function formatWavesReport(r: WavesReport): CliResult {
  const broken = r.failures.filter((f) => f.length > 0).length;
  if (broken > 0) {
    const lines = r.failures.flat().map((f) => `FAIL  ${f.code}: ${f.message}`);
    return { stdout: [...lines, WAVES_FAIL_SUMMARY(broken)].join("\n") + "\n", stderr: "", exitCode: 1 };
  }
  const lines = [WAVES_OK_LINE(r.tickets, r.lanes, r.dependenciesKept), WAVES_REASON_LINE(r.tickets, r.dependenciesKept)];
  return { stdout: lines.join("\n") + "\n", stderr: "", exitCode: 0 };
}

// --- CLI ---------------------------------------------------------------------

function fail(errors: Pick<FanoutError, "code" | "message">[]): CliResult {
  return { stdout: "", stderr: errors.map(formatError).join("\n") + "\n", exitCode: 2 };
}

function readText(file: string): { text: string } | { reason: string } {
  try {
    return { text: fs.readFileSync(file, "utf8") };
  } catch (err) {
    return { reason: (err as Error).message };
  }
}

/** Positional operands and the single optional `--primary` value, or a usage message. */
function parseWavesArgs(args: string[]): { positional: string[]; primary?: string } | string {
  const positional: string[] = [];
  let primary: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("--")) {
      positional.push(a);
      continue;
    }
    if (a !== "--primary") return `unknown flag ${a}`;
    if (i + 1 >= args.length) return `flag ${a} needs a value`;
    if (primary !== undefined) return `flag ${a} given more than once`;
    primary = args[++i];
  }
  if (positional.length !== 2) return "waves takes <manifest> <wave-table>";
  return { positional, primary };
}

/**
 * `waves <manifest> <wave-table> [--primary <path>]`.
 *
 * Exit 0 = all three conditions hold, 1 = a broken condition, 2 = usage or
 * any parse/input error. Manifest and wave-table errors are reported together;
 * ticket files are looked up only once both parse.
 */
export function runWaves(args: string[]): CliResult {
  const p = parseWavesArgs(args);
  if (typeof p === "string") return usageResult(p);
  const [manifestFile, tableFile] = p.positional;

  const errors: FanoutError[] = [];
  let lanes: DispatchableLane[] = [];
  const m = readText(manifestFile);
  if ("reason" in m) {
    errors.push(inputErr("MANIFEST_UNREADABLE", `cannot read manifest "${manifestFile}": ${m.reason}`));
  } else {
    const v = validateManifest(m.text);
    if (v.errors.length > 0) {
      errors.push(...v.errors);
    } else {
      for (const s of lanesSectionsWithoutWave(m.text)) {
        errors.push(
          inputErr(
            WAVES_CODES.columnAbsent,
            `section "${s.heading}" (line ${s.line}) has no 波次 column — waves compares only a manifest whose every Lanes table has it`,
          ),
        );
      }
      lanes = v.manifest.dispatchable;
    }
  }

  let table: WaveTableRow[] = [];
  const t = readText(tableFile);
  if ("reason" in t) {
    errors.push(inputErr(WAVES_CODES.tableUnreadable, `cannot read wave table "${tableFile}": ${t.reason}`));
  } else {
    const parsed = parseWaveTable(t.text, tableFile);
    if (parsed.ok) table = parsed.rows;
    else errors.push(...parsed.errors);
  }

  let primary = p.primary;
  if (primary === undefined || primary.trim() === "") {
    primary = resolvePrimary(path.dirname(path.resolve(manifestFile)));
    if (primary === undefined) {
      errors.push(
        inputErr(FANOUT_CODES.primaryNotFound, "no --primary and the manifest's directory is not inside a git repo (git worktree list --porcelain failed)"),
      );
    }
  }
  if (errors.length > 0 || primary === undefined) return fail(errors);

  const lookup = lookupTicketFiles(
    primary,
    table.map((r) => r.ticket),
  );
  if (!lookup.ok) return fail(lookup.errors);
  return formatWavesReport(compareWaves(lanes, table, lookup.tickets));
}
