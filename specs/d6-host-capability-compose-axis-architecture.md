# d6-host-capability-compose-axis — architecture

Blueprint for extending the A9 additive-composition pattern (constitution
`core`/`design`/`chain` axes) with a fourth, **skill-scoped host axis**, so
Claude-Code-only coordinator prose (Task-tool dispatch, `agent-*.jsonl`
telemetry, `~/.claude/agents` templates, `watermark-check.js` validation)
ships only to hosts that can act on it. Resolves the four design questions the
PM spec (`specs/d6-host-capability-compose-axis.md`) routed to architect.

This artifact is binding on T-D6-01…T-D6-04. Where it says "the auditor
decides the seam" (T-D6-03), that latitude is explicit; everywhere else the
decisions below are settled — do not re-litigate.

## Resolved Design Questions (read first)

### Q1 — How the server learns the host: explicit `host` config field

**Decision:** a single additive-optional config field `host` (string) in
`.current/.config.json`, e.g. `"host": "claude-code"`. It is the SINGLE
canonical, portable signal, read through the existing `loadConfig`. A
server-owned capability map (in the new skill-manifest module) maps the host
string → capability booleans. Today: `"claude-code"` → `{ taskTool: true }`;
every other/unknown/absent value → `{ taskTool: false }`.

**Why config, not auto-detection** (the spec delegated this choice; I reject
the option-(b) auto-detect approaches):

- **Consistency** — every existing dispatch-shaping signal in this codebase is
  explicit config/state (`taskPattern`, `taskPaths`, `driftBaselineIds`,
  `tokenBudgetPerFeature`, `dispatch_pins`), never heuristic client sniffing.
  A host axis driven by config is the same shape maintainers already know.
- **Determinism / testability (AC7)** — a JSON field is trivially unit-testable
  for both host states; mocking an MCP `initialize` `clientInfo` handshake is not.
- **Portability across all three render paths** — one channel works identically
  in `buildPromptForRole` (GetPrompt), `switchRole` (CallTool), and the
  SessionStart hook. `clientInfo` is **unavailable in the hook** (it is a
  separate CC subprocess outside the MCP session), and env vars are not portable
  or standardized across hosts.

**Rejected alternatives (explicitly, so they are not reopened):**
- **MCP `clientInfo.name`** — not visible to the hook path; brittle to client
  renames (a silent regression channel); requires new `initialize`-capture
  plumbing in `index.ts`; infers capability from identity. Considered and rejected.
- **Environment variable** — no host advertises a standard "Task tool available"
  env var; not portable.
- **Prompt-time parameter** — MCP `GetPrompt` argument schemas are fixed by the
  registered prompt; a client cannot pass arbitrary capability at fetch time.

**Precedence when multiple signals apply** (highest wins):
1. Explicit `.current/.config.json` `host` — authoritative on ALL paths. A
   workspace can force-include (`"claude-code"`) or force-lean (`"cursor"`,
   `"generic"`, any non-CC value).
2. **Structural default of the SessionStart hook only** — the hook is CC-only by
   construction, so when `host` is unset it composes the coordinator skill with
   `{ taskTool: true }`. (Config still overrides even here.)
3. In-server paths (`buildPromptForRole`, `switchRole`) with no config → the
   no-capability profile `{ taskTool: false }`.

Field contract: `host?: string`; absent, empty, or unrecognized ⇒ `taskTool:
false`. Additive-optional, **no `schema_version` bump** — same precedent as
`driftBaselineIds`/`tokenBudgetPerFeature` (absence == default, no migration).

### Q2 — Safe default when the signal is absent: EXCLUDE (with the tension resolved)

**Decision:** absent/unknown signal ⇒ host-tagged fragments **excluded** (lean),
mirroring the design axis' `false` default (`build.ts` L337-339). This is AC3's
literal "safe side."

