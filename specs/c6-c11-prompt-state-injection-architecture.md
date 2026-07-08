# Architecture: c6-c11-prompt-state-injection

Blueprint for PM spec `specs/c6-c11-prompt-state-injection.md` (ACs 1–11).
Two decisions were routed to architect:

1. **C6 AC-4** — workspace-resolution consistency between the `GetPrompt` path
   and the `tw_*` tool path, plus the fail-loud footer contract.
2. **C11 AC-7/AC-8** — constitution double-injection dedup across the
   SessionStart hook and the `/teamwork*` prompt fetch.

Both are settled below with no residual Open Questions — this hands off to
sr-engineer. Recommended first task: **C6-01**.

---

## Summary of decisions

| id | decision | one-line rationale |
|----|----------|--------------------|
| C6 resolution | **Keep the `arg → CLAUDE_PROJECT_DIR → cwd` fallback chain; extract it into `resolveWorkspacePath(args) → {path, source, managed}`; add a managed-workspace probe that ANNOTATES the footer but NEVER silently redirects the path.** | The only reliably-correct per-request signal is the explicit arg; env threading fixes the common per-project stdio case; anything the chain gets wrong is made *visible* by the fail-loud footer rather than masked. |
| C6 session cache | **Rejected.** No global "last tw_* workspace" cache. | A cache trades "false fresh" for "false populated" — injecting a *different* workspace's real state, which is silent-wrong (worse than fresh-looking-wrong) and unsafe in HTTP multi-workspace mode. |
| C6 footer | **Three not-found renderings** (S01a not-managed / S01b genuine-fresh / S02 parse-error) + the existing JSON block; all name the resolved path AND resolution source. | Distinguishes the three situations the current single silent `null` collapses. |
| C6-03 prd_path | **Test-only. No production change.** | `resolvePrdPath()`'s `fs.existsSync` guard already degrades a stale absolute path to auto-discovery/`null`; no second stale-path surface exists in `build.ts` or the hook. |
| C11 dedup | **Two-layer: (L1) in-memory per-workspace "constitution already delivered this process" flag applied AT THE HANDLER (prompt→prompt, AC-8); (L2) hook-written windowed marker file under `.current/` read at the handler (hook→prompt, AC-7).** Both fail SAFE (emit full on any doubt) and both drive an explicit `omitConstitution` param into a pure `buildPromptForRole`. | No session id is shared between the hook process and the MCP-server process, so cross-channel dedup cannot be *proven* safe; the design therefore biases every uncertain case toward emitting the constitution and turns S03 into a recovery instruction, never a silent removal. |
| C11 schema | **No schema_version bump.** The marker is an ephemeral dot-file, not a field of handoff/tasks/sqlite/config. | Satisfies spec *Out of Scope*'s explicit "architect must say so" clause: nothing persisted-and-versioned changes. |

---

## Affected Files

Production (implementation tasks):

| file | task | change |
|------|------|--------|
| `prompts/build.ts` | C6-01 | Capture the parse error; replace the single silent footer with the S01a/S01b/S02 decision tree; add trailing optional params `resolutionSource` and `omitConstitution` to `buildPromptForRole` (both defaulted so existing callers/tests are byte-unaffected). |
| `index.ts` | C6-02, C11-01 | Extract `resolveWorkspacePath(args)`; call `buildPromptForRole` with `source` and (C11) `omitConstitution`; hold the L1 in-memory dedup set + L2 marker read. |
| `tools/registry.ts` | C6-02 | Replace per-entry `build:` function refs with declarative `skillFile:` so the handler can call `buildPromptForRole` directly with the extra params (avoids threading `source`/`omit` through 11 wrapper files — see DR-2). |
| `bin/agent-governance-context.mjs` | C11-01 | After it successfully emits the constitution, write the L2 marker file with a timestamp. |
| `.gitignore` | C11-01 | Ignore `.current/.agc-hook-marker.json`. |

Non-production (qa-owned, listed for planning — NOT written by sr/architect per §2):

| file | task | change |
|------|------|--------|
| `test/prompt-state-footer.test.mjs` (new) | C6C11-QA | AC-1/AC-2/AC-3/AC-4/AC-5 against the *emitted footer text*. |
| `test/context-budget.test.mjs` (extend) | C6C11-QA | AC-6 (stale-prd_path guard) + AC-9 (measurable dual-injection saving). |
| `test/compose-equivalence.test.mjs` + `test/fixtures/compose-golden/*` | C6C11-QA | AC-10 reconcile — **no regeneration expected** (see "Test surface & fixtures"). |

