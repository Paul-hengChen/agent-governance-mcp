# QA Review — T-E123B2-01 (feature: e123b2-sidecars-lane-tools)

Reviewer: qa-engineer (sonnet, Task-dispatched)
code-reviewer verdict consumed: APPROVED round 1 (`review_reports/review_T-E123B2-01.md`)
Spec source: no `specs/<feature>.md` exists — the spec is the coordinator's
`handoff.scope_decision_why` (E123 F1 L2, feature-split.md row 1.2; mini-chain,
PM/ARCH skipped, human-approved cut 2026-09-23). AC1–AC6 below are quoted from
that field.

## Expected-Red Diff

Manifest present: `qa_reports/expected-red_e123b2-sidecars-lane-tools.txt`
(authored by qa-engineer per the human's 2026-09-23 option-A decision amending
AC5 — sr-engineer did not author one; the decision was communicated directly
to qa-engineer's dispatch brief, so QA created the manifest at Phase 0.5 before
running the full suite).

Manifest entries (2):
- `test/lane-paths.test.mjs | CALLERS2 ...`
- `test/lane-paths.test.mjs | CALLERS3 ...`

Full-suite actual reds (4): `check-md-tables` AC7, `check-md-tables` CQ-9,
`lane-paths.test.mjs` CALLERS2, `lane-paths.test.mjs` CALLERS3.

Diff (2 extra reds beyond the manifest) — dispositioned per the human's
2026-09-23 decision, which explicitly names these two as pre-existing at this
lane's base commit `8f30aba`, caused by `.current/feature-split.md:23`
(L2-NEW-4), not by this task:
- `check-md-tables AC7` — pre-existing at base `8f30aba`, disposition: allowed (human decision 2026-09-23; L2-NEW-4).
- `check-md-tables CQ-9` — pre-existing at base `8f30aba`, disposition: allowed (human decision 2026-09-23; L2-NEW-4).

**Phase 0.5: clean given the disposition** — 2/2 manifest entries confirmed
red (CALLERS2, CALLERS3), 0 unexplained reds (the 2 extras are the
human-dispositioned baseline pair, not a regression).

## Phase 1 — Review

Read the full diff of `tools/telemetry.ts` and `tools/metrics.ts` against
`main`, and confirmed `tools/lane-registry.ts`, `tools/join-precondition.ts`,
`index.ts` carry zero diff against `main`.

### AC1 — paths come only from `resolveCurrentLanePaths`, mkdir uses the dirname

`tools/telemetry.ts` diff:
```diff
+import { resolveCurrentLanePaths } from "./lane-paths.js";
...
 function telemetryPath(workspacePath: string): string {
-  return path.join(workspacePath, ".current", "telemetry.jsonl");
+  return resolveCurrentLanePaths(workspacePath).telemetryPath;
 }
...
-    const dir = path.join(workspacePath, ".current");
-    fs.mkdirSync(dir, { recursive: true });
+    const file = telemetryPath(workspacePath);
+    fs.mkdirSync(path.dirname(file), { recursive: true });
...
-    fs.appendFileSync(telemetryPath(workspacePath), JSON.stringify(event) + "\n", "utf-8");
+    fs.appendFileSync(file, JSON.stringify(event) + "\n", "utf-8");
```

`tools/metrics.ts` diff:
```diff
+import { resolveCurrentLanePaths } from "./lane-paths.js";
...
 function metricsPath(workspacePath: string): string {
-  return path.join(workspacePath, ".current", "metrics.jsonl");
+  return resolveCurrentLanePaths(workspacePath).metricsPath;
 }
...
-    fs.mkdirSync(path.join(args.workspacePath, ".current"), { recursive: true });
-    fs.appendFileSync(metricsPath(args.workspacePath), JSON.stringify(record) + "\n", "utf-8");
+    const file = metricsPath(args.workspacePath);
+    fs.mkdirSync(path.dirname(file), { recursive: true });
+    fs.appendFileSync(file, JSON.stringify(record) + "\n", "utf-8");
```

Both `telemetryPath()`/`metricsPath()` now derive exclusively from
`resolveCurrentLanePaths(workspacePath)`, and both `mkdirSync` calls use
`path.dirname(file)` on the RESOLVED path rather than a hand-rolled
`.current` join. **AC1: PASS.**

### AC2 — grep sweep (0 hits both)

```
$ grep -nE '"(handoff\.md|telemetry\.jsonl|metrics\.jsonl|usage\.jsonl|dispatch\.jsonl)"' tools/telemetry.ts tools/metrics.ts index.ts tools/lane-registry.ts tools/join-precondition.ts
(no output, exit 1)

$ grep -nE 'path\.join\([^)]*"\.current"' tools/telemetry.ts tools/metrics.ts
(no output, exit 1)
```

**AC2: PASS.**

### AC3 — lane-registry.ts / join-precondition.ts derive no path from the current workspace

`git diff main -- tools/lane-registry.ts tools/join-precondition.ts` is
EMPTY — both files are byte-identical to `main`, so this ticket introduces no
regression here by construction. Confirmed their existing cross-worktree
reads route through `parseHandoff(<that worktree's abs path>)`:

