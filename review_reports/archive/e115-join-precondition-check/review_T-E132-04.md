# Review — T-E132-04

covers: T-E132-04

Round 1 — CHANGES_REQUESTED — by code-reviewer

Feature: `e132-lane-registry`. Base `e784a3b`, branch `feat/e132-lane-registry`.
Diff reviewed: `tools/feature-rollup.ts` (+153/-15), `tools/lane-registry.ts` (NEW, 254),
`tools/handoff-parse.ts` (+13), `scripts/feature-rollup.mjs` (+3/-1).
Contract: `specs/e132-lane-registry.md`. No architecture spec exists for this feature.

## Summary

- The cut is structurally right and close to shippable: the seam is preserved, the
  three-module import cycle is genuinely safe, the read-only requirement holds, the
  cost ceiling really reaches `execFileSync`, and `featureHistory`'s `null` vs `[]`
  distinction survives every path. All ten ACs are addressed in code.
- **Blocking (live, every call):** wiring `localFallbackLaneList` into `readHandoffState`
  leaks git's stderr onto the server's log channel. A single successful `tw_get_state`
  in a non-git workspace now emits `fatal: not a git repository (or any of the parent
  directories): .git`. Reproduced. The JSON payload is byte-identical as promised; the
  observable side effect is not.
- **Blocking (silent lane drop):** the rewritten porcelain block parser splits on
  `/\n\n+/` and is not CRLF-tolerant, against the `\r?\n` convention this very file
  establishes 12 lines earlier. On CRLF input it drops all but the last worktree and
  misattributes that worktree's branch — with `degraded: false`. The parser it replaced
  was immune. Reproduced.
- **Blocking (false stated reason):** `historicalOnlyMatchLanes` does not exclude
  unreadable lanes, so `renderRollupReport` prints "have since moved to a different
  active_feature" about a lane whose current feature could not be read — two lines
  below a `Reason:` line that says the opposite. Reproduced.
- Determination requested in the brief: `anyLaneUnreadableHere` is **not** dead. See
  Correctness 4. Non-finding.
- Verdict: CHANGES_REQUESTED on three findings, all narrowly scoped. Nothing here
  questions either settled human decision.

## Correctness

**C1 (blocking) — `tools/feature-rollup.ts:103`: git's stderr is inherited, so every
`tw_get_state` in a non-git workspace writes `fatal:` to the server's log channel.**

`execFileSync` is called with `{ cwd, encoding }` and no `stdio`. Node's default for
`execFileSync` pipes stdout but **inherits stderr to the parent**. At base this was
harmless: `localFallbackLaneList`'s only caller was `scripts/feature-rollup.mjs`, a
short-lived CLI process. `tools/handoff-parse.ts:412` now calls it from
`readHandoffState` — the mandatory first action of every role, in the long-lived MCP
server process, whose stderr is the stdio-transport log channel the client surfaces
(the same stream the startup banner `🛡️ Agent Governance MCP is online` goes to).

Reproduced — one successful read of a non-git workspace:

```
read OK. lane_registry key present: false | exists: true
--- STDERR emitted by that ONE successful tw_get_state ---
fatal: not a git repository (or any of the parent directories): .git
```

The returned JSON is correct and byte-identical to pre-E132 (no `lane_registry` key),
so AC3's payload assertion passes while the user-visible behavior regresses. Blast
radius is the common case, not the edge: non-git managed workspaces get an unexplained
`fatal:` line on every single tool call, and it reads as a server fault.

This also contradicts the diff's own stated intent — `tools/lane-registry.ts:207-209`
promises this function "must never be the reason `tw_get_state`'s mandatory
first-action read fails," and `tools/handoff-parse.ts:404-411` promises the
non-fan-out case is indistinguishable from before.

Fix: capture git's stderr instead of inheriting it —
`stdio: ["ignore", "pipe", "pipe"]` on the `execFileSync` options. That keeps the
diagnostic available on `err.stderr` for `degradedReason` while keeping it off the
server's log stream. (`stdio: ["ignore","pipe","ignore"]` also works but discards the
detail; `err.message` would then read only `Command failed: git worktree list --porcelain`.)

**C2 (blocking) — `tools/feature-rollup.ts:129-145`: the new block parser silently
drops lanes on CRLF input, and misattributes the survivor's branch.**

`output.split(/\n\n+/)` does not match `\r\n\r\n`. On CRLF input the entire output
collapses into one block; because `blockPath` and `blockBranch` are *overwritten*
rather than flushed per `worktree` line, only the last worktree survives, and it
inherits whatever `branch` line came last. Reproduced against the exact parser body,
3 worktrees in, `/c` being detached:

```
LF   new: ["/a","/b","/c"]  branches: [["/a","main"],["/b","feat/x"],["/c",null]]
LF   old: ["/a","/b","/c"]
CRLF new: ["/c"]            branches: [["/c","feat/x"]]     <-- 2 lanes lost, /c is detached
CRLF old: ["/a","/b","/c"]
```

Two things make this worth blocking rather than noting:

1. **The code it replaced was immune.** The base parser scanned lines independently
   with `startsWith("worktree ")` + `.trim()`, which tolerates `\r`. This is a
   robustness regression introduced by the rewrite, not a pre-existing gap.
2. **The failure mode is exactly the one this module exists to prevent.** With 2 of 3
   lanes dropped, `result.lanes.length <= 1` at `tools/lane-registry.ts:224` returns
   `null`, so `tw_get_state` reports *no sibling lanes while three are live* — the
   2026-09-15 blindness in the spec's own User Stories — and it does so with
   `degraded: false`, no reason, no carried lane. The module header at
   `tools/lane-registry.ts:24-27` states an unreadable lane is "always CARRIED, never
   dropped." A collapsed block silently violates that.

I want to be precise about likelihood: `git worktree list --porcelain` emits LF on all
platforms (verified here), so this is latent, not currently triggerable. It is still a
regression, and the same file already handles this correctly — `FRONTMATTER_RE` at
`tools/lane-registry.ts:59` is `\r?\n`-aware, as are `tools/handoff-parse.ts:197` and
`tools/drift.ts:141`. The new splitter is the odd one out.

