# QA Review: T-E222-01

- Verdict: PASS

## Context

Dispatched directly by the integrator (not a `/teamwork` lane) on
`integ/wave7-e178b` at base commit `e255c90`, to fix ticket E222 per
`docs/backlog.md` row E222. No task ledger applies to this dispatch
(governance state belongs to another feature, `release-v4-wave6`); no
`tw_update_state` / `tw_add_task` / `tw_complete_task` / `tw_void_task`
calls were made, per the dispatch brief. `tw_get_state` and
`tw_switch_role("qa-engineer")` were called for context only (read-only,
no mutation).

## Problem

`test/e130-lane-default.test.mjs` AC4 (line ~148, pre-fix) and AC14
(line ~265, pre-fix) computed `git diff --stat 121ddc8...HEAD[...]`,
i.e. relative to the live HEAD of whatever branch runs the suite. That
made both ACs pass only while e130 was the newest change on the branch,
and fail as soon as anything else landed after it (confirmed failing on
`integ/wave7-e178b` at 2793/2795 before this fix, per the E222 backlog
row).

## Fix

Bound both diffs to e130's own commit range, `121ddc8..5896bdd`
(`5896bdd` = e130's final lane commit — `test(e130): E130 T-E130-02..09
— QA PASS, all 8 tasks complete` — confirmed reachable from HEAD via
`git merge-base --is-ancestor 5896bdd HEAD`). Every assertion body is
unchanged; only the git range literal changed, plus a header-comment
explanation citing E222 above each affected test. See diff below.

Scope: touched only `test/e130-lane-default.test.mjs` and this evidence
file, per the dispatch brief.

## Commands run

```
$ git merge-base --is-ancestor 5896bdd HEAD && echo "5896bdd is ancestor of HEAD"
5896bdd is ancestor of HEAD

$ git log -1 --format="%H %s" 5896bdd
5896bddd9695c2563619cbf88f407fc376de6594 test(e130): E130 T-E130-02..09 — QA PASS, all 8 tasks complete

$ node --test test/e130-lane-default.test.mjs
...
1..17
# tests 17
# suites 0
# pass 17
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 239.819959

$ npm test
...
1..2782
# tests 2795
# suites 1
# pass 2795
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 138863.499375
$ echo "EXIT_CODE=$?"
EXIT_CODE=0
```

## Results

- `test/e130-lane-default.test.mjs`: 17/17 pass (all of AC1, AC3, AC4
  (x2), AC5, AC6, AC7, AC8, AC9, AC10, AC11 (x3), AC14).
- Full suite (`npm test`): **2795/2795 pass**, exit code **0**.

## Diff (test/e130-lane-default.test.mjs, assertion bodies unchanged apart from the range)

```diff
diff --git a/test/e130-lane-default.test.mjs b/test/e130-lane-default.test.mjs
index 5baaf47..793100c 100644
--- a/test/e130-lane-default.test.mjs
+++ b/test/e130-lane-default.test.mjs
@@ -132,6 +132,13 @@ test("AC3: the Lane-start default paragraph states every subsequent tw_* call's
 // AC4: default path invokes `agc feature start`; disclaims a hand-rolled
 // bootstrap; one-sentence refusal path. Plus the zero-code-change guarantee
 // (git diff --stat over bin/ tools/ scripts/ from the fan-out base).
+//
+// E222: the diff range is pinned to `121ddc8..5896bdd` (e130's own commit
+// range — 5896bdd is e130's final lane commit, reachable from HEAD) rather
+// than `121ddc8...HEAD`. A HEAD-relative range makes this AC fail on every
+// commit that lands after e130, since anything else touching bin/tools/
+// scripts widens the diff this test inspects; e130's own scope guarantee is
+// about e130's commits, not about however far HEAD has since moved.
 // ---------------------------------------------------------------------------
 
 test("AC4: trigger (b) invokes agc feature start, disclaims a new/hand-rolled bootstrap, and states the one-sentence refusal path", () => {
@@ -146,7 +153,7 @@ test("AC4: trigger (b) invokes agc feature start, disclaims a new/hand-rolled bo
 });
 
 test("AC4: zero code changes accompany this ticket outside content/** — git diff --stat over bin/ tools/ scripts/ from the fan-out base is empty", () => {
-  const out = execFileSync("git", ["diff", "--stat", "121ddc8...HEAD", "--", "bin/", "tools/", "scripts/"], { cwd: ROOT, encoding: "utf-8" });
+  const out = execFileSync("git", ["diff", "--stat", "121ddc8..5896bdd", "--", "bin/", "tools/", "scripts/"], { cwd: ROOT, encoding: "utf-8" });
   assert.equal(out.trim(), "", `expected zero diff over bin/ tools/ scripts/, got:\n${out}`);
 });
 
@@ -260,10 +267,17 @@ test("AC11: the Artifact allowlist bullet names .current/_primary/tasks.md and e
 // ---------------------------------------------------------------------------
 // AC14: scope containment — every changed path since the fan-out base
 // (121ddc8) matches an owned glob for this lane; zero forbidden paths.
+//
+// E222: the diff range is pinned to `121ddc8..5896bdd` (e130's own commit
+// range — 5896bdd is e130's final lane commit, reachable from HEAD) rather
+// than `121ddc8...HEAD`, for the same reason as AC4 above: this AC asserts
+// e130's own scope containment, and a HEAD-relative range would fail on
+// every later commit that touches a path outside e130's owned list,
+// regardless of which lane made that later change.
 // ---------------------------------------------------------------------------
 
 test("AC14: every path changed since 121ddc8 matches this lane's owned-files list, with zero forbidden paths", () => {
-  const out = execFileSync("git", ["diff", "--stat", "121ddc8...HEAD"], { cwd: ROOT, encoding: "utf-8" });
+  const out = execFileSync("git", ["diff", "--stat", "121ddc8..5896bdd"], { cwd: ROOT, encoding: "utf-8" });
   const lines = out.trim().split("\n").filter(Boolean);
   // The last line is the "N files changed, ..." summary — drop it.
   const fileLines = lines.slice(0, -1);
```

## Notes / observations outside scope (not fixed)

- None. The fix is isolated to the two range literals plus explanatory
  header comments; no other issues surfaced while reading the file or
  running the suite.
