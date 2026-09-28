# e178b-lane-watch-tooling

Ticket **E178b**: items (9) and (10) of E178 (split by human decision D6=A, 2026-09-27, `specs/fanout-wave7.2.md`). Lane `e178b`, branch `feat/e178b-lane-watch-tooling` @ base `121ddc8`. Task ids use `T-E178B-NN` (human ruling 2026-09-27).

## Problem Statement

The integrator's mailbox watch (`scripts/mailbox-watch.mjs`) wakes only when a lane writes a message, so a lane that skips a protocol step stays invisible until someone asks. In Wave 7.1 lane e212 went from PM straight to a single-role qa hop and never sent its cut to the mailbox. The integrator currently fills the gap with an unversioned prototype (`<lanes-root>/lane-state-watch.mjs`) that polls each lane's handoff and prints state changes. Nothing checks mechanically that a lane with a written cut sent it for pre-review. Separately, `fanout check` over-permits (E208): a path-shaped backtick span in a prose aside inside `擁有` (for example `feature-rollup.mjs` in wave7's e177a row) becomes an owned token even though it matches no file, and nothing warns about it. This ticket adds the watch as a formal mode of `scripts/lane-status.mjs`, adds a cut pre-review fan-in check, and adds an E208 warning to `fanout check`. It writes no SOP or protocol prose; E178a will cite these tools.

## User Stories

- As the integrator, I want one command that streams a line whenever any lane's handoff state changes, so that a lane that skips a protocol step shows up without waiting for mail.
- As the integrator, I want the watch to follow the same baseline, `expiring — re-arm` and exit-code conventions as `mailbox-watch.mjs`, so that I run both under the Monitor tool the same way and lose no event across a re-arm.
- As the integrator, I want lane status to say explicitly when a lane has a written cut but no cut pre-review message in its `to-integrator.md`, so that the e212 class of skip is caught at fan-in rather than by chance.
- As the manifest author, I want `fanout check` to warn when an owned token matches no path at base, so that prose asides stop silently widening a lane's ownership.

## Cut Decisions

- **(a) Where the watch lives.** It is a `--watch` mode of the existing `scripts/lane-status.mjs`, with all logic in `tools/lane-status.ts` (new exports `runLaneWatch` and its pure helpers). The script stays a thin wrapper that routes `--watch` to the async runner and everything else to the existing sync `runLaneStatusCli`. No new `tools/` file: any new `tools/*.ts` that imports `lane-paths` would trip the CALLERS allow-list in `test/lane-paths.test.mjs`, which this lane does not own. `tools/lane-status.ts` is already on that list, and it keeps not calling `resolveCurrentLane` / `resolveLanePaths`.
- **(b) Watch data source.** Each tick reads the lane list (default `laneRegistryList`, injectable as `laneListProvider`) and each lane's handoff (default `parseHandoff`, injectable as `handoffReader`). It does NOT run `git log`, `git status` or the evidence cross-check per tick, because those belong to one-shot status. Lane identity is the worktree basename (the existing `row.lane`). The prototype's hardcoded `<lanes-root>` root is not carried over.
- **(c) Watched fields.** The state line has a fixed key order: `feature`, `status`, `last_agent`, `next_role`, `hop`, `review_round`, `qa_round`, plus `cut_prereview` when `--mailbox-root` is given (decision (g)). `feature` (active_feature) is included beyond the prototype because a feature switch is a state transition. An absent value prints `-`. A change to any other field (last_updated, pending_notes, completed_tasks) prints nothing.
- **(d) Re-arm without a gap.** This follows mailbox-watch AC16. At the deadline the watch checks expiry BEFORE any fresh read, prints `expiring — re-arm`, then prints a ready-to-run re-arm command whose `--baseline <lane>=<fp>,...` carries the fingerprint of the state line each lane had when this watch LAST READ it. The fingerprint is the first 12 hex characters of the sha256 of that state line. On start with `--baseline`, a lane whose current fingerprint differs prints `changed since last watch:` instead of `baseline:`. A transition that lands between two watches therefore still fires.
- **(e) Stream-only, no lock.** The watch covers many lanes and runs until the deadline, like mailbox-watch's multi-file mode. It never exits on the first change. It takes no watch lock: it is read-only, and two watches only duplicate output.
- **(f) Constants and exit codes** mirror `scripts/mailbox-watch.mjs`: deadline 29 minutes by default, exit 3 on expiry, 1 on a runtime error, 64 on a usage error. The default interval is **30 s**, as in the prototype; mailbox-watch uses 15 s, and a handoff changes less often than a mailbox. `--interval` and `--deadline` override both. `tools/` cannot import a `scripts/*.mjs` module under the current tsconfig, so `tools/lane-status.ts` declares its own constants. A test imports both files and pins the deadline and exit codes as equal.
- **(g) Cut pre-review check (9b).** This check runs only when `--mailbox-root <dir>` is given. The mailbox file is `<dir>/<lane>/to-integrator.md`, where `<lane>` is the worktree basename. A lane *has a cut* when its worktree contains `specs/<active_feature>.md`. A *cut pre-review message* is a `--- msg` block with `type: proposal` whose `re:` contains `cut` or `預審` (case-insensitive). This recognizer was derived from every existing `_mailbox/*/to-integrator.md` (examples: `E177a PM cut pre-review`, `cut-draft`, `cut T-E204-01`, `e126 cut 預審`). Five states are possible:
  - `sent (to-integrator#<seq>)`: the first matching message.
  - `missing`: the spec exists and no matching message was found, or the mailbox file is absent.
  - `no-mailbox`: the spec exists but `<dir>/<lane>/` does not.
  - `n/a`: no spec.
  - `not-checked`: the lane is unreadable or has no active_feature.

  `tools/lane-status.ts` gets a minimal header reader of its own, and a test pins it to parity with `mailbox-watch.mjs`'s `parseMessageHeaders`. The tool is policy-neutral about single-role qa lanes: whether they must send a cut is E178a's prose decision.
- **(h) Exit codes stay the same.** One-shot `lane-status` exits 0 even when a lane reports `missing`, because it is a reporting surface like the rest of E177b. `fanout check` keeps its exit semantics: warnings alone exit 0, OUT lines exit 1, input errors exit 2. **Explicit decision: E208 does not change exit codes.** Strict mode is Open Question 1.
- **(i) E208 token classification.** `checkLane` lists `git ls-tree -r --name-only <base>`. For each owned token:
  - A *glob token* contains `*` or `{`, or ends with `/`. It is never warned about, because the lane may be creating those files.
  - An *exact token* that matches (via `matchesGlob`) any path at base is not warned about.
  - An exact token that matches no base path but matches a file the lane branch ADDED (from the existing `base...branch` diff, filtered to added files) is not warned about. It is a declared new file, like e177a's `新檔 \`tools/fanout-manifest.ts\``.
  - Every other exact token gets one `WARN` line.

  WARN lines are appended AFTER every existing output line, so the existing lines stay byte-identical and in the same order. No new error code is added: `FANOUT_CODES` is unchanged, and no new UPPER_SNAKE literal with a gate suffix (`_MISSING`, `_REQUIRED`, ...) appears in `tools/`, which keeps `test/error-code-contract.test.mjs` green. The `--base` default and the `--repo` default are unchanged.
- **(j) No behaviour change without the new flags.** `lane-status` without `--watch` / `--mailbox-root` produces byte-identical text and JSON output. The existing `test/e177a-*` / `test/e177b-*` suites stay green, and are edited only if a usage-text line changes. They are owned by this lane.
- **(k) Routing:** pm → sr-engineer (no architect). The work touches two existing modules, adds no data model and no cross-cutting API. Dispatch pin `sr-engineer=fable` (D7), persisted by the coordinator.

## Acceptance Criteria

### Watch mode (9a)

- **AC1** — Given a lane list of N lanes, when `lane-status --watch` starts without `--baseline`, then it prints `armed: watching <N> lane(s) — interval <s>s, deadline <m> min` followed by exactly one `[<lane>] baseline: <state>` line per lane, with `<state>` in the decision (c) key order.
  proof: `node --test test/e178b-lane-watch.test.mjs` (test "AC1 baseline on start"), with an injected provider/reader and a fake clock.
- **AC2** — Given a running watch, when a lane's handoff changes one or more of the decision (c) fields between two ticks, then exactly one `[<lane>] changed: <new state> — Δ <k1>,<k2>...` line is printed, naming the changed keys in key order. When only non-watched fields change (last_updated, pending_notes, completed_tasks), nothing is printed.
  proof: `node --test test/e178b-lane-watch.test.mjs` (tests "AC2 transition line", "AC2 non-watched field silent").
- **AC3** — Given a lane whose handoff becomes unreadable, or a lane that appears in or disappears from the lane list mid-watch, then the watch prints `[<lane>] changed: unreadable (<reason>)`, `[<lane>] appeared: <state>`, or `[<lane>] gone` respectively, and keeps running. It never drops a lane silently and never throws.
  proof: `node --test test/e178b-lane-watch.test.mjs` (test "AC3 degrade honestly").
- **AC4** — Given the deadline is reached, then the watch prints `expiring — re-arm` and then a re-arm command `node scripts/lane-status.mjs --watch ... --baseline <lane>=<fp>,...` carrying the fingerprints of the states it LAST READ, with no fresh read at expiry. Non-default `--interval` / `--deadline` / `--lanes` / `--mailbox-root` / `--repo` are carried in the command, and the process exits 3.
  proof: `node --test test/e178b-lane-watch.test.mjs` (test "AC4 expiry and re-arm command").
- **AC5** — Given `--baseline <lane>=<fp>` on start, when a lane's current fingerprint differs from `<fp>`, then that lane prints `[<lane>] changed since last watch: <state>`. An equal fingerprint prints `baseline:`, and a lane missing from the baseline prints `baseline:`. A baseline key that names no watched lane, or a malformed entry, is a usage error (exit 64). The re-arm output of AC4, fed back in, reproduces zero `changed since last watch` lines when nothing changed.
  proof: `node --test test/e178b-lane-watch.test.mjs` (test "AC5 re-arm round trip").
- **AC6** — Given `--watch` combined with `--rollup`, `--all` or `--json`, or given a non-positive-integer `--interval` / `--deadline`, then the CLI exits 64 with a `lane-status:` usage message. `--lanes a,b` under `--watch` restricts the watched set, matched by worktree basename. A named lane that matches nothing is reported once as `[<name>] gone` at start and the watch keeps running.
  proof: `node --test test/e178b-lane-watch.test.mjs` (test "AC6 argument rules").
- **AC7** — Given a watch tick, then no `git log` / `git status` subprocess and no evidence cross-check runs. Only the lane-list provider and the handoff reader are called, and `io.now` / `io.sleep` / `io.out` / `io.err` are injectable.
  proof: `node --test test/e178b-lane-watch.test.mjs` (test "AC7 tick reads only list + handoff").
- **AC8** — Given the watch constants in `dist/tools/lane-status.js`, then the default deadline minutes and the expiry, error and usage exit codes equal `scripts/mailbox-watch.mjs`'s `DEFAULT_DEADLINE_MINUTES` / `EXIT_EXPIRED` / `EXIT_ERROR` / `EXIT_USAGE`, and the default interval is 30 s.
  proof: `node --test test/e178b-lane-watch.test.mjs` (test "AC8 constants parity").
- **AC9** — Given `node scripts/lane-status.mjs --watch --interval 1 --repo <tmp git repo>` spawned as a process, then it streams the `armed:` line and one `baseline:` line per lane and stays alive, which proves the wrapper awaits the async runner. The spawned process is then terminated. The exit-3 path is proven by AC4 in-process, so the suite never waits out a real deadline. `node scripts/lane-status.mjs --watch --json` exits 64.
  proof: `node --test test/e178b-lane-watch.test.mjs` (test "AC9 script end to end").

### Cut pre-review fan-in (9b)

- **AC10** — Given `--mailbox-root <dir>`, a readable lane whose worktree has `specs/<active_feature>.md`, and `<dir>/<lane>/to-integrator.md` containing a `type: proposal` block whose `re:` contains `cut` or `預審` (any case), then the lane's cut pre-review state is `sent (to-integrator#<seq>)`, where `<seq>` belongs to the FIRST such block.
  proof: `node --test test/e178b-cut-prereview.test.mjs` (test "AC10 sent"), with fixtures under `test/fixtures/e178b/mailbox/` covering the recognized `re:` variants listed in decision (g).
- **AC11** — Given the spec exists and the mailbox file has no matching block, or the file is absent, then one-shot status prints, under that lane's block, the line `  cut pre-review: missing — specs/<active_feature>.md exists but <file> has no cut proposal`. JSON rows carry `cutPrereview: { state: "missing", ... }`. A `type: report` or `type: ack` block whose `re:` mentions cut does not count.
  proof: `node --test test/e178b-cut-prereview.test.mjs` (tests "AC11 missing explicit", "AC11 non-proposal ignored").
- **AC12** — Given no spec, then the state is `n/a`. Given an unreadable lane, it is `not-checked`. Given a spec but no `<dir>/<lane>/` directory, it is `no-mailbox`, printed explicitly as `  cut pre-review: no-mailbox — <dir>/<lane>/ does not exist`. Without `--mailbox-root`, no cut pre-review line or JSON field is emitted at all (decision (j)).
  proof: `node --test test/e178b-cut-prereview.test.mjs` (test "AC12 other states").
- **AC13** — Given any cut pre-review state, then one-shot `lane-status` still exits 0 (decision (h)).
  proof: `node --test test/e178b-cut-prereview.test.mjs` (test "AC13 exit code unchanged").
- **AC14** — Given the mailbox fixtures, then `tools/lane-status.ts`'s header reader yields the same `type` / `re` / `seq` per block as `scripts/mailbox-watch.mjs`'s `parseMessageHeaders`.
  proof: `node --test test/e178b-cut-prereview.test.mjs` (test "AC14 header parser parity").
- **AC15** — Given `--watch --mailbox-root <dir>`, when a lane moves from `missing` to `sent`, then a `changed:` line with `Δ cut_prereview` is printed (decision (c)).
  proof: `node --test test/e178b-lane-watch.test.mjs` (test "AC15 prereview transition").

### `fanout check` E208 warning (10)

- **AC16** — Given a lane row whose `擁有` has an exact (non-glob) token that matches no path in `git ls-tree -r --name-only <base>` and no file the lane branch added, when `fanout check` runs, then it prints `WARN  <token>  (擁有 token matches no path at <base> and is not a glob or a file added on <branch>)` once per such token, after all existing output lines.
  proof: `node --test test/e178b-fanout-unmatched.test.mjs` (test "AC16 unmatched exact token warns").
- **AC17** — Given glob tokens (containing `*`, `{`, or a trailing `/`), exact tokens that exist at base, and exact tokens the branch added, then none of them is warned about.
  proof: `node --test test/e178b-fanout-unmatched.test.mjs` (test "AC17 no false warnings").
- **AC18** — Given only WARN lines and no OUT lines, then the exit code is 0. Given OUT lines, it is 1. Given input errors, it is 2 (decision (h)). The existing lines stay byte-identical and in order, with the WARN lines strictly after them.
  proof: `node --test test/e178b-fanout-unmatched.test.mjs` (test "AC18 exit codes and line order").
- **AC19** — Given the fixture `test/fixtures/e178b/fanout-wave7-e177a.md` (a copy of wave7's e177a row) and a temp repo whose base lacks `feature-rollup.mjs` at the root, then `fanout check` warns on `feature-rollup.mjs` and not on `dist/tools/*.js`. This is the E208 regression.
  proof: `node --test test/e178b-fanout-unmatched.test.mjs` (test "AC19 E208 regression").

### Whole ticket

- **AC20** — Given the committed branch with a clean worktree, then `npm test` passes in full. That includes `test/e177a-*`, `test/e177b-*`, `test/lane-paths.test.mjs` (the CALLERS allow-list is unchanged) and `test/error-code-contract.test.mjs` (no new code literal), and `dist/` matches a fresh `npm run build`.
  proof: `cd <lanes-root>/e178b && npm run build && git status --porcelain dist/ && npm test` (empty porcelain, all pass).
- **AC21** — Given the lane branch, then `node scripts/fanout.mjs check specs/fanout-wave7.2.md e178b --base 121ddc8` reports 0 out of bounds. This runs the lane's own ownership check with the new tool.
  proof: that command, which exits 0.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| watch.armed | `armed: watching <N> lane(s) — interval <s>s, deadline <m> min` | authored-here: parallels mailbox-watch's `armed:` line |
| watch.baseline | `[<lane>] baseline: <state>` | prototype `lane-state-watch.mjs` |
| watch.changed | `[<lane>] changed: <state> — Δ <keys>` | prototype + authored-here (Δ list names which keys moved) |
| watch.changed-since | `[<lane>] changed since last watch: <state>` | authored-here: decision (d) re-arm gap event |
| watch.appeared | `[<lane>] appeared: <state>` | authored-here: AC3 |
| watch.gone | `[<lane>] gone` | prototype's `worktree-gone`, reworded |
| watch.unreadable | `unreadable (<reason>)` | authored-here: AC3, E177b degrade-honestly posture |
| watch.state | `feature=<f> status=<s> last_agent=<a> next_role=<r> hop=<n> review_round=<n> qa_round=<n>[ cut_prereview=<st>]` | prototype key list + decision (c) |
| watch.expiring | `expiring — re-arm` | `scripts/mailbox-watch.mjs` (verbatim convention) |
| watch.rearm | `node scripts/lane-status.mjs --watch [<carried flags>] --baseline <lane>=<fp>,...` | authored-here: decision (d) |
| prereview.line | `  cut pre-review: <state>` | authored-here: AC11/AC12 |
| prereview.missing | `missing — specs/<f>.md exists but <file> has no cut proposal` | authored-here: AC11 |
| prereview.no-mailbox | `no-mailbox — <dir>/<lane>/ does not exist` | authored-here: AC12 |
| prereview.states | `sent (to-integrator#<seq>)` / `n/a` / `not-checked` | authored-here: decision (g) |
| fanout.warn | `WARN  <token>  (擁有 token matches no path at <base> and is not a glob or a file added on <branch>)` | authored-here: E208 row fix option 2 |
| usage.watch | new `LANE_STATUS_USAGE` lines for `--watch`, `--interval <s>`, `--deadline <min>`, `--baseline <lane>=<fp>,...`, `--mailbox-root <dir>` | authored-here: sr-engineer words them. Existing lines stay unchanged |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- SOP, `docs/lane-protocol.md` and integrator-SOP prose, including how the integrator is told to run the watch. That is E178a, which cites these tools.
- The policy on whether a single-role qa lane sends a cut (E178a). This tool reports states and is policy-neutral.
- A canonical `re:` token for cut pre-review messages. The recognizer accepts current practice, and E178a may tighten it (Open Question 2).
- A strict or failing mode for E208 (Open Question 1), and a manifest quoting convention (E208 option 1, E178a format section).
- Watch locking, desktop notifications, and running git per tick.
- Changes to `scripts/mailbox-watch.mjs` (read-only reference).

## File bounds (from the dispatch prompt; downstream roles must respect)

- **Owned:** `tools/lane-status.ts`, `scripts/lane-status.mjs`, `tools/fanout-manifest.ts`, `scripts/fanout.mjs`, `dist/**`, `test/e178b-*.test.mjs`, `test/fixtures/e178b/**`, `test/e177a-*.test.mjs`, `test/e177b-*.test.mjs`, `specs/e178b-*`, `qa_reports/*E178B*`, `review_reports/*E178B*`, `.current/e178b/**`, plus new files this ticket creates and their tests. Only qa-engineer writes `test/` (Constitution §2).
- **Forbidden:** `content/**`, goldens, budget, `bin/**`, `prompts/**`, `tools/registry.ts`, other `tools/**` (import only), `scripts/mailbox-watch.mjs`, `docs/**`, `package.json`, `.claude/commands/integrator.md`, `specs/fanout-*.md` (copy it into `test/fixtures/e178b/` if a fixture needs it), and e130's files.
- **Implicit constraints:**
  - No new `tools/*.ts` that mentions `lane-paths`, because `test/lane-paths.test.mjs` is not owned.
  - No new gate-suffix UPPER_SNAKE code literal in `tools/` (`test/error-code-contract.test.mjs`).
  - Do not run `npm ci` / `npm install` in the lane.

## Dependencies / Prerequisites

- E177a (`tools/fanout-manifest.ts`) and E177b (`tools/lane-status.ts`, `scripts/mailbox-watch.mjs`) are on base `121ddc8` ✓.
- The prototype `<lanes-root>/lane-state-watch.mjs` has been read and is superseded by this ticket. The integrator retires it after merge.
- Mailbox corpus: `<lanes-root>/_mailbox/*/to-integrator.md` was read to derive the decision (g) recognizer. Tests use copied fixtures, never the live corpus.
- No design file, mode = no-design. Visual Structural Assertions omitted.

## Open Questions (integrator / human)

1. **E208 exit semantics.** The cut keeps warnings at exit 0 (decision (h)). Should a later `--strict` flag, or E178a's format section, turn an unmatched owned token into an OUT-class failure? The cut's position is no: warning only for this ticket.
2. **Cut pre-review recognizer.** The recognizer is `type: proposal` plus a `re:` containing `cut` or `預審`. Is that acceptable, or should E178a's formal mailbox protocol mandate a canonical `re:` token (for example `cut pre-review`) that this check then requires exactly?
3. **"Has a cut" signal.** The cut uses `specs/<active_feature>.md` existing in the lane worktree, as the ticket words it ("PM spec written"). The alternative is a non-empty lane task ledger. Confirm the spec-file signal.
4. **Default watch set.** The default is every lane in `git worktree list`, including primary. Primary normally has no mailbox, so it shows `no-mailbox` or `n/a` under `--mailbox-root`. Should primary be excluded by default instead?
5. **Default interval.** The cut uses 30 s, as in the prototype, against mailbox-watch's 15 s. Confirm.
