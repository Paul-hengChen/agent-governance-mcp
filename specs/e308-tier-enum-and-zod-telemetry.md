# e308-tier-enum-and-zod-telemetry

Lane `e308` of post-v4 wave 3 (`specs/fanout-post-v4-w3.md`), tickets **E308** (single-source tier enum) and **E303** (zod-boundary telemetry). Base `c392cc3`; branch `feat/e308-tier-enum-and-zod-telemetry`; worktree `../agent-governance-mcp-lanes/e308`. Task ids `T-E308-NN` / `T-E303-NN`; evidence files follow the task id. Non-design feature (no `design/` file, mode = no-design).

## Problem Statement

The four-value model-tier vocabulary (`opus`, `sonnet`, `haiku`, `fable`) exists as four independent literal copies: `MODEL_TIERS` in `tools/skill-frontmatter.ts`, `DISPATCH_PIN_TIER_VALUES` in `tools/handoff-parse.ts`, the eight `dispatch_pins` inputSchema `enum` arrays plus the tier list inside `DISPATCH_PIN_TIER_HINT` in `tools/registry.ts`, and the tier sentence in the `tw_get_state` advisory in `tools/handoff-orchestrator.ts` (E308; the `allowed` array there already reads the constant). Adding or retiring a tier is a four-file edit with no test that catches a missed copy; the `DispatchPinTier` type has no consumer; and the comment and inputSchema description beside `dispatch_pins` in `tools/registry.ts` still read "File-mode only, no gate" / "Advisory bookkeeping — no gate" although E300 made the value enum a tool-boundary rejection (`DISPATCH_PIN_TIER_REJECTED`) that applies in file and SQLite mode alike. Separately (E303), that rejection is raised by zod inside `defineTool.run` before any handler runs, so `emitGateTelemetry` is never called for it: `tw_gate_stats` lists `DISPATCH_PIN_TIER_REJECTED` under `zero_fire` forever, and the `gates/registry.ts` producer comment claims fires are observable when they are not.

## User Stories

- As a server maintainer, I want one tier constant feeding the parser, the zod enum, the inputSchema, the rejection hint and the advisory, so that a tier change is one edit and the copies cannot drift apart.
- As an integrator reading `tw_gate_stats`, I want tool-boundary rejections counted under `fired`, so that a `zero_fire` row means the gate never fired, not that it is invisible.
- As an agent reading the `tw_update_state` tool description, I want the `dispatch_pins` text to say the tier enum rejects at the boundary, so that I do not read it as advisory and persist a dated model id.

## Acceptance Criteria

Each AC names its task. `<base>` = `c392cc3` (the sha in `.current/e308/base-sha`). Tests are qa-owned (AC13); the sr-engineer writes no `test/**`. No schema version changes; no `content/**` changes; `index.ts` is not touched by any task.

### T-E308-01 (E308, sr-engineer) — single-source tier enum

- **AC1 (single source)** — Given `tools/skill-frontmatter.ts` exports `MODEL_TIERS` (it imports no `tools/` module, so no import cycle), when `tools/handoff-parse.ts` is read, then `DISPATCH_PIN_TIER_VALUES` is derived from or re-exports `MODEL_TIERS` and no literal four-value tier array remains in that file.
  proof: `grep -c '"opus", "sonnet", "haiku", "fable"' tools/handoff-parse.ts` prints `0`; `node -e 'import("./dist/tools/handoff-parse.js").then(async p=>{const s=await import("./dist/tools/skill-frontmatter.js");const a=JSON.stringify([...p.DISPATCH_PIN_TIER_VALUES]),b=JSON.stringify([...s.MODEL_TIERS]);if(a!==b)throw new Error(a+" != "+b);console.log("same")})'` prints `same`.
