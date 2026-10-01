// Coded by @qa-engineer
// Tests for tools/lane-ticket-allocation.ts: turning lane-filed pending tickets into real backlog ids, and finding
// lanes whose worktree is gone (specs/e124-lane-ticket-allocation.md AC1-AC8).
// AC9 (no `disposition` parameter on allocateTicketIds or markApplied) is checked by reading the signatures, not by a runnable test.
// Deliberately untested: a block after an existing `## Applied` section is silently archived, and a stray unmatched
// fence swallows the next block. Both are tracked as follow-up work; asserting them would turn bugs into contracts.
// Rationale: specs/e260g-comment-rationale.md (test/lane-ticket-allocation.test.mjs).

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parsePendingTickets,
  allocateTicketIds,
  extractMaxBacklogId,
  detectOrphanLanes,
  markApplied,
} from "../dist/tools/lane-ticket-allocation.js";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");

/** Builds a PendingTicketEntry-shaped object for allocateTicketIds tests
 *  that don't need to go through the text parser. */
function entry(overrides = {}) {
  return {
    laneLocalId: "L-X-NEW-1",
    title: "Untitled",
    priority: "P2",
    dependsOn: [],
    body: "",
    lane: "e124",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC1 — file format: only fenced pending-ticket blocks carry data
// ---------------------------------------------------------------------------

test("parsePendingTickets ignores NEW-TICKETS.md-shaped prose and extracts only fenced pending-ticket blocks", () => {
  const fileText = `
## L-X-NEW-1

Free-form discussion, exactly the shape NEW-TICKETS.md has always used —
a bulleted narrative, no fenced block, no lane_local_id field:

- found while reviewing T-E124-01
- priority: probably P2
- depends_on: nothing yet

\`\`\`pending-ticket
lane_local_id: L-X-NEW-2
title: Real candidate
priority: P2
depends_on: none
\`\`\`

More prose after the block, also not a pending-ticket fence, and also not
counted.
`;
  const { entries, errors } = parsePendingTickets(fileText, "e124");
  assert.equal(errors.length, 0);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].laneLocalId, "L-X-NEW-2");
  assert.equal(entries[0].title, "Real candidate");
});

// ---------------------------------------------------------------------------
// AC2 — parsePendingTickets: degrade-honest parsing
// ---------------------------------------------------------------------------

test("parses N valid blocks", () => {
  const fileText = `
\`\`\`pending-ticket
lane_local_id: L-X-NEW-1
title: First
priority: P1
depends_on: [E109]
source: found by qa-engineer
body: |
  Some free-form prose.
\`\`\`

\`\`\`pending-ticket
lane_local_id: L-X-NEW-2
title: Second
priority: P2
\`\`\`

\`\`\`pending-ticket
lane_local_id: L-X-NEW-3
title: Third
priority: P3
depends_on: L-X-NEW-1
\`\`\`
`;
  const { entries, errors } = parsePendingTickets(fileText, "e124");
  assert.equal(errors.length, 0);
  assert.equal(entries.length, 3);
  assert.deepEqual(
    entries.map((e) => e.laneLocalId),
    ["L-X-NEW-1", "L-X-NEW-2", "L-X-NEW-3"],
  );
  // `lane` comes from the function argument, never parsed out of the file.
  assert.ok(entries.every((e) => e.lane === "e124"));
  assert.deepEqual(entries[0].dependsOn, ["E109"]);
  assert.equal(entries[0].source, "found by qa-engineer");
  assert.equal(entries[1].dependsOn.length, 0); // omitted depends_on -> []
  assert.deepEqual(entries[2].dependsOn, ["L-X-NEW-1"]); // single-string form
});

