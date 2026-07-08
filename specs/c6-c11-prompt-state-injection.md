# Spec: c6-c11-prompt-state-injection

## Problem Statement

Two independent-but-adjacent defects live in the same two files
(`prompts/build.ts`, `bin/agent-governance-context.mjs`) that produce the
context a session actually sees at boot / prompt-fetch time.

**C6 (P1) — the state footer lies "fresh project" instead of failing loud.**
`buildPromptForRole()` (`prompts/build.ts:299-304`) resolves `workspacePath`
upstream in `index.ts`'s `GetPromptRequestSchema` handler
(`index.ts:56-68`) via a three-step fallback:

```ts
const resolvedPath =
  (typeof args?.workspace_path === "string" && args.workspace_path) ||
  process.env.CLAUDE_PROJECT_DIR ||
  process.cwd();
```

`workspace_path` is an **optional** prompt argument (`PROMPT_WORKSPACE_ARG`,
`tools/registry.ts:544-548`, `required: false`) — a `/teamwork*` invocation
that doesn't explicitly supply it falls through to `CLAUDE_PROJECT_DIR` or,
failing that, `process.cwd()` of the **MCP server's own long-lived
subprocess**. Unlike every `tw_*` tool call (which requires an explicit,
correctly-resolved `workspace_path` argument from the calling agent — this is
exactly why `tw_get_state` succeeds in the same session where the prompt
footer fails), the prompt-fetch path has no such guarantee: if the server
process's cwd/env were pinned at a different moment (a different project,
an earlier session) than the current prompt request, `resolvedPath` silently
resolves to the wrong directory.

Once `resolvedPath` is wrong, `getActiveStorage().parse(resolvedPath)`
(`build.ts:301`) looks for `<resolvedPath>/.current/handoff.md`, finds
nothing, and returns `null` — indistinguishable, at the footer, from a
genuinely fresh project. Compounding this: the surrounding `try { ... }
catch { }` (`build.ts:300-304`) swallows **any** thrown error too (e.g. a
`readAndMigrate()` YAML-parse failure or a future-schema-version refusal in
`runMigrations` — both throw, per `tools/handoff.ts:104-131`) into the exact
same silent `null`. Three distinct situations — (a) genuinely fresh project,
(b) wrong `resolvedPath`, (c) a real read/parse error on the right path —
currently render the identical
`"No handoff state found. Fresh project — call tw_get_state to initialize."`
line (`build.ts:343`). LIVE REPRO: 2026-07-08, this session — the `/teamwork`
prompt footer said exactly this while `tw_get_state` on the same workspace
returned `active_feature=c3-covering-evidence, last_agent=pm`, full
`pending_notes`.

**C11 (P2) — the same constitution can enter context twice.**
`bin/agent-governance-context.mjs` (the Claude Code `SessionStart` hook) and
`prompts/build.ts` (any `/teamwork*` prompt fetch) each independently compose
and emit the **full constitution** text — the hook via its own
`composeConstitution()` reading `dist/prompts/constitution-manifest.js`
(`agent-governance-context.mjs:71-84`), the prompt path via
`prompts/build.ts`'s `composeConstitution()` (`build.ts:61-69`). Neither
knows the other ran: the hook writes into Claude Code's `additionalContext`
channel; the prompt response is a separate MCP message. A session that
receives the hook AND fetches a `/teamwork*` prompt (or fetches more than one
`/teamwork*` prompt in sequence, e.g. `/teamwork` then `/teamwork-lite`) pays
for the full constitution N times — pure token waste, and a drift risk if the
two copies ever diverge mid-session after an upgrade.

## Mechanism Decision

**C6 fix — three parts, ownership split across roles per the Task list
below:**
1. **Workspace-resolution diagnosis + fix** (architect-designed, per
   Dependencies below — this spec fixes the *symptom* contract; the
   *mechanism* — e.g. always requiring/threading `workspace_path` end-to-end,
   vs. a session-scoped resolution cache, vs. something else — is an
   architecture decision because it may touch the MCP prompt-argument
   contract itself).
2. **Fail-loud footer.** `buildPromptForRole` must stop collapsing "file not
   found" and "read/parse threw" into one silent `null`. It must also report
   the resolved path and how it was resolved, so a human/agent reading the
   footer can immediately see a path mismatch instead of trusting a false
   "fresh project" claim.