The 11 `prompts/<role>.ts` wrappers are **left in place, unchanged** — they stay
exported for the two tests that call them directly
(`test/researcher-deep-research.test.mjs`, `test/teamwork-lite.test.mjs`); they
simply stop being referenced by `PROMPT_REGISTRY`.

---

## Data Structures

```ts
// index.ts — resolution result (new)
type WorkspaceSource =
  | "workspace_path arg"
  | "CLAUDE_PROJECT_DIR env"
  | "cwd fallback";

interface WorkspaceResolution {
  path: string;            // the resolved absolute path (NEVER silently altered)
  source: WorkspaceSource; // which fallback step produced it
  managed: boolean;        // does path have .current/ or tasks.md ?
}

// index.ts — L1 in-memory dedup (new). Keyed by resolved workspace path.
// Cleared naturally when the stdio server process exits (== session end).
const constitutionDeliveredFor = new Set<string>();

// tools/registry.ts — PromptRegistryEntry, `build` replaced by `skillFile`
interface PromptRegistryEntry {
  name: string;
  description: string;
  arguments: Array<{ name: string; description: string; required: boolean }>;
  skillFile: string;       // e.g. "skill-architect.md"  (was: build: fn)
}

// bin/agent-governance-context.mjs — L2 marker file JSON at
// <workspace>/.current/.agc-hook-marker.json
interface HookMarker {
  ts: number;              // Date.now() at hook emit time
  pid: number;             // writing process pid (diagnostic only)
}
```

Constant: `const HOOK_MARKER_WINDOW_MS = 120_000;` (2 min — see DR-4).

---

## Interface Contracts

```ts
// index.ts (new, exported for the AC-4 unit test)
export function resolveWorkspacePath(
  args: Record<string, unknown> | undefined,
): WorkspaceResolution;
// arg present & string  -> { source: "workspace_path arg" }
// else CLAUDE_PROJECT_DIR-> { source: "CLAUDE_PROJECT_DIR env" }
// else process.cwd()     -> { source: "cwd fallback" }
// managed = existsSync(path/.current) || existsSync(path/tasks.md)

// prompts/build.ts (signature widened; both new params optional & defaulted)
export function buildPromptForRole(
  skillFile: string,
  description: string,
  workspacePath: string,
  fullDetail?: boolean,                 // existing, default false
  resolutionSource?: WorkspaceSource,   // NEW, default "workspace_path arg"
  omitConstitution?: boolean,           // NEW, default false
): PromptResult;
// omitConstitution=true -> the constitution slice is replaced by the S03
//   sentinel block; EVERYTHING else (skill, model hint, state footer) unchanged.
// Pure: no process-global reads. Repeated calls are identical (protects the
//   golden-fixture / compose-equivalence tests that call it in a loop).
```

Footer decision tree inside `buildPromptForRole` (replaces `build.ts:341-343`):

```
state parsed non-null            -> existing JSON state block (unchanged)
parse threw (err captured)       -> S02  (path + err.message)
no file, path NOT managed        -> S01a (⚠️ + "not a managed workspace" + path + source)
no file, path IS managed         -> S01b (genuine fresh + path + source)
```

Handler (`index.ts` `GetPromptRequestSchema`) new flow:

```ts
const { path: ws, source, managed } = resolveWorkspacePath(args);
const entry = PROMPT_REGISTRY.find(e => e.name === name);
if (!entry) throw new Error(`Prompt not found: ${name}`);

// C11 dedup — decide omit, then record delivery (fail-safe: any doubt => false)
const omit =
  constitutionDeliveredFor.has(ws)          // L1 prompt->prompt
  || hookMarkerFresh(ws);                    // L2 hook->prompt
constitutionDeliveredFor.add(ws);            // this session now "has" it

const result = buildPromptForRole(entry.skillFile, entry.description, ws,
                                  false, source, omit);
return appendSpecContext(result, ws, name);
```

`hookMarkerFresh(ws)` reads `<ws>/.current/.agc-hook-marker.json`; returns
`true` iff it parses AND `Date.now() - ts <= HOOK_MARKER_WINDOW_MS`; returns
`false` on absent / stale / unreadable / malformed (fail-safe default = emit).

---

## Copy / Strings (resolved variants)

`<source>` ∈ {`workspace_path arg`, `CLAUDE_PROJECT_DIR env`, `cwd fallback`}.

- **S01b (genuine fresh, managed)** — the spec S01 text verbatim:
  `No handoff.md found at <path>/.current/handoff.md (resolved via <source>). If this workspace should have state, verify workspace_path resolution — otherwise this is genuinely a fresh project; call tw_get_state to initialize.`