- **AC2 (eight inputSchema enums generated)** — Given the `tw_update_state` entry of `TOOL_REGISTRY`, when its `inputSchema.properties.dispatch_pins.properties` is inspected, then each of the eight role keys (`pm`, `researcher`, `design-auditor`, `architect`, `sr-engineer`, `code-reviewer`, `qa-engineer`, `release-engineer`) has `enum` deep-equal to `[...MODEL_TIERS]`, and the source builds them from the constant rather than eight literals.
  proof: `grep -c 'enum: \["opus", "sonnet", "haiku", "fable"\]' tools/registry.ts` prints `0`; a qa test (AC13) asserts the eight `enum` arrays deep-equal `[...MODEL_TIERS]` via `TOOL_REGISTRY`.
- **AC3 (hint byte-identical)** — Given `DISPATCH_PIN_TIER_HINT` is now composed from the constant (e.g. `` `is not a model tier; allowed: ${MODEL_TIERS.join(", ")}` ``), when a `tw_update_state` call carries `dispatch_pins: { "sr-engineer": "claude-opus-4-1" }`, then the zod issue message is exactly `DISPATCH_PIN_TIER_REJECTED: "claude-opus-4-1" ` + `gate("DISPATCH_PIN_TIER_REJECTED").hintStatic`, and the `hintStatic` literal in `gates/registry.ts` is unchanged (`"is not a model tier; allowed: opus, sonnet, haiku, fable"`).
  proof: `test/error-code-contract.test.mjs` byte-equality case added by qa (AC13): the rejection message's suffix after the echoed value `===` `hintStatic`; `grep -c 'hintStatic: "is not a model tier; allowed: opus, sonnet, haiku, fable"' gates/registry.ts` prints `1`.
- **AC4 (advisory text same source, output unchanged)** — Given the `tw_get_state` advisory in `tools/handoff-orchestrator.ts`, when its source is read, then the `allowed` array and the tier sentence in `hint` both draw from the single constant (no literal `opus, sonnet, haiku, fable` in that file), and the emitted advisory JSON is byte-identical to today's (so `test/dispatch-pins.test.mjs` E300-R1/R2/R3 pass unchanged).
  proof: `grep -c 'opus, sonnet, haiku, fable' tools/handoff-orchestrator.ts` prints `0`; `node --test test/dispatch-pins.test.mjs` green with E300-R1 unmodified.
- **AC5 (`DispatchPinTier` used or deleted)** — Given `tools/handoff-parse.ts`, when the tree is grepped, then `DispatchPinTier` either has at least one real consumer (a parameter, return or field type — not a re-export alone) or no longer exists.
  proof: `grep -rn 'DispatchPinTier' tools/ gates/ | wc -l` prints `0`, or prints `>= 2` with one hit being a non-export usage.
- **AC6 (stale wording corrected)** — Given `tools/registry.ts`, when the `dispatch_pins` zod-object comment (today near lines 216–222) and the `dispatch_pins` inputSchema `description` are read, then neither contains `File-mode only, no gate` or `Advisory bookkeeping — no gate`; both say the value enum is enforced at the tool boundary with `DISPATCH_PIN_TIER_REJECTED` in file and SQLite mode alike, while the map itself gates no transition and is persisted in file mode only (SQLite does not store it — `test/dispatch-pins.test.mjs` S1 stays true). The exact replacement sentence for the description is in *Copy / Strings* (`dispatch_pins.description.gate-sentence`).
  proof: `grep -c 'no gate' tools/registry.ts` prints `0` for the `dispatch_pins` block (the only pre-existing `no gate` hits in the file belong to this block); `grep -c 'DISPATCH_PIN_TIER_REJECTED' tools/registry.ts` prints `>= 3`.
- **AC7 (no behaviour or schema change; existing pins stay green)** — Given the edits above, when the pre-existing tests run, then `test/skill-frontmatter.test.mjs` ("MODEL_TIERS contract matches spec table") and `test/e297-main-protected-sop.test.mjs` AC9 pass **unmodified**, `test/dispatch-pins.test.mjs` E300-Z8..Z12 pass unmodified, and `schema/` has no diff.
  proof: `node --test test/skill-frontmatter.test.mjs test/e297-main-protected-sop.test.mjs test/dispatch-pins.test.mjs` exits 0; `git diff --stat <base> -- schema/` prints nothing.

