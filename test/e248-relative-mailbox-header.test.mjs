// Coded by @qa-engineer
// T-E248-02 — tests for the primary-relative manifest `mailbox:` header
// (specs/e248-relative-mailbox-header.md AC1-AC9). Pins the
// resolveMailboxHeader contract, the render-only input error MAILBOX_TILDE,
// the non-fatal validate WARN, `--mailbox-root` precedence, and the
// no-primary skip (PRIMARY_NOT_FOUND is the only report).
//
// Manifest builder mirrors test/e177a-manifest.test.mjs's manifestText() /
// test/e235b-relative-worktree.test.mjs's rowWithWorktree() style so each
// assertion's cause stays visible next to the expectation. Every fixture is
// built under os.tmpdir(), never inside this repo.
//
// Spec-to-Test map:
//   AC1 -> "AC1 relative header resolves against primary"
//   AC2 -> "AC2 relative header, primary from git"
//   AC3 -> "AC3 absolute header unchanged"
//   AC4 -> "AC4 --mailbox-root precedence, flag semantics untouched"
//   AC5 -> "AC5 refusal: ~ header"
//   AC6 -> "AC6 refusal: empty / no header"
//   AC7 -> "AC7 relative header with no primary"
//   AC8 -> "AC8 validate follows the new semantics"
//   AC9 -> "AC9 format spec rows synced" (light in-repo check; the
//          authoritative proof is `git diff main -- specs/e177a-fanout-manifest.md`)

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  parseManifest,
  validateManifest,
  renderPrompt,
  runValidate,
  resolveMailboxHeader,
} from "../dist/tools/fanout-manifest.js";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

// ---------------------------------------------------------------------------
// Manifest builder — mirrors test/e177a-manifest.test.mjs's manifestText(),
// extended with an optional `mailboxLines` insert right after `base:` (the
// same position the sr-engineer diff uses in test/e177a-manifest.test.mjs's
// `wave7.replace(/^(base:.*)$/m, "$1\nmailbox: /hdr")` probe).
// ---------------------------------------------------------------------------

function manifestText({
  title = "# Fan-out: Test Plan",
  baseLine = "base: 1234567",
  mailboxLines = [],
  lanesHeader = "| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |",
  // Relative worktree cell so runValidate's own WORKTREE_ABSOLUTE_WARN never
  // pollutes the mailbox-specific WARN assertions below (AC8).
  lanesRows = ["| e1 | T1 | feat/e1-x | ../lanes/e1 | `src/a.ts` | `other/**` | 做：a　不做：b | 無 |"],
  pinsBullets = ["- e1：`sr-engineer=fable`"],
  decisionsHeader = "| 日期 | 裁決者 | 內容 | 出處 |",
  decisionsRows = [],
} = {}) {
  const parts = [title, baseLine, ...mailboxLines, ""];
  parts.push("## Lanes", lanesHeader, "|---|---|---|---|---|---|---|---|", ...lanesRows, "");
  parts.push("## Dispatch pins", ...pinsBullets, "");
  parts.push("## Decisions", decisionsHeader, "|---|---|---|---|", ...decisionsRows, "");
  return parts.join("\n");
}

function writeTmp(text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e248-mailbox-"));
  const file = path.join(dir, "manifest.md");
  fs.writeFileSync(file, text);
  return file;
}

// ---------------------------------------------------------------------------
// git repo helpers (mirrors test/e235b-relative-worktree.test.mjs mkRepo)
// ---------------------------------------------------------------------------

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** A fresh, throwaway repo under os.tmpdir() — never inside this repo. Realpath'd so macOS's /tmp -> /private/tmp symlink never causes a path-identity mismatch. */
function mkRepo(prefix = "e248-mailbox-repo-") {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  execFileSync("git", ["-c", "init.defaultBranch=main", "init", "-q"], { cwd: root });
  git(["config", "user.email", "a@b.c"], root);
  git(["config", "user.name", "t"], root);
  git(["config", "commit.gpgsign", "false"], root);
  fs.writeFileSync(path.join(root, "README.md"), "x");
  git(["add", "-A"], root);
  git(["commit", "-q", "-m", "init"], root);
  return root;
}

const FULL_BASE = { summary: "S", reading: ["R"] };

// ---------------------------------------------------------------------------
// AC1
// ---------------------------------------------------------------------------

