// Coded by @sr-engineer
// Ticket-file parser and checker: one Markdown file per ticket, a leading YAML
// field block plus Given/When/Then scenarios, each with one verification line.
// The format is defined for readers in docs/ticket-format.md; this module is
// read-only and never writes a file. Why: specs/e422-ticket-file-format.md.

import * as fs from "node:fs";
import * as path from "node:path";
import * as yaml from "js-yaml";
import { resolveTicketDir } from "./config.js";

export type TicketFieldKind = "text" | "id-list" | "path-list" | "yes-no" | "status" | "source";

export interface TicketFieldDef {
  name: string;
  required: boolean;
  kind: TicketFieldKind;
}

/** Every field a ticket's field block may hold, in the documented order. */
export const TICKET_FIELDS: readonly TicketFieldDef[] = [
  { name: "id", required: true, kind: "text" },
  { name: "title", required: true, kind: "text" },
  { name: "priority", required: true, kind: "text" },
  { name: "depends on", required: true, kind: "id-list" },
  { name: "allowed paths", required: true, kind: "path-list" },
  { name: "needs device or person", required: true, kind: "yes-no" },
  { name: "status", required: true, kind: "status" },
  { name: "source", required: false, kind: "source" },
];

/** Field names that belong to orchestration tooling, never to a ticket. */
export const FORBIDDEN_FIELD_NAMES: readonly string[] = [
  "next_role", "agent_id", "handoff", "lane", "round", "evidence", "dispatch",
];

/** The status values; "stopped" must be written as `stopped — <reason>`. */
export const TICKET_STATUSES: readonly string[] = ["not started", "done", "stopped"];

export type TicketVerification =
  | { kind: "automated-test" }
  | { kind: "test"; file: string; title: string }
  | { kind: "command"; command: string }
  | { kind: "device-or-person"; check?: string };

export interface TicketScenario {
  id: string;
  title: string;
  /** null when the scenario has zero, several, or an unrecognized verification. */
  verification: TicketVerification | null;
  addedDuringBuild: boolean;
}

export interface TicketParseResult {
  /** Known fields whose value has the documented shape, keyed by field name. */
  fields: Record<string, string | string[]>;
  scenarios: TicketScenario[];
  /** Problem texts without the "check-tickets: <file>: " prefix; [] = valid. */
  problems: string[];
}

export interface CheckTicketsResult {
  output: string;
  exitCode: number;
  stream: "stdout" | "stderr";
}

const STOPPED_RE = /^stopped\s+—\s+\S/;
const SOURCE_ENTRY_RE = /^[0-9]+ rev [0-9]+$/;
const ADDED_RE = /^Added:\s*(\S[^,]*),\s*(\d{4}-\d{2}-\d{2}),\s*(\S.*)$/;
const KEYWORD_RE = /^(Given|When|Then|And)(\s|$)/;
const SCENARIO_SECTION = "## Scenarios";
const ADDED_SECTION = "## Added during build";

function words(name: string): string {
  return ` ${name.toLowerCase().split(/[\s_-]+/).filter((w) => w.length > 0).join(" ")} `;
}

function isForbiddenName(name: string): boolean {
  return FORBIDDEN_FIELD_NAMES.some((listed) => words(name).includes(words(listed)));
}

function isKnownStatus(text: string): boolean {
  return text === "not started" || text === "done" || STOPPED_RE.test(text);
}

function asTextList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.every((v) => typeof v === "string" && v.trim().length > 0) ? (value as string[]) : null;
}

function checkFields(block: Record<string, unknown>, problems: string[]): Record<string, string | string[]> {
  const fields: Record<string, string | string[]> = {};
  for (const name of Object.keys(block)) {
    if (isForbiddenName(name)) problems.push(`forbidden field name "${name}"`);
    else if (!TICKET_FIELDS.some((f) => f.name === name)) problems.push(`unknown field "${name}"`);
  }
  for (const def of TICKET_FIELDS) {
    const value = block[def.name];
    const blank = value === null || value === undefined || (typeof value === "string" && value.trim() === "");
    if (blank || (def.kind === "path-list" && Array.isArray(value) && value.length === 0)) {
      if (def.required) problems.push(`missing field "${def.name}"`);
    } else if (def.kind === "id-list" || def.kind === "path-list" || def.kind === "source") {
      const list = def.kind === "source" && typeof value === "string" ? [value] : asTextList(value);
      const bad = def.kind === "source" && list !== null ? list.filter((e) => !SOURCE_ENTRY_RE.test(e.trim())) : [];
      for (const e of bad) problems.push(`source entry "${e}" is not "<number> rev <revision>"`);
      if (list === null) problems.push(`field "${def.name}" must be a list`);
      else if (bad.length === 0) fields[def.name] = list;
    } else if (typeof value !== "string") {
      problems.push(`field "${def.name}" must be text`);
    } else if (def.kind === "status" && !isKnownStatus(value.trim())) {
      problems.push(`unknown status "${value.trim()}" (expected not started, done, or stopped — <reason>)`);
    } else {
      fields[def.name] = value.trim();
    }
  }
  return fields;
}