Fix: `output.split(/(?:\r?\n){2,}/)`. Worth pairing with a defensive flush so a second
`worktree ` line inside one block starts a new lane rather than overwriting the
previous one — that converts any future block-detection failure from a silent drop
into a correct parse.

**C3 (blocking) — `tools/feature-rollup.ts:113-118` and `:505-511`: an unreadable lane
is reported as having "moved on," contradicting the report's own stated reason.**

Both filters test `lane.activeFeature !== featureId` without requiring
`lane.readable`. An unreadable lane has `activeFeature: null` (≠ featureId), and
`laneRegistryList` attaches `featureHistory` to *every* lane including unreadable ones
(`tools/lane-registry.ts:156-159`), so an unreadable lane with matching archive history
satisfies the predicate.

`degradedReason` is safe — the precedence chain puts `anyLaneUnreadableHere` first. But
`renderRollupReport`'s note line at `:505-511` is **not** precedence-gated; it prints
unconditionally. Reproduced, one unreadable lane with `featureHistory: ["target-feat"]`:

```
Reason: one or more lane handoffs could not be read/parsed while computing ticket counts
note: 1 lane(s) previously worked "target-feat" per featureHistory but have since moved
      to a different active_feature — excluded from totals/capComparison above
      (not retro-summed; see degradedReason).
VERDICT: undetermined — ...
```

"have since moved to a different active_feature" is false: we do not know this lane's
current feature, and it may still be *on* `featureId`. The note further attributes the
exclusion to the deliberate no-retro-sum scope decision when the actual cause is a read
failure, then points the reader at a `degradedReason` that says something different.
Under the degrade-honestly invariant, a stated reason that is factually wrong is worse
than no note. Severity is low in impact but it is squarely a violation of the invariant
the module's header asserts.

Fix: add `lane.readable &&` to both predicates. Keep them in sync (see Q2).