3. **Stale `prd_path` normalization.** `resolvePrdPath()`
   (`build.ts:157-170`) already guards with `fs.existsSync(state.prd_path)`
   before trusting it — a stale absolute path (the ticket's home-directory-
   rename example) already degrades to auto-discovery today, it does not
   crash or silently inject wrong content. This spec's AC-8 only requires
   confirming/regression-locking that existing guard; no new normalization
   code is required unless the architect's diagnosis (part 1) surfaces a
   second stale-path surface elsewhere.

**C11 fix — mechanism is an open architecture decision, not a PM call.**
The backlog ticket names two shapes (hook self-gates vs. prompt-bundle
detects hook presence) plus a "cheapest" fallback (a one-line sentinel). The
hook and the prompt-fetch are genuinely different channels with no shared
runtime state today (confirmed by reading both files — the hook writes
`hookSpecificOutput.additionalContext`; the prompt handler returns an MCP
`GetPromptResult`; neither reads the other's output), so "detection" requires
inventing a signal (e.g. a session marker file, an env var the client sets,
or accepting the prompt bundle can never truly know and always emitting the
sentinel + trusting the agent to self-degrade). This spec routes to
**architect** to pick one mechanism and specify exactly what changes in
`prompts/build.ts` / `bin/agent-governance-context.mjs` / (possibly) the
prompt-argument contract in `tools/registry.ts`. This spec's ACs constrain
the *outcome* (measurable token reduction, no silent divergence) without
dictating the mechanism.

## User Stories

- As an agent that just fetched `/teamwork`, I want the state footer to
  either show me the real handoff or tell me loudly that lookup failed and
  why, so I never silently proceed believing a managed project is fresh.
- As a developer debugging a "no handoff state" report, I want the footer to
  show me the exact path it checked and how that path was resolved, so I can
  diagnose a workspace-resolution bug in seconds instead of re-deriving the
  fallback chain from source.
- As a session that receives both the SessionStart hook and a `/teamwork*`
  prompt, I want the constitution delivered once, so I'm not paying double
  token cost or risking a mid-session drift between two copies.
- As a maintainer, I want the existing byte-parity tests
  (`test/compose-equivalence.test.mjs`, `test/context-budget.test.mjs`) to
  keep passing (rebaselined only where this feature intentionally changes
  bundle content), so I know exactly what changed and why.

## Acceptance Criteria

**AC-1 — Genuinely fresh project still says so, unambiguously**
Given `resolvedPath` is correct and `<resolvedPath>/.current/handoff.md`
truly does not exist,
When a `/teamwork*` prompt is fetched,
Then the footer states the project has no handoff state AND shows the exact
path it checked (e.g. `<resolvedPath>/.current/handoff.md`) — no change in
truthfulness, only in transparency.

**AC-2 — Wrong-path resolution is visible, not masked as "fresh"**
Given `resolvedPath` does not equal the workspace the agent is actually
working in (simulated in a test via an explicit wrong `workspace_path` prompt
arg or a `CLAUDE_PROJECT_DIR` pointing elsewhere),
When a `/teamwork*` prompt is fetched for a workspace that DOES have a real
`.current/handoff.md` at the correct location,
Then the footer's stated path is the (wrong) resolved path, distinguishably
present in the response text — a reader can diff it against the real
workspace path and immediately see the mismatch. The footer text MUST NOT
claim "Fresh project" without qualification when the underlying cause could
be a resolution mismatch (i.e., the literal string "Fresh project" alone,
unqualified by a path, is no longer acceptable output — see Copy/Strings).

**AC-3 — Read/parse errors surface loudly, never as "no state"**
Given `<resolvedPath>/.current/handoff.md` exists but is malformed (invalid
YAML frontmatter, or a `schema_version` newer than `CURRENT_VERSIONS.handoff`
triggering `runMigrations`'s refuse-loud throw),
When a `/teamwork*` prompt is fetched,
Then the footer renders a distinct "lookup failed" message (not the
fresh-project message) including the resolved path and the underlying error
text, per Copy/Strings S02.

**AC-4 — Workspace resolution is consistent within one session**
Given the same session issues a `tw_get_state` tool call (explicit
`workspace_path`) and then fetches a `/teamwork*` prompt with no explicit
`workspace_path` argument,
Then the prompt's resolved workspace path matches the tool call's workspace
path (exact mechanism is the architect's call — this AC is the server-visible
contract it must satisfy; test may need to simulate the client-side
convention the architect picks, e.g. asserting `CLAUDE_PROJECT_DIR` env
threading, or an equivalent).

**AC-5 — Regression test for C6**
A new or extended test file (e.g. `test/prompt-state-footer.test.mjs`) covers
AC-1, AC-2, and AC-3 at minimum — asserting on the actual footer text emitted
by `buildPromptForRole`/the prompt handler, not just the internal `parse()`
return value.

**AC-6 — Stale `prd_path` guard regression-locked**
A test (existing or new) asserts `resolvePrdPath()` falls back to
auto-discovery (or `null`) — never throws, never injects RAG content sourced
from a nonexistent path — when `state.prd_path` points at a file that does
not exist on disk (covers the ticket's stale-home-directory scenario without
requiring new normalization code, per Mechanism Decision).

**AC-7 — Single constitution delivery per session (C11 outcome contract)**
Given a session receives the SessionStart hook's `additionalContext` AND
fetches at least one `/teamwork*` prompt in the same session,
When the total context delivered to the model is measured,
Then the full composed constitution text appears in that combined context
at most once in full — either the hook is skipped/degraded, the prompt
bundle is skipped/degraded, or the prompt bundle emits the short sentinel
(Copy/Strings S03) instead of the full text. Exact mechanism: architect's
call (Mechanism Decision).

**AC-8 — Fetching two different `/teamwork*` prompts in one session doesn't
double the constitution either**
Given a session fetches `/teamwork` then later `/teamwork-lite` (or any two
`/teamwork*` variants) without an intervening hook re-fire,
Then the second fetch does not re-emit a second full copy of the
constitution text under the mechanism chosen for AC-7 (same signal covers
prompt-to-prompt repetition, not just hook-to-prompt).

**AC-9 — Token saving is measurable**
`test/context-budget.test.mjs` (or a new assertion within it) demonstrates a
quantified token/character reduction for the dual-injection scenario (hook +
prompt, or prompt + prompt) versus the pre-fix baseline — a concrete number
in the test assertion, not just "some savings."

**AC-10 — No silent golden-fixture drift**
`test/compose-equivalence.test.mjs` and `test/context-budget.test.mjs` are
inspected against this feature's changes: any pinned literal or golden
fixture in `test/fixtures/compose-golden/` that must change as a *result* of
C6/C11 is updated by qa-engineer with the new content committed (never
loosened/skipped) and the reason recorded in the test itself or its commit;
any fixture that does NOT need to change stays byte-identical.

**AC-11 — Full suite green**
`npm test` passes after the change, with no test deleted or weakened to
achieve green (only intentional rebaselines per AC-10).

## Copy / Strings

| string id | exact text | source |
|-----------|-----------|--------|
| S01 | `No handoff.md found at <resolvedPath>/.current/handoff.md (resolved via <source>). If this workspace should have state, verify workspace_path resolution — otherwise this is genuinely a fresh project; call tw_get_state to initialize.` — `<source>` is one of `workspace_path arg`, `CLAUDE_PROJECT_DIR env`, or `cwd fallback` | authored-here — replaces the unqualified "Fresh project" line (AC-1, AC-2); exact wording may be refined by sr-engineer for line-length/formatting but MUST preserve: the resolved path, the resolution source, and the "verify workspace_path resolution" instruction |
| S02 | `⚠️ Current Project State — Lookup Failed. state lookup failed at <resolvedPath>/.current/handoff.md: <error message>. This is NOT a fresh project — do not treat active_feature/pending_notes as absent. Call tw_get_state directly to retrieve the real state.` | authored-here — directly implements the ticket's own fix line ("make the footer fail LOUD ('state lookup failed at <path>')"), docs/backlog.md C6 Fix, ~line 402 |
| S03 | `constitution already in context via hook — omitted` | docs/backlog.md C11 Fix line (~line 483), quoted verbatim as the ticket's own "cheapest" sentinel; used only if the architect selects the sentinel-degrade mechanism for AC-7 |

## Visual Tokens

| token id | property | value | source |
|----------|----------|-------|--------|
| N/A | — | feature has no visual surface | — |

## Visual Widgets

| widget id | description | source-node |
|-----------|-------------|-------------|
| N/A | — | feature has no non-primitive widgets | — |

## Out of Scope

- Redesigning the MCP prompt-argument contract itself (e.g. making
  `workspace_path` required) unless the architect determines that is the
  correct AC-4 mechanism — this spec does not mandate that choice.
- Any change to `tw_get_state`/`tw_update_state`/other tool-call workspace
  resolution — those already require an explicit, correctly-supplied
  `workspace_path` and are not implicated in either defect.
- C7/C8/C9/C10/C12 and any other open backlog ticket — out of scope for this
  feature.
- New `schema_version` bump to handoff/tasks/sqlite/config, unless the
  architect's C11 mechanism requires a new persisted field (if so, the
  architect must say so explicitly and this spec will be amended before
  sr-engineer starts).
- Any UI/visual work — this is a server-internal, non-design feature; no
  `design/<feature>.md` exists and none is required.

## Dependencies / Prerequisites

- No external references (no URLs/Figma/tickets) in either backlog entry —
  Resource Audit Gate is a no-op.
- **Architecture decision required before sr-engineer starts** (routes this
  feature through `architect` first, not directly to `sr-engineer`):
  1. C6 AC-4's workspace-resolution consistency mechanism.
  2. C11 AC-7/AC-8's dedup mechanism (hook self-gate vs. prompt-bundle
     detection vs. sentinel-only degrade).
  Both decisions are cross-cutting across `index.ts`, `prompts/build.ts`,
  `bin/agent-governance-context.mjs`, and possibly `tools/registry.ts` — more
  than the ≥3-module threshold for routing through architect per skill-pm.