**Resolving the AC3-vs-backward-compat tension** (AC3 says default-exclude; the
same AC's backward-compat clause says "never suppress prose that ships today to a
host that has no way to declare its capability"). The spec delegated this to the
architect; here is why default-exclude is **not** a breaking flip:

1. **The common CC setup keeps its prose with zero config.** The coordinator
   skill — which carries essentially all the CC-only prose — is delivered on CC
   by the SessionStart hook, which defaults to `{ taskTool: true }` (precedence
   rule 2). So the ordinary CC user loses nothing.
2. **The excluded prose is dispatch machinery only a Task-dispatching coordinator
   uses.** A lean coordinator still carries the CORE fallback instruction to use
   `tw_switch_role` (that note is tagged `core`, see Q4), so a CC-without-hook
   coordinator **degrades gracefully** (routes via `tw_switch_role`) rather than
   breaking. Losing model-pinned fresh-context dispatch is a capability
   reduction for a misconfigured setup, not a broken chain.
3. **One-line opt-in restores full composition everywhere.** Any CC user who
   drives the coordinator via the `/teamwork` prompt fetch instead of the hook
   sets `host: "claude-code"` (documented in README) to get `{ taskTool: true }`
   on the in-server paths too.
4. **Non-CC hosts — the feature's entire purpose — get the lean default with zero
   config.** That is the goal: Cursor/Continue/plain-MCP stop paying for dead
   prose immediately, no opt-in required.

There is one deliberately-accepted asymmetry: on CC-with-hook, a subsequent
`/teamwork` GetPrompt fetch (no config) re-delivers the coordinator skill *lean*
while the hook already delivered it *full*. This is acceptable — the full prose
is already in session context (and the constitution is deduped via the existing
C11 hook marker). Setting `host: "claude-code"` makes all paths consistent for
users who care. Documented, not a defect.

**A positive property, not a compromise:** `switchRole` (the `tw_switch_role`
path) defaulting to `taskTool:false` is *semantically correct* — a coordinator
using `tw_switch_role` is BY DEFINITION on the non-Task fallback path, so role
SOPs delivered there SHOULD omit Task-dispatch prose. Config `host:"claude-code"`
overrides for the rare CC user who has templates but switches a role in-context.

### Q3 — Manifest shape: a parallel skill-manifest module mirroring the constitution's shape

**Decision:** a NEW module `prompts/skill-manifest.ts`, NOT a new tag on
`ConstitutionSegment`. Rationale (Decision Records DR-1): the constitution and
skills are different documents with different segment sets and different axes;
overloading `CONSTITUTION_SEGMENTS` would break its golden invariant
("concatenation === constitution monolith") and its predicate signature. We reuse
the *shape* (ordered `{file, tag}` list + pure predicate), keyed per skill file,
so `build.ts`'s pipeline needs only one added parameter — satisfying AC4's "an
additional axis parameter, not a parallel pipeline."

The compose call is a drop-in swap for the current unconditional
`loadContent(skillFile, …)`; everything downstream (`expandPartials` →
`parseSkillFile` → `stripOriginTags` → `stripRationale`) is UNCHANGED and
operates on the composed string exactly as today.

### Q4 — Skill-audit criteria for T-D6-03

Given below in *Interface Contracts § Audit Criteria*. Applies to the 5
non-coordinator skills; each gets a recorded outcome (AC6), no silent skips.

## Affected Files

- **CREATE `prompts/skill-manifest.ts`** — `SkillSegmentTag`, `SkillSegment`,
  the per-skill `SKILL_SEGMENTS` registry, `HostCapabilities`,
  `hostCapabilitiesFor()`, `includeSkillSegment()`, `composeSkill()`. Mirrors
  `prompts/constitution-manifest.ts`'s data-module style (ordered data + pure
  functions, no fs in the module — the caller injects the loader). (T-D6-01)
- **MODIFY `tools/config.ts`** — add `host?: string` to `WorkspaceConfig` and
  surface it in `loadConfig` (additive-optional, string-typed, no schema bump;
  same filter style as `driftBaselineIds`). (T-D6-01)
- **MODIFY `prompts/build.ts`** — in `buildPromptForRole`, derive
  `hostCaps = hostCapabilitiesFor(loadConfig(workspacePath).host)`; replace the
  L363 `loadContent(skillFile, workspacePath)` with
  `composeSkill(skillFile, hostCaps, (f) => loadContent(f, workspacePath))`.
  No other pipeline change. (T-D6-01)