### T-E303-01 (E303, sr-engineer) — zod-boundary telemetry emit

- **AC8 (emit on gate-coded zod issue, then rethrow the same error)** — Given `defineTool.run` in `tools/registry.ts` wraps `spec.zodSchema.parse(rawArgs)`, when the parse throws a `ZodError`, then for every issue whose `message` starts with a code registered in `GATE_REGISTRY` (looked up through `gates/registry.ts`, e.g. `gate(code)` or an exported `isGateErrorCode`-style lookup — no second code list), `emitGateTelemetry(workspace_path, code, agent_id, active_feature)` is called once per such issue, with the three values taken best-effort from the RAW args (`typeof === "string"` → the string; absent or non-string → `null`), and the **same** `ZodError` instance is rethrown. If `workspace_path` is not a usable absolute string (`typeof !== "string"` or `!path.isAbsolute`), the emit is skipped entirely (the sidecar path needs an absolute workspace). Issues whose message does not start with a registered code emit nothing.
  proof: qa test (AC13): calling the `tw_update_state` `run` with `{ workspace_path: <absolute temp dir>, active_feature: "f", status: "In_Progress", agent_id: "pm", dispatch_pins: { "sr-engineer": "claude-opus-4-1" } }` rejects with an error where `e instanceof ZodError`, and `<temp>/.current/telemetry.jsonl` (or the lane-resolved sidecar) gains exactly one line `{"ts":…,"gate":"tool-boundary","error_code":"DISPATCH_PIN_TIER_REJECTED","agent_id":"pm","feature":"f"}`; the same call with `agent_id` omitted yields `"agent_id":null`; with a relative `workspace_path` the error is still a `ZodError` and no sidecar line is written.
- **AC9 (never throws, never alters the error)** — Given the emit site, when `emitGateTelemetry`'s internal append fails (e.g. the sidecar directory path is a regular file — the THROW1/THROW2 pattern in `test/telemetry.test.mjs`), then the error that reaches the caller is the identical `ZodError` (same `issues` array, same `message`) as on a healthy workspace, and `index.ts`'s formatted text is unchanged.
  proof: qa test (AC13): THROW-style case asserting `JSON.stringify(err.issues)` equal between the healthy and the broken-sidecar run, and `err instanceof ZodError` in both.
- **AC10 (`tw_gate_stats` shows the fire)** — Given one rejected write per AC8 in a temp workspace, when `handleGateStats` runs on that workspace, then `DISPATCH_PIN_TIER_REJECTED` appears under `fired` (count ≥ 1) and not under `zero_fire`; with zero telemetry it still appears under `zero_fire` (so `test/e26-gate-stats.test.mjs` R1–R3 pass unchanged with the count `34`).
  proof: qa test (AC13) on `handleGateStats`; `node --test test/e26-gate-stats.test.mjs` exits 0 unmodified.
- **AC11 (`gates/registry.ts` comment-only; pinned lines untouched; `index.ts` untouched)** — Given the lane HEAD, when diffed against `<base>`, then every changed line in `gates/registry.ts` is a `//` comment line (the producer comment near lines 45–47 and, only if it overstates, the catalog comment near lines 112–116, now say that the tool-boundary fire reaches telemetry through the `defineTool.run` emit), the mapping line `DISPATCH_PIN_TIER_REJECTED      coord-02-host-dispatch.md` is present exactly once, the string `(none)` occurs zero times in that file, and `index.ts` has no diff.
  proof: `git diff -U0 <base> -- gates/registry.ts | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' | grep -vE '^[+-]\s*//' | wc -l` prints `0`; `grep -c 'DISPATCH_PIN_TIER_REJECTED      coord-02-host-dispatch.md' gates/registry.ts` prints `1`; `grep -c '(none)' gates/registry.ts` prints `0`; `git diff --stat <base> -- index.ts` prints nothing.
