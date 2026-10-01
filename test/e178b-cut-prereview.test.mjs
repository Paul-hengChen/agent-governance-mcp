// Coded by @qa-engineer
// Tests (T-E178B-04) for the cut pre-review fan-in check in tools/lane-status.ts: whether a lane's written cut was sent to the integrator for pre-review
// (E178b; specs/e178b-lane-watch-tooling.md decisions (g)/(h)/(j), AC10-AC14; the watch-mode transition, AC15, is in test/e178b-lane-watch.test.mjs). A lane with a written cut
// (specs/<active_feature>.md) but no cut proposal in its to-integrator.md must be reported `missing` explicitly (Wave 7.1 e212 sent none and nothing noticed); a non-proposal that merely mentions a cut does not count;
// the check is report-only (exit 0) and emits nothing without --mailbox-root. Fixtures are copies of the recognizer corpus under test/fixtures/e178b/mailbox/<lane>/; lane workspaces are temp dirs named by lane, served through an injected LaneListProvider.
// Rationale: specs/e260f-comment-rationale.md (test/e178b-cut-prereview.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkCutPrereview,
  isCutPrereviewMessage,
  parseMailboxHeaders,
  runLaneStatusCli,
  LANE_TO_INTEGRATOR_FILE,
} from "../dist/tools/lane-status.js";
import { parseMessageHeaders } from "../scripts/mailbox-watch.mjs";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const MAILBOX = path.join(ROOT, "test", "fixtures", "e178b", "mailbox");
const FEATURE = "e901-fixture-feature";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** A temp parent dir holding one workspace dir per lane (basename = lane). */
function mkParent(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "e178b-prereview-")));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** One lane workspace; `spec: true` writes specs/<feature>.md (the "has a cut" signal). */
function mkLane(parent, lane, { spec = true, feature = FEATURE } = {}) {
  const ws = path.join(parent, lane);
  fs.mkdirSync(ws, { recursive: true });
  if (spec) {
    fs.mkdirSync(path.join(ws, "specs"), { recursive: true });
    fs.writeFileSync(path.join(ws, "specs", `${feature}.md`), `# ${feature}\n`);
  }
  return ws;
}

/**
 * Synthetic LaneListProvider over the given lanes. `readable: false` models a
 * lane whose handoff could not be read; `feature: null` a lane with none.
 */
function provider(lanes) {
  return () => ({
    source: "local-fallback",
    degraded: false,
    lanes: lanes.map((l) => ({
      workspacePath: l.ws,
      branch: null, // no commit range: keeps the one-shot path off real git refs
      activeFeature: l.feature === undefined ? FEATURE : l.feature,
      status: "In_Progress",
      hopCount: 1,
      lastAgent: "pm",
      lastUpdated: null,
      readable: l.readable !== false,
      ...(l.readable === false && { error: "handoff could not be parsed (fixture)" }),
      completedTasks: [],
    })),
  });
}

/** Handoff reader matching the provider: a handoff naming the lane's feature. */
function reader(lanes) {
  return (ws) => {
    const l = lanes.find((x) => x.ws === ws);
    return { active_feature: l.feature === undefined ? FEATURE : l.feature, review_round: 0, qa_round: 0, completed_tasks: [] };
  };
}

function cli(argv, lanes) {
  return runLaneStatusCli(argv, { laneListProvider: provider(lanes), handoffReader: reader(lanes), gitTimeoutMs: 5000 });
}

function check(ws, lane, extra = {}) {
  return checkCutPrereview({ workspacePath: ws, lane, activeFeature: FEATURE, readable: true, mailboxRoot: MAILBOX, ...extra });
}

const mailboxFile = (lane) => path.join(MAILBOX, lane, LANE_TO_INTEGRATOR_FILE);

// ---------------------------------------------------------------------------
// A proposal is present: reported as sent (AC10)
// ---------------------------------------------------------------------------

