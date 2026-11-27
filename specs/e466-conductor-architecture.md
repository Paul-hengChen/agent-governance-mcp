# e466-conductor — architecture

Ticket E466, lane e466, wave 2 of `specs/fanout-conductor.md`. Authoritative inputs: `specs/e466-conductor.md` (cut, Build contract, Copy / Strings), `docs/tickets/E466.md` (S1–S9), the manifest's e466 row and Probe table, and the discussion record's rulings R1, R2, R4, R7–R14, R16–R18 (not reopened). This document fixes the mechanism inside that cut: module seams, the state file, the wave-done parser and decision table, vanished-integrator detection, exported signatures, and the files per task. Every user-visible string named `<id>` below is the Copy / Strings row of that id in `specs/e466-conductor.md`, quoted verbatim by the implementation; strings this document adds are marked *(arch)*.

Hard limits carried from the cut (restated so the implementer never has to re-derive them): no server, gate, `GATE_REGISTRY`, pipeline, `tw_switch_role` enum, error-code or schema change; no tmux or background session; `tools/lane-launch.ts`, `scripts/lane-launch.mjs`, `tools/config.ts`, `tools/fanout-manifest.ts` and `scripts/mailbox-watch.mjs` are imported or called, never edited; `CLAUDE.md` net 0 lines (only the three `gates/*.ts` continuation lines merged, per `claude.lines`); served text (`content/skill-conductor.md`, the prompt description) has no bare ticket id and no repo-only path.

## Affected Files

| file | kind | task | notes |
|---|---|---|---|
| `content/skill-conductor.md` | new | T-E466-06 | `sop.conductor` verbatim, nothing else |
| `prompts/conductor.ts` | new | T-E466-06 | `buildConductorPrompt(workspacePath)`, shaped like `prompts/integrator.ts` |
| `tools/registry.ts` | modify | T-E466-06 | one `PROMPT_REGISTRY` entry appended after `spec-workshop`; nothing else |
| `dist/prompts/conductor.{js,js.map,d.ts,d.ts.map}` | new (build) | T-E466-06 | `npm run build` output |
| `dist/tools/registry.{js,js.map,d.ts,d.ts.map}` | modify (build) | T-E466-06 | |
| `tools/conductor.ts` | new | T-E466-07, -08, -09 (serial) | pure core + host deps + CLI entry; the only logic file |
| `dist/tools/conductor.{js,js.map,d.ts,d.ts.map}` | new (build) | T-E466-07..09 | |
| `scripts/conductor.mjs` | new | T-E466-09 | thin wrapper, `script.header`, 3 code lines like `scripts/lane-launch.mjs` |
| `content/skill-integrator.md` | modify | T-E466-10 | one sentence replaced in place by `integrator.relaunch`; 269 lines before and after |
| `CLAUDE.md` | modify | T-E466-11 | `claude.lines` exactly; 250 lines before and after |
| `README.md` | modify | T-E466-11 | `readme.count`, `readme.row` |
| `docs/install.md` | modify | T-E466-11 | `install.line` |
| `docs/config.md` | modify | T-E466-11 | `config.conductor` after the `---` closing the `waveDoneAt` section (section byte-identical) |
| `test/e466-*.test.mjs`, `test/fixtures/e466/**` | new (qa) | T-E466-01..04 | qa-owned; sr-engineer never edits |
| `test/e178a-…`, `test/e423-…`, `test/e428-…`, `test/skill-frontmatter.test.mjs`, `test/e443b-served-text.test.mjs` | modify (qa re-pin) | T-E466-02 | Probe-table reds only |
| `qa_reports/expected-red_e466-conductor.txt`, `qa_reports/manual-verification_e466-conductor.md` | new (qa) | T-E466-01..05 | |

Not touched (listed so a reviewer can diff against it): `docs/lane-protocol.md`, `docs/lane-protocol-addendum.md`, `docs/tickets/**` (except the two integrator-accepted changes in `docs/tickets/E466.md`: in-place `Verification:` lines by qa, frontmatter `status:` after PASS), compose goldens, `test/context-budget.test.mjs` (no conductor cap), `index.ts`, `tools/role.ts`, every `gates/*.ts`.

### Module seam

