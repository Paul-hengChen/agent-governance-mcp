#!/usr/bin/env node
// Coded by @sr-engineer
// One-screen summary of a ticket batch, read from ticket files and reports.
// Usage: node scripts/batch-summary.mjs [--reports <dir>]
//          [<file or directory> ...]
//        (no argument: every ticket file in the configured ticket directory)
// Exit: 0 = summary printed, 2 = cannot run. Reporting only: writes nothing.
// Format of the input files: docs/ticket-format.md (*Batch summary*).

import * as fs from "node:fs";
import * as path from "node:path";
import { parseTicketFile } from "../dist/tools/ticket-file.js";
import { resolveTicketDir } from "../dist/tools/config.js";

const P = "batch-summary:";
const DEFAULT_REPORTS = "qa_reports";
const STOPPED_RE = /^stopped\s+—\s+(\S.*)$/;
const WAITING_RE = /^waiting on (\S.*)$/;
const MANUAL = "awaiting manual verification";
const FENCE_RE = /^(```|~~~)/;
const SEPARATOR_RE = /^\|[\s:|-]*-[\s:|-]*\|?$/;
const ADDED_RE = /^-\s*Added:\s*(.*)$/;
const SCENARIO_HEAD_RE = /^###\s+(\S+)/;
const REPORT_KINDS = [
  { prefix: "tests_", section: "## Open Interface Details", group: "qa" },
  { prefix: "visual_", section: "## Allowed Differences", group: "visual" },
];

class CannotRun extends Error {}

function reason(err) {
  return String(err?.message ?? err).split(", ")[0];
}

function display(cwd, abs, given) {
  const rel = path.relative(cwd, abs);
  return rel.length > 0 && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel : given;
}

function byKey(key) {
  return (a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0);
}

function parseArgs(argv) {
  const opts = { reports: undefined, targets: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--reports") {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("-")) throw new CannotRun(`${P} --reports needs a directory`);
      opts.reports = value;
      i += 1;
    } else if (arg.startsWith("-")) {
      throw new CannotRun(`${P} unknown option ${arg}`);
    } else {
      opts.targets.push(arg);
    }
  }
  return opts;
}

function ticketNamesIn(dir) {
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith(".md") && name.toLowerCase() !== "readme.md")
    .filter((name) => fs.statSync(path.join(dir, name)).isFile())
    .sort();
}

function readTicketFiles(cwd, targets) {
  const files = [];
  for (const arg of targets) {
    const abs = path.resolve(cwd, arg);
    try {
      const names = fs.statSync(abs).isDirectory() ? ticketNamesIn(abs) : [""];
      for (const name of names) {
        const text = fs.readFileSync(path.join(abs, name), "utf-8");
        files.push({ shown: display(cwd, path.join(abs, name), path.join(arg, name)), text });
      }
    } catch (err) {
      throw new CannotRun(`${P} cannot read ${display(cwd, abs, arg)}: ${reason(err)}`);
    }
  }
  return files;
}

/** Lines of the `heading` section up to the next `## ` heading, untrimmed. */
function sectionLines(text, heading) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const out = [];
  let inside = false;
  let fenced = false;
  for (const line of lines) {
    if (!fenced && line.startsWith("## ")) {
      inside = line.trimEnd() === heading;
      continue;
    }
    if (FENCE_RE.test(line.trim())) fenced = !fenced;
    if (inside) out.push(line);
  }
  return out;
}

/** Non-blank trimmed lines of a section, table separator rows left out. */
function contentLines(text, heading) {
  return sectionLines(text, heading)
    .map((l) => l.trim())
    .filter((l) => l !== "" && !SEPARATOR_RE.test(l));
}

function addedNotes(text) {
  const notes = new Map();
  let current = null;
  for (const line of sectionLines(text, "## Added during build")) {
    const head = SCENARIO_HEAD_RE.exec(line.trim());
    if (head) current = head[1];
    const added = ADDED_RE.exec(line.trim());
    if (added && current !== null && !notes.has(current)) notes.set(current, added[1].trim());
  }
  return notes;
}