test("AC1 relative header resolves against primary", () => {
  const m = parseManifest(manifestText({ mailboxLines: ["mailbox: ../lanes/_mailbox"] }));
  const r = renderPrompt(m, "e1", { ...FULL_BASE, primary: "/p" });
  assert.equal(r.ok, true);
  assert.match(r.prompt, /信箱: \/lanes\/_mailbox\/e1\//);
});

// ---------------------------------------------------------------------------
// AC2
// ---------------------------------------------------------------------------

test("AC2 relative header, primary from git", () => {
  const root = mkRepo();
  const m = parseManifest(manifestText({ mailboxLines: ["mailbox: ../lanes/_mailbox"] }));
  const r = renderPrompt(m, "e1", { ...FULL_BASE, manifestDir: root });
  assert.equal(r.ok, true);
  const expected = path.resolve(root, "../lanes/_mailbox");
  assert.match(
    r.prompt,
    new RegExp(`信箱: ${expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/e1/`),
    "the mailbox path must equal path.resolve(<rendered primary>, <header>) + \"/e1/\"",
  );
  // The primary line itself confirms it is the same primary the header resolved against.
  assert.match(r.prompt, new RegExp(`primary: ${root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} `));
});

// ---------------------------------------------------------------------------
// AC3
// ---------------------------------------------------------------------------

test("AC3 absolute header unchanged", () => {
  // Existing /hdr assertion is pinned in test/e177a-manifest.test.mjs (AC8);
  // this adds the not-normalized case the spec calls out (/a/./b stays as-is).
  const m = parseManifest(manifestText({ mailboxLines: ["mailbox: /a/./b"] }));
  const r = renderPrompt(m, "e1", { ...FULL_BASE, primary: "/p" });
  assert.equal(r.ok, true);
  assert.match(r.prompt, /信箱: \/a\/\.\/b\/e1\//, "an absolute header is not normalised, only the trailing-slash strip applies");

  // resolveMailboxHeader itself: byte-verbatim, no path.resolve/normalize call.
  const direct = resolveMailboxHeader("/a/./b", "/p");
  assert.deepEqual(direct, { ok: true, path: "/a/./b" });
});

// ---------------------------------------------------------------------------
// AC4
// ---------------------------------------------------------------------------

test("AC4 --mailbox-root precedence, flag semantics untouched", () => {
  // Flag beats a relative header.
  const relHeader = parseManifest(manifestText({ mailboxLines: ["mailbox: ../lanes/_mailbox"] }));
  const flagBeatsRel = renderPrompt(relHeader, "e1", { ...FULL_BASE, primary: "/p", mailboxRoot: "/m" });
  assert.equal(flagBeatsRel.ok, true);
  assert.match(flagBeatsRel.prompt, /信箱: \/m\/e1\//);

  // Flag beats a `~` header, and the malformed header raises no error at all.
  const tildeHeader = parseManifest(manifestText({ mailboxLines: ["mailbox: ~/mb"] }));
  const flagBeatsTilde = renderPrompt(tildeHeader, "e1", { ...FULL_BASE, primary: "/p", mailboxRoot: "/m" });
  assert.equal(flagBeatsTilde.ok, true, "a ~ header must not be checked at all once --mailbox-root is set");
  assert.match(flagBeatsTilde.prompt, /信箱: \/m\/e1\//);
  assert.ok(!("errors" in flagBeatsTilde) || flagBeatsTilde.errors === undefined);

  // The flag value itself is still used byte-for-byte, never resolved against primary.
  const relFlag = renderPrompt(relHeader, "e1", { ...FULL_BASE, primary: "/p", mailboxRoot: "rel" });
  assert.equal(relFlag.ok, true);
  assert.match(relFlag.prompt, /信箱: rel\/e1\//, "--mailbox-root stays verbatim, never resolved against primary");
});

// ---------------------------------------------------------------------------
// AC5
// ---------------------------------------------------------------------------

test("AC5 refusal: ~ header", () => {
  for (const cell of ["~/mb", "~", "~user/mb"]) {
    const m = parseManifest(manifestText({ mailboxLines: [`mailbox: ${cell}`] }));
    const r = renderPrompt(m, "e1", { ...FULL_BASE, primary: "/p" });
    assert.equal(r.ok, false, `header "${cell}" must be refused`);
    const err = r.errors.find((e) => e.code === "MAILBOX_TILDE");
    assert.ok(err, `MAILBOX_TILDE must be reported for "${cell}"`);
    assert.equal(err.scope, "input");
    assert.ok(!err.message.includes(os.homedir()), "the tilde must never be expanded to a real home directory");
    // The static explanation text itself contains a bare "~", so only the
    // non-trivial suffix (the part that would actually echo the header) is
    // checked for cells longer than the bare tilde.
    if (cell.length > 1) {
      assert.ok(!err.message.includes(cell), "the message must not echo the value");
    }
    assert.match(err.message, /home-directory expansion is not performed/);
  }

  // A leading-dot cell that merely contains "~" later is a normal relative path.
  const ok = resolveMailboxHeader("./~x", "/p");
  assert.deepEqual(ok, { ok: true, path: "/p/~x" });
});

// ---------------------------------------------------------------------------
// AC6
// ---------------------------------------------------------------------------

test("AC6 refusal: empty / no header", () => {
  // No header line at all.
  const noHeader = parseManifest(manifestText());
  const r1 = renderPrompt(noHeader, "e1", { ...FULL_BASE, primary: "/p" });
  assert.equal(r1.ok, false);
  assert.ok(r1.errors.some((e) => e.code === "MAILBOX_ROOT_ABSENT"));

  // A `mailbox:` line with no non-space value does not match MAILBOX_RE at all.
  const emptyHeader = parseManifest(manifestText({ mailboxLines: ["mailbox:   "] }));
  assert.equal(emptyHeader.mailbox, undefined, "an empty mailbox: line must not be captured");
  const r2 = renderPrompt(emptyHeader, "e1", { ...FULL_BASE, primary: "/p" });
  assert.equal(r2.ok, false);
  const err2 = r2.errors.find((e) => e.code === "MAILBOX_ROOT_ABSENT");
  assert.ok(err2);
  assert.equal(err2.message, "no mailbox root: pass --mailbox-root <dir> or add a \"mailbox: <dir>\" line to the manifest");

  // An empty / whitespace-only --mailbox-root falls through to the header, both with and without one present.
  const withHeader = parseManifest(manifestText({ mailboxLines: ["mailbox: /hdr"] }));
  const blankFlagWithHeader = renderPrompt(withHeader, "e1", { ...FULL_BASE, primary: "/p", mailboxRoot: "   " });
  assert.equal(blankFlagWithHeader.ok, true);
  assert.match(blankFlagWithHeader.prompt, /信箱: \/hdr\/e1\//);

  const blankFlagNoHeader = renderPrompt(noHeader, "e1", { ...FULL_BASE, primary: "/p", mailboxRoot: "" });
  assert.equal(blankFlagNoHeader.ok, false);
  assert.ok(blankFlagNoHeader.errors.some((e) => e.code === "MAILBOX_ROOT_ABSENT"));
});

// ---------------------------------------------------------------------------
// AC7
// ---------------------------------------------------------------------------

test("AC7 relative header with no primary", () => {
  const notRepo = fs.mkdtempSync(path.join(os.tmpdir(), "e248-notrepo-"));

  const relHeader = parseManifest(manifestText({ mailboxLines: ["mailbox: ../lanes/_mailbox"] }));
  const relResult = renderPrompt(relHeader, "e1", { ...FULL_BASE, manifestDir: notRepo });
  assert.equal(relResult.ok, false);
  assert.deepEqual(
    relResult.errors.map((e) => e.code),
    ["PRIMARY_NOT_FOUND"],
    "a relative header with no primary must report exactly {PRIMARY_NOT_FOUND} — no mailbox error, and it never falls back to cwd",
  );

  // With an absolute header in the same situation, the only error is still PRIMARY_NOT_FOUND.
  const absHeader = parseManifest(manifestText({ mailboxLines: ["mailbox: /hdr"] }));
  const absResult = renderPrompt(absHeader, "e1", { ...FULL_BASE, manifestDir: notRepo });
  assert.equal(absResult.ok, false);
  assert.deepEqual(absResult.errors.map((e) => e.code), ["PRIMARY_NOT_FOUND"]);

  // Reviewer's optional pin (accepted as intended behaviour, review_reports/review_T-E248-01.md
  // "Ruling"): a ~ header with no primary reports only PRIMARY_NOT_FOUND too (E235b worktree-skip
  // precedent) — the tilde check is skipped entirely when there is no primary to resolve against.
  const tildeHeader = parseManifest(manifestText({ mailboxLines: ["mailbox: ~/mb"] }));
  const tildeResult = renderPrompt(tildeHeader, "e1", { ...FULL_BASE, manifestDir: notRepo });
  assert.equal(tildeResult.ok, false);
  assert.deepEqual(
    tildeResult.errors.map((e) => e.code),
    ["PRIMARY_NOT_FOUND"],
    "a ~ header with no primary must report exactly {PRIMARY_NOT_FOUND}, not MAILBOX_TILDE",
  );

  fs.rmSync(notRepo, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// AC8
// ---------------------------------------------------------------------------

test("AC8 validate follows the new semantics", () => {
  // No header: no mailbox output line at all.
  const noHeaderFile = writeTmp(manifestText());
  const r0 = runValidate([noHeaderFile]);
  assert.equal(r0.exitCode, 0);
  assert.ok(!r0.stdout.includes("mailbox header"), "no header must produce no mailbox output line");

  // Relative header: no mailbox output line.
  const relFile = writeTmp(manifestText({ mailboxLines: ["mailbox: ../lanes/_mailbox"] }));
  const r1 = runValidate([relFile]);
  assert.equal(r1.exitCode, 0);
  assert.ok(!r1.stdout.includes("mailbox header"), "a relative header must produce no mailbox output line");

  // Absolute header: exactly one extra non-fatal WARN line, no path echoed.
  const absFile = writeTmp(manifestText({ mailboxLines: ["mailbox: /abs/mb"] }));
  const r2 = runValidate([absFile]);
  assert.equal(r2.exitCode, 0);
  const lines2 = r2.stdout.split("\n").filter((l) => l.length > 0);
  const warnLines = lines2.filter((l) => l.startsWith("WARN") && l.includes("mailbox header"));
  assert.equal(warnLines.length, 1, "exactly one extra mailbox WARN line for an absolute header");
  assert.equal(warnLines[0], "WARN  mailbox header (line 3): mailbox: is an absolute path — write it relative to primary (e.g. ../<lanes-dir>/_mailbox); render still accepts it");
  assert.ok(!r2.stdout.includes("/abs/mb"), "the absolute value itself must never be echoed");

  // ~ header: no validate line at all — tilde is a render-time-only refusal.
  const tildeFile = writeTmp(manifestText({ mailboxLines: ["mailbox: ~/mb"] }));
  const r3 = runValidate([tildeFile]);
  assert.equal(r3.exitCode, 0, "a ~ header must not fail validate");
  assert.ok(!r3.stdout.includes("mailbox header"), "a ~ header must produce no validate line — it is a render-only refusal");
});

// ---------------------------------------------------------------------------
// AC9 — light in-repo check. The authoritative proof is a git diff against
// main; this pins the sourced statements the diff must contain so a future
// edit to either row cannot silently drop one of them.
// ---------------------------------------------------------------------------

test("AC9 format spec rows synced", () => {
  const spec = fs.readFileSync(path.join(ROOT, "specs", "e177a-fanout-manifest.md"), "utf8");
  const mailboxRow = spec.split("\n").find((l) => l.includes("`mailbox:` (NEW, optional)"));
  const renderSourceRow = spec.split("\n").find((l) => l.trim().startsWith("| `信箱`"));
  assert.ok(mailboxRow, "the manifest-format mailbox: row must exist");
  assert.ok(renderSourceRow, "the render-field-sources 信箱 row must exist");

  for (const row of [mailboxRow, renderSourceRow]) {
    assert.ok(/primary-relative|resolved against primary/.test(row), `row must state the value may be primary-relative: ${row}`);
    assert.ok(/byte-for-byte/.test(row), `row must state an absolute value is taken byte-for-byte: ${row}`);
    assert.ok(/MAILBOX_TILDE/.test(row), `row must state a ~ value fails MAILBOX_TILDE: ${row}`);
    assert.ok(/--mailbox-root/.test(row), `row must mention --mailbox-root: ${row}`);
  }
  assert.ok(/WARNs on it/.test(mailboxRow), "the format row must state validate WARNs on an absolute value");
});