**C4 — determination on `anyLaneUnreadableHere` (the brief's primary question): the
degrade path is NOT dead. No finding.**

There are three assignments. The first, at `tools/feature-rollup.ts:327`, is in the
`!lane.readable` branch and is **fully reachable** — `localFallbackLaneList` still
produces `readable: false` lanes at `:170` (no state) and `:206` (parseHandoff threw).
The primary degrade signal is untouched.

What the fix does render unreachable for both built-in providers is the *inner* pair at
`:362` and `:383`, behind the `Array.isArray(lane.completedTasks)` preference at `:348`.
`readAndMigrate` builds `completed_tasks` as `[...matchAll(...)].map(...)` — always an
array, never undefined — so on `localFallbackLaneList`'s readable branch
`Array.isArray` is always true and the re-read never happens.

That is correct, and it is not a lost signal:

- The only conditions those two branches could ever have caught are TOCTOU races
  *between the provider's read and the rollup's re-read* — the handoff being deleted or
  corrupted in the microseconds between two reads of the same file inside one
  `computeFeatureRollup` call. That is not an invariant worth a degrade flag.
- Eliminating the second read is AC5's explicit requirement ("calls `parseHandoff`
  exactly once per lane in total, not twice").
- The branches stay live for any third-party `LaneListProvider` that predates
  `completedTasks`, which is the documented compatibility reason to keep them.

So: genuinely unreachable for the built-ins, because the provider already succeeded at
reading the same file — not a removed degrade signal. The defect class the ticket family
guards against does not apply here.

**C5 — verified correct, no findings.**

- `getLaneRegistrySummary` calls `localFallbackLaneList`, **not** `laneRegistryList`
  (`tools/lane-registry.ts:217`) — the archive scan is genuinely skipped, which is the
  entire reason the second entry point exists.
- `timeoutMs` really reaches `execFileSync`: `?? 200` at `:216` → `{ timeoutMs }` at
  `:217` → `...(opts?.timeoutMs !== undefined && { timeout: opts.timeoutMs })` at
  `tools/feature-rollup.ts:107-112`. Measured: `timeoutMs: 1` returned `null` in 2ms.
- The try/catch at `:215-253` encloses the whole body — the `.map`, the spread, the
  return. Nothing can escape.
- Both `null`-on-nothing-to-report cases are real branches, not comments:
  `result.lanes.length <= 1` at `:224` covers 0 worktrees (git failed/timed out → empty
  `lanes`) and 1 worktree (no siblings). Measured: non-git dir → `null`; this 14-worktree
  repo → 14 lanes, `degraded: false`, 34ms.
- `localFallbackLaneList`'s `opts?` defaults to `undefined` and the `timeout` key is
  spread only when explicitly set, so every existing call site is byte-unchanged. The 11
  pre-existing `test/feature-rollup.test.mjs` tests pass unmodified — I re-ran them: 11/11.
- `featureHistory` `null` vs `[]` survives every path. `getLaneFeatureHistory`: no
  directory → `null` (`:89`); `readdirSync` threw → `[]` (`:96`); directory present but
  nothing parseable → `[]` (`:141`). `laneRegistryList` passes the value straight
  through (`:158`); `computeFeatureRollup` passes it through on all four return shapes
  (`:335, :356, :370, :391`). Measured: non-existent archive → `{"featureHistory":null}`;
  this worktree → `{"featureHistory":["e142-release-tooling-wave25"]}`.
- `getLaneFeatureHistory` meets every robustness requirement: sorts by `stat.mtimeMs`
  ascending (`:112`), never by filename; uses a local `---`-delimited regex + `yaml.load`
  and **not** `parseHandoff` (`:59`, `:123-131`) — correct, since `parseHandoff` refuses
  loud on a future/older schema and would take out the whole history read over one old
  archive file; cannot throw (every `fs` and `yaml` call is individually wrapped, and
  `String.match`/`Array.includes` cannot throw); skips malformed files silently, and
  requires a non-empty string `active_feature` (`:135`) so no null or `""` entry can
  enter the array.
- Both `readHandoffState` returns carry the spread, and correctly, not merely present:
  `laneRegistry` is computed at `tools/handoff-parse.ts:412`, *before* `readAndMigrate`
  at `:414`, so it is in scope for the `exists: false` early return at `:424` as well as
  the final return at `:604`. That ordering is load-bearing — a fresh workspace with
  live sibling lanes is exactly the blindness the ticket exists to fix, and it is
  handled. Both spreads use the `...(x && { k: x })` guard, matching `exemptions` /
  `config_error` / `stale_dispatch` exactly.
- Precedence order matches the spec verbatim: lane-list failure → per-lane read failure
  → historical-only match → zero current matches → unattributable
  (`tools/feature-rollup.ts:132-148`). Adding the new arm shadows no pre-existing reason:
  the two arms above it keep priority, and the two below were already mutually ordered.
  Inserting ahead of `zeroMatchingLanes` does mean a feature with zero current matches
  *and* a historical-only lane now reports the historical message instead of "nothing to
  roll up" — that is the spec's declared "most actionable first" ordering, and the
  chosen message is strictly more informative. Not a finding.
- `renderRollupReport`'s note line satisfies AC6: it names the count and states the
  exclusion. Subject to C3 for the unreadable case.

**C6 — settled decisions, checked as instructed for honoring, not for merit.**

- Visibility-only fix for hand-forward 3: honored exactly. `historicalOnlyMatchLanes`
  feeds `degraded` and `degradedReason` and prints a note line, and `matchingLanes`
  (`:100`) still filters on `activeFeature === featureId` only — so `totals`,
  `capComparison`, `totalHop`, `ticketCount` and `anySingleLaneReportsOverCap` are
  arithmetically unchanged. No retro-summing anywhere. Not filed.
- The `handoff-parse → lane-registry → feature-rollup → handoff-parse` cycle: existence
  not filed. Safety in Architecture below.

## Quality

**Q1 — `tools/handoff-parse.ts:407` and `tools/lane-registry.ts:204-206` overstate the
cost ceiling.** The comment reads "never blocks or slows the mandatory pre-flight read
beyond `getLaneRegistrySummary`'s own 200ms worst case." 200ms bounds only the `git
worktree list` subprocess. Riding on top, unbounded, is one synchronous `parseHandoff`
per worktree — file read + YAML parse + `runMigrations` each. Measured on this
14-worktree checkout: 34ms total, none of it the git call's ceiling. The spec
acknowledges this cost explicitly ("plus one synchronous `parseHandoff` file read per
sibling lane"), so the *behavior* is approved and I am not filing it; the *claim* is
what is wrong. Given this ticket family exists to stop code making promises it does not
keep, the comment should say the 200ms bounds the subprocess and that N synchronous
handoff reads are additive. AC4's "returns within the stated 200ms ceiling" is true only
for the git-hang case it tests.

**Q2 — the historical-only-match predicate is duplicated** at
`tools/feature-rollup.ts:113-118` (over `RollupReportLane[]`) and `:505-511` (over
`report.lanes`). They agree today — both read `activeFeature` and `featureHistory`, and
`computeFeatureRollup` filters the already-mapped array, so the inputs are identical.
But `RollupReport` carries no count field, so `renderRollupReport` is *forced* to
recompute, and the two copies must be kept in sync by hand — C3's fix has to be applied
in both places, which is precisely the drift this shape invites. Consider a
`historicalOnlyMatchCount` (or the lane list) on `RollupReport`. Interface addition the
spec did not ask for, so: recommendation, not a required change.

**Q3 — `LaneInfo.branch` is captured but never surfaced anywhere.** It is populated at
`tools/feature-rollup.ts:165, 172, 185, 207`, but `RollupReportLane` does not carry it,
`renderRollupReport` does not print it, and `LaneRegistryAdvisoryLane`
(`tools/lane-registry.ts:177-182`) omits it. As shipped it is dead data. The spec
mandates the field, so this is compliant and I am not blocking — but note that the
advisory's stated purpose is "who else is working, and on what," and in a worktree
fan-out the branch name is the most useful identifier a coordinator has. Worth a
follow-up to surface it in `LaneRegistryAdvisoryLane`.

**Q4 — conventions match, no findings.** Comment density, the `// Coded by @sr-engineer`
header, the `...(x && { k: x })` spread guard, the `LaneListProvider` naming, the
`FRONTMATTER_RE` shape copied from `tools/skill-frontmatter.ts:20`, and the
"fixed constant, not config-driven" posture cited against
`STALE_DISPATCH_THRESHOLD_MIN`/`HOP_CAP` are all consistent with the surrounding
codebase. No `any` in either file (verified). TS strict clean — `npm run build` exits 0.
The compile-time conformance assertion at `tools/lane-registry.ts:171-172` is a nice
touch: it turns the "LaneListProvider-conformant" comment into a checked claim at zero
runtime cost.

**Q5 — `entry.isFile()` at `tools/lane-registry.ts:101` excludes symlinks.** A `Dirent`
for a symlink reports `isFile() === false`, so a symlinked archive entry is skipped.
Archives are created by `fs.copyFileSync` (`tools/handoff-write.ts:487`), so they are
always real files. Non-issue in practice; noting only because `specs/` mentions symlink
bootstrap elsewhere in this layout.

## Architecture

Fit with the spec's design is good, and the two structural claims the spec makes are
both actually true in the code.

**The seam stays a seam.** `computeFeatureRollup`'s default provider is still
`localFallbackLaneList` (`tools/feature-rollup.ts:290`), `tools/feature-rollup.ts` does
not import `tools/lane-registry.ts` at all, and only `scripts/feature-rollup.mjs:29`
passes `laneRegistryList`. That is what keeps the cycle from needing a top-level
cross-module *value* at `feature-rollup.ts`'s own module scope, and it is the right
call.

**Cycle safety — verified, not assumed.** The brief is right that the boot smoke test is
evidence rather than proof, so I checked the emitted JS. `dist/tools/lane-registry.js`
has exactly these top-level statements: three node/`js-yaml` imports, `import
{ localFallbackLaneList } from "./feature-rollup.js"`, `const FRONTMATTER_RE = /…/`,
three `export function` declarations, and `const
_laneRegistryListIsLaneListProvider = laneRegistryList; void …`. That last one *is*
top-level, but it reads a hoisted function declaration in its **own** module — initialized
before the module body runs, so no TDZ. The `import type { LaneInfo, LaneListResult,
LaneListProvider }` at `tools/lane-registry.ts:48` is type-only and erased entirely from
the output, so `LaneListProvider` never becomes a runtime read of a possibly-uninitialized
`feature-rollup` binding. Every cross-module edge is inside a function body:
`localFallbackLaneList` at `:155` and `:217`, `parseHandoff` inside
`localFallbackLaneList`'s loop, and `getLaneRegistrySummary` only at
`tools/handoff-parse.ts:412` inside `readHandoffState` (grep confirms one import, one
call site, no top-level use). The cycle resolves safely on every load order.

**Layering.** `tools/lane-registry.ts` reimplements neither worktree enumeration nor
handoff parsing — both exported functions delegate to `localFallbackLaneList`, so
`tools/feature-rollup.ts:103` remains the single place in the repo that shells out to
git (verified: it is the only non-test `execFileSync`/`execSync` call site). The two
entry points have genuinely different cost profiles as the spec argues, and the code
honors that split.

**File-mode only.** `tools/storage-sqlite.ts` is untouched (empty diff), and the
advisory is computed in `readHandoffState`, which is the file-mode read path — matching
the sibling E10/E18/E24 posture. The SQLite/HTTP path is unaffected. Correct: an HTTP
deployment has no local worktree to derive from. No `schema_version` bump, no persisted
`HandoffState` field, no new gate — consistent with `stale_dispatch` and `exemptions`.

**Forbidden touches: none.** `git diff --stat e784a3b -- tools/drift.ts content/
scripts/verify-release.mjs docs/backlog.md tools/storage-sqlite.ts test/` is empty.
Independently confirmed, matching the coordinator's check.

## Security

No findings.

- **No command injection.** `execFileSync("git", ["worktree","list","--porcelain"], …)`
  uses the array form with no shell. `repoRoot` reaches it only as `cwd`, where a
  hostile value can at worst point at a different repository — it cannot inject
  arguments. Archive filenames are never interpolated into a command.
- **Read-only confirmed, not just asserted.** `tools/lane-registry.ts` uses only
  `existsSync`, `readdirSync`, `statSync`, `readFileSync` — no write, no `mkdir`, no
  lockfile, no heartbeat (AC8 grep empty; independently confirmed). Critically, the
  transitive path is read-only too: `localFallbackLaneList` calls **`parseHandoff`**,
  which `tools/handoff-parse.ts:365-372` documents as running migrations *in memory* and
  explicitly "does NOT write back" — the migration heal-on-read write-back lives in
  `readHandoffState`, which is not on this path. Had `parseHandoff` written back, this
  change would have made every `tw_get_state` write to every sibling worktree, bypassing
  `withFileLock` and `verifyFreshness`. It does not. The right function was chosen.
- **No pre-flight or freshness guard bypass.** I checked this specifically, because
  `localFallbackLaneList` now runs inside the server process and parses every sibling
  worktree's handoff. `markStateRead` is called only from `readHandoffState`
  (`tools/handoff-parse.ts:380`) — **not** from `parseHandoff`. So scanning sibling lanes
  does not mark those workspaces as "state read" in `guards/session.ts`'s
  `activeSessions` map, and `enforcePreFlight` still blocks a write to a sibling
  workspace the agent never read. Had `markStateRead` been in `parseHandoff`, a single
  `tw_get_state` would have satisfied the mandatory pre-flight for every sibling
  worktree in the process and snapshotted their mtimes. It is not. Clean.
- **`yaml.load` is safe.** js-yaml 4.3.2, where `load` is the former `safeLoad` —
  default schema, no arbitrary type construction, no code execution. Input is
  local-filesystem archive files.
- **No untrusted string reaches rendered output.** `active_feature` values recovered
  from archived handoffs are passed through unsanitized (as the spec requires), but they
  are only ever compared with `.includes()` and serialized into JSON, which escapes
  them. `renderRollupReport`'s new note line interpolates `report.featureId` (the
  caller's own argument) and a count — never a history string — so there is no path for
  an archived file to inject a fake `note:` line or table row into a report a coordinator
  reads. Worth keeping true if a future cut surfaces `featureHistory` in rendered text.
- No secrets, no new network boundary, no new trust boundary. One new subprocess on the
  read path, with fixed arguments.

## Performance

No regressions in the reviewed code paths; one approved new cost, and one measurement
that contradicts a comment (Q1).

- **2N → N reads: delivered.** The `Array.isArray(lane.completedTasks)` preference at
  `tools/feature-rollup.ts:348` genuinely eliminates the second `parseHandoff` per lane
  for both built-in providers, satisfying AC5. This is a real improvement over base.
- **New cost on the hottest read.** `tw_get_state` now pays one subprocess spawn plus N
  synchronous `parseHandoff` calls on every invocation. Measured 34ms on this
  14-worktree checkout; a non-git workspace still pays the spawn to learn there is
  nothing to report. The spec explicitly accepts this ("worktree counts are human-scale…
  no parallelization is attempted"), so it is approved, not a finding. Two notes for the
  record: there is no memoization, so the cost is paid per call rather than per session;
  and `readHandoffState` now parses its *own* workspace's handoff twice on a fan-out (once
  via the lane scan, once via `readAndMigrate`). Both are within the spec's stated posture.
- **No complexity-class issues.** `getLaneFeatureHistory` is O(files) with one `statSync`
  and one `readFileSync` each plus an O(n log n) sort; `laneRegistryList` is O(lanes ×
  archive files); the porcelain parse is O(lines). No nested scans, no unbounded cache,
  no retained listeners.
- The `branchByPath` Map adds O(worktrees) memory, freed with the call.

## Coverage gaps for qa-engineer (T-E132-05)

I authored no tests (`test/**` is qa's). These are the gaps I hit while reviewing:

1. **stderr cleanliness on the read path (C1).** AC3 asserts the JSON payload is
   byte-identical in the non-fan-out case; nothing asserts the *process* is quiet. A
   test should spawn a read of a non-git workspace and assert stderr contains no
   `fatal:`/`not a git repository`.
2. **CRLF porcelain input (C2).** No test feeds `localFallbackLaneList` CRLF-terminated
   porcelain output. Worth covering as a fixture against the parser, asserting all
   worktrees survive and per-block branch attribution is correct.
3. **Unreadable lane with matching `featureHistory` (C3).** No test covers the
   intersection of the unreadable and historical-only-match branches, which is where the
   false claim appears. Assert the note line is absent (or correctly worded) when the
   matching lane is `readable: false`.
4. **`getLaneRegistrySummary` skips the archive scan.** The whole justification for the
   second entry point is untested. Spy on `readdirSync` (or place a sentinel file in a
   sibling's `.current/archive/`) and assert it is never touched during a
   `getLaneRegistrySummary` call.
5. **`branch` extraction.** Nothing asserts `branch` is populated from
   `branch refs/heads/<name>`, stripped of the `refs/heads/` prefix, and `null` for a
   `detached` worktree — including that it is attributed to the *right* worktree when
   several blocks are present.
6. **AC4's ceiling, measured end to end.** The existing framing tests only the git-hang
   case. A test over total wall time with several sibling lanes would show the N
   `parseHandoff` reads sit outside the 200ms bound (Q1).
7. **Both `readHandoffState` returns.** AC3 should exercise the `exists: false` early
   return (fresh workspace, no `.current/handoff.md`, 2+ worktrees) as a distinct case
   from the final return — the early-return spread is the easy one to regress.

## Verdict

CHANGES_REQUESTED — three narrowly-scoped defects: git's stderr is inherited onto the
server's log channel so every `tw_get_state` in a non-git workspace prints `fatal: not a
git repository` (C1, live and reproduced), the rewritten porcelain block parser silently
drops all but the last worktree on CRLF input where the parser it replaced did not (C2),
and an unreadable lane is reported as having "moved on" in direct contradiction of the
report's own stated reason (C3). Everything else — cycle safety, read-only, the cost
ceiling reaching `execFileSync`, the seam, `null` vs `[]`, both spreads, precedence
order, the two settled decisions, and the `anyLaneUnreadableHere` reachability question
(not dead — see C4) — checks out.

---

Round 2 — APPROVED — by code-reviewer

Fresh clean context; round 1's reviewer is not this session. Base `e784a3b`, branch
`feat/e132-lane-registry`. Scope of this round: verify round 1's three blocking fixes are
*correct* (not merely present) and hunt regressions the fixes themselves introduced. Round 1's
cleared findings and the two human-settled decisions were not re-litigated — and nothing found
this round plausibly invalidates any of them.

## Summary

- **C1, C2, C3 all genuinely fixed.** Each was re-verified by re-running round 1's own repro from
  scratch rather than trusting the report of it. All three now behave correctly, and none of the
  three fixes introduced a regression.
- **The highest-risk change (C2's `flush()` control-flow rewrite) is correct**, including the two
  failure modes it could plausibly have introduced: it neither double-pushes nor drops the final
  block, and CRLF input now produces output byte-identical to the LF case and to the base parser.
- **The sharpest regression candidate I hunted — C3's `lane.readable &&` guard silently swallowing
  a degrade — is closed**, by `tools/feature-rollup.ts:334-335`. Verified by executing the exact
  adversarial case, not by reading. See Correctness R2-3.
- Independently confirmed (not taken on report): forbidden-touch diff empty, no `any`,
  `npm run build` exit 0, `npm audit` matching the base baseline, `tools/lane-registry.ts` still
  write-free, the 11 pre-existing `test/feature-rollup.test.mjs` tests passing unmodified. I also
  ran the **full suite as a regression sweep: 2156/2156, exit 0**.
- One process advisory that is not a code defect but misled my first check, and could mislead a
  downstream gate: the whole cut is **uncommitted**. See Quality R2-Q6.
- Verdict: APPROVED.

## Correctness

**R2-1 — C1 fix at `tools/feature-rollup.ts:103-120` is correct on all four axes.**

`stdio: ["ignore", "pipe", "pipe"]` with `encoding: "utf-8"`.

*Stdout return path intact under the explicit `stdio`.* This was the real risk — `execFileSync`
returns `null` rather than stdout when stdout is not piped. Here `stdio[1]` is `"pipe"`, so the
return value is still the decoded string. Verified end to end, not by inspection: a
`readHandoffState` on this 14-worktree checkout returns `lane_registry` populated with 14 lanes,
which is only possible if `execFileSync` returned parseable porcelain text.

*The diagnostic genuinely still reaches `degradedReason`.* Round 1's stated justification was that
`err.message`/`err.stderr` preserves it; I confirmed that holds **now that stderr is piped** —
and it is worth being precise that the fix is what makes the claim true, not incidental to it.
Node's `checkExecSyncError` appends the *captured* `stderr` to the Error message, so with stderr
inherited (the base behavior) `err.message` would have read only `Command failed: ...`. Measured
on a non-git directory:

```
degradedReason: git worktree list failed (not a git repo, or git is unavailable):
  Command failed: git worktree list --porcelain
  fatal: not a git repository (or any of the parent directories): .git
```

The `fatal:` detail is preserved in full. `timeoutMs` still reaches `execFileSync` (`timeoutMs: 1`
→ `spawnSync git ETIMEDOUT` in `degradedReason`), and the no-timeout default still yields
`degraded: false` with 14 lanes, so existing call sites are unchanged.

*The server's log channel is now silent.* Three cases, stderr measured in bytes:

```
non-git workspace, handoff present  -> exit 0, "lane_registry present: false | exists: true",  stderr 0 bytes
non-git workspace, no handoff       -> exit 0, "lane_registry present: false | exists: false", stderr 0 bytes
real worktree (fan-out)             -> exit 0, "lane_registry present: true  | exists: true",  stderr 0 bytes
```

Round 1's reproduction emitted `fatal: not a git repository` on the first of these. It is gone.

*Nothing else depended on that stderr being visible.* `tools/feature-rollup.ts:103` is the **only**
`execFileSync`/`execSync`/`spawnSync` call site in the entire server source (grep over `tools`,
`gates`, `guards`, `transport`, `lib`, `schema`, `index.ts`), so there is no second consumer to
break. The only two consumers of `localFallbackLaneList` are the server read path (which is
exactly what needed silencing) and `scripts/feature-rollup.mjs`. For the CLI the human loses
nothing — the diagnostic is now *attributed* rather than interleaved raw. Verified by running the
CLI in a non-git directory:

```
ROLL-UP INCOMPLETE — 0 of 0 lane(s) readable; totals below are NOT a verified feature total.
Reason: git worktree list failed (not a git repo, or git is unavailable): Command failed: git worktree list --porcelain
fatal: not a git repository (or any of the parent directories): .git
```

Strictly better than base, where that line arrived as a bare `fatal:` with no attribution.

One incidental behavior change worth recording, not a finding: `stdio[0]` moved from the
`execFileSync` default to `"ignore"`, so `git` now gets `/dev/null` on stdin.
`git worktree list --porcelain` never reads stdin, so this is inert — and mildly safer.

**R2-2 — C2 fix at `tools/feature-rollup.ts:141-175` is correct, including both control-flow
failure modes the rewrite could have introduced.**

This was the round's highest-regression-risk change, so I re-ran round 1's repro from scratch
against a fake `git` on `PATH` (hexdump-verified CRLF fixtures) and added edge cases aimed
specifically at the new `flush()` closure. New parser vs. the base parser transcribed verbatim:

```
fixture       new parser  (path, branch)                              base parser (paths)
lf            [/a main] [/b feat/x] [/c null]                         [/a /b /c]
crlf          [/a main] [/b feat/x] [/c null]      <-- now == lf      [/a /b /c]
notrail       [/a main] [/b null]                                     [/a /b]
collapsed     [/a main] [/b feat/x] [/c null]                         [/a /b /c]
solo          [/solo main]                                            [/solo]
empty         [] + "returned no worktrees"                            []
```

- *The original defect class is fixed.* `crlf` is now identical to `lf`. Round 1 measured
  `["/c"]` with branch `"feat/x"` — 2 lanes lost and the survivor misattributed. Every branch is
  now attributed to the right worktree path in both encodings.
- *Normal LF attribution is right on real data too*, not just fixtures: all 14 worktrees in this
  checkout resolve to the correct branch, each matching its own directory name.
- *A detached worktree still yields `branch: null`* (`/c` in `lf`, `crlf` and `collapsed`;
  `/b` in `notrail`). The `detached` line falls through both `startsWith` arms and leaves
  `blockBranch` at its `null` reset — correct.
- *The `:164` conditional flush cannot double-push.* `collapsed` puts two `worktree` lines inside
  one block: `/a` is flushed at `:164` and `blockPath` is reassigned on the very next statement,
  so the terminal `:174` flush pushes `/b`, not `/a` again. `/a` appears exactly once. This is the
  `flush()`-specific path and it behaves as intended — a block-detection failure becomes a correct
  parse instead of a silent drop, which is exactly what the comment claims.
- *The `:174` terminal flush cannot drop the final block.* `notrail` (no trailing newline at all)
  yields both lanes; `solo` yields its one lane. `flush()` runs unconditionally at the end of every
  block iteration.
- *Empty-path guard preserved.* Base pushed only when `wp !== ""`; the rewrite sets
  `blockPath = null` for an empty path and `flush()` pushes only when `blockPath !== null` —
  behaviorally equivalent. `empty` input still returns the correct
  `"returned no worktrees"` degrade.

Path sets match the base parser on all six fixtures. No regression in any encoding.

**R2-3 — C3 fix at `tools/feature-rollup.ts:421-427` and `:530-536` is correct, and the degrade it
could have swallowed is not swallowed.**

*Both copies still agree.* Mechanically diffed the two predicate bodies after normalizing only the
collection accessor (`lanes` vs `report.lanes`): **identical**. The standing drift hazard (Q2) has
not opened up — the fix was applied to both copies in the same shape.

*No previously-reported degrade goes unreported.* This is the regression I went looking for, and it
was a real risk: adding `lane.readable &&` narrows `anyHistoricalOnlyMatch`, and
`anyUnattributableLane` also requires `readable`, so an unreadable lane could in principle satisfy
*no* degrade arm and vanish — strictly worse than round 1's wrongly-worded degrade.
`tools/feature-rollup.ts:334-335` closes it: `if (!lane.readable) { anyLaneUnreadableHere = true; ... }`
fires for **every** provider-reported unreadable lane, unconditionally, before any of the narrowed
predicates are evaluated. Executed, rather than reasoned about — three cases:

```
1 unreadable lane, featureHistory=[target-feat]          degraded: true   reason: read-failure       note: absent
  ^ C3's exact repro: the false "moved on" note is gone, Reason is now the truthful one
unreadable+historical lane + a readable MATCHING lane    degraded: true   reason: read-failure       note: absent
  ^ the adversarial edge: still degrades, correctly attributed, nothing lost
readable lane moved on, featureHistory=[target-feat]     degraded: true   reason: historical-only    note: present
  ^ positive control: the guard did not over-narrow; the visibility-only disposition still fires
```

The third case matters as much as the first: the fix suppresses the note only for unreadable lanes
and leaves the genuine historical-only path fully intact, so E113's human-settled visibility-only
disposition is honored exactly as round 1 found it.

*`anyUnattributableLane` was not disturbed.* `tools/feature-rollup.ts:410-412` is **byte-identical**
to base `e784a3b:tools/feature-rollup.ts:300-302` — `lane.readable && lane.activeFeature == null`.
It already carried the `readable` guard; the C3 edit did not touch it.

**R2-4 — the two comment-only edits are genuinely comment-only, no behavior change.**

`tools/handoff-parse.ts:404-413`: verified directly against base via `git diff`. Everything added
to that file is one import, one `const laneRegistry = getLaneRegistrySummary(workspacePath)`, two
`...(laneRegistry && { lane_registry: laneRegistry })` spreads, and `//` comment lines — the exact
functional set round 1 reviewed and cleared. The round-2 delta lives entirely in the `//` block,
which now states the truth: the 200 ms "bounds only the `git worktree list` subprocess... riding on
top of that, additive and unbounded by the 200ms figure, is one synchronous parseHandoff read per
sibling worktree (measured: 34ms across 14 worktrees)."

`tools/lane-registry.ts:204-209`: this file is untracked, so no base diff exists; the available
evidence is that the corrected text sits inside the JSDoc block that opens above `:196` and closes
at `:213`, and that the function body at `:214-229` still matches every round-1-cleared assertion
verbatim (`opts?.timeoutMs ?? 200` at `:219`, `localFallbackLaneList` — not `laneRegistryList` — at
`:220`, whole-body `try` from `:218`, `result.lanes.length <= 1` → `null` at `:227`). The code
shifted down ~3 lines with no change in content, consistent with a comment-only expansion. Both
corrected comments are accurate; Q1's substance is resolved.

**R2-5 — round 1's cleared findings: nothing re-opened.** I checked whether any round-2 fix could
plausibly invalidate a cleared finding and found none. Two that the fixes touched most closely, and
which I therefore re-confirmed rather than assumed:

- *Cycle safety after the rebuild.* Boot smoke test: `online` banner present, `initialize` replied,
  and no `fatal:` / `ReferenceError` / `Cannot access` anywhere in stderr. The
  `handoff-parse → lane-registry → feature-rollup → handoff-parse` cycle still resolves.
- *Both `readHandoffState` spreads, including the `exists: false` early return.* Round 1 cleared
  this by reading the `:412`-before-`:414` ordering; I confirmed it by execution, which is the
  stronger evidence for the case the ticket exists to fix: a workspace with **no**
  `.current/handoff.md` inside a 14-worktree fan-out returns
  `keys: exists,message,lane_registry` — `exists: false`, advisory present, 14 lanes. The
  early-return spread works.

## Quality

**R2-Q6 (advisory, not a code defect) — the entire cut is uncommitted, and that makes the
conventional three-dot diff lie.** `HEAD` is `e784a3b`, i.e. the base itself, so
`git diff --stat e784a3b...HEAD` is **empty** and a forbidden-touch check written in that form
reports clean without having examined anything. My first check was in that form and I had to redo
it as `git diff e784a3b -- <paths>` plus a `git ls-files --others` sweep for untracked additions
(`tools/lane-registry.ts` and `specs/e132-lane-registry.md` are untracked and would be invisible
to any tracked-diff-only check). Not a defect in the code and not blocking — but worth the lane
knowing, since a downstream check or gate phrased against `...HEAD` would pass vacuously here.

**R2-Q7 (nit, round-1 code, unreachable input) — `tools/feature-rollup.ts:170` yields `""` rather
than `null` for a bare `refs/heads/`.** `raw.startsWith("refs/heads/") ? raw.slice(11) : raw || null`
takes the true arm for exactly `"refs/heads/"`, producing an empty-string branch that skips the
`|| null` fallback on the other arm. `git` never emits that, `LaneInfo.branch` is typed
`string | null` so `""` is type-valid, and the field is still unsurfaced (Q3), so impact is nil.
Noting only because the `flush()` rewrite passed through this line; it is unchanged round-1 code,
not a round-2 regression. No change required.

**R2-Q8 — conventions held through the fixes.** No `any` introduced in any of the three files (the
`grep` hits are identifiers like `anyUnreadable`/`anyHistoricalOnlyMatch`, not the type). The new
`flush()` closure, the CRLF regex and the `lane.readable &&` guards each carry a comment naming
the round-1 finding they answer, which matches this repo's density convention and makes the fixes
self-documenting. `npm run build` exits 0.

## Architecture

Unchanged by this round, and the fixes did not perturb the structure round 1 approved.

- **The seam is still a seam.** `computeFeatureRollup`'s default provider remains
  `localFallbackLaneList` (`tools/feature-rollup.ts:314`), `tools/feature-rollup.ts` still does not
  import `tools/lane-registry.ts`, and `scripts/feature-rollup.mjs:29` remains the only caller
  passing `laneRegistryList`. The C1/C2 fixes are local to `localFallbackLaneList`'s body and the
  C3 fix is local to two predicates — no layering moved.
- **The C1 fix is architecturally the right shape**, not just an effective one: capturing the
  subprocess's stderr and routing the detail into `degradedReason` keeps the diagnostic inside the
  degrade-honestly channel the module already owns, instead of on a side channel the module does
  not control. The CLI output above shows that channel delivering it.
- **File-mode only, still.** `tools/storage-sqlite.ts` untouched; no `schema_version` bump, no
  persisted `HandoffState` field, no new gate.
- **Forbidden touches: none — independently confirmed against the working tree** (see R2-Q6 for why
  the tracked-diff form was insufficient). `git diff --stat e784a3b -- tools/drift.ts content/
  scripts/verify-release.mjs docs/backlog.md tools/storage-sqlite.ts test/` is empty, and
  `git ls-files --others --exclude-standard -- content/ test/ docs/` is empty. `tasks.md` is
  modified, but only by PM's five `T-E132-*` task rows — not a forbidden path.

## Security

No findings; no new surface introduced by the fixes.

- **The C1 fix slightly reduces surface rather than adding any.** No new argument reaches `git`;
  the array form with fixed arguments is unchanged, so there is still no shell and no injection
  path. Capturing stderr instead of inheriting it also stops subprocess-controlled bytes from
  reaching the MCP stdio log channel unframed, which is the safer direction.
- **`tools/lane-registry.ts` still writes nothing — independently confirmed.** The complete set of
  `fs.*` calls is `existsSync`, `readdirSync`, `statSync`, `readFileSync`, plus `fs.Dirent` as a
  type; `fs.copyFileSync` appears only inside a comment explaining where archive mtimes come from.
  A grep for `writeFile|appendFile|mkdir|rmSync|unlink|copyFile|rename|createWriteStream|openSync|\.write`
  over the file is empty. No registry file, lockfile or heartbeat. AC8 holds.
- **Read-only transitivity unchanged**, and the C2 rewrite did not alter which parse function is
  called: `localFallbackLaneList` still calls `parseHandoff` (in-memory migrations, no write-back),
  never `readHandoffState`.
- No secrets, no new network or trust boundary, no new untrusted string reaching rendered output —
  the new note line still interpolates only `report.featureId` and a count, never a history string.

## Performance

No regression; the fixes are all constant-factor or free.

- **C1 is free.** Piping stderr rather than inheriting it costs nothing measurable; the
  14-worktree fan-out read still completes in the same ~34ms band round 1 measured.
- **C2 is O(lines), same class as base.** The `flush()` closure is allocated once per block rather
  than once per call — a negligible constant on a human-scale worktree count, and it buys the
  correctness property in R2-2. No nested scan was introduced: the inner loop still visits each
  line exactly once.
- **C3 is free**: two boolean conjuncts added to existing `filter` predicates, and `lane.readable`
  is checked first, so it short-circuits *before* the `Array.isArray` and `includes` work — the
  guarded predicate is marginally cheaper than the unguarded one it replaced.
- The approved new cost on the hot read path (one subprocess spawn + N synchronous `parseHandoff`
  calls per `tw_get_state`, unmemoized) is unchanged by this round and remains within the spec's
  stated posture. The comments now describe it honestly (R2-4).

## Coverage gaps for qa-engineer (T-E132-05)

I authored and modified no tests — `test/**` is qa's (T-E132-05), and
`test/feature-rollup.test.mjs` is confirmed byte-unmodified vs `e784a3b`. Round 1's seven gaps
carry forward; 1 and 3 are refined and five more are added, four of them created by the round-1
fixes themselves.

**Sharpest gap, still open and still the priority: #4.** Nothing asserts
`getLaneRegistrySummary` skips the archive scan — that is the *entire* justification for having a
second entry point, and it is currently unverified in any test. Spy on `readdirSync`, or place a
sentinel file in a sibling's `.current/archive/`, and assert it is never touched during a
`getLaneRegistrySummary` call.

1. **stderr cleanliness on the read path (C1)** — *refined*. AC3 asserts the JSON payload is
   byte-identical in the non-fan-out case; nothing asserts the process is quiet. Assert **both
   halves** of the fix, since they pull against each other: spawn a read of a non-git workspace and
   assert stderr contains no `fatal:`/`not a git repository`, **and** assert `degradedReason` from
   `localFallbackLaneList` still *does* contain that text. A regression that reverts `stdio` would
   pass a stderr-only test in the wrong direction, and a regression to
   `stdio: ["ignore","pipe","ignore"]` would pass a `degradedReason`-only test.
2. **CRLF porcelain input (C2).** Feed `localFallbackLaneList` CRLF-terminated porcelain and assert
   all worktrees survive with correct per-block branch attribution — ideally as an equality
   assertion against the LF fixture's result, which is the invariant that actually matters.
3. **Unreadable lane with matching `featureHistory` (C3)** — *refined*. Assert the "moved on" note
   is absent and the `Reason:` line is the read-failure one.
4. **`getLaneRegistrySummary` skips the archive scan.** See above — the sharpest gap.
5. **`branch` extraction.** Assert `branch` is populated from `branch refs/heads/<name>`, stripped
   of the prefix, `null` for a `detached` worktree, and attributed to the *right* worktree when
   several blocks are present.
6. **AC4's ceiling, measured end to end.** The existing framing tests only the git-hang case; a
   test over total wall time with several sibling lanes would show the N `parseHandoff` reads sit
   outside the 200ms bound (now correctly documented — see R2-4).
7. **Both `readHandoffState` returns.** Exercise the `exists: false` early return (fresh
   workspace, no `.current/handoff.md`, 2+ worktrees) as a case distinct from the final return. I
   confirmed this works today; it is the easy one to regress and nothing pins it.
8. **NEW — the `flush()` control flow (C2's rewrite).** Two `worktree` lines inside one block must
   produce two lanes with correctly split branches, the first lane appearing **exactly once** (no
   double-push). This is the new code path and nothing exercises it.
9. **NEW — porcelain terminal-shape edges (C2).** Output with no trailing newline (final block must
   not be dropped), fully empty output (`returned no worktrees` degrade), and a single-worktree
   output. The terminal `flush()` at `:174` is what these pin.
10. **NEW — C3's adversarial degrade edge.** An unreadable lane with matching `featureHistory`
    **alongside a readable matching lane** must still report `degraded: true`. Distinct from #3:
    this is the combination in which the `lane.readable &&` guard could have made a degrade vanish
    entirely, and only `tools/feature-rollup.ts:334-335` prevents it.
11. **NEW — C3's positive control.** A *readable* lane that has moved on with matching
    `featureHistory` must still set `degraded: true` **and** print the note line. Guards against a
    future fix over-narrowing the predicate and silently retiring E113's human-settled
    visibility-only disposition.
12. **NEW — predicate parity (Q2).** The duplicated historical-only-match predicate at
    `tools/feature-rollup.ts:421-427` and `:530-536` has now been hand-edited in lockstep twice.
    A test driving one fixture through both `computeFeatureRollup` and `renderRollupReport` and
    asserting they agree would catch the drift that shape invites.

## Verdict

APPROVED — all three round-1 blocking defects are fixed correctly, not merely patched: git's stderr
no longer reaches the server's log channel while the `fatal:` diagnostic still arrives in
`degradedReason` and the stdout return path is intact (C1); the rewritten porcelain parser now
produces identical, correctly-attributed results on LF and CRLF and matches the base parser on
every fixture, with the new `flush()` neither double-pushing nor dropping the final block (C2); and
both copies of the historical-only-match predicate agree, with no degrade lost — an unreadable lane
is still caught by `anyLaneUnreadableHere` and still reports, now with a truthful reason (C3). The
two comment corrections are comment-only. Independently confirmed: forbidden-touch diff empty
against the working tree, no `any`, build exit 0, `npm audit` 6 findings (2 low, 4 moderate, zero
high/critical) on a lockfile byte-identical to `e784a3b`, `tools/lane-registry.ts` write-free, the
11 pre-existing tests passing unmodified, and the full suite green at 2156/2156. Twelve coverage
gaps hand forward to qa (T-E132-05), with #4 — nothing asserting `getLaneRegistrySummary` skips the
archive scan — still the sharpest.