- **AC12 (no new gate code; pipeline parity holds)** — Given `GATE_REGISTRY`, when counted, then it still has 34 entries, `DISPATCH_PIN_TIER_REJECTED` is still the only `tool-boundary` producer and appears in no `UPDATE_STATE_GATE_PIPELINE` step.
  proof: `node --test test/e35-pipeline-order.test.mjs test/error-code-contract.test.mjs` exits 0 (the `34` assertions unmodified).

### T-E308-02 (qa-engineer, both tickets) — tests and full suite

- **AC13 (tests)** — Given T-E308-01 and T-E303-01 are implemented, when qa pins them, then: `test/dispatch-pins.test.mjs` gains the AC2 eight-enum deep-equal and keeps E300-Z8..Z12 / R1..R3 unmodified; `test/skill-frontmatter.test.mjs` keeps its `MODEL_TIERS` deep-equal unmodified (a single-source case may be added, e.g. `DISPATCH_PIN_TIER_VALUES` deep-equals `MODEL_TIERS`); `test/error-code-contract.test.mjs` gains the AC3 byte-equality case (rejection-message suffix `===` `hintStatic`) and its `34` assertions stay as they are; `test/telemetry.test.mjs` gains the zod-boundary cases — emit shape (AC8), `agent_id`/`feature` null fallback, relative-`workspace_path` skip, non-gate-coded issue emits nothing, THROW-style never-throw with the rethrown `ZodError` unchanged (AC9); `test/e26-gate-stats.test.mjs` passes unchanged (34 codes) and a `fired` case for AC10 lives in a new `test/e303-*.test.mjs` (or in the e26 file only if it needs no change to the existing counts); `test/e35-pipeline-order.test.mjs` is touched only if the tool-boundary assertion needs re-pinning (expected: no change); new `test/e308-*.test.mjs` / `test/e303-*.test.mjs` pin the grep-style proofs of AC1, AC4, AC5, AC6, AC11 against the source files. Evidence under `qa_reports/` cites paths relative to the repo root, never a local absolute path.
  proof: `node scripts/test-lock.mjs -- npm test` exits 0 on the final lane HEAD **after** the last commit with `git status --porcelain` empty; the pass/total is recorded in `qa_reports/review_T-E308-02.md`.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| dispatch_pin_tier.hint | `is not a model tier; allowed: opus, sonnet, haiku, fable` | `gates/registry.ts` `hintStatic` — unchanged; the `tools/registry.ts` copy becomes generated but must render this exact text |
| dispatch_pins_advisory.hint | `These on-disk dispatch_pins values are outside the model-tier enum; the next tw_update_state carrying them is rejected with DISPATCH_PIN_TIER_REJECTED — rewrite dispatch_pins with one of opus, sonnet, haiku, fable.` | `tools/handoff-orchestrator.ts` — unchanged output; the tier list inside it becomes generated |
| dispatch_pins.description.gate-sentence | `The value enum is enforced at the tool boundary in file and SQLite mode alike (DISPATCH_PIN_TIER_REJECTED); the map itself gates no transition and is persisted in file mode only.` | authored-here — replaces the stale `Advisory bookkeeping — no gate.` sentence in the `tw_update_state` inputSchema `dispatch_pins` description; the rest of that description is unchanged |