```
tools/join-precondition.ts:38:import { parseHandoff } from "./handoff-parse.js";
tools/join-precondition.ts:221:    const state = parseHandoff(repoRoot);
```

`tools/lane-registry.ts` builds `path.join(workspacePath, ".current", "archive")`
for reading each LANE's OWN archive dir (parameterized on that lane's own
`workspacePath`, never a hardcoded "current workspace" assumption) — not a
sidecar file this ticket owns, and unchanged from `main`. **AC3: PASS.**

## Phase 1.5 — Visual Compare

Skipped (no `design/<feature>.md`, no Visual Baselines H2 — this is a
non-UI, server-internals ticket).

## Phase 3 — Tests

**Test-file placement**: dispatch brief directs creation of
`test/e123b2-sidecars-lane-paths.test.mjs` (pre-authorized); existing test
files are NOT to be modified. Acted on that branch.

### AC4 — new test, tmp fixtures, feat/e999-x + main, exact sidecar path

Wrote `test/e123b2-sidecars-lane-paths.test.mjs` (3 tests: LANE1, LANE2,
LANE3). Fixtures are built under `os.tmpdir()` with a hand-built
`.git/HEAD` (`ref: refs/heads/<branch>`) — no `.git` object database is
needed because `resolveCurrentLane` only ever does `statSync`/`readFileSync`
on `.git` and `HEAD` (`tools/lane-paths.ts` doc comment), and the brief
explicitly allows "a real `git init`, or a hand-built `.git/HEAD`". LANE1
uses `feat/e999-x`, LANE2 uses `main`. Both assert `emitGateTelemetry` and
`emitFeatureMetrics` write to exactly `<ws>/.current/telemetry.jsonl` and
`<ws>/.current/metrics.jsonl` (via `fs.existsSync` + a `.current/`
directory-listing exact-match assertion, ruling out a stray lane
subdirectory). LANE3 asserts the sidecar's path RELATIVE TO its own
workspace root is identical on both branches.

Standalone run:
```
$ node --test test/e123b2-sidecars-lane-paths.test.mjs
# tests 3
# pass 3
# fail 0
```

**AC4: PASS.**

### Spec-to-Test map

| AC | Test(s) |
|---|---|
| AC1 | read (diff, this doc) |
| AC2 | grep (this doc) |
| AC3 | read (diff + grep, this doc) |
| AC4 | LANE1, LANE2, LANE3 (`test/e123b2-sidecars-lane-paths.test.mjs`) |
| AC5 | full `npm test` run + `git diff --name-status main -- test/` (this doc) |
| AC6 | `git diff --name-only main` (this doc) |

Coverage gate: new/modified production files (`tools/telemetry.ts`,
`tools/metrics.ts`) are each a 1-line resolver substitution already covered
line-for-line by the pre-existing `test/telemetry.test.mjs` /
`test/success-metrics.test.mjs` suites (which continue to pass unmodified)
plus this file's 3 new tests exercising the changed lines directly (both
branches). Security smoke: N/A — no new user input surface, no auth/permission
change (both functions are best-effort, swallow-on-error sidecar writers,
unchanged in that respect).

## Phase 3.5 — AC Execution

Skipped (no `specs/<feature>.md` file, so no `proof:`-annotated ACs exist to
scan).

## Phase 4 — Run

Build: `npm run build` — zero errors (`tsc` clean, `check:version` OK,
`check:transitions-sync` OK).

Full suite: `npm test` (CI-runnable headlessly, zero interaction):
```
# tests 2318
# suites 1
# pass 2314
# fail 4
```

The 4 failures are exactly the disposed set:
- `test/check-md-tables.test.mjs` AC7 — baseline red at `8f30aba`, allowed (human decision 2026-09-23, L2-NEW-4).
- `test/check-md-tables.test.mjs` CQ-9 — baseline red at `8f30aba`, allowed (human decision 2026-09-23, L2-NEW-4).
- `test/lane-paths.test.mjs` CALLERS2 — expected red, human decision 2026-09-23 option A amending AC5 (NEW-TICKETS.md L2-NEW-5).
- `test/lane-paths.test.mjs` CALLERS3 — expected red, human decision 2026-09-23 option A amending AC5 (NEW-TICKETS.md L2-NEW-5).

No other red. sr-engineer's flagged flake candidates
(`t-hook-noop-invalid-budget-0`, `t-hook-empty-stdin`) both PASSED in this
full-suite run (`# Subtest: t-hook-noop-invalid-budget-0 ... ok`,
`# Subtest: t-hook-empty-stdin ... ok`) — did not recur, no further
bisection needed.

**AC5 (as amended): PASS.**

```
$ git diff --name-status main -- test/
(empty — no tracked test file modified)
$ git status --porcelain --untracked-files=all test/
?? test/e123b2-sidecars-lane-paths.test.mjs
```

Only the new, pre-authorized file was added under `test/`; zero existing test
files were touched.

### AC6 — diff scope

