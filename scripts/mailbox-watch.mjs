#!/usr/bin/env node
// Coded by @sr-engineer
// Lane <-> integrator mailbox watcher and sender (E177b, spec AC14-AC20; message
// format in docs/lane-protocol.md §5). Pure node; watch, re-arm, lock and send
// semantics and the shell loop it replaced: see specs/e260c-bin-scripts.md.
// Watch: node scripts/mailbox-watch.mjs <file | f1 f2 ...> [--baseline <N> | k1=N1,...] [--deadline <min>] [--interval <s>]
// Send:  node scripts/mailbox-watch.mjs <file> --send --from <lane|integrator> --type <t> --re <target> --body <text> [--hop <n>[/<cap>]] [--workspace <path>]
// Exit codes: 0 new message / sent; 3 deadline reached (re-arm); 4 refused (file already watched); 1 runtime error; 64 usage error.

import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_DEADLINE_MINUTES = 29;
export const DEFAULT_INTERVAL_SECONDS = 15;
export const EXIT_NEW_MESSAGE = 0;
export const EXIT_ERROR = 1;
export const EXIT_EXPIRED = 3;
export const EXIT_REFUSED = 4;
export const EXIT_USAGE = 64;
export const MESSAGE_TYPES = ["question", "proposal", "reply", "report", "escalate", "ack", "close", "reopen"];
const CORRUPT_LOCK_GRACE_MS = 10_000;
const MSG_LINE_RE = /^--- msg(?:[ \t].*)?$/;
const LANE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const USAGE = [
  "Usage:",
  "  watch: node scripts/mailbox-watch.mjs <file> [<file>...] [--baseline <N> | --baseline <key>=<N>,...]",
  "                                        [--deadline <minutes>] [--interval <seconds>]",
  "  send:  node scripts/mailbox-watch.mjs <file> --send --from <lane|integrator> --type <type>",
  "                                        --re <target> --body <text> [--hop <n>[/<cap>]] [--workspace <path>]",
].join("\n");

class UsageError extends Error {}

// ---------------------------------------------------------------------------
// Pure helpers (exported for tests)
// ---------------------------------------------------------------------------

/** Number of `--- msg` blocks in mailbox text. Always a single integer (AC14). */
export function countMessages(text) {
  if (!text) return 0;
  let n = 0;
  for (const line of text.split(/\r?\n/)) if (MSG_LINE_RE.test(line)) n++;
  return n;
}

/** Header fields of every message block, in file order. */
export function parseMessageHeaders(text) {
  const out = [];
  if (!text) return out;
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    if (MSG_LINE_RE.test(line)) {
      cur = {};
      out.push(cur);
      continue;
    }
    if (cur === null) continue;
    if (line === "---") {
      cur = null; // header closed; body follows
      continue;
    }
    const m = /^([a-z]+):\s?(.*)$/.exec(line);
    if (m && !(m[1] in cur)) cur[m[1]] = m[2];
  }
  return out;
}

/** The next seq for a mailbox file: last (max) header seq + 1; 1 when empty. */
export function nextSeq(text) {
  let max = 0;
  for (const h of parseMessageHeaders(text)) {
    const n = Number.parseInt(h.seq ?? "", 10);
    if (Number.isInteger(n) && n > max) max = n;
  }
  return max + 1;
}