test("AC10 sent", { timeout: 30000 }, (t) => {
  const parent = mkParent(t);
  // Every recognized `re:` variant from decision (g), each in its own lane.
  // sent-first carries a question and a report that mention "cut" BEFORE the
  // first proposal (seq 3) and a second matching proposal AFTER it (seq 4):
  // the state must name the FIRST matching block, not the first block and not
  // the last match.
  const cases = [
    ["sent-first", "3", "E177a PM cut pre-review"],
    ["v-cut-draft", "1", "cut-draft"],
    ["v-cut-task", "5", "cut T-E204-01"],
    ["v-yushen", "2", "e126 cut 預審"],
    ["v-yushen-only", "7", "請預審 spec"],
    ["v-upper", "9", "PM CUT Pre-Review"],
  ];
  for (const [lane, seq, re] of cases) {
    const ws = mkLane(parent, lane);
    const c = check(ws, lane);
    assert.equal(c.state, "sent", `${lane}: state`);
    assert.equal(c.text, `sent (to-integrator#${seq})`, `${lane}: text`);
    assert.equal(c.seq, seq, `${lane}: seq`);
    assert.equal(c.re, re, `${lane}: re`);
    assert.equal(c.mailboxFile, mailboxFile(lane));
    assert.equal(c.mailboxFileExists, true);
    assert.equal(c.specFile, `specs/${FEATURE}.md`);
  }

  // The same state reaches both CLI surfaces.
  const lanes = [{ ws: path.join(parent, "sent-first") }];
  const text = cli(["--mailbox-root", MAILBOX], lanes);
  assert.equal(text.exitCode, 0);
  assert.ok(text.output.split("\n").includes("  cut pre-review: sent (to-integrator#3)"), text.output);
  const json = JSON.parse(cli(["--mailbox-root", MAILBOX, "--json"], lanes).output);
  assert.equal(json.lanes[0].cutPrereview.state, "sent");
  assert.equal(json.lanes[0].cutPrereview.seq, "3");
});

// ---------------------------------------------------------------------------
// Written cut but no proposal: `missing`; non-proposal messages ignored (AC11)
// ---------------------------------------------------------------------------

test("AC11 missing explicit", { timeout: 30000 }, (t) => {
  const parent = mkParent(t);

  // (a) mailbox file present, no matching block.
  const wsA = mkLane(parent, "no-match");
  const a = check(wsA, "no-match");
  assert.equal(a.state, "missing");
  assert.equal(a.mailboxFileExists, true);
  assert.equal(a.text, `missing — specs/${FEATURE}.md exists but ${mailboxFile("no-match")} has no cut proposal`);

  // (b) the lane's mailbox dir exists but to-integrator.md does not: still
  // `missing` (decision (g)), distinguished only by mailboxFileExists.
  const wsB = mkLane(parent, "empty-dir");
  const b = check(wsB, "empty-dir");
  assert.equal(b.state, "missing");
  assert.equal(b.mailboxFileExists, false);
  assert.equal(b.text, `missing — specs/${FEATURE}.md exists but ${mailboxFile("empty-dir")} has no cut proposal`);

  // One-shot text: the explicit line under that lane's block — the whole
  // point is that the skip is SAID, not implied by an absent line.
  const lanes = [{ ws: wsA }, { ws: wsB }];
  const out = cli(["--mailbox-root", MAILBOX], lanes).output.split("\n");
  for (const [ws, lane] of [[wsA, "no-match"], [wsB, "empty-dir"]]) {
    const header = out.indexOf(`[${lane}] ${ws}`);
    assert.ok(header >= 0, `lane block header for ${lane} present:\n${out.join("\n")}`);
    const block = [];
    for (let i = header + 1; i < out.length && out[i].startsWith("  "); i++) block.push(out[i]);
    assert.ok(
      block.includes(`  cut pre-review: missing — specs/${FEATURE}.md exists but ${mailboxFile(lane)} has no cut proposal`),
      `missing line inside ${lane}'s block:\n${block.join("\n")}`,
    );
  }

  // JSON rows carry cutPrereview: { state: "missing", ... }.
  const json = JSON.parse(cli(["--mailbox-root", MAILBOX, "--json"], lanes).output);
  assert.deepEqual(json.lanes.map((r) => r.cutPrereview.state), ["missing", "missing"]);
  assert.equal(json.lanes[0].cutPrereview.mailboxFile, mailboxFile("no-match"));
});