- **MODIFY `tools/role.ts`** — in `switchRole`, derive `hostCaps` from
  `loadConfig(workspacePath).host`; replace the raw `fs.readFileSync(filePath)`
  with `composeSkill(skillFile, hostCaps, loadPartial-style loader)` honoring the
  same `.current/` override resolution. (T-D6-01)
- **MODIFY `bin/agent-governance-context.mjs`** — compose the coordinator skill
  via `composeSkill` imported from `dist/prompts/skill-manifest.js`, with caps =
  `config.host ? hostCapabilitiesFor(config.host) : { taskTool: true }`
  (structural CC default). Fail-loud fallback mirrors the existing manifest-import
  guard (return "" → the "hook misconfigured" hint fires). (T-D6-01)
- **CREATE `content/skill-coord-NN-*.md` fragments** — verbatim byte-partition of
  today's `content/skill-coordinator.md` into ordered core/host fragments per the
  *Coordinator Fragment Partition* table below; register them in
  `SKILL_SEGMENTS["skill-coordinator.md"]`. Retire the monolith file (its content
  becomes the golden fixture). (T-D6-02)
- **CREATE `test/fixtures/compose-golden/skill-coordinator-monolith.txt`** —
  frozen copy of today's `skill-coordinator.md` bytes; golden baseline for AC5.
  (T-D6-02)
- **MODIFY the 5 non-coordinator skills + registry as the audit dictates** — split
  using the same tagging IF CC-only prose is found; else leave untouched and
  record the outcome. (T-D6-03)
- **CREATE/MODIFY tests** — `test/skill-manifest.test.mjs`: golden byte-identity
  under `{taskTool:true}`, exclusion under `{taskTool:false}`, config precedence,
  unsplit-skill passthrough, whole-file `.current/` override bypass; plus per-split
  role. All pre-existing tests stay green. (T-D6-04)

## Data Structures

```ts
// prompts/skill-manifest.ts
export type SkillSegmentTag = "core" | "host:claude-code";

export interface SkillSegment {
  readonly file: string;          // basename in content/ (honors .current/ override via caller's loader)
  readonly tag: SkillSegmentTag;
}

// Keyed by skill filename — each skill owns its ordered fragment list.
// A skill ABSENT from this map is composed as-is (whole file), so only split
// skills change and unsplit skills stay byte-identical (AC6(b)).
export const SKILL_SEGMENTS: Readonly<Record<string, readonly SkillSegment[]>> = {
  "skill-coordinator.md": [ /* ordered fragments — see partition table */ ],
  // other skills added by T-D6-03 only if they carry host-tagged prose
};

export interface HostCapabilities {
  readonly taskTool: boolean;     // host can Task(subagent_type=…)-dispatch subagents
}
```

```ts
// tools/config.ts — additive-optional field
export interface WorkspaceConfig {
  taskPattern?: string;
  taskPaths?: string[];
  driftBaselineIds?: string[];
  tokenBudgetPerFeature?: number;
  host?: string;                  // NEW: workspace host declaration; drives hostCapabilitiesFor()
}
```

## Interface Contracts

```ts
// Capability map — the ONE place host-string → capability lives. Extending to a
// new host = one row here (future-proofs the tag name against per-client renames).
export function hostCapabilitiesFor(host: string | undefined): HostCapabilities {
  return { taskTool: host === "claude-code" };
}

// Inclusion predicate — mirrors includeSegment(). Pure.
export function includeSkillSegment(tag: SkillSegmentTag, caps: HostCapabilities): boolean {
  switch (tag) {
    case "core":             return true;
    case "host:claude-code": return caps.taskTool;
  }
}

// Compose a skill's text for a dispatch. `load` is injected (fs-free module).
// Precedence: (1) whole-file .current/ override → verbatim, no host filtering
// (an explicit override is authoritative); (2) registry fragments filtered by
// predicate, concatenated in order; (3) unsplit → load the base file as-is.
export function composeSkill(
  skillFile: string,
  caps: HostCapabilities,
  load: (file: string) => string,
  hasOverride?: (file: string) => boolean,   // optional whole-file override probe
): string {
  if (hasOverride?.(skillFile)) return load(skillFile);   // precedence 1
  const segments = SKILL_SEGMENTS[skillFile];
  if (!segments) return load(skillFile);                  // precedence 3
  return segments
    .filter((s) => includeSkillSegment(s.tag, caps))
    .map((s) => load(s.file))
    .join("");                                            // precedence 2
}
```