- **S01a (path not a managed workspace)** — S01 core + a stronger lead
  (preserves path + source + "verify workspace_path resolution" per spec's
  refinement licence):
  `⚠️ Current Project State — resolution suspect. <path> is not an agent-governance-managed workspace (no .current/ or tasks.md present); resolved via <source>. No handoff.md found there. If you are working in a managed workspace this is a workspace_path resolution mismatch — verify it; otherwise call tw_get_state to initialize.`
- **S02 (parse/migration error)** — spec verbatim:
  `⚠️ Current Project State — Lookup Failed. state lookup failed at <path>/.current/handoff.md: <error message>. This is NOT a fresh project — do not treat active_feature/pending_notes as absent. Call tw_get_state directly to retrieve the real state.`
- **S03 (constitution omitted)** — spec headline verbatim, plus a recovery
  line (architect addition — see DR-5; makes a rare false-omission
  self-healable, never silent):
  `constitution already in context via hook — omitted`
  `(If you do NOT see the governance constitution earlier in this session, it was not actually delivered: call tw_switch_role to load the role SOP and treat the constitution as required — do not proceed ungoverned.)`

sr-engineer MAY reflow whitespace/line length but MUST preserve, per string:
S01a/S01b — resolved path + resolution source + the "verify workspace_path
resolution" instruction; S02 — resolved path + error text + "NOT a fresh
project"; S03 — the verbatim headline + the recovery clause.

---

## Sequence Diagram

```mermaid
sequenceDiagram
  participant CC as Claude Code (client)
  participant Hook as SessionStart hook (short-lived proc)
  participant Srv as MCP server (long-lived proc)
  participant FS as .current/

  Note over Hook: SessionStart
  Hook->>FS: compose+emit full constitution (additionalContext)
  Hook->>FS: write .agc-hook-marker.json {ts}
  Note over CC: user types /teamwork (fetch #1)
  CC->>Srv: GetPrompt(teamwork)  [no workspace_path arg]
  Srv->>Srv: resolveWorkspacePath -> {path, source=env, managed}
  Srv->>FS: hookMarkerFresh(path)?  (ts within 120s -> true)
  Srv->>Srv: omit=true; constitutionDeliveredFor.add(path)
  Srv-->>CC: bundle = S03 + skill + state footer
  Note over CC: user types /teamwork-lite (fetch #2)
  CC->>Srv: GetPrompt(teamwork-lite)
  Srv->>Srv: constitutionDeliveredFor.has(path) -> omit=true (L1)
  Srv-->>CC: bundle = S03 + skill + state footer
  Note over CC,FS: net: full constitution present exactly once (hook copy)
```

---

## Decision Records