```
scripts/conductor.mjs   (3 lines: import runConductorCli + createConductorHostDeps from dist/tools/conductor.js;
                          process.exitCode = await runConductorCli(process.argv.slice(2), createConductorHostDeps(), process.cwd()))
        │
tools/conductor.ts
  §A constants, CONDUCTOR_OUT, state shape           (pure)
  §B context + state file + mailbox files            (fs only, under a passed gitCommonDir)
  §C report parser + fact decision                   (pure)
  §D commands: open / close / wake / wave-done / check / state   (async; every side effect through ConductorDeps)
  §E argv parser + runConductorCli                   (pure dispatch)
  §F createConductorHostDeps                         (the only place that touches iTerm2, gh, node child processes, the real launcher)
        │ imports (never edits)
tools/lane-launch.ts   WindowDriver, Clock, GitRunner, LaunchContext, sendText, newSignals, READY_MARKER, READY_TIMEOUT_MS,
                       READY_POLL_MS, READY_SETTLE_MS, UNKNOWN_CHECK_MS, RESEND_GAP_MS, RESEND_BOUND, EXIT_LINE, WAKE_LINE,
                       launchCommand, createItermDriver, parseMailboxMessages, MailboxMessage, resolveLaunchContext,
                       runLaneLaunch, createHostDeps
tools/config.ts        resolveWaveDoneAt, WaveDoneAt
tools/fanout-manifest.ts  parseManifest
```

`tools/conductor.ts` imports nothing from `scripts/` (a `.ts` file cannot type-import `scripts/mailbox-watch.mjs`); the one mailbox write it performs (the reply) re-implements `mailbox-watch.mjs`'s block format byte-for-byte (see *Interface Contracts — appendConductorReply*).

## Data Structures

### State file — `<git common dir>/agc-conductor.json`

Location: `path.join(gitCommonDir, "agc-conductor.json")`, where `gitCommonDir` is resolved exactly as `resolveLaunchContext` does (primary from the first `worktree` line of `git worktree list --porcelain`, then `git rev-parse --git-common-dir` run in primary, `realpath`ed). It is inside `.git/`, so it is never in a working tree and never tracked (S4).

```ts
export const CONDUCTOR_STEPS = ["opening", "integrator-open", "wave-closed", "integrator-gone", "done"] as const;
export type ConductorStep = (typeof CONDUCTOR_STEPS)[number];

export interface ConductorState {
  version: 1;
  /** Discussion record of the first wave, primary-relative and `/`-separated; null when the run started from `open --manifest`. */
  record: string | null;
  /** Fan-out manifest, primary-relative and `/`-separated; null until the first wave-done report names it (first wave) or `open --manifest` sets it. */
  manifest: string | null;
  /** Wave the recorded integrator holds (1 for `open --record`). */
  wave: number;
  /** iTerm2 window id of the current integrator, as text; null only before the first open. */
  windowId: string | null;
  step: ConductorStep;
  /** Messages in `agc-conductor/to-lane.md` when the current integrator was opened; only messages at index >= floor count as this wave's report. */
  reportFloor: number;
  updatedAt: string; // ISO-8601
}
```

Example (after the first wave closed and wave 2 opened):

```json
{
  "version": 1,
  "record": "docs/discussions/2026-11-27-integrator-session-rotation.md",
  "manifest": "specs/fanout-conductor.md",
  "wave": 2,
  "windowId": "2901",
  "step": "integrator-open",
  "reportFloor": 1,
  "updatedAt": "2026-11-28T09:12:44.000Z"
}
```

Steps:

| step | meaning | set by | next |
|---|---|---|---|
| `opening` | `driver.open` returned a window id; ready wait / sends not finished | `open`, before the ready wait | `integrator-open`, or stays on a refused start |
| `integrator-open` | integrator prompt line and its opening line sent | `open`, after the second `sendText` | `wave-closed`, `integrator-gone` |
| `wave-closed` | every fact met and `/exit` sent (or the window already gone); close-finished and next open not yet both done | `wave-done` | `opening` (next wave) or `done` |
| `integrator-gone` | `check` found the window missing with no report for this wave | `check` | `opening` (a human-directed `open`) |
| `done` | last wave's facts met | `wave-done` | — (a new `open --record` starts a new run) |