test("a malformed block is skipped and reported, siblings still parse", () => {
  const fileText = `
\`\`\`pending-ticket
lane_local_id: L-X-NEW-1
title: Good sibling one
priority: P1
\`\`\`

\`\`\`pending-ticket
title: Missing lane_local_id
priority: P2
\`\`\`

\`\`\`pending-ticket
lane_local_id: L-X-NEW-3
title: Good sibling two
priority: P3
\`\`\`
`;
  const { entries, errors } = parsePendingTickets(fileText, "e124");
  assert.equal(entries.length, 2);
  assert.deepEqual(
    entries.map((e) => e.laneLocalId),
    ["L-X-NEW-1", "L-X-NEW-3"],
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /block #2/);
  assert.match(errors[0], /lane_local_id/);
});

// ---------------------------------------------------------------------------
// AC3 — allocateTicketIds: sequential, deterministic, in input order
// ---------------------------------------------------------------------------

test("allocateTicketIds assigns sequential ids across batches in input order", () => {
  const batches = [
    {
      lane: "e124",
      entries: [
        entry({ laneLocalId: "L-A-NEW-1", title: "A1" }),
        entry({ laneLocalId: "L-A-NEW-2", title: "A2" }),
      ],
    },
    {
      lane: "e137",
      entries: [entry({ laneLocalId: "L-B-NEW-1", title: "B1" })],
    },
  ];
  const result = allocateTicketIds({ currentMaxId: 176, batches });
  assert.deepEqual(
    result.allocated.map((t) => t.id),
    ["E177", "E178", "E179"],
  );
  assert.deepEqual(
    result.allocated.map((t) => t.lane),
    ["e124", "e124", "e137"],
  );
  assert.equal(result.maxAllocatedId, 179);
  assert.equal(result.unresolvedDependencies.length, 0);
  for (const t of result.allocated) {
    assert.equal(t.backlogRow.includes("\n"), false);
    assert.match(t.backlogRow, new RegExp(`^\\| ${t.id} \\|`));
  }
});

// ---------------------------------------------------------------------------
// AC4 — dependency remapping
// ---------------------------------------------------------------------------

test("resolves same-batch lane-local dependency to its allocated id", () => {
  const a = entry({
    laneLocalId: "L-X-NEW-1",
    title: "Depends on B",
    dependsOn: ["E109", "L-X-NEW-2"],
  });
  const b = entry({ laneLocalId: "L-X-NEW-2", title: "Target" });
  const result = allocateTicketIds({
    currentMaxId: 176,
    batches: [{ lane: "e124", entries: [a, b] }],
  });
  const [ta, tb] = result.allocated;
  // An existing E<n>-shaped reference passes through unchanged; a
  // same-batch lane-local reference is rewritten to the real id.
  assert.deepEqual(ta.dependsOn, ["E109", tb.id]);
  assert.equal(result.unresolvedDependencies.length, 0);
});

test("an unresolvable depends_on is surfaced in unresolvedDependencies, not silently dropped", () => {
  const a = entry({
    laneLocalId: "L-X-NEW-1",
    title: "Ghost dependency",
    dependsOn: ["L-GHOST-NEW-9"],
  });
  const result = allocateTicketIds({
    currentMaxId: 176,
    batches: [{ lane: "e124", entries: [a] }],
  });
  assert.deepEqual(result.allocated[0].dependsOn, []);
  assert.equal(result.unresolvedDependencies.length, 1);
  assert.equal(result.unresolvedDependencies[0].reference, "L-GHOST-NEW-9");
  assert.equal(result.unresolvedDependencies[0].laneLocalId, "L-X-NEW-1");
  // Never left as a dangling lane-local token inside the shipped row.
  assert.doesNotMatch(result.allocated[0].backlogRow, /L-GHOST-NEW-9/);
});

// ---------------------------------------------------------------------------
// AC5 — collision-freedom across sequential applies
// ---------------------------------------------------------------------------

test("two sequential allocateTicketIds calls with re-derived currentMaxId never repeat an id", () => {
  const first = allocateTicketIds({
    currentMaxId: 176,
    batches: [
      {
        lane: "e124",
        entries: [entry({ laneLocalId: "L-A-NEW-1" }), entry({ laneLocalId: "L-A-NEW-2" })],
      },
    ],
  });
  const second = allocateTicketIds({
    currentMaxId: first.maxAllocatedId, // re-derived from the first apply's result
    batches: [
      {
        lane: "e137",
        entries: [entry({ laneLocalId: "L-B-NEW-1" }), entry({ laneLocalId: "L-B-NEW-2" })],
      },
    ],
  });
  const firstIds = new Set(first.allocated.map((t) => t.id));
  const overlap = second.allocated.filter((t) => firstIds.has(t.id));
  assert.equal(overlap.length, 0);
  assert.ok(second.allocated.every((t) => Number(t.id.slice(1)) > first.maxAllocatedId));
});

// ---------------------------------------------------------------------------
// AC6 — extractMaxBacklogId: fixed fixture, never the live backlog
// ---------------------------------------------------------------------------

test("extractMaxBacklogId counts suffixed ids by base number and ignores prose-embedded ids, using a fixed fixture", () => {
  // Fixture is the spec's own AC6 example, embedded here verbatim — never a
  // read of the live docs/backlog.md, so this test never breaks as the real
  // backlog grows.
  const fixture = [
    "| E1 | first ticket, mentions E999 in prose | P2 | none | 1 | — |",
    "| E9A | split-lettered ticket | P1 | E1 | 1 | — |",
    "| E50 | another ticket, body references depends on E999 too | P1 | none | 1 | — |",
    "| E174a | split ticket, base counts as 174 | P1 | E174 | 1 | — |",
  ].join("\n");
  assert.equal(extractMaxBacklogId(fixture), 174);
});

// ---------------------------------------------------------------------------
// AC7 — detectOrphanLanes: branch-vs-branch, never branch-vs-lane
// ---------------------------------------------------------------------------

test("detectOrphanLanes finds branches with a pending file whose worktree is gone, ignores branches without one", () => {
  const branches = [
    { branch: "feat/e124-lane-ticket-allocation", hasUnappliedPendingTickets: true }, // worktree gone
    { branch: "feat/e137-render-sanitise", hasUnappliedPendingTickets: true }, // still live
    { branch: "feat/e999-no-findings", hasUnappliedPendingTickets: false }, // worktree also gone, but no findings
  ];
  const liveWorktreeBranches = ["feat/e137-render-sanitise"];
  const { orphans } = detectOrphanLanes(branches, liveWorktreeBranches);
  assert.deepEqual(orphans, ["feat/e124-lane-ticket-allocation"]);
});

test("a branch-name vs lane-name mismatch does not falsely orphan a live branch", () => {
  // The lane name ("e124") is never the branch name
  // ("feat/e124-lane-ticket-allocation"). detectOrphanLanes must compare
  // branch to branch — comparing branch to lane would flag every real,
  // still-live branch as an orphan.
  const branches = [
    { branch: "feat/e124-lane-ticket-allocation", hasUnappliedPendingTickets: true },
  ];
  const liveWorktreeBranches = ["feat/e124-lane-ticket-allocation"];
  const { orphans } = detectOrphanLanes(branches, liveWorktreeBranches);
  assert.deepEqual(orphans, []);
});

test("detectOrphanLanes returns [] on empty input", () => {
  assert.deepEqual(detectOrphanLanes([], []), { orphans: [] });
});

// ---------------------------------------------------------------------------
// AC8 — markApplied: archive, never delete
// ---------------------------------------------------------------------------

test("markApplied archives the named entries and leaves the rest parseable", () => {
  const fileText = `
\`\`\`pending-ticket
lane_local_id: L-X-NEW-1
title: To be applied
priority: P1
\`\`\`

\`\`\`pending-ticket
lane_local_id: L-X-NEW-2
title: Stays pending
priority: P2
\`\`\`
`;
  const applied = markApplied(fileText, ["L-X-NEW-1"]);

  // Re-parsing no longer returns the archived entry; the untouched one
  // still parses cleanly.
  const after = parsePendingTickets(applied, "e124");
  assert.equal(after.errors.length, 0);
  assert.equal(after.entries.length, 1);
  assert.equal(after.entries[0].laneLocalId, "L-X-NEW-2");

  // Archived verbatim under an "## Applied" section, not deleted.
  assert.match(applied, /## Applied/);
  assert.match(applied, /L-X-NEW-1/);
  assert.match(applied, /To be applied/);

  // Idempotent: re-running with the same (now-archived) id is a no-op.
  const reapplied = markApplied(applied, ["L-X-NEW-1"]);
  assert.equal(reapplied, applied);
});

// ---------------------------------------------------------------------------
// Boundary / security smoke tests (skill-qa-engineer Phase 3.d)
// ---------------------------------------------------------------------------

test("boundary: empty inputs never throw and return empty results", () => {
  assert.deepEqual(parsePendingTickets("", "e124"), { entries: [], errors: [] });
  assert.equal(extractMaxBacklogId(""), 0);
  assert.deepEqual(detectOrphanLanes([], []), { orphans: [] });
  assert.equal(markApplied("", []), "");
  const result = allocateTicketIds({ currentMaxId: 0, batches: [] });
  assert.deepEqual(result.allocated, []);
  assert.deepEqual(result.unresolvedDependencies, []);
  assert.equal(result.maxAllocatedId, 0);
});

test("allocateTicketIds throws RangeError on a negative currentMaxId, refusing to guess a base", () => {
  assert.throws(() => allocateTicketIds({ currentMaxId: -1, batches: [] }), RangeError);
});

test("a pending-ticket block carrying an id field is rejected — real ids are never lane-assigned", () => {
  const fileText = `
\`\`\`pending-ticket
lane_local_id: L-X-NEW-1
id: E999
title: Sneaky
priority: P1
\`\`\`
`;
  const { entries, errors } = parsePendingTickets(fileText, "e124");
  assert.equal(entries.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /id/);
});

// ---------------------------------------------------------------------------
// parsePendingTickets(text, lane, opts?): archived
// blocks are inspected ONLY when opts.appliedLaneLocalIds is given; with it,
// an archived block whose lane_local_id has no matching provenance is
// reported (it will never be allocated), never removed from `entries`
// either way (archived stays archived regardless). (e179 AC6, ruling R1)
// ---------------------------------------------------------------------------

const AC6_ARCHIVED_FIXTURE = `
## Applied

\`\`\`pending-ticket
lane_local_id: L-X-NEW-9
title: Archived Item
priority: P2
\`\`\`
`;

test("AC6 proof (1): opts omitted — an archived block behaves exactly as before (errors.length === 0, matching the E124 :342 pin — no regression)", () => {
  const { entries, errors } = parsePendingTickets(AC6_ARCHIVED_FIXTURE, "e124");
  assert.equal(entries.length, 0, "archived blocks are never returned as live entries");
  assert.equal(errors.length, 0, "with opts omitted, archived content is not even inspected");
});

test("AC6 proof (2): opts.appliedLaneLocalIds is an EMPTY set — the same archived block is reported (no backlog row exists for it)", () => {
  const { entries, errors } = parsePendingTickets(AC6_ARCHIVED_FIXTURE, "e124", {
    appliedLaneLocalIds: new Set(),
  });
  assert.equal(entries.length, 0, "an archived block is never returned in entries, reported or not");
  assert.equal(errors.length, 1);
  assert.match(errors[0], /pending-ticket block #1/);
  assert.match(errors[0], /sits under "## Applied"/);
  assert.match(errors[0], /L-X-NEW-9/);
});

test("AC6 proof (3): opts.appliedLaneLocalIds contains the block's own lane_local_id — silent (legitimately archived by markApplied)", () => {
  const { entries, errors } = parsePendingTickets(AC6_ARCHIVED_FIXTURE, "e124", {
    appliedLaneLocalIds: new Set(["L-X-NEW-9"]),
  });
  assert.equal(entries.length, 0);
  assert.equal(errors.length, 0, "a backlog row exists for this id — legitimately archived, not reported");
});

// ---------------------------------------------------------------------------
// A pending-ticket opener swallowed by an enclosing non-pending fence is
// reported in TWO sub-cases (unclosed-at-eof, closes-enclosing-fence),
// never in `entries`; a strictly-longer enclosing fence (legitimate
// CommonMark nesting) stays silent under both. (e179 AC7, ruling (b))
// ---------------------------------------------------------------------------

test("AC7 proof (1) unclosed-at-eof: an outer fence opened and never closed, containing a pending-ticket opener, is reported and never becomes an entry", () => {
  const fileText = [
    "",
    "```",
    "some code",
    "```pending-ticket",
    "lane_local_id: L-SWALLOW-NEW-1",
    "title: Lost",
    "priority: P1",
  ].join("\n");
  const { entries, errors } = parsePendingTickets(fileText, "e179");
  assert.equal(entries.length, 0, "the swallowed opener never becomes a live entry");
  assert.equal(errors.length, 1);
  assert.match(errors[0], /never closed before end of file/);
  assert.match(errors[0], /opened at line 2/);
  assert.match(errors[0], /opener at line 4/);
});

test("AC7 proof (2) closes-enclosing-fence (the reviewer's own repro): a stray fence in prose immediately followed by a COMPLETE pending-ticket block — the inner block's closer ends the outer fence instead, and the finding must not vanish silently", () => {
  const fileText = [
    "",
    "Some prose.",
    "",
    "```",
    "```pending-ticket",
    "lane_local_id: L-SWALLOW-NEW-2",
    "title: Closes Outer",
    "priority: P1",
    "```",
    "",
    "More prose.",
  ].join("\n");
  const { entries, errors } = parsePendingTickets(fileText, "e179");
  assert.equal(entries.length, 0, "with unclosed-at-eof alone this would vanish with zero trace — AC7 (ii) closes that gap");
  assert.equal(errors.length, 1);
  assert.match(errors[0], /opener at line 5 sits inside the fence opened at line 4/);
  assert.match(errors[0], /its own closing fence ends that outer fence instead/);
});

test("AC7 proof (3): a pending-ticket example correctly nested inside a STRICTLY LONGER enclosing fence (documentation example) stays silent under both rules", () => {
  const fileText = [
    "",
    "````markdown",
    "Example:",
    "```pending-ticket",
    "lane_local_id: L-EXAMPLE-NEW-1",
    "title: Just an example",
    "priority: P1",
    "```",
    "````",
  ].join("\n");
  const { entries, errors } = parsePendingTickets(fileText, "e179");
  assert.equal(errors.length, 0, "a strictly-longer enclosing fence is legitimate CommonMark nesting — never reported");
  assert.equal(entries.length, 0, "inert documentation content — prose, not a live block, per the existing fence-depth design");
});

// ---------------------------------------------------------------------------
// Unneeded parser features (tilde fences, comma-separated depends_on, the
// post-loop isSafeInteger(next) overflow throw) are removed. The tests above
// exercise only retained behaviour; these probe that the removed features
// stay gone, plus a grep proof. (e179 AC9)
// ---------------------------------------------------------------------------

test("AC9: a tilde-fenced pending-ticket-shaped block is now inert prose — tilde fences are no longer recognized", () => {
  const fileText = ["", "~~~pending-ticket", "lane_local_id: L-TILDE-NEW-1", "title: Should not parse", "priority: P1", "~~~"].join("\n");
  const { entries, errors } = parsePendingTickets(fileText, "e179");
  assert.equal(entries.length, 0, "no backtick fence means no block at all");
  assert.equal(errors.length, 0, "inert text is not even an error — it is simply not recognized as a fence");
});

test("AC9: a comma-separated depends_on string is ONE literal reference, never split into multiple ids", () => {
  const fileText = [
    "",
    "```pending-ticket",
    "lane_local_id: L-COMMA-NEW-1",
    "title: Comma test",
    "priority: P1",
    'depends_on: "E1, E2"',
    "```",
  ].join("\n");
  const { entries, errors } = parsePendingTickets(fileText, "e179");
  assert.equal(errors.length, 0);
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0].dependsOn, ["E1, E2"], "the whole string is one literal reference — no comma-splitting support remains");
});

test("AC9: no live-code trace of the deleted speculative surface (tilde fences, comma-separated depends_on, the isSafeInteger(next) overflow throw)", () => {
  const src = fs.readFileSync(path.join(PROJECT_ROOT, "tools", "lane-ticket-allocation.ts"), "utf-8");
  assert.doesNotMatch(src, /~\{3,\}/, "no tilde-fence regex may remain in live code");
  assert.doesNotMatch(src, /comma-separated/i, "no comma-separated depends_on handling may remain in live code (doc-comment mentions of the deletion are fine; this checks the .ts source, which carries no such comment)");
  assert.doesNotMatch(src, /isSafeInteger\(next\)/, "the post-loop overflow throw must be gone");
});

test("backlogRow escapes pipe characters and collapses newlines in free-form title/body, preventing table injection", () => {
  const malicious = entry({
    laneLocalId: "L-X-NEW-1",
    title: "Title | with pipe",
    body: "Body\nwith\nmultiple\nlines and a | pipe too",
  });
  const result = allocateTicketIds({
    currentMaxId: 0,
    batches: [{ lane: "e124", entries: [malicious] }],
  });
  const row = result.allocated[0].backlogRow;
  assert.equal(row.includes("\n"), false);
  // Exactly 6 table columns (7 structural "|" delimiters) survive despite
  // literal "|" characters embedded in title/body — those must come through
  // escaped ("\|"), never as unescaped column separators.
  let structuralPipes = 0;
  for (let i = 0; i < row.length; i++) {
    if (row[i] === "|" && row[i - 1] !== "\\") structuralPipes++;
  }
  assert.equal(structuralPipes, 7);
  assert.ok(row.includes("\\|"));
});