function parseVerification(text: string): TicketVerification | null {
  if (text === "automated test") return { kind: "automated-test" };
  let m = /^test (\S+) — (\S.*)$/.exec(text);
  if (m) return { kind: "test", file: m[1], title: m[2] };
  m = /^command (\S.*)$/.exec(text);
  if (m) return { kind: "command", command: m[1] };
  m = /^device-or-person(?::\s*(\S.*))?$/.exec(text);
  if (m) return m[1] === undefined ? { kind: "device-or-person" } : { kind: "device-or-person", check: m[1] };
  return null;
}

interface RawScenario {
  heading: string;
  added: boolean;
  lines: string[];
}

/**
 * Collects `###` scenarios under the scenario and added-during-build sections.
 * Headings inside fenced code blocks are ignored; list markers are stripped.
 */
function collectScenarios(body: string[]): { raw: RawScenario[]; hasSection: boolean } {
  const raw: RawScenario[] = [];
  let section: "scenarios" | "added" | null = null;
  let hasSection = false;
  let inFence = false;
  let current: RawScenario | null = null;
  for (const original of body) {
    const line = original.trim();
    if (/^(```|~~~)/.test(line)) inFence = !inFence;
    if (!inFence && /^##\s/.test(line)) {
      current = null;
      section = line === SCENARIO_SECTION ? "scenarios" : line === ADDED_SECTION ? "added" : null;
      if (section === "scenarios") hasSection = true;
    } else if (!inFence && /^###\s/.test(line) && section !== null) {
      current = { heading: line.replace(/^###\s+/, ""), added: section === "added", lines: [] };
      raw.push(current);
    } else if (!inFence && /^#{1,3}\s/.test(line)) {
      current = null;
    } else if (current !== null && line.length > 0) {
      current.lines.push(line.replace(/^[-*]\s+/, ""));
    }
  }
  return { raw, hasSection };
}

function checkScenario(raw: RawScenario, problems: string[]): TicketScenario {
  const split = raw.heading.indexOf(" — ");
  const id = (split >= 0 ? raw.heading.slice(0, split) : raw.heading).trim();
  const title = split >= 0 ? raw.heading.slice(split + 3).trim() : "";
  const verifications = raw.lines.filter((l) => l.startsWith("Verification:"));
  let verification: TicketVerification | null = null;
  if (verifications.length === 0) problems.push(`scenario ${id} has no verification`);
  else if (verifications.length > 1) problems.push(`scenario ${id} has more than one verification`);
  else {
    const text = verifications[0].slice("Verification:".length).trim();
    verification = parseVerification(text);
    if (verification === null) problems.push(`scenario ${id} has an unknown verification "${text}"`);
  }
  const keywords = new Set(raw.lines.map((l) => KEYWORD_RE.exec(l)?.[1]).filter((k) => k !== undefined));
  for (const keyword of ["Given", "When", "Then"]) {
    if (!keywords.has(keyword)) problems.push(`scenario ${id} has no ${keyword} line`);
  }
  if (raw.added && !raw.lines.some((l) => ADDED_RE.test(l))) {
    problems.push(`scenario ${id} added during build has no "Added: <who>, <YYYY-MM-DD>, <reason>" line`);
  }
  return { id, title, verification, addedDuringBuild: raw.added };
}

/** Parses one ticket file's text and lists every format problem found. */
export function parseTicketFile(text: string): TicketParseResult {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const problems: string[] = [];
  const close = lines.findIndex((l, i) => i > 0 && l.trimEnd() === "---");
  if (lines[0]?.trimEnd() !== "---" || close < 0) {
    return { fields: {}, scenarios: [], problems: ["no field block (the first line must be ---)"] };
  }
  let block: unknown;
  try {
    block = yaml.load(lines.slice(1, close).join("\n"), { schema: yaml.FAILSAFE_SCHEMA }) ?? {};
  } catch (err) {
    problems.push(`field block is not valid YAML: ${(err as Error).message.split("\n")[0]}`);
  }
  let fields: Record<string, string | string[]> = {};
  if (block !== undefined && (typeof block !== "object" || block === null || Array.isArray(block))) {
    problems.push("field block is not valid YAML: expected \"name: value\" lines");
  } else if (block !== undefined) {
    fields = checkFields(block as Record<string, unknown>, problems);
  }
  const { raw, hasSection } = collectScenarios(lines.slice(close + 1));
  const scenarios = raw.map((r) => checkScenario(r, problems));
  if (!hasSection || !raw.some((r) => !r.added)) problems.push("no scenarios");
  const seen = new Set<string>();
  for (const s of scenarios) {
    if (seen.has(s.id)) problems.push(`duplicate scenario id ${s.id}`);
    seen.add(s.id);
  }
  const value = fields["needs device or person"];
  if (typeof value === "string") {
    const k = scenarios.filter((s) => s.verification?.kind === "device-or-person").length;
    if (!((value === "yes" && k > 0) || (value === "no" && k === 0))) {
      problems.push(`"needs device or person" is "${value}" but ${k} scenario(s) use device-or-person`);
    }
  }
  return { fields, scenarios, problems };
}

function display(cwd: string, abs: string, given: string): string {
  const rel = path.relative(cwd, abs);
  return rel.length > 0 && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel : given;
}

function reason(err: unknown): string {
  return ((err as Error).message ?? String(err)).split(", ")[0];
}

function ticketFilesIn(dir: string): string[] {
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith(".md") && name.toLowerCase() !== "readme.md")
    .filter((name) => fs.statSync(path.join(dir, name)).isFile())
    .sort();
}

/**
 * Runs the ticket checker over `argv` (files or directories) from `cwd`.
 * With no arguments it checks the configured ticket directory. Exit code:
 * 0 = all valid, 1 = at least one problem, 2 = cannot run (stderr output).
 */
export function runCheckTicketsCli(argv: readonly string[], cwd: string): CheckTicketsResult {
  const fail = (line: string): CheckTicketsResult => ({ output: line, exitCode: 2, stream: "stderr" });
  const option = argv.find((a) => a.startsWith("-"));
  if (option !== undefined) return fail(`check-tickets: unknown option ${option}`);
  if (argv.length === 0) {
    const dir = resolveTicketDir(cwd);
    if (!fs.existsSync(dir)) {
      const line = `check-tickets: no ticket directory at ${display(cwd, dir, dir)}; 0 file(s), 0 scenario(s), 0 problem(s)`;
      return { output: line, exitCode: 0, stream: "stdout" };
    }
    argv = [dir];
  }
  const files: { shown: string; text: string }[] = [];
  for (const arg of argv) {
    const abs = path.resolve(cwd, arg);
    try {
      const names = fs.statSync(abs).isDirectory() ? ticketFilesIn(abs) : [""];
      for (const name of names) {
        const text = fs.readFileSync(path.join(abs, name), "utf-8");
        files.push({ shown: display(cwd, path.join(abs, name), path.join(arg, name)), text });
      }
    } catch (err) {
      return fail(`check-tickets: cannot read ${display(cwd, abs, arg)}: ${reason(err)}`);
    }
  }
  const out: string[] = [];
  let scenarioCount = 0;
  let problemCount = 0;
  for (const { shown, text } of files) {
    const result = parseTicketFile(text);
    scenarioCount += result.scenarios.length;
    problemCount += result.problems.length;
    if (result.problems.length === 0) out.push(`check-tickets: ok ${shown} (${result.scenarios.length} scenarios)`);
    for (const p of result.problems) out.push(`check-tickets: ${shown}: ${p}`);
  }
  out.push(`check-tickets: ${files.length} file(s), ${scenarioCount} scenario(s), ${problemCount} problem(s)`);
  return { output: out.join("\n"), exitCode: problemCount > 0 ? 1 : 0, stream: "stdout" };
}