Read rules: absent file → no run recorded (not an error). Present file that is not JSON, or `version !== 1`, or a field of the wrong type, or `step` not in `CONDUCTOR_STEPS` → refused with *(arch)* `the conductor state <file> does not parse; move it aside` (exit 1); never overwritten. Writes go through tmp file + `fs.renameSync` (same pattern as `writeLaunchState`).

### Mailbox — `<git common dir>/agc-conductor/`

`to-lane.md` (only the integrator writes, via `mailbox-watch.mjs --send --from integrator`) and `to-integrator.md` (only the conductor writes). `open` creates the folder and both empty files when absent (`fs.mkdirSync(..., { recursive: true })`, `fs.writeFileSync(f, "", { flag: "a" })`), never truncating an existing file. `state`, `check`, `wave-done` never create them (a missing `to-lane.md` reads as zero messages).

```ts
export interface ConductorPaths { state: string; mailboxDir: string; toLane: string; toIntegrator: string }
export interface ConductorContext { primary: string; gitCommonDir: string }
```

### Wave-done report

```ts
export interface WaveDoneReport { index: number; seq: string | undefined; wave: number; manifest: string; pr: number }
```

Machine-read line (`report.first-item`): the first body line whose trimmed text starts `- 做了什麼：`, matched by

```
/^- 做了什麼：wave (\d+) of (\S+), pull request #(\d+)\s*$/
```

against the trimmed line. Only the newest message at `index >= reportFloor` with `type: report` (trimmed) and `re:` starting `wave-done` (trimmed) is considered.

### Seams

```ts
export type PrStateResult = { ok: true; state: string } | { ok: false; why: string };

export interface ConductorDeps {
  driver: WindowDriver;                      // from tools/lane-launch.ts
  clock: Clock;                              // from tools/lane-launch.ts
  git: GitRunner;                            // from tools/lane-launch.ts
  /** `gh pr view <pr> --json state` in `cwd`; state is the JSON's `state` string verbatim. */
  prState: (pr: number, cwd: string) => PrStateResult;
  /** `node <install>/scripts/fanout.mjs handoff --check <manifestAbs>` in `primary`; returns the exit code (spawn failure → 1). */
  handoffCheck: (manifestAbs: string, primary: string) => number;
  /** The launcher's close-finished run for the manifest; returns its exit code. */
  closeFinished: (manifestAbs: string) => Promise<number>;
  out: (line: string) => void;
  err: (line: string) => void;
  now: () => Date;                           // updatedAt and the reply's time header
}
```

`git` doubles as the context resolver's runner, so tests drive context from a real temp repo (S4 untracked check) or a stand-in.

## Interface Contracts

All exported from `tools/conductor.ts`.

### §A constants and output lines

```ts
export const CONDUCTOR_STATE_FILE = "agc-conductor.json";
export const CONDUCTOR_MAILBOX_DIR = "agc-conductor";
export const CONDUCTOR_STATE_VERSION = 1;
export const INTEGRATOR_SLASH_LINE = "/mcp__agent-governance-mcp__integrator";   // integrator.slash
export const CONDUCTOR_USAGE = "usage: node scripts/conductor.mjs state | open (--record <record> | --manifest <manifest> --wave <n>) | close | wake | wave-done | check"; // usage.line
export const fanoutLine = (record: string): string => `fan-out ${record}`;                       // fanout.line
export const takeoverLine = (manifest: string, n: number): string => `接手 ${manifest}，開始第 ${n} 波次`; // takeover.line
export const CONDUCTOR_OUT = {
  opened, closed, woken, unmet, allDone, gone, ok,             // out.* rows, verbatim templates
  factPr, factHandoff, factReport, replyUnmet, stateLine,      // fact.*, reply.unmet, state.line
  refused: (reason: string) => `conductor: refused — ${reason}`,                       // (arch) mirrors OUT.refused
  refusedOpen: (id: string) => `an integrator is already open — window ${id}; close it first`,          // (arch)
  refusedNoWindow: "no integrator window is recorded",                                                  // (arch)
  refusedWindowGone: (id: string) => `integrator window ${id} does not exist`,                          // (arch)
  refusedNotReady: (id: string, s: number) => `integrator window ${id} not ready after ${s} s`,         // (arch)
  refusedUnknown: (id: string, n: number) => `integrator window ${id}: Unknown command after ${n} resends`, // (arch)
  refusedStep: (step: string) => `wave-done needs step integrator-open or wave-closed, not ${step}`,   // (arch)
  refusedNotRepo: (dir: string) => `${dir} is not inside a git repository`,                             // (arch)
};
```