| Context | Decision | Consequences |
|---------|----------|--------------|
| **DR-1 — AC-4 mechanism.** The only per-request signal guaranteed correct is the explicit `workspace_path` arg; a long-lived/shared server's `cwd`/env can be stale (the live repro). A "remember last tw_* workspace" cache would satisfy AC-4 literally. | Adopt **env threading + managed-workspace annotation**, NOT a cache. Keep `arg → CLAUDE_PROJECT_DIR → cwd`; never silently redirect. The AC-4 test asserts: with `CLAUDE_PROJECT_DIR=W` and no arg, resolution returns `W` — the "CLAUDE_PROJECT_DIR env threading" mechanism the spec blesses. | Common per-project stdio case is fixed (env matches the dir the agent passes to `tw_get_state`). Residual wrong-resolution (neither arg nor env correct) is not auto-fixed but is made **visible** by S01a/S01b (AC-2). Closes off the session-cache alternative. |
| **DR-2 — how `source`/`omit` reach the footer without editing 11 wrappers.** Footer is built in `build.ts`; `source`/`omit` originate in the `index.ts` handler; 11 thin `build*Prompt` wrappers sit between and would each need a forward (14 files, over the ≤5/task budget). | Make `PROMPT_REGISTRY` **declarative** (`skillFile` string); the handler calls `buildPromptForRole(entry.skillFile, ...)` directly, so the two new params are passed at one call site. Wrappers stay for the two tests that import them. | C6-02 touches 3 files (`index.ts`, `registry.ts`, `build.ts`) not 14. `skill-evolution-v3.11.test.mjs` checks only `entry.name` (safe). Closes off both "thread through wrappers" and "delete wrappers" alternatives. |
| **DR-3 — three not-found footers.** The current single silent `null` collapses genuine-fresh, wrong-path, and parse-error. | Split into S02 (parse threw), S01a (path not managed), S01b (managed but no handoff.md), all naming path+source. | AC-1/AC-2/AC-3 each get a distinct, testable string. Adds a `managed` probe (2 `existsSync`) per fetch — negligible. |
| **DR-4 — C11 no shared session id ⇒ cross-channel dedup cannot be *proven* safe.** Hook writes `additionalContext`; server returns `GetPromptResult`; neither shares a Claude Code `session_id` (hook gets it on stdin; MCP server is not given it). Omitting the constitution when it is *not* actually in context = agent runs ungoverned (catastrophic); double-injection = token waste (benign). **Asymmetry: false-omission ≫ double-injection.** | Bias every uncertain case to **emit**. L1 (in-memory, resets per process) handles prompt→prompt with zero cross-session risk in stdio. L2 (windowed marker) handles hook→prompt best-effort; absent/stale/unreadable marker ⇒ emit full. Window = 120s (captures the boot-then-`/teamwork` repro; a later fetch safely re-emits). | AC-7/AC-8/AC-9 met for the common path. Residual tail: two sessions on the same workspace within 120s could let session 2 omit — mitigated by DR-5. HTTP multi-workspace: L1 keyed by workspace path (documented; recovery sentinel covers the rare same-workspace concurrent case). Closes off hook-self-gate (can't predict prompts) and prompt-sentinel-arg (no client support). |
| **DR-5 — make omission non-silent.** Per DR-4 the residual false-omission must never be a *silent* catastrophe. | S03 carries a **recovery instruction** (see Copy/Strings): if the reader doesn't actually see the constitution, it is told to load the SOP and refuse to proceed ungoverned. | Converts the rare false-omission from silent to self-healable. Extends the spec's S03 headline (spec permits this: S03 is "used only if the architect selects the sentinel-degrade mechanism"). |
| **DR-6 — dedup lives at the handler, not inside `buildPromptForRole`.** The capture script and `compose-equivalence`/`context-budget` tests call `buildPromptForRole` many times in one process; a process-global omit inside it would trip on the 2nd call and corrupt fixtures. | `buildPromptForRole` stays **pure**; it omits only when the handler passes `omitConstitution=true`. The in-memory flag + marker read live in the handler. | Golden fixtures & compose-equivalence are byte-unaffected (they never pass `omit`) → **no fixture regeneration** (AC-10). Closes off "flag inside build.ts". |
| **DR-7 — C6-03 is test-only.** `resolvePrdPath()` already `fs.existsSync`-guards `state.prd_path`; `ensureIndexFresh` `statSync`-guards. No second stale-path surface found in `build.ts`/hook. | No production change for C6-03; the AC-6 regression test is owned by qa-engineer under C6C11-QA (§2: only qa writes tests). | The spec's C6-03 sr-engineer task reduces to a **grep-level confirmation** (no code). Recommend coordinator fold C6-03's test into C6C11-QA to avoid the §2 test-authorship conflict (see Notes). |

---

## Deferred Resources

_None._ Spec *Dependencies / Prerequisites* records zero external references
("Resource Audit Gate is a no-op") — empty section is permitted per the SOP.

---

## Visual Harness

_Omitted (per SOP): no `design/<feature>.md` exists and the spec's Visual
Tokens / Visual Widgets are `N/A` — this is a server-internal, non-design
feature._

### Baseline Reachability Matrix

_Not applicable._ There are no frozen baselines (no `design/<feature>.md`
`## Visual Baselines`), so the matrix and the Visual Harness Gate do not apply.
The task's explicit request for the matrix is satisfied by this documented
N/A: with zero baselines there is nothing to drive to a capture state.

---

## File-by-file diff plan

### C6-01 — fail-loud footer (`prompts/build.ts` only) — ~1 file, <60 lines
1. In `buildPromptForRole`, change `try { state = parse() } catch {}` to capture
   the error: `let stateError: Error | null = null; try {...} catch (e) { stateError = e instanceof Error ? e : new Error(String(e)); }`.
2. Add trailing params `resolutionSource: WorkspaceSource = "workspace_path arg"`
   and `omitConstitution = false` to the signature; export the `WorkspaceSource`
   type from `build.ts` (imported by `index.ts`).
3. Replace the `stateBlock` ternary (`build.ts:341-343`) with the DR-3 decision
   tree (S02 if `stateError`; else if state → JSON; else S01a/S01b by a local
   `const managed = fs.existsSync(join(ws,'.current')) || fs.existsSync(join(ws,'tasks.md'))`).
4. Add the `omitConstitution` branch: when true, substitute the S03 block for
   the composed `constitution` before assembling `prompt` (skill/state untouched).
   *(Wired by C11-01; landed here so `build.ts` has one owner.)*

### C6-02 — resolution consistency (`index.ts`, `tools/registry.ts`) — 2 files, <70 lines
1. `index.ts`: add `resolveWorkspacePath(args): WorkspaceResolution` (exported);
   rewrite the `GetPromptRequestSchema` handler to use it and pass `source` into
   `buildPromptForRole`.
2. `tools/registry.ts`: change `PromptRegistryEntry` (`build:` → `skillFile:`),
   update the 11 entries to `skillFile: "skill-*.md"`, delete the 11 wrapper
   imports (lines 28-38). Wrapper files themselves untouched.

### C6-03 — stale prd_path — 0 production files
No production change (DR-7). sr-engineer confirms via grep that
`resolvePrdPath` (`build.ts:162`) and `ensureIndexFresh` (`build.ts:181`) guard
stale paths; the regression test is qa-owned (C6C11-QA / AC-6).

### C11-01 — constitution dedup (`index.ts`, `prompts/build.ts` branch already in C6-01, `bin/agent-governance-context.mjs`, `.gitignore`) — ~4 files, <70 lines
1. `index.ts`: add `const constitutionDeliveredFor = new Set<string>()` and
   `hookMarkerFresh(ws)`; compute `omit` and pass it into `buildPromptForRole`;
   `constitutionDeliveredFor.add(ws)` after computing `omit`.
2. `prompts/build.ts`: (S03 branch already added in C6-01 step 4) — no new edit
   if C6-01 landed it; otherwise add it here.
3. `bin/agent-governance-context.mjs`: after the successful emit (the branch
   that writes the full `body`, NOT the misconfigured-hint branch), write
   `<workspace>/.current/.agc-hook-marker.json` = `JSON.stringify({ ts: Date.now(), pid: process.pid })` via a `try/catch` (marker write failure must never break the hook).
4. `.gitignore`: add `.current/.agc-hook-marker.json`.

**Recommended implementation order (serializes shared-file edits):**
`C6-01` → `C6-02` → `C11-01`; `C6-03` is a confirm-only no-op anytime.

---

## Test surface & fixtures (planning note for qa — qa authors these)

- **AC-1/2/3/5** → new `test/prompt-state-footer.test.mjs`: assert on the footer
  text from the prompt handler / `buildPromptForRole`, covering S01a, S01b, S02.
- **AC-4** → same file: set `CLAUDE_PROJECT_DIR=W`, call the handler with no
  arg, assert resolved path == `W` (env-threading mechanism, DR-1).
- **AC-6** → extend an existing test (e.g. `context-budget` or `rag-lifecycle`):
  `resolvePrdPath(ws, { prd_path: "/nonexistent/x.md" })` returns auto-discovery
  or `null`, never throws.
- **AC-9** → extend `test/context-budget.test.mjs`: assert the dual scenario
  (constitution length − S03 length) chars saved, a concrete number.
- **AC-10 — `test/fixtures/compose-golden/*` do NOT need regeneration.** The 8
  `build-*` fixtures capture only the **constitution portion** (`capture-constitution-golden.mjs` slices at the first `\n\n---\n\n`), and every capture/test call to `buildPromptForRole` uses the default `omitConstitution=false` and default `resolutionSource` (footer lives *after* the skill separator, so it is not in the fixture slice). C6's footer change and C11's `omit` branch are therefore both outside the captured bytes. qa reconciles by re-running the suite and confirming byte-identity; if any fixture *did* change, that signals an unintended regression, not an expected rebaseline.
- **`test/context-budget.test.mjs` caps** — the default-path bundle size is
  unchanged (omit only fires via the handler), so existing size caps hold; the
  only addition is the AC-9 assertion.

---

## Notes for coordinator / PM (non-blocking)

- **§2 vs C6-03 task label:** the spec assigns "add/confirm the stale-prd_path
  regression *test*" to sr-engineer (C6-03) while C6C11-QA also covers AC-6.
  Per Constitution §2 (only qa-engineer writes tests) and DR-7 (no production
  change), C6-03 has no sr code deliverable. Recommend closing C6-03 as
  confirm-only and letting the AC-6 test live in C6C11-QA. Flagged, not blocked
  — this is a task-ownership tidy-up, not a design gap.
- **No schema_version bump** (spec *Out of Scope* clause satisfied): the L2
  marker is an ephemeral, git-ignored dot-file, not a versioned field of
  handoff/tasks/sqlite/config.

## Open Questions

_None._ All spec ACs are covered by the decisions above; ready for sr-engineer.
