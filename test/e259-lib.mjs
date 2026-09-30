// Coded by @qa-engineer
// Shared helpers for the e259-*.test.mjs comment-scan language tests.
// Sample sources live in test/fixtures/e259/*.fixture.txt, never scanned.

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { analyzeText } from "../dist/tools/comment-scan.js";
import { langForPath } from "../dist/tools/comment-langs.js";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PREFIX = "agc check — comments";
const AGC_INIT = path.join(ROOT, "bin", "agc-init.mjs");
const FIX = path.join(ROOT, "test", "fixtures", "e259");
const tmpDirs = [];

export function cleanup() {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
}

function mkTmp(prefix) {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  tmpDirs.push(d);
  return d;
}

const emptyCfg = path.join(mkTmp("e259-cfg-"), "empty.gitconfig");
fs.writeFileSync(emptyCfg, "");

function baseEnv() {
  return { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: emptyCfg, GIT_CEILING_DIRECTORIES: fs.realpathSync(os.tmpdir()) };
}

function git(cwd, args) {
  const id = ["-c", "user.email=qa@example.invalid", "-c", "user.name=qa"];
  return execFileSync("git", [...id, ...args], { cwd, env: baseEnv(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

export function fixture(name) {
  return fs.readFileSync(path.join(FIX, `${name}.fixture.txt`), "utf-8");
}

export function mkRepo(prefix) {
  const repo = mkTmp(prefix);
  git(repo, ["init", "-q", "-b", "main"]);
  fs.writeFileSync(path.join(repo, "seed.txt"), "seed\n");
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-q", "-m", "seed"]);
  return repo;
}

// Writes every file under its real name into a fresh temp repo and runs `agc check` once.
export function check(files, prefix = "e259-") {
  const repo = mkRepo(prefix);
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(repo, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
  const r = spawnSync(process.execPath, [AGC_INIT, "check"], { cwd: repo, env: baseEnv(), encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
  const lines = r.stderr.split("\n").filter((l) => l.startsWith(PREFIX));
  const blocks = {};
  for (const l of lines) {
    const m = /^agc check — comments: (\S+):(\d+) long-block (\d+) lines/.exec(l);
    if (m) (blocks[m[1]] ??= []).push({ line: Number(m[2]), count: Number(m[3]) });
  }
  return { status: r.status, lines, blocks, stderr: r.stderr };
}

export function analyze(rel, text) {
  const lang = langForPath(rel);
  if (lang === null) throw new Error(`not scannable: ${rel}`);
  return analyzeText(text, lang);
}

export const kinds = (rel, text) => analyze(rel, text).lines.map((l) => l.kind);
export const counted = (rel, text) => analyze(rel, text).blocks.map((b) => b.counted);

export const join = (lines) => lines.join("\n") + "\n";
export const run = (n, lead, tag = "note") => Array.from({ length: n }, (_, i) => `${lead} ${tag} ${i + 1}`);