`stateLine(state: ConductorState | undefined, paths: ConductorPaths): string` renders `state.line`; `—` for a null `manifest` / `record` / `windowId`. With no state file it renders manifest `—`, record `—`, wave `0`, window `—`, step `none` (the SOP's "No run recorded" test reads `step none`).

`factPr(pr, state, waveDoneAt)` renders `fact.pr` with `needs MERGED` under `merged` and `needs OPEN/MERGED` under `pr-open`; a failed `prState` renders `<state>` as `unknown` *(arch: the gh error's first line goes to `deps.err` on its own line)*.

### §B context, state, mailbox

```ts
export function resolveConductorContext(cwd: string, git: GitRunner): ConductorContext | { error: string };
export function conductorPaths(gitCommonDir: string): ConductorPaths;
export function readConductorState(file: string): { ok: true; state: ConductorState | undefined } | { ok: false; error: string };
export function writeConductorState(file: string, state: ConductorState): void;   // tmp + rename; caller sets updatedAt
export function ensureConductorMailbox(paths: ConductorPaths): void;
export function toPrimaryKey(primary: string, p: string): string;   // realpath-relative, `/`-separated (manifestKey rule)
```

`resolveConductorContext` runs the same two git calls as `resolveLaunchContext`, with `cwd` as the `git worktree list` working directory. CLI `cwd` = `process.cwd()` (the conductor session runs in primary; from a lane worktree it still resolves primary, so the state is shared).

### §C parser and fact decision (pure)

```ts
export function parseWaveDoneFirstItem(body: string): { wave: number; manifest: string; pr: number } | undefined;
export function findWaveDoneReport(messages: MailboxMessage[], floor: number): { index: number; msg: MailboxMessage } | undefined;
export function hasWaveDoneReport(messages: MailboxMessage[], floor: number): boolean;   // S6
export function prFactMet(state: string, waveDoneAt: WaveDoneAt): boolean;               // MERGED, or OPEN|MERGED under pr-open
export function nextWave(manifestText: string, wave: number): number | undefined;        // smallest 波次 > wave in parseManifest(...).dispatchable, else undefined
export function appendConductorReply(file: string, input: { re: string; body: string; time: Date }): void;
```

`appendConductorReply` writes exactly what `mailbox-watch.mjs --send` would for `--from conductor --type reply`, except `hop: —`: seq = max header `seq` + 1 (1 when empty), separator `""` / `"\n"` / `"\n\n"` by the existing text's ending, block `--- msg\nseq: <n>\nfrom: conductor\ntype: reply\nre: <re>\ntime: <YYYY-MM-DDTHH:MM:SSZ>\nhop: —\n---\n<body>\n`. `re` = `to-lane#<seq of the report>` when a report was found, else `wave-done <n>`.

### §D commands

All return the process exit code; all read context and state first (refusals above → exit 1, printed with `deps.err(CONDUCTOR_OUT.refused(...))`).

```ts
export type OpenTarget = { record: string } | { manifest: string; wave: number };
export async function conductorOpen(ctx: ConductorContext, deps: ConductorDeps, target: OpenTarget): Promise<number>;
export async function conductorClose(ctx: ConductorContext, deps: ConductorDeps): Promise<number>;
export async function conductorWake(ctx: ConductorContext, deps: ConductorDeps): Promise<number>;
export async function conductorWaveDone(ctx: ConductorContext, deps: ConductorDeps): Promise<number>;
export async function conductorCheck(ctx: ConductorContext, deps: ConductorDeps): Promise<number>;
export function conductorState(ctx: ConductorContext, deps: ConductorDeps): number;
```

**open** (S3, S4):
1. Refuse when the state's step is `opening` / `integrator-open` and `driver.exists(windowId)` is true (`refusedOpen`). Otherwise (no state, `done`, `integrator-gone`, `wave-closed`, or a recorded window that is gone) proceed.
2. `ensureConductorMailbox`; `reportFloor` = `parseMailboxMessages(to-lane text).length`.
3. `id = await driver.open(launchCommand(ctx.primary, "integrator"))`; write state `{ step: "opening", windowId: id, wave, record, manifest, reportFloor }` — `--record`: `record` = key, `manifest` = null, `wave` = 1; `--manifest`: `manifest` = key, `wave` = n, `record` kept from a prior state (else null).
4. Ready wait exactly as `startSession`: poll `driver.contents` (errors read as `""`) for `READY_MARKER` every `READY_POLL_MS` until `READY_TIMEOUT_MS` (→ `refusedNotReady`, exit 1, step stays `opening`), then sleep `READY_SETTLE_MS`.
5. `sendText(INTEGRATOR_SLASH_LINE)`; after `UNKNOWN_CHECK_MS`, if `newSignals(contents, baseline).unknown`, wait `RESEND_GAP_MS - UNKNOWN_CHECK_MS` and resend, at most `RESEND_BOUND` times (→ `refusedUnknown`, exit 1).
6. `sendText(fanoutLine(record))` or `sendText(takeoverLine(manifest, n))` — the line carries the manifest as its primary-relative key.
7. Write step `integrator-open`; `deps.out(opened(wave, id))`; exit 0.

**close**: no `windowId` → `refusedNoWindow`; window not existing → `refusedWindowGone`; else `sendText(EXIT_LINE)` to the recorded id only, `out.closed`, exit 0. State: only `updatedAt` changes (a hand-directed close is then reported by the next `check` as gone, so the human is told).

**wake**: same guards; `sendText(WAKE_LINE)` to the recorded id only; `out.woken`; exit 0; state untouched.

**state**: prints `stateLine`; exit 0 (exit 1 only on an unparseable file).

**wave-done** (S5) — decision table, evaluated in order:

| # | condition | action | exit |
|---|---|---|---|
| 0 | step not in {`integrator-open`, `opening`, `wave-closed`} | `refusedStep` | 1 |
| 1 | step `wave-closed` | skip to row 6 (resume after a lost conductor; facts were already met) | — |
| 2 | no wave-done report at `index >= reportFloor`, or its first item does not parse | unmet: `factReport` with expected `<n>` = state wave, `<manifest>` = state manifest or literal `<manifest>`, `<number>` literal | 1 |
| 3 | parsed wave ≠ state wave, or (state manifest set and parsed manifest key ≠ it), or (state manifest null and the parsed manifest is not a readable file under primary) | unmet: `factReport` | 1 |
| 4 | evaluate both facts (no short-circuit): `prFactMet(prState(pr, primary), resolveWaveDoneAt(primary).waveDoneAt)`; `handoffCheck(manifestAbs, primary) === 0` | each false one → `factPr` / `factHandoff` | — |
| 5 | any unmet fact from 2–4 | `appendConductorReply(to-integrator.md, replyUnmet(n, facts))`; one `deps.err(unmet(n, fact))` per fact; no `/exit`, no launcher call, no `driver.open`; state untouched | 1 |
| 6 | all met | if state manifest null, record the parsed manifest key. If `driver.exists(windowId)`: `sendText(EXIT_LINE)`, `out.closed`; else skip silently. Write step `wave-closed`. | — |
| 7 | | `await deps.closeFinished(manifestAbs)` — its own lines reach the terminal through the launcher deps; a non-zero exit does not stop the run | — |
| 8 | `nextWave(manifestText, n)` = k | `conductorOpen(ctx, deps, { manifest, wave: k })` (prints `out.opened`; its exit code is returned) | 0 / open's |
| 9 | no later wave | write step `done`; `out.allDone(manifest)` | 0 |

`resolveWaveDoneAt`'s `rejected` value, when present, is reported with `deps.err` as the launcher does (reuse the launcher's `OUT.waveDoneInvalid` text through `import { OUT } from "./lane-launch.js"`), then `merged` applies.

**check** (S6):

| condition | output | state | exit |
|---|---|---|---|
| no state, or step not `opening` / `integrator-open` | `stateLine` | — | 0 |
| step `opening` / `integrator-open`, `driver.exists(windowId)` true | `out.ok(wave, id)` | — | 0 |
| window gone, `hasWaveDoneReport(messages, reportFloor)` true | `stateLine` (the watch delivers the report; `wave-done` then skips `/exit`) | — | 0 |
| window gone, no report | `deps.err(gone(wave, manifest ?? record, id))` | step `integrator-gone` | 1 |

`check` never calls `driver.open`, `closeFinished`, `prState` or `handoffCheck`.

### §E CLI

```ts
export type ConductorCommand =
  | { cmd: "state" } | { cmd: "close" } | { cmd: "wake" } | { cmd: "wave-done" } | { cmd: "check" }
  | { cmd: "open"; target: OpenTarget };
export function parseConductorArgv(argv: string[]): ConductorCommand | undefined;
export async function runConductorCli(argv: string[], deps: ConductorDeps, cwd: string): Promise<number>;
```

Parser: the five bare commands take no further argument; `open` takes exactly `--record <path>`, or exactly `--manifest <path>` and `--wave <n>` (either order, each once, `<n>` matching `/^[1-9]\d*$/`). Anything else → `undefined` → `deps.err(CONDUCTOR_USAGE)`, exit 2. An `open` path that is not readable → `conductor: cannot read <path>: <first line>` *(arch)* + usage, exit 2 (the launcher's rule). Context error → `refusedNotRepo`, exit 1.

`scripts/conductor.mjs`:

```js
#!/usr/bin/env node
// Coded by @sr-engineer
// Thin CLI wrapper (all logic in tools/conductor.ts): opens, closes and wakes the integrator session of each wave of a fan-out manifest for the conductor prompt.
// Usage: node scripts/conductor.mjs state | open (--record <record> | --manifest <manifest> --wave <n>) | close | wake | wave-done | check
// Exit: 0 = done, 1 = a fact unmet / integrator gone / refused (stderr), 2 = usage.
import { runConductorCli, createConductorHostDeps } from "../dist/tools/conductor.js";
process.exitCode = await runConductorCli(process.argv.slice(2), createConductorHostDeps(), process.cwd());
```

### §F host deps

```ts
export function createConductorHostDeps(): ConductorDeps;
```

- `driver` = `createItermDriver()`; `clock` = real; `git` = `spawnSync("git", …)` (same shape as the launcher's).
- `prState(pr, cwd)` = `spawnSync("gh", ["pr", "view", String(pr), "--json", "state"], { cwd, encoding: "utf8" })`; status 0 and `JSON.parse(stdout).state` a string → `{ ok: true, state }`, else `{ ok: false, why: firstLine(stderr || stdout || error) }`.
- `handoffCheck(manifestAbs, primary)` = `spawnSync(process.execPath, [path.join(INSTALL_ROOT, "scripts", "fanout.mjs"), "handoff", "--check", manifestAbs], { cwd: primary, stdio: ["ignore", "inherit", "inherit"] }).status ?? 1`. `INSTALL_ROOT` = two levels above `dist/tools/` (the launcher's rule).
- `closeFinished(manifestAbs)` = `const deps = createHostDeps(); const ctx = resolveLaunchContext(manifestAbs, deps.git); return "error" in ctx ? (deps.err(...), 1) : runLaneLaunch(ctx, deps, { closeFinished: true });` — in-process, so the launcher's lock and refusals apply unchanged.

## Sequence Diagram

```mermaid
sequenceDiagram
  participant H as Human
  participant C as Conductor session
  participant S as conductor.mjs
  participant W as iTerm2 (WindowDriver)
  participant I as Integrator session
  participant G as gh / fanout.mjs
  participant L as Lane launcher
  H->>C: start, give discussion record
  C->>S: state
  S-->>C: state.line (step none)
  C->>S: open --record <record>
  S->>W: open(launchCommand(primary,"integrator")), wait READY_MARKER
  S->>W: sendText(integrator.slash), sendText("fan-out <record>")
  S-->>C: opened integrator — wave 1, window <id>
  C->>C: Monitor: mailbox-watch.mjs agc-conductor/to-lane.md
  I->>L: Stage 3 launcher run, lanes work, Stage 6 merge
  I->>C: to-lane.md type report re "wave-done 1" (- 做了什麼：wave 1 of <manifest>, pull request #N)
  C->>S: wave-done
  S->>G: gh pr view N --json state ; fanout.mjs handoff --check <manifest>
  alt a fact unmet
    S->>I: to-integrator.md reply.unmet
    S-->>C: wave 1 not done — <fact>; integrator kept open (exit 1)
  else all met
    S->>W: sendText(/exit) to window <id>
    S->>L: runLaneLaunch(ctx, deps, {closeFinished:true})
    S->>W: open + integrator.slash + "接手 <manifest>，開始第 2 波次"
    S-->>C: closed integrator — window <id> / opened integrator — wave 2, window <id2>
  end
  Note over C,S: on watch expiry: conductor.mjs check → out.ok, or out.gone (no open) → notify H
  C->>S: wave-done (last wave)
  S-->>C: all waves done — <manifest>
  C->>H: every wave done; stop
```

## Decision Records

| Context | Decision | Consequences |
|---|---|---|
| Testability of S3–S6 without iTerm2, `gh` or a real launcher | One `ConductorDeps` object with `driver`, `clock`, `git`, `prState`, `handoffCheck`, `closeFinished`, `out`, `err`, `now`; commands take `(ctx, deps)` | qa drives every scenario with stand-ins and a temp git repo; host wiring lives in `createConductorHostDeps` alone and is exercised only by S9 |
| The launcher's `startSession` hard-codes the teamwork `SLASH_LINE` | Re-implement the ready wait / settle / Unknown-command resend loop in `conductorOpen` from the launcher's exported constants and `sendText` / `newSignals` | No edit to `tools/lane-launch.ts`; ~15 duplicated lines whose constants stay single-sourced |
| Which mailbox messages are "this wave's report" (S5 newest report; S6 "no report for the current wave") | `reportFloor` = `to-lane.md` message count at open; only messages at index >= floor count | One mailbox serves the whole run; an old wave's report can never close a newer integrator; independent of how the integrator spells `re:` beyond the `wave-done` prefix |
| First wave starts from a discussion record; the manifest does not exist yet | `manifest` is null after `open --record`; the first met wave-done records the report's manifest (must be a readable file under primary); later reports must name the same manifest | The conductor learns the manifest from the only party that creates it; a mistyped manifest in a later report is an unmet `fact.report`, never a silent switch |
| Crash between `/exit` and the next open | Step `wave-closed` written right after `/exit`; `wave-done` on `wave-closed` skips the fact check and resumes at close-finished | Resume (R7) never re-sends `/exit` into a new window and never re-checks facts that may have moved (for example a branch deleted after merge); close-finished is idempotent (`windowClosed`) |
| Close-finished refused (another launcher run holds the lock, a host refusal) | Its exit code does not stop the run; the next integrator still opens | Lane-window closing is housekeeping; the SOP already re-runs a refused launcher at the next watch expiry; the next integrator is never held hostage to a lock |
| `pr-open` R10 notice ("which pull request the waiting lanes wait on") | Left to the conductor session's judgment (SOP step 3); the script prints nothing extra | No extra string or `gh` query; the cut put this in `sop.conductor` with no scenario |
| Locking the conductor state | No lock file; atomic tmp + rename writes | One conductor session calls the script serially; a second conductor exists only after the first is lost (R7). A lock would add a stale-PID path for no observed race |
| Exit-1 lines (`out.unmet`, `out.gone`, refusals) | Written to stderr; every other line to stdout | Matches `script.header` "(stderr)"; qa asserts by capture stream |
| Next wave number | Smallest `波次` greater than the current one in `parseManifest(...).dispatchable` | Equals `n+1` for every contiguous wave table (the Build contract's case); a gap never opens an empty wave |
| Reply hop header | `hop: —` written in-process, not via `mailbox-watch.mjs --send` | `mailbox-watch.mjs` would compute `n/cap` from a handoff for any non-integrator sender; the conductor has no handoff state. Byte format otherwise identical, so `mailbox-watch.mjs` counts and watches it unchanged |

## Deferred Resources

_None — the spec's Dependencies / Prerequisites shows zero ignored or deferred external references (resource audit: repo paths and the discussion record only; no `external_refs`)._

## Task file budget

One task = one sr-engineer session. Files each task writes (build output included):

| task | role | files |
|---|---|---|
| T-E466-01 | qa | `test/e466-prompt.test.mjs` (S1, S2, S7), `qa_reports/expected-red_e466-conductor.txt` |
| T-E466-02 | qa | `test/e466-integrator-sop.test.mjs` (S8); re-pins in `test/e178a-integrator-role.test.mjs`, `test/e423-spec-workshop.test.mjs`, `test/e428-tracker-mirror.test.mjs`, `test/e443b-served-text.test.mjs`, `test/skill-frontmatter.test.mjs`; expected-red file |
| T-E466-03 | qa | `test/e466-window-state.test.mjs` (S3, S4), `test/fixtures/e466/**` (manifest with two `波次`, a discussion-record stub); expected-red file |
| T-E466-04 | qa | `test/e466-wave-done.test.mjs` (S5, S6), `test/fixtures/e466/**` (`to-lane.md` samples: well-formed report, unparseable first item, wrong wave); expected-red file |
| T-E466-05 | qa | `qa_reports/manual-verification_e466-conductor.md`; expected-red file finalized |
| T-E466-06 | sr | `content/skill-conductor.md`, `prompts/conductor.ts`, `tools/registry.ts`, `dist/prompts/conductor.*` (4), `dist/tools/registry.*` (4) |
| T-E466-07 | sr | `tools/conductor.ts` §A, §B, §D open / close / wake / state; `dist/tools/conductor.*` (4) |
| T-E466-08 | sr | `tools/conductor.ts` §C, §D wave-done / check; `dist/tools/conductor.*` (4) |
| T-E466-09 | sr | `tools/conductor.ts` §E, §F; `scripts/conductor.mjs`; `dist/tools/conductor.*` (4) |
| T-E466-10 | sr | `content/skill-integrator.md` |
| T-E466-11 | sr | `CLAUDE.md`, `README.md`, `docs/install.md`, `docs/config.md` |

qa test file names above are recommendations; the spec leaves them to qa within `test/e466-*.test.mjs`. Every title starts `S<n>:`.

## Open Questions

1. **How does the conductor learn the manifest in the first wave, when `open --record` only knows the discussion record?** Resolved: `manifest` stays null until the first `wave-done` whose report parses; that report's manifest must be a readable file under primary and is recorded when every fact is met. Later reports must name the same manifest (else an unmet `fact.report`). No new argument, no human step.
2. **Which report counts for the current wave, given one `to-lane.md` across the whole run (S5 "newest", S6 "no report for the current wave")?** Resolved: `reportFloor` (message count at `open`); only messages at index >= floor with `type: report` and `re:` starting `wave-done` count. The parsed wave must equal the state's wave.
3. **What does `state` print when no run is recorded, given `state.line` has no "none" form?** Resolved: `state.line` with manifest `—`, record `—`, wave `0`, window `—`, step `none`; exit 0. The SOP's "No run recorded" reads `step none`.
4. **Resume after a conductor lost between `/exit` and the next open.** Resolved: step `wave-closed` is written right after `/exit`; `wave-done` on that step skips the fact check and resumes at close-finished, then opens the next wave or ends `done`.
5. **What if the integrator window is already gone when every fact is met (the integrator exited itself after reporting)?** Resolved: `wave-done` skips `/exit` and `out.closed` and continues; `check` with the window gone but a report at or above the floor prints `state.line`, exit 0 — not `integrator gone`.
6. **What if the launcher's close-finished run is refused (lock held, host refusal)?** Resolved: the conductor still opens the next integrator and exits 0; the launcher's own refusal lines reach the terminal, and the SOP already re-runs a refused launcher at the next watch expiry.
7. **May `open` be run while an integrator is open?** Resolved: refused (exit 1) only when the step is `opening` / `integrator-open` and the recorded window exists; otherwise allowed — this is the human-directed recovery path after `integrator gone` (R4: only on the human's word, never automatic).
8. **What do the standalone `close` and `wake` do to the state?** Resolved: neither changes `step` (only `updatedAt` for `close`); both refuse when no window is recorded or it no longer exists. A hand-directed `close` is then reported by the next `check` as `integrator gone`, so the human always hears about it.
9. **`gh pr view` fails (no auth, no network, unknown number).** Resolved: an unmet `fact.pr` with state `unknown`; the `gh` error's first line goes to stderr on its own line; the integrator is kept and gets the reply.
10. **R10's "tell the human which pull request blocks" under `pr-open`.** Resolved: no script output; it stays conductor-session judgment per `sop.conductor` step 3 (the cut deliberately adds no scenario).
11. **Does `tools/conductor.ts` need a lock like the launcher's?** Resolved: no — atomic tmp + rename writes only; one conductor session calls the script serially, and a second exists only after the first is lost (R7).

No item needs a human ruling.