Code comments are not user-facing strings and are not listed; they must describe the mechanism in plain engineering terms (ticket ids are fine; no role/chain/SOP terminology, no local paths).

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Any change to `index.ts` (zod parse lives in `tools/registry.ts` `defineTool.run`; `index.ts` only formats `ZodError`). **Escalation constraint**: if the sr-engineer finds `index.ts` genuinely must change, the lane stops and escalates through the lane mailbox (`type: escalate`); it does not widen its own ownership.
- Any `content/**` change (the coord-02 sentence naming the four tiers shipped with E300/E295).
- A new gate code, a new `GATE_REGISTRY` entry, or a change to the `gates/registry.ts` mapping line `DISPATCH_PIN_TIER_REJECTED      coord-02-host-dispatch.md` or to the zero-`(none)` property — both pinned by `test/e295-hop-cap-and-sop-halves.test.mjs` AC11, which lane e296 owns.
- Telemetry for zod issues whose message does not start with a registered gate code (unknown role key, missing `workspace_path`, oversize value, …).
- Persisting `dispatch_pins` in SQLite mode; changing `tw_get_state` advisory semantics; any schema version bump.
- `docs/**` updates (E306 covers the tier tables), `docs/backlog.md` done-marks (integrator 5c), CHANGELOG / version bump (release).

## Dependencies / Prerequisites