/** UTC ISO-8601 to the second, same shape as `date -u +%FT%TZ`. */
export function formatUtcSecond(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Baseline key for a watched file: its parent directory name (the lane). */
export function laneKeyForFile(file) {
  return path.basename(path.dirname(path.resolve(file)));
}

/**
 * Map each file to its key; throws when two files resolve to the same key
 * (AC20 / integrator note: error loudly, never overwrite).
 */
export function assignKeys(files) {
  const byKey = new Map();
  for (const f of files) {
    const key = laneKeyForFile(f);
    if (byKey.has(key)) {
      throw new Error(
        `duplicate baseline key "${key}": ${byKey.get(key)} and ${path.resolve(f)} both resolve to it (key = the mailbox file's parent directory) — refusing to watch both`,
      );
    }
    byKey.set(key, path.resolve(f));
  }
  return byKey;
}

/**
 * Parse a --baseline value against the watched keys. Returns Map<key, N>
 * (keys absent from the value are absent from the map).
 *   "N"            -> every key gets N
 *   "k1=N1,k2=N2"  -> per key; an unknown or repeated key throws
 */
export function parseBaselineArg(value, keys) {
  const result = new Map();
  if (value === undefined || value === null) return result;
  const v = String(value).trim();
  const isCount = (s) => /^\d+$/.test(s);
  if (isCount(v)) {
    for (const k of keys) result.set(k, Number(v));
    return result;
  }
  for (const part of v.split(",")) {
    const p = part.trim();
    if (!p) continue;
    const eq = p.lastIndexOf("=");
    if (eq <= 0) throw new UsageError(`bad --baseline entry "${p}" (expected <N> or <key>=<N>,...)`);
    const k = p.slice(0, eq).trim();
    const n = p.slice(eq + 1).trim();
    if (!isCount(n)) throw new UsageError(`bad --baseline count for "${k}": "${n}"`);
    if (!keys.includes(k)) throw new UsageError(`--baseline key "${k}" matches no watched file (keys: ${keys.join(", ")})`);
    if (result.has(k)) throw new UsageError(`--baseline key "${k}" given twice`);
    result.set(k, Number(n));
  }
  if (result.size === 0) throw new UsageError("empty --baseline");
  return result;
}

/** Quote one argument for a POSIX shell only when it needs it. */
export function shellQuote(s) {
  if (/^[A-Za-z0-9_\/.,:=@%+-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/**
 * The ready-to-run re-arm command (Copy/Strings watch.rearm-hint). `entries`
 * is [{ file, key, lastRead }]. Single file -> `--baseline N`; multi ->
 * `--baseline k1=N1,k2=N2,...`. Non-default --deadline/--interval are carried.
 */
export function formatRearmCommand(entries, { deadlineMinutes, intervalSeconds } = {}) {
  const files = entries.map((e) => shellQuote(e.file)).join(" ");
  const baseline =
    entries.length === 1 ? String(entries[0].lastRead) : entries.map((e) => `${e.key}=${e.lastRead}`).join(",");
  let cmd = `node scripts/mailbox-watch.mjs ${files} --baseline ${shellQuote(baseline)}`;
  if (deadlineMinutes !== undefined && deadlineMinutes !== DEFAULT_DEADLINE_MINUTES) cmd += ` --deadline ${deadlineMinutes}`;
  if (intervalSeconds !== undefined && intervalSeconds !== DEFAULT_INTERVAL_SECONDS) cmd += ` --interval ${intervalSeconds}`;
  return `re-arm with: ${cmd}`;
}

/**
 * Normalize --re to §5's file-qualified form. `mailboxName` is the basename
 * of the file being written.
 */
export function normalizeRe(target, mailboxName) {
  const t = String(target ?? "").trim();
  if (!t) throw new UsageError("--re requires a value");
  if (/[\r\n]/.test(t)) throw new UsageError("--re must be a single line");
  const q = /^(to-lane|to-integrator)(?:\.md)?#(\d+)$/.exec(t);
  if (q) return `${q[1]}#${Number(q[2])}`;
  const bare = /^#?(\d+)$/.exec(t);
  if (bare) {
    if (mailboxName === "to-integrator.md") return `to-lane#${Number(bare[1])}`;
    if (mailboxName === "to-lane.md") return `to-integrator#${Number(bare[1])}`;
    throw new UsageError(`bare --re "${t}" is ambiguous for ${mailboxName}; write <file>#<n>`);
  }
  return t; // short topic, kept verbatim (§5 allows it)
}

/** Build one §5 message block (no leading separator, trailing newline). */
export function buildMessageBlock({ seq, from, type, re, time, hop, body }) {
  return `--- msg\nseq: ${seq}\nfrom: ${from}\ntype: ${type}\nre: ${re}\ntime: ${time}\nhop: ${hop}\n---\n${body}\n`;
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

export function parseMailboxArgs(argv) {
  const out = {
    files: [],
    send: false,
    baseline: undefined,
    deadlineMinutes: DEFAULT_DEADLINE_MINUTES,
    intervalSeconds: DEFAULT_INTERVAL_SECONDS,
    from: undefined,
    type: undefined,
    re: undefined,
    body: undefined,
    hop: undefined,
    workspace: undefined,
  };
  const valueFlags = new Set(["--baseline", "--deadline", "--interval", "--from", "--type", "--re", "--body", "--hop", "--workspace"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--send") {
      out.send = true;
    } else if (valueFlags.has(a)) {
      const v = argv[i + 1];
      if (v === undefined) throw new UsageError(`${a} requires a value`);
      i++;
      const key = a.slice(2);
      if (key === "deadline" || key === "interval") {
        const n = Number(v);
        if (!Number.isFinite(n) || n <= 0) throw new UsageError(`${a} requires a positive number`);
        if (key === "deadline") out.deadlineMinutes = n;
        else out.intervalSeconds = n;
      } else {
        out[key] = v;
      }
    } else if (a.startsWith("--")) {
      throw new UsageError(`unknown option: ${a}`);
    } else {
      out.files.push(a);
    }
  }
  if (out.files.length === 0) throw new UsageError("no mailbox file given");
  if (out.send) {
    if (out.files.length !== 1) throw new UsageError("--send takes exactly one mailbox file");
    for (const k of ["from", "type", "re", "body"]) {
      if (out[k] === undefined) throw new UsageError(`--send requires --${k}`);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Watch-lock (AC17)
// ---------------------------------------------------------------------------

function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err && err.code === "EPERM";
  }
}

/** Sidecar lock path for a watched mailbox file. */
export function watchLockPath(file) {
  const abs = path.resolve(file);
  return path.join(path.dirname(abs), `.${path.basename(abs)}.watch-lock`);
}

/** Try to take the watch-lock for `file`. { ok: true, lockPath } | { ok: false, holder } */
function takeWatchLock(file) {
  const lockPath = watchLockPath(file);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      try {
        fs.writeSync(fd, JSON.stringify({ pid: process.pid, startedAt: formatUtcSecond(), file: path.resolve(file) }));
      } finally {
        fs.closeSync(fd);
      }
      return { ok: true, lockPath };
    } catch (err) {
      if (!err || err.code !== "EEXIST") throw err;
    }
    let raw;
    try {
      raw = fs.readFileSync(lockPath, "utf-8");
    } catch {
      continue; // released in between
    }
    let holder = null;
    try {
      holder = JSON.parse(raw);
    } catch {
      holder = null;
    }
    const valid = holder && Number.isInteger(holder.pid);
    if (valid && isPidAlive(holder.pid)) return { ok: false, holder };
    if (!valid) {
      let mtimeMs = Date.now();
      try {
        mtimeMs = fs.statSync(lockPath).mtimeMs;
      } catch {
        /* ignore */
      }
      if (Date.now() - mtimeMs <= CORRUPT_LOCK_GRACE_MS) return { ok: false, holder: { pid: "?", startedAt: "just now" } };
    }
    // Dead holder (or long-corrupt payload): reclaim via rename-aside + verify.
    const aside = `${lockPath}.stale-${process.pid}-${Date.now()}`;
    try {
      fs.renameSync(lockPath, aside);
      const again = fs.readFileSync(aside, "utf-8");
      if (again !== raw) {
        try {
          fs.linkSync(aside, lockPath);
        } catch {
          /* ignore */
        }
      }
      fs.unlinkSync(aside);
    } catch {
      /* another process reclaimed first — retry */
    }
  }
  return { ok: false, holder: { pid: "?", startedAt: "unknown" } };
}

function releaseWatchLock(lockPath) {
  try {
    const data = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
    if (data && data.pid === process.pid) fs.unlinkSync(lockPath);
  } catch {
    /* best effort */
  }
}

// ---------------------------------------------------------------------------
// Watch mode
// ---------------------------------------------------------------------------

function readCount(file, fallback) {
  try {
    return { count: countMessages(fs.readFileSync(file, "utf-8")), error: null };
  } catch (err) {
    if (err && err.code === "ENOENT") return { count: 0, error: null };
    return { count: fallback, error: err && err.message ? err.message : String(err) };
  }
}

async function runWatch(args, io) {
  const keysByFile = assignKeys(args.files); // throws on duplicate key
  const keys = [...keysByFile.keys()];
  const single = keys.length === 1;
  const baselines = parseBaselineArg(args.baseline, keys);

  for (const file of keysByFile.values()) {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      io.err(`mailbox-watch: mailbox directory does not exist: ${dir}`);
      return EXIT_ERROR;
    }
  }

  // AC17 — one watch per file.
  const held = [];
  const releaseAll = () => {
    for (const l of held.splice(0)) releaseWatchLock(l);
  };
  for (const [key, file] of keysByFile) {
    const r = takeWatchLock(file);
    if (!r.ok) {
      releaseAll();
      io.err(
        `mailbox-watch: refusing to start — ${file} [${key}] is already being watched by pid ${r.holder.pid} (since ${r.holder.startedAt}). Only one watch per mailbox file; stop that watch first.`,
      );
      return EXIT_REFUSED;
    }
    held.push(r.lockPath);
  }
  const onExit = () => releaseAll();
  process.on("exit", onExit);
  const signalCodes = { SIGINT: 130, SIGTERM: 143, SIGHUP: 129 };
  const onSignal = (sig) => {
    releaseAll();
    process.exit(signalCodes[sig] ?? 1);
  };
  for (const s of Object.keys(signalCodes)) process.on(s, onSignal);

  try {
    const entries = [];
    for (const [key, file] of keysByFile) {
      const { count, error } = readCount(file, 0);
      if (error) io.err(`mailbox-watch: cannot read ${file}: ${error} (treating as 0)`);
      const hasBaseline = baselines.has(key);
      const baseline = hasBaseline ? baselines.get(key) : count;
      if (!hasBaseline && !single) io.err(`mailbox-watch: no baseline for "${key}" — arming at its current count ${count}`);
      entries.push({ key, file, baseline, lastRead: count });
      io.out(single ? `armed: baseline ${baseline}, current ${count}` : `[${key}] armed: baseline ${baseline}, current ${count}`);
    }

    const deadlineAt = io.now() + args.deadlineMinutes * 60_000;
    const intervalMs = args.intervalSeconds * 1000;
    let first = true;
    for (;;) {
      if (!first) {
        const wait = Math.max(0, Math.min(intervalMs, deadlineAt - io.now()));
        await io.sleep(wait);
      }
      // Deadline check BEFORE any fresh read: the printed baselines are the
      // counts this watch last READ, never a re-sample taken at expiry (AC16).
      if (io.now() >= deadlineAt) {
        io.out("expiring — re-arm");
        io.out(
          formatRearmCommand(
            entries.map((e) => ({ file: e.file, key: e.key, lastRead: e.lastRead })),
            { deadlineMinutes: args.deadlineMinutes, intervalSeconds: args.intervalSeconds },
          ),
        );
        return EXIT_EXPIRED;
      }
      for (const e of entries) {
        const { count, error } = first ? { count: e.lastRead, error: null } : readCount(e.file, e.lastRead);
        if (error) io.err(`mailbox-watch: cannot read ${e.file}: ${error} (keeping last count ${e.lastRead})`);
        e.lastRead = count;
        if (count > e.baseline) {
          if (single) {
            io.out(`new message: count ${count} (baseline ${e.baseline}) — ${e.file}`);
            return EXIT_NEW_MESSAGE;
          }
          io.out(`changed: ${e.key} count ${count} (was ${e.baseline}) — ${e.file}`);
          e.baseline = count;
        } else if (count < e.baseline) {
          io.out(`${single ? "" : `[${e.key}] `}reset: count ${count} is below baseline ${e.baseline} — re-basing to ${count} — ${e.file}`);
          e.baseline = count;
        }
      }
      first = false;
    }
  } finally {
    releaseAll();
    process.off("exit", onExit);
    for (const s of Object.keys(signalCodes)) process.off(s, onSignal);
  }
}

// ---------------------------------------------------------------------------
// Send mode (AC18)
// ---------------------------------------------------------------------------

async function resolveHop(args) {
  if (args.from === "integrator") return "—";
  let n = null;
  let cap = null;
  if (args.hop !== undefined) {
    const m = /^(\d+)(?:\/(\d+))?$/.exec(String(args.hop).trim());
    if (!m) throw new UsageError(`bad --hop "${args.hop}" (expected <n> or <n>/<cap>)`);
    n = Number(m[1]);
    if (m[2] !== undefined) cap = Number(m[2]);
  }
  if (n === null) {
    const ws = path.resolve(args.workspace ?? process.cwd());
    const { parseHandoff } = await import(new URL("../dist/tools/handoff-parse.js", import.meta.url).href);
    const state = parseHandoff(ws);
    if (!state || typeof state.hop_count !== "number") {
      throw new Error(`cannot read hop_count from the handoff in ${ws}; pass --hop <n>`);
    }
    n = state.hop_count;
  }
  if (cap === null) {
    const { HOP_CAP_EXPORTED } = await import(new URL("../dist/tools/transitions.js", import.meta.url).href);
    cap = HOP_CAP_EXPORTED;
  }
  return `${n}/${cap}`;
}

async function runSend(args, io) {
  const file = path.resolve(args.files[0]);
  const name = path.basename(file);
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    io.err(`mailbox-watch: mailbox directory does not exist: ${dir}`);
    return EXIT_ERROR;
  }
  const from = String(args.from).trim();
  if (from !== "integrator" && !LANE_NAME_RE.test(from)) throw new UsageError(`bad --from "${from}" (a lane name or "integrator")`);
  if (name === "to-integrator.md" && from === "integrator") throw new UsageError("to-integrator.md is written only by the lane, not the integrator");
  if (name === "to-lane.md" && from !== "integrator") throw new UsageError("to-lane.md is written only by the integrator");
  const type = String(args.type).trim();
  if (!MESSAGE_TYPES.includes(type)) throw new UsageError(`bad --type "${type}" (one of: ${MESSAGE_TYPES.join(", ")})`);
  const re = normalizeRe(args.re, name);
  const body = String(args.body).replace(/\s+$/, "");
  if (!body.trim()) throw new UsageError("--body must not be empty");
  if (body.split(/\r?\n/).some((l) => MSG_LINE_RE.test(l))) {
    throw new UsageError("--body must not contain a line starting with `--- msg` (it would corrupt message counting)");
  }
  const hop = await resolveHop(args);

  let existing = "";
  try {
    existing = fs.readFileSync(file, "utf-8");
  } catch (err) {
    if (!err || err.code !== "ENOENT") throw err;
  }
  const seq = nextSeq(existing);
  const block = buildMessageBlock({ seq, from, type, re, time: formatUtcSecond(io.date()), hop, body });
  const sep = existing === "" ? "" : existing.endsWith("\n") ? "\n" : "\n\n";
  fs.appendFileSync(file, sep + block, "utf-8");
  io.out(`sent: ${name}#${seq} (type ${type}, re ${re}, hop ${hop})`);
  return EXIT_NEW_MESSAGE;
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

const defaultIo = {
  out: (l) => process.stdout.write(`${l}\n`),
  err: (l) => process.stderr.write(`${l}\n`),
  now: () => Date.now(),
  date: () => new Date(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

export async function main(argv = process.argv.slice(2), io = defaultIo) {
  const ioAll = { ...defaultIo, ...io };
  try {
    const args = parseMailboxArgs(argv);
    return args.send ? await runSend(args, ioAll) : await runWatch(args, ioAll);
  } catch (err) {
    if (err instanceof UsageError) {
      ioAll.err(`mailbox-watch: ${err.message}\n${USAGE}`);
      return EXIT_USAGE;
    }
    ioAll.err(`mailbox-watch: ${err && err.message ? err.message : String(err)}`);
    return EXIT_ERROR;
  }
}

function invokedDirectly() {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  main().then((code) => {
    process.exitCode = code;
  });
}