test("AC11 non-proposal ignored", () => {
  // The no-match fixture holds a proposal about something else, a report and
  // an ack whose re: both mention a cut, and body lines that LOOK like
  // `type: proposal` / `re: cut pre-review` after the header closed.
  const text = fs.readFileSync(mailboxFile("no-match"), "utf8");
  const headers = parseMailboxHeaders(text);
  assert.deepEqual(headers.map((h) => h.type), ["proposal", "report", "ack"]);
  assert.equal(headers[0].re, "api shape for the watch line", "body lines never overwrite header fields");
  assert.equal(headers.some(isCutPrereviewMessage), false);

  // The recognizer in isolation: type must be exactly proposal.
  assert.equal(isCutPrereviewMessage({ type: "report", re: "cut pre-review" }), false);
  assert.equal(isCutPrereviewMessage({ type: "ack", re: "cut 預審" }), false);
  assert.equal(isCutPrereviewMessage({ type: "question", re: "cut" }), false);
  assert.equal(isCutPrereviewMessage({ type: "proposal" }), false, "a proposal with no re: is not a cut proposal");
  assert.equal(isCutPrereviewMessage({ re: "cut" }), false, "no type: is not a proposal");
  assert.equal(isCutPrereviewMessage({ type: "proposal", re: "CuT" }), true, "case-insensitive");
  assert.equal(isCutPrereviewMessage({ type: "proposal", re: "預審" }), true);
});

// ---------------------------------------------------------------------------
// The other states: n/a, not-checked, no-mailbox (AC12)
// ---------------------------------------------------------------------------

test("AC12 other states", { timeout: 30000 }, (t) => {
  const parent = mkParent(t);

  // No spec -> n/a, even though the lane's mailbox has a matching proposal.
  const wsNa = mkLane(parent, "sent-first", { spec: false });
  assert.equal(check(wsNa, "sent-first").state, "n/a");
  assert.equal(check(wsNa, "sent-first").text, "n/a");

  // Unreadable lane -> not-checked (nothing to scope the spec by).
  assert.equal(check(wsNa, "sent-first", { readable: false }).state, "not-checked");
  // No active_feature -> not-checked.
  assert.equal(check(wsNa, "sent-first", { activeFeature: null }).state, "not-checked");
  assert.equal(check(wsNa, "sent-first", { activeFeature: "  " }).state, "not-checked");

  // Spec but no <dir>/<lane>/ -> no-mailbox, printed explicitly.
  const wsNm = mkLane(parent, "lane-without-mailbox");
  const nm = check(wsNm, "lane-without-mailbox");
  assert.equal(nm.state, "no-mailbox");
  assert.equal(nm.text, `no-mailbox — ${path.join(MAILBOX, "lane-without-mailbox")}/ does not exist`);

  const wsBad = mkLane(parent, "unreadable-lane");
  const lanes = [{ ws: wsNa }, { ws: wsNm }, { ws: wsBad, readable: false }];
  const out = cli(["--mailbox-root", MAILBOX], lanes).output.split("\n");
  assert.ok(out.includes("  cut pre-review: n/a"), out.join("\n"));
  assert.ok(out.includes(`  cut pre-review: no-mailbox — ${path.join(MAILBOX, "lane-without-mailbox")}/ does not exist`));
  assert.ok(out.includes("  cut pre-review: not-checked"));
  const json = JSON.parse(cli(["--mailbox-root", MAILBOX, "--json"], lanes).output);
  assert.deepEqual(json.lanes.map((r) => r.cutPrereview.state), ["n/a", "no-mailbox", "not-checked"]);

  // Decision (j): without --mailbox-root, no line and no JSON field at all.
  const plain = cli([], lanes).output;
  assert.doesNotMatch(plain, /cut pre-review/);
  const plainJson = JSON.parse(cli(["--json"], lanes).output);
  for (const row of plainJson.lanes) {
    assert.equal(Object.hasOwn(row, "cutPrereview"), false, "no cutPrereview key without --mailbox-root");
  }
  // --mailbox-root is scoped to the lane listing (and --watch): the roll-up
  // renderers never read it, so accepting it there would be a silent no-op.
  for (const mode of [["--rollup", FEATURE], ["--lanes", "a"], ["--all"]]) {
    const r = cli([...mode, "--mailbox-root", MAILBOX], lanes);
    assert.equal(r.exitCode, 64, `${mode[0]} + --mailbox-root is a usage error`);
    assert.match(r.output, /^lane-status: /);
  }
});

// ---------------------------------------------------------------------------
// Exit code is unchanged by the check's findings (AC13)
// ---------------------------------------------------------------------------

