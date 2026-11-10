// Coded by @qa-engineer: pin for specs/e262-sop-text-fixes.md AC-E340-1 (T-E340-02).
// WHY: no tool edits an unchecked task's description or depends_on, and void + add changes the task id
// that evidence files are named after. const-05 line 17 therefore carries one narrow in-place exception,
// and (content/** ships to every adopter) the added clause must name no path that exists only in this repo.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const C05 = fs.readFileSync(path.join(ROOT, "content/const-05-core-standards.md"), "utf-8");

const CLAUSE =
  "Do NOT hand-edit the task-list file from a role, except: the role amending the cut (pm, or the coordinator for it) may edit an unchecked, non-voided task's description and `depends_on` in place, disclosed in `pending_notes` — never ids, checkboxes or voided rows; anything else is `tw_void_task` + `tw_add_task`. `tw_sync`";

test("AC-E340-1: const-05 line 17 carries the narrow exception, repo-path-free, file keeps 23 lines", () => {
  const lines = C05.split("\n");
  assert.equal(lines.length, 23, "pinned by e410");
  assert.ok(lines[16].includes(CLAUSE), "line 17 holds the W11 clause verbatim");
  assert.equal(C05.split(CLAUSE).length - 1, 1);
  for (const p of ["docs/", "specs/", "test/", ".current/", "qa_reports/"]) {
    assert.ok(!CLAUSE.includes(p), `clause names no ${p}`);
  }
});