- Base `c392cc3` (`main` after PR #9); wave manifest `specs/fanout-post-v4-w3.md`, human-approved 2026-10-15. E297 (`fable` in `MODEL_TIERS`) and E300 (tier enum, `DISPATCH_PIN_TIER_REJECTED`) are on `main`. Hop cap is 14.
- Dispatch pin `sr-engineer=opus` (human ruling 2026-10-15, relayed via the lane mailbox; was `fable` in the manifest draft) is persisted by the coordinator at cut approval, not by this PM write.
- `tools/skill-frontmatter.ts` imports only `js-yaml`, so making it the single source introduces no import cycle into `tools/handoff-parse.ts` / `tools/registry.ts` / `tools/handoff-orchestrator.ts`.
- `emitGateTelemetry(workspacePath, errorCode, agentId, feature)` (`tools/telemetry.ts`) resolves the sidecar through the lane resolver from `workspacePath`, so the emit needs an absolute `workspace_path`; it already never throws and reports `gate: "tool-boundary"` for this code via `gate(code).producer`. No change to `tools/telemetry.ts` is expected; it stays owned in case the raw-args extraction is better placed there.
- Finding at cut time: `test/error-code-contract.test.mjs` has **no** named assertion today comparing the `tools/registry.ts` hint to `hintStatic` (the manifest's "compares them" refers to the line-638 check that the code literal appears in `tools/registry.ts`). AC3/AC13 make the byte-equality explicit.
- Integrator pre-review of this cut happens before human approval (lane-protocol §5-2); the lane mailbox did not exist at PM time, so the coordinator relays the cut.
- External references: none (`external_refs` recorded empty).

## Gate Summary (for integrator pre-review)

| gate | result |
|---|---|
| Visual State-Count Split / Geometric-Density Split | not applicable — no design file (mode = no-design) |
| Parallel-Lane Cut | not applicable inside the lane — the wave manifest already cut the lanes; the three tasks here are serial (sr → sr → qa) and share `tools/registry.ts` |
| Scope Decision | `single-feature` — E308 + E303 edit the same dispatch_pins code path and the integrator cut them as one feature with three tasks |
| Resource Audit | no external references in the manifest rows or backlog rows for E308 / E303 → `external_refs: []` |
| Question Batch / Ambiguity | none — no open alternatives, no needs-human-ruling items in this cut |
| Cut-Approval | Task-dispatched PM: `cut_approved` is NOT set here; the coordinator attests after the human approves |

### Files the cut touches (what the integrator pre-reviews)

| task | files written |
|---|---|
| T-E308-01 | `tools/skill-frontmatter.ts` (only if a helper/re-export is added; `MODEL_TIERS` value and shape unchanged), `tools/handoff-parse.ts`, `tools/registry.ts`, `tools/handoff-orchestrator.ts`, and their `dist/tools/*.js` + `.d.ts` |
| T-E303-01 | `tools/registry.ts` (`defineTool.run`), `gates/registry.ts` (comments only), optionally `tools/telemetry.ts`, and their `dist/**` counterparts |
| T-E308-02 | `test/dispatch-pins.test.mjs`, `test/skill-frontmatter.test.mjs`, `test/error-code-contract.test.mjs`, `test/telemetry.test.mjs`, `test/e26-gate-stats.test.mjs` (expected unchanged), `test/e35-pipeline-order.test.mjs` (only if re-pin needed), new `test/e308-*.test.mjs` / `test/e303-*.test.mjs`, `qa_reports/*E308*`, `qa_reports/*E303*` |
| every hop | `.current/e308/**` (handoff, ledger, telemetry, pending-tickets), `review_reports/*E308*` / `review_reports/*E303*` (code-reviewer) |

### Owned files (the lane may touch only these, plus files this ticket creates and their own tests)

`tools/registry.ts` + `dist/tools/registry.*`; `tools/handoff-parse.ts` + `dist/tools/handoff-parse.*`; `tools/handoff-orchestrator.ts` + `dist/tools/handoff-orchestrator.*`; `tools/skill-frontmatter.ts` + `dist/tools/skill-frontmatter.*`; `tools/telemetry.ts` + `dist/tools/telemetry.*`; `gates/registry.ts` + `dist/gates/registry.*` (**comments only**; the `:107` mapping line and the zero-`(none)` property are untouchable); `test/dispatch-pins.test.mjs`; `test/skill-frontmatter.test.mjs`; `test/error-code-contract.test.mjs`; `test/telemetry.test.mjs`; `test/e26-gate-stats.test.mjs`; `test/e35-pipeline-order.test.mjs` (only if the tool-boundary assertion needs re-pinning); `test/e297-main-protected-sop.test.mjs` (only the `MODEL_TIERS` deep-equal, expected unchanged); `test/e308-*.test.mjs`; `test/e303-*.test.mjs`; `specs/e308-*`; `qa_reports/*E308*`; `qa_reports/*E303*`; `review_reports/*E308*`; `review_reports/*E303*`; `.current/e308/**`.

### Forbidden files

`content/**`; `test/fixtures/compose-golden/**`; `test/context-budget.test.mjs`; `docs/**`; `tools/config.ts`; `tools/fanout-manifest.ts`; `scripts/**`; all other `tools/**`, `gates/**`, `test/**`, `dist/**`, `specs/**`; and the wave-common forbidden set: `index.ts`, `bin/**`, `templates/**`, `.github/**`, `CLAUDE.md`, `AGENTS.md`, `.antigravityrules`, `package.json`, `package-lock.json`, `CHANGELOG.md`, `docs/backlog.md`, `docs/v4.0.0-new-tickets.md`, `specs/fanout-*.md`, `.current/history/**`. Only qa-engineer writes `test/**`. Git on the lane: `git add` / `git commit` only, one command per call; no push, merge, tag or worktree removal.

## Tasks

| id | ticket | role | scope | depends_on | AC |
|---|---|---|---|---|---|
| T-E308-01 | E308 | sr-engineer | single-source tier enum: derive `DISPATCH_PIN_TIER_VALUES` from `MODEL_TIERS`; generate the eight inputSchema enums, the hint list and the advisory text from it; use or delete `DispatchPinTier`; correct the stale "no gate / File-mode only" wording | none | AC1–AC7 |
| T-E303-01 | E303 | sr-engineer | catch `ZodError` in `defineTool.run`, emit telemetry for gate-coded issues from raw args, rethrow the same error; reword the `gates/registry.ts` producer comment (comments only) | T-E308-01 | AC8–AC12 |
| T-E308-02 | E308 + E303 | qa-engineer | tests for AC1–AC12 in the named files plus new `e308-*` / `e303-*` tests; full suite under `test-lock` on the final HEAD with a clean tree | T-E303-01 | AC13 |
