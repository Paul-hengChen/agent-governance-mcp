// Coded by @qa-engineer: pins for specs/e262-sop-text-fixes.md AC-E262-1..3 (T-E262-02).
// WHY: the pm -> architect hop is refused (CUT_APPROVAL_REQUIRED) until the human approves the cut,
// so an SOP that says "hold the cut until the architect's Open Questions are pre-reviewed too"
// deadlocks. Both sites must state the runnable order: cut approval, architect, second pre-review.
// Reads only the two shipped md files; no fanout manifest, no fixed base sha.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rd = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf-8");
const count = (text, needle) => text.split(needle).length - 1;
const SOP = rd("content/skill-integrator.md");
const LP = rd("docs/lane-protocol.md");

const W1 =
  "  - **Architect-hop tickets pre-review twice**, in this order: (1) the PM cut converges here, then the lane presents it and the human approves it — the pm → architect hop is refused until that approval is recorded; (2) the architect runs; (3) its Open Questions (`specs/<feature>-architecture.md`) come back for a second pre-review and converge before the lane presents them for the human's ruling, and before sr-engineer starts. Under the manifest tier, (1)'s approval is the auto-approval, and your `close` in (3) with no `needs human ruling` item lets sr-engineer start without presenting the Open Questions.";
const W2 =
  "   - **有 architect hop 的票，預審兩次**，照這個順序：(1) PM 的 cut 送信箱預審、談定後呈給人類核准 —— 核准記錄之前，server 拒絕 pm → architect 的 hop；(2) architect 執行；(3) architect 的 Open Questions（`specs/<feature>-architecture.md`）出來後，**再送信箱預審一次**，談定後才呈給人類裁決，sr-engineer 也在這之後才開始。manifest tier 下，(1) 的核准就是上一條的自動核准；(3) 的第二次預審也要 `close` 且沒有留下 `needs human ruling` 項，才派 sr-engineer；否則把 Open Questions 呈給人類。";

test("AC-E262-1: SOP Stage 4 architect-hop bullet states the runnable order; the deadlocking sentence is gone", () => {
  assert.equal(count(SOP, W1), 1, "W1-new occurs exactly once");
  const lines = SOP.split("\n").filter((l) => l.startsWith("  - **Architect-hop tickets pre-review twice**"));
  assert.deepEqual(lines, [W1]);
  assert.equal(count(SOP, "Both must converge before the lane presents to the human"), 0);
  assert.ok(W1.indexOf("(1)") < W1.indexOf("(2)") && W1.indexOf("(2)") < W1.indexOf("(3)"));
  assert.ok(SOP.includes("refused until that approval is recorded"));
});

test("AC-E262-2: lane-protocol §5 rule 2 carries W2 exactly once, inside §5", () => {
  const i = LP.indexOf("## 5.");
  const j = LP.indexOf("## 6.", i);
  assert.ok(i >= 0 && j > i, "§5 and §6 headings present");
  assert.equal(count(LP, W2), 1);
  assert.equal(count(LP.slice(i, j), W2), 1, "W2 sits in the §5 slice");
  assert.ok(W2.includes("有 architect hop 的票，預審兩次"));
});

test("AC-E262-3: manifest-tier clause at both sites; the manifest-tier close sentence is unchanged", () => {
  assert.ok(W1.includes("Under the manifest tier, (1)'s approval is the auto-approval"));
  assert.ok(W1.includes("with no `needs human ruling` item lets sr-engineer start"));
  assert.ok(W2.includes("manifest tier 下，(1) 的核准就是上一條的自動核准"));
  assert.ok(W2.includes("否則把 Open Questions 呈給人類"));
  assert.ok(SOP.split("\n").some((l) => l.includes("your `close` on the final cut is a condition of that lane's auto-approval")));
});