Call-site contracts (each swaps ONE line, no pipeline fork — AC4):
- `buildPromptForRole` L363: `composeSkill(skillFile, hostCapabilitiesFor(loadConfig(workspacePath).host), (f) => loadContent(f, workspacePath), (f) => fs.existsSync(path.join(workspacePath, ".current", f)))`.
- `switchRole`: same, using its existing `.current/`-override-aware loader.
- hook: `composeSkill(skillVariant, config.host ? hostCapabilitiesFor(config.host) : { taskTool: true }, loadContent)`.

### Audit Criteria (T-D6-03 — binding for the auditor)

A section is **`host:claude-code`** (split it OUT) iff BOTH hold:
1. It instructs an action **structurally impossible on a non-Task host**:
   invoking `Task(subagent_type=…)`; reading `agent-*.jsonl` / `.current/usage.jsonl`
   token telemetry; copying/consulting `~/.claude/agents/<role>.md` templates;
   running `dist/lib/watermark-check.js` against subagent replies; or the with-tier
   subagent watermark FORM itself.
2. **Removing it removes no rule a non-CC host must still obey.** Test: would a
   Cursor / plain-MCP coordinator behave *wrongly* without this text? If yes → it
   is CORE, keep it.

A section stays **`core`** (do NOT split out) if it governs the shared routing
chain / state machine / gates every host uses — `ALLOWED_TRANSITIONS`,
cut-approval, hop cap, drift reconcile, escalation routes, feature-scope gate, the
`tw_switch_role` **fallback** instruction (that is the non-CC host's own
instruction — it MUST ship to them), and `next_role`/`dispatch_pins`/`resume_of`
field *semantics as state* (the fields are written identically on any host).

**Rule that breaks ties:** never split a fragment such that a shared rule is lost.
A slightly-fat core is acceptable; a lost rule is not. If host and core prose are
not cleanly separable at fragment granularity, keep the block CORE and record the
"kept CORE for safety" decision.

**Expected outcome for the 5 non-coordinator skills:** sr-engineer, pm, architect,
researcher, qa-engineer are *dispatched-to* roles — they do not dispatch
subagents — so they are expected to carry little or no host-tagged prose. Record
per AC6 a one-line outcome for EACH: `split (fragments …)` or `no CC-only prose
found — left untouched`. No silent skips.

## Coordinator Fragment Partition (T-D6-02 guidance)