- No dependency on other open backlog items. C3 (just released, v3.47.0) is
  unrelated code (`tools/evidence-file.ts`) — no file overlap.

## Tasks

- [ ] C6C11-ARCH [P0] architect: design the workspace-resolution consistency mechanism (C6 AC-4) and the constitution-dedup mechanism (C11 AC-7/AC-8); write `specs/c6-c11-prompt-state-injection-architecture.md` covering both decisions plus exact call-site diffs in `index.ts`, `prompts/build.ts`, `bin/agent-governance-context.mjs`, `tools/registry.ts` as needed. | depends_on: none
- [ ] C6-01 [P0] sr-engineer: implement the fail-loud footer in `prompts/build.ts` — distinguish "file not found" (AC-1/S01) from "read/parse threw" (AC-3/S02); thread the resolution source (`workspace_path arg` / `CLAUDE_PROJECT_DIR env` / `cwd fallback`) from `index.ts`'s `GetPromptRequestSchema` handler through to the footer builder. | depends_on: C6C11-ARCH
- [ ] C6-02 [P0] sr-engineer: implement the architect's chosen workspace-resolution consistency mechanism (AC-4). | depends_on: C6C11-ARCH
- [ ] C6-03 [P1] sr-engineer: add/confirm the stale-`prd_path` regression guard (AC-6) — extend an existing test or add a minimal one asserting `resolvePrdPath()` degrades gracefully; no production code change expected unless the architect's diagnosis (C6C11-ARCH) surfaces a second stale-path surface. | depends_on: C6C11-ARCH
- [ ] C11-01 [P1] sr-engineer: implement the architect's chosen constitution-dedup mechanism across `prompts/build.ts` / `bin/agent-governance-context.mjs` (AC-7, AC-8). | depends_on: C6C11-ARCH
- [ ] C6C11-QA [P0] qa-engineer: write `test/prompt-state-footer.test.mjs` (AC-1, AC-2, AC-3, AC-5); extend/add a stale-prd_path test (AC-6); extend `test/context-budget.test.mjs` with a measurable token-reduction assertion (AC-9); reconcile `test/compose-equivalence.test.mjs` + any `test/fixtures/compose-golden/` fixtures — update only what must change, record why (AC-10); run `npm test` full-suite green (AC-11). | depends_on: C6-01, C6-02, C6-03, C11-01
- [ ] C6C11-REL [P1] release-engineer (post-PASS): version bump, CHANGELOG entry, build, tag, release per skill-release-engineer. | depends_on: C6C11-QA
- [ ] C6C11-DONE [P2] pm/coordinator (post-release): mark backlog C6 and C11 done in `docs/backlog.md` with mechanism summary and commit reference. | depends_on: C6C11-REL