test("AC13 exit code unchanged", { timeout: 30000 }, (t) => {
  const parent = mkParent(t);
  // One lane in each of the five states in the same report.
  const lanes = [
    { ws: mkLane(parent, "v-cut-draft") }, // sent
    { ws: mkLane(parent, "no-match") }, // missing
    { ws: mkLane(parent, "lane-without-mailbox") }, // no-mailbox
    { ws: mkLane(parent, "v-upper", { spec: false }) }, // n/a
    { ws: mkLane(parent, "unreadable-lane"), readable: false }, // not-checked
  ];
  for (const argv of [["--mailbox-root", MAILBOX], ["--mailbox-root", MAILBOX, "--json"]]) {
    const r = cli(argv, lanes);
    assert.equal(r.exitCode, 0, `${argv.join(" ")}: a reporting surface exits 0 even with missing lanes`);
    assert.equal(r.stream, "stdout");
  }
  const json = JSON.parse(cli(["--mailbox-root", MAILBOX, "--json"], lanes).output);
  assert.deepEqual(
    json.lanes.map((r) => r.cutPrereview.state),
    ["sent", "missing", "no-mailbox", "n/a", "not-checked"],
  );
});

// ---------------------------------------------------------------------------
// Header parsing matches the mailbox watch script (AC14)
// ---------------------------------------------------------------------------

test("AC14 header parser parity", () => {
  // tools/ cannot import scripts/mailbox-watch.mjs, so lane-status.ts carries
  // its own reader; this pins the two to the same type/re/seq per block over
  // every fixture, including parity-edge (preamble lines, duplicate keys,
  // CRLF, `--- msg <words>`, `---msg` non-start, header without a close,
  // `key:value` with no space, a capitalized key).
  const pick = (hs) => hs.map((h) => ({ type: h.type, re: h.re, seq: h.seq }));
  const files = fs.readdirSync(MAILBOX).map((d) => path.join(MAILBOX, d, LANE_TO_INTEGRATOR_FILE)).filter((f) => fs.existsSync(f));
  assert.ok(files.length >= 8, `fixture corpus present (${files.length} files)`);
  for (const f of files) {
    const text = fs.readFileSync(f, "utf8");
    const mine = pick(parseMailboxHeaders(text));
    assert.ok(mine.length > 0, `${f}: at least one block`);
    assert.deepEqual(mine, pick(parseMessageHeaders(text)), `parity for ${path.relative(ROOT, f)}`);
  }
  for (const text of ["", "no blocks here\n", "--- msg\n", "--- msg\n---\n"]) {
    assert.deepEqual(pick(parseMailboxHeaders(text)), pick(parseMessageHeaders(text)), JSON.stringify(text));
  }
  // The edge fixture's specific reading, so a shared regression in BOTH
  // parsers cannot pass as "parity".
  const edge = pick(parseMailboxHeaders(fs.readFileSync(mailboxFile("parity-edge"), "utf8")));
  assert.deepEqual(edge, [
    { type: "proposal", re: "first re wins", seq: "1" },
    { type: "proposal", re: "crlf cut", seq: "2" },
    { type: " proposal ", re: "no space after colon", seq: "4" },
  ]);
});

// ---------------------------------------------------------------------------
// Security smoke
// ---------------------------------------------------------------------------

test("security smoke: a path-shaped active_feature or lane name is never joined into a path", (t) => {
  const parent = mkParent(t);
  const ws = mkLane(parent, "sent-first");
  for (const feature of ["../etc/passwd", "a/b", "..", "x\0y"]) {
    const c = check(ws, "sent-first", { activeFeature: feature });
    assert.equal(c.state, "not-checked", `feature ${JSON.stringify(feature)}`);
    assert.equal(c.mailboxFile, null);
  }
  for (const lane of ["..", "../sent-first", "a/b"]) {
    assert.equal(check(ws, lane).state, "not-checked", `lane ${JSON.stringify(lane)}`);
  }
});

test("security smoke: an oversized mailbox is read without error and the first match still wins", (t) => {
  const root = mkParent(t);
  const lane = "big-lane";
  fs.mkdirSync(path.join(root, lane));
  const filler = Array.from({ length: 20000 }, (_, i) =>
    `--- msg\nseq: ${i + 1}\nfrom: ${lane}\ntype: report\nre: cut progress ${i}\n---\n${"x".repeat(200)}\n`,
  ).join("");
  fs.writeFileSync(path.join(root, lane, LANE_TO_INTEGRATOR_FILE), `${filler}--- msg\nseq: 20001\ntype: proposal\nre: cut\n---\n`);
  const ws = mkLane(mkParent(t), lane);
  const c = checkCutPrereview({ workspacePath: ws, lane, activeFeature: FEATURE, readable: true, mailboxRoot: root });
  assert.equal(c.state, "sent");
  assert.equal(c.seq, "20001");
});
