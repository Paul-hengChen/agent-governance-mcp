#!/usr/bin/env node
// Coded by @sr-engineer
// CI check that every done ticket's named tests exist and passed (E427).
// Usage: node scripts/check-scenario-tests.mjs --results <file>
//          [--tickets <dir>] [--adapter <module>]
// Exit: 0 = all passed or none to check, 1 = problem(s), 2 = cannot run.
// --adapter <module> (cwd-relative) exports readResults(); default: the
// sibling scenario-results-node.mjs. Spec: specs/e427-ci-scenario-tests.md

import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { parseTicketFile } from "../dist/tools/ticket-file.js";
import { resolveTicketDir } from "../dist/tools/config.js";

const P = "check-scenario-tests:";
const USAGE = `${P} usage: node scripts/check-scenario-tests.mjs --results <file> [--tickets <dir>] [--adapter <module>]`;
const OPTIONS = new Set(["--results", "--tickets", "--adapter"]);
const DEFAULT_ADAPTER = new URL("./scenario-results-node.mjs", import.meta.url);
const RANK = { passed: 0, skipped: 1, failed: 2 };

class CannotRun extends Error {}

function reason(err) {
  return String(err?.message ?? err).split(", ")[0];
}

function display(cwd, abs, given) {
  const rel = path.relative(cwd, abs);
  return rel.length > 0 && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel : given;
}

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!OPTIONS.has(arg)) throw new CannotRun(`${P} unknown option ${arg}\n${USAGE}`);
    const value = argv[i + 1];
    if (value === undefined || OPTIONS.has(value)) throw new CannotRun(USAGE);
    opts[arg.slice(2)] = value;
    i += 1;
  }
  if (opts.results === undefined) throw new CannotRun(USAGE);
  return opts;
}

function readTickets(cwd, given) {
  const dir = given === undefined ? resolveTicketDir(cwd) : path.resolve(cwd, given);
  const shownDir = given ?? display(cwd, dir, dir);
  if (!fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir)
      .filter((name) => name.endsWith(".md") && name.toLowerCase() !== "readme.md")
      .filter((name) => fs.statSync(path.join(dir, name)).isFile())
      .sort()
      .map((name) => {
        const abs = path.join(dir, name);
        const shown = display(cwd, abs, path.join(shownDir, name));
        return { shown, parsed: parseTicketFile(fs.readFileSync(abs, "utf8")) };
      });
  } catch (err) {
    throw new CannotRun(`${P} cannot read tickets ${shownDir}: ${reason(err)}`);
  }
}

async function loadReadResults(cwd, given) {
  const url = given === undefined ? DEFAULT_ADAPTER : pathToFileURL(path.resolve(cwd, given));
  const shown = given ?? DEFAULT_ADAPTER.pathname;
  const invalid = new CannotRun(`${P} adapter ${shown} has no readResults function`);
  let mod;
  try {
    mod = await import(url.href);
  } catch (err) {
    const why = reason(err).split("\n")[0].trim() || String(err?.name ?? "import failed");
    throw new CannotRun(`${invalid.message}\n${P} cannot load adapter ${shown}: ${why}`);
  }
  if (typeof mod.readResults !== "function") throw invalid;
  return mod.readResults;
}

async function readEntries(readResults, resultsPath, shown) {
  let entries;
  try {
    entries = await readResults(resultsPath);
  } catch (err) {
    const fsError = typeof err?.code === "string" && typeof err?.syscall === "string";
    throw new CannotRun(`${P} cannot ${fsError ? "read" : "parse"} results ${shown}: ${reason(err)}`);
  }
  if (!Array.isArray(entries)) {
    throw new CannotRun(`${P} cannot parse results ${shown}: readResults did not return an array`);
  }
  return entries;
}

function statusOf(entries, file, title) {
  const wanted = file.startsWith("./") ? file.slice(2) : file;
  let worst = null;
  for (const e of entries) {
    if (e?.file !== wanted || e?.title !== title) continue;
    const status = RANK[e.status] === undefined ? "failed" : e.status;
    if (worst === null || RANK[status] > RANK[worst]) worst = status;
  }
  return worst;
}

async function main(argv, cwd) {
  const opts = parseArgs(argv);
  const done = readTickets(cwd, opts.tickets).filter((t) => t.parsed.fields.status === "done");
  const problems = [];
  const named = [];
  for (const { shown, parsed } of done) {
    if (parsed.problems.length > 0) {
      problems.push(`${P} ${shown}: done ticket has format problems; run check-tickets on it`);
      continue;
    }
    const ticket = typeof parsed.fields.id === "string" ? parsed.fields.id : shown;
    for (const s of parsed.scenarios) {
      if (s.verification?.kind === "test") named.push({ ticket, scenario: s.id, ...s.verification });
    }
  }
  if (named.length === 0 && problems.length === 0) {
    return { out: [`${P} no named test in a done ticket; results not read`], code: 0 };
  }
  if (named.length > 0) {
    const readResults = await loadReadResults(cwd, opts.adapter);
    const entries = await readEntries(readResults, path.resolve(cwd, opts.results), opts.results);
    for (const t of named) {
      const head = `${P} ${t.ticket} ${t.scenario}:`;
      const status = statusOf(entries, t.file, t.title);
      if (status === null) {
        problems.push(`${head} test not found: ${t.file} — ${t.title} (if it was renamed, update this ticket's Verification line in the same change)`);
      } else if (status === "skipped") {
        problems.push(`${head} test was skipped: ${t.file} — ${t.title}`);
      } else if (status === "failed") {
        problems.push(`${head} test failed: ${t.file} — ${t.title}`);
      }
    }
  }
  const counts = `${named.length} named test(s)`;
  if (problems.length === 0) {
    return { out: [`${P} ok — ${counts} in ${done.length} done ticket(s) passed`], code: 0 };
  }
  problems.push(`${P} ${problems.length} problem(s) in ${counts} from ${done.length} done ticket(s)`);
  return { out: problems, code: 1 };
}

try {
  const { out, code } = await main(process.argv.slice(2), process.cwd());
  console.log(out.join("\n"));
  process.exitCode = code;
} catch (err) {
  console.error(err instanceof CannotRun ? err.message : `${P} ${err?.stack ?? err}`);
  process.exitCode = 2;
}