```
$ git diff --name-only main
.current/feature-split.md
.current/handoff.md
NEW-TICKETS.md
dist/tools/metrics.d.ts.map
dist/tools/metrics.js
dist/tools/metrics.js.map
dist/tools/telemetry.d.ts.map
dist/tools/telemetry.js
dist/tools/telemetry.js.map
tasks.md
tools/metrics.ts
tools/telemetry.ts
```

`.current/handoff.md`, `tasks.md`, `NEW-TICKETS.md` are coordinator
bookkeeping (expected per brief). `tools/telemetry.ts`, `tools/metrics.ts`
and their `dist/` outputs are the in-scope production change. The new test
file does not appear here because `git diff --name-only` omits untracked
files (see AC5 evidence above for its independent confirmation).

`.current/feature-split.md` is the one path outside the brief's explicit
subset. Investigated: **this is branch-staleness noise, not an edit made by
this task.**
- `git log --oneline -- .current/feature-split.md` on this branch shows no
  commit from this lane touching the file.
- `git diff $(git merge-base HEAD main) main -- .current/feature-split.md`
  reproduces the EXACT same 1-line diff (row 1.9's regex-pipe escaping) —
  i.e. the entire discrepancy is explained by `main` having advanced past
  this lane's merge-base via commit `88bbf3f` ("fix(governance): escape the
  regex pipe in feature-split row 1.9"), which this lane's branch (cut at
  `8f30aba`) never received.
- Consistent with the human's decision text verbatim: "pre-existing and
  allowed: check-md-tables AC7 and CQ-9, caused by
  `.current/feature-split.md:23` (L2-NEW-4). They are red at base `8f30aba`"
  — i.e. the human's own framing already anchors the baseline to `8f30aba`,
  before the main-side fix.
- The working tree has zero uncommitted diff on this file
  (`git status --porcelain .current/feature-split.md` shows nothing —
  confirmed it is 100% a `git diff main` artifact of comparing two diverged
  branches, not working-tree drift).

**AC6: PASS**, with the `.current/feature-split.md` line item dispositioned
as pre-existing branch divergence, unrelated to T-E123B2-01's own commits.

## Verdict

**PASS** — AC1–AC6 all confirmed. code-reviewer APPROVED round 1 stands;
this review found no correctness, coverage, or test-infra defects. The two
CALLERS reds are the human-authorized, amended AC5 outcome; the two
check-md-tables reds are the pre-existing baseline the human named. No new
red, no coverage gap, build clean, full suite CI-runnable headlessly.
## 2026-09-23T09:05:26.898Z — PASS — by qa-engineer

PASS. AC1-AC6 verified (qa_reports/review_T-E123B2-01.md). AC1: telemetryPath()/metricsPath() derive solely from resolveCurrentLanePaths(); mkdir uses path.dirname(resolved). AC2: both greps 0 hits. AC3: lane-registry.ts/join-precondition.ts byte-identical to main, cross-worktree reads via parseHandoff. AC4: new test/e123b2-sidecars-lane-paths.test.mjs (3/3 pass) proves feat/e999-x and main both write <ws>/.current/{telemetry,metrics}.jsonl. AC5 (amended): full npm test 2314/2318 pass, 4 reds = exactly {check-md-tables AC7, CQ-9 (pre-existing at base 8f30aba, L2-NEW-4)} + {CALLERS2, CALLERS3 (human-authorized expected-red, L2-NEW-5)}; test/ diff vs main is empty except the new pre-authorized file; sr's flagged usage-accounting timeouts did not recur (both green this run). AC6: git diff --name-only main matches the allowed subset plus .current/feature-split.md, which I traced to pure branch-staleness (main's independent commit 88bbf3f post-dates this lane's merge-base 8f30aba) — not an edit introduced by this task. code-reviewer APPROVED round 1 stands; no correctness/coverage/test-infra defects found.

## 2026-09-23T09:05:47.099Z — PASS — by qa-engineer

PASS. AC1-AC6 verified (qa_reports/review_T-E123B2-01.md). AC1: telemetryPath()/metricsPath() derive solely from resolveCurrentLanePaths(); mkdir uses path.dirname(resolved). AC2: both greps 0 hits. AC3: lane-registry.ts/join-precondition.ts byte-identical to main, cross-worktree reads via parseHandoff. AC4: new test/e123b2-sidecars-lane-paths.test.mjs (3/3 pass) proves feat/e999-x and main both write <ws>/.current/{telemetry,metrics}.jsonl. AC5 (amended): full npm test 2314/2318 pass, 4 reds = exactly {check-md-tables AC7, CQ-9 (pre-existing at base 8f30aba, L2-NEW-4)} + {CALLERS2, CALLERS3 (human-authorized expected-red, L2-NEW-5)}; test/ diff vs main is empty except the new pre-authorized file; sr's flagged usage-accounting timeouts did not recur (both green this run). AC6: git diff --name-only main matches the allowed subset plus .current/feature-split.md, which I traced to pure branch-staleness (main's independent commit 88bbf3f post-dates this lane's merge-base 8f30aba) — not an edit introduced by this task. code-reviewer APPROVED round 1 stands; no correctness/coverage/test-infra defects found.