Tag per section is architect-binding; exact byte seams are T-D6-02's to finalize
under the AC5 golden-byte-identity constraint (concatenation under `{taskTool:true}`
== today's file byte-for-byte). Frontmatter (`---\nrecommended_model: sonnet\n---`)
MUST live in the first CORE fragment so `parseSkillFile` still finds it post-compose.

| skill-coordinator.md section (current) | tag |
|---|---|
| Frontmatter + Persona + Routing Table + Complexity/Feature-Scope Gates + Design-source detection | `core` |
| Auto-Routing intro paragraph (L79) | `core` |
| **Subagent Dispatch (Claude Code)** (L81) | `host:claude-code` |
| Dispatch Brief Template (L83–95) | `host:claude-code` |
| Dispatch-time overrides `dispatch_pins` (L97–111) — framed entirely around Task dispatch with model override | `host:claude-code` |
| Fallback (`tw_switch_role`) note (L113) | `core` |
| Stop conditions / Opt-out / Hop counter scope (L115–119) | `core` |
| Escalation Routes table + Cut-approval writer obligation (L121–140) | `core` (keep whole; rows apply to switch_role'd roles too; do not row-split a markdown table) |
| Crash-Resume Protocol (L142–174) | `core` (applies to any resumed role; `Task(…)` mentions are inline examples) |
| Subagent Reply Watermark Validation (L176–207) | `host:claude-code` |
| Visual Verdict Boundary (L209–222) | `core` |
| Drift Reconcile after out-of-band execution (L224–237) | `core` |
| Subagent Token Observability (L239–249) | `host:claude-code` |
| Token Budget Brake (L251–276) | `host:claude-code` (accounting reads `agent-*.jsonl`/`usage.jsonl`; no sidecar exists on non-CC hosts) |
| SOP (L278–288) | `core` (step 5's "Task-tool subagent if available, else tw_switch_role" is host-agnostic phrasing) |

Fragment files stay ordered so core/host interleave reproduces document order.
Suggested naming: `skill-coord-01-core-head.md`, `skill-coord-02-host-dispatch.md`,
… (tag lives in the registry, not the filename).

## Sequence Diagram

```mermaid
sequenceDiagram
    participant Client as Host client (CC / Cursor / …)
    participant Hook as SessionStart hook (CC-only)
    participant Server as MCP server (GetPrompt / CallTool)
    participant Compose as composeSkill()
    participant Cfg as loadConfig(host)

    Note over Hook: fires only under Claude Code
    Hook->>Cfg: read .config.json host (optional)
    Hook->>Compose: composeSkill(coord, host ? map(host) : {taskTool:true})
    Compose-->>Hook: full coordinator (CC prose included)

    Note over Client,Server: any host — /teamwork fetch or tw_switch_role
    Client->>Server: GetPrompt(teamwork) / CallTool(tw_switch_role)
    Server->>Cfg: loadConfig(workspace).host
    Cfg-->>Server: host string | undefined
    Server->>Compose: composeSkill(skill, hostCapabilitiesFor(host))
    Compose->>Compose: whole-file override? → verbatim; else filter fragments by predicate
    Compose-->>Server: skill text (host prose in iff taskTool)
    Server-->>Client: prompt (→ expandPartials → parseSkillFile → strip passes, unchanged)
```

## Decision Records

| Context | Decision | Consequences |
|---|---|---|
| Where the host signal lives | Explicit `.current/.config.json` `host` string field, not clientInfo/env/param auto-detection | Deterministic, testable, portable across all 3 render paths; requires a documented one-line opt-in for the CC-without-hook `/teamwork` case; no new `index.ts` init plumbing |
| Default when signal absent | EXCLUDE host prose (`taskTool:false`), per AC3 | Non-CC hosts lean with zero config (the goal); CC keeps prose via the hook's structural `{taskTool:true}` default; graceful `tw_switch_role` fallback means no hard breakage |
| Manifest home (DR-1) | New `prompts/skill-manifest.ts` mirroring the constitution shape, keyed per skill — NOT a new `ConstitutionSegment` tag | Constitution golden invariant untouched; `build.ts` gains one parameter, not a parallel pipeline (AC4) |
| Unsplit skills | Skill absent from `SKILL_SEGMENTS` → `composeSkill` loads the whole file as-is | Only coordinator changes in T-D6-02; the 5 others are byte-identical until the audit splits them (AC6(b)) |
| Whole-file `.current/` override | `composeSkill` returns an existing whole-file override verbatim, bypassing fragment composition and host filtering | Preserves existing per-workspace whole-skill overrides; fragment-level override still works for split fragments (same semantics the constitution accepted) |
| Tag name `host:claude-code` vs capability | Tag named `host:claude-code` (per backlog) but driven by the `HostCapabilities.taskTool` boolean via a central `hostCapabilitiesFor` map | Human sets a legible host string; capability decision centralized in one map; future hosts = one map row without renaming tags |
| `switchRole` default `taskTool:false` | Kept as default (not overridden to CC) | Semantically correct — the `tw_switch_role` path IS the non-Task fallback, so role SOPs there should omit Task prose; config overrides for the edge case |
| Token Budget Brake tag | `host:claude-code` | Its accounting reads `agent-*.jsonl`/`usage.jsonl`, which only CC produces; non-CC loses nothing usable. Auditor may revisit the ceiling-semantics seam, but the coordinator split ships it as host |

## Deferred Resources

_None — the spec's Dependencies / Prerequisites records zero external references
(Resource Audit Gate: zero `http(s)`/figma/mockup/ticket hits)._

## Open Questions

None. The two questions the spec delegated to architect (host-detection mechanism;
absent-signal default) are resolved above with documented engineering rationale;
neither requires a human call.