function summariseTicket(text, parsed) {
  const id = String(parsed.fields.id);
  const status = String(parsed.fields.status);
  const stopped = STOPPED_RE.exec(status);
  const why = stopped ? stopped[1].trim() : null;
  const waiting = why === null ? null : WAITING_RE.exec(why);
  let kind = status === "done" ? "done" : "not started";
  if (why === MANUAL) kind = "manual";
  else if (waiting) kind = "waiting";
  else if (why !== null) kind = "stopped";
  const notes = addedNotes(text);
  return {
    id,
    title: String(parsed.fields.title),
    kind,
    reason: why,
    waitingOn: waiting ? waiting[1].trim() : null,
    questions: contentLines(text, "## Open question"),
    decisions: sectionLines(text, "## Decisions made during the work")
      .filter((l) => l.startsWith("- "))
      .map((l) => l.slice(2).trim()),
    manual: parsed.scenarios
      .filter((s) => s.verification?.kind === "device-or-person")
      .map((s) => ({ scenario: s.id, check: s.verification.check ?? "(no check text)" })),
    added: parsed.scenarios
      .filter((s) => s.addedDuringBuild)
      .map((s) => ({ scenario: s.id, title: s.title, note: notes.get(s.id) ?? "" })),
  };
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function namesTicket(fileName, id) {
  return new RegExp(`(^|[_.-])${escapeRe(id)}($|[_.-])`, "i").test(fileName);
}

function readReports(cwd, given) {
  const shownDir = given ?? DEFAULT_REPORTS;
  const dir = path.resolve(cwd, shownDir);
  if (!fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir)
      .filter((name) => name.endsWith(".md"))
      .map((name) => ({ name, kind: REPORT_KINDS.find((k) => name.startsWith(k.prefix)) }))
      .filter((r) => r.kind !== undefined && fs.statSync(path.join(dir, r.name)).isFile())
      .sort(byKey("name"))
      .map((r) => {
        const abs = path.join(dir, r.name);
        const shown = display(cwd, abs, path.join(shownDir, r.name));
        const lines = contentLines(fs.readFileSync(abs, "utf-8"), r.kind.section);
        return { name: r.name, shown, group: r.kind.group, lines };
      });
  } catch (err) {
    throw new CannotRun(`${P} cannot read ${display(cwd, dir, shownDir)}: ${reason(err)}`);
  }
}

function group(out, header, items) {
  out.push(`${header} (${items.length}):`);
  for (const item of items) out.push(...(Array.isArray(item) ? item : [item]));
}

function render(total, tickets, reports, unreadable) {
  const of = (kind) => tickets.filter((t) => t.kind === kind);
  const reportLines = (wanted) => tickets.flatMap((t) => reports
    .filter((r) => r.group === wanted && namesTicket(r.name, t.id))
    .flatMap((r) => r.lines.map((l) => `  ${t.id} ${r.shown}: ${l}`)));
  const out = [`${P} ${total} ticket(s)`];
  group(out, "done", of("done").map((t) => `  ${t.id} — ${t.title}`));
  group(out, "not started", of("not started").map((t) => `  ${t.id} — ${t.title}`));
  group(out, "stopped", of("stopped").map((t) => [
    `  ${t.id} — ${t.reason}`,
    ...(t.questions.length > 0 ? t.questions : ["(none recorded)"]).map((q) => `    question: ${q}`),
  ]));
  group(out, "waiting", of("waiting").map((t) => `  ${t.id} — waiting on ${t.waitingOn}`));
  group(out, MANUAL, of("manual").flatMap((t) => t.manual.map((m) => `  ${t.id} — ${m.scenario}: ${m.check}`)));
  group(out, "added scenarios", tickets.flatMap((t) => t.added.map((a) =>
    `  ${t.id} ${a.scenario} — ${a.title} (${a.note})`)));
  group(out, "qa interface decisions", reportLines("qa"));
  group(out, "allowed visual differences", reportLines("visual"));
  group(out, "agent decisions", tickets.flatMap((t) => t.decisions.map((d) => `  ${t.id}: ${d}`)));
  group(out, "unreadable tickets", unreadable.map((u) => `  ${u.shown}: ${u.count} problem(s)`));
  return out;
}

function main(argv, cwd) {
  const opts = parseArgs(argv);
  let targets = opts.targets;
  if (targets.length === 0) {
    const dir = resolveTicketDir(cwd);
    if (!fs.existsSync(dir)) return [`${P} no ticket directory at ${display(cwd, dir, dir)}; 0 ticket(s)`];
    targets = [dir];
  }
  const files = readTicketFiles(cwd, targets);
  const tickets = [];
  const unreadable = [];
  for (const { shown, text } of files) {
    const parsed = parseTicketFile(text);
    if (parsed.problems.length > 0) unreadable.push({ shown, count: parsed.problems.length });
    else tickets.push(summariseTicket(text, parsed));
  }
  tickets.sort(byKey("id"));
  unreadable.sort(byKey("shown"));
  const reports = readReports(cwd, opts.reports);
  return render(files.length, tickets, reports, unreadable);
}

try {
  console.log(main(process.argv.slice(2), process.cwd()).join("\n"));
  process.exitCode = 0;
} catch (err) {
  console.error(err instanceof CannotRun ? err.message : `${P} ${err?.stack ?? err}`);
  process.exitCode = 2;
}
